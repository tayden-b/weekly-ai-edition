import { describe, expect, it } from "vitest";

import { rawEdition } from "./fixture";
import { assembleFrontPage, NAV_SECTIONS, shortDate } from "./frontpage";

const view = assembleFrontPage(rawEdition);

describe("assembleFrontPage (DESIGN §2.2)", () => {
  it("renders the six section bands in fixed template order", () => {
    expect(view.sections.map((s) => s.id)).toEqual([
      "models",
      "performance",
      "launches",
      "funding",
      "deals",
      "discourse",
    ]);
    expect(view.sections.map((s) => s.title)).toEqual([
      "Models & Releases",
      "Performance",
      "Launches",
      "Funding",
      "Deals",
      "Discourse",
    ]);
  });

  it("builds the cover with the one red № kicker", () => {
    expect(view.cover.kicker).toBe("№ 1");
    expect(view.cover.headline).toBe(rawEdition.pages[0].headline);
    expect(view.meta).toEqual({ issue: 1, dateRange: "Oct 24–30" });
  });

  it("carries the briefing sentences verbatim", () => {
    expect(view.briefing).toEqual(rawEdition.pages[1].sentences);
    expect(view.briefing.length).toBeGreaterThanOrEqual(5);
    expect(view.briefing.length).toBeLessThanOrEqual(7);
  });

  it("maps markets data, index fallback, n/a rows, and a data-source caption", () => {
    expect(view.markets?.index?.points).toEqual([100, 101.5, 103]);
    expect(view.markets?.index?.xLabels).toEqual([
      "Oct 23",
      "Oct 26",
      "Oct 27",
    ]);
    // Per-ticker series recovered from the source excerpts.
    const nvda = view.markets?.data.find((d) => d.ticker === "NVDA");
    expect(nvda?.deltaPct).toBe(3.31);
    expect(nvda?.points?.length).toBeGreaterThanOrEqual(3);
    // Configured basket tickers with no data render explicit n/a rows.
    expect(view.markets?.missing).toEqual(["AVGO", "PLTR"]);
    expect(view.markets?.tickers[0]).toEqual({
      ticker: "NVDA",
      close: 217.94,
      delta: 3.31,
    });
    expect(view.markets?.tickers.at(-1)).toEqual({
      ticker: "PLTR",
      close: "n/a",
      delta: 0,
      na: true,
    });
    expect(view.markets?.caption).toBe("Data: Exa Markets · CBC Globe");
  });

  it("puts the amount in the mono slot; deals without one say undisclosed", () => {
    const funding = view.sections.find((s) => s.id === "funding");
    const deals = view.sections.find((s) => s.id === "deals");
    expect(funding?.items[1]?.number).toBe("$1.5B");
    expect(deals?.items[0]?.number).toBe("$1.7B");
    expect(deals?.items[1]?.headline).toBe("RapidCanvas → Entytle");
    expect(deals?.items[1]?.number).toBe("undisclosed");
  });

  it("keeps performance numbers in mono", () => {
    const perf = view.sections.find((s) => s.id === "performance");
    expect(perf?.items[0]?.number).toBe("50.3%");
  });

  it("assembles the back page: source counts, agent links, copyright line", () => {
    expect(view.backPage.sources).toContainEqual(["Exa Markets", 8]);
    expect(view.backPage.links?.map((l) => l.href)).toEqual([
      "/2026-w44.md",
      "/2026-w44.json",
      "/llms.txt",
      "/feed.xml",
    ]);
    expect(view.backPage.links?.map((l) => l.label)).toEqual([
      "2026-w44.md",
      "2026-w44.json",
      "llms.txt",
      "feed.xml",
    ]);
    expect(view.backPage.copyright).toBe(
      "© 2026 The Weekly AI Edition. Code MIT · Content CC BY-NC with sources attributed.",
    );
  });

  it("ranks most-covered entries by position", () => {
    expect(view.mostCovered).toHaveLength(5);
    expect(view.mostCovered![0]).toEqual({
      rank: 1,
      name: "OpenAI",
      stories: 3,
      trend: "up",
    });
  });

  it("lists the nine nav/jump sections in page order", () => {
    expect(NAV_SECTIONS.map((s) => s.id)).toEqual([
      "models",
      "performance",
      "launches",
      "funding",
      "deals",
      "discourse",
      "markets",
      "most-covered",
      "back-page",
    ]);
    expect(view.navSections).toEqual(NAV_SECTIONS);
  });

  it("omits dropped pages from bands, markets, most-covered and nav", () => {
    const sparse = structuredClone(rawEdition);
    sparse.pages[5].items = []; // funding
    sparse.pages[6].items = []; // deals
    sparse.pages[7].tickers = []; // markets
    sparse.pages[9].entries = []; // most_covered
    const v = assembleFrontPage(sparse);
    expect(v.sections.map((s) => s.id)).toEqual([
      "models",
      "performance",
      "launches",
      "discourse",
    ]);
    expect(v.markets).toBeUndefined();
    expect(v.mostCovered).toBeUndefined();
    expect(v.navSections.map((s) => s.id)).toEqual([
      "models",
      "performance",
      "launches",
      "discourse",
      "back-page",
    ]);
  });
});

describe("cover image (T3)", () => {
  it("fixture without cover.image keeps the typographic fallback (no src)", () => {
    // w-cover__fallback renders when src is absent — the fallback path.
    expect(rawEdition.pages[0].image).toBeUndefined();
    expect(view.cover.src).toBeUndefined();
  });

  it("edition with cover.image maps src to the served asset path", () => {
    const withImage = structuredClone(rawEdition);
    withImage.pages[0].image = "editions/2026-w44/cover.avif";
    const v = assembleFrontPage(withImage);
    expect(v.cover.src).toBe("/editions/2026-w44/cover.avif");
  });
});

describe("shortDate", () => {
  it("formats ISO dates for chart axes", () => {
    expect(shortDate("2026-10-23")).toBe("Oct 23");
    expect(shortDate("2026-01-05")).toBe("Jan 5");
  });
});
