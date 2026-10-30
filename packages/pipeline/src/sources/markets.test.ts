import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { type Fetcher, isRawItem, USER_AGENT } from "../adapter.js";
import { loadMarketsConfig } from "../config.js";
import {
  type AdapterFixture,
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
} from "../testing/harness.js";
import {
  collapseToWeeklyBars,
  createMarketsAdapter,
  MARKETS_ADAPTER_ID,
  MARKETS_PUBLISHER,
  parseWeeklyBars,
  parseYahooDailyBars,
  STOOQ_WEEKLY_PROVIDER,
  YAHOO_MARKETS_PUBLISHER,
  YAHOO_WEEKLY_PROVIDER,
} from "./markets.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/markets.json", import.meta.url));
const YAHOO_FIXTURE_PATH = fileURLToPath(
  new URL("./__fixtures__/markets-yahoo.json", import.meta.url),
);
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));

const ENDPOINT = "https://stooq.com/q/d/l/";
/** Basket read from the real config — the acceptance criterion's wiring. */
const BASKET = loadMarketsConfig(repo("config/markets.json")).basket;

/** Oct-30 bar in-window; Oct-23 (the delta's prior) outside it. */
const WINDOW = { from: new Date("2026-10-26T00:00:00Z"), to: new Date("2026-11-01T23:59:59Z") };

const adapter = (o: Partial<Parameters<typeof createMarketsAdapter>[0]> = {}) =>
  createMarketsAdapter({ endpoint: ENDPOINT, basket: BASKET, params: { i: "w" }, ...o });

describe("markets adapter — Stooq weekly CSV", () => {
  it("replays the fixture: one item per ticker, close + WoW delta, no network", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: WINDOW,
    });
    expect(adapter().id).toBe(MARKETS_ADAPTER_ID);

    // fetch path: the full 10-name basket, one RawItem per ticker for the
    // week ending 2026-10-30 (older recorded bars stay outside the window).
    expect(items).toHaveLength(10);
    expect(items.map((i) => i.source_ids.ticker).sort()).toEqual(
      ["AMD", "AMZN", "ARM", "AVGO", "GOOGL", "META", "MSFT", "NVDA", "PLTR", "TSM"],
    );
    for (const item of items) {
      expect(isRawItem(item)).toBe(true);
      expect(item.publisher).toBe(MARKETS_PUBLISHER);
      expect(item.source_ids.provider).toBe(STOOQ_WEEKLY_PROVIDER);
      expect(item.source_ids.week_ending).toBe("2026-10-30");
      expect(item.fetched_at).toBe(FIXTURE_NOW.toISOString());
      expect(item.published_at).toBe("2026-10-30T00:00:00.000Z");
    }

    // Numbers destined for evidence spans: close + WoW delta verbatim in
    // the excerpt, plus source_ids strings for downstream extraction.
    const nvda = items.find((i) => i.source_ids.ticker === "NVDA")!;
    expect(nvda.headline).toBe("NVDA weekly close 192.44 (+3.4% WoW)");
    expect(nvda.canonical_url).toBe("https://stooq.com/q/?s=nvda.us");
    expect(nvda.source_ids.stooq_symbol).toBe("nvda.us");
    expect(nvda.source_ids.weekly_close).toBe("192.44");
    expect(nvda.source_ids.prior_weekly_close).toBe("186.10");
    expect(nvda.source_ids.wow_delta_pct).toBe("3.4");
    expect(nvda.excerpt).toContain("close 192.44");
    expect(nvda.excerpt).toContain("+3.4% vs prior weekly close 186.10");
    expect(nvda.excerpt).toContain("2026-10-30");
    expect(nvda.excerpt).toContain("NVIDIA (NVDA)");

    const meta = items.find((i) => i.source_ids.ticker === "META")!;
    expect(meta.headline).toBe("META weekly close 641.77 (-0.8% WoW)");
    expect(meta.source_ids.wow_delta_pct).toBe("-0.8");

    // pure path: recorded bodies are raw CSV strings → symbol-blind
    // items (no ticker/symbol keys, canonical_url = the endpoint).
    expect(mapped).toHaveLength(40); // 4 bars × 10 tickers
    for (const item of mapped) {
      expect(item.source_ids.ticker).toBeUndefined();
      expect(item.source_ids.stooq_symbol).toBeUndefined();
      expect(item.canonical_url).toBe(ENDPOINT);
      expect(item.headline).toMatch(/^Weekly close \d/);
    }
  });

  it("keeps only weekly bars inside the window", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-10-20T00:00:00Z"), to: new Date("2026-10-25T00:00:00Z") },
    });
    expect(items).toHaveLength(10);
    for (const item of items) {
      expect(item.source_ids.week_ending).toBe("2026-10-23");
      // delta still resolves — the Oct-16 prior bar was fetched via d1 lookback.
      expect(item.source_ids.wow_delta_pct).toBeDefined();
      expect(item.source_ids.prior_weekly_close).toBeDefined();
    }
  });

  it("builds per-ticker requests: symbol, i=w, d1 lookback, d2 = window.to", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const seen: string[] = [];
    const spy: Fetcher = (url, init) => {
      seen.push(String(url));
      return replayFetcher(fixture, FIXTURE_PATH)(url, init);
    };
    await adapter().fetch(WINDOW, { fetch: spy, now: () => FIXTURE_NOW });
    expect(seen).toHaveLength(10);
    const nvdaUrl = seen.find((u) => u.includes("s=nvda.us"))!;
    expect(nvdaUrl).toContain("i=w");
    expect(nvdaUrl).toContain("d1=20261010"); // Oct-26 minus 16-day lookback
    expect(nvdaUrl).toContain("d2=20261101");
    expect(seen.every((u) => u.startsWith(ENDPOINT))).toBe(true);
  });

  it("sends the project UA on every request", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    let sentUa: string | undefined;
    const spy: Fetcher = (url, init) => {
      sentUa = (init?.headers as Record<string, string> | undefined)?.["user-agent"];
      return replayFetcher(fixture, FIXTURE_PATH)(url, init);
    };
    await adapter().fetch(WINDOW, { fetch: spy, now: () => FIXTURE_NOW });
    expect(sentUa).toBe(USER_AGENT);
  });

  it("degrades one ticker's failure — never the run", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const broken: AdapterFixture = {
      responses: fixture.responses.map((r) =>
        r.url_contains === "s=nvda.us" ? { ...r, status: 500 } : r,
      ),
    };
    const ctx = {
      fetch: replayFetcher(broken, FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    };
    const items = await adapter().fetch(WINDOW, ctx);
    expect(items).toHaveLength(9);
    expect(items.map((i) => i.source_ids.ticker)).not.toContain("NVDA");
  });
});

describe("markets adapter — map() purity + edge cases", () => {
  it("parses a raw CSV body into symbol-blind items (pure path)", () => {
    const csv =
      "Date,Open,High,Low,Close,Volume\n2026-10-23,100,105,99,104.00,1000\n2026-10-30,104,110,103,109.20,1200\n";
    const items = adapter().map(csv, FIXTURE_NOW);
    expect(items).toHaveLength(2);
    expect(items[1]!.headline).toBe("Weekly close 109.20 (+5.0% WoW)");
    expect(items[1]!.source_ids.ticker).toBeUndefined();
    expect(items[1]!.source_ids.prior_weekly_close).toBe("104.00");
    expect(items[1]!.source_ids.wow_delta_pct).toBe("5.0");
  });

  it("emits no delta keys when the first bar has no prior", () => {
    const items = adapter().map(
      { ticker: "NVDA", name: "NVIDIA", symbol: "nvda.us", csv: "Date,Open,High,Low,Close,Volume\n2026-10-30,190,193,189,192.44,171980000\n" },
      FIXTURE_NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.source_ids.wow_delta_pct).toBeUndefined();
    expect(items[0]!.source_ids.prior_weekly_close).toBeUndefined();
    expect(items[0]!.excerpt).toContain("no prior weekly bar in range");
    expect(items[0]!.headline).toBe("NVDA weekly close 192.44");
  });

  it("returns [] for non-CSV bodies (challenge page, rate-limit text)", () => {
    const a = adapter();
    expect(a.map("<html><body>verify your browser</body></html>", FIXTURE_NOW)).toEqual([]);
    expect(a.map("Exceeded the daily hits limit", FIXTURE_NOW)).toEqual([]);
    expect(a.map("No data", FIXTURE_NOW)).toEqual([]);
    expect(a.map({ not: "a slice" }, FIXTURE_NOW)).toEqual([]);
  });

  it("normalizes descending row order before picking prior bars", () => {
    const csv =
      "Date,Open,High,Low,Close,Volume\n2026-10-30,104,110,103,109.20,1200\n2026-10-23,100,105,99,104.00,1000\n";
    const items = adapter().map(csv, FIXTURE_NOW);
    expect(items.map((i) => i.source_ids.week_ending)).toEqual(["2026-10-23", "2026-10-30"]);
    expect(items[1]!.source_ids.wow_delta_pct).toBe("5.0");
  });

  it("parseWeeklyBars skips malformed rows and keeps verbatim close text", () => {
    const bars = parseWeeklyBars(
      "Date,Open,High,Low,Close,Volume\nnot-a-date,1,2,3,4,5\n2026-10-30,190,193,189,192.440,10\n",
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]!.closeText).toBe("192.440");
    expect(bars[0]!.close).toBeCloseTo(192.44);
  });
});

describe("markets adapter — provider selection + health", () => {
  it("keyed fallback providers emit nothing and report not-implemented", async () => {
    const av = adapter({ provider: "alpha-vantage" });
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const ctx = { fetch: replayFetcher(fixture, FIXTURE_PATH), now: () => FIXTURE_NOW };
    expect(await av.fetch(WINDOW, ctx)).toEqual([]);
    const health = await av.health(ctx);
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("alpha-vantage");
  });

  it("health() verifies a real CSV body, not just HTTP 200", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const health = await adapter().health({
      fetch: replayFetcher(fixture, FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("HTTP 200");
    expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
  });

  it("health() flags challenge pages and failures without throwing", async () => {
    const challenge: AdapterFixture = {
      responses: [{ body: "<html>browser verification required</html>" }],
    };
    const h1 = await adapter().health({ fetch: replayFetcher(challenge) });
    expect(h1.ok).toBe(false);
    expect(h1.detail).toContain("non-CSV");

    const empty = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    const h2 = await adapter().health({ fetch: replayFetcher(empty) });
    expect(h2.ok).toBe(false);
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(adapter(), FIXTURE_PATH, { window: WINDOW });
    const b = await runAdapterFixture(adapter(), FIXTURE_PATH, { window: WINDOW });
    expect(a).toEqual(b);
  });
});

describe("markets adapter — Yahoo Finance daily chart", () => {
  const YAHOO_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart/";
  const yahoo = (o: Partial<Parameters<typeof createMarketsAdapter>[0]> = {}) =>
    createMarketsAdapter({
      endpoint: YAHOO_ENDPOINT,
      basket: BASKET,
      provider: YAHOO_WEEKLY_PROVIDER,
      ...o,
    });

  it("replays the recorded chart bodies: one item per ticker, last trading day per week", async () => {
    const { items, mapped } = await runAdapterFixture(yahoo(), YAHOO_FIXTURE_PATH, {
      window: WINDOW,
    });
    expect(yahoo().id).toBe(MARKETS_ADAPTER_ID);

    // fetch path: the full 10-name basket, one item per ticker for the
    // week ending 2026-10-29 (Oct-30 had not traded when the slice was
    // recorded — the week's last bar is Thursday).
    expect(items).toHaveLength(10);
    for (const item of items) {
      expect(isRawItem(item)).toBe(true);
      expect(item.publisher).toBe(YAHOO_MARKETS_PUBLISHER);
      expect(item.source_ids.provider).toBe(YAHOO_WEEKLY_PROVIDER);
      expect(item.source_ids.week_ending).toBe("2026-10-29");
      expect(item.source_ids.yahoo_symbol).toMatch(/^[A-Z]+$/);
      expect(item.fetched_at).toBe(FIXTURE_NOW.toISOString());
    }

    // Real recorded closes — provenance-grade verbatim numbers.
    const nvda = items.find((i) => i.source_ids.ticker === "NVDA")!;
    expect(nvda.headline).toBe("NVDA weekly close 213.66 (+1.3% WoW)");
    expect(nvda.canonical_url).toBe("https://finance.yahoo.com/quote/NVDA");
    expect(nvda.source_ids.weekly_close).toBe("213.66");
    expect(nvda.source_ids.prior_weekly_close).toBe("210.96");
    expect(nvda.source_ids.wow_delta_pct).toBe("1.3");
    expect(nvda.excerpt).toContain("close 213.66");
    expect(nvda.excerpt).toContain("Yahoo Finance daily closes");

    const meta = items.find((i) => i.source_ids.ticker === "META")!;
    expect(meta.source_ids.wow_delta_pct).toBe("-2.8");

    // pure path: recorded bodies replay bare (parsed JSON objects) →
    // symbol-blind items, canonical_url = the endpoint.
    expect(mapped).toHaveLength(40); // 4 weekly bars × 10 tickers
    for (const item of mapped) {
      expect(item.source_ids.ticker).toBeUndefined();
      expect(item.source_ids.yahoo_symbol).toBeUndefined();
      expect(item.canonical_url).toBe(YAHOO_ENDPOINT);
    }
  });

  it("builds per-ticker chart requests: interval=1d + lookback period1", async () => {
    const fixture = loadAdapterFixture(YAHOO_FIXTURE_PATH);
    const seen: string[] = [];
    const spy: Fetcher = (url, init) => {
      seen.push(String(url));
      return replayFetcher(fixture, YAHOO_FIXTURE_PATH)(url, init);
    };
    await yahoo().fetch(WINDOW, { fetch: spy, now: () => FIXTURE_NOW });
    expect(seen).toHaveLength(10);
    const nvdaUrl = seen.find((u) => u.includes("chart/NVDA"))!;
    expect(nvdaUrl).toContain("interval=1d");
    expect(nvdaUrl).toContain("period1=");
    expect(nvdaUrl).toContain("period2=");
    expect(seen.every((u) => u.startsWith(YAHOO_ENDPOINT))).toBe(true);
  });

  it("health() verifies a parseable chart body, not just HTTP 200", async () => {
    const fixture = loadAdapterFixture(YAHOO_FIXTURE_PATH);
    const health = await yahoo().health({
      fetch: replayFetcher(fixture, YAHOO_FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("chart JSON");

    const challenge: AdapterFixture = {
      responses: [{ body: "<html>browser verification required</html>" }],
    };
    const h = await yahoo().health({ fetch: replayFetcher(challenge) });
    expect(h.ok).toBe(false);
    expect(h.detail).toContain("non-chart");
  });

  it("parseYahooDailyBars skips null closes and keeps verbatim close text", () => {
    const bars = parseYahooDailyBars(
      JSON.stringify({
        chart: {
          result: [
            {
              meta: { gmtoffset: -14400 },
              timestamp: [1792762200, 1792848600],
              indicators: { quote: [{ close: [210.9600067138672, null] }] },
            },
          ],
        },
      }),
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]!.date).toBe("2026-10-23"); // ts + gmtoffset → exchange-local day
    expect(bars[0]!.closeText).toBe("210.96");
  });

  it("collapseToWeeklyBars carries the last trading day of each Mon–Sun week", () => {
    const weekly = collapseToWeeklyBars([
      { date: "2026-10-27", closeText: "1", close: 1 }, // Tue
      { date: "2026-10-28", closeText: "2", close: 2 }, // Wed — last of week
      { date: "2026-10-29", closeText: "3", close: 3 }, // Thu — same week
      { date: "2026-11-02", closeText: "4", close: 4 }, // next week
    ]);
    expect(weekly).toEqual([
      { date: "2026-10-29", closeText: "3", close: 3 },
      { date: "2026-11-02", closeText: "4", close: 4 },
    ]);
  });
});
