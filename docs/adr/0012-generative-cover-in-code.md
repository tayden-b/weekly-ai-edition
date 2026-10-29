# ADR-0012: Generative cover in code — keyless, data-seeded

**Status:** Accepted (implements dag item `T3`; supersedes the deferred
image-API route of ADR-0005)

## Context

ADR-0005 deferred cover imagery because the assumed route was an external
image API — forbidden territory (secrets, keys). Issue #30 redefined T3 on
2026-10-29: **no external image model or key** — the cover is generated *in
code*, deterministically seeded by the week's data. The issue text is the
spec and, where it disagrees with ADR-0005, it wins:

- `cover.avif` at 4:5 + `cover-og.png` at 1200×630 (the OG spec) — not
  ADR-0005's `cover.jpg` 2000×2500 + 2400×1350;
- the issue-root OG image swaps to the cover card when it exists — not
  "OG images are unaffected";
- the typographic fallback (`w-cover__fallback`) remains mandatory and
  tested, consistent with ADR-0005's consequence #1.

## Decision

- **`packages/cover`** (new): `CoverArt` (inline React surface) +
  `renderCoverArt(edition) → {svg, avif, og}` behind the
  `@weekly/cover/render` subpath so the component never pulls sharp into
  the web graph.
- **Seed** = sha256 over a canonical digest: issue number + every item
  headline + per-page item counts + sorted company slugs + markets
  tickers. Any editorial change reseeds the art; same edition → same seed
  → byte-identical files (the `edition-dry-run` gate depends on it).
- **Three archetypes** (`field | orbit | ridge`, seedByte 0) over **six
  curated palettes** in `config/cover-palettes.json` — palettes live in
  config, never in code (the zero-hardcode gate scans sources). Only SVG
  `white`/`black` keywords are used outside palette colors.
- **Rasterization**: sharp `0.35.5` (exact pin — byte stability across
  hosts/runs). AVIF quality 55 at 2000×2500; OG PNG palette-encoded after
  a `median(3)` pass that folds the feTurbulence grain back into the
  fields (PNG cannot carry fine noise inside 200KB).
- **Serving**: `apps/web/src/app/editions/[...path]/route.ts` — a
  force-static handler whitelisting exactly `cover(-og).{svg,avif,png}`;
  the sibling LLM request/response files under `editions/<week>/` are
  never exposed.
- **`edition:build`** generates the assets, points `pages[0].image` at
  `editions/<week>/cover.avif`, and records
  `cover:{generator,seed,composition}` in `provenance.json`.
  `checkProvenance` re-derives the seed from the committed edition and
  requires block↔image consistency.

## Consequences

- Replays of `edition:build` rewrite identical bytes — required for the
  dry-run determinism gate; verified for w44 and w45.
- The site serves the **committed** rasters (`<img src>`), not the inline
  component; `CoverArt` exists for surfaces that want SVG without files.
- Adding a palette or archetype reweights all *future* weeks — committed
  art never changes.
- A future real-image pipeline is a new issue (explicitly out of scope).
