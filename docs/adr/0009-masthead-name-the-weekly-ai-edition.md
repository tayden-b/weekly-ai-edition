# ADR-0009: Masthead name — "The Weekly AI Edition" as a config value

**Status:** Accepted (locked 2026-10-28 via DESIGN.md §7.2)

## Context

The product needs a name for the masthead, OG images, `/brand`, feeds, and the `.md` twin. There is no logo mark in v1 — the wordmark is the brand.

## Decision

- Masthead name: **THE WEEKLY AI EDITION** (working name), set in Inter Tight 700 uppercase — tracking +0.08em at nav size, −0.03em at cover hero size (`DESIGN.md` §1.2).
- The name is a **single config value (`site.name`)**, so a rename is one PR.
- Tagline: "One link a week. Everything that mattered in AI."

## Consequences

- Every surface (masthead, OG template, feeds, twins, `/brand`) reads the name from config — none may hardcode it.
- A rename touches no component code; it is a data change plus regenerated statics.
