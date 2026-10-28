/**
 * Syndication feed builders (T2, PLAN §4): RSS 2.0 + JSON Feed 1.1, one entry
 * per edition on disk — issue number, date range, headline, `/{issue}` link.
 * Pure string builders; the route handlers wrap them in Responses and both
 * artifacts regenerate from `editions/` on every build.
 */
import type { Edition } from "@weekly/schema";

import { dateRangeLabel } from "./fixture";
import { site } from "./site";

/**
 * `<link rel="alternate">` descriptors for both feeds, in the Next Metadata
 * API's `alternates.types` shape. Pages that set their own `alternates`
 * (e.g. for a canonical) replace the parent's map wholesale — spread this in
 * alongside so the feed links survive on every route.
 */
export const feedLinkTypes = {
  "application/rss+xml": [{ url: "/feed.xml", title: `${site.name} — RSS` }],
  "application/feed+json": [
    { url: "/feed.json", title: `${site.name} — JSON Feed` },
  ],
};

/** XML-escape the characters legal in element text and attribute values. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function coverHeadline(edition: Edition): string {
  const cover = edition.pages.find((p) => p.type === "cover");
  return cover && cover.type === "cover" ? cover.headline : edition.id;
}

function coverDeck(edition: Edition): string | undefined {
  const cover = edition.pages.find((p) => p.type === "cover");
  return cover && cover.type === "cover" ? cover.deck : undefined;
}

/** `№ 2 · Oct 31–Nov 6: <cover headline>` — every required field in the title. */
export function feedItemTitle(edition: Edition): string {
  const range = dateRangeLabel(edition.date_start, edition.date_end);
  return `№ ${edition.issue_number} · ${range}: ${coverHeadline(edition)}`;
}

/**
 * The edition's publication date. `date_end` (the covered week's Friday) is
 * the only timestamp the schema carries — deterministic across builds.
 */
function pubDateUtc(edition: Edition): Date {
  return new Date(`${edition.date_end}T00:00:00Z`);
}

function itemDescription(edition: Edition): string {
  const deck = coverDeck(edition);
  const range = dateRangeLabel(edition.date_start, edition.date_end);
  return deck ? `${range} — ${deck}` : `${range} — ${coverHeadline(edition)}`;
}

/** RSS 2.0, newest edition first; `editions` must already be sorted. */
export function rssFeed(editions: Edition[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const latest = editions[0];
  const items = editions
    .map((edition) => {
      const url = `${base}/${edition.id}`;
      return `    <item>
      <title>${escapeXml(feedItemTitle(edition))}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pubDateUtc(edition).toUTCString()}</pubDate>
      <description>${escapeXml(itemDescription(edition))}</description>
    </item>`;
    })
    .join("\n");
  const lastBuild = latest
    ? `    <lastBuildDate>${pubDateUtc(latest).toUTCString()}</lastBuildDate>\n`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.name)}</title>
    <link>${escapeXml(base)}</link>
    <atom:link href="${escapeXml(`${base}/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(site.tagline)}</description>
    <language>en</language>
${lastBuild}${items}
  </channel>
</rss>
`;
}

/** JSON Feed 1.1 (https://jsonfeed.org), newest edition first. */
export function jsonFeed(editions: Edition[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const doc = {
    version: "https://jsonfeed.org/version/1.1",
    title: site.name,
    home_page_url: base,
    feed_url: `${base}/feed.json`,
    description: site.tagline,
    items: editions.map((edition) => {
      const url = `${base}/${edition.id}`;
      return {
        id: url,
        url,
        title: feedItemTitle(edition),
        summary: itemDescription(edition),
        date_published: `${edition.date_end}T00:00:00Z`,
      };
    }),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}
