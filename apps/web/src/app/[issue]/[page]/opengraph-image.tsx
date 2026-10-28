import { notFound } from "next/navigation";

import { getEdition, ogFields, parsePageParam } from "../../../lib/pages";
import { ogImageResponse, OG_SIZE } from "../../../lib/og-image";
import { site } from "../../../lib/site";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Per-page OG at 1200×630 — paper ground, masthead, page kicker, headline (§1.5.5). */
export default async function Image({
  params,
}: {
  params: Promise<{ issue: string; page: string }>;
}) {
  const { issue, page } = await params;
  const ed = getEdition(issue);
  const n = parsePageParam(page);
  const p = ed && n != null ? ed.pages[n - 1] : undefined;
  if (!p) notFound();
  return ogImageResponse({ siteName: site.name, ...ogFields(p) });
}
