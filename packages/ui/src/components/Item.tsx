import { Fragment } from "react";
import { primarySource } from "../links";
import type { ItemView, SourceView } from "../types";

/** Short date for the source line: "Mon 27". */
function sourceDate(source: SourceView): string {
  const date = new Date(source.published_at);
  return Number.isNaN(date.getTime())
    ? source.published_at
    : date.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}

const SOURCE_LINK_REL = "noopener noreferrer";

/**
 * The source line as compact links (L1): up to two distinct publishers
 * linked to their URLs, `via <aggregator>` on the primary when the record
 * came through an aggregator, a "+N" for the remainder, the short date,
 * and a "discussion" link when an HN/Reddit thread is known — e.g.
 * "Google via Hacker News · Reuters · +1 · Wed 28 · discussion".
 */
function SourceLine({ item }: { item: ItemView }) {
  const primary = primarySource(item.sources);
  if (!primary) return null;

  const seen = new Set<string>();
  const distinct = item.sources.filter((s) => {
    const key = s.publisher.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const shown = distinct.slice(0, 2);
  const hidden = distinct.length - shown.length;
  const discussion = primary.discussion_url;

  return (
    <p className="w-item__source">
      {shown.map((s, i) => (
        <Fragment key={`${s.url}-${i}`}>
          {i > 0 ? " · " : null}
          <a className="w-item__source-link" href={s.url} rel={SOURCE_LINK_REL}>
            {s.publisher}
          </a>
          {s === primary && s.via !== undefined ? (
            <span className="w-item__via"> via {s.via}</span>
          ) : null}
        </Fragment>
      ))}
      {hidden > 0 ? ` · +${hidden}` : null}
      {` · ${sourceDate(primary)}`}
      {discussion !== undefined ? (
        <>
          {" · "}
          <a className="w-item__discussion" href={discussion} rel={SOURCE_LINK_REL}>
            discussion
          </a>
        </>
      ) : null}
    </p>
  );
}

/**
 * Item — headline (--t-lg, linked to the primary source) / one-liner
 * (--t-base, italic take after an em-dash) / source line (--t-sm --ink-2,
 * publisher names linked). Optional mono `number` block for
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
  const primary = primarySource(item.sources);
  return (
    <article className="w-item">
      <div className="w-item__main">
        <HeadlineTag className="w-item__headline">
          {primary ? (
            <a
              className="w-item__headline-link"
              href={primary.url}
              rel={SOURCE_LINK_REL}
            >
              {item.headline}
            </a>
          ) : (
            item.headline
          )}
        </HeadlineTag>
        <p className="w-item__one-liner">
          {item.one_liner}
          {item.take ? (
            <>
              {" — "}
              <em className="w-item__take">{item.take}</em>
            </>
          ) : null}
        </p>
        <SourceLine item={item} />
      </div>
      {item.number ? <p className="w-item__number">{item.number}</p> : null}
    </article>
  );
}
