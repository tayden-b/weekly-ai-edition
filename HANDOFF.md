# HANDOFF — read this first

This repository is built end to end by Devin Cloud agents with no human in the loop until v1. The owner (Tayden Barretto) verified `PLAN.md` on 2026-10-28 and will not answer questions during the build. Every decision you need is in `PLAN.md` and `DESIGN.md`; where they are silent, take the narrowest sane reading, record it in an ADR under `docs/adr/`, and keep moving.

## How work flows

1. `plan/dag.yaml` lists every work item with dependencies (created by the Bootstrap item `B0` from `PLAN.md` §7.4).
2. Each item is a GitHub Issue. `status:blocked` → `devin:ready` is flipped by `.github/workflows/dispatch.yml` when all dependencies are closed.
3. Labelling an issue `devin:ready` starts a **Builder** session. Opening a PR from a `devin/*` branch starts a **Reviewer** session. A **Supervisor** session runs every 3 hours to unstick anything.
4. PRs merge by GitHub auto-merge once `ci` and `devin-review` pass. Merging closes the issue (`Closes #N`), which re-runs dispatch.
5. When the last item closes, dispatch opens `v1-complete`; the `S1` session publishes the first real edition and writes `plan/V1-REPORT.md`.

## Non-negotiables

- Model: all sessions run on `swe-2-max`.
- No secrets exist and none are needed. Do not add services that require keys. LLM-type work (classification, extraction, drafting, entailment) is performed by the Devin session itself (see `PLAN.md` §8), never by an external API.
- Deterministic provenance gates in CI are the spine of the product (`PLAN.md` §5.3). Never weaken them to get a PR green.
- Never republish article bodies; headline, link, ≤ 300-char excerpt, own summary only.
- Never widen an issue's scope. If a brief is wrong or incomplete, open an issue labelled `plan-defect` describing the fix, pick the narrowest reading, and finish.
- Design is `DESIGN.md`, verbatim. Tokens live in `packages/ui`; nobody hardcodes a colour or font size.
- Repo stays private until `S1` flips it public.

## Owner contact

Only the Supervisor may escalate, only by labelling an issue `needs-human`, and only after three retries. Escalations are delivered by automation email; do not look for other channels.
