import type { Metadata } from "next";
import type { ReactNode } from "react";

import { feedLinkTypes } from "../../lib/feeds";
import { getEdition } from "../../lib/pages";
import { site } from "../../lib/site";

/**
 * Segment metadata for `/{issue}` and everything under it. The title +
 * description here cover the issue root; `/{issue}/{n}` pages override them.
 * og:image/twitter:image come from the sibling `opengraph-image` /
 * `twitter-image` file conventions (Briefing card for the root, per-page
 * cards under `[page]/`).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ issue: string }>;
}): Promise<Metadata> {
  const { issue } = await params;
  const ed = getEdition(issue);
  if (!ed) return {};
  const briefing = ed.pages.find((p) => p.type === "briefing");
  const description = briefing?.sentences?.[0] ?? site.tagline;
  const title = `№ ${ed.issue} · ${ed.date_range.label} — ${site.name}`;
  return {
    title,
    description,
    alternates: { canonical: `/${ed.id}`, types: feedLinkTypes },
    openGraph: {
      title,
      description,
      type: "article",
      siteName: site.name,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function IssueLayout({ children }: { children: ReactNode }) {
  return children;
}
