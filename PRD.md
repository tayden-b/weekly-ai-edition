# PRD — The Weekly AI Edition

**Status:** locked 2026-10-28. Extracted from `PLAN.md` §1–§4 (verified by the owner the same day); requirements are reproduced faithfully — restructured for readability, none added, dropped, or changed.

**Companion documents:** `DESIGN.md` (visual spec) · `ARCHITECTURE.md` (system spec) · `docs/adr/` (decision records) · `plan/dag.yaml` (build order / state machine) · `STYLE.md` (voice — lands with C3).

## 1. Thesis

**The only AI news product you finish.** One link a week. 10–14 full-screen pages covering everything that mattered in AI that week — model releases, benchmarks, product launches, funding, acquisitions, markets, and the discourse — synthesized into a briefing, designed like a magazine, swiped like Stories. Every edition has a machine-readable twin so a reader can hand the whole week to their agent in one URL.

### 1.1 Positioning

Versus distribute.software (the reference): they are the daily firehose on a calendar — complete, continuous, taste-neutral, general tech. We are weekly, finite, AI-only, synthesized, and designed. We sit downstream of aggregators; we do not compete on completeness or recency.

### 1.2 Reader

People who work in or around AI and are tired of 6 newsletters + X. They want to be caught up in 4 minutes on Sunday night.

### 1.3 Cadence

Weekly, published Sunday 17:00 ET, covering Saturday → Friday. A daily 06:00 ET ingest keeps the raw cache warm. → [ADR-0003](docs/adr/0003-weekly-cadence-and-publish-window.md)

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

Each item in pages 3–9 = headline · source · our one-liner · optional "take". Max items per page is fixed in the schema (e.g. 6) so the design never overflows. Per-page caps and framing rules are defined in `DESIGN.md` §3.

## 4. Product surfaces

- **Web viewer** — `/{issue}` e.g. `/2026-w44`. Mobile: full-screen swipe cards with progress dots (`DESIGN.md` §2.1). Desktop: `PLAN.md` §4 said "two-page spreads"; `DESIGN.md` §7.1 locked the newspaper-structured **front page** instead — spreads and desktop-deck rejected (see [ADR-0008](docs/adr/0008-desktop-renderer-front-page.md)). Keyboard nav on desktop. Each page has its own URL (`/2026-w44/6`) and OG image so a single page is shareable.
- **Archive** — `/` is the latest issue; `/issues` is a simple list (not a calendar grid — we are weekly).
- **Agent twin** — for every issue: `/{issue}.md` (YAML frontmatter + the full briefing, no nav), `/{issue}.json` (the raw edition object), plus site-wide `/llms.txt`, `/llms-full.txt` (latest issue), `/feed.xml`, `/feed.json`. `Accept: text/markdown` on any issue URL returns the `.md`. Later: a stateless MCP endpoint (`get_latest`, `get_issue(week)`, `search`).
- **Brand page** — `/brand`: logo, colors, type; supports sharing and the portfolio story.

## 5. Definition of done — v1

Reproduced from `PLAN.md` §7.5:

- Production URL live on Vercel with ≥ 1 real edition built from live verified sources, both renderers passing `DESIGN.md` QA.
- Weekly Edition automation enabled and has produced at least one unattended PR that merged.
- Every item in the live edition has ≥ 1 source record; every number has an evidence span; provenance page present.
- Agent twin (`.md`, `.json`, `llms.txt`, feeds) live and validated.
- CI enforces schema, provenance, a11y, perf budgets; Devin Review on every PR.
- `V1-REPORT.md` emailed. The owner's first action after hand-off is reading that email.

## 6. Deliberately deferred

From `PLAN.md` §7.6 — these are not v1 requirements:

- **Custom domain** — buying one needs a payment; v1 ships on `*.vercel.app`. Attaching a domain later is one PR + a DNS record. → [ADR-0006](docs/adr/0006-v1-platform-vercel-app-no-datastore.md)
- **Email subscription** — gated on the IBM outside-activity check, not on engineering.
- **Taste** — no human looks at the design until v1. The Reviewer's screenshot-vs-`DESIGN.md` check and the I4 QA pass are the mitigation; they catch drift from the spec, not a spec that is wrong.
- **Cover-image generation** — v1 covers are typographic; the generation step is dag item `T3`, deferred. → [ADR-0005](docs/adr/0005-typographic-covers-in-v1.md)

Post-v1, each one PR: MCP endpoint; email via Buttondown/Resend after the IBM check; `/edit` form for human takes; Devin Playbook "produce this week's issue".
