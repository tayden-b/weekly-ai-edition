# ADR-0003: Weekly cadence — Saturday build, Sunday 17:00 ET publish

**Status:** Accepted (locked 2026-10-28 via PLAN.md §5.2/§8)

## Context

The product promise is "caught up in 4 minutes on Sunday night" (`PRD.md` §1.2). The edition needs a fixed coverage window, enough distance between build and publish for PR checks and review to finish unattended, and a warm ingest cache so the weekly build is fast.

## Decision

- Each edition covers **Saturday → Friday**, keyed by ISO week (`editions/<week>.json`, e.g. `2026-w44`).
- **Daily 06:00 ET**: ingest only — all adapters run, raw cache `data/raw/<date>/` stays warm and feeds the agent surface later.
- **Saturday 06:00 ET**: the Weekly Edition automation runs the full build and opens the edition PR.
- **Sunday 17:00 ET**: auto-publish — the edition PR merges if it is green (required checks + Devin Review; auto-merge per branch protection).
- v1 is unattended: no human gate sits between build and publish. A human-edit step can be inserted later without changing the pipeline stages.

## Consequences

- ~35 hours between build start and publish gives CI, preview deploys, and the Reviewer automation a comfortable window.
- A week of daily ingest runs means a source outage is visible in `data/raw/` manifests before it can hurt the Saturday build.
- "Publish" is literally "the PR merges" — green CI + passing review IS the editorial gate ([ADR-0001](0001-monorepo-and-git-as-cms.md)).
- Schedule is owned by the Weekly Edition automation (dag item `I2`), not by the site — the site just renders whatever `editions/` contains.
