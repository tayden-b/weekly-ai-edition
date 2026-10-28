# ADR-0005: Typographic covers in v1 — cover-image generation deferred

**Status:** Accepted (locked 2026-10-28 via PLAN.md §8; DESIGN.md §1.5/§7.4)

## Context

`DESIGN.md` §1.5 calls for one full-bleed generated abstract cover per issue. Generating it needs an image-generation step that either costs a secret-bearing API (forbidden — `HANDOFF.md`) or a dedicated pipeline step. v1 ships zero-touch, so the cover must look complete without generated imagery.

## Decision

- v1 covers are **typographic only**: issue number, date range, and the week's headline carry the page per `DESIGN.md` §2/§3.
- The cover-image generation step exists in the DAG as item `T3` with `status: deferred` — it is never promoted to `devin:ready` and is not required for v1 completion.
- When `T3` lands post-v1: muted abstract/material imagery (no people, products, or article photographs), `editions/<week>/cover.jpg` at 2000×2500 portrait + 2400×1350 landscape, served ≤ 180KB AVIF, generation prompt + constraints sourced from `STYLE.md`, candidate approved by the human in the issue PR (`DESIGN.md` §7.4).

## Consequences

- The schema and both renderers must treat `cover` imagery as optional; the typographic fallback remains after `T3` ships.
- OG images are unaffected — they are generated per page from the template (`DESIGN.md` §1.5.5), not from cover imagery.
- Deferring is a dispatch-level decision, not an open item: `T3` sits visible in `plan/dag.yaml` until deliberately enabled.
