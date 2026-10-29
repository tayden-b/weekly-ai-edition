# Weekly Edition — the shipping mechanism (I2)

PLAN §5.2 cadence, realized: **Saturday 06:00 ET build → edition PR → Sunday
17:00 ET publish.** Product automation, not orchestration (PLAN §7.3).

```
Sat 06:00 ET   Weekly Edition Devin automation fires
               → session runs edition:build --mode session --ingest cache
               → session fills classify/extract/draft/verify responses itself (§8)
               → opens edition PR (devin/edition-<week>, label `edition`)
~35 h          ci + Vercel preview + Reviewer verdict land
Sun 17:00 ET   .github/workflows/edition-publish.yml arms `gh pr merge --auto --squash`
               → green PR merges to main → Vercel deploy = published
```

## The pieces

| Piece | Where | What it does |
|---|---|---|
| **Weekly Edition automation** | Devin Automations (auto-created by I2; the org's *Automations* page) | `schedule:recurring`, `FREQ=WEEKLY;BYDAY=SA;BYHOUR=6`, `TZID=America/New_York` → `start_session`. DST-correct by construction (IANA TZID). |
| **Session prompt** | [`plan/weekly-edition-prompt.md`](../plan/weekly-edition-prompt.md) | Versioned here, so the instructions the Saturday session runs are reviewable in a PR. The automation's stored prompt just points at this file — editing it changes the next run; nothing else to redeploy. |
| **`pnpm edition:build`** | [`scripts/edition-build.mts`](../scripts/edition-build.mts) (I1) | The stage chain: ingest → normalize → dedupe → classify → rank → extract → draft → emit → verify → validate. `--mode session` hands the four judgement stages to the session through `editions/<week>/*.request.json` → `*.response.json` (PLAN §8). |
| **`edition-publish.yml`** | `.github/workflows/` + [`scripts/edition-publish.mjs`](../scripts/edition-publish.mjs) | Sunday publish step. Arms auto-merge on the open `edition` PR. |
| **`edition-dry-run.yml`** | `.github/workflows/` | `workflow_dispatch` dry run — replays a recorded week and proves the emitted edition is byte-identical. |

## The publish mechanism, exactly

- GitHub cron is UTC-only, so `edition-publish.yml` is booked at **both** 21:00
  and 22:00 UTC on Sundays; the script's `TZ=America/New_York` gate admits only
  the run that lands at 17:00 ET. Correct through EST/EDT with no edits.
- On the open `edition` PR: **green → arm auto-merge** (merges immediately —
  that is the publish); **pending → arm auto-merge** (GitHub merges it the
  moment required checks go green); **failing → not armed**, the script
  comments the failing checks on the PR and exits non-zero so the failure
  shows in the Supervisor's `gh run list` audit.
- Auto-merge is deliberately **not** armed when the PR opens on Saturday —
  that would publish at first-green instead of Sunday 17:00 ET and collapse
  the review window (the same trap as defect #98).
- Manual publish: dispatch `edition-publish` with `arm: true`. A plain
  `workflow_dispatch` (`arm: false`, the default) is a dry run — it prints the
  decision and check rollup without touching the PR.
- Auto-merge requires the repo's `allow_auto_merge` flag and branch
  protection's `ci` check + linear history — both already live.
- If a green edition PR is somehow still open after Sunday, the next cron tick
  (a week later, or a manual `arm` dispatch) still publishes it; the
  Supervisor also watches for stale open PRs.

## PR conventions for editions

- **Branch:** `devin/edition-<week>` — under `devin/*` so the Reviewer
  automation treats it as reviewable (its STYLE.md/provenance check is the
  editorial gate, ADR-0003: "green CI + passing review IS the editorial gate").
- **Label:** `edition` — marks product PRs so `edition-publish.mjs` (and
  humans) can tell them apart from work-item PRs.
- **No `Closes #N`:** edition PRs are standalone — they close no issue, so
  the work-item `Closes` convention does not apply (I2 brief; the branch
  protection check that requires a linked issue applies to `devin/<item>`
  work PRs, not product releases).
- **Retries/alerts:** the Supervisor's domain (I2 scope); a failed Saturday
  run is surfaced by the automation's email notification (`when: always`)
  and the Supervisor audit, not retried inline.

## Manual triggers

| What | How |
|---|---|
| Full build, real session | Devin Automations → *Weekly Edition* → **Run now** (fires the same prompt the Saturday cron uses). |
| Build stage chain, deterministic | Actions → `edition-dry-run` → pick a week with committed responses → replay runs in CI and must be byte-identical. |
| Publish step | Actions → `edition-publish` → default is a dry run (decision + rollup only); `arm: true` publishes for real. |

## Secrets

None beyond the automation's own internals — the GitHub workflows use only
`GITHUB_TOKEN`, and the session's judgement stages run on the Devin
subscription (PLAN §8, ADR-0002: no external LLM APIs, ever).
