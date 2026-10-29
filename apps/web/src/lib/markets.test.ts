import { describe, expect, it } from "vitest";

import type { EditionMarketsPage, EditionSource } from "@weekly/schema";

import { rawEdition } from "./fixture";
import { MARKETS_BASKET, marketsView } from "./markets";

const marketsPage = rawEdition.pages.find(
  (p): p is EditionMarketsPage => p.type === "markets",
)!;

const source = (over: Partial<EditionSource>): EditionSource => ({
  url: "https://exa.ai/library/markets/stock/NVDA?date=2026-10-27&view=series",
  publisher: "Exa Markets",
  published_at: "2026-10-27T12:00:00.000Z",
  fetched_at: "2026-10-28T09:00:00.000Z",
  adapter: "markets",
  excerpt: "US:NVDA — raw closing price series.",
  ...over,
});

describe("marketsView — series recovery", () => {
  it("parses per-ticker dated closes from fixture-shaped excerpts", () => {
    const page: EditionMarketsPage = {
      type: "markets",
      sources: [
        source({
          url: "https://exa.ai/library/markets/stock/NVDA?date=2026-10-27&view=series",
          excerpt:
            "US:NVDA — raw closing price series. 2026-10-23 USD 210.96. 2026-10-26 USD 216.00. 2026-10-27 USD 217.94.",
        }),
      ],
      chart: {
        title: "AI basket index, week to date",
        unit: "index",
        series: [
          { date: "2026-10-23", value: 100 },
          { date: "2026-10-26", value: 100.5 },
          { date: "2026-10-27", value: 101.2 },
        ],
      },
      tickers: [
        {
          ticker: "NVDA",
          name: "NVIDIA",
          close: 217.94,
          change_pct: 3.31,
          direction: "up",
          evidence: { source_index: 0, quote: "2026-10-27 USD 217.94" },
        },
      ],
    };
    const v = marketsView(page);
    expect(v.data).toHaveLength(1);
    expect(v.data[0]!.ticker).toBe("NVDA");
    expect(v.data[0]!.deltaPct).toBe(3.31);
    expect(v.data[0]!.points).toEqual([
      { date: "2026-10-23", value: 210.96 },
      { date: "2026-10-26", value: 216.0 },
      { date: "2026-10-27", value: 217.94 },
    ]);
    expect(v.missing).toEqual(
      MARKETS_BASKET.filter((t) => t !== "NVDA"),
    );
  });

  it("parses stooq-weekly sources: ticker + dated closes from source_ids and excerpt", () => {
    const page: EditionMarketsPage = {
      type: "markets",
      sources: [
        source({
          url: "https://stooq.com/q/d/l/?s=nvda.us&i=w",
          publisher: "Stooq",
          adapter: "markets",
          excerpt:
            "NVIDIA (NVDA) week ending 2026-10-24: close 217.94, +3.3% vs prior weekly close 210.96 (Stooq weekly bars, i=w).",
          source_ids: {
            ticker: "NVDA",
            week_ending: "2026-10-24",
            weekly_close: "217.94",
          },
        }),
      ],
      chart: {
        title: "AI basket index, week to date",
        unit: "index",
        series: [
          { date: "2026-10-24", value: 100 },
          { date: "2026-10-27", value: 103.3 },
        ],
      },
      tickers: [
        {
          ticker: "NVDA",
          name: "NVIDIA",
          close: 217.94,
          change_pct: 3.3,
          direction: "up",
          evidence: { source_index: 0, quote: "close 217.94" },
        },
      ],
    };
    const v = marketsView(page);
    expect(v.data[0]!.ticker).toBe("NVDA");
    expect(v.data[0]!.points).toContainEqual({
      date: "2026-10-24",
      value: 217.94,
    });
  });

  it("n/a rows cover every basket ticker without data, in basket order", () => {
    const v = marketsView(marketsPage);
    // Fixture page has 8 of 10 basket tickers; AVGO + PLTR get n/a rows.
    expect(v.missing).toEqual(["AVGO", "PLTR"]);
    const naTickers = v.tickers.filter((t) => t.na).map((t) => t.ticker);
    expect(naTickers).toEqual(["AVGO", "PLTR"]);
    expect(v.tickers).toHaveLength(10);
    expect(v.tickers.at(-2)).toEqual({
      ticker: "AVGO",
      close: "n/a",
      delta: 0,
      na: true,
    });
  });
});

describe("marketsView — caption honesty", () => {
  it("flags recorded sources when every market source is fixture-derived", () => {
    const fixture = (s: EditionSource) => ({
      ...s,
      source_ids: { fixture: "2026-w44", fixture_page: "markets" },
    });
    const page: EditionMarketsPage = {
      ...marketsPage,
      sources: marketsPage.sources.map(fixture) as unknown as EditionMarketsPage["sources"],
    };
    const v = marketsView(page);
    expect(v.caption).toContain("Exa Markets");
    expect(v.caption).toContain("live market feed unavailable");
  });

  it("keeps the plain publisher caption for live sources", () => {
    const v = marketsView(marketsPage);
    expect(v.caption).toBe("Data: Exa Markets · CBC Globe");
  });
});
