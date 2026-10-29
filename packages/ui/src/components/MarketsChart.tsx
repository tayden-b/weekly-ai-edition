import type { ChartSeriesView, MarketSeriesPoint, MarketTickerDatum } from "../types";

/**
 * MarketsChart — weekly %Δ per ticker, drawn honestly to the data available.
 *
 * Two forms, chosen by series length:
 *  - delta form — when no per-ticker series reaches
 *    `MARKETS_LINE_MIN_POINTS` dated closes (the weekly-closes case), a
 *    sorted horizontal bar chart of each ticker's week-over-week %Δ:
 *    zero-line, --up/--down bars, ticker + % labels in mono, sorted
 *    descending. This is the honest shape for weekly-only data — a line
 *    through 2–3 points fakes a trend.
 *  - line form — when at least one per-ticker series has ≥
 *    `MARKETS_LINE_MIN_POINTS` closes (real daily data), every series is
 *    drawn indexed to %Δ from its first close, with end-of-line ticker
 *    labels (not a legend). If no per-ticker series qualifies but the
 *    emitted composite `index` does, the index is drawn alone.
 *
 * Configured basket tickers with no data render explicit "n/a" rows —
 * nothing silently disappears.
 */

/** Per-ticker series need at least this many dated closes to draw the line form. */
export const MARKETS_LINE_MIN_POINTS = 5;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const shortDate = (iso: string): string => {
  const [, m, d] = iso.split("-").map(Number);
  return m !== undefined && m >= 1 && m <= 12 && d !== undefined && d >= 1
    ? `${MONTHS[m - 1]} ${d}`
    : iso;
};

const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v}%`;

const resolveDelta = (d: MarketTickerDatum): number | undefined => {
  if (d.deltaPct !== undefined && Number.isFinite(d.deltaPct)) return d.deltaPct;
  const p = d.points;
  if (p && p.length >= 2 && p[0]!.value !== 0) {
    const first = p[0]!.value;
    const last = p[p.length - 1]!.value;
    return Math.round(((last / first - 1) * 100 + Number.EPSILON) * 10) / 10;
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// delta form — sorted horizontal bars of weekly %Δ
// ---------------------------------------------------------------------------

function DeltaForm({
  data,
  missing,
  ariaLabel,
}: {
  data: MarketTickerDatum[];
  missing: string[];
  ariaLabel: string;
}) {
  const W = 720;
  const labelW = 76;
  const chartL = labelW + 8;
  const chartR = W - 72;
  const rowH = 22;
  const padTop = 14;
  const padBottom = 6;

  const rows: { ticker: string; delta: number | undefined }[] = [];
  for (const d of data) rows.push({ ticker: d.ticker, delta: resolveDelta(d) });
  const withDelta = rows.filter((r) => r.delta !== undefined).sort((a, b) => b.delta! - a.delta!);
  const noDelta = [
    ...rows.filter((r) => r.delta === undefined).map((r) => r.ticker),
    ...missing.filter((t) => !rows.some((r) => r.ticker === t)),
  ];

  const maxAbs = Math.max(1, ...withDelta.map((r) => Math.abs(r.delta!)));
  const half = (chartR - chartL) / 2;
  const zeroX = chartL + half;
  const scale = half / maxAbs;

  const n = withDelta.length + noDelta.length;
  const H = padTop + n * rowH + padBottom;

  return (
    <figure className="w-chart w-mchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {withDelta.length > 0 ? (
          <line
            className="w-mchart__zero"
            x1={zeroX}
            x2={zeroX}
            y1={padTop - 4}
            y2={H - padBottom + 2}
          />
        ) : null}
        {withDelta.map((r, i) => {
          const y = padTop + i * rowH;
          const len = Math.max(1.5, Math.abs(r.delta!) * scale);
          const up = r.delta! > 0;
          const flat = r.delta === 0;
          const tipX = up || flat ? zeroX + (flat ? 0 : len) : zeroX - len;
          return (
            <g key={r.ticker}>
              <text className="w-mchart__ticker" x={0} y={y + 16}>
                {r.ticker}
              </text>
              <rect
                className={`w-mchart__bar${flat ? " w-mchart__bar--flat" : up ? " w-mchart__bar--up" : " w-mchart__bar--down"}`}
                x={Math.min(zeroX, tipX)}
                y={y + 5}
                width={flat ? 0 : len}
                height={12}
              />
              <text
                className="w-mchart__value"
                x={up || flat ? tipX + 6 : tipX - 6}
                y={y + 16}
                textAnchor={up || flat ? "start" : "end"}
              >
                {fmtPct(r.delta!)}
              </text>
            </g>
          );
        })}
        {noDelta.map((ticker, i) => {
          const y = padTop + (withDelta.length + i) * rowH;
          return (
            <g key={ticker}>
              <text className="w-mchart__ticker" x={0} y={y + 16}>
                {ticker}
              </text>
              <text className="w-mchart__na" x={chartL} y={y + 16}>
                n/a
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// line form — per-ticker closes indexed to %Δ from first close
// ---------------------------------------------------------------------------

const LINE_STEPS = [0.25, 0.5, 1, 2, 2.5, 5, 10, 25, 50, 100];

const niceStep = (raw: number): number => {
  for (const s of LINE_STEPS) if (s >= raw) return s;
  return LINE_STEPS[LINE_STEPS.length - 1]!;
};

/** Spread label y-positions to at least `gap` px apart, clamped to [lo, hi]. */
const spreadLabels = (ys: number[], gap: number, lo: number, hi: number): number[] => {
  const out = [...ys];
  for (let i = 1; i < out.length; i++) {
    if (out[i]! - out[i - 1]! < gap) out[i] = out[i - 1]! + gap;
  }
  if (out.length > 0 && out[out.length - 1]! > hi) {
    out[out.length - 1] = hi;
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i + 1]! - out[i]! < gap) out[i] = out[i + 1]! - gap;
    }
  }
  if (out.length > 0 && out[0]! < lo) {
    const shift = lo - out[0]!;
    for (let i = 0; i < out.length; i++) out[i]! += shift;
  }
  return out;
};

function LineForm({
  series,
  ariaLabel,
}: {
  series: { ticker: string; points: MarketSeriesPoint[] }[];
  ariaLabel: string;
}) {
  const W = 720;
  const H = 260;
  const padTop = 16;
  const padBottom = 28;
  const plotL = 10;
  const plotR = 650;
  const innerH = H - padTop - padBottom;

  // Align every series on the union of dates — tickers may report on
  // different days, so x position is by date, not by index.
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  if (dates.length === 0) return null;
  const x = (di: number) => plotL + (dates.length <= 1 ? (plotR - plotL) / 2 : (di * (plotR - plotL)) / (dates.length - 1));

  const norm = series.map((s) => {
    const byDate = new Map(s.points.map((p) => [p.date, p.value]));
    const first = s.points[0]!.value;
    const pts = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, pct: first !== 0 ? (v / first - 1) * 100 : 0 }));
    return { ticker: s.ticker, pts };
  });

  const all = norm.flatMap((s) => s.pts.map((p) => p.pct));
  const maxAbs = Math.max(0.5, ...all.map(Math.abs));
  const step = niceStep((maxAbs * 2) / 5);
  const tickMax = Math.ceil(maxAbs / step) * step;
  const y = (v: number) => padTop + innerH - ((v + tickMax) / (tickMax * 2)) * innerH;
  const ticks: number[] = [];
  for (let v = -tickMax; v <= tickMax + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);

  // Emphasis: the largest absolute mover gets --ink; the rest get the tint.
  const lastPct = (s: (typeof norm)[number]) => s.pts[s.pts.length - 1]?.pct ?? 0;
  const topTicker = [...norm].sort((a, b) => Math.abs(lastPct(b)) - Math.abs(lastPct(a)))[0]?.ticker;

  const ends = norm
    .map((s) => ({ ticker: s.ticker, y: y(lastPct(s)) }))
    .sort((a, b) => a.y - b.y);
  const labelYs = spreadLabels(
    ends.map((e) => e.y),
    13,
    padTop + 6,
    H - padBottom - 2,
  );
  const labelYByTicker = new Map(ends.map((e, i) => [e.ticker, labelYs[i]!]));

  const xLabelIdx = [0, Math.floor((dates.length - 1) / 2), dates.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <figure className="w-chart w-mchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {ticks.map((v, i) => {
          const yy = y(v);
          return (
            <g key={i}>
              <line
                className={v === 0 ? "w-mchart__zero" : "w-chart__grid"}
                x1={plotL}
                x2={plotR}
                y1={yy}
                y2={yy}
              />
              <text className="w-chart__tick" x={plotL} y={yy - 4}>
                {fmtPct(v)}
              </text>
            </g>
          );
        })}
        {norm.map((s) => {
          const top = s.ticker === topTicker;
          return (
            <g key={s.ticker}>
              <polyline
                className={`w-mchart__series${top ? " w-mchart__series--top" : ""}`}
                fill="none"
                points={s.pts.map((p) => `${x(dates.indexOf(p.date))},${y(p.pct)}`).join(" ")}
              />
              {s.pts.map((p) => (
                <circle
                  key={p.date}
                  className={`w-mchart__dot${top ? " w-mchart__dot--top" : ""}`}
                  cx={x(dates.indexOf(p.date))}
                  cy={y(p.pct)}
                  r={2}
                />
              ))}
              <text
                className="w-mchart__end"
                x={plotR + 6}
                y={(labelYByTicker.get(s.ticker) ?? padTop) + 4}
              >
                {s.ticker}
              </text>
            </g>
          );
        })}
        {xLabelIdx.map((di, i) => (
          <text
            key={i}
            className="w-chart__xlabel"
            x={x(di)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === xLabelIdx.length - 1 ? "end" : "middle"}
          >
            {shortDate(dates[di]! ?? "")}
          </text>
        ))}
      </svg>
    </figure>
  );
}

// ---------------------------------------------------------------------------

export function MarketsChart({
  data,
  index,
  missing = [],
  ariaLabel = "Markets — weekly change by ticker",
}: {
  /** Per-ticker data: weekly %Δ and/or dated closes. */
  data: MarketTickerDatum[];
  /**
   * Composite basket index (the emitted `chart.series`). Drawn as a single
   * %-normalized line only when it has ≥ MARKETS_LINE_MIN_POINTS points and
   * no per-ticker series does.
   */
  index?: ChartSeriesView;
  /** Configured basket tickers with no data — explicit "n/a" rows. */
  missing?: string[];
  ariaLabel?: string;
}) {
  const qualified = data.filter((d) => (d.points?.length ?? 0) >= MARKETS_LINE_MIN_POINTS);
  const idxAsDatum =
    qualified.length === 0 && index && index.points.length >= MARKETS_LINE_MIN_POINTS
      ? [
          {
            ticker: index.label,
            points: index.points.map((v, i) => ({
              date: index.xLabels?.[i] ?? `${i}`,
              value: v,
            })),
          },
        ]
      : [];
  const lineSeries = qualified.length > 0 ? qualified : idxAsDatum;

  if (lineSeries.length > 0) {
    return (
      <LineForm
        series={lineSeries.map((d) => ({ ticker: d.ticker, points: d.points! }))}
        ariaLabel={ariaLabel}
      />
    );
  }
  if (data.length === 0 && missing.length === 0) return null;
  return <DeltaForm data={data} missing={missing} ariaLabel={ariaLabel} />;
}
