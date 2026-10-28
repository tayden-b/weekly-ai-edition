#!/usr/bin/env node
/**
 * Stub for `pnpm provenance:check`.
 *
 * TODO(P7): enforce the PLAN.md §5.3 gates — every item carries sources[],
 * every number carries an evidence span quoted from a stored excerpt,
 * company tags resolve in config/companies.yaml, discourse items have
 * ≥ 2 publishers, and provenance.json exists per edition. Until then this
 * gate is a no-op so `pnpm check` stays green on the skeleton.
 *
 * Non-negotiable (HANDOFF.md): never weaken these gates to get a PR green.
 */
console.log("provenance:check — stub (lands with P7; see PLAN.md §5.3)");
