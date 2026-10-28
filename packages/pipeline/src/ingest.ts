/**
 * P3 — the ingest orchestrator (PLAN.md §5.2): run every adapter marked
 * `enabled` in `config/sources.yaml` in parallel, isolate failures, and emit
 * the `data/raw/<YYYY-MM-DD>/` cache the rest of the pipeline reads.
 *
 * ## Cache layout (written by `writeIngestCache`)
 *
 *   data/raw/<YYYY-MM-DD>/<source-id>.json   one file per enabled entry:
 *     `{ adapter, source, fetched_at, items }` where items are
 *     `AdapterRawItem` (`RawItem` + `adapter`) — the exact input normalize
 *     (P1) consumes, so I1 reads the cache without re-stamping.
 *   data/raw/<YYYY-MM-DD>/manifest.json      the run's provenance record:
 *     per-source `{ source, adapter, ok, count, error? }`, the fetch window,
 *     run timestamp, and totals.
 *
 * The file is named for the `sources.yaml` entry id, not the adapter id:
 * adapters such as press-wire-rss, sec-edgar, reddit-json and lab-blogs are
 * instantiated once per enabled entry (the A4/A5/A9 per-entry convention),
 * so `<source-id>.json` is the unique, collision-free name and the adapter
 * id lives inside the file + manifest. A `plan-defect` is NOT warranted —
 * `<adapter>.json` in the brief reads as "the adapter instance's file".
 *
 * ## Failure + re-run semantics
 *
 *  - `enabled: false` entries are skipped — documented-off, never a failure.
 *  - A throwing factory or `fetch()` is caught per source and lands in the
 *    manifest as `{ ok: false, error }`: one bad adapter never fails a run
 *    (PLAN §5.1 "degrades the page, never the run").
 *  - Every enabled source writes its file even when it fails (empty `items`)
 *    — a re-run never leaves yesterday's stale records under today's date.
 *  - Re-running for the same date rewrites the same file names in the same
 *    shape; a second run is a no-diff unless publishers added or retracted
 *    items (adapters return feeds' current contents).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  adapterContext,
  type AdapterContext,
  type FetchWindow,
  type SourceAdapter,
} from "./adapter.js";
import type { MarketsConfig, SourceEntry } from "./config.js";
import type { AdapterRawItem } from "./stages/normalize.js";
import { createArxivAdapter } from "./sources/arxiv.js";
import { BENCHMARK_SOURCES, createBenchmarksAdapter } from "./sources/benchmarks.js";
import { createDistributeAdapter } from "./sources/distribute.js";
import { createFixtureAdapter } from "./sources/fixture.js";
import { createGitHubReleasesAdapter } from "./sources/github-releases.js";
import { createHfHubAdapter } from "./sources/hf-hub.js";
import { createHnAlgoliaAdapter, HN_API_BASE } from "./sources/hn.js";
import { createLabBlogsAdapter } from "./sources/lab-blogs.js";
import { createMarketsAdapter } from "./sources/markets.js";
import { createNewsroomAdapter, newsroomFeedsFromSources } from "./sources/newsrooms.js";
import { pressWireAdapterFromEntry } from "./sources/press-wires.js";
import { createProductHuntAdapter } from "./sources/product-hunt.js";
import { redditAdapterFromEntry } from "./sources/reddit-json.js";
import { createSecEdgarAdapter } from "./sources/sec-edgar.js";

// ---------------------------------------------------------------------------
// meta readers — config meta is Record<string, unknown>; narrow defensively
// ---------------------------------------------------------------------------

/** `v` as a non-empty string list, else undefined (caller keeps the default). */
function strList(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string")
    ? (v as string[])
    : undefined;
}

/** `v` as a flat string record (numbers coerce), else undefined. */
function strRecord(v: unknown): Record<string, string> | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === "string" || typeof x === "number") out[k] = String(x);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// The registry — SourceEntry → adapter instance (one per enabled entry)
// ---------------------------------------------------------------------------

/** Extra wiring some adapters need beyond the entry (markets basket). */
export interface IngestDeps {
  /** `loadMarketsConfig("config/markets.json")` — required by `adapter: markets`. */
  markets?: MarketsConfig;
}

/**
 * Build the `SourceAdapter` instance serving one `sources.yaml` entry —
 * the "adapter registry" the brief names. Returns the instance; throws
 * (caught per-entry by `runIngest`) when the entry's meta is unusable or the
 * adapter id is unknown. Adapters with their own `…FromEntry` factory are
 * delegated to; the rest map `entry.meta` onto their factory options.
 */
export function sourceAdapterFromEntry(entry: SourceEntry, deps: IngestDeps = {}): SourceAdapter {
  const meta = entry.meta ?? {};
  switch (entry.adapter) {
    case "lab-blogs":
      // Per-entry instance: the adapter iterates `sources`, so one entry per
      // instance keeps failure isolation 1:1 with sources.yaml.
      return createLabBlogsAdapter({ sources: [entry] });
    case "hn-algolia": {
      // yaml `endpoint` is the `…/search` URL; `baseUrl` is the API root.
      const baseUrl = entry.endpoint.replace(/\/+$/, "").replace(/\/search$/, "") || HN_API_BASE;
      const aiTerms = strList(meta.ai_terms);
      return createHnAlgoliaAdapter({ baseUrl, ...(aiTerms ? { aiTerms } : {}) });
    }
    case "newsroom-rss": {
      const feeds = newsroomFeedsFromSources([entry]);
      if (feeds.length === 0) {
        throw new Error(`entry ${entry.id}: newsroomFeedsFromSources produced no feed`);
      }
      return createNewsroomAdapter({ feeds });
    }
    case "sec-edgar": {
      const forms = strList(meta.forms);
      const aiTerms = strList(meta.ai_terms);
      const items8k = strList(meta.items_8k);
      return createSecEdgarAdapter({
        endpoint: entry.endpoint,
        ...(entry.kind === "json-api" || entry.kind === "atom" ? { kind: entry.kind } : {}),
        ...(forms ? { forms } : {}),
        ...(aiTerms ? { aiTerms } : {}),
        ...(items8k ? { items8k } : {}),
      });
    }
    case "press-wire-rss":
      return pressWireAdapterFromEntry(entry) ?? failNull(entry);
    case "github-releases":
      return createGitHubReleasesAdapter({
        endpoint: entry.endpoint,
        ...(typeof meta.publisher === "string" ? { publisher: meta.publisher } : {}),
      });
    case "hf-hub": {
      const orgs = strList(meta.orgs);
      if (orgs === undefined) {
        throw new Error(`entry ${entry.id}: meta.orgs missing (hf-hub needs the org list)`);
      }
      return createHfHubAdapter({ orgs, endpoint: entry.endpoint });
    }
    case "product-hunt": {
      const topics = strList(meta.topics);
      return createProductHuntAdapter({
        endpoint: entry.endpoint,
        ...(topics ? { topics } : {}),
      });
    }
    case "benchmarks": {
      const spec = BENCHMARK_SOURCES.find((s) => s.id === entry.id);
      if (spec === undefined) {
        throw new Error(`entry ${entry.id}: no BENCHMARK_SOURCES spec — config/code drift`);
      }
      return createBenchmarksAdapter({ sources: [spec] });
    }
    case "arxiv": {
      const searchOrgs = strList(meta.search_orgs);
      const categories = strList(meta.categories);
      return createArxivAdapter({
        baseUrl: entry.endpoint,
        ...(searchOrgs ? { searchOrgs } : {}),
        ...(categories ? { categories } : {}),
      });
    }
    case "markets": {
      const basket = deps.markets?.basket;
      if (basket === undefined || basket.length === 0) {
        throw new Error(`entry ${entry.id}: markets adapter needs config/markets.json basket`);
      }
      const params = strRecord(meta.params);
      return createMarketsAdapter({
        endpoint: entry.endpoint,
        basket,
        provider: entry.id,
        ...(params ? { params } : {}),
      });
    }
    case "reddit-json":
      return redditAdapterFromEntry(entry) ?? failNull(entry);
    case "distribute-software":
      return createDistributeAdapter({ endpoint: entry.endpoint });
    case "fixture":
      return createFixtureAdapter({ endpoint: entry.endpoint });
    default:
      throw new Error(`entry ${entry.id}: unknown adapter "${entry.adapter}"`);
  }
}

/** `…FromEntry` factories return null for wrong-adapter entries — unreachable
 * here (we switch on `entry.adapter`), so null becomes a loud error. */
function failNull(entry: SourceEntry): never {
  throw new Error(`entry ${entry.id}: ${entry.adapter} fromEntry returned null`);
}

// ---------------------------------------------------------------------------
// The run — parallel fetches, per-source failure isolation, manifest records
// ---------------------------------------------------------------------------

/** One manifest row: the `{adapter, ok, count, error?}` record the brief asks
 * for, plus `source` naming the sources.yaml entry the instance served. */
export interface IngestSourceRecord {
  /** `sources.yaml` entry id this row covers, e.g. "pr-newswire". */
  source: string;
  /** Adapter id that ran, e.g. "press-wire-rss". */
  adapter: string;
  ok: boolean;
  /** `RawItem`s emitted (0 on failure or a legitimately quiet feed). */
  count: number;
  /** Failure detail when `ok` is false (factory threw or `fetch` threw). */
  error?: string;
}

/** The `<source-id>.json` file envelope written into the daily cache. */
export interface IngestSourceFile {
  adapter: string;
  source: string;
  /** ISO-8601 run instant (the orchestrator's clock, not per-item). */
  fetched_at: string;
  items: AdapterRawItem[];
}

/** Everything one ingest run produces, before the fs write. */
export interface IngestRun {
  window: FetchWindow;
  /** ISO-8601 instant the run started (shared `fetched_at`). */
  fetched_at: string;
  /** Manifest rows in config order — one per `enabled` entry. */
  sources: IngestSourceRecord[];
  /** Cache files in config order — one per `enabled` entry, failure included. */
  files: IngestSourceFile[];
}

export interface RunIngestOptions extends IngestDeps {
  /** `loadSourcesConfig(...)` output — the enabled subset is what runs. */
  entries: SourceEntry[];
  /** Fetch window passed to every adapter (see `ingestWindowForDate`). */
  window: FetchWindow;
  /** Injectable fetch/clock/UA — tests replay fixtures, never the network. */
  ctx?: Partial<AdapterContext>;
}

/**
 * Run every `enabled` entry's adapter in parallel. Never rejects on a source
 * failure — a throwing factory or `fetch` becomes that source's
 * `{ ok: false, error }` manifest row and an empty-items file.
 */
export async function runIngest(opts: RunIngestOptions): Promise<IngestRun> {
  const ctx = adapterContext(opts.ctx);
  const fetchedAt = ctx.now().toISOString();
  const enabled = opts.entries.filter((e) => e.enabled);

  const results = await Promise.all(
    enabled.map(async (entry): Promise<{ record: IngestSourceRecord; file: IngestSourceFile }> => {
      const emptyFile = (adapter: string): IngestSourceFile => ({
        adapter,
        source: entry.id,
        fetched_at: fetchedAt,
        items: [],
      });

      let instance: SourceAdapter;
      try {
        instance = sourceAdapterFromEntry(
          entry,
          opts.markets !== undefined ? { markets: opts.markets } : {},
        );
      } catch (err) {
        return {
          record: {
            source: entry.id,
            adapter: entry.adapter,
            ok: false,
            count: 0,
            error: errorText(err),
          },
          file: emptyFile(entry.adapter),
        };
      }

      try {
        const items = (await instance.fetch(opts.window, ctx)).map(
          (item): AdapterRawItem => ({ ...item, adapter: instance.id }),
        );
        return {
          record: { source: entry.id, adapter: instance.id, ok: true, count: items.length },
          file: { adapter: instance.id, source: entry.id, fetched_at: fetchedAt, items },
        };
      } catch (err) {
        return {
          record: {
            source: entry.id,
            adapter: instance.id,
            ok: false,
            count: 0,
            error: errorText(err),
          },
          file: emptyFile(instance.id),
        };
      }
    }),
  );

  return {
    window: opts.window,
    fetched_at: fetchedAt,
    sources: results.map((r) => r.record),
    files: results.map((r) => r.file),
  };
}

// ---------------------------------------------------------------------------
// The manifest + the fs write
// ---------------------------------------------------------------------------

/** `data/raw/<date>/manifest.json` — the run's provenance record. */
export interface IngestManifest {
  /** The cache date (UTC, YYYY-MM-DD) — directory this manifest sits in. */
  date: string;
  /** ISO-8601 instant the run started. */
  ran_at: string;
  window: { from: string; to: string };
  sources: IngestSourceRecord[];
  totals: { sources: number; ok: number; failed: number; items: number };
}

export function manifestFor(date: string, run: IngestRun): IngestManifest {
  const ok = run.sources.filter((s) => s.ok).length;
  return {
    date,
    ran_at: run.fetched_at,
    window: { from: run.window.from.toISOString(), to: run.window.to.toISOString() },
    sources: run.sources,
    totals: {
      sources: run.sources.length,
      ok,
      failed: run.sources.length - ok,
      items: run.sources.reduce((n, s) => n + s.count, 0),
    },
  };
}

/**
 * Write `data/raw/<date>/` — every source file (rewritten wholesale, so
 * re-runs are idempotent: same names, same shape) plus `manifest.json`.
 * Returns the written paths (manifest last).
 */
export function writeIngestCache(outDir: string, date: string, run: IngestRun): string[] {
  const dir = join(outDir, date);
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const file of run.files) {
    const path = join(dir, `${file.source}.json`);
    writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
    written.push(path);
  }
  const manifestPath = join(dir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifestFor(date, run), null, 2)}\n`);
  written.push(manifestPath);
  return written;
}

// ---------------------------------------------------------------------------
// The daily window
// ---------------------------------------------------------------------------

/** Default trailing window: the edition's Sat→Fri coverage week, so every
 * daily run re-caches the full week — a missed day never leaves a gap. */
export const INGEST_DEFAULT_DAYS = 7;

/**
 * `[date − (days−1)d 00:00:00Z, date 23:59:59.999Z]` — a `days`-wide inclusive
 * UTC window ending on `date`. Deterministic per date, which is what makes a
 * same-date re-run produce the same file set.
 */
export function ingestWindowForDate(
  date: string,
  days: number = INGEST_DEFAULT_DAYS,
): FetchWindow {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`ingest date must be YYYY-MM-DD, got "${date}"`);
  }
  const to = new Date(`${date}T23:59:59.999Z`);
  const from = new Date(Date.parse(`${date}T00:00:00.000Z`) - (days - 1) * 86_400_000);
  return { from, to };
}
