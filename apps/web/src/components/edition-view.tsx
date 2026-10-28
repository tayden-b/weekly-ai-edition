import {
  AgentAccess,
  CoverImage,
  Deck,
  DeckCard,
  FrontPage,
  ItemList,
  LineChart,
  MonoTable,
  TrendDelta,
  type ItemView,
} from "@weekly/ui";

import {
  SECTION_TITLES,
  SECTION_TYPES,
  type FixtureEdition,
  type FixturePage,
} from "../lib/fixture";
import { site } from "../lib/site";

import "./edition-view.css";

const PAGE_NAMES: Record<string, string> = {
  cover: "Cover",
  briefing: "The Briefing",
  markets: "Markets",
  most_covered: "Most Covered",
  back_page: "Back Page",
};

const TOTAL_PAGES = 11;

function sourceCount(page: FixturePage): number {
  const items = page.items ?? [];
  const itemSources = items.reduce((n, item) => n + item.sources.length, 0);
  const pageSources = (page.sources ?? []).reduce(
    (n, [, count]) => n + count,
    0,
  );
  return itemSources + pageSources;
}

function DeckBody({
  page,
  issueNo,
  issueId,
}: {
  page: FixturePage;
  issueNo: number;
  issueId: string;
}) {
  if (page.type === "cover") {
    return (
      <>
        <CoverImage aspect="4:5" issueNo={issueNo} />
        {page.deck ? <p className="v4-deck-deck">{page.deck}</p> : null}
      </>
    );
  }
  if (page.type === "briefing") {
    return (
      <>
        {(page.sentences ?? []).map((s, i) => (
          <p key={i} className="v4-deck-sentence">
            {s}
          </p>
        ))}
      </>
    );
  }
  if (page.type === "markets") {
    return (
      <>
        <LineChart series={page.chart?.series ?? []} />
        <div className="v4-deck-markets">
          <MonoTable
            columns={[
              { key: "ticker", label: "Ticker" },
              { key: "close", label: "Close", align: "right" },
              { key: "delta", label: "Δ week", align: "right" },
            ]}
            rows={(page.tickers ?? []).map((t) => [
              t.ticker,
              typeof t.close === "number" ? t.close.toFixed(2) : t.close,
              <TrendDelta key={t.ticker} delta={t.delta} />,
            ])}
          />
        </div>
      </>
    );
  }
  if (page.type === "most_covered") {
    return (
      <MonoTable
        boxed
        columns={[
          { key: "rank", label: "#" },
          { key: "name", label: "Company" },
          { key: "stories", label: "Stories", align: "right" },
          { key: "trend", label: "Trend", align: "right" },
        ]}
        rows={(page.rows ?? []).map((r) => [
          r.rank,
          r.name,
          r.stories,
          <TrendDelta
            key={r.name}
            delta={r.trend === "up" ? 1 : r.trend === "down" ? -1 : 0}
            suffix=""
          />,
        ])}
      />
    );
  }
  if (page.type === "back_page") {
    return (
      <>
        <p className="v4-deck-backpage-head">Sources</p>
        <ul className="v4-deck-sources">
          {(page.sources ?? []).map(([outlet, count]) => (
            <li key={outlet}>
              <span>{outlet}</span>
              <span className="v4-mono">{count}</span>
            </li>
          ))}
        </ul>
        <p className="v4-deck-backpage-head">How this issue was made</p>
        {(page.made ?? []).map((line, i) => (
          <p key={i} className="v4-deck-sentence">
            {line}
          </p>
        ))}
        <div className="v4-deck-markets">
          <AgentAccess issueId={issueId} />
        </div>
      </>
    );
  }
  return <ItemList items={(page.items ?? []) as ItemView[]} />;
}

function DeckTitle({ page }: { page: FixturePage }) {
  if (page.type === "cover") return <>{page.headline}</>;
  return <>{PAGE_NAMES[page.type] ?? SECTION_TITLES[page.type] ?? page.type}</>;
}

/**
 * EditionView — the baseline `/{issue}` experience V4 needs for `/` and
 * `/issues` to resolve: the §2.1 deck on mobile, the §2.2 front page on
 * desktop, switched by media query. V1 (swipe/tap zones, progress fill,
 * keyboard) and V2 (sticky bar, j/k) build their interactions on this route;
 * V3 hangs per-page routes off it.
 */
export function EditionView({ edition }: { edition: FixtureEdition }) {
  const meta = {
    issue: edition.issue,
    dateRange: edition.date_range.label,
    siteName: site.name,
  };

  const pageOfType = (type: string) =>
    edition.pages.find((p) => p.type === type);
  const cover = pageOfType("cover");
  const briefing = pageOfType("briefing");
  const markets = pageOfType("markets");
  const mostCovered = pageOfType("most_covered");
  const backPage = pageOfType("back_page");

  const sections = SECTION_TYPES.map((type) => ({
    id: type,
    title: SECTION_TITLES[type] ?? type,
    items: (pageOfType(type)?.items ?? []) as ItemView[],
  }));

  return (
    <>
      <div className="v4-edition-deck">
        <Deck>
          {edition.pages.map((page, i) => (
            <DeckCard
              key={`${page.type}-${i}`}
              meta={meta}
              kicker={PAGE_NAMES[page.type] ?? SECTION_TITLES[page.type] ?? page.type}
              kickerAccent={page.type === "cover"}
              title={<DeckTitle page={page} />}
              footer={
                <>
                  <span>{sourceCount(page)} sources</span>
                  <span>
                    {i + 1}/{TOTAL_PAGES}
                  </span>
                </>
              }
            >
              <DeckBody
                page={page}
                issueNo={edition.issue}
                issueId={edition.id}
              />
            </DeckCard>
          ))}
        </Deck>
      </div>

      <div className="v4-edition-front">
        <FrontPage
          siteName={site.name}
          tagline={site.tagline}
          meta={meta}
          cover={{
            kicker: cover?.kicker ?? `№ ${edition.issue}`,
            headline: cover?.headline ?? "",
            deck: cover?.deck ?? "",
          }}
          briefing={briefing?.sentences ?? []}
          sections={sections}
          markets={{
            series: markets?.chart?.series ?? [],
            tickers: markets?.tickers ?? [],
            ...(markets?.chart?.caption
              ? { caption: markets.chart.caption }
              : {}),
          }}
          mostCovered={mostCovered?.rows ?? []}
          backPage={{
            sources: backPage?.sources ?? [],
            madeLines: backPage?.made ?? [],
            issueId: edition.id,
            copyright: `© 2026 ${site.name}. Content CC BY-NC; sources attributed.`,
          }}
        />
      </div>
    </>
  );
}
