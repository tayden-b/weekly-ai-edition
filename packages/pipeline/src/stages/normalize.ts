/**
 * P1 — `normalize` stage (PLAN.md §5.2): `RawItem[]` → `NormalizedItem[]`.
 *
 * Second stage in `PIPELINE_STAGES`, right after `ingest`. A pure function —
 * no I/O, no clock, no config file reads. Everything the stage needs arrives
 * through `NormalizeOptions`; the ingest orchestrator (P3) builds them from
 * `config/sources.yaml`.
 *
 * ## The stage-boundary type
 *
 * `RawItem` deliberately does not name its adapter (`EditionSource.adapter`
 * comes from the emitting adapter, not the record — see adapter.ts). Since
 * the `sources[]` a cluster emits must carry that id to round-trip into C2's
 * `EditionSource`, the stage input pairs each record with its adapter id:
 *
 *   ingest: `items.push(...(await adapter.fetch(w)).map(i => ({...i, adapter: adapter.id})))`
 *
 * ## What normalize guarantees
 *
 * - `canonical_url` — `canonicalizeUrl`: scheme/host lowercased, default
 *   port dropped, fragment removed, tracking params stripped
 *   (`utm_*`, fbclid, gclid, … — see `TRACKING_PARAMS`), remaining query
 *   params sorted, `index.{html,htm}` and trailing slash dropped, AMP forms
 *   (`amp.` host, `/amp` path tail) and mechanical redirect wrappers
 *   (`?url=<absolute-url>` etc.) unwrapped. Path case is preserved — paths
 *   are case-sensitive per RFC 3986, so "case normalization" covers
 *   scheme+host only.
 * - `publisher` — collapsed whitespace, mapped to the config display name
 *   when `opts.publishers`/`publisherAliases` resolves it; unknown
 *   publishers keep their cleaned string (never invented).
 * - `published_at`/`fetched_at` — reparsed to strict ISO-8601 UTC
 *   (`…T…Z`); unparseable values pass through untouched (validation is
 *   `validateRawItem`'s job, not this stage's).
 * - `title_key` — lowercase, punctuation-stripped headline; the token basis
 *   for `dedupe`'s SimHash and reusable by classify/rank.
 *
 * Unparseable URLs pass through unchanged rather than throwing — a bad link
 * from one adapter degrades a record, never the run.
 */

import type { RawItem } from "../adapter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Stage-boundary input: a `RawItem` plus the id of the adapter that produced
 * it (`adapter:` value in `config/sources.yaml`, e.g. "hn-algolia").
 * P3 emits this shape; every pipeline stage consumes it.
 */
export interface AdapterRawItem extends RawItem {
  /** Adapter id that fetched this record, e.g. "sec-edgar". */
  adapter: string;
}

/** A `RawItem` after the normalize stage: canonical URL, config publisher
 * name, strict-ISO timestamps, and a `title_key` for near-dedupe. */
export interface NormalizedItem extends AdapterRawItem {
  /** `titleKey(headline)` — dedupe's SimHash input. */
  title_key: string;
}

export interface NormalizeOptions {
  /**
   * Canonical publisher display names — the `meta.publisher` values and
   * adapter-declared names from `config/sources.yaml` (e.g. "TechCrunch",
   * "Hacker News", "SEC EDGAR"). Matching is punctuation/case-insensitive
   * and ignores a leading "the".
   */
  publishers?: readonly string[];
  /** Explicit alias → canonical-name overrides, e.g. {"ars": "Ars Technica"}. */
  publisherAliases?: Record<string, string>;
  /** Extra exact-match query params to strip (merged over `TRACKING_PARAMS`). */
  trackingParams?: readonly string[];
  /** Extra param prefixes to strip (merged over `TRACKING_PARAM_PREFIXES`). */
  trackingParamPrefixes?: readonly string[];
  /**
   * Query params whose absolute-http(s)-URL values replace the URL
   * (redirect/feed-proxy unwrapping). Default `UNWRAP_PARAMS`; pass `[]` to
   * disable.
   */
  unwrapParams?: readonly string[];
}

// ---------------------------------------------------------------------------
// URL canonicalization
// ---------------------------------------------------------------------------

/**
 * Exact-match tracking parameters stripped from canonical URLs
 * (case-insensitive). Prefix matches live in `TRACKING_PARAM_PREFIXES`.
 */
export const TRACKING_PARAMS: readonly string[] = [
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "vero_id",
  "wickedsource",
  "spm",
  "_hsenc",
  "_hsmi",
  "_openstat",
  "hsctatracking",
  "oly_anon_id",
  "oly_enc_id",
  "ref_src",
];

/** Param-name prefixes stripped from canonical URLs (case-insensitive). */
export const TRACKING_PARAM_PREFIXES: readonly string[] = ["utm_", "hsa_"];

/**
 * Params whose absolute-URL values are mechanically unwrapped — feed proxies
 * and redirect endpoints that embed the real target (`?url=`, `?u=`, …).
 */
export const UNWRAP_PARAMS: readonly string[] = [
  "url",
  "u",
  "target",
  "dest",
  "destination",
  "redirect",
  "redirect_url",
  "to",
  "link",
];

/** Path tails that mark AMP/alternate renderings — stripped mechanically. */
const AMP_PATH_TAILS = ["/amp", "/amp.html", "/amp.php", "/index.html", "/index.htm"];

const MAX_UNWRAP_DEPTH = 3;

function isHttpUrl(value: string): URL | null {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/** Follow a `?url=<absolute-url>`-style wrapper one hop. */
function unwrapOnce(u: URL, params: readonly string[]): URL {
  for (const name of params) {
    for (const value of u.searchParams.getAll(name)) {
      const inner = isHttpUrl(value);
      if (inner) return inner;
    }
  }
  return u;
}

/**
 * Resolve the canonical form of an item URL. Mechanical steps only — never
 * guesses content identity across hosts:
 *
 *   unwrap `UNWRAP_PARAMS` redirect params (≤3 hops)
 *   → strip `amp.` host prefix and AMP/`index.*` path tails
 *   → lowercase scheme+host, drop default port (via the URL parser)
 *   → strip the fragment
 *   → delete `TRACKING_PARAMS`/`TRACKING_PARAM_PREFIXES` params (+ opts)
 *   → sort surviving params; drop the non-root trailing slash.
 *
 * Returns the input unchanged when it isn't an absolute http(s) URL.
 */
export function canonicalizeUrl(raw: string, opts?: NormalizeOptions): string {
  const unwrapParams = opts?.unwrapParams ?? UNWRAP_PARAMS;

  let u = isHttpUrl(raw.trim());
  if (!u) return raw;

  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth++) {
    const next = unwrapOnce(u, unwrapParams);
    if (next === u) break;
    u = next;
  }

  if (u.hostname.startsWith("amp.")) u.hostname = u.hostname.slice(4);

  // Trailing-slash strip first so `/x/amp/` resolves to the `/amp` tail.
  let path = u.pathname;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const tail = AMP_PATH_TAILS.find((t) => path.toLowerCase().endsWith(t));
  if (tail) path = path.slice(0, -tail.length);
  u.pathname = path === "" ? "/" : path;

  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
    u.port = "";
  }

  u.hash = "";

  const dropExact = new Set([
    ...TRACKING_PARAMS,
    ...(opts?.trackingParams ?? []),
  ]);
  const dropPrefixes = [
    ...TRACKING_PARAM_PREFIXES,
    ...(opts?.trackingParamPrefixes ?? []),
  ];
  for (const key of [...u.searchParams.keys()]) {
    const k = key.toLowerCase();
    if (dropExact.has(k) || dropPrefixes.some((p) => k.startsWith(p))) {
      u.searchParams.delete(key);
    }
  }
  u.searchParams.sort();

  return u.toString();
}

// ---------------------------------------------------------------------------
// Publisher normalization
// ---------------------------------------------------------------------------

/**
 * Comparison key for publisher names: NFKD, diacritics stripped, lowercased,
 * apostrophes removed, punctuation collapsed to single spaces, leading "the "
 * dropped — "TechCrunch", "techcrunch", "Tech Crunch" all key to
 * `techcrunch`; "The Verge" and "Verge" both key to `verge`.
 */
export function publisherKey(name: string): string {
  const key = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[''ʼ`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return key.startsWith("the ") ? key.slice(4) : key;
}

/**
 * Map a raw publisher string to its config display name. Resolution order:
 * `publisherAliases` (keys normalized through `publisherKey`) →
 * `publishers` list → the whitespace-cleaned input. Never returns empty:
 * an all-punctuation input comes back as the trimmed original.
 */
export function normalizePublisher(raw: string, opts?: NormalizeOptions): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned === "") return cleaned;

  const key = publisherKey(cleaned);
  if (key === "") return cleaned;

  if (opts?.publisherAliases) {
    for (const [alias, canonical] of Object.entries(opts.publisherAliases)) {
      if (publisherKey(alias) === key) return canonical;
    }
  }
  for (const canonical of opts?.publishers ?? []) {
    if (publisherKey(canonical) === key) return canonical;
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Timestamp + title normalization
// ---------------------------------------------------------------------------

/**
 * Reparse a timestamp to strict ISO-8601 UTC (`2026-10-28T09:00:00.000Z`).
 * Unparseable input passes through unchanged — stages don't throw;
 * `validateRawItem` flags bad timestamps.
 */
export function normalizeTimestamp(value: string): string {
  const t = Date.parse(value);
  return Number.isNaN(t) ? value : new Date(t).toISOString();
}

/**
 * Normalized headline used as the near-dedupe token basis (and reusable by
 * classify/rank): same transform as `publisherKey` but keeps a leading
 * "the" — article titles need it for fingerprint fidelity.
 */
export function titleKey(headline: string): string {
  return headline
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

/** Normalize one item. Pure: same input → same output, no I/O. */
export function normalizeItem(item: AdapterRawItem, opts?: NormalizeOptions): NormalizedItem {
  return {
    ...item,
    canonical_url: canonicalizeUrl(item.canonical_url, opts),
    publisher: normalizePublisher(item.publisher, opts),
    published_at: normalizeTimestamp(item.published_at),
    fetched_at: normalizeTimestamp(item.fetched_at),
    title_key: titleKey(item.headline),
  };
}

/**
 * The `normalize` stage: `AdapterRawItem[]` → `NormalizedItem[]`.
 * Order-preserving; each item is normalized independently.
 */
export function normalize(
  items: readonly AdapterRawItem[],
  opts?: NormalizeOptions,
): NormalizedItem[] {
  return items.map((item) => normalizeItem(item, opts));
}
