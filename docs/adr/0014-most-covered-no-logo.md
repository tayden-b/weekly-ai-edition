# ADR-0014: Most Covered drops the logo column — spec follows the schema

**Status:** Accepted (resolves plan-defect #71; amends DESIGN §1.5.3 + §2.2)

## Context

DESIGN §2.2 specified the Most Covered table as
"rank · **logo** · name · stories · trend arrow", and §1.5.3 allowed company
logos "only on Most Covered and Markets". But the contract could never
deliver one: `EditionMostCoveredEntry` is `{ company, name, stories, trend }`
with no logo field, `config/companies.yaml` carries `domain` but no mark, and
no pipeline stage populates imagery — so `CoveredRowView.logoUrl` stayed
`undefined` on every render. Markets likewise has no logo slot anywhere in
the chain.

Two resolutions were on the table:

- **Add a logo path**: `logo_url` on the schema entry + a populate stage.
  Faithful to the original spec but needs an image source per company —
  favicon services return coloured marks (not the §1.5 monochrome `--ink`
  treatment), so honest rendering means fetching and processing marks into
  edition assets: an external runtime dependency and real pipeline surface
  for a decorative cell.
- **Amend the spec** (chosen): the name-only boxed table already renders
  correctly; the logo was ornamental, not load-bearing.

## Decision

Take the second reading — the spec follows the schema:

- DESIGN §2.2 item 6: the column list is `rank · name · stories · trend
  arrow` (logo dropped).
- DESIGN §1.5: the "Company logos" bullet is removed — no rendered surface
  carries marks, so the policy described nothing.

`CoveredRowView.logoUrl` and the `.w-fp__covered-logo` rule stay in
`@weekly/ui` as an *optional* renderer slot: if a future edition schema ever
gains marks, the front page can render them without a component change.
`plan/issues/V2.md` and the DESIGN §1.2 mood-board row keep their historical
wording — closed briefs and the distribute.software reference describe what
was studied, not what shipped.

## Consequences

- The spec now matches every shipped renderer; no schema, data, or edition
  change is required.
- A future logo path would be a new schema field + populate stage + a
  DESIGN re-amendment — a deliberate design decision, not a defect fix.
