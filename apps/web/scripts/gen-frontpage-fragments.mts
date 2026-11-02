/**
 * Emits apps/web/public/fragments/frontpage-<issue>.html — the §2.2
 * newspaper front page as plain markup, rendered once per build by
 * `renderToStaticMarkup` (which the react-server condition forbids inside a
 * Server Component). `/{issue}` serves it as a static asset and mounts it on
 * the ≥768px breakpoint instead of shipping ~600 elements inside the initial
 * document: the dual-renderer DOM and RSC payload kept the sim main thread
 * busy past the LCP paint window, pinning the LHCI gate at ~0.94 vs the
 * 0.95 assertion (#95).
 *
 * The same file also carries `deck-<issue>.html` — the §2.1 card markup,
 * injected into the scroller via `dangerouslySetInnerHTML`: the DOM is
 * byte-identical (mobile needs the cards), but they stop occupying the
 * RSC-flight payload and hydration tree, whose eval cost sits inside the
 * same LCP-gating main-thread window.
 *
 * `lib/editions.ts` cannot be reused here: `import.meta.glob` is a bundler
 * feature, not Node. The ~15 lines of discovery it performs are replicated.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// @weekly/ui ships JSX compiled for the classic runtime — the transpiled
// calls reference a bare `React`, so expose it for this render.
(globalThis as { React?: typeof React }).React ??= React;
import type { Edition } from "@weekly/schema";
import { FrontPage } from "@weekly/ui";

import { DeckCards } from "../src/app/[issue]/DeckCards";
import { assembleFrontPage } from "../src/lib/frontpage";
import { site } from "../src/lib/site";

const APP_DIR = path.resolve(import.meta.dirname, "..");
const ROOT = path.resolve(APP_DIR, "../..");
const EDITIONS_DIR = path.join(ROOT, "editions");
const OUT_DIR = path.join(APP_DIR, "public/fragments");

const WEEK_ID_RE = /^(\d{4})-w(\d{2})$/;

/** Same contract as lib/editions.ts `isEditionId`. */
function isEditionId(value: string): boolean {
  const match = WEEK_ID_RE.exec(value);
  if (!match) return false;
  const week = Number(match[2]);
  return week >= 1 && week <= 53;
}

const editions = readdirSync(EDITIONS_DIR)
  .filter((file) => file.endsWith(".json") && isEditionId(file.replace(/\.json$/, "")))
  .map((file) => JSON.parse(readFileSync(path.join(EDITIONS_DIR, file), "utf8")) as Edition)
  .filter((edition) => edition.fixture !== true)
  .sort((a, b) => b.id.localeCompare(a.id));

mkdirSync(OUT_DIR, { recursive: true });

for (const ed of editions) {
  const view = assembleFrontPage(ed);
  // Mirror the <FrontPage> props in apps/web/src/app/[issue]/page.tsx exactly —
  // the fragment must render what the React subtree rendered before.
  const html = renderToStaticMarkup(
    React.createElement(FrontPage, {
      siteName: site.name,
      tagline: site.tagline,
      meta: view.meta,
      cover: view.cover,
      briefing: view.briefing,
      sections: view.sections,
      ...(view.markets ? { markets: view.markets } : {}),
      ...(view.mostCovered ? { mostCovered: view.mostCovered } : {}),
      backPage: view.backPage,
    }),
  );
  // React floats preload() hints to <head> during SSR; renderToStaticMarkup
  // emits them inline instead. The page's own preload() call already covers
  // the cover image, so drop inline copies to keep the served DOM identical.
  writeFileSync(
    path.join(OUT_DIR, `frontpage-${ed.id}.html`),
    html.replace(/<link\b[^>]*\/?>/g, ""),
  );

  const deckHtml = renderToStaticMarkup(
    React.createElement(DeckCards, { edition: ed, siteName: site.name }),
  );
  // The deck cover is the page's LCP element. Inlining it as a data URI
  // deletes the image's sim load-delay + load-time phases (~1.7s of the
  // ~3.0s LCP on a throttled runner — #95); the file is ~6KB so the
  // document cost is a single-digit-KiB base64 blob. The frontpage
  // fragment keeps the URL (desktop fetches it lazily anyway, and the
  // URL form stays cacheable).
  const coverImage = ed.pages[0]?.image;
  const coverFile = coverImage ? path.join(ROOT, coverImage) : null;
  const deckHtmlInlined =
    coverFile && existsSync(coverFile)
      ? deckHtml.replace(
          `src="/${coverImage}"`,
          `src="data:image/avif;base64,${readFileSync(coverFile).toString("base64")}"`,
        )
      : deckHtml;
  writeFileSync(
    path.join(OUT_DIR, `deck-${ed.id}.html`),
    deckHtmlInlined.replace(/<link\b[^>]*\/?>/g, ""),
  );
}

if (editions.length === 0) {
  throw new Error("gen-frontpage-fragments: no editions found");
}
console.log(`gen-frontpage-fragments: wrote ${editions.length} fragment(s) to ${path.relative(ROOT, OUT_DIR)}`);
