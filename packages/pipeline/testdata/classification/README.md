# Labelled classification set

`labeled-items.json` is the ground truth for the `classify` stage (PLAN §5.2).
Each entry is a **real public item** — headline, publisher, URL, date — with the
page label and company tags a correct classifier should emit. P4's accuracy
harness loads this file; nothing else in the repo should depend on its length or
composition.

## Labels

The label set is the taxonomy itself (STYLE.md §8): the seven item-bearing
pages `models`, `performance`, `launches`, `funding`, `deals`, `markets`,
`discourse`, plus `unsorted`. The derived pages (`cover`, `briefing`,
`most_covered`, `back_page`) are never labels — they are built from classified
items, so they carry no ground truth here.

Every label appears at least 3× (enforced by `labeled-items.test.ts`). Current
distribution: models 14, performance 7, launches 8, funding 10, deals 6,
markets 5, discourse 10, unsorted 13 — **73 items**.

Each entry represents one source record. Production `discourse` items must
still aggregate ≥ 2 publishers per PLAN §5.3 — that gate applies to the
cluster, not to individual fixture entries.

## File format

```jsonc
{
  "version": 1,
  "labels": ["models", "…", "unsorted"],
  "items": [
    {
      "id": "models-001",              // unique, <label>-NNN convention
      "headline": "…",                 // the item's real headline/title
      "url": "…",                      // real public URL (https)
      "publisher": "…",                // publishing org, RawItem-style
      "published_at": "2025-08-07",    // publication date (ISO date)
      "excerpt": "…",                  // ≤ 300 chars, what an adapter would store
      "expect": {
        "page": "models",              // the expected page label
        "companies": ["openai"]        // expected company slugs ([] allowed)
      },
      "notes": "optional boundary note"// why the label is what it is
    }
  ]
}
```

The `expect` object is the only part the harness compares; the rest is what a
`RawItem` (C5) carries, so an entry maps mechanically onto a pipeline record:
`headline`, `canonical_url` ← `url`, `publisher`, `published_at`, `excerpt`.

## How P4 consumes it

1. Load `items`; for each entry build the classify request shape
   (`classification.request.json` in `prompts/classify.prompt.md`): `id`,
   `headline`, `publisher`, `canonical_url`, `published_at`, `excerpt`,
   `source_count: 1`, `publishers: [publisher]`.
2. Run the batch through the `llm()` seam in `session` mode (you produce the
   labels) and/or `replay` mode in CI.
3. Score: `page` accuracy must be ≥ 90% (P4 acceptance). Report a confusion
   table in the PR; items whose `notes` flag a boundary are the first place to
   look when a label disagrees.
4. `companies` is scored as a secondary metric — precision/recall on slugs,
   not part of the 90% gate.

## Company slugs

`expect.companies` are `config/companies.yaml` slugs (C5). The registry is
seeded with the AI basket + major labs; the union of slugs in this file is the
required coverage surface — if a slug here is missing from the registry, extend
`config/companies.yaml` (a small PR), do not relabel the item. Per PLAN §5.3,
an item whose substance is a company absent from the registry classifies to
`unsorted`; that rule applies at runtime, not to this fixture.

Slugs used in this file: `alibaba`, `amd`, `anthropic`, `anysphere`, `apple`,
`arm`, `asml`, `broadcom`, `cloudflare`, `cognition`, `coreweave`, `deepseek`,
`figure`, `framework`, `google`, `hugging-face`, `intel`, `meta`, `mistral`,
`moonshot`, `nike`, `nvidia`, `openai`, `oracle`, `perplexity`, `softbank`,
`spacex`, `tesla`, `thinking-machines`, `tsmc`, `vmware`, `windsurf`, `xai`.
The registry will of course also carry the remaining basket names (`microsoft`,
`amazon`) per PLAN §3.

## Integrity rules (tested)

- `items.length ≥ 50`; every label in `labels` appears ≥ 3×.
- `id` unique; `url` is a valid `https://` URL; `excerpt` ≤ 300 chars.
- `expect.page` ∈ `labels`; `expect.companies` is a string array.
- The set changes only by PR, together with a note in the PR body explaining
  any relabel.
