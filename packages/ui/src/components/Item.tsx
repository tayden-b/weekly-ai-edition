import type { ItemView } from "../types";

/** "Outlet · Mon 27" — publisher + short date of the primary source. */
function sourceLine(item: ItemView): string {
  const primary = item.sources[0];
  if (!primary) return "";
  const date = new Date(primary.published_at);
  const formatted = Number.isNaN(date.getTime())
    ? primary.published_at
    : date.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        timeZone: "UTC",
      });
  const extra = item.sources.length - 1;
  return `${primary.publisher} · ${formatted}${extra > 0 ? ` · +${extra}` : ""}`;
}

/**
 * Item — headline (--t-lg) / one-liner (--t-base, italic take after an
 * em-dash) / source line (--t-sm --ink-2). Optional mono `number` block for
 * Performance/Funding formats (right-aligned on desktop, DESIGN §3).
 */
export function Item({
  item,
  headlineAs: HeadlineTag = "h3",
}: {
  item: ItemView;
  /** Headline level — h3 under card/section h2s, h2 under a standalone page h1. */
  headlineAs?: "h2" | "h3";
}) {
  return (
    <article className="w-item">
      <div className="w-item__main">
        <HeadlineTag className="w-item__headline">{item.headline}</HeadlineTag>
        <p className="w-item__one-liner">
          {item.one_liner}
          {item.take ? (
            <>
              {" — "}
              <em className="w-item__take">{item.take}</em>
            </>
          ) : null}
        </p>
        <p className="w-item__source">{sourceLine(item)}</p>
      </div>
      {item.number ? <p className="w-item__number">{item.number}</p> : null}
    </article>
  );
}
