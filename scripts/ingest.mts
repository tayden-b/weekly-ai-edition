/**
 * `pnpm ingest` — the P3 daily ingest (PLAN.md §5.2).
 *
 * Runs every `enabled` adapter in `config/sources.yaml` in parallel and
 * writes `data/raw/<YYYY-MM-DD>/` — one `<source-id>.json` per entry plus a
 * `manifest.json` provenance record (per-source ok/count/error + window).
 * A source failure never fails the run.
 *
 * Flags: `--date YYYY-MM-DD` (default: today, UTC) · `--days N` (window
 * lookback, default 7) · `--config <path>` · `--markets <path>` ·
 * `--out <dir>` (paths default to the repo's config/ + data/raw/).
 */
import { join, resolve } from "node:path";

import {
  INGEST_DEFAULT_DAYS,
  ingestWindowForDate,
  loadMarketsConfig,
  loadSourcesConfig,
  runIngest,
  writeIngestCache,
} from "@weekly/pipeline";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const date = arg("--date") ?? new Date().toISOString().slice(0, 10);
const daysArg = arg("--days");
const days = daysArg !== undefined ? Number(daysArg) : INGEST_DEFAULT_DAYS;
if (!Number.isInteger(days) || days < 1) {
  console.error(`ingest: --days must be a positive integer, got "${daysArg}"`);
  process.exit(1);
}

// resolve() honors absolute paths — flags may be repo-relative or absolute.
const entries = loadSourcesConfig(resolve(ROOT, arg("--config") ?? "config/sources.yaml"));
const markets = loadMarketsConfig(resolve(ROOT, arg("--markets") ?? "config/markets.json"));
const outDir = resolve(ROOT, arg("--out") ?? "data/raw");

const window = ingestWindowForDate(date, days);
console.log(
  `ingest ${date} — window ${window.from.toISOString()} → ${window.to.toISOString()} ` +
    `(${entries.filter((e) => e.enabled).length} enabled sources)`,
);

const run = await runIngest({ entries, markets, window });
const written = writeIngestCache(outDir, date, run);

for (const s of run.sources) {
  console.log(
    `${s.ok ? " ok" : "ERR"} ${s.source} (${s.adapter}) — ${s.count} item(s)` +
      (s.error !== undefined ? ` — ${s.error}` : ""),
  );
}

const manifest = written[written.length - 1]!;
const failed = run.sources.filter((s) => !s.ok);
console.log(
  `\n${written.length - 1} source files + manifest → ${join(outDir, date)}\n` +
    `totals: ${run.sources.reduce((n, s) => n + s.count, 0)} item(s), ` +
    `${failed.length} failed source(s)${failed.length > 0 ? ` (${failed.map((s) => s.source).join(", ")})` : ""}`,
);
console.log(`manifest: ${manifest}`);
