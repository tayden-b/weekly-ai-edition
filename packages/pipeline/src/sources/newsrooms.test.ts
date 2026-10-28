import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { adapterContext, EXCERPT_MAX_CHARS, isRawItem } from "../adapter.js";
import { loadSourcesConfig } from "../config.js";
import {
  type AdapterFixture,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
} from "../testing/harness.js";
import {
  createNewsroomAdapter,
  NEWSROOM_ADAPTER_ID,
  type NewsroomFeed,
  newsroomFeedsFromSources,
} from "./newsrooms.js";

const fixturePath = (name: string) =>
  fileURLToPath(new URL(`./__fixtures__/newsroom-rss-${name}.json`, import.meta.url));

/** The §5.1 newsroom set as configured in `config/sources.yaml`. */
const FEEDS: NewsroomFeed[] = [
  {
    id: "techcrunch-ai",
    endpoint: "https://techcrunch.com/category/artificial-intelligence/feed/",
    publisher: "TechCrunch",
    kind: "rss",
  },
  {
    id: "theverge-ai",
    endpoint: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    publisher: "The Verge",
    kind: "atom",
  },
  {
    id: "ars-ai",
    endpoint: "https://arstechnica.com/tag/artificial-intelligence/feed/",
    publisher: "Ars Technica",
    kind: "rss",
  },
  {
    id: "mit-tr-ai",
    endpoint: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
    publisher: "MIT Technology Review",
    kind: "rss",
  },
  {
    id: "reuters-tech",
    endpoint: "https://www.reuters.com/technology/",
    publisher: "Reuters",
    kind: "html-index",
  },
  {
    id: "bloomberg-tech",
    endpoint: "https://www.bloomberg.com/feeds/technology/news.rss",
    publisher: "Bloomberg",
    kind: "rss",
  },
];

const FIXTURE_BY_FEED: Record<string, string> = {
  "techcrunch-ai": "techcrunch",
  "theverge-ai": "theverge",
  "ars-ai": "ars",
  "mit-tr-ai": "mittr",
  "reuters-tech": "reuters",
  "bloomberg-tech": "bloomberg",
};

const adapter = (feeds: NewsroomFeed[]) => createNewsroomAdapter({ feeds });
const oneFeed = (id: string) => adapter(FEEDS.filter((f) => f.id === id));

// Fixture bodies were recorded 2026-10-28; a fixed clock just past them keeps
// both the fetch window and fetched_at stamps deterministic.
const NOW = new Date("2026-10-29T00:00:00Z");
const WEEK: { from: Date; to: Date } = {
  from: new Date("2026-10-20T00:00:00Z"),
  to: NOW,
};

describe("newsroom-rss adapter: per-feed fixtures, no network", () => {
  for (const feed of FEEDS.filter((f) => f.id !== "reuters-tech")) {
    it(`${feed.id}: recorded body replays into valid RawItems`, async () => {
      const { items, mapped } = await runAdapterFixture(
        oneFeed(feed.id),
        fixturePath(FIXTURE_BY_FEED[feed.id]!),
        { now: NOW, window: WEEK },
      );
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(mapped.length).toBeGreaterThanOrEqual(1);
      for (const item of [...items, ...mapped]) {
        expect(isRawItem(item)).toBe(true);
        expect(item.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
        expect(item.fetched_at).toBe(NOW.toISOString());
      }
      // fetch path carries config context: curated publisher + feed provenance
      for (const item of items) {
        expect(item.publisher).toBe(feed.publisher);
        expect(item.source_ids.newsroom_feed).toBe(feed.id);
      }
    });
  }

  it("techcrunch-ai: captures RSS guid + feed categories (the opinion-tag mechanism)", async () => {
    const { items } = await runAdapterFixture(
      oneFeed("techcrunch-ai"),
      fixturePath("techcrunch"),
      { now: NOW, window: WEEK },
    );
    expect(items).toHaveLength(3);
    const first = items[0]!;
    expect(first.headline).toContain("Google opens Gemini and Search");
    expect(first.source_ids.rss_guid).toBe("https://techcrunch.com/?p=3182509");
    expect(first.categories).toEqual(["AI", "Apps", "Google", "Google Search", "gemini"]);
    expect(first.excerpt).toContain("developer platform");
  });

  it("theverge-ai: parses Atom — link rel=alternate, published, category terms, summary only", async () => {
    const { items } = await runAdapterFixture(
      oneFeed("theverge-ai"),
      fixturePath("theverge"),
      { now: NOW, window: WEEK },
    );
    expect(items).toHaveLength(3);
    const first = items[0]!;
    expect(first.headline).toContain("enhanced autofill");
    expect(first.canonical_url).toBe(
      "https://www.theverge.com/tech/1020626/chrome-enhanced-autofill-gmail-forms-gemini-personal-intelligence",
    );
    expect(first.source_ids.atom_id).toBe("https://www.theverge.com/?p=1020626");
    expect(first.source_ids.newsroom_feed).toBe("theverge-ai");
    expect(first.published_at).toBe("2026-10-28T17:00:00.000Z"); // <published>, not <updated>
    expect(first.categories).toContain("AI");
    // excerpt is the publisher's <summary> text — never the <content> body
    expect(first.excerpt).toContain("enhanced autofill");
    expect(first.excerpt).not.toContain("<figure");
  });

  it("ars-ai: excerpt comes from <description>, never content:encoded bodies", async () => {
    const { items } = await runAdapterFixture(oneFeed("ars-ai"), fixturePath("ars"), {
      now: NOW,
      window: WEEK,
    });
    expect(items).toHaveLength(3);
    const first = items[0]!;
    expect(first.excerpt).toBe("Genie 4 will roll out to developers and Google AI Ultra subscribers soon.");
    expect(first.source_ids.rss_guid).toContain("arstechnica.com");
    expect(first.categories).toContain("Artificial Intelligence");
  });

  it("mit-tr-ai: empty <description> falls back to the headline as excerpt", async () => {
    const { items } = await runAdapterFixture(oneFeed("mit-tr-ai"), fixturePath("mittr"), {
      now: NOW,
      window: WEEK,
    });
    expect(items).toHaveLength(3);
    const empty = items[0]!; // recorded with <description><![CDATA[]]></description>
    // excerpt = the headline verbatim, whitespace-normalized per toExcerpt
    expect(empty.excerpt).toBe(empty.headline.replace(/\s+/g, " ").trim());
    expect(empty.categories).toContain("sponsored"); // verbatim category capture
    const withDesc = items[1]!;
    expect(withDesc.excerpt).not.toBe(withDesc.headline.replace(/\s+/g, " ").trim());
    expect(withDesc.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
  });

  it("bloomberg-tech: RFC-822 GMT pubDate parses; non-permalink guid stored", async () => {
    const { items } = await runAdapterFixture(
      oneFeed("bloomberg-tech"),
      fixturePath("bloomberg"),
      { now: NOW, window: WEEK },
    );
    expect(items).toHaveLength(3);
    const first = items[0]!;
    expect(first.publisher).toBe("Bloomberg");
    expect(first.published_at).toBe("2026-10-28T17:44:28.000Z");
    expect(first.source_ids.rss_guid).toBe("TNMPA4KGIFPU00");
  });

  it("reuters-tech: recorded 401 DataDome block degrades to zero items, no throw", async () => {
    const { items } = await runAdapterFixture(
      oneFeed("reuters-tech"),
      fixturePath("reuters"),
      { now: NOW, window: WEEK, expectMinItems: 0 },
    );
    expect(items).toEqual([]);
  });
});

describe("all feeds together: one feed's failure degrades itself, not the run", () => {
  const mergedFixture = (): AdapterFixture => ({
    responses: FEEDS.flatMap(
      (f) => loadAdapterFixture(fixturePath(FIXTURE_BY_FEED[f.id]!)).responses,
    ),
  });

  it("fetch() collects every reachable feed; blocked Reuters contributes nothing", async () => {
    const ctx = adapterContext({
      fetch: replayFetcher(mergedFixture()),
      now: () => NOW,
    });
    const items = await adapter(FEEDS).fetch(WEEK, ctx);
    const byFeed = new Map<string, number>();
    for (const item of items) {
      expect(isRawItem(item)).toBe(true);
      const feed = item.source_ids.newsroom_feed!;
      byFeed.set(feed, (byFeed.get(feed) ?? 0) + 1);
    }
    expect(byFeed.get("reuters-tech") ?? 0).toBe(0);
    for (const id of ["techcrunch-ai", "theverge-ai", "ars-ai", "mit-tr-ai", "bloomberg-tech"]) {
      expect(byFeed.get(id), id).toBe(3);
    }
    expect(items).toHaveLength(15);
  });

  it("is deterministic across runs", async () => {
    const ctx = () =>
      adapterContext({ fetch: replayFetcher(mergedFixture()), now: () => NOW });
    const a = await adapter(FEEDS).fetch(WEEK, ctx());
    const b = await adapter(FEEDS).fetch(WEEK, ctx());
    expect(a).toEqual(b);
  });

  it("filters items outside the fetch window", async () => {
    const ctx = adapterContext({
      fetch: replayFetcher(mergedFixture()),
      now: () => NOW,
    });
    // 2026-10-28 only: drops ars (27th, 23rd, 21st) and mit-tr's older items.
    const day = { from: new Date("2026-10-28T00:00:00Z"), to: NOW };
    const items = await adapter(FEEDS).fetch(day, ctx);
    for (const item of items) {
      expect(item.published_at.startsWith("2026-10-28")).toBe(true);
    }
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThan(15);
  });

  it("health() reports the aggregate and names the failed feed", async () => {
    const ctx = adapterContext({
      fetch: replayFetcher(mergedFixture()),
      now: () => NOW,
    });
    const health = await adapter(FEEDS).health(ctx);
    expect(health.ok).toBe(false); // a degraded feed is honest signal, not silence
    expect(health.detail).toContain("5/6 feeds reachable");
    expect(health.detail).toContain("reuters-tech: HTTP 401");
    expect(health.checked_at).toBe(NOW.toISOString());
  });

  it("health() is ok when every configured feed answers", async () => {
    const ctx = adapterContext({
      fetch: replayFetcher(loadAdapterFixture(fixturePath("techcrunch"))),
      now: () => NOW,
    });
    const health = await oneFeed("techcrunch-ai").health(ctx);
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("1/1 feeds reachable");
  });
});

describe("map() robustness", () => {
  const map = (p: unknown) => oneFeed("techcrunch-ai").map(p, NOW);

  it("emits nothing for non-feed payloads — never throws", () => {
    expect(map(undefined)).toEqual([]);
    expect(map(42)).toEqual([]);
    expect(map({})).toEqual([]);
    expect(map("")).toEqual([]);
    expect(map("   ")).toEqual([]);
    expect(map("this is not xml")).toEqual([]);
    expect(map("<rss><channel>garbage")).toEqual([]);
  });

  it("drops items lacking headline, link, or a parseable timestamp", async () => {
    const body = `<?xml version="1.0"?><rss version="2.0"><channel>
      <title>Feed</title>
      <item><title>Ok</title><link>https://x.example/1</link><pubDate>Wed, 28 Oct 2026 10:00:00 +0000</pubDate><description>d</description></item>
      <item><title></title><link>https://x.example/2</link><pubDate>Wed, 28 Oct 2026 10:00:00 +0000</pubDate></item>
      <item><title>No link</title><pubDate>Wed, 28 Oct 2026 10:00:00 +0000</pubDate></item>
      <item><title>No date</title><link>https://x.example/3</link></item>
      </channel></rss>`;
    const items = map(body);
    expect(items).toHaveLength(1);
    expect(items[0]!.headline).toBe("Ok");
  });

  it("extracts JSON-LD article nodes from an html-index body (link-only path)", () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:site_name" content="Example Wire"/>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: [
          {
            "@type": "NewsArticle",
            headline: "Lab ships a new model",
            url: "https://wire.example/a/1",
            datePublished: "2026-10-28T09:00:00Z",
            description: "The lab said the model is faster.",
          },
          {
            "@type": "NewsArticle",
            headline: "No timestamp — dropped",
            url: "https://wire.example/a/2",
          },
        ],
      })}</script></head><body></body></html>`;
    const items = map(html);
    expect(items).toHaveLength(1);
    expect(items[0]!.publisher).toBe("Example Wire");
    expect(items[0]!.canonical_url).toBe("https://wire.example/a/1");
    expect(items[0]!.excerpt).toContain("faster");
  });
});

describe("config wiring", () => {
  it("newsroomFeedsFromSources picks up exactly the §5.1 set from sources.yaml", () => {
    const configPath = fileURLToPath(new URL("../../../../config/sources.yaml", import.meta.url));
    const feeds = newsroomFeedsFromSources(loadSourcesConfig(configPath));
    expect(feeds.map((f) => f.id).sort()).toEqual(
      ["ars-ai", "bloomberg-tech", "mit-tr-ai", "reuters-tech", "techcrunch-ai", "theverge-ai"].sort(),
    );
    for (const f of feeds) {
      expect(f.publisher).toBeTruthy();
      expect(f.endpoint).toMatch(/^https:\/\//);
    }
  });

  it("adapter id matches the adapter field used in sources.yaml", () => {
    expect(NEWSROOM_ADAPTER_ID).toBe("newsroom-rss");
  });
});
