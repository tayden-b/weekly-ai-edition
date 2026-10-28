/**
 * P2 — `rank` stage (PLAN.md §5.2): `ItemCluster[]` → `RankedCluster[]`.
 *
 * Fifth stage in `PIPELINE_STAGES` (after classify). A pure function — no
 * I/O, no network, no config file reads, no wall-clock. Everything tunable
 * arrives through `RankOptions`; the ingest orchestrator (P3) builds them
 * from `config/sources.yaml`.
 *
 * ## The score
 *
 *   score = source_count_factor × publisher_weight_factor
 *         × recency_factor × engagement_factor
 *
 * Multiplicative composition keeps the ranking auditable — each factor is
 * independent, normalized to a comparable range, and reported verbatim in
 * `score_breakdown`, so a reviewer can see exactly why an item ordered the
 * way it did.
 *
 * ### factor: source count — `n / (n + 1)` ∈ [0.5, 1)
 *
 * `n` = the number of DISTINCT publishers in the cluster (normalized via
 * `publisherKey`, so "The Verge" and "verge" count once). Distinct
 * publishers are the corroboration signal: the same outlet filing the same
 * story in two feeds is not independent confirmation (matches the §5.3
 * discourse rule's "≥ 2 distinct publishers" phrasing). One source scores
 * 0.5; each additional independent outlet approaches but never reaches 1.
 *
 * ### factor: publisher weight — max member weight ∈ (0, ∞)
 *
 * The strongest corroborating publisher sets the authority factor —
 * `source_count` already rewards breadth, so weight rewards the best single
 * source rather than re-rewarding the count. Weight resolution per member:
 *
 *   1. Provenance: any `source_ids` key named `feed` or ending `_feed`
 *      (`newsroom_feed`, `feed`, `reddit_feed`, …) carries the sources.yaml
 *      entry id — comma-joined values are checked part-by-part. Most
 *      precise: the adapter recorded exactly which entry produced it.
 *   2. Publisher name: `publisherKey(member.publisher)` matches an entry's
 *      `meta.publisher` (highest-weighted match wins — two entries may
 *      share a publisher, e.g. techcrunch-ai vs techcrunch-funding).
 *   3. `DEFAULT_PUBLISHER_WEIGHT` (1.0) — undeclared publishers are
 *      neutral, never punished for being absent from config.
 *
 * Entry weight = `meta.weight` when it is a non-negative number, else 1.0.
 * Weights live in `config/sources.yaml`, never in code — this file only
 * defines the neutral default.
 *
 * ### factor: recency — `2^(−age_days / RECENCY_HALF_LIFE_DAYS)` ∈ (0, 1]
 *
 * Age is measured from the reference instant to the cluster's representative
 * `published_at` (`cluster.item.published_at` — the EARLIEST member: a story
 * first reported six days ago is six-day-old news even if another outlet
 * picked it up today; re-coverage is corroboration, not freshness). The
 * reference is `opts.now()` when given, else the newest `published_at` in
 * the batch — batch-relative, deterministic, no wall-clock. Half-life 3
 * days: today's story scores 1, three days old 0.5, a week ~0.2. Stories
 * dated in the future clamp to age 0. An unparseable `published_at` scores
 * `RECENCY_UNPARSEABLE` (0.5 — mid-neutral, documented; a malformed
 * timestamp degrades the factor, never zeroes the story).
 *
 * ### factor: engagement — absent → 1.0; present → `1 + raw/(raw + K)` ∈ [1, 2)
 *
 * `raw` = the sum of every captured engagement count on every member —
 * `hn_points`, `hn_comments`, `reddit_score` (the `RawItemEngagement`
 * keys; append `reddit_comments` here when A9's field lands). A record
 * carrying NO engagement fields contributes nothing: absent engagement is
 * the neutral factor 1.0, not zero — most sources never carry community
 * counts and must not be demoted for it. When engagement is captured, the
 * score gets up to a 2× lift saturating at `ENGAGEMENT_SATURATION` (500):
 * a modest thread (~50) lifts ~1.1×, a front-page storm (~1000) ~1.67×.
 * Community records also count as publishers under `source_count` — a
 * link-drop and its reception are different signal axes (presence vs
 * magnitude).
 *
 * ## Ordering + determinism
 *
 * Sort: `score` descending → representative `published_at` descending
 * (newest story first) → `id` ascending. Scores are computed the same way
 * for every input order — the only timestamps read come from the records
 * themselves or `opts.now`, so identical input always yields identical
 * ordering.
 *
 * ## Boundary
 *
 * Per-page top-N selection is emit's job (out of scope); LLM reranking does
 * not exist — deterministic by design (PLAN §5.2).
 */

import type { RawItemEngagement } from "../adapter.js";
import type { SourceEntry } from "../config.js";
import type { ItemCluster } from "./dedupe.js";
import { publisherKey } from "./normalize.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-cluster audit trail — every raw input and normalized factor behind
 * `score`, emitted so reviewers can see exactly why the item ordered the
 * way it did.
 */
export interface ScoreBreakdown {
  /** Distinct publishers counted in the cluster (`publisherKey`-deduped). */
  source_count: number;
  /** Publisher names, one per distinct publisher counted (sorted). */
  publishers: string[];
  /** `n / (n + 1)` — the corroboration factor. */
  source_count_factor: number;
  /** Resolved max member weight — the strongest corroborating publisher. */
  publisher_weight: number;
  /**
   * Days between the reference instant and the representative
   * `published_at` (0 when future-dated). `null` when unparseable —
   * `recency` then carries `RECENCY_UNPARSEABLE`.
   */
  age_days: number | null;
  /** `2^(−age_days / halfLife)` — or `RECENCY_UNPARSEABLE` when age is null. */
  recency: number;
  /** Summed captured engagement counts across all members. */
  engagement_raw: number;
  /** false → `engagement` is the neutral 1.0, not a measurement. */
  engagement_present: boolean;
  /** `1 + raw/(raw + K)` when present, else the neutral 1.0. */
  engagement: number;
}

/** A cluster after ranking: the cluster plus its score and audit trail. */
export interface RankedCluster extends ItemCluster {
  score: number;
  score_breakdown: ScoreBreakdown;
}

export interface RankOptions {
  /**
   * `config/sources.yaml` entries — publisher weights resolve from
   * `meta.weight`/`meta.publisher` and `source_ids.*_feed` provenance.
   * Omitted → every member takes `DEFAULT_PUBLISHER_WEIGHT`.
   */
  sources?: readonly SourceEntry[];
  /**
   * Reference instant for recency. P3 injects the edition window end;
   * omitted → the newest `published_at` in the batch (batch-relative,
   * deterministic). Never a direct `Date.now()` call inside the stage.
   */
  now?: () => Date;
  /** Recency half-life in days. `RECENCY_HALF_LIFE_DAYS` when omitted. */
  halfLifeDays?: number;
  /** Engagement saturation constant `K`. `ENGAGEMENT_SATURATION` when omitted. */
  engagementSaturation?: number;
}

// ---------------------------------------------------------------------------
// Tunables (documented defaults; real values live in config, not here)
// ---------------------------------------------------------------------------

/**
 * Weight applied when a member resolves to no config entry — the neutral
 * factor. The weights themselves are always config-sourced; this is only
 * the "not declared" fallback.
 */
export const DEFAULT_PUBLISHER_WEIGHT = 1.0;

/** Recency decay: a story halves in weight every 3 days. */
export const RECENCY_HALF_LIFE_DAYS = 3;

/** Unparseable `published_at` → mid-neutral recency (degraded, not zeroed). */
export const RECENCY_UNPARSEABLE = 0.5;

/**
 * Engagement saturation `K` in `1 + raw/(raw + K)`: the raw count at which
 * engagement contributes half its maximum lift (≈ a strong HN/Reddit week).
 */
export const ENGAGEMENT_SATURATION = 500;

/**
 * The engagement fields read per member — the `RawItemEngagement` contract
 * slot filled by adapters (A2's hn_*, A9's reddit_*).
 */
export const ENGAGEMENT_FIELDS: readonly (keyof RawItemEngagement)[] = [
  "hn_points",
  "hn_comments",
  "reddit_score",
  "reddit_comments",
];

// ---------------------------------------------------------------------------
// Publisher-weight resolution
// ---------------------------------------------------------------------------

/** `meta.weight` of an entry when it is a non-negative finite number, else undefined. */
export function configuredWeight(entry: SourceEntry): number | undefined {
  const w = entry.meta?.weight;
  return typeof w === "number" && Number.isFinite(w) && w >= 0 ? w : undefined;
}

/**
 * Resolved weight lookup built once per `rank` call from `opts.sources`:
 * `byEntryId` for `source_ids.*_feed` provenance, `byPublisher` for
 * `meta.publisher` display-name matches (highest weight wins on collisions).
 */
export interface WeightLookup {
  byEntryId: Map<string, number>;
  byPublisher: Map<string, number>;
}

function buildWeightLookup(sources: readonly SourceEntry[]): WeightLookup {
  const byEntryId = new Map<string, number>();
  const byPublisher = new Map<string, number>();
  for (const entry of sources) {
    const weight = configuredWeight(entry) ?? DEFAULT_PUBLISHER_WEIGHT;
    byEntryId.set(entry.id, weight);
    const publisher = entry.meta?.publisher;
    if (typeof publisher === "string" && publisher.trim() !== "") {
      const key = publisherKey(publisher);
      const cur = byPublisher.get(key);
      if (cur === undefined || weight > cur) byPublisher.set(key, weight);
    }
  }
  return { byEntryId, byPublisher };
}

/**
 * Resolve one member's publisher weight — feed-id provenance first, then
 * the publisher display name, then the neutral default.
 */
function memberWeight(member: ItemCluster["item"], lookup: WeightLookup): number {
  // Provenance: adapters stamp the sources.yaml entry id on
  // `source_ids.feed` / `*_feed` (dedupe may comma-join multiple values).
  for (const [key, value] of Object.entries(member.source_ids)) {
    if (key !== "feed" && !key.endsWith("_feed")) continue;
    for (const id of value.split(",")) {
      const w = lookup.byEntryId.get(id.trim());
      if (w !== undefined) return w;
    }
  }
  const byName = lookup.byPublisher.get(publisherKey(member.publisher));
  return byName ?? DEFAULT_PUBLISHER_WEIGHT;
}

// ---------------------------------------------------------------------------
// Factors
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

/** `n / (n + 1)` — distinct-publisher corroboration factor ∈ [0.5, 1). */
function sourceCountFactor(n: number): number {
  return n / (n + 1);
}

/**
 * `2^(−age / halfLife)` — exponential decay ∈ (0, 1]; `ageDays` null →
 * `RECENCY_UNPARSEABLE`. Future dates clamp to age 0 (factor 1).
 */
function recencyFactor(ageDays: number | null, halfLife: number): number {
  if (ageDays === null) return RECENCY_UNPARSEABLE;
  return Math.pow(2, -ageDays / halfLife);
}

/** `1 + raw/(raw + K)` ∈ [1, 2) when engagement was captured; 1.0 when absent. */
function engagementFactor(raw: number, present: boolean, saturation: number): number {
  if (!present) return 1.0;
  return 1 + raw / (raw + saturation);
}

/** Sum of every captured engagement count on one member. */
function memberEngagement(item: ItemCluster["item"]): { raw: number; present: boolean } {
  let raw = 0;
  let present = false;
  for (const field of ENGAGEMENT_FIELDS) {
    const v = item[field];
    if (typeof v === "number" && Number.isFinite(v)) {
      raw += v;
      present = true;
    }
  }
  return { raw, present };
}

/** Reference instant: `opts.now()` or the newest parseable member timestamp. */
function referenceTime(clusters: readonly ItemCluster[], now?: () => Date): number {
  if (now) {
    const t = now().getTime();
    if (!Number.isNaN(t)) return t;
  }
  let max = 0;
  for (const c of clusters) {
    for (const m of c.items) {
      const t = Date.parse(m.published_at);
      if (!Number.isNaN(t) && t > max) max = t;
    }
  }
  return max;
}

/** Parse a timestamp to epoch ms, or null. */
function parseMs(value: string): number | null {
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

/** Score one cluster. Pure — all inputs passed in. */
function scoreCluster(
  cluster: ItemCluster,
  refMs: number,
  lookup: WeightLookup,
  halfLifeDays: number,
  engagementSaturation: number,
): { score: number; score_breakdown: ScoreBreakdown } {
  // Distinct publishers — `publisherKey` dedupe ("The Verge" = "verge");
  // the breakdown lists the member's own display name for readability.
  const distinct = new Map<string, string>();
  for (const m of cluster.items) {
    const key = publisherKey(m.publisher);
    if (!distinct.has(key)) distinct.set(key, m.publisher);
  }
  const publishers = [...distinct.values()].sort();
  const countFactor = sourceCountFactor(distinct.size);

  const weight = Math.max(...cluster.items.map((m) => memberWeight(m, lookup)));

  const publishedMs = parseMs(cluster.item.published_at);
  const ageDays =
    publishedMs === null ? null : Math.max(0, (refMs - publishedMs) / MS_PER_DAY);
  const recency = recencyFactor(ageDays, halfLifeDays);

  let raw = 0;
  let present = false;
  for (const m of cluster.items) {
    const e = memberEngagement(m);
    raw += e.raw;
    present = present || e.present;
  }
  const engagement = engagementFactor(raw, present, engagementSaturation);

  const score = countFactor * weight * recency * engagement;
  return {
    score,
    score_breakdown: {
      source_count: publishers.length,
      publishers,
      source_count_factor: countFactor,
      publisher_weight: weight,
      age_days: ageDays,
      recency,
      engagement_raw: raw,
      engagement_present: present,
      engagement,
    },
  };
}

/**
 * The `rank` stage: `ItemCluster[]` → `RankedCluster[]`, sorted by
 * score desc → representative `published_at` desc → `id` asc. Pure: same
 * input always yields the same ordering.
 */
export function rank(
  clusters: readonly ItemCluster[],
  opts?: RankOptions,
): RankedCluster[] {
  const lookup = buildWeightLookup(opts?.sources ?? []);
  const halfLife = opts?.halfLifeDays ?? RECENCY_HALF_LIFE_DAYS;
  const saturation = opts?.engagementSaturation ?? ENGAGEMENT_SATURATION;
  const refMs = referenceTime(clusters, opts?.now);

  const ranked = clusters.map((cluster) => {
    const { score, score_breakdown } = scoreCluster(
      cluster,
      refMs,
      lookup,
      halfLife,
      saturation,
    );
    return { ...cluster, score, score_breakdown };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = parseMs(a.item.published_at) ?? Number.NEGATIVE_INFINITY;
    const pb = parseMs(b.item.published_at) ?? Number.NEGATIVE_INFINITY;
    return pb - pa || a.id.localeCompare(b.id);
  });
  return ranked;
}
