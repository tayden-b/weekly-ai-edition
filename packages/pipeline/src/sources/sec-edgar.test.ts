import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type Fetcher, isRawItem } from "../adapter.js";
import {
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
} from "../testing/harness.js";
import {
  createSecEdgarAdapter,
  DEFAULT_EDGAR_AI_TERMS,
  edgarIndexUrl,
  EDGAR_USER_AGENT,
  SEC_EDGAR_ADAPTER_ID,
} from "./sec-edgar.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/sec-edgar.json", import.meta.url));
const FTS_ENDPOINT = "https://efts.sec.gov/LATEST/search-index";
const FEED_ENDPOINT =
  "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D&dateb=&owner=include&count=40&output=atom";

/** Window covering the recorded filings (Oct 2026); fixture clock stays fixed. */
const WINDOW = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-31T23:59:59Z") };

const ftsAdapter = (o: Parameters<typeof createSecEdgarAdapter>[0] = { endpoint: FTS_ENDPOINT }) =>
  createSecEdgarAdapter({ ...o, kind: "json-api", items8k: ["1.01", "2.01"] });

const feedAdapter = () =>
  createSecEdgarAdapter({
    endpoint: FEED_ENDPOINT,
    kind: "atom",
    forms: ["D"],
    aiTerms: DEFAULT_EDGAR_AI_TERMS,
  });

describe("sec-edgar adapter — full-text search path", () => {
  it("replays EDGAR FTS through the harness: accessions + index URLs, no network", async () => {
    const { items, mapped } = await runAdapterFixture(ftsAdapter(), FIXTURE_PATH, {
      window: WINDOW,
    });
    expect(ftsAdapter({ endpoint: FTS_ENDPOINT }).id).toBe(SEC_EDGAR_ADAPTER_ID);

    // fetch path: 6 hits → dedupe to 5 accessions → items8k keeps only the
    // DataMeds 8-K (reports Item 1.01) plus the Form D and S-1 filings.
    expect(items).toHaveLength(3);
    const accessions = items.map((i) => i.source_ids.edgar_accession);
    expect(accessions).toEqual([
      "0002155617-26-000002", // Form D — Patriot Oil Mills Corp
      "0001493152-26-048573", // 8-K — DataMeds AI (Item 1.01)
      "0001171520-26-000307", // S-1 — Tattvance Corp
    ]);
    for (const item of items) expect(isRawItem(item)).toBe(true);

    // accession → canonical URL mapping
    const datameds = items[1]!;
    expect(datameds.canonical_url).toBe(
      "https://www.sec.gov/Archives/edgar/data/2030763/000149315226048573/0001493152-26-048573-index.htm",
    );
    expect(datameds.headline).toBe("8-K — DataMeds AI, Inc. (MEDS)");
    expect(datameds.publisher).toBe("SEC EDGAR");
    expect(datameds.published_at).toBe("2026-10-26T00:00:00.000Z");
    expect(datameds.source_ids.edgar_items).toBe("1.01,7.01,9.01");
    expect(datameds.fetched_at).toBe(FIXTURE_NOW.toISOString());

    // map path is unfiltered: 5 unique accessions over the 6 recorded hits,
    // including the ones fetch() drops (HASBRO 2.02-only 8-K, AITX 7.01 8-K).
    const ftsMapped = mapped.filter((i) => i.source_ids.edgar_accession !== undefined);
    expect(ftsMapped).toHaveLength(9); // 5 FTS accessions + 4 Atom entries
    const aitx = ftsMapped.filter((i) => i.source_ids.edgar_accession === "0001493152-26-048336");
    expect(aitx).toHaveLength(1); // two file hits deduped to one filing
    expect(ftsMapped.map((i) => i.source_ids.edgar_accession)).toContain("0000046080-26-000058");
  });

  it("drops 8-Ks that report no items8k item", async () => {
    const { items } = await runAdapterFixture(ftsAdapter(), FIXTURE_PATH, { window: WINDOW });
    const accessions = items.map((i) => i.source_ids.edgar_accession);
    expect(accessions).not.toContain("0000046080-26-000058"); // HASBRO: items 2.02,9.01
    expect(accessions).not.toContain("0001493152-26-048336"); // AITX: items 7.01,9.01
  });

  it("keeps every form when items8k is empty", async () => {
    const adapter = createSecEdgarAdapter({ endpoint: FTS_ENDPOINT, kind: "json-api" });
    const { items } = await runAdapterFixture(adapter, FIXTURE_PATH, { window: WINDOW });
    expect(items).toHaveLength(5); // 5 unique accessions, no item filtering
  });

  it("filters filings outside the fetch window", async () => {
    const { items } = await runAdapterFixture(ftsAdapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-10-24T00:00:00Z"), to: new Date("2026-10-28T00:00:00Z") },
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.source_ids.edgar_accession).toBe("0001493152-26-048573");
  });

  it("sends the EDGAR-declared UA, not the generic project UA", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const base = replayFetcher(fixture, FIXTURE_PATH);
    let sentUa: string | undefined;
    const spy: Fetcher = (url, init) => {
      sentUa = (init?.headers as Record<string, string> | undefined)?.["user-agent"];
      return base(url, init);
    };
    await ftsAdapter().fetch(WINDOW, { fetch: spy, now: () => FIXTURE_NOW });
    expect(sentUa).toBe(EDGAR_USER_AGENT);
    expect(sentUa).toMatch(/^weekly-ai-edition\/\d+ \S+@\S+$/); // Name <ver> email
  });

  it("builds the canonical index URL from accession + CIK", () => {
    expect(edgarIndexUrl("0001498148", "0001062993-26-005447")).toBe(
      "https://www.sec.gov/Archives/edgar/data/1498148/000106299326005447/0001062993-26-005447-index.htm",
    );
  });
});

describe("sec-edgar adapter — Atom current-filings path", () => {
  it("keeps only AI-relevant filings in configured forms", async () => {
    const { items } = await runAdapterFixture(feedAdapter(), FIXTURE_PATH, { window: WINDOW });
    // Keystone (no AI term), HEmerald D/A (no AI term), NAPCO (DEFA14A form) all drop.
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.headline).toBe("D — AI Legal Support LLC");
    expect(item.canonical_url).toBe(
      "https://www.sec.gov/Archives/edgar/data/2162585/000216258526000001/0002162585-26-000001-index.htm",
    );
    expect(item.source_ids.edgar_accession).toBe("0002162585-26-000001");
    expect(item.source_ids.edgar_cik).toBe("0002162585");
    expect(item.published_at).toBe("2026-10-28T17:43:56.000Z");
    expect(item.excerpt).toContain("Filed: 2026-10-28");
    expect(item.excerpt).toContain("AccNo: 0002162585-26-000001");
  });

  it("without aiTerms, keeps forms incl. /A amendments — drops other forms", async () => {
    const adapter = createSecEdgarAdapter({
      endpoint: FEED_ENDPOINT,
      kind: "atom",
      forms: ["D"],
      aiTerms: [],
    });
    const { items } = await runAdapterFixture(adapter, FIXTURE_PATH, { window: WINDOW });
    const accs = items.map((i) => i.source_ids.edgar_accession);
    expect(accs).toEqual([
      "0002162606-26-000001", // D Keystone
      "0002162585-26-000001", // D AI Legal
      "0002042965-26-000001", // D/A HEmerald — kept as D
    ]);
    const daItem = items.find((i) => i.source_ids.edgar_form === "D/A");
    expect(daItem?.headline).toBe("D/A — HEmerald Water Fund, L.P.");
    // NAPCO DEFA14A is not a D — dropped by the forms filter.
    expect(accs).not.toContain("0001140361-26-040997");
  });
});

describe("sec-edgar adapter — health + determinism", () => {
  it("health() reports ok on the replayed endpoints", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    for (const adapter of [ftsAdapter(), feedAdapter()]) {
      const health = await adapter.health({
        fetch: replayFetcher(fixture, FIXTURE_PATH),
        now: () => FIXTURE_NOW,
      });
      expect(health.ok).toBe(true);
      expect(health.detail).toContain("HTTP 200");
      expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
    }
  });

  it("health() reports failure without throwing", async () => {
    const empty = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    for (const adapter of [ftsAdapter(), feedAdapter()]) {
      const health = await adapter.health({ fetch: replayFetcher(empty) });
      expect(health.ok).toBe(false);
    }
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(ftsAdapter(), FIXTURE_PATH, { window: WINDOW });
    const b = await runAdapterFixture(ftsAdapter(), FIXTURE_PATH, { window: WINDOW });
    expect(a).toEqual(b);
  });
});
