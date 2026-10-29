/**
 * sitemap.xml entries (I3): the archive (`/issues`), `/brand`, every
 * edition `/{issue}` and every standalone page route `/{issue}/{n}`
 * (PLAN §4 — each page is a shareable URL with its own OG card). Editions
 * are immutable once published, so `lastModified` is the edition's
 * `date_end`; the weekly cadence makes `weekly` the honest change
 * frequency for the listing routes. Pure builder like feeds.ts — the
 * `app/sitemap.ts` route handler wraps it with `siteUrl()`.
 */
import { listEditions } from "./editions";
import { allPageParams } from "./pages";

export interface SitemapEntry {
  url: string;
  lastModified?: string | undefined;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

export function sitemapEntries(baseUrl: string): SitemapEntry[] {
  const base = baseUrl.replace(/\/$/, "");
  const editions = listEditions();
  const latestEnd = editions[0]?.date_end;

  const entry = (
    path: string,
    lastModified?: string,
    priority = 0.5,
  ): SitemapEntry => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: "weekly",
    priority,
  });

  return [
    entry("/", latestEnd, 1),
    entry("/issues", latestEnd, 0.8),
    entry("/brand", latestEnd, 0.3),
    ...editions.map((edition) => entry(`/${edition.id}`, edition.date_end, 0.9)),
    ...allPageParams().map(({ issue, page }) =>
      entry(
        `/${issue}/${page}`,
        editions.find((edition) => edition.id === issue)?.date_end,
        0.6,
      ),
    ),
  ];
}
