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
