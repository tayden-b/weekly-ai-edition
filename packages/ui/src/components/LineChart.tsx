import type { ChartSeriesView } from "../types";

/**
 * LineChart — in-house SVG (§1.5): 1.5px lines, --ink plus one tint
 * (--ink-3) for an optional second series, axis labels in mono --t-xs.
 * Server-rendered, no JS.
 */
export function LineChart({
  series,
  height = 240,
  yTicks = 4,
  ariaLabel = "Weekly performance chart",
}: {
  series: ChartSeriesView[];
  height?: number;
  yTicks?: number;
  ariaLabel?: string;
}) {
  const width = 720;
  const padX = 8;
  const padTop = 16;
  const padBottom = 28;

  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const x = (i: number, n: number) => padX + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => padTop + innerH - ((v - min) / span) * innerH;

  const first = series[0];
  const xLabels = first?.xLabels ?? [];

  return (
    <figure className="w-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        {Array.from({ length: yTicks }, (_, i) => {
          const v = min + (span * i) / (yTicks - 1);
          const yy = y(v);
          return (
            <g key={i}>
              <line
                className="w-chart__grid"
                x1={padX}
                x2={width - padX}
                y1={yy}
                y2={yy}
              />
              <text className="w-chart__tick" x={padX} y={yy - 4}>
                {v.toFixed(Math.abs(span) < 10 ? 1 : 0)}
              </text>
            </g>
          );
        })}
        {series.map((s, si) => (
          <polyline
            key={si}
            className={`w-chart__line${si > 0 ? " w-chart__line--tint" : ""}`}
            fill="none"
            points={s.points.map((p, i) => `${x(i, s.points.length)},${y(p)}`).join(" ")}
          />
        ))}
        {xLabels.map((label, i) => {
          const n = xLabels.length;
          const lx = x(i * ((first?.points.length ?? 2) - 1) / Math.max(1, n - 1), first?.points.length ?? 2);
          return (
            <text
              key={i}
              className="w-chart__xlabel"
              x={lx}
              y={height - 8}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            >
              {label}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
