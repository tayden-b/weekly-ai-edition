import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EXCERPT_MAX_CHARS, isRawItem, USER_AGENT } from "../adapter.js";
import { loadSourcesConfig } from "../config.js";
import {
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
} from "../testing/harness.js";
import {
  createPressWireAdapter,
  htmlToPlainText,
  parseWireFeed,
  PRESS_WIRE_ADAPTER_ID,
  pressWireAdapterFromEntry,
} from "./press-wire-rss.js";

const fixture = (name: string) =>
  fileURLToPath(new URL(`./__fixtures__/press-wires-${name}.json`, import.meta.url));
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const SOURCES_YAML = repo("config/sources.yaml");

const sources = loadSourcesConfig(SOURCES_YAML);
const adapterFor = (id: string) =>
  pressWireAdapterFromEntry(sources.find((e) => e.id === id)!)!;

/** Every in-window fixture item is dated 2026-10-22…28; this window covers them. */
const WINDOW = { from: new Date("2026-10-20T00:00:00Z"), to: new Date("2026-10-29T00:00:00Z") };
const run = (id: string, name: string) =>
  runAdapterFixture(adapterFor(id), fixture(name), { window: WINDOW });

// ---------------------------------------------------------------------------
// Per-feed fixture replay through the real sources.yaml wiring
// ---------------------------------------------------------------------------

describe("press-wire-rss adapters through runAdapterFixture", () => {
  it("pr-newswire: only the AI+funding release survives the config filter", async () => {
    const { items, mapped } = await run("pr-newswire", "pr-newswire");
    expect(adapterFor("pr-newswire").id).toBe(PRESS_WIRE_ADAPTER_ID);
    expect(items.map((i) => i.headline)).toEqual([
      "SynthAI Labs Raises $220M Series C to Scale Enterprise AI Agents",
    ]);
    expect(mapped).toHaveLength(1);
    const item = items[0]!;
    expect(item.publisher).toBe("PR Newswire");
    expect(item.canonical_url).toContain("prnewswire.com/news-releases/");
    expect(item.source_ids).toEqual({
      feed: "pr-newswire",
      guid: expect.stringContaining("prnewswire.com"),
    });
    expect(item.published_at).toBe("2026-10-28T16:30:00.000Z");
    expect(item.fetched_at).toBe(FIXTURE_NOW.toISOString());
    expect(item.excerpt).toContain("artificial intelligence");
    expect(item.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    for (const i of [...items, ...mapped]) expect(isRawItem(i)).toBe(true);
  });

  it("business-wire: keeps the robotics raise + ML acquisition, drops the rest", async () => {
    const { items } = await run("business-wire", "business-wire");
    const heads = items.map((i) => i.headline);
    expect(heads).toContain(
      "Foundry Robotics Raises $100 Million Series A to Build America’s First Autonomous Factory for Assembly",
    );
    expect(heads).toContain(
      "Hummingbird Acquires Quantimon to Bring Machine Learning to AML Transaction Monitoring for the Agentic Era",
    );
    expect(heads).toHaveLength(2);
    for (const i of items) expect(i.publisher).toBe("Business Wire");
  });

  it("globenewswire: acquisition kept, earnings release dropped", async () => {
    const { items } = await run("globenewswire", "globenewswire");
    expect(items.map((i) => i.headline)).toEqual([
      "NeuralForge AI to Be Acquired by Calderon Systems in $480M All-Stock Transaction",
    ]);
  });

  it("techcrunch-funding: AI filter drops non-AI raises; window drops old hits", async () => {
    const { items, mapped } = await run("techcrunch-funding", "techcrunch-funding");
    // map() is unwindowed: DeepSeek (Oct) + Instinct (Aug) both survive the filter.
    expect(mapped.map((i) => i.headline)).toEqual([
      "DeepSeek reportedly raises $15B days after US restrictions",
      "Viral AI startup Instinct has raised $350M at a $2.5B valuation",
    ]);
    // fetch() applies the window: Instinct (2026-08-27) falls out.
    expect(items.map((i) => i.headline)).toEqual([
      "DeepSeek reportedly raises $15B days after US restrictions",
    ]);
    // Wispr raise + WeRoad raise dropped by the ai group, not the funding feed.
    const all = [...items, ...mapped].map((i) => i.headline);
    expect(all.some((h) => h.includes("Wispr"))).toBe(false);
    expect(all.some((h) => h.includes("WeRoad"))).toBe(false);
  });

  it("axios (link mode): excerpt repeats the headline — no summary stored", async () => {
    const { items } = await run("axios-pro-rata", "axios-pro-rata");
    expect(items.map((i) => i.headline)).toEqual([
      "Anthropic IPO leads AI's $235 billion dealmaking blitz",
    ]);
    expect(items[0]!.excerpt).toBe(items[0]!.headline);
    expect(items[0]!.publisher).toBe("Axios");
  });

  it("crunchbase-news: funding news kept; excerpt is the description, never content:encoded", async () => {
    const { items } = await run("crunchbase-news", "crunchbase-news");
    expect(items.map((i) => i.headline)).toEqual([
      "Some Observations About Anthropic’s IPO Filing",
      "Crunchbase Data Shows Q3 Robotics Startup Funding Jumps 185% As US And China Lead Physical AI Push",
    ]);
    for (const i of items) {
      expect(i.excerpt).not.toMatch(/<[^>]+>/);
      expect(i.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    }
    // "unusually" appears only in the item's content:encoded body — its absence
    // proves the excerpt came from the description, never the body.
    expect(items[0]!.excerpt).not.toContain("unusually");
  });

  it("ft-headlines (link mode, secondary): Anthropic IPO kept, world news dropped", async () => {
    const { items } = await run("ft-headlines", "ft-headlines");
    expect(items.map((i) => i.headline)).toEqual([
      "Anthropic’s seven founders tighten grip ahead of blockbuster IPO",
    ]);
    expect(items[0]!.excerpt).toBe(items[0]!.headline);
  });

  it("guardian-ai: topic feed has no filter_groups — every item survives", async () => {
    const { items } = await run("guardian-ai", "guardian-ai");
    expect(items).toHaveLength(3);
    for (const i of items) expect(i.publisher).toBe("The Guardian");
  });

  it("nyt-tech (secondary): Anthropic IPO items kept, general tech dropped", async () => {
    const { items } = await run("nyt-tech", "nyt-tech");
    const heads = items.map((i) => i.headline);
    expect(heads).toContain("Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO");
    expect(heads).toContain("The Key Numbers From Anthropic’s IPO Filing");
    expect(heads).toHaveLength(2);
    // no excerpt truncation issues on NYT standfirsts
    for (const i of items) expect(i.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
  });

  it("is deterministic across runs", async () => {
    const a = await run("business-wire", "business-wire");
    const b = await run("business-wire", "business-wire");
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Graceful per-feed failure — degrades, never throws
// ---------------------------------------------------------------------------

describe("graceful per-feed failure", () => {
  const gnw = () => adapterFor("globenewswire");

  it("a real recorded 403 → fetch() returns [], health() reports not-ok", async () => {
    const f403 = loadAdapterFixture(fixture("globenewswire-403"));
    const fetcher = replayFetcher(f403, fixture("globenewswire-403"));
    const items = await gnw().fetch(WINDOW, { fetch: fetcher, now: () => FIXTURE_NOW });
    expect(items).toEqual([]);
    const health = await gnw().health({ fetch: fetcher, now: () => FIXTURE_NOW });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("403");
    expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
  });

  it("an unreachable feed → fetch() returns [], health() reports the error", async () => {
    const dead = { responses: [{ url: "https://other.invalid/x", body: "" }] };
    const fetcher = replayFetcher(dead);
    const items = await gnw().fetch(WINDOW, { fetch: fetcher, now: () => FIXTURE_NOW });
    expect(items).toEqual([]);
    const health = await gnw().health({ fetch: fetcher });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("unrecorded URL");
  });

  it("health() reports ok against the replayed 200 feed", async () => {
    const fixtureDoc = loadAdapterFixture(fixture("globenewswire"));
    const health = await gnw().health({
      fetch: replayFetcher(fixtureDoc),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("HTTP 200");
  });
});

// ---------------------------------------------------------------------------
// Config wiring — filters live in sources.yaml, not in the adapter
// ---------------------------------------------------------------------------

describe("config wiring", () => {
  const pressWireEntries = sources.filter((e) => e.adapter === PRESS_WIRE_ADAPTER_ID);

  it("covers the §5.1 wire + funding-feed set: 9 entries, all wired", () => {
    expect(pressWireEntries.map((e) => e.id)).toEqual([
      "pr-newswire",
      "business-wire",
      "globenewswire",
      "techcrunch-funding",
      "axios-pro-rata",
      "crunchbase-news",
      "ft-headlines",
      "guardian-ai",
      "nyt-tech",
    ]);
    for (const e of pressWireEntries) {
      expect(pressWireAdapterFromEntry(e), e.id).not.toBeNull();
    }
  });

  it("every entry declares meta.publisher for RawItem.publisher", () => {
    for (const e of pressWireEntries) {
      expect(typeof e.meta?.publisher, e.id).toBe("string");
    }
  });

  it("the firehose wires + general feeds carry the ai ∧ funding_ma groups", () => {
    for (const id of [
      "pr-newswire",
      "business-wire",
      "globenewswire",
      "axios-pro-rata",
      "ft-headlines",
      "nyt-tech",
    ]) {
      const groups = pressWireEntries.find((e) => e.id === id)!.meta!.filter_groups as Record<
        string,
        string[]
      >;
      expect(Object.keys(groups).sort(), id).toEqual(["ai", "funding_ma"]);
      for (const terms of Object.values(groups)) expect(terms.length).toBeGreaterThan(5);
    }
  });

  it("publisher-scoped feeds carry only the complementary group or none", () => {
    for (const id of ["techcrunch-funding", "crunchbase-news"]) {
      const groups = pressWireEntries.find((e) => e.id === id)!.meta!.filter_groups as Record<
        string,
        string[]
      >;
      expect(Object.keys(groups), id).toEqual(["ai"]);
    }
    expect(pressWireEntries.find((e) => e.id === "guardian-ai")!.meta!.filter_groups).toBeUndefined();
  });

  it("config terms demonstrably drive the filter: swap ai terms → different result", async () => {
    const entry = pressWireEntries.find((e) => e.id === "business-wire")!;
    // An empty ai group keeps every item — the filter is config, not code.
    const noFilter = createPressWireAdapter({
      id: entry.id,
      publisher: "Business Wire",
      endpoint: entry.endpoint,
    });
    const { items } = await runAdapterFixture(noFilter, fixture("business-wire"), {
      window: WINDOW,
    });
    expect(items.length).toBeGreaterThanOrEqual(4); // drops included now
    const filtered = await runAdapterFixture(adapterFor("business-wire"), fixture("business-wire"), {
      window: WINDOW,
    });
    expect(items.length).toBeGreaterThan(filtered.items.length);
  });

  it("non-press-wire and disabled entries do not build adapters", () => {
    expect(pressWireAdapterFromEntry(sources.find((e) => e.id === "hn-algolia")!)).toBeNull();
    const disabled = { ...pressWireEntries[0]!, enabled: false };
    expect(pressWireAdapterFromEntry(disabled)).toBeNull();
  });

  it("sends the project UA convention", () => {
    expect(USER_AGENT).toMatch(/^weekly-ai-edition\/.*\(\+https:\/\/github\.com\/tayden-b/);
  });
});

// ---------------------------------------------------------------------------
// Unit-level checks on the exported helpers
// ---------------------------------------------------------------------------

describe("parseWireFeed + htmlToPlainText", () => {
  it("parses RSS items and Atom entries", () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><title>Co Raises $9M Seed</title>
        <link rel="alternate" href="https://example.com/raise"/>
        <id>tag:example.com,2026:raise</id>
        <published>2026-10-28T10:00:00Z</published>
        <summary>An AI startup raised seed funding.</summary></entry>
    </feed>`;
    const records = parseWireFeed(atom);
    expect(records).toHaveLength(1);
    expect(records[0]!.link).toBe("https://example.com/raise");
    expect(records[0]!.published).toBe("2026-10-28T10:00:00Z");
  });

  it("returns [] on non-XML and on feeds without items", () => {
    expect(parseWireFeed("not xml at all <<<")).toEqual([]);
    expect(parseWireFeed("<html><body>Access Denied</body></html>")).toEqual([]);
  });

  it("decodes entities then strips tags", () => {
    expect(htmlToPlainText("&lt;p&gt;Hello &amp;amp; goodbye&lt;/p&gt;")).toBe(
      "Hello &amp; goodbye",
    );
    expect(htmlToPlainText("<p>A <a href='https://x'>link</a>.</p>")).toBe("A link .");
  });
});
