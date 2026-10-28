# fixtures/2026-w44 — the reference edition

One hand-built edition exercising all 11 template pages in fixed order,
**using real public URLs** (real headlines/sources from the week of
Oct 24–30, 2026). No item was fetched by the pipeline — this is the
contract artifact consumed by tests, `/kitchen-sink`, and previews.

`edition.json` must always pass `pnpm schema:validate`. When the schema
changes (`packages/schema/edition.schema.json` → `pnpm schema:types`),
update this file so it keeps validating.
