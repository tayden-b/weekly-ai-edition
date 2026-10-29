/**
 * `pnpm edition:build` — the end-to-end weekly build (PLAN §5.2, I1):
 *
 *   ingest (data/raw cache + live fallback) → normalize → dedupe
 *   → classify → rank → extract → draft → emit → verify →
 *   editions/<week>.json + editions/<week>/{provenance,verify.*,...}
 *
 * LLM stages run through the session `llm()` seam (PLAN §8) — no external
 * API. Two modes:
 *
 *   --mode session (default)  each stage writes <dir>/<stage>.request.json
 *                             + .prompt.md then waits for the session to
 *                             write <dir>/<stage>.response.json
 *   --mode replay             the recorded <dir>/<stage>.response.json is
 *                             replayed verbatim — deterministic rebuilds
 *
 * Flags:
 *   --week <YYYY-Www>     required, e.g. 2026-W44 (the Sat→Fri edition week)
 *   --dir <dir>           session hand-off dir (default editions/<week>/)
 *   --data <dir>          ingest cache root (default data/raw/)
 *   --out <dir>           editions root (default editions/)
 *   --fixture <path>      fixture edition to fold in as a pool
 *                         (default fixtures/<week>/edition.json when it
 *                         exists; --no-fixture disables)
 *   --ingest auto|cache   `auto` (default): days in the week with no cache
 *                         coverage are fetched live and cached under
 *                         data/raw/<date>/; `cache`: committed cache only
 *   --style <path>        STYLE.md (default ./STYLE.md)
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { renderCoverArt } from "@weekly/cover/render";
import type { Edition } from "@weekly/schema";
import {
  buildProvenance,
  classify,
  createReplayDrafterFromFile,
  createReplayExtractorFromFile,
  createReplayLlmFromFile,
  createReplayVerifierFromFile,
  createSessionDrafter,
  createSessionExtractor,
  createSessionLlm,
  createSessionVerifier,
  dedupe,
  draft,
  emitEdition,
  FIXTURE_SOURCE_ID_KEY,
  ingestWindowForDate,
  loadCompaniesConfig,
  loadIngestCache,
  loadMarketsConfig,
  loadSourcesConfig,
  normalize,
  rank,
  runIngest,
  sha256File,
  verifyEdition,
  verifyItemsFromEdition,
  extract,
  type AdapterRawItem,
  type IngestCache,
  type ManifestFile,
  writeIngestCache,
} from "@weekly/pipeline";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}
function flagSet(flag: string): boolean {
  return process.argv.includes(flag);
}

// --- args ------------------------------------------------------------------

const weekArg = arg("--week");
if (weekArg === undefined) {
  console.error("edition:build: --week <YYYY-Www> is required");
  process.exit(1);
}
const weekMatch = /^(\d{4})-[Ww](\d{2})$/.exec(weekArg);
if (weekMatch === null) {
  console.error(`edition:build: --week must look like 2026-W44, got "${weekArg}"`);
  process.exit(1);
}
const weekYear = Number(weekMatch[1]);
const weekNum = Number(weekMatch[2]);
const weekId = `${weekYear}-w${String(weekNum).padStart(2, "0")}`;

/** The edition week is Sat→Fri (PLAN §5.2): `--week` names the ISO week —
 * its Friday is `date_end`, the Saturday six days before is `date_start`. */
function editionWindow(year: number, week: number): { start: string; end: string } {
  // ISO week 1 contains Jan 4; its Monday anchors the count.
  const jan4 = Date.UTC(year, 0, 4);
  const dow = new Date(jan4).getUTCDay(); // 0=Sun..6=Sat
  const w1Monday = jan4 - ((dow + 6) % 7) * 86_400_000;
  const friday = w1Monday + (week - 1) * 7 * 86_400_000 + 4 * 86_400_000;
  const saturday = friday - 6 * 86_400_000;
  const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
  return { start: iso(saturday), end: iso(friday) };
}

const { start: dateStart, end: dateEnd } = editionWindow(weekYear, weekNum);
const dateEndMs = Date.parse(`${dateEnd}T23:59:59.999Z`);
const dateStartMs = Date.parse(`${dateStart}T00:00:00.000Z`);

const mode = arg("--mode") ?? "session";
if (mode !== "session" && mode !== "replay") {
  console.error(`edition:build: --mode must be session|replay, got "${mode}"`);
  process.exit(1);
}
const ingestMode = arg("--ingest") ?? "auto";
if (ingestMode !== "auto" && ingestMode !== "cache") {
  console.error(`edition:build: --ingest must be auto|cache, got "${ingestMode}"`);
  process.exit(1);
}

const dataRoot = resolve(ROOT, arg("--data") ?? "data/raw");
const outRoot = resolve(ROOT, arg("--out") ?? "editions");
const dir = resolve(ROOT, arg("--dir") ?? `editions/${weekId}`);
const stylePath = resolve(ROOT, arg("--style") ?? "STYLE.md");
const fixturePath = flagSet("--no-fixture")
  ? undefined
  : resolve(ROOT, arg("--fixture") ?? `fixtures/${weekId}/edition.json`);

console.log(
  `edition:build ${weekId} — window ${dateStart} → ${dateEnd}, mode=${mode}, ingest=${ingestMode}`,
);

// --- config ----------------------------------------------------------------

const entries = loadSourcesConfig(resolve(ROOT, "config/sources.yaml"));
const companies = loadCompaniesConfig(resolve(ROOT, "config/companies.yaml"));
const markets = loadMarketsConfig(resolve(ROOT, "config/markets.json"));
const styleMd = readFileSync(stylePath, "utf8");
const styleRev = (() => {
  try {
    return execFileSync("git", ["log", "-1", "--format=%H", "--", relative(ROOT, stylePath)], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
})();

const publisherNames = new Set<string>();
for (const e of entries) {
  const p = e.meta?.["publisher"];
  if (typeof p === "string" && p !== "") publisherNames.add(p);
}
for (const p of ["Stooq", "SEC EDGAR", "distribute.software", "Hacker News"]) {
  publisherNames.add(p);
}

// --- ingest: committed cache + live fallback -------------------------------

interface RawDay {
  dir: string;
  manifest: ManifestFile;
}

const rawDays: RawDay[] = [];
if (existsSync(dataRoot)) {
  for (const name of readdirSync(dataRoot).sort()) {
    const manifestPath = join(dataRoot, name, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestFile;
    const from = Date.parse(manifest.window.from);
    const to = Date.parse(manifest.window.to);
    // a day's cache contributes if its fetch window overlaps the edition's
    if (from <= dateEndMs && to >= dateStartMs) rawDays.push({ dir: name, manifest });
  }
}
console.log(`ingest: ${rawDays.length} cache day(s) overlap the window`);

if (ingestMode === "auto") {
  const today = new Date().toISOString().slice(0, 10);
  for (let ms = dateStartMs; ms <= dateEndMs; ms += 86_400_000) {
    const day = new Date(ms).toISOString().slice(0, 10);
    if (day > today) continue; // can't fetch the future
    const covered = rawDays.some(
      (d) => d.manifest.date >= day && Date.parse(d.manifest.window.from) <= ms,
    );
    if (covered) continue;
    console.log(`ingest: ${day} has no cache — fetching live`);
    try {
      const run = await runIngest({
        entries,
        markets,
        window: ingestWindowForDate(day),
      });
      writeIngestCache(dataRoot, day, run);
      rawDays.push({
        dir: day,
        manifest: JSON.parse(readFileSync(join(dataRoot, day, "manifest.json"), "utf8")),
      });
      console.log(
        `ingest: ${day} cached — ${run.sources.reduce((n, s) => n + s.count, 0)} item(s), ` +
          `${run.sources.filter((s) => !s.ok).length} failed source(s)`,
      );
    } catch (err) {
      console.warn(`ingest: ${day} live fetch failed (${String(err)}) — continuing`);
    }
  }
}

const runs: IngestCache[] = rawDays.map((d) => loadIngestCache(join(dataRoot, d.dir)));

const items: AdapterRawItem[] = [];
for (const d of rawDays) {
  const dayDir = join(dataRoot, d.dir);
  for (const file of readdirSync(dayDir).sort()) {
    if (file === "manifest.json" || !file.endsWith(".json")) continue;
    const doc = JSON.parse(readFileSync(join(dayDir, file), "utf8")) as {
      adapter: string;
      source: string;
      items: AdapterRawItem[];
    };
    for (const item of doc.items) {
      items.push({
        ...item,
        adapter: item.adapter ?? doc.adapter,
        source_ids: { ...item.source_ids, source: doc.source },
      });
    }
  }
}
console.log(`ingest: ${items.length} raw item(s) from cache`);

// --- fixture pool ----------------------------------------------------------

/** Synthesize RawItems from a committed fixture edition: each recorded
 * source becomes one item; `source_ids.fixture` tags the pool so emit can
 * prefer real records and the emitted edition stays self-describing. */
function fixtureToRawItems(edition: Record<string, unknown>): AdapterRawItem[] {
  const out: AdapterRawItem[] = [];
  const pages = Array.isArray(edition["pages"]) ? edition["pages"] : [];
  for (const raw of pages as Array<Record<string, unknown>>) {
    const page = raw["type"];
    const itemsForPage: Array<Record<string, unknown>> = [];
    if (page === "markets") {
      // dataset page: page-level sources only — synthesize a headline from
      // the ticker prefix ("US:NVDA — …") or a generic label.
      for (const s of (raw["sources"] ?? []) as Array<Record<string, unknown>>) {
        const excerpt = typeof s["excerpt"] === "string" ? s["excerpt"] : "";
        const ticker = /^[A-Z]{2}:([A-Z.]+)/.exec(excerpt)?.[1];
        // Stamp `source_ids.ticker` like the real markets adapter — dedupe
        // must never merge different tickers' series items.
        itemsForPage.push({
          headline: `${ticker ?? "Markets"} weekly closing series`,
          source: s,
          ...(ticker ? { ticker } : {}),
        });
      }
    } else {
      for (const it of (raw["items"] ?? []) as Array<Record<string, unknown>>) {
        const headline = typeof it["headline"] === "string" ? it["headline"] : "";
        for (const s of (it["sources"] ?? []) as Array<Record<string, unknown>>) {
          itemsForPage.push({ headline, source: s });
        }
      }
    }
    for (const { headline, source, ticker } of itemsForPage) {
      const s = source as Record<string, unknown>;
      out.push({
        adapter: typeof s["adapter"] === "string" ? s["adapter"] : "fixture",
        headline: String(headline),
        canonical_url: String(s["url"] ?? ""),
        publisher: String(s["publisher"] ?? ""),
        published_at: String(s["published_at"] ?? ""),
        fetched_at: String(s["fetched_at"] ?? ""),
        excerpt: typeof s["excerpt"] === "string" ? s["excerpt"] : "",
        source_ids: {
          ...(typeof s["source_ids"] === "object" && s["source_ids"] !== null
            ? (s["source_ids"] as Record<string, string>)
            : {}),
          ...(typeof ticker === "string" ? { ticker } : {}),
          [FIXTURE_SOURCE_ID_KEY]: weekId,
          ...(typeof page === "string" ? { fixture_page: page } : {}),
        },
      });
    }
  }
  return out;
}

if (fixturePath !== undefined && existsSync(fixturePath)) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
  const pool = fixtureToRawItems(fixture);
  const ranAt = pool
    .map((i) => i.fetched_at)
    .sort()
    .at(-1) ?? `${dateEnd}T00:00:00.000Z`;
  runs.push({
    manifest: {
      date: "fixture",
      ran_at: ranAt,
      window: { from: `${dateStart}T00:00:00.000Z`, to: `${dateEnd}T23:59:59.999Z` },
      sources: [
        {
          source: `fixture-${weekId}`,
          adapter: "fixture",
          ok: true,
          count: pool.length,
        },
      ],
    },
    cache_hashes: { [relative(ROOT, fixturePath)]: sha256File(fixturePath) },
  });
  items.push(...pool);
  console.log(`ingest: +${pool.length} fixture-pool item(s) from ${basename(fixturePath)}`);
} else {
  console.log("ingest: no fixture pool");
}

// --- the chain --------------------------------------------------------------

mkdirSync(dir, { recursive: true });

const seams =
  mode === "session"
    ? {
        classify: createSessionLlm({ dir }),
        extract: createSessionExtractor({ dir }),
        draft: createSessionDrafter({ dir }),
        verify: createSessionVerifier({ dir }),
      }
    : {
        classify: createReplayLlmFromFile(join(dir, "classification.response.json")),
        extract: createReplayExtractorFromFile(join(dir, "extraction.response.json")),
        draft: createReplayDrafterFromFile(join(dir, "draft.response.json")),
        verify: createReplayVerifierFromFile(join(dir, "verify.response.json")),
      };

const normalized = normalize(items, { publishers: [...publisherNames] });
const inWindow = normalized.filter((i) => {
  const t = Date.parse(i.published_at);
  return Number.isFinite(t) && t >= dateStartMs && t <= dateEndMs;
});
console.log(`normalize: ${normalized.length} item(s), ${inWindow.length} inside the week`);

const clusters = dedupe(inWindow);
console.log(`dedupe: ${clusters.length} cluster(s)`);

const classified = await classify(clusters, { llm: seams.classify, companies, week: weekId, styleRev });
const ranked = rank(classified, {
  sources: entries,
  now: () => new Date(dateEndMs),
});
const extracted = await extract(ranked, {
  llm: seams.extract,
  week: weekId,
  styleRev,
});
const draftOut = await draft(extracted, {
  llm: seams.draft,
  companies,
  week: weekId,
  styleRev,
  styleMd,
});
console.log(
  `draft: rubric ${draftOut.rubric.pass ? "PASS" : "FAIL"}, ` +
    `${draftOut.briefing.sentences.length} briefing sentence(s)`,
);
if (!draftOut.rubric.pass) {
  for (const c of draftOut.rubric.checks) {
    if (c.status === "fail") console.error(`  rubric ${c.id} ${c.name}: ${c.details.join("; ")}`);
  }
}

const { edition, emitted } = emitEdition(draftOut.clusters, draftOut.briefing, {
  id: weekId,
  issue_number: issueNumber(outRoot, weekId),
  date_start: dateStart,
  date_end: dateEnd,
  companies,
  markets,
});
console.log(`emit: ${emitted.length} item(s) across pages`);

// --- cover (T3): arte generativa keyless, deterministica ------------------

/** Authors the deterministic SVG + rasters (sharp) for this week's data,
 * commits them under editions/<week>/, and points the cover page at the
 * committed AVIF. Same edition -> same seed -> byte-identical files. */
const cover = await renderCoverArt(edition as unknown as Record<string, unknown>);
writeFileSync(join(dir, "cover.svg"), cover.svg);
writeFileSync(join(dir, "cover-og.svg"), cover.ogSvg);
writeFileSync(join(dir, "cover.avif"), cover.avif);
writeFileSync(join(dir, "cover-og.png"), cover.og);
edition.pages[0].image = `editions/${weekId}/cover.avif`;
console.log(
  `cover: ${cover.composition}/${cover.palette} ` +
    `(seed ${cover.seed.slice(0, 12)}...) — ${(cover.avif.length / 1024).toFixed(0)}KB avif, ` +
    `${(cover.og.length / 1024).toFixed(0)}KB og`,
);

/** Sequential issue count: committed public editions before this week + 1.
 * Fixture-flagged artifacts don't consume issue numbers. */
function issueNumber(editionsDir: string, id: string): number {
  if (!existsSync(editionsDir)) return 1;
  const earlier = readdirSync(editionsDir)
    .filter((f) => /^\d{4}-w\d{2}\.json$/.test(f) && f !== `${id}.json`)
    .filter((f) => f.slice(0, 8) < id)
    .filter((f) => {
      try {
        return (JSON.parse(readFileSync(join(editionsDir, f), "utf8")) as { fixture?: boolean })
          .fixture !== true;
      } catch {
        return true; // unparseable — keep counting it rather than renumber
      }
    }).length;
  return earlier + 1;
}

// --- verify + write ---------------------------------------------------------

const verifyItems = verifyItemsFromEdition(edition);
const refByCluster = new Map(emitted.map((e) => [e.cluster_id, e.ref_id]));
const supports: Record<string, string[]> = {};
for (const [k, ids] of Object.entries(draftOut.briefing.supports)) {
  const mapped = ids.map((id) => refByCluster.get(id)).filter((x): x is string => x !== undefined);
  supports[k] = [...new Set(mapped)];
}
const report = await verifyEdition(edition, {
  companies,
  attribution: { supports, items: verifyItems },
  llm: seams.verify,
});
for (const check of report.checks) {
  console.log(`verify: ${check.id} ${check.status}${(check.issues?.length ?? 0) > 0 ? ` — ${check.issues.length} issue(s)` : ""}`);
}
for (const issue of report.issues) {
  console.error(`  ${issue.check}: ${issue.message}`);
}
if (!report.ok) {
  console.error("edition:build: verification failed — not writing the edition");
  process.exit(1);
}

const provenance = buildProvenance(edition as Edition, runs, {
  generator: "@weekly/cover",
  seed: cover.seed,
  composition: cover.composition,
});

const editionPath = join(outRoot, `${weekId}.json`);
/**
 * Replay must reproduce the committed artifact byte-for-byte — including a
 * `fixture` mark the file already carries (a replayed fixture stays a
 * fixture). Session builds write fresh, unmarked editions.
 */
if (mode === "replay") {
  try {
    const existing = JSON.parse(readFileSync(editionPath, "utf8")) as {
      fixture?: boolean;
    };
    if (existing.fixture === true) edition.fixture = true;
  } catch {
    // no committed file — nothing to preserve
  }
}
writeFileSync(editionPath, `${JSON.stringify(edition, null, 2)}\n`);
writeFileSync(join(dir, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`wrote ${editionPath}`);
console.log(`wrote ${join(dir, "provenance.json")}`);

// --- gates -------------------------------------------------------------------

const gates = [
  ["schema:validate", ["tsx", join(ROOT, "scripts/schema-validate.mts")]],
  ["provenance:check", ["tsx", join(ROOT, "scripts/provenance-check.mts")]],
] as const;
let failed = false;
for (const [name, [cmd, script]] of gates) {
  try {
    execFileSync(cmd, [script], { cwd: ROOT, stdio: "inherit" });
    console.log(`gate ${name}: PASS`);
  } catch {
    failed = true;
    console.error(`gate ${name}: FAIL`);
  }
}
if (failed) process.exit(1);
console.log(`edition:build ${weekId} — done`);
