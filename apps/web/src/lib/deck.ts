/**
 * V1 deck assembly (DESIGN §2.1): maps a C2 `Edition` onto the card models the
 * `/{issue}` mobile deck renders — fixed 11-page order, per-page source counts,
 * footer strings, item views. Pure; the `/{issue}` route + DeckView consume it.
 */
import type {
  Edition,
  EditionItem,
  EditionItemDeal,
  EditionItemDiscourse,
  EditionItemFunding,
  EditionItemNumbered,
  EditionPage,
  EditionSource,
} from "@weekly/schema";
import type { AgentLink, ItemView, SourceView } from "@weekly/ui";

import { dateRangeLabel } from "./fixture";

/** Page names in fixed template order (PLAN §3) — kicker + region label. */
export const DECK_PAGE_NAMES: Record<EditionPage["type"], string> = {
  cover: "Cover",
  briefing: "The Briefing",
  models: "Models & Releases",
  performance: "Performance",
  launches: "Launches",
  funding: "Funding",
  deals: "Deals",
  markets: "Markets",
  discourse: "Discourse",
  most_covered: "Most Covered",
  back_page: "Back Page",
};

/** Item types that render through the shared Item primitive. */
export type SectionItem =
  | EditionItem
  | EditionItemNumbered
  | EditionItemFunding
  | EditionItemDeal
  | EditionItemDiscourse;

function mapSource(s: EditionSource): SourceView {
  return {
    url: s.url,
    publisher: s.publisher,
    published_at: s.published_at,
    ...(s.fetched_at ? { fetched_at: s.fetched_at } : {}),
    ...(s.adapter ? { adapter: s.adapter } : {}),
  };
}

/**
 * Same mono-slot rule as the desktop renderer: explicit `number`
 * (Performance), else the money `amount` (Funding/Deals), else "undisclosed"
 * on Deals (DESIGN §3).
 */
export function mapItem(item: SectionItem, pageType: string): ItemView {
  const view: ItemView = {
    headline: item.headline,
    one_liner: item.one_liner,
    sources: item.sources.map(mapSource),
  };
  if ("take" in item && item.take) view.take = item.take;
  const number =
    ("number" in item ? item.number : undefined) ??
    ("amount" in item ? item.amount : undefined) ??
    (pageType === "deals" ? "undisclosed" : undefined);
  if (number) view.number = number;
  return view;
}

/** Label from the href basename: "/2026-w44.md" → "2026-w44.md". */
export function linkLabel(href: string): string {
  return href.split("/").filter(Boolean).pop() ?? href;
}

/**
 * "Source count for this page" (§2.1 footer): pages carrying source records
 * count them; synthesis pages (Cover, Briefing, Most Covered — derived from
 * the whole issue, PLAN §3) show the issue total the Back Page reports.
 */
export function pageSourceCount(
  page: EditionPage,
  issueTotal: number,
): number {
  if ("items" in page && page.items) {
    return page.items.reduce((n, i) => n + i.sources.length, 0);
  }
  if (page.type === "markets") return page.sources.length;
  if (page.type === "back_page") return page.sources_total;
  return issueTotal;
}

/** One card of the deck — the page plus its resolved chrome. */
export interface DeckCardModel {
  /** 0-based position; `index + 1` is the footer's "page n". */
  index: number;
  type: EditionPage["type"];
  /** Page name — the kicker and the card region's accessible name. */
  kicker: string;
  /** Accent kicker on the Cover only (§2.1). */
  kickerAccent: boolean;
  title: string;
  sourceCount: number;
  page: EditionPage;
}

export function buildDeck(edition: Edition): DeckCardModel[] {
  const backPage = edition.pages.find((p) => p.type === "back_page");
  const issueTotal =
    backPage && backPage.type === "back_page" ? backPage.sources_total : 0;
  return edition.pages.map((page, index) => ({
    index,
    type: page.type,
    kicker: DECK_PAGE_NAMES[page.type],
    kickerAccent: page.type === "cover",
    title: page.type === "cover" ? page.headline : DECK_PAGE_NAMES[page.type],
    sourceCount: pageSourceCount(page, issueTotal),
    page,
  }));
}

/** Edition meta shared by every card's masthead row. */
export function editionMeta(edition: Edition) {
  return {
    issue: edition.issue_number,
    dateRange: dateRangeLabel(edition.date_start, edition.date_end),
  };
}

/** Back-page agent links, from the edition's declared hrefs. */
export function agentLinks(edition: Edition): AgentLink[] {
  const backPage = edition.pages.find((p) => p.type === "back_page");
  if (!backPage || backPage.type !== "back_page") return [];
  return (
    [
      backPage.agent_links.markdown,
      backPage.agent_links.json,
      backPage.agent_links.llms_txt,
      backPage.agent_links.feed,
    ] as const
  ).map((href) => ({ label: linkLabel(href), href }));
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2026-10-23" → "Oct 23" — chart axis labels in mono (§1.5). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[m! - 1] ?? ""} ${d}`;
}


