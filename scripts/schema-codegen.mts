/**
 * `pnpm schema:types` — regenerate packages/schema/src/edition.types.ts from
 * packages/schema/edition.schema.json.
 * `--check` regenerates in memory and fails nonzero if the committed file
 * has drifted (used by CI / tests).
 */
import { readFile, writeFile } from "node:fs/promises";

import { generateEditionTypes, TYPES_PATH } from "@weekly/schema/codegen";

const check = process.argv.includes("--check");
const generated = await generateEditionTypes();

if (check) {
  const committed = await readFile(TYPES_PATH, "utf8");
  if (committed !== generated) {
    console.error(
      "schema:types — edition.types.ts is out of sync with edition.schema.json; run `pnpm schema:types`",
    );
    process.exit(1);
  }
  console.log("schema:types — edition.types.ts is in sync");
} else {
  await writeFile(TYPES_PATH, generated);
  console.log(`schema:types — wrote ${TYPES_PATH}`);
}
