import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { primarySource } from "@weekly/schema";
import { ItemList } from "@weekly/ui";
import type { Edition } from "@weekly/schema";

import { listEditions } from "./editions";
import { jsonFeed, rssFeed } from "./feeds";
import { assembleFrontPage } from "./frontpage";
import { editionToMarkdown } from "./twin";
import { buildDeck, mapItem } from "./deck";
import { rawEdition } from "./fixture";

/**
 * L1 guard — the L1 brief: every rendered item headline is an external link
 * to the story's primary source (the first non-aggregator `sources[]`
 * entry), the cover headline/deck link to the cover's `url`, the `.md` twin
 * renders `[headline](url)`, and both feeds link each item to its origin.
 * Fails if any item with `sources[]` loses its rendered link.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "../../../../fixtures/2026-w44/edition.json");

const BASE = "https://weekly.test";
const EXTERNAL = /^https?:\/\//;

interface EditionItemLike {
  headline: string;
  sources: { url: string; publisher: string; via?: string }[];
}

function itemPages(edition: Edition): EditionItemLike[][] {
  return edition.pages
    .filter((p) => "items" in p && Array.isArray(p.items) && p.items.length > 0)
    .map((p) => (p as { items: EditionItemLike[] }).items);
}

function allItems(edition: Edition): EditionItemLike[] {
  return itemPages(edition).flat();
}

const fixtureEdition = JSON.parse(readFileSync(FIXTURE, "utf8")) as Edition;
const editions = [...listEditions(), fixtureEdition];

describe("source links — edition data", () => {
  it("every item has a primary (non-aggregator) source with an https URL", () => {
    for (const ed of editions) {
      for (const item of allItems(ed)) {
        const primary = primarySource(item.sources);
        expect(primary, `“${item.headline}” has no source`).toBeDefined();
        expect(primary!.url).toMatch(EXTERNAL);
      }
    }
  });

  it("the w44 cover carries the primary source url for the headline link", () => {
    for (const ed of editions) {
      const cover = ed.pages.find((p) => p.type === "cover");
      if (cover && cover.type === "cover") {
        expect(cover.url, `${ed.id} cover missing url`).toMatch(EXTERNAL);
      }
    }
  });

  it("records publisher=origin + via=aggregator when the adapter surfaced an aggregator", () => {
    // Publisher is never identical to via; the live w44 edition carries the
    // aggregator-sourced records (e.g. the Gemini cluster → Google via HN).
    for (const ed of editions) {
      for (const item of allItems(ed)) {
        for (const s of item.sources) {
          if (s.via !== undefined) {
            expect(
              s.publisher.toLowerCase(),
              `via on ${s.publisher}`,
            ).not.toBe(s.via.toLowerCase());
          }
        }
      }
    }
    const live = listEditions().find((e) => e.id === "2026-w44")!;
    const viaSources = allItems(live).flatMap((i) =>
      i.sources.filter((s) => s.via !== undefined),
    );
    expect(viaSources.length).toBeGreaterThan(0);
    const gemini = allItems(live).find((i) =>
      i.headline.includes("Gemini 4 Carbon"),
    )!;
    const g = gemini.sources.find((s) => s.via === "Hacker News");
    expect(g?.publisher).toBe("Google");
    expect(g?.url).toContain("blog.google");
  });
});

describe("source links — rendered markup", () => {
  for (const ed of editions) {
    it(`${ed.id}: every item headline renders <a> to its primary source`, () => {
      const view = assembleFrontPage(ed);
      for (const section of view.sections) {
        const markup = renderToStaticMarkup(
          createElement(ItemList, { items: section.items }),
        );
        const links = markup.match(/w-item__headline-link/g) ?? [];
        expect(
          links,
          `${ed.id} ${section.title}: ${section.items.length} items, ${links.length} headline links`,
        ).toHaveLength(section.items.length);
        for (const item of section.items) {
          const primary = primarySource(item.sources)!;
          expect(markup).toContain(`href="${primary.url}"`);
          expect(markup).toContain('rel="noopener noreferrer"');
          // The source line carries at least one publisher link.
          expect(markup).toContain("w-item__source-link");
        }
      }
    });
  }

  it("deck view-models resolve a title url for the cover and sources per item", () => {
    for (const ed of editions) {
      const cards = buildDeck(ed);
      const cover = cards.find((c) => c.type === "cover");
      expect(cover?.titleUrl, `${ed.id} cover card titleUrl`).toMatch(EXTERNAL);
      for (const page of ed.pages) {
        if (!("items" in page) || !Array.isArray(page.items)) continue;
        for (const item of page.items) {
          const model = mapItem(item, page.type);
          expect(primarySource(model.sources), item.headline).toBeDefined();
        }
      }
    }
  });
});

describe("source links — .md twin", () => {
  const md = editionToMarkdown(rawEdition);

  it("renders every item headline as a markdown link to its primary source", () => {
    const headlineLinks = md.match(/^### \[/gm) ?? [];
    expect(headlineLinks).toHaveLength(allItems(rawEdition).length);
    for (const item of allItems(rawEdition)) {
      const primary = primarySource(item.sources)!;
      expect(md).toContain(`](${primary.url})`);
    }
  });

  it("links the cover headline to the cover url", () => {
    const cover = rawEdition.pages.find((p) => p.type === "cover");
    if (cover && cover.type === "cover" && cover.url !== undefined) {
      expect(md).toContain(`# [${cover.headline}](${cover.url})`);
    }
  });
});

describe("source links — feeds", () => {
  const storyCount = allItems(rawEdition).length;
  const xml = rssFeed([rawEdition], BASE);
  const feed = JSON.parse(jsonFeed([rawEdition], BASE)) as {
    items: { url: string; external_url: string }[];
  };

  it("RSS emits one item per story, each linked to the origin URL", () => {
    const links = [...xml.matchAll(/<item>[\s\S]*?<link>(https?:[^<]+)<\/link>/g)].map(
      (m) => m[1],
    );
    expect(links).toHaveLength(storyCount);
    for (const item of allItems(rawEdition)) {
      const primary = primarySource(item.sources)!;
      expect(links).toContain(primary.url);
    }
    expect(xml).not.toContain(`${BASE}/2026-w44</link>`);
  });

  it("JSON Feed emits one item per story, url + external_url = origin", () => {
    expect(feed.items).toHaveLength(storyCount);
    for (const entry of feed.items) {
      expect(entry.url).toMatch(EXTERNAL);
      expect(entry.external_url).toBe(entry.url);
    }
  });
});
