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

  return (
    <>
      <div className="issue-split__frontpage">
        <FrontPageChrome
          siteName={site.name}
          meta={view.meta}
          sections={view.navSections}
        />
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
      </div>
      <main className="issue-split__deck">
        <DeckView
          total={buildDeck(ed).length}
          headline={`${site.name} — № ${ed.issue_number} (${editionMeta(ed).dateRange})`}
          scrollerLabel={`${site.name} № ${ed.issue_number} — ${buildDeck(ed).length} pages; arrow keys or tap edges to turn`}
        >
          <DeckCards edition={ed} siteName={site.name} />
        </DeckView>
      </main>
    </>
  );
}
