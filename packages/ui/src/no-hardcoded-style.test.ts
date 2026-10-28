import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Zero-hardcode guard (C4 acceptance): no hex/rgb/hsl colour literal outside
 * @weekly/ui token definitions and the globals.css import file. Every other
 * style must resolve through the custom properties in tokens.css.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

const SCAN_EXTS = new Set([".ts", ".tsx", ".css", ".js", ".jsx", ".mjs"]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "coverage",
  "public",
]);
const ALLOWLIST = new Set([
  "packages/ui/src/tokens.css", // the token definitions
  "packages/ui/src/tokens.ts", // the same tokens as TS constants
  "apps/web/src/app/globals.css", // allowed for imports per the brief
]);

/* A colour literal: # + 3/4/6/8 hex digits as a full token, or RGB/HSL
 * functional notation. */
const COLOUR_RE =
  /#[0-9a-fA-F]{3,4}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path);
    } else if (SCAN_EXTS.has(extname(entry.name))) {
      yield path;
    }
  }
}

describe("no hardcoded style literals", () => {
  it("finds no hex/rgb/hsl colour outside token definitions", () => {
    const offenders: string[] = [];
    for (const file of walk(repoRoot)) {
      const rel = relative(repoRoot, file).split("\\").join("/");
      if (ALLOWLIST.has(rel)) continue;
      const text = readFileSync(file, "utf8");
      // Strip line comments so prose like "#44" or issue refs can't trip the
      // hex rule, then look for real colour literals.
      const code = text
        .split("\n")
        .map((line: string) => line.replace(/\s*\/\/.*$/, ""))
        .join("\n");
      if (COLOUR_RE.test(code)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
