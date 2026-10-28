import type { IssueMetaView } from "../types";
import { IssueMeta } from "./IssueMeta";

/**
 * Masthead — the wordmark is the brand (DESIGN §1.2, §7.2).
 * `band`: front-page band — wordmark at --t-2xl centred, tagline, meta row,
 * 2px rule under. `compact`: the deck's masthead row — wordmark --t-xs left,
 * issue meta right.
 */
export function Masthead({
  siteName,
  tagline,
  meta,
  variant = "band",
}: {
  siteName: string;
  tagline?: string;
  meta?: IssueMetaView;
  variant?: "band" | "compact";
}) {
  if (variant === "compact") {
    return (
      <header className="w-masthead w-masthead--compact">
        <p className="w-masthead__wordmark w-masthead__wordmark--compact">
          {siteName}
        </p>
        {meta ? <IssueMeta meta={meta} /> : null}
      </header>
    );
  }
  return (
    <header className="w-masthead w-masthead--band">
      <div className="w-masthead__top">
        <p className="w-masthead__dateline">
          {meta ? `№ ${meta.issue} · ${meta.dateRange}` : null}
        </p>
        <nav className="w-masthead__nav">
          <a href="/issues">Issues</a>
          <a href="/llms.txt">For agents</a>
        </nav>
      </div>
      <h1 className="w-masthead__wordmark">{siteName}</h1>
      {tagline ? <p className="w-masthead__tagline">{tagline}</p> : null}
      <hr className="w-rule w-rule--section" />
    </header>
  );
}
