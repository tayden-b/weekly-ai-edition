import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";

import { FrontPage } from "@weekly/ui";

import { coverDataUri, getEdition, listEditions } from "../../lib/editions";
import { assembleFrontPage } from "../../lib/frontpage";
import { site } from "../../lib/site";
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
  // The generative cover is the page's LCP element: inline it when small
  // (no fetch at all), else preload so the fetch runs parallel to CSS (T3).
  const inlineCover = coverDataUri(ed.id, ed.pages[0]?.image);
  if (inlineCover) view.cover.src = inlineCover;
  else if (view.cover.src) preload(view.cover.src, { as: "image" });

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
            mostCovered={view.mostCovered}
            backPage={view.backPage}
          />
        </main>
      </div>
      <main className="issue-split__deck">
        <DeckView edition={ed} siteName={site.name} coverSrc={view.cover.src} />
      </main>
    </>
  );
}
