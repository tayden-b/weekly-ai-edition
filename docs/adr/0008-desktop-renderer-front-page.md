# ADR-0008: Desktop renderer is the front page — spreads and desktop-deck rejected

**Status:** Accepted (locked 2026-10-28 via DESIGN.md §7.1)

## Context

The edition JSON renders two ways (`DESIGN.md` §2). Mobile was always the deck (full-viewport swipe cards). Desktop had three candidates: two-page spreads, a scaled-up deck, or a single newspaper-structured front page. `PLAN.md` §4 still says "two-page spreads" — this ADR is the superseding lock.

## Decision

Desktop (≥ 768px) renders **one long front page** per issue (`DESIGN.md` §2.2): masthead band, cover block, Briefing, section bands, Markets chart + mono table, boxed Most Covered table, back-page footer — scroll-driven, 12-column grid, sticky thin top bar, `j/k`/arrow section jumping, `?` shortcuts sheet. Spreads and a desktop deck are rejected. Mobile (< 768px) stays the deck (`DESIGN.md` §2.1).

## Consequences

- `PRD.md` §4 records this as the locked reading of `PLAN.md` §4's "two-page spreads"; `PLAN.md` itself is left untouched.
- Density target: whole issue readable in ~4 minutes of scrolling; no sidebars, no "related", no infinite feed.
- Client JS on the front page is limited to the sticky bar, keyboard nav, and chart hydration (`DESIGN.md` §5).
- Per-page routes (`/{issue}/n`) still exist on both renderers for shareability.
