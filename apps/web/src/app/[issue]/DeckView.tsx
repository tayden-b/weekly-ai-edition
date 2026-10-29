"use client";

import type { MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProgressSegments } from "@weekly/ui";

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
  const ys = (t: number) => ((ay * t + by) * t + 0) * t;
  const xs = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dxs = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const err = xs(t) - x;
    if (Math.abs(err) < 1e-6) return ys(t);
    t -= err / (dxs(t) || 1e-6);
  }
  for (let i = 0; i < 20; i++) {
    const v = xs((lo + hi) / 2);
    if (Math.abs(v - x) < 1e-6) break;
    if (v < x) lo = (lo + hi) / 2;
    else hi = (lo + hi) / 2;
    t = (lo + hi) / 2;
  }
  return ys(t);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The client island for the §2.1 deck: progress bar, eased programmatic
 * nav, arrow keys and tap zones. The cards themselves arrive as server
 * components via `children` — React never hydrates them, which keeps the
 * first paint (and the cover's LCP) ahead of the deck's interactivity.
 * Per-card `active` semantics (aria-hidden + inert so only the current
 * card is perceivable) are applied imperatively on the DOM — identical
 * attributes to what DeckCard renders, toggled on scroll/resize.
 */
export function DeckView({
  total,
  headline,
  scrollerLabel,
  children,
}: {
  /** Number of cards inside `children` — progress + nav bounds. */
  total: number;
  /** Visually-hidden h1 text (siteName — № issue (date range)). */
  headline: string;
  /** aria-label for the scroll-snap region. */
  scrollerLabel: string;
  /** The <Deck> of <DeckCard>s, rendered server-side. */
  children: ReactNode;
}) {
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

  const cardEls = useCallback(
    () =>
      Array.from(
        deckEl()?.querySelectorAll<HTMLElement>(".w-deck-card") ?? [],
      ),
    [deckEl],
  );

  /* Keep only the current card perceivable (aria-hidden + inert on the
   * rest) — the same contract DeckCard's `active` prop renders in SSR. */
  useEffect(() => {
    cardEls().forEach((el, i) => {
      el.inert = i !== index;
      el.setAttribute("aria-hidden", i === index ? "false" : "true");
    });
  }, [index, cardEls]);

  /** Programmatic nav: 240ms eased translate; instant under reduced-motion. */
  const scrollToIndex = useCallback(
    (target: number, viaKeyboard = false) => {
      const el = deckEl();
      if (!el) return;
      const clamped = Math.max(0, Math.min(total - 1, target));
      keyboardNav.current = viaKeyboard;
      const settle = () => {
        // After keyboard nav, focus the card so screen readers name it.
        if (keyboardNav.current) {
          cardEls()[clamped]?.focus({ preventScroll: true });
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
    [total, deckEl, cardEls],
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
        setIndex(Math.max(0, Math.min(total - 1, i)));
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
      else if (e.key === "End") next = total - 1;
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
  }, [total, deckEl, scrollToIndex]);

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

  return (
    <div className="dv-root">
      {/* The compact masthead is not a heading — the deck still needs one h1. */}
      <h1 className="dv-sr-only">{headline}</h1>
      <div className="dv-progress">
        <ProgressSegments
          total={total}
          current={index + 1}
          label="Issue progress"
        />
      </div>
      <div
        ref={wrapRef}
        className="dv-scroller"
        role="group"
        aria-roledescription="carousel"
        aria-label={scrollerLabel}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        tabIndex={0}
        onClick={onClick}
      >
        {children}
      </div>
    </div>
  );
}
