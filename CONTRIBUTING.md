# CONTRIBUTING — for Devin Builder sessions

You are a Builder session working an issue labelled `devin:ready`. Read this file, your issue's brief (`plan/issues/<id>.md`, mirrored into the issue body), then `HANDOFF.md`, `PLAN.md`, `DESIGN.md` before writing code.

## Commands

```bash
pnpm install          # clean install (frozen lockfile in CI)
pnpm check            # THE gate: typecheck + lint + test + schema:validate + provenance:check + dag:validate
pnpm dev              # Next.js dev server (apps/web)
pnpm build            # build all packages/apps
pnpm test             # vitest, root-level
```

Node 22, pnpm 11 (via `packageManager` / corepack). TypeScript strict everywhere.

## Layout

```
apps/web            Next.js App Router — the site (viewers, twins, feeds)
packages/schema     edition.schema.json + TS types + validator (the contract)
packages/ui         DESIGN.md tokens + primitives — the ONLY source of styles
packages/pipeline   adapters → stages → emit; prompts/ for LLM-stage prompts
plan/dag.yaml       the build DAG (state machine)
plan/issues/        one brief per dag item
editions/           one JSON per issue — git is the CMS (created by pipeline)
fixtures/           hand-built reference data for tests/previews
config/             sources.yaml, companies.yaml, markets.json
data/raw/           adapter ingest cache (P3)
scripts/            dispatch.mjs, validate-dag.mjs, gate scripts (no deps)
```

## Running the pipeline on fixtures

Deterministic stages are pure functions — test them with `vitest` against `packages/pipeline/testdata/` + adapter `__fixtures__/`. No network in tests, ever. `pnpm edition:build --week <id>` (lands with I1) runs the chain over `data/raw/` cache; LLM-stage fields are filled through the session `llm()` seam and recorded for replay (see P4's format).

## The ingest cache (`data/raw/`)

`pnpm ingest` (P3, `scripts/ingest.mts`) runs every `enabled` adapter in `config/sources.yaml` in parallel and writes the daily raw cache — `.github/workflows/ingest-daily.yml` does this at 06:00 ET and commits the result to `main` (git-as-CMS, ADR-0001).

```
data/raw/<YYYY-MM-DD>/<source-id>.json   one file per enabled sources.yaml entry:
                                        { adapter, source, fetched_at, items }
                                        — items are AdapterRawItem (RawItem +
                                        adapter id), i.e. exactly what P1's
                                        normalize consumes. Read the files
                                        directly; no re-stamping needed.
data/raw/<YYYY-MM-DD>/manifest.json     the run's provenance record: per-source
                                        { source, adapter, ok, count, error? },
                                        the fetch window, ran_at, and totals.
```

- Files are keyed by the **entry id** (`pr-newswire.json`), not the adapter id — adapters like `press-wire-rss` run one instance per config entry, so the entry id is the unique name. The adapter id is inside each file + the manifest.
- **Failure isolation:** a throwing factory or `fetch()` becomes that source's `ok: false` manifest row + an empty `items` file; the run never fails (PLAN §5.1). A blocked feed that degrades internally lands as `ok: true, count: 0`. Disabled entries are skipped entirely.
- **Re-runs:** same `--date` → same file names and content shape, every file rewritten wholesale (stale records can't survive into a later build). A re-run is a no-diff unless publishers added or retracted items.
- Flags: `--date YYYY-MM-DD` (default: today UTC) · `--days N` (window lookback, default 7 — the edition's Sat→Fri coverage, so a missed day leaves no gap) · `--config`/`--markets`/`--out` path overrides.

## What a passing PR looks like

- `pnpm check` green on a clean clone; CI job `ci` green.
- Every acceptance criterion in your issue's brief is met — walk them one by one in the PR body.
- UI changes: screenshots at **390×844 and 1440×900**, light and dark, on the Vercel preview link.
- Pipeline changes: fixture-based tests; provenance rules untouched.
- Body contains `Closes #<issue>`; Vercel preview URL included.
- Squash merge only; enable auto-merge and let checks + review merge it — never merge by hand.

## Branch / PR naming

- Branch: `devin/<item-id>` (e.g. `devin/c2`) — branches outside `devin/*` don't get reviewed.
- PR title: `<id>: <short title>`; body: summary + acceptance checklist + screenshots + `Closes #N`.

## The rules that are never negotiable

- **No secrets.** Nothing requires API keys; never add one. (HANDOFF.md)
- **Provenance.** Every edition item traces to a fetched source record; every number carries an evidence quote from the stored excerpt. Never weaken `provenance:check` or the schema to go green.
- **No republishing.** Headline, link, ≤300-char excerpt, our own summary — never article bodies.
- **Design is DESIGN.md, verbatim.** Tokens come from `packages/ui`; zero hardcoded colours or font sizes.
- **Scope.** Never widen your issue. If the brief is wrong or incomplete: open an issue labelled `plan-defect` describing the fix, take the narrowest sane reading, and finish.
- Repo stays private until S1.

## Opening a plan-defect

`gh issue create --label plan-defect --title "plan-defect: <what's wrong>" --body "…"` — describe the contradiction/gap, the narrowest reading you took, and what the fix should be. Keep working; never block on it.
