/**
 * `pnpm schema:validate` — validates every edition object against
 * packages/schema/edition.schema.json via @weekly/schema's validateEdition.
 *
 * Default scan: every .json under editions/ and fixtures/ (a directory that
 * does not exist yet is skipped with a note). Pass explicit paths to validate
 * a subset, e.g. `pnpm schema:validate fixtures/2026-w44/edition.json`.
 * Exits nonzero on any violation.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { validateEdition } from "@weekly/schema";

const ROOT = new URL("..", import.meta.url).pathname;
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (entry.endsWith(".json")) yield path;
  }
}

const candidates: string[] = [];
if (args.length > 0) {
  candidates.push(...args.map((a) => join(ROOT, a)));
} else {
  for (const dir of ["editions", "fixtures"]) {
    const abs = join(ROOT, dir);
    if (existsSync(abs)) candidates.push(...walk(abs));
    else console.log(`schema:validate — ${dir}/ does not exist yet, skipped`);
  }
}

if (candidates.length === 0) {
  console.log("schema:validate — no edition files found");
  process.exit(1);
}

let failed = 0;
for (const file of candidates) {
  const rel = relative(ROOT, file);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`✗ ${rel}\n    not valid JSON: ${(err as Error).message}`);
    failed++;
    continue;
  }
  const result = validateEdition(json);
  if (result.ok) {
    console.log(`✓ ${rel}`);
  } else {
    console.error(`✗ ${rel}`);
    for (const err of result.errors) console.error(`    ${err}`);
    failed++;
  }
}

console.log(
  `schema:validate — ${candidates.length - failed}/${candidates.length} edition file(s) valid`,
);
process.exit(failed === 0 ? 0 : 1);
