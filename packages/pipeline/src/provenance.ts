/**
 * P7 — `provenance.json` (PLAN.md §5.3): the per-edition record of every
 * adapter run, item count, failure, and cache hash behind a build — the data
 * the back page and the `.md` twin render.
 *
 * One file lives next to each edition as `editions/<week>/provenance.json`
 * (fixture: `fixtures/<week>/provenance.json`). `buildProvenance` assembles
 * the record from the P3 ingest manifests and the candidate edition;
 * `checkProvenance` is the deterministic re-check the CI gate
 * (`scripts/provenance-check.mts`) runs — it proves the record is complete,
 * internally consistent, and consistent with the edition it accompanies.
 *
 * Layout:
 *
 *   edition        the edition id this record belongs to (`2026-w44`)
 *   version        record schema version (1)
 *   ingest_runs    each P3 ingest manifest consumed: date, ran_at, window
 *   adapter_runs   every per-source manifest row: {date, source, adapter,
 *                  ok, count, error?} — failures are rows with ok:false
 *   item_counts    {fetched, emitted, by_page} — raw items fetched vs
 *                  edition items emitted, per item-bearing page
 *   failures       every failed adapter run flattened {date, source,
 *                  adapter, error}
 *   cache_hashes   repo-relative path of every raw cache file → its
 *                  sha256 — the gate re-hashes files that exist on disk
 *   back_page      {sources_total, source_counts} — the edition's own
 *                  declared numbers, mirrored so the record is the data the
 *                  back page renders
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import type { Edition } from "@weekly/schema";

// ---------------------------------------------------------------------------
// Input types — the P3 ingest manifest (data/raw/<date>/manifest.json)
// ---------------------------------------------------------------------------

/** One manifest row — `{source, adapter, ok, count, error?}` (P3). */
export interface ManifestSourceRow {
  source: string;
  adapter: string;
  ok: boolean;
  count: number;
  error?: string;
}

/** `data/raw/<date>/manifest.json` — a day's ingest provenance record. */
export interface ManifestFile {
  date: string;
  ran_at: string;
  window: { from: string; to: string };
  sources: ManifestSourceRow[];
  totals?: { sources: number; ok: number; failed: number; items: number };
}

/** A manifest plus the sha256 of every cache file it covers. */
export interface IngestCache {
  manifest: ManifestFile;
  /** Repo-relative path (`data/raw/<date>/<file>`) → `sha256:<hex>`. */
  cache_hashes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

export interface ProvenanceAdapterRun extends ManifestSourceRow {
  /** The ingest date this run belongs to. */
  date: string;
}

export interface ProvenanceFailure {
  date: string;
  source: string;
  adapter: string;
  error: string;
}

export interface ProvenanceItemCounts {
  /** Raw items fetched across all adapter runs. */
  fetched: number;
  /** Edition items emitted (sum of by_page). */
  emitted: number;
  /** Item count per item-bearing page. */
  by_page: Record<string, number>;
}

export interface ProvenanceBackPage {
  sources_total: number;
  source_counts: { publisher: string; count: number }[];
}

export interface EditionProvenance {
  edition: string;
  version: 1;
  ingest_runs: { date: string; ran_at: string; window: { from: string; to: string } }[];
  adapter_runs: ProvenanceAdapterRun[];
  item_counts: ProvenanceItemCounts;
  failures: ProvenanceFailure[];
  cache_hashes: Record<string, string>;
  back_page: ProvenanceBackPage;
}

export const PROVENANCE_VERSION = 1;
export const PROVENANCE_FILENAME = "provenance.json";

/** Item-bearing pages for `item_counts.by_page`. */
const ITEM_PAGES = [
  "models",
  "performance",
  "launches",
  "funding",
  "deals",
  "discourse",
] as const;

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** sha256 of a file's exact bytes, `sha256:<hex>`. */
export function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

/**
 * Load one ingest day: the manifest plus a `sha256:` of every `.json` cache
 * file in the directory (manifest included). `keyPrefix` makes the map keys
 * repo-relative — default `data/raw/<basename(dir)>`.
 */
export function loadIngestCache(dir: string, keyPrefix?: string): IngestCache {
  const prefix = keyPrefix ?? `data/raw/${basename(dir)}`;
  const manifest = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf8"),
  ) as ManifestFile;
  const cache_hashes: Record<string, string> = {};
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith(".json")) continue;
    cache_hashes[`${prefix}/${entry}`] = sha256File(join(dir, entry));
  }
  return { manifest, cache_hashes };
}

/**
 * The edition's own source-count table — every item-level source plus the
 * markets page-level sources, flattened by publisher. Sorted count-desc,
 * then alphabetically, so the emitted record is deterministic.
 */
export function collectSourceCounts(
  edition: Edition | Record<string, unknown>,
): { publisher: string; count: number }[] {
  const counts = new Map<string, number>();
  const pages = Array.isArray(edition.pages) ? edition.pages : [];
  for (const raw of pages as Array<Record<string, unknown>>) {
    const items = Array.isArray(raw.items) ? raw.items : [];
    for (const item of items as Array<Record<string, unknown>>) {
      const sources = Array.isArray(item.sources) ? item.sources : [];
      for (const s of sources as Array<Record<string, unknown>>) {
        if (typeof s.publisher !== "string" || s.publisher === "") continue;
        counts.set(s.publisher, (counts.get(s.publisher) ?? 0) + 1);
      }
    }
    const pageSources = Array.isArray(raw.sources) ? raw.sources : [];
    for (const s of pageSources as Array<Record<string, unknown>>) {
      if (typeof s.publisher !== "string" || s.publisher === "") continue;
      counts.set(s.publisher, (counts.get(s.publisher) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([publisher, count]) => ({ publisher, count }))
    .sort((a, b) => b.count - a.count || a.publisher.localeCompare(b.publisher));
}

/** Per-page item counts — only item-bearing pages contribute. */
export function collectItemCounts(
  edition: Edition | Record<string, unknown>,
  fetched: number,
): ProvenanceItemCounts {
  const by_page: Record<string, number> = {};
  const pages = Array.isArray(edition.pages) ? edition.pages : [];
  for (const raw of pages as Array<Record<string, unknown>>) {
    if (typeof raw.type !== "string") continue;
    if (!(ITEM_PAGES as readonly string[]).includes(raw.type)) continue;
    const items = Array.isArray(raw.items) ? raw.items : [];
    by_page[raw.type] = items.length;
  }
  return {
    fetched,
    emitted: Object.values(by_page).reduce((a, b) => a + b, 0),
    by_page,
  };
}

/**
 * Assemble `provenance.json` for an edition from the ingest runs its build
 * consumed. `runs` is every `data/raw/<date>` window the edition drew from
 * (usually one). The `back_page` block mirrors the edition's own declared
 * counts — `checkProvenance` proves they agree.
 */
export function buildProvenance(
  edition: Edition | Record<string, unknown>,
  runs: readonly IngestCache[],
): EditionProvenance {
  const adapter_runs = runs.flatMap(({ manifest }) =>
    manifest.sources.map(
      (s): ProvenanceAdapterRun => ({ date: manifest.date, ...s }),
    ),
  );
  const failures = adapter_runs
    .filter((r) => !r.ok)
    .map(
      (r): ProvenanceFailure => ({
        date: r.date,
        source: r.source,
        adapter: r.adapter,
        error: r.error ?? "unknown error",
      }),
    );
  const fetched = adapter_runs.reduce((n, r) => n + r.count, 0);
  const source_counts = collectSourceCounts(edition);
  const cache_hashes: Record<string, string> = {};
  for (const run of runs) Object.assign(cache_hashes, run.cache_hashes);
  return {
    edition: typeof edition.id === "string" ? edition.id : "",
    version: PROVENANCE_VERSION,
    ingest_runs: runs.map(({ manifest }) => ({
      date: manifest.date,
      ran_at: manifest.ran_at,
      window: manifest.window,
    })),
    adapter_runs,
    item_counts: collectItemCounts(edition, fetched),
    failures,
    cache_hashes,
    back_page: {
      sources_total: source_counts.reduce((n, c) => n + c.count, 0),
      source_counts,
    },
  };
}

// ---------------------------------------------------------------------------
// The deterministic re-check
// ---------------------------------------------------------------------------

/** One violated provenance rule — the gate's failure output. */
export interface ProvenanceIssue {
  /** JSON-path-ish locator inside the record or edition. */
  path: string;
  message: string;
}

const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function backPageOf(edition: Edition | Record<string, unknown>): {
  sources_total?: unknown;
  source_counts?: unknown;
} {
  const pages = Array.isArray(edition.pages) ? edition.pages : [];
  const bp = (pages as Array<Record<string, unknown>>).find(
    (p) => p.type === "back_page",
  );
  return (bp ?? {}) as { sources_total?: unknown; source_counts?: unknown };
}

/**
 * Validate a `provenance.json` against its edition: id match, complete
 * adapter run records, item-count arithmetic, failures flattened from the
 * runs, `sha256:` cache hashes, and the `back_page` block equal to the
 * edition's own declared numbers. Cache-file existence/re-hashing is the
 * caller's job (it needs the filesystem) — see `scripts/provenance-check.mts`.
 */
export function checkProvenance(
  edition: Edition | Record<string, unknown>,
  provenance: unknown,
): ProvenanceIssue[] {
  const issues: ProvenanceIssue[] = [];
  if (!isObject(provenance)) {
    return [{ path: "provenance.json", message: "provenance record is not an object" }];
  }
  const at = "provenance.json";

  if (provenance.edition !== edition.id) {
    issues.push({
      path: `${at}.edition`,
      message: `edition id ${JSON.stringify(provenance.edition)} does not match edition ${JSON.stringify(edition.id)}`,
    });
  }
  if (provenance.version !== PROVENANCE_VERSION) {
    issues.push({
      path: `${at}.version`,
      message: `version ${JSON.stringify(provenance.version)} is not ${PROVENANCE_VERSION}`,
    });
  }

  // adapter_runs — the full per-source record.
  const runs = Array.isArray(provenance.adapter_runs)
    ? (provenance.adapter_runs as Array<Record<string, unknown>>)
    : [];
  if (!Array.isArray(provenance.adapter_runs) || runs.length === 0) {
    issues.push({ path: `${at}.adapter_runs`, message: "must be a non-empty array" });
  }
  let fetched = 0;
  for (const [i, r] of runs.entries()) {
    const path = `${at}.adapter_runs[${i}]`;
    for (const field of ["date", "source", "adapter"] as const) {
      if (typeof r[field] !== "string" || r[field] === "") {
        issues.push({ path: `${path}.${field}`, message: `missing ${field}` });
      }
    }
    if (typeof r.ok !== "boolean") {
      issues.push({ path: `${path}.ok`, message: "ok must be a boolean" });
    } else if (r.ok === false && typeof r.error !== "string") {
      issues.push({ path: `${path}.error`, message: "failed run carries no error" });
    }
    if (typeof r.count !== "number" || !Number.isInteger(r.count) || r.count < 0) {
      issues.push({ path: `${path}.count`, message: "count must be a non-negative integer" });
    } else {
      fetched += r.count;
    }
  }

  // item_counts — arithmetic must reconcile with the runs and the edition.
  const counts = isObject(provenance.item_counts) ? provenance.item_counts : undefined;
  if (counts === undefined) {
    issues.push({ path: `${at}.item_counts`, message: "must be an object" });
  } else {
    if (counts.fetched !== fetched) {
      issues.push({
        path: `${at}.item_counts.fetched`,
        message: `${JSON.stringify(counts.fetched)} does not equal the adapter-run total ${fetched}`,
      });
    }
    const expected = collectItemCounts(edition, fetched);
    if (counts.emitted !== expected.emitted) {
      issues.push({
        path: `${at}.item_counts.emitted`,
        message: `${JSON.stringify(counts.emitted)} does not equal the edition item count ${expected.emitted}`,
      });
    }
    const byPage = isObject(counts.by_page) ? counts.by_page : {};
    for (const [page, n] of Object.entries(expected.by_page)) {
      if (byPage[page] !== n) {
        issues.push({
          path: `${at}.item_counts.by_page.${page}`,
          message: `${JSON.stringify(byPage[page])} does not equal the edition's ${page} item count ${n}`,
        });
      }
    }
  }

  // failures — exactly the failed runs, flattened.
  const expectedFailures = runs
    .filter((r) => r.ok === false)
    .map((r) => `${String(r.date)}|${String(r.source)}|${String(r.adapter)}`);
  const failures = Array.isArray(provenance.failures)
    ? (provenance.failures as Array<Record<string, unknown>>)
    : [];
  if (!Array.isArray(provenance.failures)) {
    issues.push({ path: `${at}.failures`, message: "must be an array" });
  } else if (failures.length !== expectedFailures.length) {
    issues.push({
      path: `${at}.failures`,
      message: `${failures.length} row(s) but adapter_runs record ${expectedFailures.length} failure(s)`,
    });
  }
  for (const [i, f] of failures.entries()) {
    const key = `${String(f.date)}|${String(f.source)}|${String(f.adapter)}`;
    if (!expectedFailures.includes(key)) {
      issues.push({
        path: `${at}.failures[${i}]`,
        message: `no matching failed adapter run for ${key}`,
      });
    }
  }

  // cache_hashes — the integrity surface the caller re-hashes.
  const hashes = isObject(provenance.cache_hashes) ? provenance.cache_hashes : undefined;
  if (hashes === undefined || Object.keys(hashes).length === 0) {
    issues.push({ path: `${at}.cache_hashes`, message: "must be a non-empty map" });
  } else {
    for (const [file, hash] of Object.entries(hashes)) {
      if (typeof hash !== "string" || !SHA256_RE.test(hash)) {
        issues.push({
          path: `${at}.cache_hashes.${file}`,
          message: "hash is not `sha256:<64 hex>`",
        });
      }
    }
  }

  // back_page — the record's numbers must equal the edition's declared ones
  // and the computed truth.
  const computed = collectSourceCounts(edition);
  const computedTotal = computed.reduce((n, c) => n + c.count, 0);
  const declared = backPageOf(edition);
  const rec = isObject(provenance.back_page) ? provenance.back_page : undefined;
  if (rec === undefined) {
    issues.push({ path: `${at}.back_page`, message: "must be an object" });
  } else {
    if (rec.sources_total !== computedTotal) {
      issues.push({
        path: `${at}.back_page.sources_total`,
        message: `${JSON.stringify(rec.sources_total)} does not equal the edition's computed ${computedTotal}`,
      });
    }
    if (
      typeof declared.sources_total === "number" &&
      declared.sources_total !== computedTotal
    ) {
      issues.push({
        path: "pages.back_page.sources_total",
        message: `edition declares ${String(declared.sources_total)} but its items carry ${computedTotal} source(s)`,
      });
    }
    const countMap = new Map(computed.map((c) => [c.publisher, c.count]));
    const recCounts = Array.isArray(rec.source_counts) ? rec.source_counts : [];
    if (recCounts.length !== computed.length) {
      issues.push({
        path: `${at}.back_page.source_counts`,
        message: `${recCounts.length} row(s) but the edition computes ${computed.length} publisher(s)`,
      });
    }
    for (const [i, rc] of (recCounts as Array<Record<string, unknown>>).entries()) {
      const want = typeof rc.publisher === "string" ? countMap.get(rc.publisher) : undefined;
      if (want === undefined || rc.count !== want) {
        issues.push({
          path: `${at}.back_page.source_counts[${i}]`,
          message: `${JSON.stringify(rc.publisher)}:${JSON.stringify(rc.count)} disagrees with the edition's computed count ${String(want)}`,
        });
      }
    }
  }

  return issues;
}
