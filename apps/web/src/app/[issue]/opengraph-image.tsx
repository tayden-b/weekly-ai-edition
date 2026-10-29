import { notFound } from "next/navigation";

import { getEditionAsset } from "../../lib/editions";
import { getEdition, ogFields } from "../../lib/pages";
import { ogImageResponse, OG_SIZE } from "../../lib/og-image";
import { site } from "../../lib/site";

export const runtime = "nodejs";
export const alt = "The Weekly AI Edition — The Briefing";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Issue-root OG (T3): the committed generative cover card
 * (`editions/<week>/cover-og.png`, 1200x630) when it exists — the art IS
 * the card. Without a cover file, the generated Briefing card is served
 * (the typographic fallback, mirroring the w-cover__fallback behavior).
 */
export default async function Image({
  params,
}: {
  params: Promise<{ issue: string }>;
}) {
  const { issue } = await params;
  const ed = getEdition(issue);
  if (!ed) notFound();

  const og = getEditionAsset(issue, "cover-og.png");
  if (og) {
    return new Response(new Uint8Array(og), {
      headers: { "content-type": "image/png" },
    });
  }

  const briefing = ed.pages.find((p) => p.type === "briefing");
  const fields = briefing
    ? ogFields(briefing)
    : { kicker: "Briefing", headline: site.tagline };
  return ogImageResponse({ siteName: site.name, ...fields });
}
