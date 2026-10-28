import { describe, expect, it } from "vitest";

import { edition } from "./fixture";
import {
  getEdition,
  ogFields,
  pageKicker,
  pageTitle,
  parsePageParam,
} from "./pages";

describe("getEdition", () => {
  it("resolves the fixture edition case-insensitively", () => {
    expect(getEdition("2026-w44")?.id).toBe("2026-w44");
    expect(getEdition("2026-W44")?.id).toBe("2026-w44");
  });

  it("returns undefined for unknown issues", () => {
    expect(getEdition("1999-w01")).toBeUndefined();
    expect(getEdition("kitchen-sink")).toBeUndefined();
  });
});

describe("parsePageParam", () => {
  it("accepts 1-based page numbers", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("11")).toBe(11);
    expect(parsePageParam("03")).toBe(3);
  });

  it("rejects non-numbers, zero, negatives and decimals", () => {
    for (const raw of ["0", "-1", "1.5", "x", "", "1e1", " 3"]) {
      expect(parsePageParam(raw)).toBeNull();
    }
  });
});

describe("page names", () => {
  it("fixture has the full 11-page template", () => {
    expect(edition.pages).toHaveLength(11);
    expect(edition.pages.map((p) => p.type)).toEqual([
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
    ]);
  });

  it("kicker/title match the deck card anatomy", () => {
    const cover = edition.pages[0]!;
    expect(pageKicker(cover)).toBe("Cover");
    expect(pageTitle(cover)).toBe(cover.headline);
    const briefing = edition.pages[1]!;
    expect(pageKicker(briefing)).toBe("Briefing");
    expect(pageTitle(briefing)).toBe("The Briefing");
    expect(pageKicker(edition.pages[9]!)).toBe("Most Covered");
  });
});

describe("source counts", () => {
  it("counts page-level sources for markets and item sources for sections", () => {
    const markets = edition.pages.find((p) => p.type === "markets")!;
    expect(markets.sourceCount).toBeGreaterThan(0);
    expect(markets.sourcePublishers).toContain("Exa Markets");
    const models = edition.pages.find((p) => p.type === "models")!;
    const summed = (models.items ?? []).reduce(
      (n, it) => n + it.sources.length,
      0,
    );
    expect(models.sourceCount).toBe(summed);
    expect(
      edition.pages.find((p) => p.type === "back_page")?.sourceCount,
    ).toBe(34);
  });
});

describe("ogFields", () => {
  it("cover OG carries the cover headline", () => {
    const f = ogFields(edition.pages[0]!);
    expect(f.kicker).toBe("Cover");
    expect(f.headline).toContain("Exponential Time Hypothesis");
  });

  it("briefing OG leads with the first sentence (issue-root card)", () => {
    const f = ogFields(edition.pages[1]!);
    expect(f.kicker).toBe("Briefing");
    expect(f.headline.startsWith("Anthropic filed to go public")).toBe(true);
  });

  it("section OG leads with the top item headline", () => {
    const models = edition.pages[2]!;
    expect(ogFields(models).headline).toBe(models.items![0]!.headline);
  });

  it("markets OG uses the chart title; back page the source total", () => {
    const markets = edition.pages.find((p) => p.type === "markets")!;
    expect(ogFields(markets).headline).toBe("AI basket index, week to date");
    const back = edition.pages.find((p) => p.type === "back_page")!;
    expect(ogFields(back).headline).toBe("34 sources this week");
    const mc = edition.pages.find((p) => p.type === "most_covered")!;
    expect(ogFields(mc).headline).toBe("OpenAI · 3 stories");
  });
});
