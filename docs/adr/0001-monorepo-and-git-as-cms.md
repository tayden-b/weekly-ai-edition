# ADR-0001: pnpm monorepo; git is the CMS

**Status:** Accepted (locked 2026-10-28 via PLAN.md §5/§7)

## Context

The product is a weekly edition (JSON) rendered by a site, produced by a pipeline, gated by a schema, built entirely by unattended Devin sessions. We need one place where code, content, and orchestration state live, with review built in.

## Decision

- One pnpm-workspace monorepo, TypeScript strict, Node 22.
- Packages: `apps/web` (Next.js), `packages/schema` (the contract), `packages/ui` (design tokens/primitives), `packages/pipeline` (adapters + stages). `editions/`, `fixtures/`, `config/`, `data/raw/` are data directories in the same repo.
- **Git is the CMS**: an edition is `editions/<week>.json` in git; the PR that adds it is the editorial review. `plan/dag.yaml` + GitHub issues/labels are the orchestration state machine; `dispatch.yml` promotes `status:blocked` → `devin:ready`.
- Branch protection on `main`: PRs required, checks `ci` + Devin Review, auto-merge, squash only — merging needs no human.

## Consequences

- No database, no CMS service, no deploy pipeline outside Vercel↔GitHub — zero secrets.
- Every state transition (issue labelled, PR merged, edition emitted) is a git/GitHub event the dispatch workflow can observe.
- Repo size grows with `data/raw/` cache — accepted; revisit if clone time hurts.
