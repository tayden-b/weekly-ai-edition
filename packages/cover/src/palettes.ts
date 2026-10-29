/**
 * Curated palettes for the cover renderer (T3, STYLE.md §9): muted
 * colour-field tones only — a paper-like `ground`, 3–4 quiet `fields`, and at
 * most one warm `accent`. They live in `config/cover-palettes.json` so the
 * set is reviewable config, not code, and so the zero-hardcode style gate
 * never sees an art colour in a source file.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CoverPalette {
  /** Palette name — recorded in provenance.json. */
  name: string;
  /** Paper-tone base the whole composition sits on. */
  ground: string;
  /** Ordered quiet tones — compositions use them back-to-front. */
  fields: string[];
  /** Optional single warm accent (≤ one accent region per cover). */
  accent?: string;
}

const DEFAULT_PATHS = ["config/cover-palettes.json", "../../config/cover-palettes.json"];

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/**
 * Load the curated palette set. `path` defaults to the repo's
 * `config/cover-palettes.json` — resolved from cwd the same way
 * `lib/editions.ts` finds `editions/` (workspace root or repo root).
 */
export function loadCoverPalettes(path?: string): CoverPalette[] {
  const resolved =
    path ??
    DEFAULT_PATHS.map((p) => resolve(process.cwd(), p)).find((p) =>
      existsSync(p),
    );
  if (resolved === undefined) {
    throw new Error("cover palettes: config/cover-palettes.json not found");
  }
  const doc = JSON.parse(readFileSync(resolved, "utf8")) as {
    palettes?: unknown;
  };
  if (!Array.isArray(doc.palettes) || doc.palettes.length === 0) {
    throw new Error(`cover palettes: ${resolved} has no palettes`);
  }
  return (doc.palettes as Array<Record<string, unknown>>).map((raw, i) => {
    const label = `palette[${i}]`;
    if (typeof raw.name !== "string" || raw.name === "") {
      throw new Error(`cover palettes: ${label} missing name`);
    }
    if (typeof raw.ground !== "string" || !HEX6.test(raw.ground)) {
      throw new Error(`cover palettes: ${raw.name} ground must be #rrggbb`);
    }
    const fields = Array.isArray(raw.fields) ? (raw.fields as unknown[]) : [];
    if (fields.length < 2 || !fields.every((f) => typeof f === "string" && HEX6.test(f))) {
      throw new Error(
        `cover palettes: ${raw.name} needs ≥2 #rrggbb fields`,
      );
    }
    if (raw.accent !== undefined && (typeof raw.accent !== "string" || !HEX6.test(raw.accent))) {
      throw new Error(`cover palettes: ${raw.name} accent must be #rrggbb`);
    }
    return {
      name: raw.name,
      ground: raw.ground,
      fields: fields as string[],
      ...(typeof raw.accent === "string" ? { accent: raw.accent } : {}),
    };
  });
}
