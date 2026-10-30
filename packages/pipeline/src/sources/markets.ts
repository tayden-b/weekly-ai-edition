/**
 * A8 — market data adapter (PLAN.md §5.1: the Markets page — weekly close
 * of the AI basket in `config/markets.json`).
 *
 * Implemented providers:
 *  - `stooq-weekly` — Stooq's keyless CSV endpoint
 *    (`<endpoint>?s=<symbol>&i=w&d1=YYYYMMDD&d2=YYYYMMDD`). Weekly bars have
 *    `Date` = the week's last trading day and columns
 *    `Date,Open,High,Low,Close,Volume`; row order is normalized here.
 *    Dead behind a JS proof-of-work wall to datacenter IPs since
 *    2026-10-28 — kept as the citation row for committed editions and the
 *    documented fallback (`enabled: false` in sources.yaml).
 *  - `yahoo-weekly` — Yahoo Finance's keyless chart endpoint
 *    (`<endpoint><symbol>?interval=1d&period1=<unix>&period2=<unix>`).
 *    Daily bars are collapsed to weekly closes here: the last trading day
 *    in each Mon–Sun week carries the close, identical shape to Stooq's
 *    weekly bar. Symbols are bare US tickers (no `.us` suffix).
 * The three keyed fallbacks in `config/sources.yaml` (alpha-vantage,
 * finnhub, twelve-data) stay `enabled: false`: each needs an API key the
 * no-secrets rule forbids. A non-implemented provider id emits no
 * items and `health()` reports it — the Markets page degrades, the run
 * continues (§5.1). Provider SELECTION is config data
 * (`markets.json.provider` / `provider_priority` + the sources.yaml
 * `enabled` flags ingest iterates), never this file.
 *
 * Item shape — ONE RawItem PER TICKER PER WEEKLY BAR in the window (the
 * brief's documented choice): the schema's markets page is a flat
 * `tickers[]` of `{ticker, close, delta}`, and §5.3 wants every number
 * to carry `evidence: {source_index, quote}` — one item per ticker per
 * week gives each close+delta its own source record and its own
 * quotable excerpt; a single basket item would force ten numbers
 * through one ≤300-char excerpt. `map` emits one item per weekly bar in
 * the payload; `fetch` keeps only bars whose date falls in the window
 * (same keepItem convention as the other adapters).
 *
 * Identity: a Stooq CSV body carries no symbol, so `map` accepts either
 * a raw CSV string (symbol-blind — the recorded-fixture/pure path; items
 * get `canonical_url` = the endpoint and no ticker key) or a
 * `MarketCsvSlice {ticker, name, symbol, csv}` — what `fetch` always
 * passes. Same convention as A3: `map` transforms the body it can see,
 * `fetch` supplies the identity the wire lacks.
 *
 * Licence finding (the brief's §9 risk — verified 2026-10-28):
 *  - stooq-weekly — ToS §5.3: "Redistribution of data found on the
 *    website is not allowed without the consent of Stooq"
 *    (stooq.com/terms); the download page restricts to personal use.
 *    → DOUBTFUL. The entry carries `mode: link`: close+delta numbers
 *    are still captured for provenance/evidence, but the Markets page
 *    ships links-only until consent or a licensed feed exists. Access
 *    is additionally JS-challenge-walled to datacenter IPs (PoW
 *    verification page observed 2026-10-28 — same class as Reuters'
 *    DataDome wall).
 *  - alpha-vantage — ToS: personal, non-commercial use; display to
 *    third parties requires a commercial agreement. Needs a free key
 *    → disabled (no-secrets rule).
 *  - finnhub — free tier is non-commercial and restricts
 *    redistribution. Needs a free key → disabled.
 *  - twelve-data — individual plans are internal-use only;
 *    redistribution needs a paid Redistribution Rights add-on. Needs a
 *    free key → disabled.
 *  - yahoo-weekly — the `query1.finance.yahoo.com` chart endpoint is
 *    undocumented; Yahoo's ToS grant no redistribution rights
 *    (yahoo.com/legal — same DOUBTFUL class as Stooq) → `mode: link`:
 *    close+delta numbers still captured for provenance, the Markets page
 *    ships links-only. Chosen as the live provider 2026-10-30: it is the
 *    only keyless endpoint that still answers datacenter IPs (verified
 *    HTTP 200, real bars, same egress that stooq PoW-walls).
 *  No free candidate permits redistribution: keyless endpoints are chosen
 *  for reachability, and the page renders links until a licence exists.
 */

import {
  adapterContext,
  type AdapterContext,
  type AdapterHealth,
  type FetchWindow,
  type RawItem,
  type SourceAdapter,
  toExcerpt,
} from "../adapter.js";
import type { MarketTicker } from "../config.js";

export const MARKETS_ADAPTER_ID = "markets";
export const MARKETS_PUBLISHER = "Stooq";
export const STOOQ_WEEKLY_PROVIDER = "stooq-weekly";
export const YAHOO_WEEKLY_PROVIDER = "yahoo-weekly";
export const YAHOO_MARKETS_PUBLISHER = "Yahoo Finance";
export const YAHOO_QUOTE_ORIGIN = "https://finance.yahoo.com";

const DEFAULT_SYMBOL_SUFFIX = ".us";
/** Lookback appended before `window.from` so the prior weekly bar is fetched. */
const DEFAULT_PRIOR_WEEK_LOOKBACK_DAYS = 16;
const DAY_MS = 86_400_000;

/**
 * What `map` parses: the raw CSV plus the request identity the wire
 * lacks. `fetch` always supplies ticker/name/symbol; the bare-string
 * path (a recorded body replayed through `map`) is symbol-blind.
 */
export interface MarketCsvSlice {
  /** Basket ticker, e.g. "NVDA". */
  ticker?: string;
  /** Basket display name, e.g. "NVIDIA". */
  name?: string;
  /** Provider symbol, e.g. "nvda.us". */
  symbol?: string;
  /** Raw CSV body (`Date,Open,High,Low,Close,Volume`). */
  csv: string;
}

/**
 * Yahoo path of `map`: the recorded `chart.result` JSON body plus the
 * request identity the wire lacks (same convention as MarketCsvSlice —
 * `fetch` always supplies ticker/name/symbol).
 */
export interface MarketYahooSlice {
  ticker?: string;
  name?: string;
  symbol?: string;
  /** Raw chart-API JSON body (`{"chart":{"result":[…]}}`). */
  json: string;
}

export interface MarketsAdapterOptions {
  /** Endpoint URL from `config/sources.yaml` (Stooq: `https://stooq.com/q/d/l/`). */
  endpoint: string;
  /** The fixed basket — callers pass `loadMarketsConfig(path).basket`. */
  basket: MarketTicker[];
  /**
   * `sources.yaml` entry id this instance serves (default
   * `stooq-weekly`). Implemented: `stooq-weekly` (CSV), `yahoo-weekly`
   * (daily chart JSON → weekly closes). Keyed providers return [] — no
   * secrets exist for their keys.
   */
  provider?: string;
  /** Extra query params merged into each request (entry `meta.params`, e.g. `{i: "w"}`). */
  params?: Record<string, string>;
  /** Symbol suffix for the provider — ".us" covers every US-listed basket name (Yahoo takes bare tickers, default ""). */
  symbolSuffix?: string;
  /** Days looked back before `window.from` so the WoW delta has a prior bar (default 16). */
  priorWeekLookbackDays?: number;
}

interface WeeklyBar {
  /** YYYY-MM-DD — the week's last trading day. */
  date: string;
  /** The close cell verbatim — evidence quotes must match publisher digits. */
  closeText: string;
  close: number;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function isSlice(value: unknown): value is MarketCsvSlice {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MarketCsvSlice).csv === "string"
  );
}

function isYahooSlice(value: unknown): value is MarketYahooSlice {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MarketYahooSlice).json === "string"
  );
}

/**
 * Parse a Stooq weekly CSV into ascending bars. Returns [] for anything
 * that is not the documented CSV (rate-limit text, HTML challenge page,
 * "No data" reply) — degrade, never throw.
 */
export function parseWeeklyBars(csv: string): WeeklyBar[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length === 0 || !/^date,/i.test(lines[0]!)) return [];
  const bars: WeeklyBar[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const date = cells[0]?.trim();
    const closeText = cells[4]?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !closeText) continue;
    const close = Number(closeText);
    if (!Number.isFinite(close)) continue;
    bars.push({ date, closeText, close });
  }
  bars.sort((a, b) => a.date.localeCompare(b.date));
  return bars;
}

/**
 * Parse a Yahoo chart-API body (`interval=1d`) into ascending daily bars.
 * `chart.result[0].timestamp` holds market-open epochs; `meta.gmtoffset`
 * converts each to the exchange-local trading date. Null closes
 * (holidays inside the range) are skipped. Returns [] for anything that
 * is not the documented shape — degrade, never throw.
 */
export function parseYahooDailyBars(json: string): WeeklyBar[] {
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return [];
  }
  const result = (doc as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as
    | {
        timestamp?: unknown;
        indicators?: { quote?: { close?: unknown }[] };
        meta?: { gmtoffset?: unknown };
      }
    | undefined;
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  const gmtoffset =
    typeof result?.meta?.gmtoffset === "number" ? result.meta.gmtoffset : 0;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];
  const bars: WeeklyBar[] = [];
  for (const [i, ts] of timestamps.entries()) {
    if (typeof ts !== "number" || !Number.isFinite(ts)) continue;
    const close = closes[i];
    if (typeof close !== "number" || !Number.isFinite(close)) continue;
    const date = new Date((ts + gmtoffset) * 1000).toISOString().slice(0, 10);
    const closeText = close.toFixed(2);
    bars.push({ date, closeText, close });
  }
  bars.sort((a, b) => a.date.localeCompare(b.date));
  return bars;
}

/** Monday-start week key (YYYY-MM-DD of the week's Monday) for a trading date. */
function weekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return new Date(d.getTime() - dow * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Collapse daily bars to weekly closes: the last trading day in each
 * Mon–Sun week carries the week's close — identical semantics to Stooq's
 * weekly bar (`Date` = the week's last trading day).
 */
export function collapseToWeeklyBars(daily: WeeklyBar[]): WeeklyBar[] {
  const bars: WeeklyBar[] = [];
  let key: string | null = null;
  for (const bar of daily) {
    const k = weekKey(bar.date);
    if (k !== key) {
      bars.push(bar);
      key = k;
    } else {
      bars[bars.length - 1] = bar;
    }
  }
  return bars;
}

/** Week-over-week delta in percent; null when either side is unusable. */
function wowDeltaPct(close: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) return null;
  return (close / prior - 1) * 100;
}

function signed1(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}

export function createMarketsAdapter(opts: MarketsAdapterOptions): SourceAdapter {
  const provider = opts.provider ?? STOOQ_WEEKLY_PROVIDER;
  const isYahoo = provider === YAHOO_WEEKLY_PROVIDER;
  const symbolSuffix =
    opts.symbolSuffix ?? (isYahoo ? "" : DEFAULT_SYMBOL_SUFFIX);
  const lookbackDays = opts.priorWeekLookbackDays ?? DEFAULT_PRIOR_WEEK_LOOKBACK_DAYS;
  const quoteOrigin = new URL(opts.endpoint).origin;
  const publisherName = isYahoo ? YAHOO_MARKETS_PUBLISHER : MARKETS_PUBLISHER;
  const symbolKey = isYahoo ? "yahoo_symbol" : "stooq_symbol";
  const excerptNote = isYahoo
    ? "Yahoo Finance daily closes, last trading day per week"
    : "Stooq weekly bars, i=w";

  function symbolFor(ticker: string): string {
    // Yahoo symbols are the bare uppercase tickers; Stooq appends ".us".
    return isYahoo ? ticker : `${ticker.toLowerCase()}${symbolSuffix}`;
  }

  function canonicalFor(symbol: string | undefined): string {
    if (symbol === undefined) return opts.endpoint;
    return isYahoo
      ? `${YAHOO_QUOTE_ORIGIN}/quote/${symbol}`
      : `${quoteOrigin}/q/?s=${symbol}`;
  }

  function tickerUrl(symbol: string, window: FetchWindow): string {
    const u = new URL(opts.endpoint);
    u.searchParams.set("s", symbol);
    for (const [k, v] of Object.entries(opts.params ?? {})) u.searchParams.set(k, v);
    if (!u.searchParams.has("i")) u.searchParams.set("i", "w");
    u.searchParams.set("d1", ymd(new Date(window.from.getTime() - lookbackDays * DAY_MS)));
    u.searchParams.set("d2", ymd(window.to));
    return u.toString();
  }

  function yahooTickerUrl(symbol: string, window: FetchWindow): string {
    const base = opts.endpoint.endsWith("/") ? opts.endpoint : `${opts.endpoint}/`;
    const u = new URL(`${base}${symbol}`);
    for (const [k, v] of Object.entries(opts.params ?? {})) u.searchParams.set(k, v);
    if (!u.searchParams.has("interval")) u.searchParams.set("interval", "1d");
    if (!u.searchParams.has("period1")) {
      u.searchParams.set(
        "period1",
        String(Math.floor((window.from.getTime() - lookbackDays * DAY_MS) / 1000)),
      );
    }
    if (!u.searchParams.has("period2")) {
      u.searchParams.set("period2", String(Math.floor(window.to.getTime() / 1000)));
    }
    return u.toString();
  }

  function itemForBar(
    slice: { ticker?: string; name?: string; symbol?: string },
    bar: WeeklyBar,
    prior: WeeklyBar | undefined,
    fetchedAt: Date,
  ): RawItem {
    const delta = prior ? wowDeltaPct(bar.close, prior.close) : null;
    const deltaText = delta === null ? null : `${signed1(delta)}%`;
    const attributed = slice.ticker !== undefined;
    const label = attributed ? `${slice.name ?? slice.ticker} (${slice.ticker})` : "Weekly bar";

    const movement =
      delta === null
        ? `close ${bar.closeText}; no prior weekly bar in range`
        : `close ${bar.closeText}, ${deltaText} vs prior weekly close ${prior!.closeText}`;
    const excerpt = toExcerpt(
      `${label} week ending ${bar.date}: ${movement} (${excerptNote}).`,
    );
    const headline = attributed
      ? `${slice.ticker} weekly close ${bar.closeText}${deltaText ? ` (${deltaText} WoW)` : ""}`
      : `Weekly close ${bar.closeText}${deltaText ? ` (${deltaText} WoW)` : ""}`;

    return {
      headline,
      canonical_url: attributed ? canonicalFor(slice.symbol) : opts.endpoint,
      publisher: publisherName,
      published_at: `${bar.date}T00:00:00.000Z`,
      fetched_at: fetchedAt.toISOString(),
      excerpt,
      source_ids: {
        provider,
        ...(slice.ticker ? { ticker: slice.ticker } : {}),
        ...(slice.symbol ? { [symbolKey]: slice.symbol } : {}),
        week_ending: bar.date,
        weekly_close: bar.closeText,
        ...(prior ? { prior_weekly_close: prior.closeText } : {}),
        ...(delta !== null ? { wow_delta_pct: delta.toFixed(1) } : {}),
      },
    };
  }

  function inWindow(item: RawItem, window: FetchWindow): boolean {
    const t = Date.parse(item.published_at);
    return t >= window.from.getTime() && t <= window.to.getTime();
  }

  const adapter: SourceAdapter = {
    id: MARKETS_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      if (!isYahoo && provider !== STOOQ_WEEKLY_PROVIDER) {
        return []; // keyed fallback, no key exists
      }
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      const fetchedAt = now();
      const items: RawItem[] = [];
      for (const t of opts.basket) {
        const symbol = symbolFor(t.ticker);
        try {
          const url = isYahoo
            ? yahooTickerUrl(symbol, window)
            : tickerUrl(symbol, window);
          const res = await fetcher(url, {
            headers: { "user-agent": userAgent },
          });
          if (!res.ok) continue; // one ticker's failure degrades it, never the run
          const body = await res.text();
          const slice = isYahoo
            ? { ticker: t.ticker, name: t.name, symbol, json: body }
            : { ticker: t.ticker, name: t.name, symbol, csv: body };
          items.push(...adapter.map(slice, fetchedAt));
        } catch {
          continue;
        }
      }
      return items.filter((i) => inWindow(i, window));
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      const checked_at = now().toISOString();
      if (!isYahoo && provider !== STOOQ_WEEKLY_PROVIDER) {
        return {
          ok: false,
          detail: `provider "${provider}" needs an API key — disabled (no-secrets rule)`,
          checked_at,
        };
      }
      const first = opts.basket[0];
      if (!first) return { ok: false, detail: "empty basket", checked_at };
      try {
        const to = now();
        const window = { from: new Date(to.getTime() - 40 * DAY_MS), to };
        const url = isYahoo
          ? yahooTickerUrl(symbolFor(first.ticker), window)
          : tickerUrl(symbolFor(first.ticker), window);
        const res = await fetcher(url, { headers: { "user-agent": userAgent } });
        if (!res.ok) {
          return { ok: false, detail: `${opts.endpoint} → HTTP ${res.status}`, checked_at };
        }
        const body = await res.text();
        const ok = isYahoo
          ? parseYahooDailyBars(body).length > 0
          : /^date,/im.test(body);
        return {
          ok,
          detail: ok
            ? `${opts.endpoint} → HTTP 200, ${isYahoo ? "chart JSON" : "CSV"} verified`
            : `${opts.endpoint} → HTTP 200, ${isYahoo ? "non-chart JSON or empty series" : "non-CSV body"} (rate-limit or JS challenge page)`,
          checked_at,
        };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      // CSV paths: bare string (symbol-blind) or a MarketCsvSlice.
      if (typeof payload === "string" || isSlice(payload)) {
        const slice: MarketCsvSlice =
          typeof payload === "string" ? { csv: payload } : payload;
        const bars = parseWeeklyBars(slice.csv);
        return bars.map((bar, i) => itemForBar(slice, bar, bars[i - 1], fetchedAt));
      }
      // Yahoo paths: a MarketYahooSlice, or a recorded chart body replayed
      // bare through map (symbol-blind — same convention as raw CSV).
      const slice: MarketYahooSlice = isYahooSlice(payload)
        ? payload
        : typeof payload === "object" && payload !== null
          ? { json: JSON.stringify(payload) }
          : { json: "" };
      const bars = collapseToWeeklyBars(parseYahooDailyBars(slice.json));
      return bars.map((bar, i) => itemForBar(slice, bar, bars[i - 1], fetchedAt));
    },
  };

  return adapter;
}
