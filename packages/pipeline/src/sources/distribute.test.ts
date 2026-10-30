import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type Fetcher, isRawItem, USER_AGENT } from "../adapter.js";
import {
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
} from "../testing/harness.js";
import {
  createDistributeAdapter,
  DISTRIBUTE_ADAPTER_ID,
  DISTRIBUTE_PUBLISHER,
} from "./distribute.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/distribute.json", import.meta.url));
const RELEASES_ENDPOINT = "https://distribute.software/api/v1/releases";
const STORIES_ENDPOINT = "https://distribute.software/api/v1/stories";

/** Window covering the recorded week (Oct 2026); fixture clock stays fixed. */
const WINDOW = { from: new Date("2026-10-24T00:00:00Z"), to: new Date("2026-10-31T23:59:59Z") };

const releasesAdapter = () =>
  createDistributeAdapter({ id: "distribute-releases", endpoint: RELEASES_ENDPOINT });
const storiesAdapter = () =>
  createDistributeAdapter({ id: "distribute-stories", endpoint: STORIES_ENDPOINT });

describe("distribute-software adapter — releases feed", () => {
  it("replays recorded releases through the harness: outbound canonical URLs, no network", async () => {
    const { items, mapped } = await runAdapterFixture(releasesAdapter(), FIXTURE_PATH, {
      window: WINDOW,
    });
    expect(releasesAdapter().id).toBe(DISTRIBUTE_ADAPTER_ID);

    // fetch path: 5 recorded releases minus the out-of-window Oct-02 one.
    expect(items).toHaveLength(4);
    for (const item of items) expect(isRawItem(item)).toBe(true);

    const gemini = items[0]!;
    expect(gemini.headline).toBe("Gemini 4 Carbon: Our next frontier model");
    // canonical_url is the OUTBOUND publisher link, not the site permalink.
    expect(gemini.canonical_url).toBe(
      "https://deepmind.google/blog/gemini-4-carbon-our-next-frontier-model/",
    );
    expect(gemini.publisher).toBe("Google DeepMind");
    expect(gemini.published_at).toBe("2026-10-28T17:00:58.000Z");
    expect(gemini.fetched_at).toBe(FIXTURE_NOW.toISOString());
    // excerpt is the record's own title text, ≤300 chars.
    expect(gemini.excerpt).toBe("Gemini 4 Carbon: Our next frontier model");
    expect(gemini.source_ids).toEqual({
      feed: "distribute-releases",
      distribute_id: "release-1074",
      distribute_url: "https://distribute.software/companies/google",
      distribute_source: "lab",
      distribute_companies: "google",
    });

    // map path is unfiltered: all 5 recorded records map.
    expect(mapped.filter((i) => i.source_ids.distribute_id?.startsWith("release-"))).toHaveLength(
      5,
    );
  });

  it("filters records outside the fetch window", async () => {
    const { items } = await runAdapterFixture(releasesAdapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-10-26T00:00:00Z"), to: new Date("2026-10-27T00:00:00Z") },
    });
    // Only the Oct-26 release survives; the Oct-27/28 ones are too new.
    expect(items).toHaveLength(1);
    expect(items[0]!.source_ids.distribute_id).toBe("release-1014");
  });

  it("requests a bounded 'latest N' page via limit", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const base = replayFetcher(fixture, FIXTURE_PATH);
    let requested: string | undefined;
    const spy: Fetcher = (url, init) => {
      requested = typeof url === "string" ? url : url.toString();
      return base(url, init);
    };
    await releasesAdapter().fetch(WINDOW, { fetch: spy, now: () => FIXTURE_NOW });
    expect(requested).toContain("/api/v1/releases");
    expect(requested).toContain("limit=");
  });
});

describe("distribute-software adapter — stories feed", () => {
  it("maps media + hn stories; hn score feeds hn_points", async () => {
    const { items } = await runAdapterFixture(storiesAdapter(), FIXTURE_PATH, { window: WINDOW });
    expect(items).toHaveLength(4);
    for (const item of items) expect(isRawItem(item)).toBe(true);

    const nyt = items.find((i) => i.source_ids.distribute_id === "story-25507")!;
    expect(nyt.publisher).toBe("The New York Times");
    expect(nyt.canonical_url).toBe("https://www.nytimes.com/2026/10/28/technology/apple-touch-screen-macbook-pro.html");
    expect(nyt.source_ids.distribute_source).toBe("media");
    expect(nyt.source_ids.distribute_url).toBe("https://distribute.software/stories/25507");
    expect(nyt.hn_points).toBeUndefined();

    const hn = items.find((i) => i.source_ids.distribute_id === "story-25506")!;
    expect(hn.headline).toBe("Gemini 4 Carbon");
    expect(hn.publisher).toBe("Hacker News");
    expect(hn.hn_points).toBe(265);
    expect(hn.source_ids.hn_discussion_url).toBe(
      "https://news.ycombinator.com/item?id=50276792",
    );
    expect(hn.source_ids.distribute_source).toBe("hn");
  });
});

describe("distribute-software adapter — mapping edge cases", () => {
  const adapter = releasesAdapter();
  const now = new Date("2026-10-28T20:00:00.000Z");

  it("drops records missing title/url/publishedAt rather than emitting invalid items", () => {
    const out = adapter.map(
      {
        releases: [
          { id: "r-ok", title: "Fine", url: "https://example.com/x", publishedAt: "2026-10-28T00:00:00.000Z", outlet: "X" },
          { id: "r-no-title", url: "https://example.com/y", publishedAt: "2026-10-28T00:00:00.000Z" },
          { id: "r-no-url", title: "No URL", publishedAt: "2026-10-28T00:00:00.000Z" },
          { id: "r-no-date", title: "No date", url: "https://example.com/z" },
        ],
      },
      now,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.source_ids.distribute_id).toBe("r-ok");
  });

  it("falls back to `date` when `publishedAt` is absent, and to the feed as publisher when `outlet` is missing", () => {
    const out = adapter.map(
      {
        stories: [
          { id: "s-1", title: "Date-only story", url: "https://example.com/s", date: "2026-10-28" },
        ],
      },
      now,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.published_at).toBe("2026-10-28T00:00:00.000Z");
    expect(out[0]!.publisher).toBe(DISTRIBUTE_PUBLISHER);
    expect(out[0]!.source_ids.hn_discussion_url).toBeUndefined();
  });
});

describe("distribute-software adapter — health + determinism", () => {
  it("health() reports ok on the replayed endpoints with the project UA", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const base = replayFetcher(fixture, FIXTURE_PATH);
    let sentUa: string | undefined;
    const spy: Fetcher = (url, init) => {
      sentUa = (init?.headers as Record<string, string> | undefined)?.["user-agent"];
      return base(url, init);
    };
    for (const adapter of [releasesAdapter(), storiesAdapter()]) {
      const health = await adapter.health({ fetch: spy, now: () => FIXTURE_NOW });
      expect(health.ok).toBe(true);
      expect(health.detail).toContain("HTTP 200");
      expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
    }
    expect(sentUa).toBe(USER_AGENT);
  });

  it("health() reports failure without throwing", async () => {
    const empty = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    for (const adapter of [releasesAdapter(), storiesAdapter()]) {
      const health = await adapter.health({ fetch: replayFetcher(empty) });
      expect(health.ok).toBe(false);
    }
  });

  it("fetch() degrades to [] when the endpoint errors, never throws", async () => {
    const down = { responses: [{ url_contains: "/api/v1/releases", status: 503, body: {} }] };
    const items = await releasesAdapter().fetch(WINDOW, {
      fetch: replayFetcher(down),
      now: () => FIXTURE_NOW,
    });
    expect(items).toEqual([]);
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(releasesAdapter(), FIXTURE_PATH, { window: WINDOW });
    const b = await runAdapterFixture(releasesAdapter(), FIXTURE_PATH, { window: WINDOW });
    expect(a).toEqual(b);
  });
});
