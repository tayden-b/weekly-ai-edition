/** Single config value for the masthead name — a rename is one PR (DESIGN.md §7). */
export const site = {
  name: "The Weekly AI Edition",
  tagline: "One link a week. Everything that mattered in AI.",
} as const;

/**
 * Canonical absolute origin of the site — Vercel's production URL, then the
 * deployment URL, then the dev server. Feeds + metadataBase both need it.
 */
export function siteUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
