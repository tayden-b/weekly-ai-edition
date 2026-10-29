# Weekly Edition — build-session prompt

> Canonical prompt for the **Weekly Edition** Devin automation (`schedule:recurring`,
> Saturday 06:00 ET — PLAN §5.2/§7.3/§8, ADR-0003). The automation's stored prompt
> bootstraps to this file; edit it here so every run uses the reviewed version.
> Mechanics and conventions are documented in `docs/weekly-edition.md`.

You are the Weekly Edition build session for `tayden-b/weekly-ai-edition`. Produce
this week's edition end to end and open the edition PR. Unattended: nobody will
answer questions — take the narrowest sane reading of anything ambiguous and
record it in the PR body.

## 1. Pick the edition week

The edition covers the Sat→Fri window ending on the most recent Friday:

```bash
WEEK=$(date -u -d 'last friday' +%G-W%V)   # e.g. 2026-w45
```

On the Saturday trigger, "last friday" is yesterday — the week that just ended.
On a manual trigger any other day it is the most recently completed week.
Idempotency: if an **open** PR already exists from branch `devin/edition-$WEEK`,
push the rebuild to that branch instead of opening a second PR. If a merged
edition PR already shipped `$WEEK`, stop — the edition is published.

## 2. Build

```bash
git checkout main && git pull
git checkout -b devin/edition-$WEEK   # re-use the branch if it already exists
pnpm install --frozen-lockfile
pnpm edition:build --week $WEEK --mode session --ingest cache
```

`--ingest cache` builds from the committed `data/raw/` cache (kept warm by
`ingest-daily.yml`); sessions never fetch adapters live.

`--mode session` drives the LLM stages through the session seam (PLAN §8 —
you ARE the model; there is no API). Each stage writes
`editions/$WEEK/<stage>.request.json` + `<stage>.prompt.md`, then polls up to
30 minutes for `<stage>.response.json`. Run the build in the background, watch
the directory, and for every request that appears:

1. Read `<stage>.prompt.md` (rendered from `packages/pipeline/prompts/`) and the
   request JSON.
2. Produce the judgement yourself, following `STYLE.md` and the response
   contract in `packages/pipeline/src/llm.ts` (`assert*Response` — every id in
   the request covered exactly once).
3. Write `<stage>.response.json`. The build resumes on the next poll tick.

Stages in order: `classification` → `extraction` → `draft` → `verify`. The
deterministic stages (normalize, dedupe, rank, emit, validate) need no input.
If a stage times out, restart the same command — requests on disk are reused.

## 3. Gates

The build runs `verify` (§5.3 provenance) and the `schema:validate` +
`provenance:check` gates itself and refuses to write a failing edition. Never
weaken a gate, a response contract, or the schema to get through. After it
finishes, run `pnpm check` — it must be green before the PR opens.

## 4. Open the edition PR

Commit `editions/$WEEK.json`, `editions/$WEEK/` (request/prompt/response
artifacts + `provenance.json` — they are the replay record and belong in git),
and any new `data/raw/` cache files. Then open a PR:

- **Branch:** `devin/edition-$WEEK` (the `devin/*` prefix puts it on the
  Reviewer automation's radar — it is the editorial gate).
- **Label:** `edition` (product PR, not a work item — see docs/weekly-edition.md).
- **Title:** `Edition $WEEK — <date_start> → <date_end>`.
- **Body:** week id and window, item counts per page, provenance summary
  (sources run, failures), any judgement calls. **No `Closes #N`** — edition
  PRs are standalone; they close nothing.
- **Do NOT arm auto-merge** (`gh pr merge --auto`). Publishing is the Sunday
  17:00 ET `edition-publish` workflow's job; the ~35 h window is for CI, the
  Vercel preview, and review (ADR-0003).

## 5. Failure handling

A failed run is not retried by this automation — leave the repo clean, note
what failed in the session output; the Supervisor's audit picks it up. Never
commit a partial or gate-failing edition.
