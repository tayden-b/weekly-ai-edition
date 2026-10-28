/**
 * GENERATED — do not edit by hand.
 * Source: packages/schema/edition.schema.json
 * Regenerate: pnpm schema:types
 */

/**
 * ISO-ish week id used for routes, file names, and edition ids: `2026-w44`.
 */
export type EditionWeekId = string
export type Slug = string

/**
 * The weekly edition object — the single contract between pipeline, viewers, and CI (PLAN §3 template, §4 agent twin, §5.3 provenance gates, DESIGN §3 per-page rules). `pages` is a fixed-order tuple of exactly 11 pages. Item `companies` are slug strings; membership in `config/companies.yaml` is checked by the verify stage (P7), not by this schema — the schema only constrains the slug shape.
 */
export interface Edition {
id: EditionWeekId
schema_version: 1
/**
 * Sequential issue count shown as the cover's №.
 */
issue_number: number
/**
 * Saturday of the covered week (YYYY-MM-DD).
 */
date_start: string
/**
 * Friday of the covered week (YYYY-MM-DD).
 */
date_end: string
/**
 * Fixed template order (PLAN §3): cover, briefing, models, performance, launches, funding, deals, markets, discourse, most_covered, back_page.
 * 
 * @minItems 11
 * @maxItems 11
 */
pages: [EditionCoverPage, EditionBriefingPage, EditionModelsPage, EditionPerformancePage, EditionLaunchesPage, EditionFundingPage, EditionDealsPage, EditionMarketsPage, EditionDiscoursePage, EditionMostCoveredPage, EditionBackPage]
}
export interface EditionCoverPage {
type: "cover"
/**
 * The week's single most important item.
 */
headline: string
/**
 * Optional standfirst under the headline.
 */
deck?: string
/**
 * Cover image path, e.g. editions/2026-w44/cover.jpg (typographic-only issues may omit).
 */
image?: string
}
export interface EditionBriefingPage {
type: "briefing"
/**
 * 5–7 sentences (DESIGN §3); no links inside.
 * 
 * @minItems 5
 * @maxItems 7
 */
sentences: [string, string, string, string, string]|[string, string, string, string, string, string]|[string, string, string, string, string, string, string]
}
export interface EditionModelsPage {
type: "models"
/**
 * @minItems 1
 * @maxItems 6
 */
items: [EditionItem]|[EditionItem, EditionItem]|[EditionItem, EditionItem, EditionItem]|[EditionItem, EditionItem, EditionItem, EditionItem]|[EditionItem, EditionItem, EditionItem, EditionItem, EditionItem]|[EditionItem, EditionItem, EditionItem, EditionItem, EditionItem, EditionItem]
}
/**
 * Standard page item (models, launches).
 */
export interface EditionItem {
headline: string
one_liner: string
/**
 * Optional italic take after an em-dash.
 */
take?: string
/**
 * Optional mono number (version, score, delta).
 */
number?: string
companies?: Slug[]
/**
 * @minItems 1
 */
sources: [EditionSource, ...(EditionSource)[]]
evidence?: EditionEvidence
}
/**
 * A fetched, verified source record (PLAN §5.1). `excerpt` (≤300 chars) is the stored raw excerpt the evidence quotes are re-checked against (§5.3). `adapter` is the adapter id from `config/sources.yaml` (C5). `url` here is the canonical URL — the field C5's `RawItem.canonical_url` maps onto.
 */
export interface EditionSource {
url: string
publisher: string
published_at: string
fetched_at: string
adapter: Slug
excerpt: string
/**
 * Source-specific ids (HN objectID, EDGAR accession, PH post id) for provenance.
 */
source_ids?: {
[k: string]: string | undefined
}
}
/**
 * Required on every numeric claim on money/performance/markets pages (§5.3). `source_index` indexes the owning item's `sources` array (or the markets page's `sources`); `quote` must appear verbatim in that source's `excerpt` — bounds and quote containment are checked by `validateEdition`'s semantic pass and re-checked by P7.
 */
export interface EditionEvidence {
source_index: number
quote: string
}
export interface EditionPerformancePage {
type: "performance"
/**
 * @minItems 1
 * @maxItems 5
 */
items: [EditionItemNumbered]|[EditionItemNumbered, EditionItemNumbered]|[EditionItemNumbered, EditionItemNumbered, EditionItemNumbered]|[EditionItemNumbered, EditionItemNumbered, EditionItemNumbered, EditionItemNumbered]|[EditionItemNumbered, EditionItemNumbered, EditionItemNumbered, EditionItemNumbered, EditionItemNumbered]
}
/**
 * Performance item — always carries a number in mono, and that number always carries evidence (DESIGN §3 + PLAN §5.3).
 */
export interface EditionItemNumbered {
headline: string
one_liner: string
take?: string
number: string
companies?: Slug[]
/**
 * @minItems 1
 */
sources: [EditionSource, ...(EditionSource)[]]
evidence: EditionEvidence
}
export interface EditionLaunchesPage {
type: "launches"
/**
 * @minItems 1
 * @maxItems 6
 */
items: [EditionItem]|[EditionItem, EditionItem]|[EditionItem, EditionItem, EditionItem]|[EditionItem, EditionItem, EditionItem, EditionItem]|[EditionItem, EditionItem, EditionItem, EditionItem, EditionItem]|[EditionItem, EditionItem, EditionItem, EditionItem, EditionItem, EditionItem]
}
export interface EditionFundingPage {
type: "funding"
/**
 * @minItems 1
 * @maxItems 6
 */
items: [EditionItemFunding]|[EditionItemFunding, EditionItemFunding]|[EditionItemFunding, EditionItemFunding, EditionItemFunding]|[EditionItemFunding, EditionItemFunding, EditionItemFunding, EditionItemFunding]|[EditionItemFunding, EditionItemFunding, EditionItemFunding, EditionItemFunding, EditionItemFunding]|[EditionItemFunding, EditionItemFunding, EditionItemFunding, EditionItemFunding, EditionItemFunding, EditionItemFunding]
}
/**
 * Funding item — `Company raised $Xm Stage led by Lead`; the amount is a numeric claim so `evidence` is required (§5.3). IPOs/offerings carry the disclosed figure in `number`.
 */
export interface EditionItemFunding {
headline: string
one_liner: string
take?: string
/**
 * Mono amount, e.g. "$1.5B" — or the disclosed figure for IPOs/offerings.
 */
amount: string
/**
 * e.g. "Series E", "seed", "IPO".
 */
stage?: string
/**
 * Lead investor(s).
 */
lead?: string
number?: string
companies?: Slug[]
/**
 * @minItems 1
 */
sources: [EditionSource, ...(EditionSource)[]]
evidence: EditionEvidence
}
export interface EditionDealsPage {
type: "deals"
/**
 * @minItems 1
 * @maxItems 4
 */
items: [EditionItemDeal]|[EditionItemDeal, EditionItemDeal]|[EditionItemDeal, EditionItemDeal, EditionItemDeal]|[EditionItemDeal, EditionItemDeal, EditionItemDeal, EditionItemDeal]
}
/**
 * Deals item — acquirer → target; `amount` when public, otherwise omitted (the renderer writes "undisclosed"). A present `amount` requires `evidence` (§5.3).
 */
export interface EditionItemDeal {
headline: string
one_liner: string
take?: string
acquirer: string
target: string
amount?: string
number?: string
companies?: Slug[]
/**
 * @minItems 1
 */
sources: [EditionSource, ...(EditionSource)[]]
evidence?: EditionEvidence
}
/**
 * 1 chart + ≤10 tickers (DESIGN §3). `sources` lives at page level because the whole page is one dataset; every ticker's numbers still carry `evidence` keyed into it.
 */
export interface EditionMarketsPage {
type: "markets"
/**
 * @minItems 1
 */
sources: [EditionSource, ...(EditionSource)[]]
chart: EditionMarketsChart
/**
 * @minItems 1
 * @maxItems 10
 */
tickers: [EditionTicker]|[EditionTicker, EditionTicker]|[EditionTicker, EditionTicker, EditionTicker]|[EditionTicker, EditionTicker, EditionTicker, EditionTicker]|[EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker]|[EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker]|[EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker]|[EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker]|[EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker]|[EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker, EditionTicker]
}
export interface EditionMarketsChart {
title: string
unit: ("index" | "percent" | "usd")
/**
 * @minItems 2
 */
series: [EditionChartPoint, EditionChartPoint, ...(EditionChartPoint)[]]
}
export interface EditionChartPoint {
date: string
value: number
}
export interface EditionTicker {
ticker: string
name: string
close: number
/**
 * Week-over-week % change.
 */
change_pct: number
direction: ("up" | "down" | "flat")
evidence: EditionEvidence
}
export interface EditionDiscoursePage {
type: "discourse"
/**
 * @minItems 1
 * @maxItems 3
 */
items: [EditionItemDiscourse]|[EditionItemDiscourse, EditionItemDiscourse]|[EditionItemDiscourse, EditionItemDiscourse, EditionItemDiscourse]
}
/**
 * Discourse item — framed as a question, ≥2 sources from ≥2 distinct publishers (sources count is schema-enforced; publisher distinctness is a verify-time rule).
 */
export interface EditionItemDiscourse {
/**
 * Framed as a question (DESIGN §3).
 */
headline: string
one_liner: string
take?: string
companies?: Slug[]
/**
 * @minItems 2
 */
sources: [EditionSource, EditionSource, ...(EditionSource)[]]
evidence?: EditionEvidence
}
/**
 * Derived from our own tagged items only — entries are ordered by story count (position = rank).
 */
export interface EditionMostCoveredPage {
type: "most_covered"
/**
 * @minItems 1
 * @maxItems 5
 */
entries: [EditionMostCoveredEntry]|[EditionMostCoveredEntry, EditionMostCoveredEntry]|[EditionMostCoveredEntry, EditionMostCoveredEntry, EditionMostCoveredEntry]|[EditionMostCoveredEntry, EditionMostCoveredEntry, EditionMostCoveredEntry, EditionMostCoveredEntry]|[EditionMostCoveredEntry, EditionMostCoveredEntry, EditionMostCoveredEntry, EditionMostCoveredEntry, EditionMostCoveredEntry]
}
export interface EditionMostCoveredEntry {
company: Slug
name: string
stories: number
trend: ("up" | "down" | "flat")
}
/**
 * Agent-access block always present (DESIGN §3).
 */
export interface EditionBackPage {
type: "back_page"
sources_total: number
/**
 * Count by outlet, for the mono table.
 */
source_counts: EditionSourceCount[]
/**
 * Three-line 'how this issue was made' copy.
 */
how_made: string
agent_links: EditionAgentLinks
colophon?: string
}
export interface EditionSourceCount {
publisher: string
count: number
}
export interface EditionAgentLinks {
/**
 * e.g. /2026-w44.md
 */
markdown: string
/**
 * e.g. /2026-w44.json
 */
json: string
llms_txt: string
feed: string
}
