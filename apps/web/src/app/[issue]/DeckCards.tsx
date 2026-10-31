import type { ReactNode } from "react";

import type { Edition, EditionPage } from "@weekly/schema";
import {
  AgentAccess,
  CoverImage,
  Deck,
  DeckCard,
  ItemList,
  MarketsChart,
  MonoTable,
  TrendArrow,
  TrendDelta,
} from "@weekly/ui";

import {
  agentLinks,
  buildDeck,
  editionMeta,
  mapItem,
  type DeckCardModel,
  type SectionItem,
} from "../../lib/deck";
import { marketsView } from "../../lib/markets";

/**
 * The deck's cards, server-rendered and passed into the DeckView client
 * island as opaque children: only the scroller shell hydrates (progress,
 * tap zones, arrow-key nav) — the ~30 card bodies never join the React
 * tree, so first paint isn't held behind their hydration.
 */
export function DeckCards({
  edition,
  siteName,
}: {
  edition: Edition;
  siteName: string;
}) {
  const cards = buildDeck(edition);
  const links = agentLinks(edition);
  const meta = { ...editionMeta(edition), siteName };

  const body = (card: DeckCardModel): ReactNode => {
    const { page } = card;
    switch (page.type) {
      case "cover":
        return (
          <>
            <CoverImage
              issueNo={edition.issue_number}
              {...(page.image ? { src: `/${page.image}`, alt: "" } : {})}
            />
            {page.deck ? (
              <p className="dv-dek">
                {page.url !== undefined ? (
                  <a
                    className="dv-dek__link"
                    href={page.url}
                    rel="noopener noreferrer"
                  >
                    {page.deck}
                  </a>
                ) : (
                  page.deck
                )}
              </p>
            ) : null}
          </>
        );
      case "briefing":
        return (
          <div className="dv-briefing">
            {page.sentences.map((s, i) => (
              <p key={i} className="dv-briefing__s">
                {s}
              </p>
            ))}
          </div>
        );
      case "markets": {
        const mv = marketsView(page);
        return (
          <div className="dv-markets">
            <MarketsChart
              data={mv.data}
              index={mv.index}
              missing={mv.missing}
              ariaLabel="Weekly change by ticker"
            />
            <MonoTable
              columns={[
                { key: "t", label: "Ticker" },
                { key: "c", label: "Close", align: "right" },
                { key: "d", label: "Δ week", align: "right" },
              ]}
              rows={mv.tickers.map((t) => [
                t.ticker,
                t.na ? <span className="w-na">n/a</span> : t.close,
                t.na ? (
                  <span key={t.ticker} className="w-na">
                    n/a
                  </span>
                ) : (
                  <TrendDelta key={t.ticker} delta={t.delta} />
                ),
              ])}
              caption={mv.caption}
            />
          </div>
        );
      }
      case "most_covered":
        return (
          <MonoTable
            boxed
            columns={[
              { key: "r", label: "#" },
              { key: "n", label: "Company" },
              { key: "s", label: "Stories", align: "right" },
              { key: "t", label: "Trend", align: "right" },
            ]}
            rows={page.entries.map((e, i) => [
              i + 1,
              e.name,
              e.stories,
              <TrendArrow key={e.company} trend={e.trend} />,
            ])}
          />
        );
      case "back_page":
        return (
          <div className="dv-backpage">
            <p className="dv-block-head">Sources</p>
            <MonoTable
              columns={[
                { key: "p", label: "Outlet" },
                { key: "c", label: "Items", align: "right" },
              ]}
              rows={page.source_counts.map((c) => [c.publisher, c.count])}
            />
            <p className="dv-block-head">How this issue was made</p>
            <p className="dv-made">{page.how_made}</p>
            {page.colophon ? <p className="dv-colophon">{page.colophon}</p> : null}
            <AgentAccess issueId={edition.id} links={links} />
          </div>
        );
      default: {
        // models, performance, launches, funding, deals, discourse
        const itemsPage = page as EditionPage & { items: SectionItem[] };
        return (
          <ItemList
            items={itemsPage.items.map((i) => mapItem(i, page.type))}
          />
        );
      }
    }
  };

  return (
    <Deck>
      {cards.map((card, i) => (
        <DeckCard
          key={card.type}
          meta={meta}
          kicker={card.kicker}
          kickerAccent={card.kickerAccent}
          title={
            card.titleUrl !== undefined ? (
              <a
                className="w-deck-card__title-link"
                href={card.titleUrl}
                rel="noopener noreferrer"
              >
                {card.title}
              </a>
            ) : (
              card.title
            )
          }
          active={i === 0}
          footer={
            <>
              <span>{card.sourceCount} sources</span>
              <span>
                {card.index + 1}/{edition.pages.length}
              </span>
            </>
          }
        >
          {body(card)}
        </DeckCard>
      ))}
    </Deck>
  );
}
