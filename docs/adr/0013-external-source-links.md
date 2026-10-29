# ADR-0013: Every story links to its original source — same tab everywhere

**Status:** Accepted (implements the L1 link pass, issue #129)

## Context

Until now the rendered pages carried `sources[]` as text — the publisher
name was visible but nothing was clickable, so a reader (or an agent) could
not reach the original reporting from any renderer. Issue #129 requires
every headline and source line to link out, plus link-hygiene decisions
DESIGN.md does not pre-specify: which tab external links open in, and how a
multi-source cluster surfaces its evidence.

The alternatives were:

- **New tab on desktop, same tab on mobile** (`target="_blank"` only at the
  front-page breakpoint): mirrors newspaper convention but splits behaviour
  across renderers of the same document, needs a runtime breakpoint check
  for a semantic decision, and `target="_blank"` interrupts the deck's
  read-then-return flow.
- **Same tab everywhere:** one rule, one code path, honest reading flow —
  the site is a digest that cites sources; the reader's Back button is the
  return path. Small cost: leaving the site loses scroll position in the
  deck (the browser restores it).

## Decision

All external links — item headlines, cover headline/deck, source-line
publisher links, the `discussion` link, `.md` twin, feeds — open in the
**same tab**, on every renderer. No `target` attribute anywhere; every
external link carries `rel="noopener noreferrer"` defensively.

Supporting rules, now canonical:

- **Primary source** = the first `sources[]` entry whose URL host is not an
  aggregator (`news.ycombinator.com`, `reddit.com`, `distribute.software`);
  falls back to the first source. Rule lives once in
  `packages/schema/src/links.ts` (`primarySource`, `discussionUrl`) with a
  dependency-free mirror in `packages/ui/src/links.ts` — `@weekly/ui` takes
  no runtime dependencies by ADR-0001.
- **Publisher attribution** is fixed in the pipeline, not the renderer:
  `normalize` rewrites `publisher` from `config/publishers.yaml`'s
  domain→publisher map only when the recorded publisher is a configured
  aggregator and the canonical URL's host maps to a different origin; the
  recorded aggregator is kept on the source's optional `via` field
  (schema-compatible — `via` is optional). Renderer never rewrites names.
- **Source line** renders up to two distinct publisher links then a `+N`
  overflow, each linking to that source's URL; `via` shows only on the
  primary; an HN/Reddit discussion URL (from `source_ids` or an
  aggregator-host canonical URL) adds a trailing `· discussion` link.
- **Tap targets:** the deck pads each headline element and pulls the
  padding back with negative margins — ≥44px hit height without changing
  layout. Links never hijack paging: the deck's tap-zone already skips
  clicks on `a`/`button` and swipes are native scroll-snap gestures.
- **Styling** per DESIGN.md §1.4: links inherit ink (no colour change),
  hover fades an underline in over 120ms via `text-decoration-color`,
  `:focus-visible` gets a 2px ink outline — visible focus state.
- **CI:** rendered-markup tests fail if any item headline lacks an external
  `href`; a separate `scripts/check-links.mts` HEAD-checks every committed
  `sources[].url` inside the edition dry-run workflow only — unit CI stays
  network-free.

## Consequences

- Every headline, publisher name, feed item and `.md` twin entry is a
  working link to original reporting; aggregator credit is preserved as
  `via` rather than replacing attribution.
- Follow-up builds pick up `via` automatically for any newly recorded
  aggregator source; new domains extend `config/publishers.yaml`.
- A reader who opens a source mid-issue and hits Back lands where they
  left — scroll restoration is the browser's job, not a link target.
