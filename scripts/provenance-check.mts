/**
 * `pnpm provenance:check` — the PLAN.md §5.3 CI gate (P7).
 *
 * For every committed edition — `editions/<week>.json` and every
 * `fixtures/<week>/edition.json` — this proves:
 *
 *   1. the deterministic verify-stage checks (1–4): sources[] completeness,
 *      evidence quotes verbatim in stored excerpts, company tags resolving
 *      to config/companies.yaml slugs, discourse items spanning ≥ 2
 *      publishers — via @weekly/pipeline's `verifyDeterministic`, the same
 *      code the build-time verify stage runs;
 *   2. a `provenance.json` beside the edition (`editions/<week>/` or
 *      `fixtures/<week>/`): adapter runs, item counts, failures, and
 *      `sha256:` cache hashes — re-validated against the edition AND
 *      re-hashed against the raw cache files on disk;
 *   3. the recorded entailment judgement (`verify.request.json` +
 *      `verify.response.json` beside the edition, §8 replay): the request
 *      matches the edition's briefing + items, the response satisfies the
 *      prompt contract, and every sentence is marked supported.
 *
 * Non-negotiable (HANDOFF.md): never weaken these gates to get a PR green.
 * Exits nonzero on any violation; failure messages name the item, field,
 * and rule.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  assertVerifyResponse,
  briefingSentences,
  checkBriefingAttribution,
  checkProvenance,
  loadCompaniesConfig,
  sha256File,
  VERIFY_PROMPT_VERSION,
  verifyDeterministic,
  verifyItemsFromEdition,
  VerifyContractError,
  type VerifyIssue,
  type VerifyRequest,
} from "@weekly/pipeline";

const ROOT = new URL("..", import.meta.url).pathname;
const companies = loadCompaniesConfig(join(ROOT, "config/companies.yaml"));

interface Target {
  /** Edition file path, absolute. */
  edition: string;
  /** Directory holding the provenance + verify recordings. */
  sidecar: string;
  /** Repo-relative label for output. */
  label: string;
}

const WEEK_FILE_RE = /^(\d{4}-w\d{2})\.json$/;

function* targets(): Generator<Target> {
  const editionsDir = join(ROOT, "editions");
  if (existsSync(editionsDir)) {
    for (const file of readdirSync(editionsDir).sort()) {
      const m = WEEK_FILE_RE.exec(file);
      if (m !== null) {
        yield {
          edition: join(editionsDir, file),
          sidecar: join(editionsDir, m[1]!),
          label: `editions/${file}`,
        };
      }
    }
  }
  const fixturesDir = join(ROOT, "fixtures");
  if (existsSync(fixturesDir)) {
    for (const dir of readdirSync(fixturesDir).sort()) {
      const edition = join(fixturesDir, dir, "edition.json");
      if (existsSync(edition)) {
        yield {
          edition,
          sidecar: join(fixturesDir, dir),
          label: `fixtures/${dir}/edition.json`,
        };
      }
    }
  }
}

const loadJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8")) as unknown;

let failed = 0;
let checked = 0;

for (const target of targets()) {
  checked++;
  const errors: string[] = [];
  let edition: Record<string, unknown> = {};
  try {
    edition = loadJson(target.edition) as Record<string, unknown>;
  } catch (err) {
    errors.push(`not valid JSON: ${(err as Error).message}`);
  }

  if (errors.length === 0) {
    // 1 — deterministic §5.3 checks (the verify stage's own code).
    for (const issue of verifyDeterministic(edition, companies).issues) {
      errors.push(`[${issue.check}] ${issue.path} — ${issue.message}`);
    }

    // 2 — provenance.json beside the edition.
    const provPath = join(target.sidecar, "provenance.json");
    if (!existsSync(provPath)) {
      errors.push(
        `${relative(ROOT, provPath)} missing — every edition carries a provenance.json`,
      );
    } else {
      let provenance: unknown;
      try {
        provenance = loadJson(provPath);
        for (const issue of checkProvenance(edition, provenance)) {
          errors.push(`[provenance] ${issue.path} — ${issue.message}`);
        }
        // Re-hash every referenced cache file on disk.
        const hashes = (provenance as Record<string, unknown>).cache_hashes;
        if (typeof hashes === "object" && hashes !== null) {
          for (const [file, want] of Object.entries(hashes)) {
            const abs = join(ROOT, file);
            if (!existsSync(abs)) {
              errors.push(`[provenance] cache_hashes.${file} — file not found`);
            } else {
              const got = sha256File(abs);
              if (got !== want) {
                errors.push(
                  `[provenance] cache_hashes.${file} — sha256 mismatch (${got} ≠ ${String(want)})`,
                );
              }
            }
          }
        }
      } catch (err) {
        errors.push(
          `${relative(ROOT, provPath)} is not valid JSON: ${(err as Error).message}`,
        );
      }
    }

    // 3 — the recorded entailment judgement (§8 replay).
    const reqPath = join(target.sidecar, "verify.request.json");
    const resPath = join(target.sidecar, "verify.response.json");
    let request: VerifyRequest | undefined;
    if (!existsSync(reqPath) || !existsSync(resPath)) {
      errors.push(
        `verify.request/response.json missing beside ${target.label} — briefing entailment must be recorded for replay (§8)`,
      );
    } else {
      try {
        request = loadJson(reqPath) as VerifyRequest;
        const sentences = briefingSentences(edition);
        if (request.prompt_version !== VERIFY_PROMPT_VERSION) {
          errors.push(
            `verify.request.json prompt_version ${JSON.stringify(request.prompt_version)} ≠ ${VERIFY_PROMPT_VERSION}`,
          );
        }
        if (request.week !== edition.id) {
          errors.push(
            `verify.request.json week ${JSON.stringify(request.week)} ≠ edition ${JSON.stringify(edition.id)}`,
          );
        }
        if (
          JSON.stringify(request.sentences) !== JSON.stringify(sentences)
        ) {
          errors.push(
            `verify.request.json sentences do not match the edition's briefing`,
          );
        }
        const itemIds = verifyItemsFromEdition(edition).map((i) => i.id);
        if (
          JSON.stringify(request.items.map((i) => i.id)) !==
          JSON.stringify(itemIds)
        ) {
          errors.push(
            `verify.request.json items do not match the edition's item projection`,
          );
        }
        // The recorded request must itself satisfy the mechanical half of
        // check 5 — an empty/ghost `supports` map cannot be laundered through
        // an all-supported response.
        const attributionIssues: VerifyIssue[] = [];
        checkBriefingAttribution(request, attributionIssues);
        for (const issue of attributionIssues) {
          errors.push(`[briefing] ${issue.path} — ${issue.message}`);
        }
      } catch (err) {
        errors.push(
          `${relative(ROOT, reqPath)} is not valid JSON: ${(err as Error).message}`,
        );
      }
      if (request !== undefined) {
        try {
          const response = loadJson(resPath);
          assertVerifyResponse(request, response);
          for (const verdict of response.verdicts) {
            if (!verdict.supported) {
              errors.push(
                `[briefing] sentences[${verdict.sentence_index}] — recorded judgement: supported by no item`,
              );
            }
          }
        } catch (err) {
          if (err instanceof VerifyContractError) {
            for (const issue of err.issues) errors.push(`[briefing] ${issue}`);
          } else {
            errors.push(
              `${relative(ROOT, resPath)} is not valid JSON: ${(err as Error).message}`,
            );
          }
        }
      }
    }
  }

  if (errors.length === 0) {
    console.log(`✓ ${target.label}`);
  } else {
    console.error(`✗ ${target.label}`);
    for (const e of errors) console.error(`    ${e}`);
    failed++;
  }
}

console.log(
  `provenance:check — ${checked - failed}/${checked} edition(s) pass §5.3`,
);
process.exit(failed === 0 ? 0 : 1);
