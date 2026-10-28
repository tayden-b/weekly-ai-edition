# ADR-0010: Type stack — Inter Tight / Inter / Geist Mono, self-hosted

**Status:** Accepted (locked 2026-10-28 via DESIGN.md §1.2/§7.3)

## Context

"Broadsheet, redrawn" (`DESIGN.md` §0) needs a tight grotesk for headlines, a neutral text face, and a mono for data. Fonts must not be a runtime dependency on a third-party CDN (privacy, reliability, Lighthouse budget).

## Decision

| Role | Face | Fallback |
|---|---|---|
| Display / headlines | **Inter Tight** (Google), weight 600, tracking −0.02em to −0.04em as size grows | Geist, Helvetica Neue |
| Text / UI | **Inter**, weight 400/500 | system-ui |
| Data / mono | **Geist Mono** | JetBrains Mono |

- Fonts are **self-hosted, subset, `font-display: swap`** — no external font CDN at runtime.
- The display face sits behind a single token (`--font-display`) so it can be swapped from previews later.

## Consequences

- `packages/ui` is the only place font families are declared; components consume tokens, never font names.
- Subsetting + self-hosting is part of the Lighthouse ≥ 95 performance budget (`DESIGN.md` §5, enforced by `I5`).
