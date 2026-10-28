# ADR-0007: Licence split — code MIT, content CC BY-NC

**Status:** Accepted (locked 2026-10-28 via PLAN.md §8)

## Context

The repo goes public at `S1`. Code and content want different reuse postures: the code should be maximally reusable (portfolio value), while the published editions are editorial work built on attributed third-party headlines that should not be commercially republished wholesale.

## Decision

- **Code: MIT.** Everything that is software — site, pipeline, schema, scripts, prompts.
- **Content: CC BY-NC**, with sources attributed. Everything that is the edition — `editions/*.json` content, briefing prose, one-liners, rendered pages.

## Consequences

- `LICENSE` (and any `LICENSE-*` files) must make the split unambiguous; the back-page colophon and `/brand` carry the notice.
- Attribution is structural, not boilerplate: every edition item already carries `publisher` + `url` (§5.3 schema gate), and the back page renders source counts.
- Non-commercial reuse of edition content is restricted by choice — accepted; code reuse stays frictionless.
