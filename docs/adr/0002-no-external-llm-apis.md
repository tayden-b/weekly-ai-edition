# ADR-0002: No external LLM APIs — intelligence runs inside Devin sessions

**Status:** Accepted (locked 2026-10-28 via PLAN.md §8 + HANDOFF.md)

## Context

Pipeline stages `classify`, `extract`, `draft`, and briefing entailment checks are judgement work. The obvious implementation is an LLM API — but HANDOFF.md forbids secrets entirely, and the whole build is already running inside Devin sessions on the owner's subscription.

## Decision

- No LLM API keys anywhere. Deterministic pipeline stages (`ingest` → `rank`, plus `verify`/`validate`) are pure code.
- LLM-type stages are **performed by the Devin session itself**: the stage writes a structured request file, the session fills the response following `STYLE.md` and the versioned prompts in `packages/pipeline/prompts/`, and the stage consumes it. A `replay` implementation reads recorded responses so tests and CI stay deterministic.
- `packages/pipeline` exposes an `llm()` seam (typed interface only) so an API-backed implementation can be added post-v1 without touching stage code.

## Consequences

- Zero secrets; the weekly build IS a Devin automation session (PLAN §7.3 "Weekly Edition").
- CI can never call a live model — recorded responses are the contract for deterministic replay.
- Prompt quality is versioned in git (`prompts/`), making intelligence changes reviewable like code.
