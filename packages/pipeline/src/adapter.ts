/**
 * C5 — the source-adapter contract (PLAN.md §5.1).
 *
 * Every item in an edition traces to a record fetched from a publisher we
 * trust, by code, with a URL and a timestamp. `RawItem` is THE boundary
 * between adapters (`A1`–`A10`) and the downstream stages (`P1`–`P7`):
 * adapters fetch and map raw payloads into `RawItem[]`; stages only ever see
 * `RawItem`s, never adapter payloads.
 *
 * Field names are coordinated with C2's `EditionSource` so the mapping
 * `RawItem → EditionItem.sources[]` is mechanical:
 *
 *   EditionSource.url          ← RawItem.canonical_url
 *   EditionSource.publisher    ← RawItem.publisher
 *   EditionSource.published_at ← RawItem.published_at
 *   EditionSource.fetched_at   ← RawItem.fetched_at
 *   EditionSource.adapter      ← the emitting adapter's `id`
 *
 * Rules every adapter inherits from PLAN §5.1:
 *  - One file per adapter: `src/sources/<name>.ts` exporting a factory that
 *    returns a `SourceAdapter`.
 *  - Store headline, canonical URL, publisher, published_at, fetched_at,
 *    excerpt ≤ `EXCERPT_MAX_CHARS`, source-specific ids — never bodies.
 *  - Respect robots.txt and rate limits; send the project UA (below).
 *  - A recorded fixture lives at `src/sources/__fixtures__/<name>.json`;
 *    tests replay it through `runAdapterFixture` — never the network.
 *  - An adapter failure degrades a page, never the run: `health()` reports
 *    `{ok: false}` rather than throwing.
 */

// ---------------------------------------------------------------------------
// User-Agent convention (PLAN §5.1 rule)
// ---------------------------------------------------------------------------

/**
 * UA convention: `weekly-ai-edition/<ver> (+<site url>)` — the product name,
 * the package/build version, and a contact URL identifying the project.
 *
 * Until the production domain exists, the contact URL is the repository.
 * Adapters that need a different *format* (e.g. SEC EDGAR's
 * `Company Name contact@email` convention) must keep the same identity:
 * product name + `UA_CONTACT_URL`. Never send a generic library UA.
 */
export const UA_PRODUCT = "weekly-ai-edition";
export const UA_CONTACT_URL = "https://github.com/tayden-b/weekly-ai-edition";

/** Build the project UA string for a given version. */
export function userAgent(version: string): string {
  return `${UA_PRODUCT}/${version} (+${UA_CONTACT_URL})`;
}

/** The UA every adapter sends by default. */
export const USER_AGENT = userAgent("0");

// ---------------------------------------------------------------------------
// RawItem
// ---------------------------------------------------------------------------

/** Hard cap on stored excerpt length (chars) — the "no republishing" rule. */
export const EXCERPT_MAX_CHARS = 300;

/** Engagement fields a RawItem may carry; feed `rank` and Discourse. */
export interface RawItemEngagement {
  /** Hacker News comment count (A2). */
  hn_comments?: number;
  /** Hacker News points (A2). */
  hn_points?: number;
  /** Reddit score (A9). */
  reddit_score?: number;
  /** Reddit comment count (A9). */
  reddit_comments?: number;
}

/**
 * One fetched source record. All timestamps are ISO-8601 strings, matching
 * `EditionSource` field-for-field so stage mapping is mechanical.
 */
export interface RawItem {
  /** The publisher's headline, unedited. */
  headline: string;
  /** Canonical URL of the item at the publisher. */
  canonical_url: string;
  /** Publisher display name, e.g. "OpenAI Blog", "Hacker News". */
  publisher: string;
  /** ISO-8601 timestamp the publisher gave the item. */
  published_at: string;
  /** ISO-8601 timestamp our adapter fetched the record. */
  fetched_at: string;
  /** Publisher's own text, ≤ `EXCERPT_MAX_CHARS`. Never a body, never our prose. */
  excerpt: string;
  /**
   * Source-specific identifiers keyed by id kind — e.g. `{ hn_object_id }`,
   * `{ edgar_accession }`, `{ github_release_tag }`, `{ arxiv_id }`.
   * Drives dedupe lookups and provenance; at least one key expected in
   * practice but the record itself may be empty when a source has no ids.
   */
  source_ids: Record<string, string>;
  hn_comments?: number;
  hn_points?: number;
  reddit_score?: number;
  reddit_comments?: number;
}

/** Fetch window (inclusive bounds) passed to every adapter. */
export interface FetchWindow {
  from: Date;
  to: Date;
}

// ---------------------------------------------------------------------------
// Injectable fetcher + adapter context
// ---------------------------------------------------------------------------

/**
 * The fetch contract adapters use. Structurally `typeof fetch`; tests inject
 * a replay fetcher (see `testing/harness.ts`) so no test touches the network.
 */
export type Fetcher = typeof fetch;

/** Per-call context: injected fetcher, clock, and UA. */
export interface AdapterContext {
  /** Injected HTTP fetcher. Defaults to the platform `fetch`. */
  fetch: Fetcher;
  /** Clock — injected in tests so `fetched_at` is deterministic. */
  now: () => Date;
  /** UA to send; defaults to `USER_AGENT`. */
  userAgent: string;
}

/** Resolve a (possibly partial) context to a complete one. */
export function adapterContext(ctx?: Partial<AdapterContext>): AdapterContext {
  return {
    fetch: ctx?.fetch ?? fetch,
    now: ctx?.now ?? (() => new Date()),
    userAgent: ctx?.userAgent ?? USER_AGENT,
  };
}

/** Result of an adapter `health()` check. Never thrown — always reported. */
export interface AdapterHealth {
  ok: boolean;
  /** Human-readable one-liner, e.g. "HTTP 200" or "ECONNREFUSED". */
  detail: string;
  /** ISO-8601 time the check ran. */
  checked_at?: string;
}

/**
 * The adapter contract.
 *
 * - `map` is the PURE transform: one raw payload (as recorded in
 *   `__fixtures__/<name>.json`) → `RawItem[]`. No network, no clock unless
 *   given `fetchedAt`. The test harness replays fixtures through it.
 * - `fetch` is the live path: builds requests for `window`, calls `map` on
 *   each response body, stamps `fetched_at` from `ctx.now()`. Must never
 *   throw for a single source's failure — catch per request, degrade, and
 *   report via `health()`.
 * - `health` pings the endpoint cheaply and reports `{ok, detail}`; it never
 *   throws.
 */
export interface SourceAdapter {
  /** Adapter id — matches the `adapter:` field in `config/sources.yaml`. */
  readonly id: string;
  fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]>;
  health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth>;
  map(payload: unknown, fetchedAt?: Date): RawItem[];
}

// ---------------------------------------------------------------------------
// Excerpt helpers
// ---------------------------------------------------------------------------

/**
 * Normalize publisher text into a storable excerpt: collapses whitespace,
 * then truncates at the last word boundary within `EXCERPT_MAX_CHARS` so the
 * stored excerpt is always a verbatim substring of the source text (evidence
 * quotes stay checkable, §5.3).
 */
export function toExcerpt(text: string, maxChars: number = EXCERPT_MAX_CHARS): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxChars) return collapsed;
  const head = collapsed.slice(0, maxChars);
  const lastSpace = head.lastIndexOf(" ");
  return (lastSpace > 0 ? head.slice(0, lastSpace) : head).trimEnd();
}

// ---------------------------------------------------------------------------
// RawItem validation (the "code" in "enforced by code + test")
// ---------------------------------------------------------------------------

/** A single failed `validateRawItem` assertion. */
export interface RawItemIssue {
  field: string;
  detail: string;
}

export class RawItemValidationError extends Error {
  constructor(readonly issues: RawItemIssue[]) {
    super(`invalid RawItem: ${issues.map((i) => `${i.field} ${i.detail}`).join("; ")}`);
    this.name = "RawItemValidationError";
  }
}

/** Structural validation — throws `RawItemValidationError` on any violation. */
export function validateRawItem(value: unknown): RawItem {
  const issues: RawItemIssue[] = [];
  const fail = (field: string, detail: string) => issues.push({ field, detail });

  if (typeof value !== "object" || value === null) {
    throw new RawItemValidationError([{ field: "(root)", detail: "must be an object" }]);
  }
  const v = value as Record<string, unknown>;

  if (typeof v.headline !== "string" || v.headline.trim() === "") {
    fail("headline", "must be a non-empty string");
  }

  if (typeof v.canonical_url !== "string") {
    fail("canonical_url", "must be a string");
  } else {
    try {
      const u = new URL(v.canonical_url);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        fail("canonical_url", `must be http(s), got ${u.protocol}`);
      }
    } catch {
      fail("canonical_url", "must be an absolute URL");
    }
  }

  if (typeof v.publisher !== "string" || v.publisher.trim() === "") {
    fail("publisher", "must be a non-empty string");
  }

  for (const field of ["published_at", "fetched_at"] as const) {
    const t = v[field];
    if (typeof t !== "string" || Number.isNaN(Date.parse(t))) {
      fail(field, "must be an ISO-8601 timestamp string");
    }
  }

  if (typeof v.excerpt !== "string" || v.excerpt.trim() === "") {
    fail("excerpt", "must be a non-empty string");
  } else if (v.excerpt.length > EXCERPT_MAX_CHARS) {
    fail("excerpt", `exceeds ${EXCERPT_MAX_CHARS} chars (${v.excerpt.length})`);
  }

  if (typeof v.source_ids !== "object" || v.source_ids === null || Array.isArray(v.source_ids)) {
    fail("source_ids", "must be a record of strings");
  } else {
    for (const [k, sv] of Object.entries(v.source_ids)) {
      if (typeof sv !== "string") fail(`source_ids.${k}`, "must be a string");
    }
  }

  for (const field of ["hn_comments", "hn_points", "reddit_score", "reddit_comments"] as const) {
    const n = v[field];
    if (n !== undefined && (typeof n !== "number" || !Number.isFinite(n) || n < 0)) {
      fail(field, "must be a non-negative finite number when present");
    }
  }

  if (issues.length > 0) throw new RawItemValidationError(issues);
  return value as RawItem;
}

/** Type-guard wrapper around `validateRawItem` (no throw). */
export function isRawItem(value: unknown): value is RawItem {
  try {
    validateRawItem(value);
    return true;
  } catch {
    return false;
  }
}
