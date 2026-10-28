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

/* DESIGN §5: "--ink-3 is never used for text under 14px." Mechanically: a
 * `color: var(--ink-3)` declaration must sit in a block that also sets
 * font-size to a ≥14px step (--t-base or larger, or ≥14px). Blocks that set
 * no font-size inherit whatever the parent is — the safe rule is they may
 * not use ink-3 at all (add an explicit ≥14px font-size to be allowlisted).
 * Strokes/fills/backgrounds on non-text are untouched — only `color:`. */
const INK3_TEXT_OK =
  /font-size:\s*(?:var\(--t-(?:base|lg|xl|2xl|3xl)\)|(?:1[4-9]|[2-9]\d)(?:\.\d+)?px);/;

describe("ink-3 contrast floor (DESIGN §5)", () => {
  it("never colours text under 14px with --ink-3", () => {
    const offenders: string[] = [];
    for (const file of walk(repoRoot)) {
      if (extname(file) !== ".css") continue;
      const rel = relative(repoRoot, file).split("\\").join("/");
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const [, selector, body] = m;
        if (!/color:\s*var\(--ink-3\)/.test(body!)) continue;
        if (!INK3_TEXT_OK.test(body!)) {
          offenders.push(`${rel}: ${selector!.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
