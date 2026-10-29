/**
 * Markets page view-model: turns the emitted EditionMarketsPage into what
 * @weekly/ui's MarketsChart + MonoTable render. Per-ticker dated closes are
 * recovered from the page's source excerpts/source_ids (the same conventions
 * the emit stage writes), the configured basket supplies "n/a" rows for
 * tickers with no data, and the caption is honest about recorded sources
 * when the live market adapter contributed nothing.
 */
import type { EditionMarketsPage, EditionSource } from "@weekly/schema";
import type {
  ChartSeriesView,
  MarketSeriesPoint,
  MarketTickerDatum,
  TickerView,
} from "@weekly/ui";
import marketsConfig from "../../../../config/markets.json";

/** Configured basket tickers, in config order (config/markets.json). */
export const MARKETS_BASKET: string[] = (
  marketsConfig as { basket: { ticker: string }[] }
).basket.map((t) => t.ticker);

export interface MarketsView {
  data: MarketTickerDatum[];
  /** Basket tickers with no data — rendered as explicit "n/a" rows. */
  missing: string[];
  /** Composite index fallback (drawn only at ≥ the line threshold). */
  index: ChartSeriesView;
  /** Table rows: emitted tickers, then n/a rows in basket order. */
  tickers: TickerView[];
  caption: string;
}

// "US:NVDA — raw closing price series." (fixture/exa excerpt prefix)
const US_PREFIX_RE = /^[A-Z]{2}:([A-Z.]+)/;
// "…/stock/NVDA?…" (exa markets URL convention)
const STOCK_URL_RE = /\/stock\/([A-Za-z.]+)/;
// "2026-10-27 USD 217.94" (exa series shape)
const DATED_USD_RE = /(\d{4}-\d{2}-\d{2})\s+USD\s+([0-9]+(?:\.[0-9]+)?)/g;
// "week ending 2026-10-24: close 217.94" (stooq-weekly excerpt shape)
const STOOQ_WEEKLY_RE = /week ending (\d{4}-\d{2}-\d{2}):\s*close ([0-9]+(?:\.[0-9]+)?)/gi;

function tickerFromSource(s: EditionSource): string | undefined {
  const sid = s.source_ids?.["ticker"];
  if (sid) return sid.toUpperCase();
  const url = STOCK_URL_RE.exec(s.url)?.[1];
  if (url) return url.toUpperCase();
  const pre = US_PREFIX_RE.exec(s.excerpt)?.[1];
  if (pre) return pre.toUpperCase();
  return undefined;
}

function pointsFromSource(s: EditionSource): MarketSeriesPoint[] {
  const pts: MarketSeriesPoint[] = [];
  for (const re of [DATED_USD_RE, STOOQ_WEEKLY_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s.excerpt))) {
      pts.push({ date: m[1]!, value: Number(m[2]) });
    }
  }
  const ending = s.source_ids?.["week_ending"];
  const close = Number(s.source_ids?.["weekly_close"]);
  if (ending && Number.isFinite(close)) pts.push({ date: ending, value: close });
  return pts;
}

/**
 * Build the view for the markets block: per-ticker series recovered from
 * page sources, deltas from the emitted ticker rows, the configured basket
 * diffed in for "n/a", and an honest caption.
 */
export function marketsView(page: EditionMarketsPage): MarketsView {
  const byTicker = new Map<
    string,
    { points: Map<string, number>; deltaPct?: number }
  >();
  const entry = (t: string) => {
    let e = byTicker.get(t);
    if (!e) {
      e = { points: new Map() };
      byTicker.set(t, e);
    }
    return e;
  };

  for (const s of page.sources) {
    const t = tickerFromSource(s);
    if (!t) continue;
    const e = entry(t);
    for (const p of pointsFromSource(s)) e.points.set(p.date, p.value);
  }
  for (const t of page.tickers) entry(t.ticker).deltaPct = t.change_pct;

  const data: MarketTickerDatum[] = [...byTicker.entries()].map(
    ([ticker, e]) => ({
      ticker,
      ...(e.deltaPct !== undefined ? { deltaPct: e.deltaPct } : {}),
      points: [...e.points.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, value })),
    }),
  );

  const have = new Set(byTicker.keys());
  const missing = MARKETS_BASKET.filter((t) => !have.has(t));

  const tickers: TickerView[] = [
    ...page.tickers.map((t) => ({
      ticker: t.ticker,
      close: t.close,
      delta: t.change_pct,
    })),
    ...missing.map((t) => ({ ticker: t, close: "n/a", delta: 0, na: true })),
  ];

  const pubs = [...new Set(page.sources.map((s) => s.publisher))];
  const degraded =
    page.sources.length > 0 &&
    page.sources.every((s) => s.source_ids?.["fixture"] !== undefined);
  const caption =
    `Data: ${pubs.join(" · ")}` +
    (degraded ? " — recorded series; live market feed unavailable" : "");

  return {
    data,
    missing,
    index: {
      label: page.chart.title,
      points: page.chart.series.map((p) => p.value),
      xLabels: page.chart.series.map((p) => p.date),
    },
    tickers,
    caption,
  };
}
