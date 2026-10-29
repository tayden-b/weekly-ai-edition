/**
 * P1 — `dedupe` stage (PLAN.md §5.2): `NormalizedItem[]` → `ItemCluster[]`.
 *
 * Third stage in `PIPELINE_STAGES`. A pure function — no I/O, no clock, no
 * config reads; the only tunable is `DedupeOptions.threshold`, which P3 wires
 * from pipeline config.
 *
 * ## What a cluster is
 *
 * A cluster is one story: every member reports the same event. Three
 * mechanisms build it, applied in order:
 *
 *  1. **Exact collapse.** Records sharing `adapter + canonical_url` are the
 *     same fetch twice (e.g. one item appearing in two feeds of the same
 *     adapter). They merge into a single member: earliest `published_at`,
 *     latest `fetched_at`, unioned `source_ids`, max engagement, and the
 *     richest `excerpt` (longest; ties → earliest published, then smallest
 *     headline). A different adapter keeps the record distinct — it is a
 *     different source link the edition must keep.
 *  2. **Shared-URL union.** Members on the same `canonical_url` via
 *     different adapters (HN linking to the TechCrunch article TechCrunch
 *     itself filed) are the same story — unions without consulting titles.
 *  3. **SimHash clustering.** Members whose `title_key` fingerprints sit
 *     within `threshold` Hamming bits union into one cluster — the
 *     remaining cross-source case (same story, different outlets,
 *     different URLs).
 *
 * Cluster shape is what `sources[]` on edition items is built from:
 * `clusterSources()` emits the C2 `EditionSource` field set verbatim
 * (`url`/`publisher`/`published_at`/`fetched_at`/`adapter`/`excerpt`/
 * `source_ids`), so emit's map is mechanical.
 *
 * ## Determinism
 *
 * No wall-clock, no map-iteration-order dependence: member order is
 * `published_at` → `canonical_url` → `adapter`, the representative `item`
 * is the first member, `id` is the smallest `canonical_url` in the cluster,
 * and clusters sort by representative `published_at` then `id`. Same input
 * set always yields the same partition regardless of input order.
 *
 * ## SimHash
 *
 * 64-bit Charikar fingerprint over character 3-grams of `title_key`, hashed
 * with FNV-1a/64 — the standard short-text feature set (word shingles are
 * too sparse on headlines: one inserted word flips 9+ bits). Two items are
 * near-duplicates when `hammingDistance(fpA, fpB) ≤ threshold`; the default
 * `DEFAULT_SIMHASH_THRESHOLD` = 6 bits merges titles differing by a word or
 * two (measured 3–6 bits on fixture pairs) while keeping same-topic
 * different stories (≥10 bits) and unrelated stories (≥16 bits) apart.
 * Raise to merge looser variants, lower to split harder — under-merging
 * degrades to separate stories; over-merging fuses unrelated ones, so the
 * default errs conservative. A `title_key` shorter than 3 chars yields no
 * features — those items take no SimHash edges (identical empty fingerprints
 * would merge unrelated stories). Pairwise comparison is O(n²) over a
 * weekly ingest volume (hundreds of items); revisit banding only if P3
 * ever feeds materially more.
 */

import type { NormalizedItem } from "./normalize.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One source link on an edition item — structurally identical to C2's
 * `EditionSource` (`packages/schema/edition.schema.json`); `url` is the
 * canonical URL `RawItem.canonical_url` maps onto.
 */
export interface ClusterSource {
  url: string;
  publisher: string;
  /** Aggregator that surfaced the record when `publisher` names the origin (L1). */
  via?: string;
  published_at: string;
  fetched_at: string;
  /** Adapter id from `config/sources.yaml`. */
  adapter: string;
  excerpt: string;
  /** Present only when the record carries ids. */
  source_ids?: Record<string, string>;
}

/**
 * One story, N sources. `items` holds every member in deterministic order;
 * `item` is the representative (earliest `published_at`, tie → smallest
 * `canonical_url`); `id` is the smallest `canonical_url` — stable across
 * input orderings and unique per cluster by construction.
 */
export interface ItemCluster {
  id: string;
  item: NormalizedItem;
  items: NormalizedItem[];
}

export interface DedupeOptions {
  /**
   * Max Hamming distance (bits, of 64) between title SimHash fingerprints
   * for two items to merge into one cluster. `DEFAULT_SIMHASH_THRESHOLD`
   * (6) when omitted. 0 disables near-dedupe (exact-URL collapse still runs).
   */
  threshold?: number;
}

// ---------------------------------------------------------------------------
// SimHash (Charikar) over FNV-1a/64
// ---------------------------------------------------------------------------

/** Fingerprint width in bits. */
export const SIMHASH_BITS = 64;

/** Character shingle width used for title fingerprints. */
export const SIMHASH_SHINGLE = 3;

/**
 * Default near-dupe threshold: ≤6 differing bits of 64. Measured on fixture
 * pairs: one-word title variants sit at 3–6 bits, same-topic different
 * stories ≥10, unrelated ≥16.
 */
export const DEFAULT_SIMHASH_THRESHOLD = 6;

const FNV_OFFSET = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const MASK64 = (1n << 64n) - 1n;

/** FNV-1a 64-bit hash over UTF-16 code units — small, deterministic, dependency-free. */
function fnv1a64(text: string): bigint {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * FNV_PRIME) & MASK64;
  }
  return h;
}

/**
 * Features: overlapping character `SIMHASH_SHINGLE`-grams of the
 * `title_key` form (lowercase alnum tokens, space-separated). Char shingles
 * make a one-word edit cost a few fingerprint bits instead of ~12, which is
 * what near-dedupe on headlines needs. A text shorter than the shingle
 * yields no features and fingerprints to `0n` — callers skip those.
 */
function* features(text: string): Generator<string> {
  for (let i = 0; i + SIMHASH_SHINGLE <= text.length; i++) {
    yield text.slice(i, i + SIMHASH_SHINGLE);
  }
}

/**
 * Charikar SimHash: per feature hash, each bit votes +1/−1; the fingerprint
 * bit is set when the tally is positive (ties settle to 0 — deterministic).
 * An empty feature set fingerprints to `0n`; callers must not cluster on it.
 */
export function simhash(text: string): bigint {
  const tally = new Array<number>(SIMHASH_BITS).fill(0);
  for (const f of features(text)) {
    const h = fnv1a64(f);
    for (let i = 0; i < SIMHASH_BITS; i++) {
      tally[i] = (tally[i] ?? 0) + (((h >> BigInt(i)) & 1n) === 1n ? 1 : -1);
    }
  }
  let fp = 0n;
  for (let i = 0; i < SIMHASH_BITS; i++) {
    if ((tally[i] ?? 0) > 0) fp |= 1n << BigInt(i);
  }
  return fp;
}

/** Hamming distance between two 64-bit fingerprints. */
export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let d = 0;
  while (x !== 0n) {
    d += Number(x & 1n);
    x >>= 1n;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Cluster assembly
// ---------------------------------------------------------------------------

const memberCmp = (a: NormalizedItem, b: NormalizedItem): number =>
  a.published_at.localeCompare(b.published_at) ||
  a.canonical_url.localeCompare(b.canonical_url) ||
  a.adapter.localeCompare(b.adapter);

/** Union two `source_ids` records; same-key conflicts join values sorted, comma-separated. */
function mergeSourceIds(
  a: Record<string, string>,
  b: Record<string, string>,
): Record<string, string> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const existing = out[k];
    if (existing === undefined) out[k] = v;
    else if (existing !== v) {
      out[k] = [...new Set([...existing.split(","), v])].sort().join(",");
    }
  }
  return out;
}

/** Collapse records sharing `adapter + canonical_url` into one member. */
function mergeSameRecord(recs: readonly NormalizedItem[]): NormalizedItem {
  // Richest record wins the display fields: longest excerpt, then earliest
  // published, then smallest headline — fully deterministic.
  const rep = [...recs].sort(
    (a, b) =>
      b.excerpt.length - a.excerpt.length ||
      a.published_at.localeCompare(b.published_at) ||
      a.headline.localeCompare(b.headline),
  )[0]!;
  const merged: NormalizedItem = { ...rep };
  for (const r of recs) {
    if (r.published_at < merged.published_at) merged.published_at = r.published_at;
    if (r.fetched_at > merged.fetched_at) merged.fetched_at = r.fetched_at;
    merged.source_ids = mergeSourceIds(merged.source_ids, r.source_ids);
    for (const f of ["hn_comments", "hn_points", "reddit_score"] as const) {
      const v = r[f];
      const cur = merged[f];
      if (v !== undefined && (cur === undefined || v > cur)) merged[f] = v;
    }
  }
  return merged;
}

/** The `EditionSource`-shaped link list — every member, in member order. */
export function clusterSources(cluster: ItemCluster): ClusterSource[] {
  return cluster.items.map((i) => ({
    url: i.canonical_url,
    publisher: i.publisher,
    ...(i.via !== undefined ? { via: i.via } : {}),
    published_at: i.published_at,
    fetched_at: i.fetched_at,
    adapter: i.adapter,
    excerpt: i.excerpt,
    ...(Object.keys(i.source_ids).length > 0 ? { source_ids: i.source_ids } : {}),
  }));
}

/**
 * The `dedupe` stage: `NormalizedItem[]` → `ItemCluster[]`.
 * Exact-URL collapse first, then SimHash union-find over `title_key`.
 */
export function dedupe(items: readonly NormalizedItem[], opts?: DedupeOptions): ItemCluster[] {
  const threshold = opts?.threshold ?? DEFAULT_SIMHASH_THRESHOLD;

  // 1. Exact collapse: same adapter + same canonical URL = the same record.
  const byKey = new Map<string, NormalizedItem[]>();
  for (const item of items) {
    const key = `${item.adapter}\n${item.canonical_url}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(item);
    else byKey.set(key, [item]);
  }
  const members = [...byKey.values()].map(mergeSameRecord);

  const parent = members.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    parent[i] = r;
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  // 2. Shared-URL union across adapters.
  const byUrl = new Map<string, number>();
  members.forEach((m, i) => {
    const prev = byUrl.get(m.canonical_url);
    if (prev === undefined) byUrl.set(m.canonical_url, i);
    else union(prev, i);
  });

  // 3. SimHash union over title fingerprints. Title keys too short to
  // shingle get no fingerprint — they'd all collide at 0n.
  const fps = members.map((m) =>
    m.title_key.length < SIMHASH_SHINGLE ? null : simhash(m.title_key),
  );
  // Per-ticker series items ("NVDA weekly closing series") differ only in
  // the ticker chars — near-identical fingerprints for different data
  // feeds. Two members carrying different `source_ids.ticker` are never
  // the same story, so they never union here.
  const tickerOf = (m: NormalizedItem) => m.source_ids?.["ticker"];
  for (let i = 0; i < members.length; i++) {
    const fi = fps[i];
    if (fi === null || fi === undefined) continue;
    for (let j = i + 1; j < members.length; j++) {
      const fj = fps[j];
      if (fj === null || fj === undefined) continue;
      const ti = tickerOf(members[i]!);
      const tj = tickerOf(members[j]!);
      if (ti !== undefined && tj !== undefined && ti !== tj) continue;
      if (hammingDistance(fi, fj) <= threshold) union(i, j);
    }
  }

  // 3. Emit clusters in deterministic order.
  const groups = new Map<number, NormalizedItem[]>();
  members.forEach((m, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(m);
    else groups.set(root, [m]);
  });

  const clusters: ItemCluster[] = [...groups.values()].map((group) => {
    const sorted = [...group].sort(memberCmp);
    const id = sorted.reduce((min, m) => (m.canonical_url < min ? m.canonical_url : min),
      sorted[0]!.canonical_url);
    return { id, item: sorted[0]!, items: sorted };
  });
  clusters.sort(
    (a, b) => a.item.published_at.localeCompare(b.item.published_at) || a.id.localeCompare(b.id),
  );
  return clusters;
}

