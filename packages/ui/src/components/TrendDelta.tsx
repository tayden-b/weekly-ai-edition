/**
 * TrendDelta — week-over-week move next to a number (§1.1: --up/--down only
 * here). Renders arrow + % in mono; positive --up, negative --down, 0 --ink-2.
 */
export function TrendDelta({
  delta,
  suffix = "%",
}: {
  delta: number;
  suffix?: string;
}) {
  const dir = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "–";
  const sign = delta > 0 ? "+" : "";
  return (
    <span className={`w-trend w-trend--${dir}`}>
      <span className="w-trend__arrow" aria-hidden="true">
        {arrow}
      </span>
      {sign}
      {delta}
      {suffix}
    </span>
  );
}

/**
 * TrendArrow — the bare "trend arrow" of the Most Covered table (§2.2, the
 * distribute Tech Index: rank · name · stories · trend arrow). The
 * direction is known but no delta value exists, so unlike TrendDelta it
 * renders no fabricated number; the arrow alone in the trend colour, with
 * an accessible name for AT.
 */
export function TrendArrow({ trend }: { trend: "up" | "down" | "flat" }) {
  const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "–";
  return (
    <span
      className={`w-trend w-trend--${trend}`}
      role="img"
      aria-label={`Trend ${trend}`}
    >
      <span className="w-trend__arrow" aria-hidden="true">
        {arrow}
      </span>
    </span>
  );
}
