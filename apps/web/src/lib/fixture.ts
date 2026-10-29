/**
 * Loads the C2 fixture edition (fixtures/2026-w44) and maps the canonical
 * Edition schema onto the plain view props @weekly/ui primitives consume.
 * V1/V2 routes reuse these mappers.
 */
import type {
  Edition,
  EditionItem,
  EditionPage,
} from "@weekly/schema";
import type { MarketsView } from "./markets";
import { marketsView } from "./markets";
import rawJson from "../../../../fixtures/2026-w44/edition.json";

export interface FixtureSource {
  url: string;
  publisher: string;
  published_at: string;
  fetched_at?: string;
  adapter?: string;
}

export interface FixtureItem {
  headline: string;
  one_liner: string;
  take?: string;
  number?: string;
  evidence?: { source_index: number; quote: string };
  sources: FixtureSource[];
}

export interface FixturePage {
  type: string;
  kicker?: string;
  headline?: string;
  deck?: string;
  sentences?: string[];
  chart?: {
    series: { label: string; points: number[]; xLabels?: string[] }[];
    caption?: string;
  };
  /** Full markets view (chart data, n/a rows, honest caption). */
  markets?: MarketsView;
  tickers?: { ticker: string; close: number; delta: number }[];
  rows?: { rank: number; name: string; stories: number; trend: "up" | "down" | "flat" }[];
  sources?: [string, number][];
  made?: string[];
  items?: FixtureItem[];
  /** Fetched source records backing this page (page-level + per-item). */
  sourceCount?: number;
  /** Unique publishers of page-level sources — the Markets caption. */
  sourcePublishers?: string[];
}

export interface FixtureEdition {
  id: string;
  schema_version: number;
  issue: number;
  date_range: { start: string; end: string; label: string };
  pages: FixturePage[];
}

const raw = rawJson as unknown as Edition;

/** The C2 fixture as the canonical Edition (V1's deck + V2's route consume this). */
export const rawEdition: Edition = raw;

const MONTHS = [
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

export function dateRangeLabel(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  const smon = MONTHS[sm! - 1] ?? "";
  const emon = MONTHS[em! - 1] ?? "";
  return sm === em ? `${smon} ${sd}–${ed}` : `${smon} ${sd}–${emon} ${ed}`;
}

function mapItem(item: EditionItem): FixtureItem {
  const out: FixtureItem = {
    headline: item.headline,
    one_liner: item.one_liner,
    sources: item.sources,
  };
  if ("take" in item && item.take) out.take = item.take;
  if ("evidence" in item && item.evidence) out.evidence = item.evidence;
  if ("number" in item && item.number) out.number = item.number;
  // funding/deals carry the numeric claim as `amount` — display it as `number`
  if ("amount" in item && typeof item.amount === "string") {
    out.number = item.amount;
    if (item.evidence) out.evidence = item.evidence;
  }
  return out;
}

function mapPage(page: EditionPage): FixturePage {
  const out: FixturePage = { type: page.type };
  if ("items" in page && page.items) out.items = page.items.map(mapItem);
  if ("headline" in page && page.headline) out.headline = page.headline;
  if ("deck" in page && page.deck) out.deck = page.deck;
  if (page.type === "briefing") out.sentences = [...page.sentences];
  if (page.type === "markets") {
    out.chart = {
      series: [
        {
          label: page.chart.title,
          points: page.chart.series.map((p) => p.value),
          xLabels: page.chart.series.map((p) => p.date),
        },
      ],
    };
    out.tickers = page.tickers.map((t) => ({
      ticker: t.ticker,
      close: t.close,
      delta: t.change_pct,
    }));
    out.markets = marketsView(page);
  }
  if (page.type === "most_covered") {
    out.rows = page.entries.map((e, i) => ({
      rank: i + 1,
      name: e.name,
      stories: e.stories,
      trend: e.trend,
    }));
  }
  if (page.type === "back_page") {
    out.sources = page.source_counts.map(
      (c): [string, number] => [c.publisher, c.count],
    );
    out.made = [page.how_made];
    out.sourceCount = page.sources_total;
  }
  const itemSources = (out.items ?? []).reduce(
    (n, it) => n + it.sources.length,
    0,
  );
  if ("sources" in page && page.sources) {
    out.sourceCount = page.sources.length + itemSources;
    out.sourcePublishers = [
      ...new Set(page.sources.map((s) => s.publisher)),
    ];
  } else if (itemSources > 0) {
    out.sourceCount = itemSources;
  }
  return out;
}

/** Maps a canonical `Edition` (schema) onto the view props primitives consume. */
export function mapEdition(source: Edition): FixtureEdition {
  return {
    id: source.id,
    schema_version: source.schema_version,
    issue: source.issue_number,
    date_range: {
      start: source.date_start,
      end: source.date_end,
      label: dateRangeLabel(source.date_start, source.date_end),
    },
    pages: source.pages.map(mapPage),
  };
}

export const edition: FixtureEdition = mapEdition(raw);

export function pageOfType(type: string): FixturePage | undefined {
  return edition.pages.find((p) => p.type === type);
}

export function itemsOf(type: string): FixtureItem[] {
  return pageOfType(type)?.items ?? [];
}

export const SECTION_TYPES = [
  "models",
  "performance",
  "launches",
  "funding",
  "deals",
  "discourse",
] as const;

export const SECTION_TITLES: Record<string, string> = {
  models: "Models & Releases",
  performance: "Performance",
  launches: "Launches",
  funding: "Funding",
  deals: "Deals",
  discourse: "Discourse",
};
