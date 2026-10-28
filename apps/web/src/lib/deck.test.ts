import { describe, expect, it } from "vitest";

import { rawEdition } from "./fixture";
import {
  agentLinks,
  buildDeck,
  DECK_PAGE_NAMES,
  editionMeta,
  getEdition,
  mapItem,
} from "./deck";

const ORDER = [
  "cover",
  "briefing",
  "models",
  "performance",
  "launches",
  "funding",
  "deals",
  "markets",
  "discourse",
  "most_covered",
  "back_page",
] as const;

describe("buildDeck", () => {
  const cards = buildDeck(rawEdition);

  it("emits one card per template page, in fixed order", () => {
    expect(cards.map((c) => c.type)).toEqual([...ORDER]);
    expect(cards.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("names every card (kicker = page name, accent on Cover only)", () => {
    for (const c of cards) {
      expect(c.kicker).toBe(DECK_PAGE_NAMES[c.type]);
      expect(c.kickerAccent).toBe(c.type === "cover");
    }
  });

  it("uses the week headline as the cover title", () => {
    expect(cards[0]?.title).toBe(rawEdition.pages[0].headline);
  });

  it("counts page sources; synthesis pages show the issue total", () => {
    const back = rawEdition.pages.find((p) => p.type === "back_page");
    const total = back?.type === "back_page" ? back.sources_total : 0;
    const byType = Object.fromEntries(cards.map((c) => [c.type, c.sourceCount]));
    expect(total).toBeGreaterThan(0);
    expect(byType.models).toBe(
      rawEdition.pages[2].items.reduce((n, i) => n + i.sources.length, 0),
    );
    expect(byType.markets).toBe(
      rawEdition.pages[7].type === "markets"
        ? rawEdition.pages[7].sources.length
        : 0,
    );
    expect(byType.back_page).toBe(total);
    expect(byType.cover).toBe(total);
    expect(byType.briefing).toBe(total);
    expect(byType.most_covered).toBe(total);
  });
});

describe("mapItem", () => {
  const src = {
    url: "https://example.com/a",
    publisher: "Example Daily",
    published_at: "2026-10-27T00:00:00Z",
    fetched_at: "2026-10-27T01:00:00Z",
    adapter: "fixture",
    excerpt: "…",
  };

  it("keeps headline/one-liner/take and the explicit number", () => {
    const view = mapItem(
      {
        headline: "H",
        one_liner: "L",
        take: "T",
        number: "92.4",
        sources: [src],
        evidence: { source_index: 0, quote: "…" },
      },
      "performance",
    );
    expect(view).toMatchObject({
      headline: "H",
      one_liner: "L",
      take: "T",
      number: "92.4",
    });
    expect(view.sources[0]?.publisher).toBe("Example Daily");
  });

  it("puts the funding amount in the mono slot", () => {
    const view = mapItem(
      {
        headline: "H",
        one_liner: "L",
        amount: "$1.5B",
        sources: [src],
        evidence: { source_index: 0, quote: "…" },
      },
      "funding",
    );
    expect(view.number).toBe("$1.5B");
  });

  it("writes 'undisclosed' on a deal without a public amount", () => {
    const view = mapItem(
      {
        headline: "H",
        one_liner: "L",
        acquirer: "A",
        target: "T",
        sources: [src],
      },
      "deals",
    );
    expect(view.number).toBe("undisclosed");
  });
});

describe("deck meta + lookup", () => {
  it("maps issue number + date range", () => {
    expect(editionMeta(rawEdition)).toEqual({
      issue: rawEdition.issue_number,
      dateRange: "Oct 24–30",
    });
  });

  it("resolves only committed editions", () => {
    expect(getEdition(rawEdition.id)).toBe(rawEdition);
    expect(getEdition("1999-w01")).toBeNull();
  });

  it("lists the back-page agent links by basename", () => {
    const links = agentLinks(rawEdition);
    expect(links.map((l) => l.href)).toEqual([
      "/2026-w44.md",
      "/2026-w44.json",
      "/llms.txt",
      "/feed.xml",
    ]);
    expect(links[0]?.label).toBe("2026-w44.md");
  });
});
