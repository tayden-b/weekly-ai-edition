import { describe, expect, it } from "vitest";

import { DECK_PAGE_NAMES } from "./deck";
import { latestEdition, listEditions } from "./editions";
import { llmsFullTxt, llmsTxt } from "./llms";

describe("llmsTxt", () => {
  const txt = llmsTxt(listEditions());

  it("follows the llmstxt.org convention: H1 + blockquote summary", () => {
    expect(txt.startsWith("# The Weekly AI Edition\n")).toBe(true);
    expect(txt).toContain("\n> One link a week.");
    expect(txt).toContain("`/{issue}.md`");
    expect(txt).toContain("`/{issue}.json`");
  });

  it("links the latest issue and both twins plus llms-full", () => {
    expect(txt).toContain("## Latest issue");
    expect(txt).toContain("[№ 2 · Oct 31–Nov 6:");
    expect(txt).toContain("[2026-w45.md](/2026-w45.md)");
    expect(txt).toContain("[2026-w45.json](/2026-w45.json)");
    expect(txt).toContain("(/llms-full.txt)");
  });

  it("lists every edition and the feeds", () => {
    expect(txt).toContain("## Editions");
    expect(txt).toContain("[Issues archive](/issues)");
    expect(txt).toContain("[2026-w45](/2026-w45)");
    expect(txt).toContain("[2026-w44](/2026-w44)");
    expect(txt).toContain("## Feeds");
    expect(txt).toContain("(/feed.xml)");
    expect(txt).toContain("(/feed.json)");
  });

  it("still emits a valid map with no editions on disk", () => {
    const empty = llmsTxt([]);
    expect(empty.startsWith("# The Weekly AI Edition\n")).toBe(true);
    expect(empty).not.toContain("## Latest issue");
    expect(empty).toContain("## Feeds");
    expect(empty).toContain("(/feed.xml)");
  });
});

describe("llmsFullTxt", () => {
  const edition = latestEdition()!;
  const txt = llmsFullTxt(edition);

  it("has the llmstxt H1 with issue number, range and id context", () => {
    expect(txt.startsWith(`# The Weekly AI Edition № 2 — Oct 31–Nov 6, 2026`)).toBe(
      true,
    );
    expect(txt).toContain(`[${edition.id}.md](/${edition.id}.md)`);
    expect(txt).toContain(`[${edition.id}.json](/${edition.id}.json)`);
  });

  it("flattens all 11 template pages", () => {
    for (const name of Object.values(DECK_PAGE_NAMES)) {
      expect(txt).toContain(`## ${name}`);
    }
  });

  it("carries the cover, briefing, items and the sources list", () => {
    const cover = edition.pages[0];
    if (cover.type !== "cover") throw new Error("fixture shape");
    expect(txt).toContain(`### ${cover.headline}`);
    if (cover.deck) expect(txt).toContain(cover.deck);

    const briefing = edition.pages[1];
    if (briefing.type !== "briefing") throw new Error("fixture shape");
    for (const sentence of briefing.sentences) {
      expect(txt).toContain(sentence);
    }

    for (const page of edition.pages) {
      if ("items" in page) {
        for (const item of page.items) {
          expect(txt).toContain(`### ${item.headline}`);
          for (const source of item.sources) {
            expect(txt).toContain(`[${source.publisher}](${source.url})`);
          }
        }
      }
    }
  });

  it("renders markets, most-covered and the back page", () => {
    const markets = edition.pages.find((p) => p.type === "markets");
    if (markets?.type !== "markets") throw new Error("fixture shape");
    expect(txt).toContain(`**${markets.chart.title}**`);
    expect(txt).toContain(`${markets.tickers[0]!.ticker} (${markets.tickers[0]!.name})`);
    for (const s of markets.sources) {
      expect(txt).toContain(`[${s.publisher}](${s.url})`);
    }

    const covered = edition.pages.find((p) => p.type === "most_covered");
    if (covered?.type !== "most_covered") throw new Error("fixture shape");
    expect(txt).toContain(`1. ${covered.entries[0]!.name}`);

    const back = edition.pages.find((p) => p.type === "back_page");
    if (back?.type !== "back_page") throw new Error("fixture shape");
    expect(txt).toContain(`${back.sources_total} fetched source records`);
    expect(txt).toContain(back.how_made);
    if (back.colophon) expect(txt).toContain(back.colophon);
  });

  it("ends with the agent-access links", () => {
    expect(txt).toContain("## Agent access");
    expect(txt).toContain("[llms.txt](/llms.txt)");
    expect(txt).toContain("(/feed.xml)");
    expect(txt).toContain("(/feed.json)");
    expect(txt.endsWith("\n")).toBe(true);
    expect(txt).not.toContain("undefined");
  });
});
