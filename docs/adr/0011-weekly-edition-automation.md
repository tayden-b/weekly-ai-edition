# ADR-0011: Weekly Edition — a Devin automation builds, a GitHub workflow publishes

**Status:** Accepted (implements PLAN §5.2/§7.3/§8 and dag item `I2`)

## Context

PLAN §5.2 fixes the cadence: Saturday 06:00 ET full build → PR; Sunday 17:00 ET
auto-publish if green. §7.3 makes the Weekly Edition a fourth automation —
"product, not orchestration" — and §8 puts the intelligence stages inside the
spawned session (no LLM API). The open question was how one cron → session →
PR → delayed merge maps onto the available machinery, and where the
17:00-Sunday timing lives (auto-merge alone has no clock: armed at PR-open it
merges at first-green on Saturday — the #98 trap — collapsing the ~35 h
review window ADR-0003 put there on purpose).

## Decision

Split the loop at the tool boundary:

- **Build = Devin automation.** `schedule:recurring` with IANA
  `TZID=America/New_York` (`FREQ=WEEKLY;BYDAY=SA;BYHOUR=6`) handles ET/DST
  natively. Its `start_session` prompt points at
  `plan/weekly-edition-prompt.md` in the repo — the prompt is versioned and
  reviewed like code; the automation never needs editing for prompt changes.
  `run_as: organization`, `devin_mode: swe-2-max` (fallback `normal`),
  email notification on every dispatch.
- **Publish = GitHub workflow.** `edition-publish.yml` (cron Sundays 21:00 +
  22:00 UTC, script gates on 17:00 in `America/New_York`) arms
  `gh pr merge --auto --squash` on the open `edition`-labelled PR. Publish is
  literally "GitHub's auto-merge merges to main → Vercel deploys". Failing PRs
  are not armed — a comment names the failing checks for the Supervisor's
  audit. `workflow_dispatch` with `arm: false` (default) is a safe dry run.
- **Edition PRs are product PRs:** branch `devin/edition-<week>` (keeps the
  Reviewer automation in the loop — the editorial gate), label `edition`, and
  **no `Closes #N`** — they close nothing.
- **Dry runs**: `edition-dry-run.yml` (`workflow_dispatch` only) replays a
  recorded week via `--mode replay --ingest cache` and requires the emitted
  artifacts to be byte-identical — the determinism proof.

## Consequences

- The only long-lived state is GitHub's (the open labelled PR + auto-merge
  flag) — no second scheduler, no session waiting 35 h.
- A red edition PR cannot auto-merge mid-week: the Sunday job is the only
  thing that arms it, and it refuses red. Stale-but-green leftovers are
  still publishable by the next tick or a manual dispatch.
- Adding a human-edit step later means opening the edition PR as a draft and
  having a human mark it ready — no pipeline change (ADR-0003).
- Accepted quirk: the publish "step" is a CI job rather than a second Devin
  trigger — deliberate, since arming auto-merge is deterministic and must be
  cheap and inspectable.
