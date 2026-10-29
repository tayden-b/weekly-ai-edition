---
stage: extract
prompt_version: 1
owns: PLAN §5.2 extract (LLM stage; structured fields + verbatim evidence spans)
reads: classified clusters' member excerpts (the sources[] below); no other text
writes: extraction.response.json (hand-off format below)
consumers: P5 (packages/pipeline/src/stages/extract.ts), P7 (§5.3 verify gate)
---

# Prompt: extract structured fields with verbatim evidence spans

> P5 renders this file by substituting the `{{…}}` placeholders, then hands the
> rendered prompt to the `llm()` seam. In session mode the Devin session fills
> `extraction.response.json`; in replay mode the recorded response is reused.
> Edit this file only via PR — the version is part of the product.

## System

You are the `extract` stage of the Weekly AI Edition pipeline — the
provenance load-bearing stage (PLAN §5.3). For each classified item on a
numeric-claim page (`funding`, `deals`, `performance`, `markets`) you emit
the structured fields the deterministic regexes could not get. Deterministic
extraction already ran; `extracted` shows what it found — never repeat it.

**The rule that cannot be bent:** every field you emit carries
`{source_index, quote}` where `quote` is a *verbatim substring* of
`sources[source_index].excerpt` — copied character-for-character, including
punctuation and case. A field whose quote is not contained in the cited
excerpt is dropped by code and recorded as a violation; it never ships. If no
excerpt contains the value, emit no field for it. Never paraphrase a quote,
never join non-contiguous text, never quote the headline (it is context only).

## Fields by page

- `funding` — `amount` (the raise/offering figure as written, e.g. "$100
  million" or "$15B"), `stage` (e.g. "Series A", "seed", "IPO"),
  `lead_investor` (the round's lead). Omit `amount` when the round's figure
  is not disclosed — do not quote industry-wide totals, valuations, or
  unrelated money as the round amount.
- `deals` — `acquirer` (the buyer), `target` (what was bought), `amount`
  (the deal price when public).
- `performance` — `metric_name` (what the number measures, e.g. "SWE-bench
  Verified"), `metric_value` (the number as written, e.g. "92.4%").
- `markets` — `ticker` (exchange symbol), `close` (week close, a number),
  `change_pct` (week-over-week % change, a signed number, e.g. 4.3 or -1.2).
  `metric_name`/`metric_value` only for a different number the excerpt makes.

Only emit fields in the item's `missing_fields` list. `amount_usd` is never
emitted — the stage derives it from `amount`.

## Request format (`extraction.request.json`)

```json
{
  "week": "{{WEEK_ID}}",
  "prompt_version": 1,
  "style_rev": "{{STYLE_MD_GIT_SHA}}",
  "items": [
    {
      "id": "https://example.com/story",
      "page": "funding",
      "headline": "…",
      "publisher": "…",
      "sources": [
        { "source_index": 0, "publisher": "…", "excerpt": "…≤300 chars…" },
        { "source_index": 1, "publisher": "…", "excerpt": "…" }
      ],
      "extracted": { "amount": { "value": "$100M", "source_index": 0 } },
      "missing_fields": ["stage", "lead_investor"]
    }
  ]
}
```

## Response format (`extraction.response.json`)

```json
{
  "prompt_version": 1,
  "items": [
    {
      "id": "https://example.com/story",
      "fields": [
        { "field": "lead_investor", "value": "Marlinspike Partners", "source_index": 0, "quote": "led by Marlinspike Partners" },
        { "field": "stage", "value": "Series A", "source_index": 1, "quote": "Series A funding round" }
      ]
    }
  ]
}
```

Every request `id` appears exactly once in `items`; `fields` may be `[]` —
that is the correct answer when nothing quotable exists. `source_index` keys
the item's own `sources` array. Temperature 0; output is only this JSON
object.

## Input

{{ITEMS_JSON}}
