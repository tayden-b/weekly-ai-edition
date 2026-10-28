/**
 * Plain prop/view types for the primitives — derived from the C2 edition
 * contract (PLAN §3 fixed template, C2 brief field names: headline,
 * one_liner, take, number, sources[], evidence{source_index,quote}).
 * Components never fetch; apps/web adapts `Edition` → these shapes.
 */

export interface SourceView {
  url: string;
  publisher: string;
  published_at: string;
  fetched_at?: string;
  adapter?: string;
}

export interface ItemView {
  headline: string;
  one_liner: string;
  /** Optional italic take rendered after an em-dash, same size as the one-liner. */
  take?: string;
  /** Number carried by the item (mono); Performance/Funding format lines. */
  number?: string;
  sources: SourceView[];
}

export interface IssueMetaView {
  /** Issue number, e.g. 44 → renders "№ 44". */
  issue: number;
  /** Human date range, e.g. "Oct 25–31". */
  dateRange: string;
}

export interface TickerView {
  ticker: string;
  close: number | string;
  /** Week-over-week % delta; sign chooses --up/--down. */
  delta: number;
}

export interface ChartSeriesView {
  label: string;
  /** Close values oldest → newest. */
  points: number[];
  /** Axis tick labels for first/mid/last point. */
  xLabels?: string[];
}

export interface CoveredRowView {
  rank: number;
  name: string;
  /** Logo URL — official mark, rendered ≤24px monochrome ink; optional. */
  logoUrl?: string;
  stories: number;
  /** Week-over-week trend. */
  trend: "up" | "down" | "flat";
}

export interface AgentLink {
  label: string;
  href: string;
}
