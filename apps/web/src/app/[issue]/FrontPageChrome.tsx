"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { IssueMeta, type IssueMetaView } from "@weekly/ui";

import type { NavSection } from "../../lib/frontpage";

const SHORTCUTS: [string, string][] = [
  ["j / ↓", "Next section"],
  ["k / ↑", "Previous section"],
  ["?", "Show or hide this sheet"],
  ["esc", "Close this sheet"],
];

/**
 * FrontPageChrome — the only client JS on the front page (DESIGN §5 allows
 * the sticky bar, keyboard nav, and chart hydration; the chart needs none).
 * A thin bar (masthead · issue · section links) slides in once the masthead
 * band leaves the viewport; `j`/`k`/arrows jump between page sections; `?`
 * opens the shortcuts sheet.
 */
export function FrontPageChrome({
  siteName,
  meta,
  sections,
}: {
  siteName: string;
  meta: IssueMetaView;
  sections: NavSection[];
}) {
  const [barVisible, setBarVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);

  // Reveal the bar only after the masthead band scrolls out of view.
  useEffect(() => {
    const masthead = document.querySelector(".w-masthead--band");
    if (!masthead || typeof IntersectionObserver === "undefined") {
      setBarVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setBarVisible(!(entry?.isIntersecting ?? true)),
      { threshold: 0 },
    );
    io.observe(masthead);
    return () => io.disconnect();
  }, []);

  const jump = useCallback(
    (dir: 1 | -1) => {
      const targets = sections
        .map((s) => document.getElementById(s.id))
        .filter((el): el is HTMLElement => el !== null);
      if (targets.length === 0) return;
      const line = 64; // ~sticky-bar height: current = last section above it
      let current = -1;
      targets.forEach((el, i) => {
        if (el.getBoundingClientRect().top <= line) current = i;
      });
      const next = Math.min(Math.max(current + dir, 0), targets.length - 1);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      targets[next]?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    },
    [sections],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Hidden half of the split (deck.css display:none → clientWidth 0):
      // leave the keys — and their defaults — to the visible layer.
      if (topbarRef.current?.clientWidth === 0) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      if (e.key === "Escape") {
        setSheetOpen(false);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setSheetOpen((open) => !open);
        return;
      }
      if (sheetOpen) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        jump(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        jump(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump, sheetOpen]);

  useEffect(() => {
    if (sheetOpen) sheetRef.current?.focus();
  }, [sheetOpen]);

  return (
    <>
      <div
        ref={topbarRef}
        className="w-topbar"
        data-show={barVisible || undefined}
        inert={!barVisible}
        aria-hidden={!barVisible}
      >
        <a className="w-topbar__wordmark" href="#cover">
          {siteName}
        </a>
        <IssueMeta meta={meta} />
        <nav className="w-topbar__nav" aria-label="Sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </nav>
      </div>

      {sheetOpen ? (
        <div
          className="w-keysheet"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          tabIndex={-1}
          ref={sheetRef}
        >
          <div className="w-keysheet__panel">
            <p className="w-keysheet__title">Keyboard shortcuts</p>
            <hr className="w-rule w-rule--section" />
            <dl className="w-keysheet__list">
              {SHORTCUTS.map(([key, desc]) => (
                <div className="w-keysheet__row" key={key}>
                  <dt>
                    <kbd className="w-keysheet__key">{key}</kbd>
                  </dt>
                  <dd>{desc}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              className="w-mono-link w-keysheet__close"
              onClick={() => setSheetOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
