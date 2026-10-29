# Labelled extraction set

`extract-items.json` is the ground truth for the `extract` stage (PLAN §5.2,
P5). Each entry is a **real public item** — headline, publisher, URL, date,
stored excerpt — from `data/raw/2026-10-28`, grouped into the member set a
dedupe cluster would carry, plus the structured fields a correct extractor
should emit. P5's harness (`pnpm extract:harness`, `scripts/extract-harness.mts`)
loads this file; nothing else in the repo should depend on its length or
composition.

## Pages

Only the numeric-claim pages are labelled: `funding`, `deals`, `performance`,
`markets` — the pages P5 extracts on. Every entry's `page` is the
classification the cluster would already carry.

## File format

```jsonc
{
  "version": 1,
  "pages": ["funding", "…"],
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
      "expect": {
        "fields": { "amount": "$100M", "amount_usd": 100000000 },
        "methods": { "amount": "regex" },       // optional per-field method
        "evidence": { "lead_investor": { "source_index": 1 } },
        "missing": ["stage"]                    // fields expected to stay empty
      },
      "notes": "…"
    }
  ]
}
```

`expect.fields` are post-normalization values (`"$15B"`, `15000000000`,
`-2.1`). `expect.missing` fields must stay absent **and** carry a
`missing:<field>` flag — the provenance contract's "absent beats fabricated"
half. `expect.evidence` pins a field's `source_index` where the cluster has
more than one member.

## The hand-off recording

`extraction.request.json` + `extraction.prompt.md` are emitted by
`pnpm extract:harness` from this set. `extraction.response.json` is the
recorded model pass — a Devin session's answer to the rendered prompt,
committed as data (per HANDOFF.md: no external LLM APIs; the session is the
model). The same replay response drives `extract.test.ts`'s deterministic
end-to-end check. Treat it like the classification recording: it changes only
by PR, together with the prompt version and a note explaining the relabel.

## Integrity rules (tested)

- `items.length ≥ 10`; every page in `pages` appears ≥ 2×.
- `id` unique; every `url` is a valid `https://` URL; `excerpt` ≤ 300 chars.
- `page` ∈ `pages`; `expect.fields` only names real extract fields.
- The set changes only by PR, together with a note in the PR body explaining
  any relabel.
