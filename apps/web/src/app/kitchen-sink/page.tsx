import type { Metadata } from "next";

import {
  AgentAccess,
  colors,
  CoverImage,
  Deck,
  DeckCard,
  FrontPage,
  Item,
  ItemList,
  IssueMeta,
  Kicker,
  LineChart,
  Masthead,
  MonoTable,
  OgCard,
  Pill,
  ProgressSegments,
  Rule,
  SectionHead,
  space,
  TrendDelta,
  typeScale,
  motion,
  type ItemView,
} from "@weekly/ui";

import { site } from "../../lib/site";
import {
  edition,
  itemsOf,
  pageOfType,
  SECTION_TITLES,
  SECTION_TYPES,
} from "../../lib/fixture";

import "./ks.css";

export const metadata: Metadata = {
  title: "Kitchen sink — The Weekly AI Edition",
  description:
    "Every @weekly/ui primitive rendered over the C2 fixture edition, in light and dark.",
};

const meta = { issue: edition.issue, dateRange: edition.date_range.label };

/** tokens.ts key → CSS custom property name. */
const CSS_VAR: Record<string, string> = {
  paper: "--paper",
  paper2: "--paper-2",
  ink: "--ink",
  ink2: "--ink-2",
  ink3: "--ink-3",
  rule: "--rule",
  accent: "--accent",
  up: "--up",
  down: "--down",
};

function SwatchGrid({ scheme }: { scheme: "light" | "dark" }) {
  const entries = Object.entries(colors[scheme]);
  return (
    <div className="w-swatch-grid">
      {entries.map(([name, hex]) => (
        <div key={name} className="w-swatch">
          <div className="w-swatch__chip" style={{ background: hex }} />
          <p className="w-swatch__name">
            {CSS_VAR[name]} {hex}
          </p>
        </div>
      ))}
    </div>
  );
}

function SwatchCSS({ scheme }: { scheme: "light" | "dark" }) {
  // Same swatches, but resolved through the CSS custom properties —
  // light side reads the light vars, dark side sits inside .w-dark.
  const names = Object.keys(colors[scheme]);
  return (
    <div className="w-swatch-grid">
      {names.map((name) => {
        const cssName = CSS_VAR[name] ?? `--${name}`;
        return (
          <div key={name} className="w-swatch">
            <div
              className="w-swatch__chip"
              style={{ background: `var(${cssName})` }}
            />
            <p className="w-swatch__name">{cssName}</p>
          </div>
        );
      })}
    </div>
  );
}

export default async function KitchenSink({
  searchParams,
}: {
  searchParams: Promise<{ scheme?: string }>;
}) {
  const { scheme } = await searchParams;
  const forced = scheme === "dark" ? "w-dark" : scheme === "light" ? "w-light" : "";

  const cover = pageOfType("cover");
  const briefing = pageOfType("briefing");
  const markets = pageOfType("markets");
  const mostCovered = pageOfType("most_covered");
  const backPage = pageOfType("back_page");

  const sections = SECTION_TYPES.map((type) => ({
    id: type,
    title: SECTION_TITLES[type] ?? type,
    items: itemsOf(type) as ItemView[],
  }));

  const demoItem = itemsOf("models")[0] as ItemView;

  return (
    <div className={`ks-page ${forced}`}>
      <div className="ks-wrap">
        <header>
          <Masthead
            variant="band"
            siteName={site.name}
            tagline={site.tagline}
            meta={meta}
          />
          <p className="ks-label" style={{ marginTop: "var(--space-16)" }}>
            kitchen-sink — every primitive over fixtures/2026-w44 ·{" "}
            <a href="?scheme=light">light</a> / <a href="?scheme=dark">dark</a>
          </p>
        </header>

        {/* ---------- tokens ---------- */}
        <section className="ks-block">
          <SectionHead title="Tokens" />
          <p className="ks-label">colour — light · dark (.w-dark scope)</p>
          <div className="ks-dark-grid">
            <div>
              <SwatchGrid scheme="light" />
              <p className="ks-label" style={{ marginTop: "var(--space-8)" }}>
                via CSS vars:
              </p>
              <SwatchCSS scheme="light" />
            </div>
            <div className="w-dark">
              <SwatchGrid scheme="dark" />
              <p className="ks-label" style={{ marginTop: "var(--space-8)" }}>
                via CSS vars:
              </p>
              <SwatchCSS scheme="dark" />
            </div>
          </div>

          <p className="ks-label">type scale — --t-xs … --t-3xl</p>
          <div className="ks-type-spec">
            {(Object.keys(typeScale) as (keyof typeof typeScale)[]).map((t) => (
              <div key={t} className="ks-type-row">
                <code>--{t}</code>
                <span
                  style={{
                    fontSize: `var(--${t})`,
                    fontFamily: "var(--font-display)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                  }}
                >
                  The weekly AI edition
                </span>
              </div>
            ))}
          </div>

          <p className="ks-label">font roles</p>
          <div className="ks-type-spec">
            <div className="ks-type-row">
              <code>display</code>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--t-xl)" }}>
                Inter Tight — headlines
              </span>
            </div>
            <div className="ks-type-row">
              <code>text</code>
              <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--t-base)" }}>
                Inter — body, and an <em>italic take</em>.
              </span>
            </div>
            <div className="ks-type-row">
              <code>mono</code>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--t-base)" }}>
                Geist Mono — 0123456789 · tickers · dates
              </span>
            </div>
          </div>

          <p className="ks-label">space — 4·8·12·16·24·32·48·64·96·128</p>
          {space.map((s) => (
            <div key={s} className="ks-space-row">
              <code style={{ width: "7ch" }}>{s}</code>
              <div className="ks-space-bar" style={{ width: `var(--space-${s})` }} />
            </div>
          ))}

          <p className="ks-label">motion — durations / easing</p>
          <div className="ks-type-spec">
            <div className="ks-type-row">
              <code>--dur-page</code>
              <span>
                {motion.pageMs}ms · {motion.pageEase} (translate only)
              </span>
            </div>
            <div className="ks-type-row">
              <code>--dur-fill</code>
              <span>{motion.fillMs}ms linear (progress segments)</span>
            </div>
            <div className="ks-type-row">
              <code>--dur-hover</code>
              <span>{motion.hoverMs}ms (link underline-in)</span>
            </div>
          </div>
        </section>

        {/* ---------- primitives ---------- */}
        <section className="ks-block">
          <SectionHead title="Primitives" />

          <p className="ks-label">Masthead — compact (deck row)</p>
          <Masthead variant="compact" siteName={site.name} meta={meta} />

          <p className="ks-label">IssueMeta</p>
          <IssueMeta meta={meta} />

          <p className="ks-label">Kicker — ink-2 · accent (the one red)</p>
          <div className="ks-row">
            <Kicker>Section</Kicker>
            <Kicker accent>№ 44</Kicker>
          </div>

          <p className="ks-label">SectionHead</p>
          <SectionHead title="Section head" />

          <p className="ks-label">Rule — hairline · section</p>
          <Rule weight="hairline" />
          <Rule weight="section" />

          <p className="ks-label">Pill</p>
          <div className="ks-row">
            <Pill>Models</Pill>
            <Pill>Funding</Pill>
          </div>

          <p className="ks-label">Item — headline / one-liner + take / source</p>
          <Item item={demoItem} />

          <p className="ks-label">ItemList — hairline-separated stack</p>
          <ItemList items={itemsOf("launches").slice(0, 3) as ItemView[]} />

          <p className="ks-label">MonoTable — plain · boxed (Most Covered)</p>
          <MonoTable
            columns={[
              { key: "t", label: "Ticker" },
              { key: "c", label: "Close", align: "right" },
              { key: "d", label: "Δ week", align: "right" },
            ]}
            rows={(markets?.tickers ?? []).slice(0, 4).map((t) => [
              t.ticker,
              t.close.toFixed(2),
              <TrendDelta key={t.ticker} delta={t.delta} />,
            ])}
          />
          <MonoTable
            boxed
            columns={[
              { key: "r", label: "#" },
              { key: "n", label: "Company" },
              { key: "s", label: "Stories", align: "right" },
            ]}
            rows={(mostCovered?.rows ?? []).map((r) => [r.rank, r.name, r.stories])}
          />

          <p className="ks-label">TrendDelta — up / down / flat</p>
          <div className="ks-row">
            <TrendDelta delta={3.4} />
            <TrendDelta delta={-1.4} />
            <TrendDelta delta={0} />
          </div>

          <p className="ks-label">ProgressSegments — 11 segments, at page 4</p>
          <ProgressSegments total={11} current={4} />

          <p className="ks-label">CoverImage — typographic (v1) + framed image states</p>
          <div className="ks-row" style={{ alignItems: "stretch" }}>
            <div style={{ width: 240 }}>
              <CoverImage issueNo={edition.issue} />
            </div>
            <div style={{ width: 384 }}>
              <CoverImage aspect="16:9" issueNo={edition.issue} />
            </div>
          </div>

          <p className="ks-label">LineChart — AI basket weekly close</p>
          <LineChart series={markets?.chart?.series ?? []} />

          <p className="ks-label">AgentAccess</p>
          <AgentAccess issueId={edition.id} />

          <p className="ks-label">OgCard — 1200×630 (scaled 0.5)</p>
          <div className="ks-og-frame">
            <OgCard
              siteName={site.name}
              kicker="№ 44 · Oct 24–30"
              headline={cover?.headline ?? ""}
            />
          </div>
        </section>

        {/* ---------- deck ---------- */}
        <section className="ks-block">
          <SectionHead title="Deck (mobile renderer shell)" />
          <p className="ks-label">3 DeckCards in a 390px frame</p>
          <div className="ks-phone">
            <Deck>
              <DeckCard
                meta={{ ...meta, siteName: site.name }}
                kicker="Cover"
                kickerAccent
                title={cover?.headline ?? ""}
                footer={<span>1 source</span>}
              >
                <CoverImage issueNo={edition.issue} aspect="4:5" />
                <p
                  style={{
                    marginTop: "var(--space-16)",
                    fontSize: "var(--t-base)",
                    color: "var(--ink-2)",
                  }}
                >
                  {cover?.deck}
                </p>
              </DeckCard>
              <DeckCard
                meta={{ ...meta, siteName: site.name }}
                kicker="Briefing"
                title="The Briefing"
                footer={<span>6 sentences</span>}
              >
                {(briefing?.sentences ?? []).map((s, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: "var(--t-base)",
                      lineHeight: "var(--leading-text)",
                      marginBottom: "var(--space-16)",
                    }}
                  >
                    {s}
                  </p>
                ))}
              </DeckCard>
              <DeckCard
                meta={{ ...meta, siteName: site.name }}
                kicker="Models & Releases"
                title="Models & Releases"
                footer={<span>{itemsOf("models").length} items</span>}
              >
                <ItemList items={itemsOf("models") as ItemView[]} />
              </DeckCard>
            </Deck>
          </div>
        </section>

        {/* ---------- front page ---------- */}
        <section className="ks-block">
          <SectionHead title="FrontPage (desktop renderer)" />
        </section>
      </div>

      <FrontPage
        siteName={site.name}
        tagline={site.tagline}
        meta={meta}
        cover={{
          kicker: cover?.kicker ?? "№ 44",
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
  );
}
