/**
 * A8 — market data adapter (PLAN.md §5.1: the Markets page — weekly close
 * of the AI basket in `config/markets.json`).
 *
 * Implemented provider: `stooq-weekly` — Stooq's keyless CSV endpoint
 * (`<endpoint>?s=<symbol>&i=w&d1=YYYYMMDD&d2=YYYYMMDD`). Weekly bars have
 * `Date` = the week's last trading day and columns
 * `Date,Open,High,Low,Close,Volume`; row order is normalized here.
 * The three keyed fallbacks in `config/sources.yaml` (alpha-vantage,
 * finnhub, twelve-data) stay `enabled: false`: each needs an API key the
 * no-secrets rule forbids. A non-`stooq-weekly` provider id emits no
 * items and `health()` reports it — the Markets page degrades, the run
 * continues (§5.1). Provider SELECTION is config data
 * (`markets.json.provider` / `provider_priority`), never this file.
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
 *  No free candidate permits redistribution: Stooq is chosen for being
 *  keyless, and the page renders links until a licence exists.
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

export interface MarketsAdapterOptions {
  /** Endpoint URL from `config/sources.yaml` (Stooq: `https://stooq.com/q/d/l/`). */
  endpoint: string;
  /** The fixed basket — callers pass `loadMarketsConfig(path).basket`. */
  basket: MarketTicker[];
  /**
   * `sources.yaml` entry id this instance serves (default
   * `stooq-weekly`, the only implemented provider). Keyed providers
   * return [] — no secrets exist for their keys.
   */
  provider?: string;
  /** Extra query params merged into each request (entry `meta.params`, e.g. `{i: "w"}`). */
  params?: Record<string, string>;
  /** Symbol suffix for the provider — ".us" covers every US-listed basket name. */
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
  const symbolSuffix = opts.symbolSuffix ?? DEFAULT_SYMBOL_SUFFIX;
  const lookbackDays = opts.priorWeekLookbackDays ?? DEFAULT_PRIOR_WEEK_LOOKBACK_DAYS;
  const quoteOrigin = new URL(opts.endpoint).origin;

  function symbolFor(ticker: string): string {
    return `${ticker.toLowerCase()}${symbolSuffix}`;
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

  function itemForBar(
    slice: MarketCsvSlice,
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
      `${label} week ending ${bar.date}: ${movement} (Stooq weekly bars, i=w).`,
    );
    const headline = attributed
      ? `${slice.ticker} weekly close ${bar.closeText}${deltaText ? ` (${deltaText} WoW)` : ""}`
      : `Weekly close ${bar.closeText}${deltaText ? ` (${deltaText} WoW)` : ""}`;

    return {
      headline,
      canonical_url:
        attributed && slice.symbol ? `${quoteOrigin}/q/?s=${slice.symbol}` : opts.endpoint,
      publisher: MARKETS_PUBLISHER,
      published_at: `${bar.date}T00:00:00.000Z`,
      fetched_at: fetchedAt.toISOString(),
      excerpt,
      source_ids: {
        provider,
        ...(slice.ticker ? { ticker: slice.ticker } : {}),
        ...(slice.symbol ? { stooq_symbol: slice.symbol } : {}),
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

  return {
    id: MARKETS_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      if (provider !== STOOQ_WEEKLY_PROVIDER) return []; // keyed fallback, no key exists
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      const fetchedAt = now();
      const items: RawItem[] = [];
      for (const t of opts.basket) {
        const symbol = symbolFor(t.ticker);
        try {
          const res = await fetcher(tickerUrl(symbol, window), {
            headers: { "user-agent": userAgent },
          });
          if (!res.ok) continue; // one ticker's failure degrades it, never the run
          const csv = await res.text();
          items.push(...this.map({ ticker: t.ticker, name: t.name, symbol, csv }, fetchedAt));
        } catch {
          continue;
        }
      }
      return items.filter((i) => inWindow(i, window));
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      const checked_at = now().toISOString();
      if (provider !== STOOQ_WEEKLY_PROVIDER) {
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
        const url = tickerUrl(symbolFor(first.ticker), {
          from: new Date(to.getTime() - 40 * DAY_MS),
          to,
        });
        const res = await fetcher(url, { headers: { "user-agent": userAgent } });
        if (!res.ok) {
          return { ok: false, detail: `${opts.endpoint} → HTTP ${res.status}`, checked_at };
        }
        const body = await res.text();
        const ok = /^date,/im.test(body);
        return {
          ok,
          detail: ok
            ? `${opts.endpoint} → HTTP 200, CSV verified`
            : `${opts.endpoint} → HTTP 200, non-CSV body (rate-limit or JS challenge page)`,
          checked_at,
        };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      const slice: MarketCsvSlice | null =
        typeof payload === "string" ? { csv: payload } : isSlice(payload) ? payload : null;
      if (slice === null) return [];
      const bars = parseWeeklyBars(slice.csv);
      return bars.map((bar, i) => itemForBar(slice, bar, bars[i - 1], fetchedAt));
    },
  };
}
