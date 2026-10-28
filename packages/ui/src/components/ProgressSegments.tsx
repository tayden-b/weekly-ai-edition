/**
 * ProgressSegments — the deck's read indicator (DESIGN §2.1): N hairline
 * segments, filled = read, current at --ink, rest at --rule.
 * Fill animates 200ms linear (§1.4); reduced-motion cuts it.
 */
export function ProgressSegments({
  total,
  current,
  label = "Issue progress",
}: {
  /** Total pages in the issue. */
  total: number;
  /** Current page, 1-based — it and all before it render filled. */
  current: number;
  label?: string;
}) {
  return (
    <div
      className="w-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`w-progress__seg${i < current ? " w-progress__seg--filled" : ""}`}
        />
      ))}
    </div>
  );
}
