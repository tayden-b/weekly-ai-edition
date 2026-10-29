# Labelled draft set

`draft-items.json` is the ground truth for the `draft` stage (PLAN §5.2,
P6). Each entry reuses a **real public item** — the same headlines,
publishers, URLs, dates, and stored excerpts carried by the classification
and extraction labelled sets — grouped into the `ExtractedCluster` shape the
draft stage consumes: member set, classified page, tagged company slugs, and
the structured fields P5 would have admitted. P6's harness
(`pnpm draft:harness`, `scripts/draft-harness.mts`) loads this file; nothing
else in the repo should depend on its length or composition.

## Pages

The six item-bearing pages draft writes prose for — `models`,
`performance`, `launches`, `funding`, `deals`, `discourse` — each appear
≥ 2×. `markets` (a dataset page, no item cards) and `unsorted` each appear
once to prove the stage skips them.

## File format

```jsonc
{
  "version": 1,
  "pages": ["models", "…"],
  "items": [
    {
      "id": "funding-001",             // unique, <page>-NNN convention
      "page": "funding",
      "members": [                     // the cluster's items, source_index order
        {
          "headline": "…",
          "url": "…",                  // real public URL
          "publisher": "…",
          "published_at": "2026-10-28",
          "excerpt": "…"               // ≤ 300 chars, what an adapter stores
        }
      ],
      "companies": ["foundry-robotics"],   // classification.company_slugs
      "extracted": { "amount": "$100M" },  // fields P5 admitted
      "expect": {
        "headline": "Foundry Robotics raised $100M Series A led by Marlinspike Partners",
        "headline_pattern": "\\?$"         // discourse items
      },
      "notes": "…"
    }
  ]
}
```

`extracted` values are the post-normalization strings P5 emits (`"$15B"`,
`11500000000`). The harness wraps them as extraction fields whose evidence
cites `members[0].excerpt` — only fields P5 actually admitted belong here.
`expect.headline` pins the deterministic funding headline; `expect` itself
is optional — the STYLE.md rubric is the real assertion.

## The hand-off recording

`draft.request.json` + `draft.prompt.md` are emitted by
`pnpm draft:harness` from this set. `draft.response.json` is the recorded
model pass — a Devin session's answer to the rendered prompt, committed as
data (per HANDOFF.md: no external LLM APIs; the session is the model). The
same replay response drives `draft.test.ts`'s deterministic end-to-end check
and the rubric scorecard recorded in the PR. Treat it like the
classification/extraction recordings: it changes only by PR, together with
the prompt version and a note explaining the relabel.

## Integrity rules (tested)

- `items.length ≥ 10`; every page in `pages` appears ≥ 2× for drafted pages.
- `id` unique (`<page>-NNN`); every `url` is a valid `https://` URL;
  `excerpt` ≤ 300 chars.
- `page` ∈ `pages`; `companies` entries are registry slugs;
  `extracted` only names real extract fields with values in `members[0]`.
- Every `discourse` cluster has ≥ 2 members from ≥ 2 publishers (R8).
- The set changes only by PR, together with a note in the PR body explaining
  any relabel.
