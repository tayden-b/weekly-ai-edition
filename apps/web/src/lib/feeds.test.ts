import { describe, expect, it } from "vitest";

import type { Edition } from "@weekly/schema";

import { listEditions } from "./editions";
import { escapeXml, feedItemTitle, jsonFeed, rssFeed } from "./feeds";
import { rawEdition } from "./fixture";

const BASE = "https://weekly.test";

function editionWith(overrides: { id: string; headline: string }): Edition {
  const copy = JSON.parse(JSON.stringify(rawEdition)) as Edition;
  copy.id = overrides.id;
  const cover = copy.pages.find((p) => p.type === "cover");
  if (cover && cover.type === "cover") cover.headline = overrides.headline;
  return copy;
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

  it("emits one item per edition, newest first, linking /{issue}", () => {
    const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map((m) => m[1]);
    // channel title + one item title per edition
    expect(titles).toHaveLength(listEditions().length + 1);
    expect(titles[1]).toContain("№ 2 · Oct 31–Nov 6:");
    expect(titles[2]).toContain("№ 1 · Oct 24–30:");
    const links = [...xml.matchAll(/<guid isPermaLink="true">(.*?)<\/guid>/g)].map(
      (m) => m[1],
    );
    expect(links).toEqual([`${BASE}/2026-w45`, `${BASE}/2026-w44`]);
  });

  it("dates items on the edition's Friday (date_end) in RFC 822", () => {
    expect(xml).toContain("<pubDate>Fri, 06 Nov 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<pubDate>Fri, 30 Oct 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain(
      "<lastBuildDate>Fri, 06 Nov 2026 00:00:00 GMT</lastBuildDate>",
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

  it("emits one item per edition, newest first, with RFC 3339 dates", () => {
    expect(doc.items.map((i) => i.url)).toEqual([
      `${BASE}/2026-w45`,
      `${BASE}/2026-w44`,
    ]);
    expect(doc.items[0]?.id).toBe(doc.items[0]?.url);
    expect(doc.items[0]?.title).toContain("№ 2 · Oct 31–Nov 6:");
    expect(doc.items[0]?.date_published).toBe("2026-11-06T00:00:00Z");
    expect(doc.items[1]?.date_published).toBe("2026-10-30T00:00:00Z");
  });
});

describe("feedItemTitle", () => {
  it("packs issue number, date range and headline", () => {
    expect(feedItemTitle(rawEdition)).toMatch(/^№ \d+ · .+: .+/);
  });
});
