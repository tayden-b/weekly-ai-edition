/**
 * Codegen: edition.schema.json → src/edition.types.ts.
 *
 * Run via `pnpm schema:types` (scripts/schema-codegen.mts). The sync between
 * the JSON schema and the committed types is enforced by a test that
 * regenerates the output and compares it to the file on disk.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { compile, type JSONSchema } from "json-schema-to-typescript";

const BANNER = `/**
 * GENERATED — do not edit by hand.
 * Source: packages/schema/edition.schema.json
 * Regenerate: pnpm schema:types
 */`;

export const SCHEMA_PATH = fileURLToPath(
  new URL("../edition.schema.json", import.meta.url),
);
export const TYPES_PATH = fileURLToPath(
  new URL("./edition.types.ts", import.meta.url),
);

export async function loadEditionSchema(): Promise<JSONSchema> {
  return JSON.parse(await readFile(SCHEMA_PATH, "utf8")) as JSONSchema;
}

export async function generateEditionTypes(): Promise<string> {
  const schema = await loadEditionSchema();
  const ts = await compile(schema, "Edition", {
    bannerComment: BANNER,
    additionalProperties: false,
    format: false,
    strictIndexSignatures: true,
  });
  return ts.trimEnd() + "\n";
}
