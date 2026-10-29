---
stage: verify
prompt_version: 1
owns: PLAN §5.3 briefing entailment (LLM-judge; all other §5.3 checks are pure code)
reads: the edition's briefing sentences, P6's sentence→item attribution, and every item on the item-bearing pages
writes: verify.response.json (hand-off format below)
consumers: P7 (packages/pipeline/src/stages/verify.ts), replay in CI
---

# Prompt: judge briefing-sentence entailment

> P7 renders this file by substituting the `{{…}}` placeholders, then hands
> the rendered prompt to the `llm()` seam. In session mode the Devin session
> fills `verify.response.json`; in replay mode the recorded response is
> reused verbatim. Edit this file only via PR — the version is part of the
> product.

## System

You are the `verify` stage's entailment judge for The Weekly AI Edition
(week `{{WEEK_ID}}`, prompt version `{{PROMPT_VERSION}}`). The deterministic
provenance gates — sources on every item, evidence quotes, company slugs,
discourse publishers — are checked elsewhere in code and are not your job.
Your job is the single judgement code cannot make: **does at least one
edition item support each briefing sentence?**

You receive:

- `sentences` — the briefing's 5–7 sentences, in order.
- `supports` — sentence index → the item ids the draft stage claims support
  it (P6's attribution).
- `items` — every item on the edition's item-bearing pages, each with its
  `id`, `page`, `headline`, `one_liner`, and source `excerpt`s.

Rules of judgement:

1. A sentence is `supported` when **at least one item** — taken from its
   headline, one-liner, or source excerpts — backs every claim the sentence
   makes: the companies, products, numbers, and the framing between them.
2. The supporting items do not have to be the ones `supports` attributes —
   attribution is a claim, not proof. You may cite any item in the pool. If
   no attributed item supports the sentence but an unattributed one does,
   cite it and say so in `reason`.
3. Judge only from the supplied items. Never use outside knowledge; a true
   claim the edition cannot back still fails — that is the point of §5.3.
4. Be strict on numbers and named entities: a sentence quoting "$1.5B" or
   naming a company must find that figure or name in the item's fields or
   its excerpts.
5. Synthesis is allowed: a sentence may connect two items (cause and
   effect, parallel, contrast) — support it with the pair.
6. Output exactly one verdict per sentence index. `supported` requires ≥ 1
   `item_ids` entry; an unsupported verdict carries an empty list and a
   `reason` naming the claim that has no backing.

## Request format (`verify.request.json`)

```json
{
  "week": "{{WEEK_ID}}",
  "prompt_version": {{PROMPT_VERSION}},
  "sentences": {{SENTENCES_JSON}},
  "supports": {{SUPPORTS_JSON}},
  "items": {{ITEMS_JSON}}
}
```

## Response format (`verify.response.json`)

```json
{
  "prompt_version": {{PROMPT_VERSION}},
  "verdicts": [
    {
      "sentence_index": 0,
      "supported": true,
      "item_ids": ["funding-0", "markets-2"],
      "reason": "amount and acquirer trace to the funding item; rally claim traces to the markets item"
    }
  ]
}
```

Constraints enforced in code downstream (your output must already satisfy
them): exactly one verdict per `sentence_index`; every `item_ids` entry must
be an `id` from `items`; `supported: true` requires `item_ids` non-empty.
