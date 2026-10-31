/**
 * The `emit` stage (PLAN §5.2, last shaping step before `validate`):
 * drafted clusters → the 11-page `Edition` object.
 *
 * Emitted pages:
 *  - item pages (models, performance, launches, funding, deals, discourse):
 *    ranked, classified, extracted, drafted clusters — real-cache items
 *    first, fixture-pool items only to fill a page the real pool leaves
 *    empty (I1's "fixture data may be extended with cached real items").
 *    Page caps are DESIGN §3 via `PAGE_ITEM_CAPS`.
 *  - markets: one ticker row per markets-classified cluster; `close` comes
 *    from extraction (evidence-carrying), `change_pct` is DERIVED in emit —
 *    like P5's `amount_usd`, a computed-from-sources number, so it never
 *    needs its own quote. The page-level `sources[]` is the union of the
 *    emitted clusters' members; the chart is a deterministic equal-weight
 *    basket index built from `YYYY-MM-DD USD N` bars inside the excerpts.
 *  - cover: the top-ranked emitted cluster (real pool only).
 *  - briefing: the P6 briefing sentences, verbatim.
 *  - most_covered: company story-counts across emitted items; `trend`
 *    compares second-half vs first-half item counts inside the week —
 *    deterministic, since no prior edition exists to diff against.
 *  - back_page: source-count table over emitted items + markets sources.
 *
 * The stage is pure: same drafted clusters always emit the same edition.
 */

import { primarySource } from "@weekly/schema";
import type {
  Edition,
  EditionEvidence,
  EditionItem,
  EditionItemDeal,
  EditionItemDiscourse,
  EditionItemFunding,
  EditionItemNumbered,
  EditionMarketsPage,
  EditionSource,
  EditionTicker,
} from "@weekly/schema";

import type { CompanyEntry, MarketsConfig } from "../config.js";
import { publisherKey } from "./normalize.js";
import { clusterSources, type ItemCluster } from "./dedupe.js";
import type { ExtractedField } from "./extract.js";
import {
  PAGE_ITEM_CAPS,
  splitSentences,
  type BriefingDraft,
  type DraftedCluster,
} from "./draft.js";

// ---------------------------------------------------------------------------
// Pools — which ingest pool a cluster's records came from
// ---------------------------------------------------------------------------

/**
 * `source_ids.fixture` marks items synthesized from a committed fixture
 * edition (`fixtures/<week>/edition.json`). The build stamps it on the
 * synthesized `RawItem`s; it round-trips into the emitted
 * `EditionSource.source_ids`, so the edition itself records which of its
 * sources were fixture-derived.
 */
export const FIXTURE_SOURCE_ID_KEY = "fixture";

/** Real-pool = at least one member that did not come from the fixture. */
export function isFixtureCluster(cluster: ItemCluster): boolean {
  return cluster.items.every((i) => i.source_ids[FIXTURE_SOURCE_ID_KEY] !== undefined);
}

// ---------------------------------------------------------------------------
// Options + result
// ---------------------------------------------------------------------------

export interface EmitOptions {
  /** Edition week id, e.g. `2026-w44`. */
  id: string;
  /** Sequential issue count (cover's №). */
  issue_number: number;
  /** Saturday of the covered week (YYYY-MM-DD). */
  date_start: string;
  /** Friday of the covered week (YYYY-MM-DD). */
  date_end: string;
  /** `config/companies.yaml` — company display names + ticker lookup. */
  companies: readonly CompanyEntry[];
  /** `config/markets.json` — basket display names for ticker rows. */
  markets?: MarketsConfig | undefined;
  /** Extra colophon line under back_page. */
  colophon?: string | undefined;
}

/** What one emitted page item (or markets ticker) was built from. */
export interface EmittedItemRef {
  /** Verify-pool id — `<page>-<index>` or `markets-<index>`. */
  ref_id: string;
  /** The dedupe cluster id it was emitted from. */
  cluster_id: string;
  /** The page it landed on. */
  page: string;
}

export interface EmitResult {
  edition: Edition;
  /**
   * Emitted verify-ref → cluster id, for translating the briefing's
   * cluster-id supports into the positional ids P7 checks. In page order.
   */
  emitted: EmittedItemRef[];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function firstEvidence(fields: Partial<Record<string, ExtractedField>>): EditionEvidence | undefined {
  for (const f of Object.values(fields)) {
    if (f?.evidence !== undefined) return { ...f.evidence };
  }
  return undefined;
}

/** Fallback one-liner when the draft produced none — the excerpt's own
 * first sentence, so no words are invented (one-liner ≠ headline). */
function fallbackOneLiner(cluster: ItemCluster): string {
  const excerpt = cluster.item.excerpt.trim();
  if (excerpt === "") return cluster.item.headline;
  const first = splitSentences(excerpt)[0] ?? excerpt;
  return first.length <= 140 ? first : `${first.slice(0, 137).trimEnd()}…`;
}

/** Feed titles can carry markdown emphasis ("**bold**") — headlines are
 * plain text, so strip the markers rather than render them literally. */
function stripHeadlineMarkup(headline: string): string {
  return headline.replace(/\*\*/g, "").replace(/__/g, "");
}

/** The cluster's members as `EditionSource`s — always ≥1 for an emitted
 * item, hence the non-empty tuple the schema wants. */
function editionSources(cluster: ItemCluster): [EditionSource, ...EditionSource[]] {
  const out = clusterSources(cluster).map((s) => ({ ...s }));
  return out as [EditionSource, ...EditionSource[]];
}

// ---------------------------------------------------------------------------
// Item-page emission
// ---------------------------------------------------------------------------

const DISCOURSE_MIN_PUBLISHERS = 2;

interface PageItem<T extends DraftedCluster = DraftedCluster> {
  item: EditionItem | EditionItemNumbered | EditionItemFunding | EditionItemDeal | EditionItemDiscourse;
  cluster: T;
}

/** The rank score a cluster carried in, when it survives the generic chain. */
function rankScore(cluster: ItemCluster): number {
  const s = (cluster as { score?: number }).score;
  return typeof s === "number" ? s : 0;
}

/**
 * One item-bearing page: classified+drafted clusters on `page`, real pool
 * first then fixture pool, capped at DESIGN §3. Returns emitted items in
 * page order — each mapped to the cluster that produced it.
 */
function emitItemPage<T extends DraftedCluster>(
  page: string,
  clusters: readonly T[],
): PageItem<T>[] {
  const cap = PAGE_ITEM_CAPS[page as keyof typeof PAGE_ITEM_CAPS] ?? 0;
  const candidates = clusters.filter((c) => c.classification.page === page);
  // Real-cache items first, in rank order; fixture-pool items backfill
  // whatever the cap leaves open (I1: fixture extended by real items).
  const real = candidates.filter((c) => !isFixtureCluster(c));
  const fixture = candidates.filter((c) => isFixtureCluster(c));
  const pool = [...real, ...fixture];
  const out: PageItem<T>[] = [];
  const seenHeadline = new Set<string>();
  // i116: deals-page emit-time guard. Title dedupe (P1) misses same-deal
  // announcements whose headlines share no tokens ("approves … acquisition"
  // vs "to buy … deal"), so one transaction may occupy two page slots. A
  // later cluster is the same deal when its normalized (acquirer,target)
  // pair matches a survivor's, or its company-slug set (≥2 slugs, which
  // absorbs spellings like "Amazon Leo" vs "Amazon") equals one. The
  // survivor keeps the slot and inherits the dup's distinct sources.
  const dealSurvivor = new Map<string, number>();
  // i163: the same guard for models — one release covered by disjoint
  // outlet headlines survives as separate clusters. A later cluster is
  // the same release when its extracted `version` matches a survivor's
  // normalized version AND the company-slug sets overlap; a versionless
  // cluster yields no keys and never merges.
  const modelSurvivor = new Map<string, number>();

  for (const cluster of pool) {
    if (out.length >= cap) break;
    const item = buildPageItem(page, cluster);
    if (item === undefined) continue;
    const key = item.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenHeadline.has(key)) continue;
    if (page === "deals") {
      const keys = dealClusterKeys(cluster);
      const survivorAt = keys.map((k) => dealSurvivor.get(k)).find((i) => i !== undefined);
      if (survivorAt !== undefined) {
        mergeItemSources(out[survivorAt]!.item as EditionItemDeal, cluster);
        continue;
      }
      for (const k of keys) dealSurvivor.set(k, out.length);
    }
    if (page === "models") {
      const keys = modelClusterKeys(cluster);
      const survivorAt = keys.map((k) => modelSurvivor.get(k)).find((i) => i !== undefined);
      if (survivorAt !== undefined) {
        mergeItemSources(out[survivorAt]!.item as EditionItemNumbered, cluster);
        continue;
      }
      for (const k of keys) modelSurvivor.set(k, out.length);
    }
    seenHeadline.add(key);
    out.push({ item, cluster });
  }
  return out;
}

/** Normalize a deal party name for key comparison. */
function dealNorm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** The dedupe keys a deals cluster answers to: its normalized
 * (acquirer,target) extraction pair, and its sorted company-slug set when it
 * names ≥2 companies (a one-slug set can't pin down a two-party deal). */
function dealClusterKeys(cluster: DraftedCluster): string[] {
  const keys: string[] = [];
  const f = cluster.extraction?.fields ?? {};
  const acquirer = f.acquirer?.value;
  const target = f.target?.value;
  if (typeof acquirer === "string" && typeof target === "string") {
    keys.push(`pair:${dealNorm(acquirer)}|${dealNorm(target)}`);
  }
  const slugs = [...cluster.classification.company_slugs].sort();
  if (slugs.length >= 2) keys.push(`slugs:${slugs.join("|")}`);
  return keys;
}

/** The dedupe keys a models cluster answers to: `model:<slug>|<norm-version>`
 * for each classified company slug — so matching needs the same normalized
 * version AND at least one shared slug. No version or no slugs → no keys →
 * the cluster can neither merge nor be merged into. */
function modelClusterKeys(cluster: DraftedCluster): string[] {
  const version = cluster.extraction?.fields["version"]?.value;
  if (version === undefined || version === null) return [];
  const norm = dealNorm(String(version));
  if (norm === "") return [];
  return cluster.classification.company_slugs.map((slug) => `model:${slug}|${norm}`);
}

/** Fold a dropped same-story cluster's distinct sources (by URL) and company
 * slugs into the surviving item — the slot collapses, the links stay. */
function mergeItemSources(
  item: { sources: EditionSource[]; companies?: string[] },
  cluster: DraftedCluster,
): void {
  const have = new Set(item.sources.map((s) => s.url));
  for (const s of editionSources(cluster)) {
    if (!have.has(s.url)) item.sources.push(s);
  }
  const slugs = new Set(item.companies ?? []);
  for (const slug of cluster.classification.company_slugs) {
    if (!slugs.has(slug)) (item.companies ??= []).push(slug);
  }
  item.companies?.sort();
}

function buildPageItem<T extends DraftedCluster>(
  page: string,
  cluster: T,
): PageItem<T>["item"] | undefined {
  const { draft, classification, extraction } = cluster;
  const sources = editionSources(cluster);
  if (sources.length === 0) return undefined;

  const base = {
    headline: stripHeadlineMarkup(draft.headline ?? cluster.item.headline),
    one_liner: draft.one_liner ?? fallbackOneLiner(cluster),
    ...(draft.take !== undefined ? { take: draft.take } : {}),
    ...(classification.company_slugs.length > 0
      ? { companies: [...classification.company_slugs].sort() }
      : {}),
    sources,
  };
  const fields = extraction?.fields ?? {};

  switch (page) {
    case "performance": {
      // The mono number + its evidence are schema-required.
      const number = fields["metric_value"];
      if (number === undefined) return undefined;
      return { ...base, number: String(number.value), evidence: { ...number.evidence } };
    }
    case "funding": {
      // evidence is schema-required even when the amount is undisclosed —
      // any extracted field's span satisfies it.
      const evidence = fields["amount"]?.evidence ?? firstEvidence(fields);
      if (evidence === undefined) return undefined;
      return {
        ...base,
        amount: fields["amount"] !== undefined ? String(fields["amount"].value) : "undisclosed",
        ...(fields["stage"] !== undefined ? { stage: String(fields["stage"].value) } : {}),
        ...(fields["lead_investor"] !== undefined
          ? { lead: String(fields["lead_investor"].value) }
          : {}),
        evidence: { ...evidence },
      };
    }
    case "deals": {
      const acquirer = fields["acquirer"];
      const target = fields["target"];
      if (acquirer === undefined || target === undefined) return undefined;
      const amount = fields["amount"];
      return {
        ...base,
        acquirer: String(acquirer.value),
        target: String(target.value),
        // A disclosed price is a numeric claim — only emit it with evidence.
        ...(amount !== undefined
          ? { amount: String(amount.value), evidence: { ...amount.evidence } }
          : {}),
      };
    }
    case "models": {
      // DESIGN §3: a model version goes in the mono `number` slot when the
      // evidence carries one — versionless releases emit without it.
      const version = fields["version"];
      if (version === undefined) return { ...base };
      return { ...base, number: String(version.value), evidence: { ...version.evidence } };
    }
    case "discourse": {
      // §5.3 / DESIGN §3: a question headline + ≥2 sources from ≥2
      // distinct publishers.
      const publishers = new Set(sources.map((s) => publisherKey(s.publisher)));
      if (sources.length < 2 || publishers.size < DISCOURSE_MIN_PUBLISHERS) return undefined;
      if (!base.headline.trimEnd().endsWith("?")) return undefined;
      return { ...base, sources: sources.slice(0, 8) as [EditionSource, EditionSource, ...EditionSource[]] };
    }
    default:
      return { ...base };
  }
}

// ---------------------------------------------------------------------------
// Markets page
// ---------------------------------------------------------------------------

/** A date-tagged closing price parsed out of an excerpt. */
interface DatedClose {
  date: string;
  close: number;
}

/** `2026-10-27 USD 217.94` bars (weekly-series excerpts). */
const DATED_USD_RE = /(\d{4}-\d{2}-\d{2})\s+USD\s+([0-9]+(?:\.[0-9]+)?)/g;
/** Stooq-style `week ending 2026-10-24: close 217.94` summaries. */
const STooQ_CLOSE_RE =
  /week ending (\d{4}-\d{2}-\d{2}):\s*close ([0-9]+(?:\.[0-9]+)?)/gi;

/** Collect every date-tagged close across a cluster's member excerpts. */
function seriesFromCluster(cluster: ItemCluster): DatedClose[] {
  const out: DatedClose[] = [];
  const seen = new Set<string>();
  const push = (date: string, raw: string): void => {
    const key = `${date}`;
    if (seen.has(key)) return;
    const close = Number(raw);
    if (!Number.isFinite(close)) return;
    seen.add(key);
    out.push({ date, close });
  };
  for (const member of cluster.items) {
    for (const m of member.excerpt.matchAll(DATED_USD_RE)) push(m[1]!, m[2]!);
    for (const m of member.excerpt.matchAll(STooQ_CLOSE_RE)) push(m[1]!, m[2]!);
    const weekly = member.source_ids["weekly_close"];
    const ending = member.source_ids["week_ending"];
    if (weekly !== undefined && ending !== undefined) push(ending, weekly);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** `|change_pct| < DEADBAND` renders `flat` — sub-noise moves. */
export const DIRECTION_DEADBAND_PCT = 0.5;

function directionOf(changePct: number): "up" | "down" | "flat" {
  if (changePct >= DIRECTION_DEADBAND_PCT) return "up";
  if (changePct <= -DIRECTION_DEADBAND_PCT) return "down";
  return "flat";
}

interface TickerRow<T extends DraftedCluster = DraftedCluster> {
  ticker: EditionTicker;
  cluster: T;
  series: DatedClose[];
}

/**
 * One markets-page ticker per classified cluster. `ticker` + `close` come
 * from extraction (or a parsed weekly close when extraction left gaps);
 * `change_pct` is DERIVED — last vs first parsed close, or the record's own
 * `wow_delta_pct` — never a model-supplied number.
 */
function buildTickerRow<T extends DraftedCluster>(cluster: T): TickerRow<T> | undefined {
  const fields = cluster.extraction?.fields ?? {};
  const rep = cluster.item;
  const series = seriesFromCluster(cluster);

  const ticker =
    fields["ticker"] !== undefined
      ? String(fields["ticker"].value).toUpperCase()
      : rep.source_ids["ticker"]?.toUpperCase();
  if (ticker === undefined || ticker === "") return undefined;

  const last = series[series.length - 1];
  const close =
    fields["close"] !== undefined
      ? Number(fields["close"].value)
      : rep.source_ids["weekly_close"] !== undefined
        ? Number(rep.source_ids["weekly_close"])
        : last?.close;
  if (close === undefined || !Number.isFinite(close)) return undefined;

  // change_pct: derived (first → last parsed close), else the record's own
  // WoW delta, else extraction. A derived number needs no quote (§5.3's
  // evidence rule covers the close itself).
  let changePct: number | undefined;
  if (series.length >= 2 && series[0]!.close !== 0) {
    changePct = round2((close / series[0]!.close - 1) * 100);
  } else if (rep.source_ids["wow_delta_pct"] !== undefined) {
    changePct = Number(rep.source_ids["wow_delta_pct"]);
  } else if (rep.source_ids["prior_weekly_close"] !== undefined) {
    const prior = Number(rep.source_ids["prior_weekly_close"]);
    if (Number.isFinite(prior) && prior !== 0) changePct = round2((close / prior - 1) * 100);
  } else if (fields["change_pct"] !== undefined) {
    changePct = Number(fields["change_pct"].value);
  }
  if (changePct === undefined || !Number.isFinite(changePct)) return undefined;

  // Evidence keys into the page-level sources later — the caller re-bases
  // it when it assembles `page.sources`. Here we record the member index.
  const evidence =
    fields["close"]?.evidence ??
    (last !== undefined
      ? { source_index: -1, quote: `${last.date} USD ${last.close}` }
      : undefined) ??
    firstEvidence(fields);
  if (evidence === undefined) return undefined;

  return {
    ticker: {
      ticker,
      name: ticker, // resolved against the basket below
      close,
      change_pct: changePct,
      direction: directionOf(changePct),
      evidence,
    },
    cluster,
    series,
  };
}

const DAY_MS = 86_400_000;

/** Equal-weight basket index from the emitted tickers' parsed series —
 * mean(close/first_close×100) over tickers reporting that date. Falls back
 * to a 2-point WoW card when no dated bars exist. */
function basketChart(rows: readonly TickerRow[], _dateStart: string, dateEnd: string) {
  const byDate = new Map<string, number[]>();
  for (const row of rows) {
    const first = row.series[0]?.close;
    if (first === undefined || first === 0) continue;
    for (const point of row.series) {
      const arr = byDate.get(point.date) ?? [];
      arr.push((point.close / first) * 100);
      byDate.set(point.date, arr);
    }
  }
  const series = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      value: round2(vals.reduce((s, v) => s + v, 0) / vals.length),
    }));
  if (series.length >= 2) return series;
  // Fallback: prior close = 100 → this week's mean WoW index.
  const wows = rows.map((r) => r.ticker.change_pct).filter((v) => Number.isFinite(v));
  const basketWow = wows.length > 0 ? wows.reduce((s, v) => s + v, 0) / wows.length : 0;
  const prior = new Date(Date.parse(`${dateEnd}T00:00:00.000Z`) - 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return [
    { date: prior, value: 100 },
    { date: dateEnd, value: round2(100 + basketWow) },
  ];
}

function emitMarketsPage<T extends DraftedCluster>(
  clusters: readonly T[],
  opts: EmitOptions,
): { page: EditionMarketsPage; refs: EmittedItemRef[] } | undefined {
  const candidates = clusters.filter((c) => c.classification.page === "markets");
  const real = candidates.filter((c) => !isFixtureCluster(c));
  const pool = real.length > 0 ? real : candidates;

  const rows: TickerRow<T>[] = [];
  const seenTicker = new Set<string>();
  for (const cluster of pool) {
    if (rows.length >= 10) break;
    const row = buildTickerRow(cluster);
    if (row === undefined || seenTicker.has(row.ticker.ticker)) continue;
    seenTicker.add(row.ticker.ticker);
    rows.push(row);
  }
  if (rows.length === 0) return undefined;

  // Page-level sources: every contributing cluster's members, deduped by
  // canonical url, in emission order.
  const sources: EditionSource[] = [];
  const seenUrl = new Set<string>();
  for (const row of rows) {
    for (const s of editionSources(row.cluster)) {
      if (seenUrl.has(s.url)) continue;
      seenUrl.add(s.url);
      sources.push(s);
    }
  }
  if (sources.length === 0) return undefined;

  // Re-base each ticker's evidence: source_index pointed at the member
  // inside its own cluster; map it onto the page-level list.
  const tickers: EditionTicker[] = [];
  const keptRows: TickerRow<T>[] = [];
  for (const row of rows) {
    const { source_index, quote } = row.ticker.evidence;
    let resolved = source_index;
    if (source_index < 0) {
      // derived quote — attribute to the member that carries it verbatim
      resolved = row.cluster.items.findIndex((m) => m.excerpt.includes(quote));
      if (resolved < 0) continue;
    }
    const memberSources: EditionSource[] = editionSources(row.cluster);
    const target = memberSources[resolved];
    const pageIndex = target !== undefined ? sources.findIndex((s) => s.url === target.url) : -1;
    if (pageIndex < 0) continue;
    // the quote must appear verbatim in the page-level excerpt it cites
    if (!sources[pageIndex]!.excerpt.includes(quote)) continue;
    tickers.push({ ...row.ticker, evidence: { source_index: pageIndex, quote } });
    keptRows.push(row);
  }
  if (tickers.length === 0) return undefined;

  // Display names: markets basket → company registry ticker → the symbol.
  const basket = new Map((opts.markets?.basket ?? []).map((t) => [t.ticker, t.name]));
  const byTicker = new Map(
    opts.companies.filter((c) => c.ticker !== undefined).map((c) => [c.ticker!, c.name]),
  );
  for (const t of tickers) {
    t.name = basket.get(t.ticker) ?? byTicker.get(t.ticker) ?? t.ticker;
  }

  const chart = {
    title: "AI basket index, week to date",
    unit: "index" as const,
    series: basketChart(keptRows, opts.date_start, opts.date_end),
  };

  return {
    page: {
      type: "markets",
      sources,
      chart,
      tickers: tickers as EditionMarketsPage["tickers"],
    },
    refs: keptRows.map((row, i) => ({
      ref_id: `markets-${i}`,
      cluster_id: row.cluster.id,
      page: "markets",
    })),
  };
}

// ---------------------------------------------------------------------------
// Derived pages
// ---------------------------------------------------------------------------

/** most_covered: story counts across emitted item pages. */
function mostCovered<T extends DraftedCluster>(
  emitted: readonly PageItem<T>[],
  opts: EmitOptions,
): { company: string; name: string; stories: number; trend: "up" | "down" | "flat" }[] {
  const names = new Map(opts.companies.map((c) => [c.slug, c.name]));
  const midpoint = new Date(
    (Date.parse(`${opts.date_start}T00:00:00.000Z`) +
      Date.parse(`${opts.date_end}T00:00:00.000Z`)) /
      2,
  );
  const counts = new Map<string, { stories: number; first: number; second: number }>();
  for (const { cluster } of emitted) {
    const secondHalf = Date.parse(cluster.item.published_at) >= midpoint.getTime();
    for (const slug of cluster.classification.company_slugs) {
      const cur = counts.get(slug) ?? { stories: 0, first: 0, second: 0 };
      cur.stories += 1;
      if (secondHalf) cur.second += 1;
      else cur.first += 1;
      counts.set(slug, cur);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].stories - a[1].stories || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([slug, c]) => ({
      company: slug,
      name: names.get(slug) ?? slug,
      stories: c.stories,
      trend: c.second > c.first ? "up" : c.second < c.first ? "down" : "flat",
    }));
}

const HOW_MADE =
  "Ingested via deterministic RSS/API adapters, normalized, deduplicated, classified, ranked, extracted, and drafted by the pipeline described in PLAN.md. Every number on this page traces to a quoted span in a recorded source excerpt (see editions/<week>/provenance.json).";

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

/**
 * Emit the edition. `clusters` arrive ranked (rank order preserved through
 * classify→extract→draft); `briefing` is P6's enforced briefing draft.
 * Throws `EmitError` when a schema-mandatory page cannot be filled.
 */
export class EmitError extends Error {
  constructor(readonly issues: string[]) {
    super(`emit failed: ${issues.join("; ")}`);
    this.name = "EmitError";
  }
}

export function emitEdition<T extends DraftedCluster>(
  clusters: readonly T[],
  briefing: BriefingDraft,
  opts: EmitOptions,
): EmitResult {
  const emitted: EmittedItemRef[] = [];
  const allPageItems: PageItem<T>[] = [];

  // PLAN §3: a page with nothing to say is dropped, never padded — the page
  // keeps its tuple position with an empty content array and renderers skip it.
  const itemPages: Record<string, PageItem<T>[]> = {};
  for (const page of ["models", "performance", "launches", "funding", "deals", "discourse"]) {
    const items = emitItemPage(page, clusters);
    itemPages[page] = items;
    allPageItems.push(...items);
    for (const [i, it] of items.entries()) {
      emitted.push({ ref_id: `${page}-${i}`, cluster_id: it.cluster.id, page });
    }
  }

  const markets = emitMarketsPage<T>(clusters, opts);
  if (markets !== undefined) emitted.push(...markets.refs);

  // Cover + most_covered derive from the item pages — a week with nothing at
  // all still can't emit.
  if (allPageItems.length === 0) {
    throw new EmitError(["no emittable items across all item pages"]);
  }

  // Cover: the highest-ranked emitted cluster, real pool preferred.
  const coverPool = allPageItems.filter((p) => !isFixtureCluster(p.cluster));
  const cover = (coverPool.length > 0 ? coverPool : allPageItems)
    .reduce((best, cur) => (rankScore(cur.cluster) > rankScore(best.cluster) ? cur : best));

  const sentences = briefing.sentences;
  if (sentences.length < 5 || sentences.length > 7) {
    throw new EmitError([`briefing has ${sentences.length} sentences — schema needs 5–7`]);
  }

  // most_covered derives from emitted items; no company tags → entries: []
  // and the page is dropped at render like any other empty page.
  const covered = mostCovered(allPageItems, opts);

  // L1: the cover headline links to the covered story's origin source.
  const coverUrl = primarySource(editionSources(cover.cluster))?.url;

  const editionSkeleton = {
    pages: [
      {
        type: "cover",
        headline: stripHeadlineMarkup(cover.cluster.draft.headline ?? cover.cluster.item.headline),
        ...(coverUrl !== undefined ? { url: coverUrl } : {}),
        ...(cover.item.one_liner !== "" ? { deck: cover.item.one_liner } : {}),
      },
      { type: "briefing", sentences: [...sentences] },
      { type: "models", items: itemPages["models"]!.map((p) => p.item) },
      { type: "performance", items: itemPages["performance"]!.map((p) => p.item) },
      { type: "launches", items: itemPages["launches"]!.map((p) => p.item) },
      { type: "funding", items: itemPages["funding"]!.map((p) => p.item) },
      { type: "deals", items: itemPages["deals"]!.map((p) => p.item) },
      markets?.page ?? {
        type: "markets",
        sources: [],
        chart: { title: "AI basket index, week to date", unit: "index" as const, series: [] },
        tickers: [],
      },
      { type: "discourse", items: itemPages["discourse"]!.map((p) => p.item) },
      { type: "most_covered", entries: covered },
      { type: "back_page", sources_total: 0, source_counts: [], how_made: "", agent_links: {} },
    ],
  };

  const sourceCounts = collectSourceCountsLocal(
    editionSkeleton as Record<string, unknown>,
  );
  const sourcesTotal = sourceCounts.reduce((n, s) => n + s.count, 0);

  const edition = {
    id: opts.id,
    schema_version: 1,
    issue_number: opts.issue_number,
    date_start: opts.date_start,
    date_end: opts.date_end,
    pages: [
      editionSkeleton.pages[0],
      editionSkeleton.pages[1],
      editionSkeleton.pages[2],
      editionSkeleton.pages[3],
      editionSkeleton.pages[4],
      editionSkeleton.pages[5],
      editionSkeleton.pages[6],
      editionSkeleton.pages[7],
      editionSkeleton.pages[8],
      editionSkeleton.pages[9],
      {
        type: "back_page",
        sources_total: sourcesTotal,
        source_counts: sourceCounts,
        how_made: HOW_MADE.replace("<week>", opts.id),
        agent_links: {
          markdown: `/${opts.id}.md`,
          json: `/${opts.id}.json`,
          llms_txt: "/llms.txt",
          feed: "/feed.xml",
        },
        ...(opts.colophon !== undefined ? { colophon: opts.colophon } : {}),
      },
    ],
  } as unknown as Edition;

  return { edition, emitted };
}

/** Local copy of provenance.collectSourceCounts over the skeleton — kept
 * separate so emit never imports the provenance module (which reads fs). */
function collectSourceCountsLocal(
  edition: Record<string, unknown>,
): { publisher: string; count: number }[] {
  const counts = new Map<string, number>();
  const pages = Array.isArray(edition["pages"]) ? edition["pages"] : [];
  for (const raw of pages as Array<Record<string, unknown>>) {
    const items = Array.isArray(raw["items"]) ? raw["items"] : [];
    for (const item of items as Array<Record<string, unknown>>) {
      for (const s of (Array.isArray(item["sources"]) ? item["sources"] : []) as Array<
        Record<string, unknown>
      >) {
        if (typeof s["publisher"] !== "string" || s["publisher"] === "") continue;
        counts.set(s["publisher"], (counts.get(s["publisher"]) ?? 0) + 1);
      }
    }
    for (const s of (Array.isArray(raw["sources"]) ? raw["sources"] : []) as Array<
      Record<string, unknown>
    >) {
      if (typeof s["publisher"] !== "string" || s["publisher"] === "") continue;
      counts.set(s["publisher"], (counts.get(s["publisher"]) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([publisher, count]) => ({ publisher, count }))
    .sort((a, b) => b.count - a.count || a.publisher.localeCompare(b.publisher));
}
