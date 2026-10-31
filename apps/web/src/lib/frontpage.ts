/**
 * V2 page assembly (DESIGN §2.2): maps a C2 `Edition` onto the props the
 * @weekly/ui `FrontPage` + the sticky-bar chrome consume — fixed block order,
 * section bands, markets caption, back-page links. Pure; the `/{issue}` route
 * calls it server-side.
 */
import { discussionUrl } from "@weekly/schema";
import type {
  Edition,
  EditionItem,
  EditionItemDeal,
  EditionItemDiscourse,
  EditionItemFunding,
  EditionItemNumbered,
  EditionSource,
} from "@weekly/schema";
import type {
  AgentLink,
  CoveredRowView,
  FrontPageBackPage,
  FrontPageCover,
  FrontPageMarkets,
  FrontPageSection,
  IssueMetaView,
  ItemView,
  SourceView,
} from "@weekly/ui";

import { dateRangeLabel } from "./fixture";
import { marketsView } from "./markets";
import { site } from "./site";

/** Sticky-bar + j/k jump targets, in page order (§2.2). */
export interface NavSection {
  id: string;
  title: string;
}

const SECTION_BANDS: NavSection[] = [
  { id: "models", title: "Models & Releases" },
  { id: "performance", title: "Performance" },
  { id: "launches", title: "Launches" },
  { id: "funding", title: "Funding" },
  { id: "deals", title: "Deals" },
  { id: "discourse", title: "Discourse" },
];

export const NAV_SECTIONS: NavSection[] = [
  ...SECTION_BANDS,
  { id: "markets", title: "Markets" },
  { id: "most-covered", title: "Most Covered" },
  { id: "back-page", title: "Back Page" },
];

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

function mapSource(s: EditionSource): SourceView {
  const discussion_url = discussionUrl(s);
  return {
    url: s.url,
    publisher: s.publisher,
    published_at: s.published_at,
    ...(s.via ? { via: s.via } : {}),
    ...(discussion_url ? { discussion_url } : {}),
    ...(s.fetched_at ? { fetched_at: s.fetched_at } : {}),
    ...(s.adapter ? { adapter: s.adapter } : {}),
  };
}

type SectionItem =
  | EditionItem
  | EditionItemNumbered
  | EditionItemFunding
  | EditionItemDeal
  | EditionItemDiscourse;

function mapItem(item: SectionItem, pageType: string): ItemView {
  const view: ItemView = {
    headline: item.headline,
    one_liner: item.one_liner,
    sources: item.sources.map(mapSource),
  };
  if ("take" in item && item.take) view.take = item.take;
  // The mono slot: explicit number (Performance), else the money amount
  // (Funding/Deals), else "undisclosed" on Deals (DESIGN §3).
  const number =
    ("number" in item ? item.number : undefined) ??
    ("amount" in item ? item.amount : undefined) ??
    (pageType === "deals" ? "undisclosed" : undefined);
  if (number) view.number = number;
  return view;
}

/** Label from the href basename: "/2026-w44.md" → "2026-w44.md". */
function linkLabel(href: string): string {
  return href.split("/").filter(Boolean).pop() ?? href;
}

export interface FrontPageView {
  meta: IssueMetaView;
  cover: FrontPageCover;
  briefing: string[];
  sections: FrontPageSection[];
  markets?: FrontPageMarkets;
  mostCovered?: CoveredRowView[];
  backPage: FrontPageBackPage;
  navSections: NavSection[];
}

export function assembleFrontPage(ed: Edition): FrontPageView {
  // Schema tuple order: cover, briefing, models, performance, launches,
  // funding, deals, markets, discourse, most_covered, back_page. §2.2 render
  // order is the same except discourse renders inside the band block above
  // markets — the bands come first, then markets/most-covered/back-page.
  const cover = ed.pages[0];
  const briefing = ed.pages[1];
  const markets = ed.pages[7];
  const mostCovered = ed.pages[9];
  const backPage = ed.pages[10];

  const byType = new Map<string, Edition["pages"][number]>(
    ed.pages.map((p) => [p.type, p]),
  );
  // Dropped pages (empty content array, PLAN §3) render no band and no nav
  // entry; their tuple position is kept so page numbers stay stable.
  const sections: FrontPageSection[] = SECTION_BANDS.flatMap(
    ({ id, title }) => {
      const page = byType.get(id);
      const items =
        page && "items" in page
          ? (page.items as SectionItem[]).map((i) => mapItem(i, id))
          : [];
      return items.length === 0 ? [] : [{ id, title, items }];
    },
  );
  const marketsDropped = markets.tickers.length === 0;
  const mostCoveredDropped = mostCovered.entries.length === 0;
  const navSections = NAV_SECTIONS.filter(({ id }) => {
    if (id === "markets") return !marketsDropped;
    if (id === "most-covered") return !mostCoveredDropped;
    if (id === "back-page") return true;
    return sections.some((s) => s.id === id);
  });

  const view: FrontPageView = {
    meta: {
      issue: ed.issue_number,
      dateRange: dateRangeLabel(ed.date_start, ed.date_end),
    },
    cover: {
      kicker: `№ ${ed.issue_number}`,
      headline: cover.headline,
      deck: cover.deck ?? "",
      ...(cover.url ? { url: cover.url } : {}),
      ...(cover.image ? { src: `/${cover.image}`, alt: "" } : {}),
    },
    briefing: [...briefing.sentences],
    sections,
    ...(mostCoveredDropped
      ? {}
      : {
          mostCovered: mostCovered.entries.map(
            (e, i): CoveredRowView => ({
              rank: i + 1,
              name: e.name,
              stories: e.stories,
              trend: e.trend,
            }),
          ),
        }),
    backPage: {
      sources: backPage.source_counts.map(
        (c): [string, number] => [c.publisher, c.count],
      ),
      madeLines: [backPage.how_made],
      issueId: ed.id,
      links: (
        [
          backPage.agent_links.markdown,
          backPage.agent_links.json,
          backPage.agent_links.llms_txt,
          backPage.agent_links.feed,
        ] as const
      ).map((href): AgentLink => ({ label: linkLabel(href), href })),
      copyright: `© ${ed.date_end.slice(0, 4)} ${site.name}.${
        backPage.colophon ? ` ${backPage.colophon}` : ""
      }`,
    },
    navSections,
  };

  if (!marketsDropped) {
    const mv = marketsView(markets);
    view.markets = {
    data: mv.data,
    missing: mv.missing,
    index: {
      label: mv.index.label,
      points: mv.index.points,
      ...(mv.index.xLabels
        ? { xLabels: mv.index.xLabels.map(shortDate) }
        : {}),
    },
      tickers: mv.tickers,
      caption: mv.caption,
    };
  }

  return view;
}


