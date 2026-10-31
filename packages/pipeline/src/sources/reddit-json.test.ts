import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type Fetcher, EXCERPT_MAX_CHARS, isRawItem, USER_AGENT } from "../adapter.js";
import { loadSourcesConfig } from "../config.js";
import {
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
} from "../testing/harness.js";
import {
  createRedditAdapter,
  REDDIT_ADAPTER_ID,
  redditAdapterFromEntry,
  subredditFromEndpoint,
} from "./reddit-json.js";

const fixture = (name: string) =>
  fileURLToPath(new URL(`./__fixtures__/reddit-json-${name}.json`, import.meta.url));
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const SOURCES_YAML = repo("config/sources.yaml");

const sources = loadSourcesConfig(SOURCES_YAML);
const adapterFor = (id: string) => redditAdapterFromEntry(sources.find((e) => e.id === id)!)!;

/**
 * Fixture provenance: the `top.json` endpoints 403 datacenter IPs (verified
 * 2026-10-28, same posture the sources.yaml licence notes record), so the
 * recorded bodies below are assembled from the sibling `top.rss` listings
 * fetched that day — r/MachineLearning + r/LocalLLaMA titles/ids/timestamps
 * are verbatim-real; engagement counts are representative; r/artificial is
 * hand-built in the same shape (its .rss kept rate-limiting).
 */
const WINDOW = { from: new Date("2026-10-20T00:00:00Z"), to: new Date("2026-10-29T00:00:00Z" ) };
const run = (id: string) => runAdapterFixture(adapterFor(id), fixture(id.replace("reddit-", "")), {
  window: WINDOW,
});

// ---------------------------------------------------------------------------
// Per-subreddit fixture replay through the real sources.yaml wiring
// ---------------------------------------------------------------------------

describe("reddit-json adapters through runAdapterFixture", () => {
  it("reddit-localllama: engagement captured, permalink → canonical URL", async () => {
    const { items, mapped } = await run("reddit-localllama");
    expect(adapterFor("reddit-localllama").id).toBe(REDDIT_ADAPTER_ID);

    // 5 t3 children, 1 out-of-window (2026-10-12) → 4 items.
    expect(items).toHaveLength(4);
    expect(mapped).toHaveLength(5); // map is pure — the window filter lives in fetch

    const top = items[0]!;
    expect(top.headline).toBe(
      "OpenAI and Anthropic blocked the reverse engineering of smart TVs spying on us",
    );
    expect(top.canonical_url).toBe(
      "https://www.reddit.com/r/LocalLLaMA/comments/1xer30z/openai_and_anthropic_blocked_the_reverse/",
    );
    expect(top.publisher).toBe("r/LocalLLaMA");
    expect(top.published_at).toBe("2026-10-25T02:51:18.000Z");
    expect(top.fetched_at).toBe(FIXTURE_NOW.toISOString());
    expect(top.reddit_score).toBe(2874);
    expect(top.reddit_comments).toBe(412);
    expect(top.source_ids).toEqual({
      reddit_feed: "reddit-localllama",
      reddit_id: "t3_1xer30z",
      reddit_subreddit: "LocalLLaMA",
      reddit_url: "https://x.com/AbhinavXJ/status/2113590263373508704",
      reddit_flair: "News",
    });
    // link post with empty selftext → excerpt falls back to the title
    expect(top.excerpt).toBe(top.headline);

    const selfPost = items[2]!;
    expect(selfPost.source_ids.reddit_url).toBeUndefined(); // self posts carry no outbound link
    expect(selfPost.excerpt).toContain("mighty local King");
    expect(selfPost.reddit_comments).toBe(198);

    // [removed] selftext → the excerpt is the title, never the tombstone
    const megathread = items[3]!;
    expect(megathread.excerpt).toBe(
      "Monthly 'What are you running locally?' megathread",
    );
    expect(megathread.excerpt).not.toContain("[removed]");

    for (const i of [...items, ...mapped]) expect(isRawItem(i)).toBe(true);
  });

  it("reddit-machinelearning: all five in-window posts map, edge cases handled", async () => {
    const { items } = await run("reddit-machinelearning");
    expect(items).toHaveLength(6); // 7 children − 1 t1 comment row

    const arxivPost = items.find((i) => i.source_ids.reddit_id === "t3_1xd7bsu")!;
    expect(arxivPost.publisher).toBe("r/MachineLearning");
    expect(arxivPost.source_ids.reddit_url).toBe("https://arxiv.org/abs/2610.14162");
    expect(arxivPost.reddit_score).toBe(978);
    expect(arxivPost.reddit_comments).toBe(154);

    // negative score → reddit_score omitted (contract: non-negative only)
    const downvoted = items.find((i) => i.source_ids.reddit_id === "t3_1xzzzzn")!;
    expect(downvoted.reddit_score).toBeUndefined();
    expect(downvoted.reddit_comments).toBe(12);

    // no t1 comment leaked in
    expect(items.some((i) => i.source_ids.reddit_id === "lll111")).toBe(false);
    for (const i of items) {
      expect(i.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
      expect(i.source_ids.reddit_feed).toBe("reddit-machinelearning");
    }
  });

  it("reddit-artificial: third subreddit registered + replayed", async () => {
    const { items } = await run("reddit-artificial");
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.publisher === "r/artificial")).toBe(true);
    // the cross-posted story keeps its own permalink + post id per subreddit
    const cross = items.find((i) => i.source_ids.reddit_id === "t3_1xgq2dt")!;
    expect(cross.canonical_url).toContain("/r/artificial/comments/1xgq2dt/");
    expect(cross.source_ids.reddit_url).toBe(
      "https://x.com/AbhinavXJ/status/2113590263373508704",
    );
  });
});

// ---------------------------------------------------------------------------
// Config wiring — the three subreddits are sources.yaml entries, not code
// ---------------------------------------------------------------------------

describe("reddit-json config wiring", () => {
  it("builds instances for exactly the three reddit entries, honouring params", () => {
    const built = sources.map((e) => redditAdapterFromEntry(e)).filter((a) => a !== null);
    expect(built).toHaveLength(3);

    const ids = sources.filter((e) => e.adapter === REDDIT_ADAPTER_ID).map((e) => e.id);
    expect(ids).toEqual(["reddit-machinelearning", "reddit-localllama", "reddit-artificial"]);
  });

  it("sends meta.params (t=week) + limit in the request URL", async () => {
    const fixtureDoc = loadAdapterFixture(fixture("localllama"));
    let requested = "";
    const spy: Fetcher = async (url, init) => {
      requested = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      return replayFetcher(fixtureDoc)(url, init);
    };
    await adapterFor("reddit-localllama").fetch(WINDOW, {
      fetch: spy,
      now: () => FIXTURE_NOW,
    });
    expect(requested).toContain("/r/LocalLLaMA/top.json");
    expect(requested).toContain("t=week");
    expect(requested).toContain("limit=25");
  });

  it("meta.limit overrides the default listing size; params.limit wins over both", async () => {
    const fixtureDoc = loadAdapterFixture(fixture("localllama"));
    const urls: string[] = [];
    const spy: Fetcher = async (url, init) => {
      urls.push(typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url);
      return replayFetcher(fixtureDoc)(url, init);
    };
    const ctx = { fetch: spy, now: () => FIXTURE_NOW };

    const entry = sources.find((e) => e.id === "reddit-localllama")!;
    const limited = redditAdapterFromEntry({ ...entry, meta: { ...entry.meta, limit: 5 } })!;
    await limited.fetch(WINDOW, ctx);
    expect(urls[0]).toContain("limit=5");

    const paramsWin = redditAdapterFromEntry({
      ...entry,
      meta: { ...entry.meta, limit: 5, params: { t: "week", limit: 3 } },
    })!;
    await paramsWin.fetch(WINDOW, ctx);
    expect(urls[1]).toContain("limit=3");
  });

  it("sends the declared project UA", async () => {
    const fixtureDoc = loadAdapterFixture(fixture("localllama"));
    let ua = "";
    const spy: Fetcher = (url, init) => {
      ua = (init?.headers as Record<string, string> | undefined)?.["user-agent"] ?? "";
      return replayFetcher(fixtureDoc)(url, init);
    };
    await adapterFor("reddit-localllama").fetch(WINDOW, {
      fetch: spy,
      now: () => FIXTURE_NOW,
    });
    expect(ua).toBe(USER_AGENT);
  });

  it("meta.publisher overrides the r/<sub> default", async () => {
    const adapter = createRedditAdapter({
      id: "reddit-test",
      endpoint: "https://www.reddit.com/r/LocalLLaMA/top.json",
      publisher: "LocalLLaMA Community",
    });
    const fixtureDoc = loadAdapterFixture(fixture("localllama"));
    const items = await adapter.fetch(WINDOW, {
      fetch: replayFetcher(fixtureDoc),
      now: () => FIXTURE_NOW,
    });
    expect(items.every((i) => i.publisher === "LocalLLaMA Community")).toBe(true);
  });

  it("meta.ai_terms is present and deliberately empty on the configured subs (#57)", () => {
    // The three subs are AI-topical — the subreddit scope IS the relevance
    // filter, so the key exists on every entry but stays empty by design.
    // The adapter still honours a populated list for future/non-topical subs.
    for (const e of sources.filter((x) => x.adapter === REDDIT_ADAPTER_ID)) {
      expect(e.meta?.ai_terms).toEqual([]);
    }
  });

  it("meta.ai_terms filters map() on raw title + selftext when populated", () => {
    const fixtureDoc = loadAdapterFixture(fixture("localllama"));
    const body = fixtureDoc.responses[0]!.body;

    const openaiOnly = createRedditAdapter({
      id: "reddit-test",
      endpoint: "https://www.reddit.com/r/LocalLLaMA/top.json",
      aiTerms: ["OpenAI"],
    }).map(body, FIXTURE_NOW);
    expect(openaiOnly).toHaveLength(1);
    expect(openaiOnly[0]!.headline).toContain("OpenAI");

    // A term that only appears inside selftext still matches — the filter
    // runs on the raw post text, not the ≤300-char excerpt.
    const strataOnly = createRedditAdapter({
      id: "reddit-test",
      endpoint: "https://www.reddit.com/r/LocalLLaMA/top.json",
      aiTerms: ["Strata"],
    }).map(body, FIXTURE_NOW);
    expect(strataOnly).toHaveLength(1);
    expect(strataOnly[0]!.headline).toContain("local");

    // The wired path: meta.ai_terms on the entry flows into the adapter.
    const entry = sources.find((e) => e.id === "reddit-localllama")!;
    const wired = redditAdapterFromEntry({
      ...entry,
      meta: { ...entry.meta, ai_terms: ["OpenAI"] },
    })!;
    expect(wired.map(body, FIXTURE_NOW)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Graceful failure + determinism
// ---------------------------------------------------------------------------

describe("reddit-json — failure modes + determinism", () => {
  it("a 403-gated endpoint yields zero items, never a throw", async () => {
    const gated = {
      responses: [
        { url_contains: "/r/LocalLLaMA/", status: 403, body: "<html>blocked</html>" },
      ],
    };
    const items = await adapterFor("reddit-localllama").fetch(WINDOW, {
      fetch: replayFetcher(gated),
      now: () => FIXTURE_NOW,
    });
    expect(items).toEqual([]);
  });

  it("an unparseable body yields zero items", async () => {
    const broken = { responses: [{ body: { kind: "Listing", data: {} } }] };
    const items = await adapterFor("reddit-localllama").fetch(WINDOW, {
      fetch: replayFetcher(broken),
      now: () => FIXTURE_NOW,
    });
    expect(items).toEqual([]);
  });

  it("health() reports ok / failure without throwing", async () => {
    const okFixture = replayFetcher(loadAdapterFixture(fixture("localllama")));
    const okHealth = await adapterFor("reddit-localllama").health({
      fetch: okFixture,
      now: () => FIXTURE_NOW,
    });
    expect(okHealth.ok).toBe(true);
    expect(okHealth.detail).toContain("HTTP 200");
    expect(okHealth.checked_at).toBe(FIXTURE_NOW.toISOString());

    const downFixture = replayFetcher({
      responses: [{ url_contains: "/r/", status: 403, body: {} }],
    });
    const downHealth = await adapterFor("reddit-artificial").health({
      fetch: downFixture,
      now: () => FIXTURE_NOW,
    });
    expect(downHealth.ok).toBe(false);
    expect(downHealth.detail).toContain("HTTP 403");

    const boom = await adapterFor("reddit-artificial").health({
      fetch: async () => {
        throw new Error("ECONNREFUSED");
      },
      now: () => FIXTURE_NOW,
    });
    expect(boom.ok).toBe(false);
    expect(boom.detail).toContain("ECONNREFUSED");
  });

  it("is deterministic across runs", async () => {
    const a = await run("reddit-localllama");
    const b = await run("reddit-localllama");
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

describe("subredditFromEndpoint", () => {
  it("pulls the /r/<sub>/ segment from a listing URL", () => {
    expect(subredditFromEndpoint("https://www.reddit.com/r/LocalLLaMA/top.json")).toBe(
      "LocalLLaMA",
    );
    expect(subredditFromEndpoint("https://www.reddit.com/r/artificial/hot.json?x=1")).toBe(
      "artificial",
    );
    expect(subredditFromEndpoint("https://www.reddit.com/top.json")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// `.rss` fallback — plan-defect #67: `.json` 403s datacenter IPs; the Atom
// sibling stays reachable (rate-limited ~1/min per IP) and keeps the window
// param, so fetch degrades to it rather than to zero items.
// ---------------------------------------------------------------------------

describe("reddit-json — .rss fallback (#67)", () => {
  // Entries sit at 2026-10-28/29 — one day past the JSON fixtures' `to`.
  const ATOM_WINDOW = { from: new Date("2026-10-20T00:00:00Z"), to: new Date("2026-10-30T00:00:00Z") };
  const atomFixture = () =>
    fileURLToPath(
      new URL(`./__fixtures__/reddit-atom-machinelearning.json`, import.meta.url),
    );

  it("json 403 → Atom sibling: items map; engagement fields absent, contract intact", async () => {
    const { items, mapped } = await runAdapterFixture(
      adapterFor("reddit-machinelearning"),
      atomFixture(),
      { window: ATOM_WINDOW },
    );
    expect(items).toHaveLength(2); // 3 entries − 1 out-of-window (map stays pure)
    expect(mapped).toHaveLength(3); // the 403's `{}` maps to zero; the XML maps to 3

    const selfPost = items.find((i) => i.source_ids.reddit_id === "t3_1xil53d")!;
    expect(selfPost.headline).toContain("Old-school classifiers");
    expect(selfPost.canonical_url).toBe(
      "https://www.reddit.com/r/MachineLearning/comments/1xil53d/oldschool_classifiers_are_still_generally_better/",
    );
    expect(selfPost.publisher).toBe("r/MachineLearning");
    expect(selfPost.published_at).toBe("2026-10-29T14:13:05.000Z");
    expect(selfPost.fetched_at).toBe(FIXTURE_NOW.toISOString());
    // the Atom feed carries no score/num_comments — fields stay absent
    expect(selfPost.reddit_score).toBeUndefined();
    expect(selfPost.reddit_comments).toBeUndefined();
    // self post → its [link] anchor is the permalink, not an outbound URL
    expect(selfPost.source_ids.reddit_url).toBeUndefined();
    // content html → selftext, minus the "submitted by /u/… [link]" chrome;
    // double-escaped entities decode through both passes
    expect(selfPost.excerpt).toContain("old-school approach");
    expect(selfPost.excerpt).toContain("It's cheaper");
    expect(selfPost.excerpt).not.toContain("submitted by");
    expect(selfPost.excerpt).not.toContain("<");

    // link post → outbound URL captured for cross-source dedupe
    const linkPost = items.find((i) => i.source_ids.reddit_id === "t3_1xmndelb")!;
    expect(linkPost.source_ids.reddit_url).toBe("https://www.youtube.com/watch?v=coMcHZ2fFfU");

    for (const i of [...items, ...mapped]) expect(isRawItem(i)).toBe(true);
  });

  it("429 on .rss waits x-ratelimit-reset once, then retries and succeeds", async () => {
    const atom = loadAdapterFixture(atomFixture());
    const rssBody = atom.responses[1]!.body as string;
    const calls: string[] = [];
    let rssHits = 0;
    const fetcher: Fetcher = async (url) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      calls.push(u);
      if (u.includes("top.json")) return new Response("{}", { status: 403 });
      rssHits += 1;
      if (rssHits === 1) {
        return new Response("", {
          status: 429,
          headers: { "x-ratelimit-reset": "5" },
        });
      }
      return new Response(rssBody, {
        status: 200,
        headers: { "content-type": "application/atom+xml" },
      });
    };
    const adapter = createRedditAdapter({
      id: "reddit-test",
      endpoint: "https://www.reddit.com/r/MachineLearning/top.json",
      params: { t: "week" },
      sleep: async () => {},
    });
    const items = await adapter.fetch(ATOM_WINDOW, {
      fetch: fetcher,
      now: () => FIXTURE_NOW,
    });
    expect(items).toHaveLength(2);
    expect(calls.filter((u) => u.includes("top.json"))).toHaveLength(1);
    expect(calls.filter((u) => u.includes("top.rss"))).toHaveLength(2);
  });

  it("a reset hint beyond the wait cap degrades to zero items without waiting", async () => {
    let rssHits = 0;
    const fetcher: Fetcher = async (url) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u.includes("top.json")) return new Response("{}", { status: 403 });
      rssHits += 1;
      return new Response("", { status: 429, headers: { "x-ratelimit-reset": "600" } });
    };
    const adapter = createRedditAdapter({
      id: "reddit-test",
      endpoint: "https://www.reddit.com/r/MachineLearning/top.json",
      sleep: async () => {},
    });
    const items = await adapter.fetch(WINDOW, {
      fetch: fetcher,
      now: () => FIXTURE_NOW,
    });
    expect(items).toEqual([]);
    expect(rssHits).toBe(1); // gave up instead of parking the run
  });

  it("a dead .rss sibling (403 on both) still yields zero items", async () => {
    const dead = {
      responses: [{ url_contains: "/r/MachineLearning/", status: 403, body: "" }],
    };
    const items = await adapterFor("reddit-machinelearning").fetch(WINDOW, {
      fetch: replayFetcher(dead),
      now: () => FIXTURE_NOW,
    });
    expect(items).toEqual([]);
  });

  it("health() reports ok via the .rss sibling when .json is blocked", async () => {
    const f = replayFetcher(loadAdapterFixture(atomFixture()));
    const h = await adapterFor("reddit-machinelearning").health({
      fetch: f,
      now: () => FIXTURE_NOW,
    });
    expect(h.ok).toBe(true);
    expect(h.detail).toContain("json HTTP 403");
    expect(h.detail).toContain("rss HTTP 200");
  });

  it("health() reports both statuses when every path is blocked", async () => {
    const dead = {
      responses: [{ url_contains: "/r/MachineLearning/", status: 403, body: "" }],
    };
    const h = await adapterFor("reddit-machinelearning").health({
      fetch: replayFetcher(dead),
      now: () => FIXTURE_NOW,
    });
    expect(h.ok).toBe(false);
    expect(h.detail).toContain("json HTTP 403");
    expect(h.detail).toContain("rss HTTP 403");
  });
});
