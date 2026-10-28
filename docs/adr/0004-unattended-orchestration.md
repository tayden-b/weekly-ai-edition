# ADR-0004: Unattended build orchestration — three Devin automations, repo as state machine

**Status:** Accepted (locked 2026-10-28 via PLAN.md §7/§8)

## Context

After the owner verified `PLAN.md`, 100% of the build runs in Devin Cloud — no local step, no human input until the v1 completion report. The orchestration therefore needs workers that pick up tasks, reviewers that gate quality, and something that recovers from stalls — all observable through GitHub alone.

## Decision

GitHub is the state machine; Devin Automations are the workers (`PLAN.md` §7.2–7.3, mirrored in `ARCHITECTURE.md` §6):

- **`plan/dag.yaml` + issues**: one issue per work item, body = brief + acceptance. `.github/workflows/dispatch.yml` (deterministic, no LLM) flips `status:blocked` → `devin:ready` when every `depends_on` issue is closed, and opens `v1-complete` when all items are closed.
- **Builder** (concurrency 8): triggers on `github:issues` `action=labeled` `label.name=devin:ready`. Implements the brief on `devin/<id>`, opens a PR with `Closes #N`, addresses Reviewer comments, enables auto-merge, relabels `status:in-review`.
- **Reviewer** (concurrency 8): triggers on `github:pull_request` opened/ready/synchronize on `devin/*` branches. Runs Devin Review, then checks the PR against the issue's acceptance criteria, `DESIGN.md` (screenshot diff for UI), `STYLE.md` (drafting), and the §5.3 provenance gates. Approves or requests changes — never merges by hand.
- **Supervisor** (concurrency 1, every 3h): audits stalls (failing checks > 3h, `devin:ready` without PR > 2h, review ping-pong > 3 rounds, Vercel/dispatch failures). Remedy ladder: push a fix → re-label (retry cap 3, counted in `retry:N`) → split the issue → label `needs-human` and escalate once. `PLAN.md` says "email `${REPORT_EMAIL}`"; `HANDOFF.md` (the later word) delivers that email by @-mentioning `tayden-b` in the issue. Logs cost/progress to `plan/PROGRESS.md`.
- All three run `run_as: creator`, `devin_mode: swe-2-max` (fallback `normal`), `bypass_approval: true`, email notifications on.
- Branch protection on `main`: required checks `ci` + `devin-review`, auto-merge enabled, squash only, `Closes #N` required — merging needs no human.
- The **Weekly Edition** automation (dag item `I2`) is created by Wave 4 — it is product, not orchestration.

## Consequences

- Every state transition is a git/GitHub event the dispatch workflow can observe — no external scheduler state.
- Stall modes (review ping-pong, flaky CI, brief ambiguity) are handled by the Supervisor's bounded ladder; the retry cap bounds spend.
- The only escalation channel is `needs-human` + an owner mention, after retries are exhausted (`HANDOFF.md`).
- Accepted risk: taste — no human looks at the design until v1 (`PLAN.md` §7.6). The Reviewer screenshot check and the I4 QA pass catch drift from the spec, not a wrong spec.
