/**
 * V3 page helpers — names, titles and OG copy for the per-page routes
 * (`/{issue}/{n}`). Pure functions over the editions on disk; the routes and
 * metadata image generators share them.
 */
import { pageDropped } from "@weekly/schema";

import { editionView, getEdition as getCanonicalEdition, listEditions } from "./editions";
import type { FixtureEdition, FixturePage } from "./fixture";

/** One edition by week id, mapped to view props, or undefined. */
export function getEdition(issueId: string): FixtureEdition | undefined {
  const canonical = getCanonicalEdition(issueId.toLowerCase());
  return canonical ? editionView(canonical) : undefined;
}

/** Static params for `/{issue}/{n}`: every rendered page of every edition —
 * dropped pages (empty content array, PLAN §3) get no route. */
export function allPageParams(): { issue: string; page: string }[] {
  return listEditions().flatMap((ed) =>
    ed.pages.flatMap((p, i) =>
      pageDropped(p) ? [] : [{ issue: ed.id, page: String(i + 1) }],
    ),
  );
}

/**
 * Display names per template page (PLAN §3 / DESIGN §2) — used for the
 * standalone page's kicker/title and for prev/next link labels.
 */
export const PAGE_META: Record<string, { kicker: string; title: string }> = {
  cover: { kicker: "Cover", title: "Cover" },
  briefing: { kicker: "Briefing", title: "The Briefing" },
  models: { kicker: "Models & Releases", title: "Models & Releases" },
  performance: { kicker: "Performance", title: "Performance" },
  launches: { kicker: "Launches", title: "Launches" },
  funding: { kicker: "Funding", title: "Funding" },
  deals: { kicker: "Deals", title: "Deals" },
  markets: { kicker: "Markets", title: "Markets" },
  discourse: { kicker: "Discourse", title: "Discourse" },
  most_covered: { kicker: "Most Covered", title: "Most Covered" },
  back_page: { kicker: "Back Page", title: "Back Page" },
};

export function pageKicker(page: FixturePage): string {
  return PAGE_META[page.type]?.kicker ?? page.type;
}

/** The standalone card's title: the cover's own headline, else the page name. */
export function pageTitle(page: FixturePage): string {
  if (page.type === "cover" && page.headline) return page.headline;
  return PAGE_META[page.type]?.title ?? page.type;
}

/** Page-number route param → 1-based index, or null. */
export function parsePageParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

export function pageHref(editionId: string, n: number): string {
  return `/${editionId}/${n}`;
}

/** OG card fields (DESIGN §1.5.5): page kicker + the page's lead content. */
export function ogFields(
  page: FixturePage,
): { kicker: string; headline: string } {
  const kicker = pageKicker(page);
  const headline =
    page.type === "cover"
      ? (page.headline ?? kicker)
      : page.type === "briefing"
        ? (page.sentences?.[0] ?? pageTitle(page))
        : page.type === "markets"
          ? (page.chart?.series[0]?.label ?? pageTitle(page))
          : page.type === "most_covered"
            ? topCoveredLine(page)
            : page.type === "back_page"
              ? `${page.sourceCount ?? 0} sources this week`
              : (page.items?.[0]?.headline ?? pageTitle(page));
  return { kicker, headline };
}

function topCoveredLine(page: FixturePage): string {
  const top = page.rows?.[0];
  if (!top) return pageTitle(page);
  return `${top.name} · ${top.stories} ${top.stories === 1 ? "story" : "stories"}`;
}
