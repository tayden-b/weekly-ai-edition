# V1 Report — Weekly AI Edition ships

**Date:** 2026-10-29 · **Milestone:** S1 (issue #36, wave 5 — final item) · **Edition:** `2026-W44` (2026-10-24 → 2026-10-30) · **PR:** [#114](https://github.com/tayden-b/weekly-ai-edition/pull/114) (`devin/edition-2026-w44`, label `edition`)

## What shipped

**Edition № 1 — the first edition built entirely from live sources.** `pnpm edition:build --week 2026-W44 --mode session --ingest auto` ran the full pipeline in-session: deterministic ingest → normalize → dedupe, with the four intelligence stages (classification, extraction, draft, verify) performed by the build session through the versioned `editions/2026-w44/*.prompt.md` contracts, exactly as a scheduled Saturday run would.

- **Pipeline shape:** 50 sources → 2096 raw items (2026-10-28 ingest cache: 1082; 2026-10-29 live fetch: 1014, 0 failed adapters) → 1514 in-window → 744 dedupe clusters → 35 emitted items.
- **Emitted pages:** models 6, performance 4, launches 5, funding 6, deals 4, markets 6 tickers, discourse 3 — plus cover, 6-sentence briefing (all sentences verify-supported), most-covered (Alphabet 5 stories, Google DeepMind 4, Amazon 3, Anthropic 2, Globalstar 2), and back-page provenance (44 cited sources).
- **Week's actual coverage:** Anthropic files for IPO (the deterministic filing headline, not a "raise"); Microsoft's first US bond sale since 2017 ($25B+); Gemini 4 Carbon launch + #1 on the Artificial Analysis Intelligence Index v5; Nvidia Nemotron 3.5 Transcribe (40 languages); Cursor Agent SDK; Meta Muse (Singapore) + Waddle; Alexa shopping lists; Firefox Smart Window; Amazon Leo's approved $11.5B Globalstar acquisition; Xsolla–GamePix; Deepgram–Daily/Pipecat; Opentrons $40M E; Solink $100M+; TrashLab $12M; Wabi $55M; FuriosaAI $620M D.
- **Gates:** `schema:validate` PASS, `provenance:check` PASS (§5.3 — every number traces to a quoted span), `dag:validate` PASS; `pnpm check` green (typecheck + lint + 554 vitest); `pnpm build` green.
- **Both renderers verified on the built output:** `next start` serves `/2026-w44` with `issue-split__frontpage` (≥768px V2 front page) and `issue-split__deck` (<768px V1 swipe deck) both in the server-rendered HTML carrying the real edition. PR preview deployment serves it pre-merge; merge to `main` deploys to `https://weekly-ai-edition.vercel.app` (Vercel↔GitHub link, already live).
- **Repo public:** verified already public (flipped 2026-10-28) — not re-flipped.
- **Review artifacts committed:** `editions/2026-w44/{classification,extraction,draft,verify}.{request,response}.json` — the session-LLM hand-off files make this run replayable/diffable (`workflow_dispatch` dry-run can re-verify deterministically).

## What degraded

| Source | Status | Impact |
|---|---|---|
| `stooq-weekly` | **Hard-degraded**: Stooq's keyless CSV endpoint now answers an anti-bot JS proof-of-work challenge; adapter returned `ok:true, count:0` both days | Markets page emitted from the committed **fixture pool** (`--fixture`): real recorded W44 closing series through Tue 2026-10-27 for AMD/AMZN/GOOGL/META/MSFT/TSM. All news items are live; the markets dataset is recorded-real data, two days stale at publish |
| 18–21 quiet adapters/day (`meta-ai-blog`, `xai-news`, `deepseek-news`, `qwen-blog`, `gh-*`, `swe-bench`, `reuters-tech`, `pr-newswire`, `globenewswire`, `ft-headlines`, `sec-edgar-current-feed`, `techcrunch-funding`, `reddit-*`) | `ok:true, count:0` — mostly genuinely quiet windows (lab blogs, release trackers); the three Reddit feeds and several wire feeds returning 0 on both days warrant a look | None observed in emitted coverage (tech news flowed via Verge/TechCrunch/Bloomberg/FT/NYT/Axios instead) |
| Meta's $95bn fundraise | Emitted but rubric-flagged (R6/R12): the deterministic headline writes `$95B`; the source says `$95bn` verbatim | Recorded flag, non-blocking; deterministic headline normalization should learn `bn`↔`B` |

## Costs

- **Session ACUs:** not metered on this plan (`acus_consumed` reports 0 — same as every prior session; supervisor progress lines likewise record "cost n/a"). Wall-clock ≈ 3 h including multi-round response-contract iteration.
- **External spend:** none — zero secrets, zero paid APIs, zero external LLM calls (PLAN §8 / ADR-0002 held: the build session itself is the model). Vercel deploys are on the existing hobby link.

## Known gaps

1. **stooq-weekly is effectively dead** for unattended builds — the endpoint is behind bot mitigation. Markets data needs either a tolerated-keyed provider (`alpha-vantage`/`finnhub`/`twelve-data` are already listed in `config/markets.json` priority order but unimplemented) or a standing cache populated by a different fetch path.
2. **`Disruptive` collides with the R5 banned-word list.** A $10B fund raise couldn't emit on the funding page because the deterministic headline `Disruptive raised …` trips the hype-word rule. The item was classified unsorted; company-name collisions need an allowlist path (registry slug → exempt that token in the deterministic span).
3. **Deterministic funding headline flags itself for number form** (`$95B` vs source `$95bn`, R6/R12) — the emitted headline can't trace verbatim. Normalization-aware tracing or emitting the source's own form would clear it.
4. **Rank-starved real launches:** 261 launch-classified clusters were dominated by Show HN volume; curating a meaningful top-6 required demoting 256 marginal indie posts to unsorted at classification time. A rank feature for publisher authority (or a `show_hn` source dampener) belongs in the ranker, not the classifier.
5. **SEC EDGAR items can't carry funding** — Form D/8-K/S-1 records classify cleanly but emit nothing useful (no round fields in excerpts); 17 records classified unsorted this run. Either teach extraction filing-specific fields or stop feeding EDGAR to the funding classifier.
6. **GitHub→automation delivery still broken** (supervisor-known): this build itself was hand-dispatched; Reviewer will not fire on PR #114 — the supervisor runs the loop manually. The `Weekly Edition` automation (I2) also remains queued behind an org approval card (plan-defect #111).

## Agent-twin test

Fresh Devin session `devin-2b0e8f098dec4df186de7e46e7b1e95c` was given **only** `https://github.com/tayden-b/weekly-ai-edition/issues/36` (per the issue's prescription; the live prod URL still serves fixture W45 pre-merge and the PR preview is SSO-gated, so the twin's reachable surface was the public repo + open PR).

- **Transcript:** https://app.devin.ai/sessions/2b0e8f098dec4df186de7e46e7b1e95c
- **Verdict: PASS.** The twin navigated issue #36 → repo PR list → `editions/2026-w44.json` on `devin/edition-2026-w44` (it also correctly reported that production still serves the synthetic W45 fixture, and hit the PR preview at `/2026-w44`). Its 6-sentence summary reproduced the edition faithfully: Anthropic's IPO filing, Microsoft's $25B bond + $10B OpenAI revenue disclosure, Gemini 4 Carbon's AA-Index #1 debut with Genie 4 and Nemotron 3.5 alongside, the $11.5B Globalstar approval, Deepgram–Daily and Xsolla–GamePix, all four smaller rounds with correct amounts and leads, the agent-tooling launches, all three discourse items, and Alphabet's 13% drop.
- **Sufficiency (twin's own (c)):** "sufficient to reconstruct the week without any external reading — the edition JSON is self-contained: 35 items, each with headline, one-liner, and embedded source URLs (44 sources). I never needed to open an underlying article." It even echoed the known gaps (stale-stooq markets, the `Disruptive` collision, amount-less funding headlines) from the PR body.

## First 5 recommended follow-ups

1. **Restore a markets data path** — implement one of the already-prioritized keyed providers behind an org secret, or replace stooq with a fetch path that survives the ToS/mitigation (gate: P7/no-secrets needs an org-secret slot, not a new paid service).
2. **Banned-word vs. registry-name collision rule** — exempt deterministic spans (funding headlines, company registry display names) from the R5 word list, or emit a `plan-defect` + fix so `Disruptive`-class names can appear.
3. **Dampen Show HN / boost authoritative publishers in the ranker** — the classifier shouldn't be the curation layer; add a source-authority term so Cursor-SDK-class launches outrank single-source indie posts without manual demotion.
4. **Unblock GitHub→automation delivery** — every wave-3/4/5 dispatch ran by hand; the self-driving build loop is the product's operating model, and the Reviewer automation not firing means editorial gating currently depends on the supervisor remembering.
5. **Approve + arm the Weekly Edition automation (I2, plan-defect #111)** — the whole point of the build; once delivered events work, Saturday 06:00 ET runs this exact session flow unattended and opens `devin/edition-<week>` PRs itself.
