/**
 * Loads the C2 fixture edition (fixtures/2026-w44) and maps it onto the
 * plain view props @weekly/ui primitives consume. V1/V2 routes reuse these
 * mappers once the canonical schema lands.
 */
import raw from "../../../../fixtures/2026-w44/edition.json";

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
  tickers?: { ticker: string; close: number; delta: number }[];
  rows?: { rank: number; name: string; stories: number; trend: "up" | "down" | "flat" }[];
  sources?: [string, number][];
  made?: string[];
  items?: FixtureItem[];
}

export interface FixtureEdition {
  id: string;
  schema_version: number;
  issue: number;
  date_range: { start: string; end: string; label: string };
  pages: FixturePage[];
}

export const edition: FixtureEdition = raw as FixtureEdition;

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
