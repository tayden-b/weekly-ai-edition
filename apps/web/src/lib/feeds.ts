/**
 * Syndication feed builders (T2, PLAN §4; L1 per-story links): RSS 2.0 +
 * JSON Feed 1.1, one entry per story in each edition — every entry's link
 * is the story's origin URL (the primary source, never an aggregator),
 * plus a comments/discussion URL when the record carries one.
 * Pure string builders; the route handlers wrap them in Responses and both
 * artifacts regenerate from `editions/` on every build.
 */
import { discussionUrl, primarySource } from "@weekly/schema";
import type { Edition, EditionSource } from "@weekly/schema";

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

/** One story in feed order: page type, headline, one-liner, sources. */
interface FeedStory {
  edition: Edition;
  pageType: string;
  index: number;
  headline: string;
  one_liner: string;
  sources: EditionSource[];
}

/** Every item-bearing page's items, flattened in edition order. */
function feedStories(edition: Edition): FeedStory[] {
  const stories: FeedStory[] = [];
  for (const page of edition.pages) {
    if (!("items" in page) || !Array.isArray(page.items)) continue;
    page.items.forEach((item, index) => {
      stories.push({
        edition,
        pageType: page.type,
        index,
        headline: item.headline,
        one_liner: item.one_liner,
        sources: item.sources,
      });
    });
  }
  return stories;
}

/** The edition's publication date. `date_end` (the covered week's Friday) is
 * the only timestamp the schema carries — deterministic across builds. */
function pubDateUtc(edition: Edition): Date {
  return new Date(`${edition.date_end}T00:00:00Z`);
}

function storyDate(source: EditionSource, edition: Edition): Date {
  const t = Date.parse(source.published_at);
  return Number.isNaN(t) ? pubDateUtc(edition) : new Date(t);
}

/** `№ 2 · Oct 31–Nov 6: <cover headline>` — the edition item's title. */
export function feedItemTitle(edition: Edition): string {
  const cover = edition.pages.find((p) => p.type === "cover");
  const headline = cover && cover.type === "cover" ? cover.headline : edition.id;
  const range = dateRangeLabel(edition.date_start, edition.date_end);
  return `№ ${edition.issue_number} · ${range}: ${headline}`;
}

/** RSS 2.0 — one <item> per story; `<link>` is the origin URL (L1). */
export function rssFeed(editions: Edition[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const latest = editions[0];
  const items = editions
    .flatMap(feedStories)
    .map((story) => {
      const primary = primarySource(story.sources);
      if (primary === undefined) return "";
      const discussion = discussionUrl(primary);
      return `    <item>
      <title>${escapeXml(story.headline)}</title>
      <link>${escapeXml(primary.url)}</link>
      <guid isPermaLink="false">${escapeXml(
        `${story.edition.id}/${story.pageType}/${story.index}`,
      )}</guid>
      <pubDate>${storyDate(primary, story.edition).toUTCString()}</pubDate>
      <description>${escapeXml(story.one_liner)}</description>${
        discussion !== undefined
          ? `\n      <comments>${escapeXml(discussion)}</comments>`
          : ""
      }
    </item>`;
    })
    .filter((x) => x !== "")
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

/** JSON Feed 1.1 (https://jsonfeed.org) — `url` is the origin URL (L1). */
export function jsonFeed(editions: Edition[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const items = editions.flatMap(feedStories).flatMap((story) => {
    const primary = primarySource(story.sources);
    if (primary === undefined) return [];
    const discussion = discussionUrl(primary);
    return [
      {
        id: `${base}/${story.edition.id}#${story.pageType}-${story.index}`,
        url: primary.url,
        external_url: primary.url,
        title: story.headline,
        summary: story.one_liner,
        date_published: storyDate(primary, story.edition).toISOString(),
        ...(primary.via !== undefined
          ? { _weekly_via: primary.via }
          : {}),
        ...(discussion !== undefined
          ? { _weekly_discussion_url: discussion }
          : {}),
      },
    ];
  });
  const doc = {
    version: "https://jsonfeed.org/version/1.1",
    title: site.name,
    home_page_url: base,
    feed_url: `${base}/feed.json`,
    description: site.tagline,
    items,
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}
