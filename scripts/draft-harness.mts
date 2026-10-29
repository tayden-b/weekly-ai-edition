/**
 * `pnpm draft:harness` — the P6 draft harness over the labelled draft set
 * (`packages/pipeline/testdata/draft/draft-items.json`).
 *
 * Modes:
 *   --emit-request   build draft.request.json + draft.prompt.md from
 *                    draft-items.json (the session fills draft.response.json
 *                    in the same directory)
 *   --score          replay the recorded response through `draft` and check
 *                    every `expect` entry plus the STYLE.md rubric: one-liner
 *                    present + ≤140 chars + ≠ headline, funding headline
 *                    format, discourse `?` headline + ≥2 publishers, take
 *                    quota, briefing 5–7 sentences + no links + full supports
 *                    coverage, and rubric pass
 *   --session        emit the request, then run the real session seam
 *                    (blocks until draft.response.json appears), then score
 *
 * Flags: `--dir <dir>` (default packages/pipeline/testdata/draft/),
 *        `--week <id>`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildDraftRequest,
  createReplayDrafterFromFile,
  createSessionDrafter,
  draft,
  DRAFT_PROMPT_PATH,
  draftPaths,
  isDraftPage,
  loadCompaniesConfig,
  numberTokens,
  numberTraced,
  ONE_LINER_MAX_CHARS,
  proseKey,
  splitSentences,
  type DraftedCluster,
  type DraftOutput,
  type DraftRequest,
  type ExtractedCluster,
  type ExtractedField,
  type ExtractFieldName,
  type ItemCluster,
  type NormalizedItem,
  writeDraftRequest,
} from "@weekly/pipeline";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const dir = resolve(ROOT, arg("--dir") ?? "packages/pipeline/testdata/draft");

// --- labelled set → synthetic extracted clusters ----------------------------

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
  companies?: string[];
  extracted?: Record<string, string | number>;
  expect: {
    headline?: string;
    headline_pattern?: string;
  };
  notes?: string;
}

const labeled = JSON.parse(
  readFileSync(new URL("../packages/pipeline/testdata/draft/draft-items.json", import.meta.url), "utf8"),
) as { items: LabeledItem[] };

const clusters: ExtractedCluster[] = labeled.items.map((i) => {
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
  const fields: Partial<Record<ExtractFieldName, ExtractedField>> = {};
  for (const [name, value] of Object.entries(i.extracted ?? {})) {
    // Evidence: cite the member excerpt verbatim — the labelled set only
    // carries extracted values P5 already admitted, so the quote stands.
    fields[name as ExtractFieldName] = {
      value,
      evidence: { source_index: 0, quote: members[0]!.excerpt },
      method: "regex",
    };
  }
  return {
    ...cluster,
    classification: {
      page: i.page as ExtractedCluster["classification"]["page"],
      confidence: 1,
      company_slugs: i.companies ?? [],
      flags: [],
    },
    extraction: {
      page: i.page as ExtractedCluster["classification"]["page"],
      fields,
      drops: [],
      flags: [],
    },
  };
});

const companies = loadCompaniesConfig(new URL("../config/companies.yaml", import.meta.url).pathname);
const styleMd = readFileSync(new URL("../STYLE.md", import.meta.url), "utf8");

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

const request: DraftRequest = buildDraftRequest(clusters, companies, {
  week,
  styleRev,
  styleMd,
});

// --- scoring ---------------------------------------------------------------

function score(out: DraftOutput): { checked: number; failures: string[] } {
  let checked = 0;
  const failures: string[] = [];
  const ok = (cond: boolean, msg: string) => {
    checked += 1;
    if (!cond) failures.push(msg);
  };
  const byId = new Map(labeled.items.map((i) => [i.id, i]));
  const allSourceText = out.clusters.flatMap((c) => [c.item.headline, ...c.items.flatMap((m) => [m.headline, m.excerpt])]);

  for (const c of out.clusters as DraftedCluster[]) {
    const li = byId.get(c.id)!;
    const page = li.page;
    if (!isDraftPage(page)) {
      ok(
        c.draft.one_liner === undefined && c.draft.headline === undefined && c.draft.take === undefined,
        `${c.id}: ${page} cluster carried draft prose`,
      );
      continue;
    }
    const lin = c.draft.one_liner;
    ok(lin !== undefined && lin.trim() !== "", `${c.id}: missing one_liner`);
    if (lin !== undefined) {
      ok(lin.length <= ONE_LINER_MAX_CHARS, `${c.id}: one_liner ${lin.length} > ${ONE_LINER_MAX_CHARS}`);
      ok(splitSentences(lin).length === 1, `${c.id}: one_liner not one sentence`);
      ok(proseKey(lin) !== proseKey(c.draft.headline ?? c.item.headline), `${c.id}: one_liner restates headline`);
      ok(!/https?:\/\/|!/.test(lin), `${c.id}: one_liner has link or "!"`);
    }
    if (li.expect.headline !== undefined) {
      ok(c.draft.headline === li.expect.headline, `${c.id}: headline ${JSON.stringify(c.draft.headline)} ≠ ${JSON.stringify(li.expect.headline)}`);
    }
    if (li.expect.headline_pattern !== undefined) {
      ok(
        new RegExp(li.expect.headline_pattern).test(c.draft.headline ?? ""),
        `${c.id}: headline ${JSON.stringify(c.draft.headline)} fails ${li.expect.headline_pattern}`,
      );
    }
    if (page === "discourse") {
      ok(
        new Set(c.items.map((m) => m.publisher)).size >= 2,
        `${c.id}: discourse cluster <2 publishers`,
      );
    }
    // Mono flagging: extraction-derived fields surface in draft.mono.
    const f = c.extraction.fields;
    if (page === "performance" && f.metric_value !== undefined) {
      ok(c.draft.mono.number === f.metric_value.value, `${c.id}: mono.number ≠ metric_value`);
    }
    if (page === "funding" && f.amount !== undefined) {
      ok(c.draft.mono.amount === f.amount.value, `${c.id}: mono.amount ≠ amount`);
    }
  }

  // Take quota: ≤1 take per drafted page, none on discourse.
  const takes = new Map<string, number>();
  for (const c of out.clusters) {
    if (c.draft.take === undefined) continue;
    const page = byId.get(c.id)!.page;
    takes.set(page, (takes.get(page) ?? 0) + 1);
    ok(page !== "discourse", `${c.id}: take on discourse`);
  }
  for (const [page, n] of takes) {
    ok(n <= 1, `${page}: ${n} takes`);
  }

  // Briefing: count, no links, full supports coverage, number traceability.
  const b = out.briefing;
  ok(b.sentences.length >= 5 && b.sentences.length <= 7, `briefing: ${b.sentences.length} sentences`);
  for (const [i, s] of b.sentences.entries()) {
    ok(!/https?:\/\/|\[[^\]]*\]\(/.test(s), `briefing[${i}]: contains a link`);
    ok(!EMOJI(s), `briefing[${i}]: emoji or "!"`);
    ok((b.supports[i] ?? []).length >= 1, `briefing[${i}]: no supporting item`);
    for (const n of numberTokens(s)) {
      ok(numberTraced(n, allSourceText), `briefing[${i}]: number "${n}" untraced`);
    }
  }
  // Rubric gate.
  ok(out.rubric.pass, `rubric fails: ${out.rubric.checks.filter((c) => c.status === "fail").map((c) => c.id).join(",")}`);
  return { checked, failures };
}

function EMOJI(s: string): boolean {
  return /[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]|!/u.test(s);
}

function printOut(out: DraftOutput): void {
  const byId = new Map(labeled.items.map((i) => [i.id, i]));
  for (const c of out.clusters) {
    if (!isDraftPage(byId.get(c.id)!.page)) continue;
    console.log(`\n[${byId.get(c.id)!.page}] ${c.id}`);
    if (c.draft.headline !== undefined) console.log(`  headline: ${c.draft.headline}`);
    if (c.draft.one_liner !== undefined) console.log(`  one_liner (${c.draft.one_liner.length}): ${c.draft.one_liner}`);
    if (c.draft.take !== undefined) console.log(`  take: — *${c.draft.take}*`);
    if (Object.keys(c.draft.mono).length > 0) console.log(`  mono: ${JSON.stringify(c.draft.mono)}`);
    if (c.draft.flags.length > 0) console.log(`  flags: ${c.draft.flags.join(", ")}`);
    for (const d of c.draft.drops) console.log(`  drop ${d.field}: ${d.reason} ${d.detail ?? ""}`.trimEnd());
  }
  console.log(`\nbriefing (${out.briefing.sentences.length} sentences):`);
  out.briefing.sentences.forEach((s, i) => console.log(`  ${i}. ${s}  ⟵ ${JSON.stringify(out.briefing.supports[i])}`));
  console.log(`\nrubric: ${out.rubric.pass ? "PASS" : "FAIL"}`);
  for (const c of out.rubric.checks) {
    console.log(`  ${c.id} ${c.name}: ${c.status}${c.details.length > 0 ? ` — ${c.details.join("; ")}` : ""}`);
  }
}

// --- run ---------------------------------------------------------------------

if (mode === "score") {
  const { responsePath } = draftPaths(dir);
  const out = await draft(clusters, {
    llm: createReplayDrafterFromFile(responsePath),
    companies,
    week,
    styleRev,
    styleMd,
  });
  printOut(out);
  const { checked, failures } = score(out);
  for (const f of failures) console.error(`FAIL ${f}`);
  console.log(
    `\ndraft score: ${checked - failures.length}/${checked} checks pass, ${failures.length} failure(s)`,
  );
  if (failures.length > 0) process.exit(1);
} else {
  const prompt = readFileSync(DRAFT_PROMPT_PATH, "utf8");
  if (mode === "session") {
    const llm = createSessionDrafter({ dir, promptTemplate: prompt });
    const out = await draft(clusters, { llm, companies, week, styleRev, styleMd });
    printOut(out);
    const { checked, failures } = score(out);
    for (const f of failures) console.error(`FAIL ${f}`);
    console.log(
      `\ndraft score: ${checked - failures.length}/${checked} checks pass, ${failures.length} failure(s)`,
    );
    if (failures.length > 0) process.exit(1);
  } else {
    const paths = writeDraftRequest(dir, request, prompt);
    console.log(`wrote ${paths.requestPath}`);
    console.log(`wrote ${paths.promptPath}`);
    console.log(`items needing the model: ${request.items.length}`);
    console.log(`fill ${paths.responsePath} then run --score`);
  }
}
