import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FrontPage } from "@weekly/ui";

import { rawEdition } from "../../lib/fixture";
import { assembleFrontPage, getEdition } from "../../lib/frontpage";
import { site } from "../../lib/site";
import { FrontPageChrome } from "./FrontPageChrome";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ issue: rawEdition.id }];
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

export default async function IssuePage({
  params,
}: {
  params: Promise<{ issue: string }>;
}) {
  const { issue } = await params;
  const ed = getEdition(issue);
  if (!ed) notFound();

  const view = assembleFrontPage(ed);

  return (
    <>
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
    </>
  );
}
