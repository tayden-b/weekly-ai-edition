import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AgentAccess,
  CoverImage,
  Deck,
  DeckCard,
  FrontPage,
  Item,
  ItemList,
  IssueMeta,
  Kicker,
  LineChart,
  MarketsChart,
  Masthead,
  MonoTable,
  OgCard,
  Pill,
  ProgressSegments,
  Rule,
  SectionHead,
  TrendArrow,
  TrendDelta,
  type ItemView,
} from "./index";

const meta = { issue: 44, dateRange: "Oct 24–30" };
const item: ItemView = {
  headline: "A model shipped",
  one_liner: "It does the thing.",
  take: "Worth watching.",
  number: "$100M",
  sources: [
    {
      url: "https://example.com/a",
      publisher: "Example Daily",
      published_at: "2026-10-27T00:00:00Z",
    },
  ],
};

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("§4 primitives render", () => {
  it("Masthead band + compact", () => {
    expect(html(<Masthead variant="band" siteName="The Weekly AI Edition" meta={meta} />)).toContain(
      "The Weekly AI Edition",
    );
    expect(
      html(<Masthead variant="compact" siteName="The Weekly AI Edition" meta={meta} />),
    ).toContain("№ 44");
  });

  it("IssueMeta, Kicker, SectionHead, Rule, Pill", () => {
    expect(html(<IssueMeta meta={meta} />)).toContain("Oct 24–30");
    expect(html(<Kicker accent>Cover</Kicker>)).toContain("w-kicker--accent");
    expect(html(<SectionHead title="Models" />)).toContain("w-rule--section");
    expect(html(<Rule weight="hairline" />)).toContain("w-rule--hairline");
    expect(html(<Pill>Models</Pill>)).toContain("w-pill");
  });

  it("Item renders headline, one-liner, italic take, source line, number", () => {
    const out = html(<Item item={item} />);
    expect(out).toContain("A model shipped");
    expect(out).toContain("<em");
    expect(out).toContain("Worth watching.");
    expect(out).toContain("Example Daily");
    expect(out).toContain("$100M");
  });

  it("ItemList hairline stack", () => {
    expect(html(<ItemList items={[item, item]} />).match(/w-item"/g)).toHaveLength(2);
  });

  it("MonoTable plain + boxed", () => {
    const out = html(
      <MonoTable
        boxed
        columns={[{ key: "a", label: "A" }]}
        rows={[["x"]]}
      />,
    );
    expect(out).toContain("w-mono-table--boxed");
  });

  it("TrendDelta up/down/flat", () => {
    expect(html(<TrendDelta delta={2} />)).toContain("w-trend--up");
    expect(html(<TrendDelta delta={-2} />)).toContain("w-trend--down");
    expect(html(<TrendDelta delta={0} />)).toContain("w-trend--flat");
  });

  it("TrendArrow renders the bare arrow, no fabricated number", () => {
    const out = html(<TrendArrow trend="up" />);
    expect(out).toContain("w-trend--up");
    expect(out).toContain('aria-label="Trend up"');
    expect(out).not.toMatch(/[+-]?\d/);
    expect(html(<TrendArrow trend="down" />)).toContain("w-trend--down");
    expect(html(<TrendArrow trend="flat" />)).toContain("w-trend--flat");
  });

  it("ProgressSegments is a progressbar with aria-valuenow", () => {
    const out = html(<ProgressSegments total={11} current={4} />);
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-valuenow="4"');
    expect(out.match(/w-progress__seg--filled/g)).toHaveLength(4);
  });

  it("DeckCard is a named region; Deck wraps it", () => {
    const out = html(
      <Deck>
        <DeckCard meta={meta} kicker="Cover" title="T">
          body
        </DeckCard>
      </Deck>,
    );
    expect(out).toContain('role="region"');
    expect(out).toContain('aria-label="Cover"');
  });

  it("FrontPage lays out cover, briefing, sections, markets, most covered, back page", () => {
    const out = html(
      <FrontPage
        siteName="The Weekly AI Edition"
        meta={meta}
        cover={{ kicker: "№ 44", headline: "Big week", deck: "The deck." }}
        briefing={["Lead sentence.", "Second sentence."]}
        sections={[{ id: "models", title: "Models", items: [item] }]}
        markets={{
          data: [
            {
              ticker: "NVDA",
              deltaPct: 1.5,
              points: [
                { date: "2026-10-23", value: 100 },
                { date: "2026-10-26", value: 101 },
                { date: "2026-10-27", value: 101.5 },
              ],
            },
          ],
          missing: ["PLTR"],
          index: { label: "basket", points: [1, 2, 3] },
          tickers: [
            { ticker: "NVDA", close: 100, delta: 1.5 },
            { ticker: "PLTR", close: "n/a", delta: 0, na: true },
          ],
        }}
        mostCovered={[{ rank: 1, name: "OpenAI", stories: 6, trend: "up" }]}
        backPage={{
          sources: [["Example Daily", 3]],
          madeLines: ["Made by agents."],
          issueId: "2026-w44",
          links: [{ label: "custom.md", href: "/custom.md" }],
          copyright: "© 2026",
        }}
      />,
    );
    for (const cls of [
      "w-fp__cover",
      "w-fp__briefing",
      "w-fp__section",
      "w-fp__markets",
      "w-fp__most-covered",
      "w-fp__backpage",
    ]) {
      expect(out).toContain(cls);
    }
    expect(out).toContain("Most Covered");
  });

  it("FrontPage exposes jump-target ids and back-page agent links (V2)", () => {
    const out = html(
      <FrontPage
        siteName="The Weekly AI Edition"
        meta={meta}
        cover={{ kicker: "№ 44", headline: "Big week", deck: "The deck." }}
        briefing={["Lead."]}
        sections={[]}
        backPage={{
          sources: [],
          madeLines: [],
          issueId: "2026-w44",
          links: [{ label: "twin.md", href: "/2026-w44.md" }],
          copyright: "© 2026",
        }}
      />,
    );
    for (const id of ["cover", "briefing", "back-page"]) {
      expect(out).toContain(`id="${id}"`);
    }
    expect(out).toContain('href="/2026-w44.md"');
  });

  it("CoverImage typographic fallback + img", () => {
    expect(html(<CoverImage issueNo={44} />)).toContain("№ 44");
    expect(html(<CoverImage src="/x.png" alt="a" />)).toContain("<img");
  });

  it("LineChart renders an SVG polyline with a true aspect box", () => {
    const out = html(
      <LineChart series={[{ label: "b", points: [1, 2, 3], xLabels: ["a", "b", "c"] }]} />,
    );
    expect(out).toContain("<svg");
    expect(out).toContain("<polyline");
    expect(out).not.toContain('preserveAspectRatio="none"');
  });

  it("MarketsChart delta form: sorted %Δ bars, mono labels, n/a rows", () => {
    const out = html(
      <MarketsChart
        data={[
          { ticker: "NVDA", deltaPct: 3.3 },
          { ticker: "AMD", deltaPct: 8.4 },
          { ticker: "META", deltaPct: -1.2 },
        ]}
        missing={["PLTR", "AVGO"]}
      />,
    );
    expect(out).toContain("<svg");
    expect(out).toContain("w-mchart__bar");
    expect(out).not.toContain("<polyline");
    expect(out).not.toContain('preserveAspectRatio="none"');
    // Sorted descending: AMD first, NVDA second, META (negative) last.
    expect(out.indexOf(">AMD<")).toBeLessThan(out.indexOf(">NVDA<"));
    expect(out.indexOf(">NVDA<")).toBeLessThan(out.indexOf(">META<"));
    // % labels and the two n/a rows are present.
    expect(out).toContain("+8.4%");
    expect(out).toContain("-1.2%");
    expect(out.match(/>n\/a</g)).toHaveLength(2);
    // n/a rows follow the data rows.
    expect(out.indexOf(">PLTR<")).toBeGreaterThan(out.indexOf("-1.2%"));
  });

  it("MarketsChart line form: one %Δ line per ticker at ≥5 closes, end labels", () => {
    const pts = (base: number) =>
      [0, 1, 2, 3, 4].map((i) => ({
        date: `2026-10-${23 + i}`,
        value: base * (1 + i / 10),
      }));
    const out = html(
      <MarketsChart
        data={[
          { ticker: "NVDA", points: pts(100) },
          { ticker: "AMD", points: pts(50) },
        ]}
      />,
    );
    expect(out.match(/w-mchart__series/g)?.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain("w-mchart__dot");
    // End-of-line labels, not a legend.
    expect(out.match(/w-mchart__end/g)?.length).toBe(2);
    // Y-axis is %Δ, and the zero line is drawn.
    expect(out).toContain("+50%");
    expect(out).toContain("w-mchart__zero");
    expect(out).not.toContain("w-mchart__bar");
    expect(out).not.toContain('preserveAspectRatio="none"');
  });

  it("MarketsChart index fallback: the emitted index draws a line at ≥5 points", () => {
    const out = html(
      <MarketsChart
        data={[{ ticker: "NVDA", deltaPct: 3.3 }]}
        index={{ label: "basket", points: [100, 101, 102, 103, 104] }}
      />,
    );
    expect(out).toContain("w-mchart__series");
    expect(out).toContain(">basket<");
  });

  it("AgentAccess links the twins", () => {
    const out = html(<AgentAccess issueId="2026-w44" />);
    expect(out).toContain("/2026-w44.md");
    expect(out).toContain("llms.txt");
  });

  it("OgCard is 1200×630 paper with masthead and headline", () => {
    const out = html(
      <OgCard siteName="The Weekly AI Edition" kicker="№ 44" headline="Big week" />,
    );
    expect(out).toContain("w-og");
    expect(out).toContain("Big week");
  });
});
