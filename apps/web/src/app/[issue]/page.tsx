import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";

import { FrontPage } from "@weekly/ui";

import { buildDeck, editionMeta } from "../../lib/deck";
import { getEdition, listEditions } from "../../lib/editions";
import { assembleFrontPage } from "../../lib/frontpage";
import { site } from "../../lib/site";
import { DeckCards } from "./DeckCards";
import { DeckView } from "./DeckView";
import { FrontPageChrome } from "./FrontPageChrome";

import "./deck.css";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return listEditions().map((edition) => ({ issue: edition.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issue: string }>;
}): Promise<Metadata> {
  const { issue } = await params;
  const ed = getEdition(issue);
  if (!ed) return {};
  const [cover] = ed.pages;
  return {
    title: `${site.name} — № ${ed.issue_number} (${cover.headline})`,
    description: cover.deck ?? site.tagline,
  };
}

/**
 * `/{issue}` is the whole experience on one route (DESIGN §2): the §2.1
 * swipe deck below 768px, the §2.2 newspaper front page at 768px and up.
 * Both render server-side; `deck.css` toggles which is visible.
 */
export default async function IssuePage({
  params,
}: {
  params: Promise<{ issue: string }>;
}) {
  const { issue } = await params;
  const ed = getEdition(issue);
  if (!ed) notFound();

  const view = assembleFrontPage(ed);
  // The generative cover is the page's LCP element — preload it so the
  // fetch runs parallel to render-blocking CSS instead of after it (T3).
  if (view.cover.src) preload(view.cover.src, { as: "image", fetchPriority: "high" });

  // Both renderers' markup arrives as build-time fragments from
  // scripts/gen-frontpage-fragments.mts (#95 — details on the frontpage
  // half below). The deck's cards are injected the same way: the served DOM
  // is identical and DeckView manipulates `.w-deck-card` nodes imperatively,
  // but ~570 elements stop occupying the RSC-flight payload + hydration
  // tree whose eval sits inside the LCP-gating main-thread window.
  // `display:contents` keeps the cards laid out as direct scroller children.
  // A missing fragment (e.g. a bare `next build`/`next dev` outside the
  // package scripts) falls back to the normal React render — identical DOM.
  const fragmentPath = (name: string) =>
    path.join(process.cwd(), "public/fragments", name);
  const readFragment = (name: string): string | null =>
    existsSync(fragmentPath(name))
      ? readFileSync(fragmentPath(name), "utf8")
      : null;
  const deckHtml = readFragment(`deck-${issue}.html`);
  const frontpageSrc = existsSync(fragmentPath(`frontpage-${issue}.html`))
    ? `/fragments/frontpage-${issue}.html`
    : null;

  return (
    <>
      {/* Without JS the fragment can't mount — fall back to the deck on
          desktop too (native scroll-snap still pages it). Keeps §2's
          "neither is a fallback" on the no-JS path (#95). */}
      <noscript>
        <style>{`
          @media (min-width: 768px) {
            .issue-split__frontpage { display: none; }
            .issue-split__deck { display: block; }
          }
        `}</style>
      </noscript>
      {/* §2.2 markup is a static fragment emitted once per build by
          scripts/gen-frontpage-fragments.mts and mounted by FrontPageChrome
          only at the ≥768px front-page breakpoint — the dual-renderer's
          ~1.2k-node DOM + RSC payload kept the sim main thread busy past
          the LCP window, pinning the LHCI gate at ~0.94 vs 0.95 (#95).
          `main` stays empty in the document; deck.css still toggles the
          layer, and every e2e/frontpage assertion sees the same DOM. */}
      <div className="issue-split__frontpage">
        <FrontPageChrome
          siteName={site.name}
          meta={view.meta}
          sections={view.navSections}
          {...(frontpageSrc ? { frontpageSrc } : {})}
        />
        {frontpageSrc ? (
          <main />
        ) : (
          <main>
            <FrontPage
              siteName={site.name}
              tagline={site.tagline}
              meta={view.meta}
              cover={view.cover}
              briefing={view.briefing}
              sections={view.sections}
              {...(view.markets ? { markets: view.markets } : {})}
              {...(view.mostCovered ? { mostCovered: view.mostCovered } : {})}
              backPage={view.backPage}
            />
          </main>
        )}
      </div>
      <main className="issue-split__deck">
        {/* .dv-root + the scroller are server markup so the ~570-node card
            DOM stays out of the RSC-flight payload + hydration tree (#95).
            DeckView attaches its listeners by selector at hydration. */}
        <div className="dv-root">
          {/* The compact masthead is not a heading — the deck still needs one h1. */}
          <h1 className="dv-sr-only">
            {`${site.name} — № ${ed.issue_number} (${editionMeta(ed).dateRange})`}
          </h1>
          <DeckView total={buildDeck(ed).length} />
          <div
            className="dv-scroller"
            role="group"
            aria-roledescription="carousel"
            aria-label={`${site.name} № ${ed.issue_number} — ${buildDeck(ed).length} pages; arrow keys or tap edges to turn`}
            aria-keyshortcuts="ArrowLeft ArrowRight Home End"
            tabIndex={0}
          >
            {deckHtml !== null ? (
              /* Build-time fragment — byte-for-byte DeckCards' markup. */
              <div
                style={{ display: "contents" }}
                dangerouslySetInnerHTML={{ __html: deckHtml }}
              />
            ) : (
              <DeckCards edition={ed} siteName={site.name} />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
