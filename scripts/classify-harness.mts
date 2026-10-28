/**
 * `pnpm classify:harness` — the P4 accuracy harness over the C3 labelled set.
 *
 * Modes:
 *   --emit-request   build classification.request.json + classification.prompt.md
 *                    from labeled-items.json (the session fills
 *                    classification.response.json in the same directory)
 *   --score          replay the recorded response through `classify` and print
 *                    page accuracy + confusion + company precision/recall;
 *                    exit 1 when page accuracy < 0.90
 *   --session        emit the request, then run the real session seam (blocks
 *                    until classification.response.json appears), then score
 *
 * Flags: `--dir <dir>` (default packages/pipeline/testdata/classification/),
 *        `--companies <path>`, `--week <id>`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildClassificationRequest,
  buildCompanyResolver,
  classificationPaths,
  type ClassificationRequest,
  classify,
  createReplayLlmFromFile,
  createSessionLlm,
  loadCompaniesConfig,
  writeClassificationRequest,
  type NormalizedItem,
  type ItemCluster,
  CLASSIFY_PROMPT_PATH,
  type ItemClassification,
} from "@weekly/pipeline";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const dir = resolve(
  ROOT,
  arg("--dir") ?? "packages/pipeline/testdata/classification",
);
const companies = loadCompaniesConfig(
  resolve(ROOT, arg("--companies") ?? "config/companies.yaml"),
);

// --- labelled set → synthetic one-member clusters --------------------------

interface LabeledItem {
  id: string;
  headline: string;
  url: string;
  publisher: string;
  published_at: string;
  excerpt: string;
  expect: { page: string; companies: string[] };
  notes?: string;
}

const labeled = JSON.parse(
  readFileSync(new URL("../packages/pipeline/testdata/classification/labeled-items.json", import.meta.url), "utf8"),
) as { items: LabeledItem[] };

const clusters: ItemCluster[] = labeled.items.map((i) => {
  const item: NormalizedItem = {
    adapter: "labeled-set",
    headline: i.headline,
    canonical_url: i.url,
    publisher: i.publisher,
    published_at: i.published_at,
    fetched_at: i.published_at,
    excerpt: i.excerpt,
    source_ids: {},
    title_key: i.headline.toLowerCase(),
  };
  return { id: i.id, item, items: [item] };
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

const request: ClassificationRequest = buildClassificationRequest(clusters, {
  companies,
  week,
  styleRev,
});

// --- scoring ---------------------------------------------------------------

function score(classified: { id: string; classification: ItemClassification }[]): void {
  const resolver = buildCompanyResolver(companies);
  const byId = new Map(classified.map((c) => [c.id, c.classification]));
  const labels = [...new Set(labeled.items.map((i) => i.expect.page))].sort();

  let correct = 0;
  const confusion = new Map<string, Map<string, number>>();
  const misses: { id: string; expected: string; got: string; notes?: string }[] = [];
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const item of labeled.items) {
    const c = byId.get(item.id);
    if (!c) {
      misses.push({ id: item.id, expected: item.expect.page, got: "<missing>" });
      continue;
    }
    const got = c.page;
    const expected = item.expect.page;
    const row = confusion.get(expected) ?? new Map<string, number>();
    row.set(got, (row.get(got) ?? 0) + 1);
    confusion.set(expected, row);
    if (got === expected) correct++;
    else misses.push({ id: item.id, expected, got, ...(item.notes ? { notes: item.notes } : {}) });

    // Company P/R — expected slugs resolve through the same registry map so
    // labelled `google` matches an emitted `alphabet` (one entity, one slug).
    const expectedSlugs = new Set(
      item.expect.companies.map((s) => resolver.get(s) ?? s),
    );
    const gotSlugs = new Set(c.company_slugs);
    for (const s of gotSlugs) {
      if (expectedSlugs.has(s)) tp++;
      else fp++;
    }
    for (const s of expectedSlugs) if (!gotSlugs.has(s)) fn++;
  }

  const accuracy = correct / labeled.items.length;
  console.log(`\npage accuracy: ${correct}/${labeled.items.length} = ${(accuracy * 100).toFixed(1)}%  (gate ≥ 90%)\n`);

  console.log("confusion (expected → got):");
  for (const label of labels) {
    const row = confusion.get(label) ?? new Map();
    const parts = [...row.entries()].map(([g, n]) => `${g}:${n}`).join("  ");
    const total = [...row.values()].reduce((a, b) => a + b, 0);
    const per = row.get(label) ?? 0;
    console.log(`  ${label.padEnd(12)} ${per}/${total}   ${parts}`);
  }

  console.log(`\ncompany tags: precision ${tp}/${tp + fp || 1}, recall ${tp}/${tp + fn || 1} (secondary metric)`);

  if (misses.length > 0) {
    console.log(`\nmisses (${misses.length}):`);
    for (const m of misses) {
      console.log(`  ${m.id}: expected ${m.expected}, got ${m.got}${m.notes ? ` — ${m.notes}` : ""}`);
    }
  }

  if (accuracy < 0.9) {
    console.error(`\nFAIL: ${(accuracy * 100).toFixed(1)}% < 90%`);
    process.exit(1);
  }
}

if (mode === "emit-request") {
  const paths = writeClassificationRequest(
    dir,
    request,
    readFileSync(CLASSIFY_PROMPT_PATH, "utf8"),
  );
  console.log(`request:  ${paths.requestPath}`);
  console.log(`prompt:   ${paths.promptPath}`);
  console.log(`response: ${paths.responsePath}  ← fill this (session seam)`);
} else if (mode === "session") {
  console.log(`session hand-off in ${dir} — waiting for classification.response.json …`);
  const out = await classify(clusters, {
    llm: createSessionLlm({ dir }),
    companies,
    week,
    styleRev,
  });
  score(out);
} else {
  const { responsePath } = classificationPaths(dir);
  const out = await classify(clusters, {
    llm: createReplayLlmFromFile(responsePath),
    companies,
    week,
    styleRev,
  });
  score(out);
}
