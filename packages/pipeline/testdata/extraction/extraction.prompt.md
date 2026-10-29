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
  "week": "labeled-set",
  "prompt_version": 1,
  "style_rev": "25e18d610b9cbdca74cd2956c508c775737ad3de",
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

[
  {
    "id": "funding-002",
    "page": "funding",
    "headline": "Rocker Launches as the Context-Aware AI Work Assistant for the Busiest People at the World’s Most Ambitious Companies",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Rocker, the AI assistant for busiest people at the world’s most ambitious companies, today announced $12.85M in funding led by Greycroft, with participation from Anthropic and Menlo Ventures' Anthology Fund, Matchstick, Stripe, and operators Jeanne DeWitt Grosser"
      }
    ],
    "extracted": {
      "amount": {
        "value": "$12.85M",
        "source_index": 0
      },
      "lead_investor": {
        "value": "Greycroft",
        "source_index": 0
      }
    },
    "missing_fields": [
      "stage"
    ]
  },
  {
    "id": "funding-003",
    "page": "funding",
    "headline": "DeepSeek reportedly raises $15B days after US restrictions",
    "publisher": "TechCrunch",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "DeepSeek has reportedly raised $15 billion in one of China's largest funding rounds, just days after the U.S. ordered federal agencies to remove its technology over national security concerns."
      }
    ],
    "extracted": {
      "amount": {
        "value": "$15B",
        "source_index": 0
      }
    },
    "missing_fields": [
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "funding-004",
    "page": "funding",
    "headline": "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO",
    "publisher": "The New York Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO"
      },
      {
        "source_index": 1,
        "publisher": "Bloomberg",
        "excerpt": "Anthropic is weighing a retail offering of 15% to 20% of the shares available in the IPO, according to people familiar with the matter. Those sources say the company behind Claude has tapped JPMorgan Chase to lead the US retail offering. Bloomberg’s Ryan Gould discusses the plans with Ed Ludlow on"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      },
      "lead_investor": {
        "value": "JPMorgan Chase",
        "source_index": 1
      }
    },
    "missing_fields": [
      "amount"
    ]
  },
  {
    "id": "deals-002",
    "page": "deals",
    "headline": "Hummingbird Acquires Quantimon to Bring Machine Learning to AML Transaction Monitoring for FIs",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Hummingbird, the AI-powered orchestration platform for financial crime compliance, today announced the acquisition of Quantimon, the machine learning platform for AML risk detection. The acquisition deepens Hummingbird's investment in transaction monitoring, bringing"
      }
    ],
    "extracted": {
      "target": {
        "value": "Quantimon",
        "source_index": 0
      }
    },
    "missing_fields": [
      "acquirer",
      "amount"
    ]
  },
  {
    "id": "deals-003",
    "page": "deals",
    "headline": "CoStar Group to Acquire Vexcel, Adding the World’s Largest Survey Grade High-Resolution Aerial Imagery",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "ARLINGTON, Va.--(BUSINESS WIRE)--CoStar Group, Inc. (NASDAQ: CSGP), a leading global provider of online real estate marketplaces, information, analytics, and digital twins in the property markets, announced today that it has entered into a definitive agreement to acquire Vexcel Group, Inc."
      }
    ],
    "extracted": {
      "target": {
        "value": "Vexcel Group",
        "source_index": 0
      }
    },
    "missing_fields": [
      "acquirer",
      "amount"
    ]
  },
  {
    "id": "deals-004",
    "page": "deals",
    "headline": "Ridgeview Partners Completes Acquisition of Pinewood Technologies Group",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Ridgeview Partners LLC (“Ridgeview”), a growth-oriented technology private equity firm, today announced the completion of the acquisition of Pinewood Technologies Group plc (“Pinewood.AI”), a leading cloud-based, AI-first, full-service technology provider to"
      }
    ],
    "extracted": {
      "target": {
        "value": "Pinewood Technologies Group plc",
        "source_index": 0
      }
    },
    "missing_fields": [
      "acquirer",
      "amount"
    ]
  },
  {
    "id": "deals-005",
    "page": "deals",
    "headline": "TPG pursues $5bn acquisition of UK data centre group Ark",
    "publisher": "Financial Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "TPG pursues $5bn acquisition of UK data centre group Ark"
      }
    ],
    "extracted": {
      "amount": {
        "value": "$5B",
        "source_index": 0
      }
    },
    "missing_fields": [
      "acquirer",
      "target"
    ]
  },
  {
    "id": "performance-003",
    "page": "performance",
    "headline": "Anima helps clinics cut call waits by 75% with GPT-6 and GPT-Live",
    "publisher": "OpenAI",
    "sources": [
      {
        "source_index": 0,
        "publisher": "OpenAI",
        "excerpt": "Anima expands what care teams can do with OpenAI models, giving them more capacity to respond to patients."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "markets-001",
    "page": "markets",
    "headline": "NVIDIA weekly bars",
    "publisher": "Stooq",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Stooq",
        "excerpt": "NVIDIA (NVDA) week ending 2026-10-30: close 192.44, +4.3% vs prior weekly close 184.62 (Stooq weekly bars, i=w)."
      }
    ],
    "extracted": {
      "ticker": {
        "value": "NVDA",
        "source_index": 0
      },
      "close": {
        "value": 192.44,
        "source_index": 0
      },
      "change_pct": {
        "value": 4.3,
        "source_index": 0
      }
    },
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "markets-002",
    "page": "markets",
    "headline": "Meta Platforms weekly bars",
    "publisher": "Stooq",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Stooq",
        "excerpt": "Meta Platforms (META) week ending 2026-10-30: close 711.20, -2.1% vs prior weekly close 726.45 (Stooq weekly bars, i=w)."
      }
    ],
    "extracted": {
      "ticker": {
        "value": "META",
        "source_index": 0
      },
      "close": {
        "value": 711.2,
        "source_index": 0
      },
      "change_pct": {
        "value": -2.1,
        "source_index": 0
      }
    },
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  }
]
