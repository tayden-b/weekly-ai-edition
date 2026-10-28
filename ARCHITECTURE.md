# ARCHITECTURE — The Weekly AI Edition

**Status:** locked 2026-10-28. Extracted from `PLAN.md` §5–§6 (verified by the owner the same day); reproduced faithfully — restructured for readability, no requirement changed.

**Companion documents:** `PRD.md` (product spec) · `DESIGN.md` (visual spec) · `docs/adr/` (decision records) · `plan/dag.yaml` (build order / state machine).

## 1. Overview

One monorepo, TypeScript throughout, pnpm workspaces. Three code subsystems plus the content store:

- **`apps/web`** renders editions statically for humans and agents (viewers, twins, feeds).
- **`packages/schema`** is the contract: `edition.schema.json` + generated TS types + validator.
- **`packages/pipeline`** produces editions: deterministic ingest/normalize/dedupe/rank, session-executed intelligence stages, verified emit → PR.
- **`editions/`** is the content store: one JSON per issue. **Git is the CMS; the PR that adds an edition is the editorial review** — see [ADR-0001](docs/adr/0001-monorepo-and-git-as-cms.md).
- **`packages/ui`** holds the `DESIGN.md` tokens + primitives — the only source of styles.

## 2. Repository layout

From `PLAN.md` §5:

```
apps/web            Next.js (App Router), static generation per issue, Vercel
packages/schema     edition.schema.json + generated TS types + validator (the contract)
packages/pipeline   ingest → normalize → dedupe → classify → draft → write editions/<week>.json → open PR
packages/ui         design tokens + primitives (from DESIGN.md)
editions/           one JSON per issue; git is the CMS; the PR is the editorial review
fixtures/           one hand-built reference issue used by tests, Storybook, and previews
.github/workflows   CI (typecheck, lint, schema-validate, Playwright smoke), weekly draft job, preview deploys
```

Supporting directories defined during the build (see `CONTRIBUTING.md`): `config/` (sources.yaml, companies.yaml, markets.json), `data/raw/` (adapter ingest cache), `plan/` (dag.yaml + issue briefs), `scripts/` (dispatch + gates), `docs/adr/` (decisions).

## 3. Verified sources — deterministic ingest, AI never introduces a fact

**Principle (PLAN §5.1):** every item in an edition traces to a record fetched from a publisher we trust, by code, with a URL and a timestamp. The LLM may classify, summarize, rank, and draft prose over those records. It may not add a company, number, date, or claim that is not in a source record. CI enforces this (§5 below). The intelligence stages run inside the build's Devin session, not against an external API — see [ADR-0002](docs/adr/0002-no-external-llm-apis.md).

| Template page | Primary verified sources (deterministic adapters) | Secondary |
|---|---|---|
| Models & Releases | Lab blogs via RSS/Atom or HTML sitemaps: OpenAI, Anthropic, Google DeepMind, Google AI, Meta AI, Mistral, xAI, Microsoft Research, Amazon Science, Moonshot/Kimi, DeepSeek, Alibaba Qwen, Hugging Face blog; Hugging Face Hub API for new model repos from those orgs; GitHub Releases API for flagship OSS (vLLM, llama.cpp, Ollama, LangChain, etc.) | distribute.software `/api/v1/releases` |
| Performance | Publisher data with stable endpoints/CSV: LMArena leaderboard, Artificial Analysis (public JSON), Hugging Face Open LLM Leaderboard API, SWE-bench, ARC Prize, Epoch AI datasets; arXiv API for papers from the lab orgs | — |
| Launches | HN Algolia API (front page + "Show HN", AI-filtered by taxonomy terms); Product Hunt GraphQL API (free token); newsroom RSS: TechCrunch AI, The Verge AI, Ars Technica AI, MIT Tech Review, Reuters tech, Bloomberg tech (headline+link only) | distribute.software stories |
| The Money (rounds, IPOs, offerings) | **SEC EDGAR full-text search + Form D / S-1 / 8-K feeds** (official, free); press-release wires via RSS (PR Newswire, Business Wire, GlobeNewswire — "artificial intelligence" + "funding" filters); TechCrunch funding RSS; Axios Pro Rata RSS; Crunchbase *News* RSS (not the database) | FT/Guardian/NYT RSS headlines as corroboration |
| Deals | SEC EDGAR 8-K Item 1.01/2.01 feeds; press-release wires; newsroom RSS (M&A filters) | — |
| Markets | A licensed market-data API with a free tier and redistribution-permitted *weekly close* data (candidates in priority order: Stooq CSV (no key), Alpha Vantage, Finnhub, Twelve Data); basket fixed in `config/markets.json` | — |
| Discourse | HN Algolia (comment-count-weighted), Reddit public JSON (r/MachineLearning, r/LocalLLaMA, r/artificial), newsroom opinion RSS; **two independent sources required per item** | — |
| Most Covered | Derived from our own tagged items (no external source) | — |
| Briefing / Cover | Derived from the pages above | — |

### 3.1 Rules for every adapter

- One file per adapter in `packages/pipeline/src/sources/<name>.ts`, implementing `fetch(window) → RawItem[]`. Each adapter has: `LICENSE.md` note (terms, rate limits, what we store), a recorded fixture (`__fixtures__/<name>.json`), deterministic tests, and a `health()` check.
- Store **headline, canonical URL, publisher, published_at, fetched_at, raw excerpt ≤ 300 chars, source-specific IDs**. Never full article bodies.
- Respect robots.txt and rate limits; UA string identifies the project with a contact URL.
- An adapter failure degrades the page, never the run: the page renders with fewer items and the back page says which sources were unavailable.
- Sources are configured in `config/sources.yaml` so adding one is data + an adapter, not a redesign.

## 4. Pipeline stages

`ingest` (all adapters in parallel, cached raw to `data/raw/<date>/`) → `normalize` (canonical URL, publisher, timestamps) → `dedupe` (URL + SimHash on titles; cross-source clusters keep every source link) → `classify` (LLM with the schema taxonomy, temperature 0, structured output, confidence; < 0.7 → `unsorted`) → `rank` (deterministic: source count × publisher weight × recency × HN/Reddit engagement) → `extract` (deterministic regexes + LLM structured extraction for amounts/stages/acquirers, **with the quoted span from the source excerpt required**) → `draft` (one-liners + Briefing per `STYLE.md`) → `verify` (§5) → `emit` `editions/<week>.json` → `validate` → PR.

Deterministic stages are pure code. LLM-type stages (`classify`, `extract`, `draft`, the briefing entailment check) are performed by the Devin session running the build — the stage writes a structured request file, the session fills the response following `STYLE.md` and the versioned prompts in `packages/pipeline/prompts/`, and a `replay` implementation keeps tests/CI deterministic. See [ADR-0002](docs/adr/0002-no-external-llm-apis.md).

### 4.1 Run schedule

- **Daily 06:00 ET** — ingest only (keeps the raw cache warm, feeds the agent surface later).
- **Saturday 06:00 ET** — full build → PR.
- **Sunday 17:00 ET** — auto-publish if the PR is green (v1 is unattended; a human-edit step can be inserted later without changing the pipeline).

→ [ADR-0003](docs/adr/0003-weekly-cadence-and-publish-window.md)

## 5. Provenance and verification gates (CI-enforced)

From `PLAN.md` §5.3:

- Schema requires `sources[]` on every item with `url`, `publisher`, `published_at`, `fetched_at`, `adapter`. Items with zero sources fail validation.
- Every number in Money/Deals/Performance/Markets carries `evidence: {source_index, quote}`; CI re-checks the quote exists in the stored excerpt.
- Company tags must be in `config/companies.yaml` (slug, name, aliases, domain, ticker). Unknown company → `unsorted`, never auto-added.
- Briefing sentences are checked by an LLM-judge against the page items (entailment); a sentence not supported by at least one item fails the build.
- Discourse items need ≥ 2 sources from ≥ 2 distinct publishers.
- A `provenance.json` per edition lists every adapter run, item count, failures, and the cache hashes — rendered on the back page and in the `.md` twin.

## 6. Build orchestration

The repository is also the state machine for the unattended build (`PLAN.md` §7.2–7.3, [ADR-0004](docs/adr/0004-unattended-orchestration.md)):

- `plan/dag.yaml` lists every work item with `id`, `wave`, `depends_on`, `brief`, `acceptance`; each item is a GitHub Issue whose body is the brief.
- `.github/workflows/dispatch.yml` promotes `status:blocked` → `devin:ready` when all dependencies are closed, and opens `v1-complete` when all items are closed.
- Three Devin Automations do the work: **Builder** (implements `devin:ready` issues on `devin/<id>` branches), **Reviewer** (checks PRs against acceptance criteria + `DESIGN.md` + `STYLE.md` + §5 gates), **Supervisor** (every 3h; fixes stalls, retries ≤ 3, escalates via `needs-human` only).
- Branch protection on `main`: required checks `ci` + `devin-review`, auto-merge, squash only, `Closes #N` required — merging needs no human.
- A fourth automation, **Weekly Edition**, is created by the Wave 4 item `I2` — it is product, not orchestration.

## 7. Spec artifacts

From `PLAN.md` §6: inputs that exist before hand-off are `PLAN.md` and `DESIGN.md`. Everything else — `PRD.md`, `ARCHITECTURE.md` + ADRs, `STYLE.md`, `CONTRIBUTING.md`, `edition.schema.json`, the fixture issue — is produced **by cloud agents in Wave 1** from those two documents. Nothing is authored locally after the plan is verified.

## 8. Document map

| Document | Role |
|---|---|
| `PRD.md` | Product requirements (thesis, reader, non-goals, template, surfaces) — extracted from `PLAN.md` §1–§4 |
| `ARCHITECTURE.md` | This file — system spec, extracted from `PLAN.md` §5–§6 |
| `DESIGN.md` | Locked visual spec (tokens, renderers, per-page rules, budgets) |
| `docs/adr/` | One ADR per locked decision (`PLAN.md` §7/§8, `DESIGN.md` §7) |
| `plan/dag.yaml` | Build DAG: items, waves, dependencies, acceptance criteria — the orchestration state machine |
| `plan/issues/<id>.md` | Per-item briefs mirrored into GitHub issues |
| `HANDOFF.md` | Read-first operating rules for agent sessions |
| `CONTRIBUTING.md` | Commands, layout, PR rules for Builder sessions |
| `STYLE.md` | Voice + drafting rubric (lands with C3) |
| `packages/schema/edition.schema.json` | The edition contract (lands with C2) |
