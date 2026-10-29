/**
 * `pnpm extract:harness` — the P5 extraction harness over the labelled
 * extraction set (`packages/pipeline/testdata/extraction/extract-items.json`).
 *
 * Modes:
 *   --emit-request   build extraction.request.json + extraction.prompt.md
 *                    from extract-items.json (the session fills
 *                    extraction.response.json in the same directory)
 *   --score          replay the recorded response through `extract` and check
 *                    every `expect` entry: field values, per-field methods,
 *                    evidence source_index, flagged missing fields, and — the
 *                    P5 load-bearing check — that every shipped evidence quote
 *                    is a verbatim substring of the cited member excerpt
 *   --session        emit the request, then run the real session seam (blocks
 *                    until extraction.response.json appears), then score
 *
 * Flags: `--dir <dir>` (default packages/pipeline/testdata/extraction/),
 *        `--week <id>`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildExtractionRequest,
  createReplayExtractorFromFile,
  createSessionExtractor,
  EXTRACT_PROMPT_PATH,
  extract,
  extractionPaths,
  type ClassifiedCluster,
  type ExtractedField,
  type ExtractionRequest,
  type ItemCluster,
  type NormalizedItem,
  writeExtractionRequest,
} from "@weekly/pipeline";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const dir = resolve(
  ROOT,
  arg("--dir") ?? "packages/pipeline/testdata/extraction",
);

// --- labelled set → synthetic classified clusters --------------------------

interface LabeledMember {
  headline: string;
  url: string;
  publisher: string;
  published_at: string;
  excerpt: string;
}
interface LabeledItem {
  id: string;
  page: string;
  members: LabeledMember[];
  expect: {
    fields: Record<string, string | number>;
    methods?: Record<string, "regex" | "llm">;
    evidence?: Record<string, { source_index: number }>;
    missing?: string[];
  };
  notes?: string;
}

const labeled = JSON.parse(
  readFileSync(new URL("../packages/pipeline/testdata/extraction/extract-items.json", import.meta.url), "utf8"),
) as { items: LabeledItem[] };

const clusters: ClassifiedCluster[] = labeled.items.map((i) => {
  const members: NormalizedItem[] = i.members.map((m) => ({
    adapter: "labeled-set",
    headline: m.headline,
    canonical_url: m.url,
    publisher: m.publisher,
    published_at: m.published_at,
    fetched_at: m.published_at,
    excerpt: m.excerpt,
    source_ids: {},
    title_key: m.headline.toLowerCase(),
  }));
  const cluster: ItemCluster = {
    id: i.id,
    item: members[0]!,
    items: members,
  };
  return {
    ...cluster,
    classification: {
      page: i.page as ClassifiedCluster["classification"]["page"],
      confidence: 1,
      company_slugs: [],
      flags: [],
    },
  };
});

const week = arg("--week") ?? "labeled-set";
const styleRev = (() => {
  try {
    return execFileSync("git", ["log", "-1", "--format=%H", "--", "STYLE.md"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
})();

const mode = process.argv.includes("--session")
  ? "session"
  : process.argv.includes("--score")
    ? "score"
    : "emit-request";

const request: ExtractionRequest = buildExtractionRequest(clusters, {
  week,
  styleRev,
});

// --- scoring ---------------------------------------------------------------

function score(
  extracted: {
    id: string;
    extraction: {
      fields: Record<string, ExtractedField>;
      drops: { field: string; reason: string }[];
      flags: string[];
    };
  }[],
): { checked: number; failures: string[] } {
  const byId = new Map(extracted.map((c) => [c.id, c.extraction]));
  const failures: string[] = [];
  let checked = 0;

  for (const item of labeled.items) {
    const got = byId.get(item.id);
    if (!got) {
      failures.push(`${item.id}: no extraction slot attached`);
      continue;
    }
    // Field values.
    for (const [name, value] of Object.entries(item.expect.fields)) {
      checked++;
      const f = got.fields[name];
      if (f === undefined) failures.push(`${item.id}: field ${name} missing (expected ${JSON.stringify(value)})`);
      else if (f.value !== value)
        failures.push(`${item.id}: field ${name} = ${JSON.stringify(f.value)}, expected ${JSON.stringify(value)}`);
      // §5.3: the shipped quote must be verbatim in the cited excerpt.
      else {
        const src = item.members[f.evidence.source_index];
        if (src === undefined)
          failures.push(`${item.id}: field ${name} cites source_index ${f.evidence.source_index}, out of range`);
        else if (!src.excerpt.includes(f.evidence.quote))
          failures.push(`${item.id}: field ${name} quote ${JSON.stringify(f.evidence.quote)} is not verbatim in source ${f.evidence.source_index}`);
      }
    }
    // Methods (which half of the pipeline produced the field).
    for (const [name, method] of Object.entries(item.expect.methods ?? {})) {
      checked++;
      const f = got.fields[name];
      if (f && f.method !== method)
        failures.push(`${item.id}: field ${name} method ${f.method}, expected ${method}`);
    }
    // Cited source_index.
    for (const [name, ev] of Object.entries(item.expect.evidence ?? {})) {
      checked++;
      const f = got.fields[name];
      if (f && f.evidence.source_index !== ev.source_index)
        failures.push(`${item.id}: field ${name} source_index ${f.evidence.source_index}, expected ${ev.source_index}`);
    }
    // Fields that must stay missing — flagged, never fabricated.
    for (const name of item.expect.missing ?? []) {
      checked++;
      if (got.fields[name] !== undefined)
        failures.push(`${item.id}: field ${name} was filled (${JSON.stringify(got.fields[name]!.value)}), expected missing`);
      else if (!got.flags.includes(`missing:${name}`))
        failures.push(`${item.id}: field ${name} absent but no missing:${name} flag recorded`);
    }
    // `already-extracted` drops are the position tiebreak doing its job
    // (e.g. "prior weekly close" after the week's close); every other drop
    // is a real violation and fails the happy path.
    const bad = got.drops.filter((d) => d.reason !== "already-extracted");
    if (bad.length > 0)
      failures.push(`${item.id}: unexpected drops ${JSON.stringify(bad)}`);
  }
  return { checked, failures };
}

// --- run ---------------------------------------------------------------------

if (mode === "score") {
  const { responsePath } = extractionPaths(dir);
  const extracted = await extract(clusters, {
    llm: createReplayExtractorFromFile(responsePath),
    week,
    styleRev,
  });
  const { checked, failures } = score(extracted);
  for (const f of failures) console.error(`FAIL ${f}`);
  console.log(
    `extraction score: ${checked - failures.length}/${checked} checks pass, ${failures.length} failure(s)`,
  );
  if (failures.length > 0) process.exit(1);
} else {
  const prompt = readFileSync(EXTRACT_PROMPT_PATH, "utf8");
  if (mode === "session") {
    const llm = createSessionExtractor({ dir, promptTemplate: prompt });
    const extracted = await extract(clusters, { llm, week, styleRev });
    const { checked, failures } = score(extracted);
    for (const f of failures) console.error(`FAIL ${f}`);
    console.log(
      `extraction score: ${checked - failures.length}/${checked} checks pass, ${failures.length} failure(s)`,
    );
    if (failures.length > 0) process.exit(1);
  } else {
    const paths = writeExtractionRequest(dir, request, prompt);
    console.log(`wrote ${paths.requestPath}`);
    console.log(`wrote ${paths.promptPath}`);
    console.log(`items needing the model: ${request.items.length}`);
    console.log(`fill ${paths.responsePath} then run --score`);
  }
}
