import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AgentAccess,
  CoverImage,
  ItemList,
  Kicker,
  LineChart,
  Masthead,
  MonoTable,
  TrendDelta,
} from "@weekly/ui";
import type { ItemView } from "@weekly/ui";

import { feedLinkTypes } from "../../../lib/feeds";
import type { FixtureEdition, FixturePage } from "../../../lib/fixture";
import {
  allPageParams,
  getEdition,
  ogFields,
  pageHref,
  pageKicker,
  pageTitle,
  parsePageParam,
} from "../../../lib/pages";
import { site } from "../../../lib/site";

import "./page.css";

export function generateStaticParams() {
  return allPageParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issue: string; page: string }>;
}): Promise<Metadata> {
  const { issue, page } = await params;
  const ed = getEdition(issue);
  const n = parsePageParam(page);
  const p = ed && n != null ? ed.pages[n - 1] : undefined;
  if (!ed || !p) return {};
  const title = `${pageKicker(p)} · № ${ed.issue} — ${site.name}`;
  const description = ogFields(p).headline;
  return {
    title,
    description,
    alternates: {
      canonical: pageHref(ed.id, n as number),
      types: feedLinkTypes,
    },
    openGraph: { title, description, type: "article", siteName: site.name },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** One template page rendered standalone — same content as its deck card
 * (DESIGN §2.1) on the paper ground, plus prev/next + issue-root links (V3). */
export default async function Page({
  params,
}: {
  params: Promise<{ issue: string; page: string }>;
}) {
  const { issue, page } = await params;
  const ed = getEdition(issue);
  const n = parsePageParam(page);
  if (!ed || n == null) notFound();
  const p = ed.pages[n - 1];
  if (!p) notFound();
  const prev = n > 1 ? ed.pages[n - 2] : undefined;
  const next = n < ed.pages.length ? ed.pages[n] : undefined;
  const meta = { issue: ed.issue, dateRange: ed.date_range.label };
  const sources = p.sourceCount ?? 0;
  return (
    <main className="w-sp">
      <div className="w-deck-card__masthead">
        <Masthead variant="compact" siteName={site.name} meta={meta} />
      </div>
      <Kicker accent={p.type === "cover"}>{pageKicker(p)}</Kicker>
      <h1 className="w-deck-card__title">{pageTitle(p)}</h1>
      <div className="w-sp__body">
        <PageBody edition={ed} page={p} />
      </div>
      <footer className="w-deck-card__footer">
        <span>{sources > 0 ? `${sources} sources` : null}</span>
        <span>
          Page {n}/{ed.pages.length}
        </span>
      </footer>
      <nav className="w-sp__nav" aria-label="Pages">
        <span className="w-sp__nav-side">
          {prev ? (
            <a className="w-mono-link" href={pageHref(ed.id, n - 1)}>
              ← {pageKicker(prev)}
            </a>
          ) : null}
        </span>
        <a className="w-mono-link" href={`/${ed.id}`}>
          Full issue
        </a>
        <span className="w-sp__nav-side w-sp__nav-side--right">
          {next ? (
            <a className="w-mono-link" href={pageHref(ed.id, n + 1)}>
              {pageKicker(next)} →
            </a>
          ) : null}
        </span>
      </nav>
    </main>
  );
}

function PageBody({
  edition: ed,
  page,
}: {
  edition: FixtureEdition;
  page: FixturePage;
}) {
  switch (page.type) {
    case "cover":
      return (
        <>
          <div className="w-sp__cover">
            <CoverImage aspect="4:5" issueNo={ed.issue} />
          </div>
          {page.deck ? <p className="w-sp__deck">{page.deck}</p> : null}
        </>
      );
    case "briefing": {
      const sentences = page.sentences ?? [];
      return (
        <div className="w-sp__briefing">
          <p className="w-fp__lead">{sentences[0]}</p>
          {sentences.slice(1).map((s, i) => (
            <p key={i} className="w-fp__briefing-sentence">
              {s}
            </p>
          ))}
        </div>
      );
    }
    case "markets":
      return (
        <>
          <LineChart
            series={page.chart?.series ?? []}
            ariaLabel={page.chart?.series[0]?.label ?? "Markets chart"}
          />
          <p className="w-sp__caption">
            {page.sourcePublishers?.length
              ? `Source: ${page.sourcePublishers.join(", ")} — weekly close`
              : "Weekly close"}
          </p>
          <MonoTable
            columns={[
              { key: "ticker", label: "Ticker" },
              { key: "close", label: "Close", align: "right" },
              { key: "delta", label: "Δ week", align: "right" },
            ]}
            rows={(page.tickers ?? []).map((t) => [
              t.ticker,
              t.close,
              <TrendDelta key={t.ticker} delta={t.delta} />,
            ])}
          />
        </>
      );
    case "most_covered":
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
    case "back_page":
      return (
        <>
          <p className="w-sp__colhead">Sources</p>
          <ul className="w-sp__sources">
            {(page.sources ?? []).map(([outlet, count]) => (
              <li key={outlet}>
                <span>{outlet}</span>
                <span className="w-num">{count}</span>
              </li>
            ))}
          </ul>
          <p className="w-sp__colhead">How this issue was made</p>
          {(page.made ?? []).map((line, i) => (
            <p key={i} className="w-sp__made">
              {line}
            </p>
          ))}
          <AgentAccess issueId={ed.id} />
          <p className="w-sp__copyright">
            © 2026 {site.name}. Content CC BY-NC; sources attributed.
          </p>
        </>
      );
    default:
      return page.items?.length ? (
        <ItemList items={page.items as ItemView[]} headlineAs="h2" />
      ) : null;
  }
}
