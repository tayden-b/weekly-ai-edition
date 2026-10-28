"use client";

import type { MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Edition, EditionPage } from "@weekly/schema";
import {
  AgentAccess,
  CoverImage,
  Deck,
  DeckCard,
  ItemList,
  LineChart,
  MonoTable,
  ProgressSegments,
  TrendDelta,
} from "@weekly/ui";

import {
  agentLinks,
  buildDeck,
  editionMeta,
  mapItem,
  shortDate,
  type DeckCardModel,
  type SectionItem,
} from "../../lib/deck";

/* DESIGN §1.4 — page transitions: 240ms cubic-bezier(0.2,0,0,1), translate only. */
const PAGE_MS = 240;
const BEZIER = { x1: 0.2, y1: 0, x2: 0, y2: 1 } as const;

/** cubic-bezier(0.2,0,0,1) solved for rAF scrolling (Newton + bisection). */
function easePage(x: number): number {
  const { x1, y1, x2, y2 } = BEZIER;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const xs = (t: number) => ((ax * t + bx) * t + cx) * t;
  const ys = (t: number) => ((ay * t + by) * t + cy) * t;
  const dxs = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = xs(t) - x;
    if (Math.abs(err) < 1e-6) return ys(t);
    const d = dxs(t);
    if (Math.abs(d) < 1e-6) break;
    t -= err / d;
  }
  let lo = 0;
  let hi = 1;
  t = x;
  while (hi - lo > 1e-6) {
    if (xs(t) < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return ys(t);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DeckView({
  edition,
  siteName,
}: {
  edition: Edition;
  siteName: string;
}) {
  const cards = buildDeck(edition);
  const links = agentLinks(edition);
  const meta = { ...editionMeta(edition), siteName };
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const keyboardNav = useRef(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const deckEl = useCallback(
    () =>
      wrapRef.current?.querySelector<HTMLElement>(".w-deck") ?? null,
    [],
  );

  /** Programmatic nav: 240ms eased translate; instant under reduced-motion. */
  const scrollToIndex = useCallback(
    (target: number, viaKeyboard = false) => {
      const el = deckEl();
      if (!el) return;
      const clamped = Math.max(0, Math.min(cards.length - 1, target));
      keyboardNav.current = viaKeyboard;
      const settle = () => {
        // After keyboard nav, focus the card so screen readers name it.
        if (keyboardNav.current) {
          const regions =
            el.querySelectorAll<HTMLElement>(".w-deck-card");
          regions[clamped]?.focus({ preventScroll: true });
        }
      };
      const to = clamped * el.clientWidth;
      if (prefersReducedMotion() || el.scrollLeft === to) {
        cancelAnimationFrame(rafRef.current);
        el.style.scrollSnapType = "";
        el.scrollLeft = to;
        settle();
        return;
      }
      // Snap is disabled while the animation drives scrollLeft, then restored.
      el.style.scrollSnapType = "none";
      const from = el.scrollLeft;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / PAGE_MS);
        el.scrollLeft = from + (to - from) * easePage(t);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          el.style.scrollSnapType = "";
          settle();
        }
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(step);
    },
    [cards.length, deckEl],
  );

  /* Track the current card from native swipes (scroll-snap) and resizes;
   * document-level keys make the deck operable with or without focus. */
  useEffect(() => {
    const el = deckEl();
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        setIndex(Math.max(0, Math.min(cards.length - 1, i)));
      });
    };
    const onResize = () => {
      el.style.scrollSnapType = "none";
      el.scrollLeft = indexRef.current * el.clientWidth;
      el.style.scrollSnapType = "";
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      let next: number | null = null;
      if (e.key === "ArrowRight") next = indexRef.current + 1;
      else if (e.key === "ArrowLeft") next = indexRef.current - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = cards.length - 1;
      if (next === null) return;
      e.preventDefault();
      scrollToIndex(next, true);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
    };
  }, [cards.length, deckEl, scrollToIndex]);

  /* Cancel an in-flight nav animation on unmount only — NOT on index
   * changes (the scroll listener updates index mid-animation). */
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /* Stories-style tap zones: left third → back, rest → forward. Links and
   * other interactive elements keep their own clicks. */
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest(
        "a, button, input, select, textarea, [role='button']",
      )
    ) {
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const frac = (e.clientX - el.getBoundingClientRect().left) / el.clientWidth;
    scrollToIndex(frac < 1 / 3 ? index - 1 : index + 1);
  };

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
            {page.deck ? <p className="dv-dek">{page.deck}</p> : null}
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
        const publishers = [
          ...new Set(page.sources.map((s) => s.publisher)),
        ].join(" · ");
        return (
          <div className="dv-markets">
            <LineChart
              series={[
                {
                  label: page.chart.title,
                  points: page.chart.series.map((p) => p.value),
                  xLabels: page.chart.series.map((p) => shortDate(p.date)),
                },
              ]}
              ariaLabel={`${page.chart.title} (${page.chart.unit})`}
            />
            <MonoTable
              columns={[
                { key: "t", label: "Ticker" },
                { key: "c", label: "Close", align: "right" },
                { key: "d", label: "Δ week", align: "right" },
              ]}
              rows={page.tickers.map((t) => [
                t.ticker,
                t.close.toFixed(2),
                <TrendDelta key={t.ticker} delta={t.change_pct} />,
              ])}
              caption={`Data: ${publishers}`}
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
              <TrendDelta
                key={e.company}
                delta={e.trend === "up" ? 1 : e.trend === "down" ? -1 : 0}
              />,
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
    <div className="dv-root">
      {/* The compact masthead is not a heading — the deck still needs one h1. */}
      <h1 className="dv-sr-only">
        {siteName} — № {meta.issue} ({meta.dateRange})
      </h1>
      <div className="dv-progress">
        <ProgressSegments
          total={cards.length}
          current={index + 1}
          label="Issue progress"
        />
      </div>
      <div
        ref={wrapRef}
        className="dv-scroller"
        role="group"
        aria-roledescription="carousel"
        aria-label={`${siteName} № ${meta.issue} — ${cards.length} pages; arrow keys or tap edges to turn`}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        tabIndex={0}
        onClick={onClick}
      >
        <Deck>
          {cards.map((card, i) => (
            <DeckCard
              key={card.type}
              meta={meta}
              kicker={card.kicker}
              kickerAccent={card.kickerAccent}
              title={card.title}
              active={i === index}
              footer={
                <>
                  <span>{card.sourceCount} sources</span>
                  <span>
                    {card.index + 1}/{cards.length}
                  </span>
                </>
              }
            >
              {body(card)}
            </DeckCard>
          ))}
        </Deck>
      </div>
    </div>
  );
}
