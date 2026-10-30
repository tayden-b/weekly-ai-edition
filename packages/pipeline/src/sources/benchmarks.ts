/**
 * A7 — `benchmarks`: benchmark publishers for the Performance page
 * (PLAN §5.1). One adapter covers six configured sources — three fetched as
 * the publisher's own data (`mode: data`), three link-only (`mode: link`).
 *
 * Per-publisher findings (verified 2026-10; the licence notes in
 * `config/sources.yaml` carry the same findings):
 *
 *  - LMArena — `lmarena.ai` 403s datacenter UAs (Cloudflare), but LMArena
 *    publishes its leaderboard tables itself as the CC-BY-4.0 dataset
 *    `lmarena-ai/leaderboard-dataset` on Hugging Face — read via the public
 *    datasets-server rows API. DATA.
 *  - Artificial Analysis — free data API exists but requires an `x-api-key`
 *    (account signup); no secrets exist in this build. LINK.
 *  - HF Open LLM Leaderboard — `huggingface.co/api/leaderboards` 401s and the
 *    v2 leaderboard is frozen (open-llm-leaderboard/contents parquet last
 *    modified 2025-03). LINK.
 *  - SWE-bench — `swebench.com` embeds the full leaderboard dataset as a
 *    `<script id="leaderboard-data">` JSON block (the same numbers the site
 *    renders; robots.txt expresses no content-signal restrictions). One
 *    static GET, no API rate limit. DATA.
 *    (The `SWE-bench/experiments` GitHub contents API also works but is
 *    60 req/hr unauthenticated — flaky on shared egress IPs.)
 *  - ARC Prize — a public JSON data layer exists (`/media/data/*.json`), but
 *    the site ToS bars "data mining, robots, or similar data gathering and
 *    extraction tools". Doubtful → LINK.
 *  - Epoch AI — `epoch.ai/data/benchmark_data.zip` is a per-benchmark CSV
 *    bundle whose README grants CC-BY-4.0 ("free to use, distribute, and
 *    reproduce provided the source and authors are credited"). DATA.
 *
 * `map` routing: it handles only self-contained payload shapes —
 * `{features, rows}` (datasets-server / LMArena), `{files: {name: csv}}`
 * (unpacked Epoch bundle), and SWE-bench's embedded leaderboard HTML.
 * Link-mode items need their source spec, so they are built by the exported
 * pure helper `linkModeItem`, called from `fetch`.
 * Any other recorded body maps to [].
 *
 * Epoch transport: live responses are a real zip (`PK\x03\x04` magic) →
 * `unzipSync` → `{files}`. Fixtures record the unpacked `{files}` object so
 * the CSV text stays reviewable — `fetch` detects a non-zip body as JSON.
 */

import { unzipSync, strFromU8 } from "fflate";
import Papa from "papaparse";

import {
  adapterContext,
  type AdapterContext,
  type AdapterHealth,
  type FetchWindow,
  type RawItem,
  type SourceAdapter,
  toExcerpt,
} from "../adapter.js";
import type { SourceMode } from "../config.js";

export const BENCHMARKS_ADAPTER_ID = "benchmarks";

// ---------------------------------------------------------------------------
// Source specs — mirrored as data in config/sources.yaml (test keeps in sync)
// ---------------------------------------------------------------------------

type BenchmarkPipeline = "lmarena-rows" | "swebench" | "epoch-zip" | "page";

export interface BenchmarkSourceSpec {
  /** sources.yaml entry id. */
  id: string;
  /** RawItem.publisher. */
  publisher: string;
  /** data = store reported values; link = headline+link only (ToS-doubtful). */
  mode: SourceMode;
  /** Which fetch pipeline serves this source. */
  pipeline: BenchmarkPipeline;
  /** Fetch URL — the yaml `endpoint` (params appended per pipeline). */
  endpoint: string;
  /** Reader-facing URL stored as RawItem.canonical_url. */
  canonicalUrl: string;
  /** lmarena-rows: datasets-server query params. */
  dataset?: string;
  config?: string;
  split?: string;
  /** swebench: leaderboard splits to include (lowercase board names). */
  splits?: string[];
}

/** The six §5.1 benchmark sources, in sources.yaml order. */
export const BENCHMARK_SOURCES: readonly BenchmarkSourceSpec[] = [
  {
    id: "lmarena-leaderboard",
    publisher: "LMArena",
    mode: "data",
    pipeline: "lmarena-rows",
    endpoint: "https://datasets-server.huggingface.co/rows",
    canonicalUrl: "https://lmarena.ai/leaderboard",
    dataset: "lmarena-ai/leaderboard-dataset",
    config: "text",
    split: "latest",
  },
  {
    id: "artificial-analysis",
    publisher: "Artificial Analysis",
    mode: "link",
    pipeline: "page",
    endpoint: "https://artificialanalysis.ai/models",
    canonicalUrl: "https://artificialanalysis.ai/models",
  },
  {
    id: "hf-open-llm-leaderboard",
    publisher: "Hugging Face",
    mode: "link",
    pipeline: "page",
    endpoint: "https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",
    canonicalUrl: "https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",
  },
  {
    id: "swe-bench",
    publisher: "SWE-bench",
    mode: "data",
    pipeline: "swebench",
    endpoint: "https://www.swebench.com/",
    canonicalUrl: "https://www.swebench.com/",
    splits: ["verified", "lite"],
  },
  {
    id: "arc-prize-leaderboard",
    publisher: "ARC Prize",
    mode: "link",
    pipeline: "page",
    endpoint: "https://arcprize.org/leaderboard",
    canonicalUrl: "https://arcprize.org/leaderboard",
  },
  {
    id: "epoch-ai-data",
    publisher: "Epoch AI",
    mode: "data",
    pipeline: "epoch-zip",
    endpoint: "https://epoch.ai/data/benchmark_data.zip",
    canonicalUrl: "https://epoch.ai/benchmarks",
  },
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** YYYY-MM-DD → ISO at day start (publisher dates arrive date-only). */
const dateToIso = (d: string) => `${d}T00:00:00.000Z`;

/** Verbatim field rendering for excerpts — the publisher's own values. */
function excerptFields(fields: Array<[string, unknown]>): string {
  return toExcerpt(
    fields
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(" · "),
  );
}

function inWindow(iso: string, window: FetchWindow): boolean {
  const t = Date.parse(iso);
  return t >= window.from.getTime() && t <= window.to.getTime();
}

/**
 * Per-row provenance URL. P1 dedupe exact-collapses on `adapter +
 * canonical_url`, so a leaderboard whose rows all share one page URL would
 * merge into a single item (#69). Non-tracking params survive
 * `canonicalizeUrl` (fragments don't), so the row's identity rides along as
 * a query — `?model=` is also LMArena's real per-model view param.
 */
function rowUrl(canonicalUrl: string, params: Record<string, string>): string {
  const u = new URL(canonicalUrl);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// ---------------------------------------------------------------------------
// LMArena — datasets-server rows (CC-BY-4.0 leaderboard-dataset)
// ---------------------------------------------------------------------------

interface DatasetsServerResponse {
  features?: Array<{ name?: string }>;
  rows?: Array<{ row?: Record<string, unknown> }>;
  num_rows_total?: number;
}

const isLmarenaResponse = (p: unknown): p is DatasetsServerResponse =>
  isRecord(p) && Array.isArray(p.rows) && Array.isArray(p.features);

function mapLmarenaRows(
  payload: DatasetsServerResponse,
  spec: BenchmarkSourceSpec,
  fetchedAt: Date,
): RawItem[] {
  const items: RawItem[] = [];
  for (const { row } of payload.rows ?? []) {
    if (!row) continue;
    const model = typeof row.model_name === "string" ? row.model_name : "";
    const publishDate =
      typeof row.leaderboard_publish_date === "string" ? row.leaderboard_publish_date : "";
    const category = typeof row.category === "string" ? row.category : "overall";
    if (!model || !publishDate) continue;

    const rank = typeof row.rank === "number" ? row.rank : undefined;
    items.push({
      headline: `LMArena ${spec.config ?? ""} — ${model}${rank !== undefined ? ` (#${rank})` : ""}`,
      canonical_url: rowUrl(spec.canonicalUrl, {
        model,
        ...(category !== "overall" ? { category } : {}),
      }),
      publisher: spec.publisher,
      published_at: dateToIso(publishDate),
      fetched_at: fetchedAt.toISOString(),
      excerpt: excerptFields([
        ["rank", row.rank],
        ["rating", row.rating],
        ["vote_count", row.vote_count],
        ["organization", row.organization],
        ["leaderboard_publish_date", row.leaderboard_publish_date],
      ]),
      source_ids: {
        lmarena_model: model,
        lmarena_category: category,
      },
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// SWE-bench — swebench.com's embedded `leaderboard-data` JSON block
// ---------------------------------------------------------------------------

interface SwebenchLeaderboard {
  name?: string;
  results?: Array<Record<string, unknown>>;
}

/** Pull the leaderboard JSON out of the leaderboard page's <script> block. */
function extractSwebenchData(html: string): SwebenchLeaderboard[] | null {
  const m = /<script[^>]+id="leaderboard-data"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m?.[1]) return null;
  try {
    const data = JSON.parse(m[1]) as unknown;
    return Array.isArray(data) ? (data as SwebenchLeaderboard[]) : null;
  } catch {
    return null;
  }
}

const isSwebenchPage = (p: unknown): p is string =>
  typeof p === "string" && p.includes('id="leaderboard-data"');

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

/**
 * The page's embedded leaderboard rows → RawItems for the configured splits.
 * `date` is the site's own submission date; `folder` is the experiments-repo
 * submission directory, kept as provenance (source_ids + the derived dir URL).
 */
export function mapSwebenchPage(
  html: string,
  spec: BenchmarkSourceSpec,
  fetchedAt: Date,
): RawItem[] {
  const boards = extractSwebenchData(html);
  if (!boards) return [];
  const wanted = new Set((spec.splits ?? []).map((s) => s.toLowerCase()));
  const items: RawItem[] = [];
  for (const board of boards) {
    const lb = str(board.name)?.toLowerCase();
    if (!lb || !wanted.has(lb)) continue;
    for (const row of board.results ?? []) {
      const date = str(row.date);
      if (!date || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) continue;
      const folder = str(row.folder);
      const name = str(row.name) ?? folder ?? "submission";
      const resolved = typeof row.resolved === "number" ? row.resolved : undefined;
      items.push({
        headline: `SWE-bench ${lb}: ${name}${resolved !== undefined ? ` — ${resolved}%` : ""}`,
        canonical_url: folder
          ? `https://github.com/SWE-bench/experiments/tree/main/evaluation/${lb}/${folder}`
          : rowUrl(spec.canonicalUrl, { split: lb, submission: name }),
        publisher: spec.publisher,
        published_at: dateToIso(date),
        fetched_at: fetchedAt.toISOString(),
        excerpt: excerptFields([
          ["resolved", row.resolved],
          ["agent", row.agent],
          ["model_org", row.model_org],
          ["model_release_date", row.model_release_date],
          ["checked", row.checked],
          ["warning", row.warning],
        ]),
        source_ids: { swebench_submission: folder ?? name, swebench_split: lb },
      });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Epoch AI — benchmark_data.zip unpacked to {files: {name: csv}} (CC-BY-4.0)
// ---------------------------------------------------------------------------

interface EpochFileMap {
  files: Record<string, string>;
}

const isEpochFileMap = (p: unknown): p is EpochFileMap =>
  isRecord(p) &&
  isRecord(p.files) &&
  Object.values(p.files).every((v) => typeof v === "string");

/** Friendly names for the bundle's per-benchmark CSVs (fallback: the stem). */
const EPOCH_BENCH_NAMES: Record<string, string> = {
  gpqa_diamond: "GPQA Diamond",
  swe_bench_verified: "SWE-bench Verified",
  math_level_5: "MATH Level 5",
  otis_mock_aime_2024_2025: "OTIS Mock AIME 2024/2025",
  frontiermath: "FrontierMath",
  frontiermath_tier_4: "FrontierMath Tier 4",
  frontiermath_tiers_1_3_v2: "FrontierMath Tiers 1–3 v2",
  frontiermath_tier_4_v2: "FrontierMath Tier 4 v2",
  ebr_bench: "EBR-Bench",
  simpleqa_verified: "SimpleQA Verified",
  chess_puzzles: "Chess Puzzles",
};

function mapEpochFiles(payload: EpochFileMap, spec: BenchmarkSourceSpec, fetchedAt: Date): RawItem[] {
  const items: RawItem[] = [];
  for (const [file, csv] of Object.entries(payload.files)) {
    if (!file.endsWith(".csv")) continue;
    const stem = file.replace(/\.csv$/, "");
    const bench = EPOCH_BENCH_NAMES[stem] ?? stem.replace(/_/g, " ");
    const rows = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    }).data;
    for (const row of rows) {
      const model = row["Model version"]?.trim();
      if (!model) continue;
      const startedAt = row["Started at"]?.trim();
      const releaseDate = row["Release date"]?.trim();
      const published_at =
        startedAt && !Number.isNaN(Date.parse(startedAt))
          ? new Date(startedAt).toISOString()
          : releaseDate
            ? dateToIso(releaseDate)
            : null;
      if (!published_at) continue;

      const id = row.id?.trim() || `${stem}:${model}`;
      items.push({
        headline: `${bench}: ${model}`,
        canonical_url: rowUrl(spec.canonicalUrl, { benchmark: stem, model }),
        publisher: spec.publisher,
        published_at,
        fetched_at: fetchedAt.toISOString(),
        excerpt: excerptFields([
          ["mean_score", row.mean_score],
          ["Best score (across scorers)", row["Best score (across scorers)"]],
          ["Organization", row.Organization],
          ["Release date", row["Release date"]],
        ]),
        source_ids: { epoch_eval_id: id, epoch_benchmark: stem },
      });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Link-mode items — headline + link only, nothing scraped (ToS-doubtful)
// ---------------------------------------------------------------------------

function htmlTitle(html: string): string | null {
  const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return m?.[1]?.trim() || null;
}

function htmlMetaDescription(html: string): string | null {
  const m =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(html);
  return m?.[1]?.trim() || null;
}

/**
 * Build the one link-mode RawItem a source emits per fetch: the page's own
 * <title>/meta description (publisher text), the leaderboard URL, and the
 * response's Last-Modified as published_at when the server offers one (else
 * the fetch instant — the honest timestamp for a link snapshot).
 */
export function linkModeItem(
  spec: BenchmarkSourceSpec,
  html: string,
  fetchedAt: Date,
  lastModified?: string | null,
): RawItem {
  const title = htmlTitle(html) ?? spec.publisher;
  const published =
    lastModified && !Number.isNaN(Date.parse(lastModified))
      ? new Date(lastModified).toISOString()
      : fetchedAt.toISOString();
  return {
    headline: title,
    canonical_url: spec.canonicalUrl,
    publisher: spec.publisher,
    published_at: published,
    fetched_at: fetchedAt.toISOString(),
    excerpt: toExcerpt(htmlMetaDescription(html) ?? title),
    source_ids: { benchmark_source: spec.id },
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export interface BenchmarksAdapterOptions {
  /** Source specs; defaults mirror config/sources.yaml `adapter: benchmarks`. */
  sources?: readonly BenchmarkSourceSpec[];
  /** Min ms between request starts (courtesy). Default 1000. */
  minRequestIntervalMs?: number;
  /** lmarena-rows page size (rows API max). Default 100. */
  lmarenaPageSize?: number;
}

export function createBenchmarksAdapter(opts: BenchmarksAdapterOptions = {}): SourceAdapter {
  const sources = opts.sources ?? BENCHMARK_SOURCES;
  const minInterval = opts.minRequestIntervalMs ?? 1000;
  const pageSize = opts.lmarenaPageSize ?? 100;

  /** Sequential GETs ≥ minInterval apart; throws only to the caller's catch. */
  async function get(url: string, ctx: AdapterContext, lastStart: { t: number }): Promise<Response> {
    const wait = lastStart.t + minInterval - Date.now();
    if (lastStart.t > 0 && wait > 0) await sleep(wait);
    lastStart.t = Date.now();
    const res = await ctx.fetch(url, { headers: { "user-agent": ctx.userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res;
  }

  function lmarenaUrl(spec: BenchmarkSourceSpec): string {
    const p = new URLSearchParams({
      dataset: spec.dataset ?? "",
      config: spec.config ?? "",
      split: spec.split ?? "",
      offset: "0",
      length: String(pageSize),
    });
    return `${spec.endpoint}?${p}`;
  }

  /** A URL that answers like the pipeline's real request — the bare
   *  datasets-server endpoint 422s without its query params. */
  function healthUrl(spec: BenchmarkSourceSpec): string {
    return spec.pipeline === "lmarena-rows" ? lmarenaUrl(spec) : spec.endpoint;
  }

  async function fetchLmarena(
    spec: BenchmarkSourceSpec,
    window: FetchWindow,
    ctx: AdapterContext,
    lastStart: { t: number },
    fetchedAt: Date,
  ): Promise<RawItem[]> {
    const res = await get(lmarenaUrl(spec), ctx, lastStart);
    const body = (await res.json()) as unknown;
    return mapLmarenaRows(body as DatasetsServerResponse, spec, fetchedAt).filter((i) =>
      inWindow(i.published_at, window),
    );
  }

  async function fetchSwebench(
    spec: BenchmarkSourceSpec,
    window: FetchWindow,
    ctx: AdapterContext,
    lastStart: { t: number },
    fetchedAt: Date,
  ): Promise<RawItem[]> {
    const res = await get(spec.endpoint, ctx, lastStart);
    return mapSwebenchPage(await res.text(), spec, fetchedAt).filter((i) =>
      inWindow(i.published_at, window),
    );
  }

  async function fetchEpoch(
    spec: BenchmarkSourceSpec,
    window: FetchWindow,
    ctx: AdapterContext,
    lastStart: { t: number },
    fetchedAt: Date,
  ): Promise<RawItem[]> {
    const res = await get(spec.endpoint, ctx, lastStart);
    const buf = new Uint8Array(await res.arrayBuffer());
    // Real zip → unpack; recorded fixture ({files: {…}} JSON) → use as-is.
    let payload: EpochFileMap;
    if (buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
      const unzipped = unzipSync(buf);
      payload = {
        files: Object.fromEntries(
          Object.entries(unzipped).map(([name, bytes]) => [name, strFromU8(bytes)]),
        ),
      };
    } else {
      payload = JSON.parse(new TextDecoder().decode(buf)) as EpochFileMap;
    }
    return mapEpochFiles(payload, spec, fetchedAt).filter((i) =>
      inWindow(i.published_at, window),
    );
  }

  async function fetchLinkPage(
    spec: BenchmarkSourceSpec,
    ctx: AdapterContext,
    lastStart: { t: number },
    fetchedAt: Date,
  ): Promise<RawItem[]> {
    const res = await get(spec.endpoint, ctx, lastStart);
    return [linkModeItem(spec, await res.text(), fetchedAt, res.headers.get("last-modified"))];
  }

  return {
    id: BENCHMARKS_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      const lastStart = { t: 0 };
      const items: RawItem[] = [];
      for (const spec of sources) {
        try {
          if (spec.pipeline === "lmarena-rows") {
            items.push(...(await fetchLmarena(spec, window, c, lastStart, fetchedAt)));
          } else if (spec.pipeline === "swebench") {
            items.push(...(await fetchSwebench(spec, window, c, lastStart, fetchedAt)));
          } else if (spec.pipeline === "epoch-zip") {
            items.push(...(await fetchEpoch(spec, window, c, lastStart, fetchedAt)));
          } else {
            items.push(...(await fetchLinkPage(spec, c, lastStart, fetchedAt)));
          }
        } catch {
          continue; // a failed source degrades its page, never the run (§5.1)
        }
      }
      return items;
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const checked_at = c.now().toISOString();
      const failing: string[] = [];
      for (const spec of sources) {
        try {
          const res = await c.fetch(healthUrl(spec), {
            method: "HEAD",
            headers: { "user-agent": c.userAgent },
          });
          if (!res.ok) failing.push(`${spec.id} → HTTP ${res.status}`);
        } catch (err) {
          failing.push(`${spec.id} → ${String(err)}`);
        }
      }
      return {
        ok: failing.length === 0,
        detail:
          failing.length === 0
            ? `${sources.length}/${sources.length} sources reachable`
            : `${sources.length - failing.length}/${sources.length} reachable; ${failing.join("; ")}`,
        checked_at,
      };
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      // Self-contained shapes only — see file header for the routing table.
      if (isLmarenaResponse(payload)) {
        return mapLmarenaRows(
          payload,
          sources.find((s) => s.pipeline === "lmarena-rows") ?? BENCHMARK_SOURCES[0]!,
          fetchedAt,
        );
      }
      if (isEpochFileMap(payload)) {
        return mapEpochFiles(
          payload,
          sources.find((s) => s.pipeline === "epoch-zip") ?? BENCHMARK_SOURCES.at(-1)!,
          fetchedAt,
        );
      }
      if (isSwebenchPage(payload)) {
        return mapSwebenchPage(
          payload,
          sources.find((s) => s.pipeline === "swebench") ?? BENCHMARK_SOURCES[3]!,
          fetchedAt,
        );
      }
      return [];
    },
  };
}
