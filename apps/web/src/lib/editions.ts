/**
 * Filesystem edition discovery (V4). `editions/<week>.json` at the repo root is
 * the CMS — each file is a canonical `Edition` (C2 schema). `import.meta.glob`
 * pulls every matching file into the module graph at build time, so adding a
 * file changes the listing on the next build. No database, no client fetches.
 *
 * Validity is enforced by `pnpm schema:validate` (the check gate); the viewer
 * trusts the contract like every other consumer.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Edition } from "@weekly/schema";

import { mapEdition, type FixtureEdition } from "./fixture";

const EDITION_FILES = import.meta.glob("../../../../editions/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

/**
 * `process.cwd()` is `apps/web` under next dev/build and `pnpm --filter`, but
 * the repo root under root `pnpm test` — the editions dir is whichever exists.
 */
const EDITIONS_DIR = ["../../editions", "editions"]
  .map((dir) => path.resolve(process.cwd(), dir))
  .find((dir) => existsSync(dir));

const WEEK_ID_RE = /^(\d{4})-w(\d{2})$/;

export function isEditionId(value: string): boolean {
  const match = WEEK_ID_RE.exec(value);
  if (!match) return false;
  const week = Number(match[2]);
  return week >= 1 && week <= 53;
}

/**
 * The public catalog: every committed edition on disk that is not a flagged
 * test/replay artifact (`fixture: true`), newest week first. Week ids
 * (`YYYY-wNN`) are zero-padded so lexicographic order is chronological
 * order. Fixture artifacts stay committed for the CI gates (schema,
 * provenance, replay determinism) but are never served: no `/` redirect,
 * no listing, no static route.
 */
export function listEditions(): Edition[] {
  return Object.entries(EDITION_FILES)
    .filter(([path]) => isEditionId(path.split("/").pop()!.replace(/\.json$/, "")))
    .map(([, json]) => json as Edition)
    .filter((edition) => edition.fixture !== true)
    .sort((a, b) => b.id.localeCompare(a.id));
}

export function latestEdition(): Edition | undefined {
  return listEditions()[0];
}

/** One edition by week id, or undefined when the file does not exist. */
export function getEdition(id: string): Edition | undefined {
  if (!isEditionId(id)) return undefined;
  return listEditions().find((edition) => edition.id === id);
}

/**
 * The edition file's exact bytes for `/{issue}.json` — serving them verbatim
 * makes the twin provably identical to `editions/<week>.json` (T1). Read at
 * call time; callers that prerender (the force-static route handler) bake the
 * bytes in at build.
 */
export function getEditionRaw(id: string): string | undefined {
  if (!isEditionId(id) || !EDITIONS_DIR) return undefined;
  try {
    return readFileSync(path.join(EDITIONS_DIR, `${id}.json`), "utf8");
  } catch {
    return undefined;
  }
}

/** Canonical `Edition` → the view props the @weekly/ui renderers consume. */
export function editionView(edition: Edition): FixtureEdition {
  return mapEdition(edition);
}

// --- T3: committed cover assets under editions/<week>/ ---------------------

/** Whitelist — only the cover artifacts are servable; the sibling files
 * (LLM requests/responses, provenance) stay internal by construction. */
const COVER_ASSET_RE = /^cover(?:-og)?\.(?:svg|avif|png)$/;

/**
 * Every servable cover asset on disk — `{issue, filename}` pairs for
 * `generateStaticParams` of the `/editions/*` route.
 */
export function listEditionAssets(): { issue: string; filename: string }[] {
  if (!EDITIONS_DIR) return [];
  const out: { issue: string; filename: string }[] = [];
  for (const entry of readdirSync(EDITIONS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isEditionId(entry.name)) continue;
    for (const file of readdirSync(path.join(EDITIONS_DIR, entry.name))) {
      if (COVER_ASSET_RE.test(file)) {
        out.push({ issue: entry.name, filename: file });
      }
    }
  }
  return out;
}

/**
 * One committed cover asset's bytes (`editions/<issue>/<filename>`), or
 * undefined. Filename is whitelist-validated — no traversal possible.
 */
export function getEditionAsset(
  id: string,
  filename: string,
): Buffer | undefined {
  if (!isEditionId(id) || !COVER_ASSET_RE.test(filename) || !EDITIONS_DIR) {
    return undefined;
  }
  try {
    return readFileSync(path.join(EDITIONS_DIR, id, filename));
  } catch {
    return undefined;
  }
}
