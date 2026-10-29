import type {
  AgentLink,
  ChartSeriesView,
  CoveredRowView,
  IssueMetaView,
  ItemView,
  MarketTickerDatum,
  TickerView,
} from "../types";
import { AgentAccess } from "./AgentAccess";
import { CoverImage } from "./CoverImage";
import { Item } from "./Item";
import { Kicker } from "./Kicker";
import { MarketsChart } from "./MarketsChart";
import { Masthead } from "./Masthead";
import { MonoTable } from "./MonoTable";
import { SectionHead } from "./SectionHead";
import { TrendArrow, TrendDelta } from "./TrendDelta";

export interface FrontPageCover {
  src?: string;
  alt?: string;
  kicker: string; // "№ 44" — the one red on desktop (§3)
  headline: string;
  /** Primary-source URL the headline + deck link to (L1). */
  url?: string;
  deck: string;
}

export interface FrontPageSection {
  id: string;
  title: string;
  items: ItemView[];
}

export interface FrontPageMarkets {
  /** Per-ticker data for the chart — %Δ rows and/or dated closes. */
  data: MarketTickerDatum[];
  /** Configured basket tickers with no data — explicit "n/a" rows. */
  missing?: string[];
  /** Composite index fallback — drawn only when it reaches the line threshold. */
  index?: ChartSeriesView;
  tickers: TickerView[];
  caption?: string;
}

export interface FrontPageBackPage {
  /** [outlet, count] source counts in mono. */
  sources: [string, number][];
  /** "How this issue was made" — ~3 lines. */
  madeLines: string[];
  issueId: string;
  /** Agent links from the edition's `agent_links`; defaults derive from issueId. */
  links?: AgentLink[];
  copyright: string;
}

/**
 * FrontPage — the desktop renderer skeleton (§2.2): the §2.2 block order and
 * grid spans over prepared content. V2 wires the route, sticky bar and
 * keyboard nav; page-assembly logic per template lives there.
 */
export function FrontPage({
  siteName,
  tagline,
  meta,
  cover,
  briefing,
  sections,
  markets,
  mostCovered,
  backPage,
}: {
  siteName: string;
  tagline?: string;
  meta: IssueMetaView;
  cover: FrontPageCover;
  briefing: string[];
  sections: FrontPageSection[];
  markets?: FrontPageMarkets;
  mostCovered?: CoveredRowView[];
  backPage: FrontPageBackPage;
}) {
  return (
    <div className="w-frontpage">
      <Masthead
        variant="band"
        siteName={siteName}
        meta={meta}
        {...(tagline ? { tagline } : {})}
      />

      <div className="w-fp__cover" id="cover">
        <CoverImage
          aspect="4:5"
          issueNo={meta.issue}
          {...(cover.src ? { src: cover.src, alt: cover.alt ?? "" } : {})}
        />
        <div className="w-fp__cover-stack">
          <Kicker accent>{cover.kicker}</Kicker>
          <h2 className="w-fp__headline">
            {cover.url !== undefined ? (
              <a
                className="w-fp__headline-link"
                href={cover.url}
                rel="noopener noreferrer"
              >
                {cover.headline}
              </a>
            ) : (
              cover.headline
            )}
          </h2>
          <p className="w-fp__deck">
            {cover.url !== undefined ? (
              <a
                className="w-fp__deck-link"
                href={cover.url}
                rel="noopener noreferrer"
              >
                {cover.deck}
              </a>
            ) : (
              cover.deck
            )}
          </p>
        </div>
      </div>

      <div className="w-fp__briefing" id="briefing">
        <hr className="w-rule w-rule--hairline" />
        <p className="w-fp__lead">{briefing[0]}</p>
        {briefing.slice(1).map((s, i) => (
          <p key={i} className="w-fp__briefing-sentence">
            {s}
          </p>
        ))}
        <hr className="w-rule w-rule--hairline" />
      </div>

      {sections.map((section) => (
        <section key={section.id} className="w-fp__section" id={section.id}>
          <SectionHead title={section.title} />
          <div className="w-fp__items">
            {section.items.map((item, i) => (
              <Item key={`${item.headline}-${i}`} item={item} />
            ))}
          </div>
        </section>
      ))}

      {markets ? (
        <section className="w-fp__markets" id="markets">
          <SectionHead title="Markets" />
          <div className="w-fp__markets-chart">
            <MarketsChart
              data={markets.data}
              {...(markets.index ? { index: markets.index } : {})}
              {...(markets.missing ? { missing: markets.missing } : {})}
              ariaLabel="Weekly change by ticker"
            />
            {markets.caption ? (
              <p className="w-fp__markets-caption">{markets.caption}</p>
            ) : null}
          </div>
          <div className="w-fp__markets-table">
            <MonoTable
              columns={[
                { key: "ticker", label: "Ticker" },
                { key: "close", label: "Close", align: "right" },
                { key: "delta", label: "Δ week", align: "right" },
              ]}
              rows={markets.tickers.map((t) => [
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
            />
          </div>
        </section>
      ) : null}

      {mostCovered && mostCovered.length > 0 ? (
        <section className="w-fp__most-covered" id="most-covered">
          <SectionHead title="Most Covered" />
          <MonoTable
            boxed
            columns={[
              { key: "rank", label: "#" },
              { key: "name", label: "Company" },
              { key: "stories", label: "Stories", align: "right" },
              { key: "trend", label: "Trend", align: "right" },
            ]}
            rows={mostCovered.map((r) => [
              r.rank,
              <span key={r.name} className="w-fp__covered-name">
                {r.logoUrl ? (
                  <img className="w-fp__covered-logo" src={r.logoUrl} alt="" />
                ) : null}
                {r.name}
              </span>,
              r.stories,
              <TrendArrow key={r.name} trend={r.trend} />,
            ])}
          />
        </section>
      ) : null}

      <footer className="w-fp__backpage" id="back-page">
        <hr className="w-rule w-rule--section" />
        <div className="w-fp__sources-col">
          <p className="w-fp__backpage-head">Sources</p>
          <ul className="w-fp__sources">
            {backPage.sources.map(([outlet, count]) => (
              <li key={outlet}>
                <span>{outlet}</span>
                <span className="w-num">{count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="w-fp__made-col">
          <p className="w-fp__backpage-head">How this issue was made</p>
          {backPage.madeLines.map((line, i) => (
            <p key={i} className="w-fp__made-line">
              {line}
            </p>
          ))}
        </div>
        <AgentAccess
          issueId={backPage.issueId}
          {...(backPage.links ? { links: backPage.links } : {})}
        />
        <p className="w-fp__copyright">{backPage.copyright}</p>
      </footer>
    </div>
  );
}
