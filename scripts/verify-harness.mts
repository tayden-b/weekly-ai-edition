/**
 * `pnpm verify:harness` — the P7 artifact emitter for a candidate edition.
 *
 * Modes:
 *   --provenance   write `<sidecar>/provenance.json` for an edition from its
 *                  ingest manifests (`--raw <dir>` per ingest day; repeat
 *                  the flag for multiple)
 *   --request      write `<sidecar>/verify.request.json` — the entailment
 *                  batch (sentences + item pool). Pass `--supports <file>`
 *                  to merge recorded P6 attribution (sentence index → item
 *                  ids); without it every sentence gets an empty list for
 *                  the session to fill
 *   --response     write the session's `verify.response.json` (validates it
 *                  against the request first)
 *   --render-prompt  also render `verify.prompt.md` next to the request
 *
 * Flags: `--edition <path>` (required), `--raw <dir>` (repeatable),
 *        `--supports <path>`, `--sidecar <dir>` (default: the edition's own
 *        dir for `edition.json`, else `editions/<week>/` next to
 *        `<week>.json`), `--out <dir>` (alias of --sidecar).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import {
  assertVerifyResponse,
  buildProvenance,
  buildVerifyRequest,
  loadIngestCache,
  renderVerifyPrompt,
  VERIFY_PROMPT_PATH,
  verifyItemsFromEdition,
  type VerifyResponse,
} from "@weekly/pipeline";

const ROOT = new URL("..", import.meta.url).pathname;

function args(flag: string): string[] {
  const out: string[] = [];
  for (const [i, a] of process.argv.entries()) {
    if (a === flag && i + 1 < process.argv.length) out.push(process.argv[i + 1]!);
  }
  return out;
}

const editionPath = args("--edition")[0];
if (editionPath === undefined) {
  console.error("verify-harness: --edition <path> is required");
  process.exit(1);
}
const edition = JSON.parse(readFileSync(join(ROOT, editionPath), "utf8")) as Record<
  string,
  unknown
>;

const sidecar = (() => {
  const given = args("--sidecar")[0] ?? args("--out")[0];
  if (given !== undefined) return join(ROOT, given);
  const dir = dirname(join(ROOT, editionPath));
  return basename(editionPath) === "edition.json"
    ? dir
    : join(dir, basename(editionPath, ".json"));
})();
mkdirSync(sidecar, { recursive: true });

if (process.argv.includes("--provenance")) {
  const runs = args("--raw").map((d) => loadIngestCache(join(ROOT, d)));
  const provenance = buildProvenance(edition, runs);
  const out = join(sidecar, "provenance.json");
  writeFileSync(out, `${JSON.stringify(provenance, null, 2)}\n`);
  console.log(`wrote ${out}`);
}

if (process.argv.includes("--request")) {
  const supportsPath = args("--supports")[0];
  const supports =
    supportsPath !== undefined
      ? (JSON.parse(readFileSync(join(ROOT, supportsPath), "utf8")) as Record<
          string,
          string[]
        >)
      : {};
  const items = verifyItemsFromEdition(edition);
  const request = buildVerifyRequest(edition, { supports, items });
  const out = join(sidecar, "verify.request.json");
  writeFileSync(out, `${JSON.stringify(request, null, 2)}\n`);
  console.log(`wrote ${out}`);
  if (process.argv.includes("--render-prompt")) {
    const promptPath = join(sidecar, "verify.prompt.md");
    writeFileSync(
      promptPath,
      renderVerifyPrompt(readFileSync(VERIFY_PROMPT_PATH, "utf8"), request),
    );
    console.log(`wrote ${promptPath}`);
  }
}

if (process.argv.includes("--response")) {
  const reqPath = join(sidecar, "verify.request.json");
  const resPath = join(sidecar, "verify.response.json");
  if (!existsSync(reqPath) || !existsSync(resPath)) {
    console.error(
      "verify.request.json and verify.response.json must both exist under the sidecar dir",
    );
    process.exit(1);
  }
  const request = JSON.parse(readFileSync(reqPath, "utf8"));
  const response = JSON.parse(readFileSync(resPath, "utf8")) as VerifyResponse;
  assertVerifyResponse(request, response);
  const unsupported = response.verdicts.filter((v) => !v.supported);
  console.log(
    unsupported.length === 0
      ? "verify.response.json: every sentence supported — edition clears the entailment gate"
      : `verify.response.json: ${unsupported.length} sentence(s) unsupported — the build FAILS`,
  );
}
