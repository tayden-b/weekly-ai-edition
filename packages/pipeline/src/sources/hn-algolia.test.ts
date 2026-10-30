import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EXCERPT_MAX_CHARS, isRawItem, USER_AGENT } from "../adapter.js";
import { loadSourcesConfig } from "../config.js";
import {
  type AdapterFixture,
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
  UnrecordedRequestError,
} from "../testing/harness.js";
import {
  compileAiTermMatcher,
  createHnAlgoliaAdapter,
  HN_ADAPTER_ID,
  HN_AI_TERMS,
} from "./hn-algolia.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/hn.json", import.meta.url));
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const SOURCES_YAML = repo("config/sources.yaml");

const adapter = () => createHnAlgoliaAdapter({ minRequestIntervalMs: 0 });

describe("hn-algolia adapter through runAdapterFixture", () => {
  it("proves the contract end-to-end: fetch + map, no network", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(adapter().id).toBe(HN_ADAPTER_ID);

    // 4 unique objectIDs after dedupe: 90001, 90003 (front_page),
    // 90010, 90012 (show_hn). 90002/90011 dropped by the AI filter;
    // 90003 appears in both responses but lands once.
    expect(items.map((i) => i.source_ids.hn_object_id)).toEqual([
      "90001",
      "90003",
      "90010",
      "90012",
    ]);
    // map() over both recorded bodies: 2 + 3 AI hits (no dedupe in map).
    expect(mapped).toHaveLength(5);
    for (const item of [...items, ...mapped]) expect(isRawItem(item)).toBe(true);

    const front = items[0]!;
    expect(front.headline).toContain("GPT-6");
    expect(front.publisher).toBe("Hacker News");
    expect(front.canonical_url).toBe("https://openai.com/news/gpt-6");
    expect(front.source_ids).toEqual({ hn_object_id: "90001" });
    expect(front.hn_points).toBe(1321);
    expect(front.hn_comments).toBe(804);
    expect(front.fetched_at).toBe(FIXTURE_NOW.toISOString());

    // link-less hit → HN permalink; no story_text → headline as excerpt.
    const showHn = items.find((i) => i.source_ids.hn_object_id === "90003")!;
    expect(showHn.canonical_url).toBe("https://news.ycombinator.com/item?id=90003");
    expect(showHn.excerpt).toBe(showHn.headline);
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const b = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(a).toEqual(b);
  });

  it("keeps AI hits, drops non-AI hits on both queries", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const headlines = items.map((i) => i.headline);
    expect(headlines.some((h) => h.includes("standing desk"))).toBe(false);
    expect(headlines.some((h) => h.includes("recipe manager"))).toBe(false);
    expect(headlines.some((h) => h.includes("GPT-6"))).toBe(true);
    expect(headlines.some((h) => h.includes("LLM inference"))).toBe(true);
  });

  it("story_text becomes a plain-text ≤300-char excerpt (tags + entities stripped)", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const item = items.find((i) => i.source_ids.hn_object_id === "90010")!;
    expect(item.excerpt).toContain("reviews pull requests");
    expect(item.excerpt).toContain("repo's own conventions"); // &#x27; decoded
    expect(item.excerpt).not.toMatch(/<[^>]+>/);
    expect(item.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
  });

  it("window-bounds show_hn but never the front_page snapshot", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-01-14T00:00:00Z"), to: FIXTURE_NOW },
      expectMinItems: 1,
    });
    const ids = items.map((i) => i.source_ids.hn_object_id);
    // show_hn: 90010 in-window, 90012 + 90003 out by created_at.
    expect(ids).not.toContain("90012");
    expect(ids).toContain("90010");
    // front_page: 90003 (created 01-13) still emitted — the snapshot is "now".
    expect(ids).toContain("90003");
    expect(ids).toContain("90001");
  });
});

describe("the no-network guarantee", () => {
  it("replayFetcher answers only the recorded queries", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const fetcher = replayFetcher(fixture, FIXTURE_PATH);
    const res = await fetcher("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1");
    expect(res.status).toBe(200);
    await expect(fetcher("https://hn.algolia.com/api/v1/items/1")).rejects.toBeInstanceOf(
      UnrecordedRequestError,
    );
  });

  it("health() reports ok against the replayed endpoint", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const health = await adapter().health({
      fetch: replayFetcher(fixture, FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("HTTP 200");
    expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
  });

  it("health() reports failure without throwing", async () => {
    const dead = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    const health = await adapter().health({ fetch: replayFetcher(dead) });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("unrecorded URL");
  });

  it("a dead query degrades to the other query's items, never throws", async () => {
    // Only show_hn recorded — the front_page request is unrecorded → its
    // failure must degrade, not fail the run.
    const partial = {
      responses: [loadAdapterFixture(FIXTURE_PATH).responses[1]!],
    };
    const items = await adapter().fetch(
      { from: new Date(0), to: FIXTURE_NOW },
      { fetch: replayFetcher(partial), now: () => FIXTURE_NOW },
    );
    expect(items.map((i) => i.source_ids.hn_object_id)).toEqual(["90010", "90003", "90012"]);
  });
});

describe("pagination + throttle", () => {
  it("pages show_hn until nbPages, reusing objectID dedupe", async () => {
    const paged: AdapterFixture = {
      responses: [
        { url_contains: "tags=front_page", body: { hits: [], nbPages: 1, page: 0 } },
        // page=1 matcher first so it wins over the generic show_hn matcher.
        {
          url_contains: "page=1",
          body: { hits: [], page: 1, nbPages: 2 },
        },
        {
          url_contains: "tags=show_hn",
          body: {
            hits: [
              {
                objectID: "p1",
                title: "Show HN: AI agent that files your expenses",
                created_at: "2026-01-14T10:00:00.000Z",
                url: "https://example.com/x",
                points: 5,
                num_comments: 2,
              },
            ],
            page: 0,
            nbPages: 2,
          },
        },
      ],
    };
    let showHnCalls = 0;
    const counting = async (url: string | URL | Request) => {
      if (String(url).includes("tags=show_hn")) showHnCalls++;
      return replayFetcher(paged)(url);
    };
    const items = await adapter().fetch(
      { from: new Date(0), to: FIXTURE_NOW },
      { fetch: counting, now: () => FIXTURE_NOW },
    );
    expect(showHnCalls).toBe(2); // page 0 said nbPages=2 → one more page
    expect(items).toHaveLength(1);
    expect(items[0]!.source_ids.hn_object_id).toBe("p1");
  });
});

describe("compileAiTermMatcher", () => {
  const match = compileAiTermMatcher(HN_AI_TERMS);

  it.each([
    "OpenAI ships GPT-6",
    "Show HN: I built an AI agent for email",
    "New reasoning model benchmarks",
    "vLLM 0.9 released",
    "Show HN: RAG over your notes",
    "a transformer from scratch",
  ])("matches: %s", (title) => {
    expect(match(title)).toBe(true);
  });

  it.each([
    "Ask HN: Best standing desk?",
    "He said the plan was fair", // \b stops "AI" matching "said"/"fair"
    "Show HN: Self-hosted recipe manager",
    "Portrait mode photography tips",
  ])("rejects: %s", (title) => {
    expect(match(title)).toBe(false);
  });
});

describe("config wiring", () => {
  it("sources.yaml registers the adapter and documents its queries", () => {
    const entries = loadSourcesConfig(SOURCES_YAML);
    const entry = entries.find((e) => e.id === HN_ADAPTER_ID);
    expect(entry).toBeDefined();
    expect(entry!.adapter).toBe(HN_ADAPTER_ID);
    expect(entry!.pages).toEqual(["launches", "discourse"]);
    expect(entry!.enabled).toBe(true);
    expect(entry!.license).toContain("objectID");
    expect(entry!.meta?.tags).toEqual(["front_page", "show_hn"]);
  });

  it("meta.ai_terms is the adapter's term list (single source of truth)", () => {
    const entries = loadSourcesConfig(SOURCES_YAML);
    const meta = entries.find((e) => e.id === HN_ADAPTER_ID)!.meta!;
    expect(meta.ai_terms).toEqual([...HN_AI_TERMS]);
  });

  it("sends the project UA convention", () => {
    expect(USER_AGENT).toMatch(/^weekly-ai-edition\/.*\(\+https:\/\/github\.com\/tayden-b/);
  });
});
