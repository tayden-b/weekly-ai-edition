---
# Weekly AI Edition — Build Plan

## 1. Thesis

**The only AI news product you finish.** One link a week. 10–14 full-screen pages covering everything that mattered in AI that week — model releases, benchmarks, product launches, funding, acquisitions, markets, and the discourse — synthesized into a briefing, designed like a magazine, swiped like Stories. Every edition has a machine-readable twin so a reader can hand the whole week to their agent in one URL.

Positioning vs. distribute.software (the reference): they are the daily firehose on a calendar — complete, continuous, taste-neutral, general tech. We are weekly, finite, AI-only, synthesized, and designed. We sit downstream of aggregators; we do not compete on completeness or recency.

Reader: people who work in or around AI and are tired of 6 newsletters + X. They want to be caught up in 4 minutes on Sunday night.

## 2. Non-goals (v1)

- No comments, votes, accounts, or personalization.
- No personal column / cover essay (dropped 2026-10-28). Voice lives in one-line takes and the briefing, drafted by the pipeline, approved by Tayden.
- No email until IBM outside-activity policy is confirmed. Feeds (RSS/JSON) are the subscription mechanism at launch.
- No Twitter/X ingest. No paid databases (Crunchbase, PitchBook). No republishing article bodies — headline, source link, our own 1–2 sentence summary only.
- Nothing from HashiCorp, IBM, customers, or interviews.

## 3. The fixed template

Weekly production is fill-in, never redesign. Every issue has exactly these pages, in this order. A page with nothing to say is auto-dropped, never padded.

| # | Page | Content | Source |
|---|---|---|---|
| 1 | Cover | Issue number, date range, the week's single headline + hero visual | Pipeline picks; human confirms |
| 2 | The Briefing | 5–7 sentences: what actually happened this week and why it matters. The page people screenshot. | LLM draft over all classified items; human edits |
| 3 | Models & Releases | New models, major version bumps, API changes | Lab blogs/RSS, distribute.software `/releases` |
| 4 | Performance | Benchmark moves, leaderboard changes, notable evals | LMArena, Artificial Analysis, HF, papers-with-results (ToS check per source) |
| 5 | Launches | Products and features shipped | HN, Product Hunt RSS, newsroom RSS |
| 6 | Funding | Rounds this week: company, amount, stage, lead | Press releases, TechCrunch/Axios funding RSS, SEC filings where relevant |
| 7 | Deals | Acquisitions, acqui-hires, major partnerships | Same + newsrooms |
| 8 | Markets | Weekly move of an AI basket (NVDA, MSFT, GOOGL, META, AMZN, AMD, TSM, + 2–3 pure plays) with one chart | Free market data API (licence check) |
| 9 | Discourse | The drama / debate of the week, framed neutrally with both sides linked | HN, Reddit RSS, newsrooms |
| 10 | Most Covered | Company mention counts for the week | Derived from our own tagged items |
| 11 | Back Page | Sources count, how this issue was made, agent access (links to `.md`, `.json`, `llms.txt`, feed), colophon | Auto |

Each item in pages 3–9 = headline · source · our one-liner · optional "take". Max items per page is fixed in the schema (e.g. 6) so the design never overflows.

## 4. Product surfaces

- **Web viewer** — `/{issue}` e.g. `/2026-w44`. Mobile: full-screen vertical/horizontal swipe cards with progress dots. Desktop: two-page spreads with keyboard nav. Each page has its own URL (`/2026-w44/6`) and OG image so a single page is shareable.
- **Archive** — `/` is the latest issue; `/issues` is a simple list (not a calendar grid — we are weekly).
- **Agent twin** — for every issue: `/{issue}.md` (YAML frontmatter + the full briefing, no nav), `/{issue}.json` (the raw edition object), plus site-wide `/llms.txt`, `/llms-full.txt` (latest issue), `/feed.xml`, `/feed.json`. `Accept: text/markdown` on any issue URL returns the `.md`. Later: a stateless MCP endpoint (`get_latest`, `get_issue(week)`, `search`).
- **Brand page** — `/brand`: logo, colors, type; supports sharing and the portfolio story.

## 5. Architecture

One monorepo, TypeScript throughout, pnpm workspaces.

```
apps/web            Next.js (App Router), static generation per issue, Vercel
packages/schema     edition.schema.json + generated TS types + validator (the contract)
packages/pipeline   ingest → normalize → dedupe → classify → draft → write editions/<week>.json → open PR
packages/ui         design tokens + primitives (from DESIGN.md)
editions/           one JSON per issue; git is the CMS; the PR is the editorial review
fixtures/           one hand-built reference issue used by tests, Storybook, and previews
.github/workflows   CI (typecheck, lint, schema-validate, Playwright smoke), weekly draft job, preview deploys
```

### 5.1 Verified sources — deterministic ingest, AI never introduces a fact

Principle: **every item in an edition traces to a record fetched from a publisher we trust, by code, with a URL and a timestamp.** The LLM may classify, summarize, rank, and draft prose over those records. It may not add a company, number, date, or claim that is not in a source record. CI enforces this (§5.3).

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

Rules for every adapter:
- One file per adapter in `packages/pipeline/src/sources/<name>.ts`, implementing `fetch(window) → RawItem[]`. Each adapter has: `LICENSE.md` note (terms, rate limits, what we store), a recorded fixture (`__fixtures__/<name>.json`), deterministic tests, and a `health()` check.
- Store **headline, canonical URL, publisher, published_at, fetched_at, raw excerpt ≤ 300 chars, source-specific IDs**. Never full article bodies.
- Respect robots.txt and rate limits; UA string identifies the project with a contact URL.
- An adapter failure degrades the page, never the run: the page renders with fewer items and the back page says which sources were unavailable.
- Sources are configured in `config/sources.yaml` so adding one is data + an adapter, not a redesign.

### 5.2 Pipeline stages

`ingest` (all adapters in parallel, cached raw to `data/raw/<date>/`) → `normalize` (canonical URL, publisher, timestamps) → `dedupe` (URL + SimHash on titles; cross-source clusters keep every source link) → `classify` (LLM with the schema taxonomy, temperature 0, structured output, confidence; < 0.7 → `unsorted`) → `rank` (deterministic: source count × publisher weight × recency × HN/Reddit engagement) → `extract` (deterministic regexes + LLM structured extraction for amounts/stages/acquirers, **with the quoted span from the source excerpt required**) → `draft` (one-liners + Briefing per `STYLE.md`) → `verify` (§5.3) → `emit` `editions/<week>.json` → `validate` → PR.

Runs: daily 06:00 ET ingest (keeps raw cache warm, feeds the agent surface later); weekly Saturday 06:00 ET full build → PR; Sunday 17:00 ET auto-publish if the PR is green (v1 is unattended; a human-edit step can be inserted later without changing the pipeline).

### 5.3 Provenance and verification gates (CI-enforced)

- Schema requires `sources[]` on every item with `url`, `publisher`, `published_at`, `fetched_at`, `adapter`. Items with zero sources fail validation.
- Every number in Money/Deals/Performance/Markets carries `evidence: {source_index, quote}`; CI re-checks the quote exists in the stored excerpt.
- Company tags must be in `config/companies.yaml` (slug, name, aliases, domain, ticker). Unknown company → `unsorted`, never auto-added.
- Briefing sentences are checked by an LLM-judge against the page items (entailment); a sentence not supported by at least one item fails the build.
- Discourse items need ≥ 2 sources from ≥ 2 distinct publishers.
- A `provenance.json` per edition lists every adapter run, item count, failures, and the cache hashes — rendered on the back page and in the `.md` twin.

## 6. Spec artifacts

Inputs that exist before hand-off (written in the workspace): this `PLAN.md` and `DESIGN.md`. Everything else — `PRD.md`, `ARCHITECTURE.md` + ADRs, `STYLE.md`, `CONTRIBUTING.md`, `edition.schema.json`, the fixture issue — is produced **by cloud agents in Wave 1** from those two documents. Nothing is authored locally after the plan is verified.

## 7. Delegation protocol — one hand-off, zero touch to v1

**Rule:** after Tayden verifies this plan, 100% of the work runs in Devin Cloud on `swe-2-max` (fallback `normal`). Orchestration is also cloud-side: GitHub is the state machine, Devin Automations are the workers, a scheduled supervisor session handles stalls. No local step, no click, no input from Tayden until the v1 completion report arrives.

### 7.1 The hand-off (the only human step)

Executed once, by the workspace agent, immediately after verification:

1. Create the GitHub repo `tayden-b/weekly-ai-edition` (private until Wave 5 flips it public); push `PLAN.md`, `DESIGN.md`, `HANDOFF.md`; create labels. The Bootstrap session derives `plan/dag.yaml` and every issue brief from §7.4 — nothing else is authored locally.
2. Create the Vercel project linked to the repo (root `apps/web`) through Tayden's existing Vercel↔GitHub link, so previews and production deploy on push with no token in the cloud.
3. **No secrets.** LLM work runs inside Devin sessions on the subscription (§8); covers are typographic in v1; Vercel and GitHub are integration-linked; progress/report emails come from automation notifications.
4. Create three Devin Automations (`run_as: creator` so sessions show in Tayden's sidebar; `devin_mode: swe-2-max`, fallback `normal`; `bypass_approval: true`; email notifications on): **Builder**, **Reviewer**, **Supervisor** (§7.3).
5. Open the `B0 Bootstrap` issue and label it `devin:ready`. Builder picks it up; from here on nothing is touched.

### 7.2 Repo as state machine

- `plan/dag.yaml`: every work item with `id`, `title`, `wave`, `depends_on: [ids]`, `brief: plan/issues/<id>.md`, `acceptance: [...]`.
- Bootstrap creates one GitHub Issue per item, labelled `wave:N` + `status:blocked`, body = the brief + acceptance criteria. Issue numbers are written back into `dag.yaml`.
- `.github/workflows/dispatch.yml` (deterministic, no LLM): on `pull_request: closed (merged)`, on `issues: closed`, and every hour — read `dag.yaml`, and for every issue whose `depends_on` are all closed, swap `status:blocked` → `devin:ready`. When all items are closed, open the `v1-complete` issue and label it `devin:ready`.
- Branch protection on `main`: required checks = `ci` (typecheck, lint, unit, schema-validate, provenance-check, Playwright smoke, Lighthouse budget) + `devin-review`; auto-merge enabled; squash only; PR must reference `Closes #N`. Merging therefore needs no human: green CI + a passing review = merge → issue closes → dispatch unblocks the next items.

### 7.3 The three automations

| Automation | Trigger | What the session does |
|---|---|---|
| **Builder** (concurrency 8) | `github:issues` `action=labeled`, `label.name=devin:ready` | Read `CONTRIBUTING.md` + the issue brief. Implement on branch `devin/<id>`. Keep CI green. Open PR with `Closes #N`, preview URL, screenshots of fixture rendering if UI. Address Reviewer comments until approved. Enable auto-merge. Relabel issue `status:in-review`. Never widen scope; if the brief is wrong, open a `plan-defect` issue and continue with the narrowest sane reading. |
| **Reviewer** (concurrency 8) | `github:pull_request` `action in [opened, ready_for_review, synchronize]`, `head.ref starts_with devin/` | Trigger Devin Review (code). Then check the PR against the issue's acceptance criteria, `DESIGN.md` (for UI: screenshot the Vercel preview at 390×844 and 1440×900, compare against tokens/layout rules), `STYLE.md` (for drafting), §5.3 provenance rules (for pipeline). Approve, or request changes with exact, actionable comments. Never merges by hand — auto-merge does. |
| **Supervisor** (concurrency 1, `schedule:recurring` every 3h) | RRULE hourly ×3 | Audit: PRs with failing checks > 3h, issues `devin:ready` with no PR > 2h, review ping-pong > 3 rounds, Vercel build failures, dispatch workflow failures. Remedy in order: push a fix, re-label to re-trigger Builder (max 3 retries per issue, counted in a label `retry:N`), split the issue, or — last resort — label `needs-human` and email `${REPORT_EMAIL}` once with a precise ask. Also runs the weekly cost/progress line into `plan/PROGRESS.md`. |

A fourth automation, **Weekly Edition**, is created *by* the Wave 4 work (cron Saturday → pipeline run → PR → auto-publish Sunday if green) — it is product, not orchestration.

### 7.4 Waves (parallel where possible)

| Wave | Items (one issue = one Builder session) | Parallelism |
|---|---|---|
| **0 Bootstrap** | `B0` Repo plumbing: pnpm monorepo skeleton, CI workflow, Vercel project + preview deploys, branch protection + auto-merge, labels, `dispatch.yml`, issue creation from `dag.yaml`, Devin Review enabled, `CONTRIBUTING.md` v0. Labels Wave 1 `devin:ready` on completion. | 1 |
| **1 Contracts** | `C1` `PRD.md` + `ARCHITECTURE.md` + ADRs extracted from PLAN/DESIGN · `C2` `edition.schema.json` + TS types + validator + **fixture issue 2026-W44 built from real public URLs** · `C3` `STYLE.md` + drafting rubric + 50-item labelled classification set · `C4` `packages/ui` tokens + primitives + `/kitchen-sink` · `C5` source-adapter interface + `RawItem` type + adapter test harness + `config/sources.yaml` + `config/companies.yaml` | 5 |
| **2 Build** | Viewer: `V1` mobile deck · `V2` desktop front page · `V3` per-page routes + OG image generation · `V4` archive + `/brand` + `/issues`. Pipeline adapters (each its own issue): `A1` lab blogs RSS · `A2` HN Algolia · `A3` newsroom RSS set · `A4` SEC EDGAR (Form D / S-1 / 8-K) · `A5` press-wire RSS (funding + M&A filters) · `A6` Product Hunt + GitHub Releases + HF Hub · `A7` benchmark publishers · `A8` market data · `A9` Reddit JSON · `A10` distribute.software (secondary). Core: `P1` normalize + dedupe · `P2` rank · `P3` daily ingest cache workflow | up to 17 |
| **3 Intelligence + twin** | `P4` classifier + company tagging (meets ≥ 90% on C3 set) · `P5` extraction with evidence spans · `P6` drafter (one-liners + Briefing) passing the rubric · `P7` verify stage (§5.3) + provenance.json · `T1` `.md`/`.json` twins + `Accept: text/markdown` · `T2` `llms.txt`, `llms-full.txt`, RSS + JSON feeds · `T3` cover-image generation step per DESIGN §1.5 | 8 |
| **4 Integration** | `I1` end-to-end: `pnpm edition:build --week 2026-W44` from the raw cache → valid edition → preview · `I2` Weekly Edition automation (cron → PR → Sunday auto-publish) · `I3` production deploy on `*.vercel.app` + analytics + security headers · `I4` design QA pass over every page in both renderers vs DESIGN.md, fixing drift · `I5` a11y + perf budgets enforced in CI | 5 |
| **5 Ship v1** | `S1` Produce the first real edition from live sources, publish it, flip repo public, run the agent-twin test (a fresh session given only the issue URL must summarize the week correctly), write `plan/V1-REPORT.md` (what shipped, what degraded, costs, known gaps, first 5 recommended follow-ups) and email it to `${REPORT_EMAIL}`. | 1 |

### 7.5 Definition of done — v1

- Production URL live on Vercel with ≥ 1 real edition built from live verified sources, both renderers passing DESIGN.md QA.
- Weekly Edition automation enabled and has produced at least one unattended PR that merged.
- Every item in the live edition has ≥ 1 source record; every number has an evidence span; provenance page present.
- Agent twin (`.md`, `.json`, `llms.txt`, feeds) live and validated.
- CI enforces schema, provenance, a11y, perf budgets; Devin Review on every PR.
- `V1-REPORT.md` emailed. Tayden's first action after hand-off is reading that email.

### 7.6 What is deliberately *not* zero-touch (and why)

- **Custom domain** — buying one needs a payment; v1 ships on `*.vercel.app`. Attaching a domain later is one PR + a DNS record.
- **Email subscription** — gated on the IBM outside-activity check (your guardrail), not on engineering.
- **Taste** — no human looks at the design until v1. The Reviewer's screenshot-vs-DESIGN.md check and the I4 QA pass are the mitigation; they catch drift from the spec, not a spec that is wrong. Expect to spend your first post-v1 session on design corrections. This is the cost of zero-touch and it is acceptable because the spec is detailed.

**Later (post-v1, each one PR):** MCP endpoint; email via Buttondown/Resend after the IBM check; `/edit` form for human takes; Devin Playbook "produce this week's issue".

## 8. Defaults chosen (change if wrong)

- Cadence: weekly, published Sunday 17:00 ET, covering Sat→Fri. Daily ingest keeps the raw cache warm.
- Domain: v1 on `*.vercel.app`; standalone domain (not under tayden.dev) attached post-v1.
- Intelligence stages (classify, extract-with-evidence, draft, entailment check) are **performed by the Weekly Edition Devin automation session** on Tayden's subscription — no LLM API key. The session runs the deterministic CLI stages (`ingest`→`rank`), then fills the `classification`, `evidence`, `one_liner`, `briefing` fields following `STYLE.md` and the prompts versioned in `packages/pipeline/prompts/`, then runs `verify` and `validate` (both deterministic) before opening the PR. A `packages/pipeline` `llm()` seam remains so an API-backed path can be added later without touching the stages.
- Covers: typographic only in v1 (DESIGN.md §1.5 image generation deferred to a post-v1 PR).
- Build agents: Devin Cloud `swe-2-max`, fallback `normal`; Builder/Reviewer concurrency 8; Supervisor every 3h; retry cap 3 per issue.
- Hosting: Vercel (already in your toolchain). Data: none at launch — JSON in git. Add a DB only when search or email requires it.
- Licence: code MIT; content CC BY-NC with sources attributed.

## 9. Risks

- **Commodity risk.** Without a personal column, Briefing quality and design are the entire moat. Mitigation: the rubric eval, the fixed template, and spending the design time up front in DESIGN.md.
- **Source ToS.** Benchmarks and market data in particular. Each adapter carries a licence note; anything doubtful ships as a link, not data.
- **Treadmill.** If the human loop exceeds ~30 min/week, the pipeline is not done. Track it.
- **Single-creator dependency** on distribute.software is contained by making it a secondary adapter.
- **Unattended orchestration failure modes.** Review ping-pong, flaky CI, and brief ambiguity are the three ways zero-touch stalls. Mitigations: Supervisor every 3h with a retry cap and issue-splitting authority; `plan-defect` issues so Builders never block on a bad brief; Builders instructed to take the narrowest sane reading rather than ask.
- **Cost.** SWE-2 is free today; each automation still carries `limits.max_acu_limit` and the Supervisor logs spend weekly so a pricing change cannot run away.

## 10. Verification checklist (Tayden, once)

Confirm or amend each line; the hand-off executes immediately after.

1. The pivot: generalized weekly AI briefing, no personal column, public from issue 1. (§1–3)
2. Verified-sources principle and the source table. (§5.1) Any source you want added or struck?
3. Zero-touch protocol, three automations, waves, DoD. (§7)
4. v1 on `*.vercel.app`; no email until the IBM check. (§7.6)
5. Hand-off inputs — resolved 2026-10-28: repo `tayden-b/weekly-ai-edition`; LLM via Devin subscription sessions; typographic covers; no secrets; notifications via Devin automation email.

**Verified by Tayden 2026-10-28.**
