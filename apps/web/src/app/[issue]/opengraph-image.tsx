import { notFound } from "next/navigation";

import { getEdition, ogFields } from "../../lib/pages";
import { ogImageResponse, OG_SIZE } from "../../lib/og-image";
import { site } from "../../lib/site";

export const runtime = "nodejs";
export const alt = "The Weekly AI Edition — The Briefing";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Issue-root OG = the Briefing card (DESIGN §2.2). */
export default async function Image({
  params,
}: {
  params: Promise<{ issue: string }>;
}) {
  const { issue } = await params;
  const ed = getEdition(issue);
  if (!ed) notFound();
  const briefing = ed.pages.find((p) => p.type === "briefing");
  const fields = briefing
    ? ogFields(briefing)
    : { kicker: "Briefing", headline: site.tagline };
  return ogImageResponse({ siteName: site.name, ...fields });
}
