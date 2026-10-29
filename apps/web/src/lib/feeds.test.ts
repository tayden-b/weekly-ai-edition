import { describe, expect, it } from "vitest";

import type { Edition } from "@weekly/schema";

import { listEditions } from "./editions";
import { escapeXml, feedItemTitle, jsonFeed, rssFeed } from "./feeds";
import { rawEdition } from "./fixture";

const BASE = "https://weekly.test";

function editionWith(overrides: { id: string; headline: string }): Edition {
  const copy = JSON.parse(JSON.stringify(rawEdition)) as Edition;
  copy.id = overrides.id;
  for (const page of copy.pages) {
    if (!("items" in page) || !Array.isArray(page.items)) continue;
    page.items.forEach((item) => {
      item.headline = overrides.headline;
    });
  }
  return copy;
}

function storyCount(edition: Edition): number {
  return edition.pages.reduce(
    (n, p) => n + ("items" in p && Array.isArray(p.items) ? p.items.length : 0),
    0,
  );
}

describe("escapeXml", () => {
  it("escapes the five XML entities", () => {
    expect(escapeXml(`a & b <c> "d" 'e'`)).toBe(
      "a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;",
    );
  });
});

describe("rssFeed", () => {
  const xml = rssFeed(listEditions(), BASE);

  it("is an RSS 2.0 channel with a self atom:link", () => {
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">');
    expect(xml).toContain(
      `<atom:link href="${BASE}/feed.xml" rel="self" type="application/rss+xml"/>`,
    );
    expect(xml).toContain(`<link>${BASE}</link>`);
    expect(xml).toContain("</rss>");
  });

  it("emits one item per story, each linked to the story's origin URL (L1)", () => {
    const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map((m) => m[1]);
    // channel title + one item title per story
    const editions = listEditions();
    const stories = editions.reduce((n, e) => n + storyCount(e), 0);
    expect(titles).toHaveLength(stories + 1);
    const links = [...xml.matchAll(/<item>[\s\S]*?<link>(https?:[^<]+)<\/link>/g)].map(
      (m) => m[1],
    );
    expect(links).toHaveLength(stories);
    for (const url of links) {
      expect(url, url).not.toMatch(
        /news\.ycombinator\.com|reddit\.com|distribute\.software/,
      );
    }
    const guids = [...xml.matchAll(/<guid [^>]*>(.*?)<\/guid>/g)].map((m) => m[1]);
    expect(new Set(guids).size).toBe(stories);
  });

  it("dates items on the edition's Friday (date_end) in RFC 822", () => {
    expect(xml).toContain("<pubDate>");
    expect(xml).toContain(
      "<lastBuildDate>Fri, 30 Oct 2026 00:00:00 GMT</lastBuildDate>",
    );
  });

  it("XML-escapes headlines and decks", () => {
    const out = rssFeed(
      [editionWith({ id: "2026-w46", headline: "Fish & <Chips>" })],
      BASE,
    );
    expect(out).toContain("Fish &amp; &lt;Chips&gt;");
    expect(out).not.toContain("<Chips>");
  });
});

describe("jsonFeed", () => {
  const doc = JSON.parse(jsonFeed(listEditions(), BASE)) as {
    version: string;
    title: string;
    home_page_url: string;
    feed_url: string;
    items: { id: string; url: string; title: string; date_published: string }[];
  };

  it("is a JSON Feed 1.1 document with self urls", () => {
    expect(doc.version).toBe("https://jsonfeed.org/version/1.1");
    expect(doc.home_page_url).toBe(BASE);
    expect(doc.feed_url).toBe(`${BASE}/feed.json`);
  });

  it("emits one item per story, url = origin URL, unique ids (L1)", () => {
    const editions = listEditions();
    const stories = editions.reduce((n, e) => n + storyCount(e), 0);
    expect(doc.items).toHaveLength(stories);
    for (const item of doc.items) {
      expect(item.url).toMatch(/^https?:\/\//);
      expect(item.url).not.toContain(BASE);
    }
    expect(new Set(doc.items.map((i) => i.id)).size).toBe(stories);
  });
});

describe("feedItemTitle", () => {
  it("packs issue number, date range and headline", () => {
    expect(feedItemTitle(rawEdition)).toMatch(/^№ \d+ · .+: .+/);
  });
});
