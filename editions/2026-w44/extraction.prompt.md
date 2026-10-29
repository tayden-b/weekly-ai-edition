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
  "week": "2026-w44",
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
    "id": "https://www.reuters.com/business/media-telecom/amazon-signs-1157-billion-deal-satellite-firm-globalstar-challenge-starlink-2026-04-14/1157-billion-deal-satellite-firm-globalstar-challenge-starlink-2026-04-14",
    "page": "deals",
    "headline": "Amazon to buy satellite firm Globalstar in $11.57B deal",
    "publisher": "Hacker News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Amazon to buy satellite firm Globalstar in $11.57B deal"
      }
    ],
    "extracted": {
      "acquirer": {
        "value": "Amazon",
        "source_index": 0
      },
      "amount": {
        "value": "$11.57B",
        "source_index": 0
      }
    },
    "missing_fields": [
      "target"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/doj-inquires-about-nvidia-s-hugging-face-deal-reuters-says",
    "page": "deals",
    "headline": "DOJ Inquires About Nvidia’s Hugging Face Deal, Reuters Says",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "The US Justice Department is making inquiries about Nvidia Corp.’s agreement to acquire AI model company Hugging Face for about $13 billion, part of broader regulatory scrutiny of the chip giant, Reuters reported."
      }
    ],
    "extracted": {
      "target": {
        "value": "AI model company Hugging Face",
        "source_index": 0
      },
      "amount": {
        "value": "$13B",
        "source_index": 0
      }
    },
    "missing_fields": [
      "acquirer"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028683272/en/IREN-and-Wingspire-Equipment-Finance-Complete-363-Million-Financing-for-High-Density-AI-Compute-Assets?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "IREN and Wingspire Equipment Finance Complete $363 Million Financing for High-Density AI Compute Assets",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "TUSTIN, Calif. & SYDNEY--(BUSINESS WIRE)--Wingspire Equipment Finance and IREN Limited (NASDAQ: IREN) (“IREN”) announced the closing of a $363 million equipment financing transaction supporting IREN’s AI compute business.The Equipment Finance Agreement refinanced recently acquired,"
      }
    ],
    "extracted": {
      "amount": {
        "value": "$363M",
        "source_index": 0
      }
    },
    "missing_fields": [
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.globenewswire.com/news-release/2026/10/28/3390266/0/en/rapidcanvas-acquires-entytle-to-bring-ai-driven-execution-to-the-industrial-aftermarket.html",
    "page": "deals",
    "headline": "RapidCanvas → Entytle",
    "publisher": "GlobeNewswire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "GlobeNewswire",
        "excerpt": "RapidCanvas, a managed AI execution company, today announced it has acquired Entytle, the company that pioneered the Autonomous Aftermarket for B2B OEMs. Financial terms were not disclosed."
      }
    ],
    "extracted": {
      "target": {
        "value": "Entytle",
        "source_index": 0
      }
    },
    "missing_fields": [
      "acquirer",
      "amount"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028117784/en/Hummingbird-Acquires-Quantimon-to-Bring-Machine-Learning-to-AML-Transaction-Monitoring-for-the-Agentic-Era?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "deals",
    "headline": "Hummingbird Acquires Quantimon to Bring Machine Learning to AML Transaction Monitoring for the Agentic Era",
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
    "id": "https://techcrunch.com/2026/10/27/vcs-will-make-billions-on-anthropics-ipo-but-amazon-is-set-to-make-much-much-more",
    "page": "funding",
    "headline": "VCs will make billions on Anthropic’s IPO, but Amazon is set to make much (much) more",
    "publisher": "TechCrunch",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Massive note conversions reveal the true extent of Amazon's ownership in Anthropic."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "amount",
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "https://cbcglobe.com/en/articles/2026/10/27/breaking-tesla-surges-4-and-amd-over-5-on-nyse-nvidia-and-mi-4ca4b69e",
    "page": "markets",
    "headline": "Markets weekly closing series",
    "publisher": "CBC Globe",
    "sources": [
      {
        "source_index": 0,
        "publisher": "CBC Globe",
        "excerpt": "AMD closed at $560.26, up $28.98 (5.45%) from the previous session. Meta closed at $620.19, down $10.37 (1.64%) from the previous session. Alphabet Class A finished trading at $320.58, up $3.78 (1.19%)."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "ticker",
      "close",
      "change_pct",
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/whos-really-in-charge-at-anthropic-after-the-ipo",
    "page": "funding",
    "headline": "Who’s really in charge at Anthropic after the IPO?",
    "publisher": "TechCrunch",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Here's a clear explanation of Anthropic's incredibly complex governance structure."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "amount",
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "https://openai.com/index/oracle-apps-in-chatgpt",
    "page": "funding",
    "headline": "Meet Anthropic’s Seven Founders as the A.I. Firm Prepares for an IPO",
    "publisher": "The New York Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Former OpenAI employees started the company in 2021 after disagreements over how to safely build artificial intelligence. An I.P.O. could make them billionaires."
      },
      {
        "source_index": 1,
        "publisher": "OpenAI",
        "excerpt": "OpenAI and Oracle are expanding their partnership to bring business applications and AI agents into ChatGPT and power new Oracle offerings."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "amount",
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027051586/en/Ridgeview-Partners-Completes-Acquisition-of-Pinewood-Technologies-Group?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
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
    "id": "http://www.businesswire.com/news/home/20261027636043/en/CoStar-Group-to-Acquire-Vexcel-Adding-the-World%E2%80%99s-Largest-Survey-Grade-High-Resolution-Aerial-Imagery-Program-to-Power-Richer-Search-and-Discovery-Across-CoStar-with-Tens-of-Billions-of-New-AI-Derived-Data-Fields?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "deals",
    "headline": "CoStar Group to Acquire Vexcel, Adding the World’s Largest Survey Grade High-Resolution Aerial Imagery Program to Power Richer Search and Discovery Across CoStar with Tens of Billions of New AI-Derived Data Fields",
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
    "id": "https://www.llmverifications.com/",
    "page": "performance",
    "headline": "Show HN: I found a more accurate upcoming LLM Benchmarks leaderboard",
    "publisher": "Hacker News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: I found a more accurate upcoming LLM Benchmarks leaderboard"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1019470/anthropic-ipo-resist-investor-pressure-cut-corners-safety",
    "page": "funding",
    "headline": "Anthropic’s elaborate plan to keep Wall Street at bay",
    "publisher": "The Verge",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Anthropic wants to have it both ways. With its impending IPO, it wants to tap the vast riches of the public markets and insists it doesn't want to compromise its core mission of developing AI safely and for the benefit of humanity. But greater model capabilities bring greater risks, and"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount",
      "lead_investor"
    ]
  },
  {
    "id": "https://microsoft.ai/news/mai-image-2-7-debut",
    "page": "performance",
    "headline": "MAI Image 2.7",
    "publisher": "Microsoft AI",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Microsoft AI",
        "excerpt": "MAI Image 2.7, our latest image editing model, launches with even stronger control for edits that are hardest to get right. It launches in preview at No. 3 on Arena Edit, making Microsoft AI the No. 2 lab, and No. 2 on Artificial Analysis's image editing leaderboard."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.businesswire.com/news/home/20261027228454/en/Innovation-X-Co-Leads-Tenstorrents-%241.5-Billion-Series-E-at-a-%246.2-Billion-Valuation",
    "page": "funding",
    "headline": "Tenstorrent raised $1.5B Series E",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "Innovation X, a late-stage venture capital firm investing in privately held technology leaders, today announced that it co-led Tenstorrent's $1.5 billion Series E financing at a $6.2 billion post-money valuation."
      }
    ],
    "extracted": {
      "amount": {
        "value": "$1.5B",
        "source_index": 0
      },
      "stage": {
        "value": "Series E",
        "source_index": 0
      }
    },
    "missing_fields": [
      "lead_investor"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/AMD?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "AMD weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Exa Markets",
        "excerpt": "US:AMD — raw closing price series. 2026-10-23 USD 516.79. 2026-10-26 USD 531.28. 2026-10-27 USD 560.26."
      },
      {
        "source_index": 1,
        "publisher": "Exa Markets",
        "excerpt": "US:ARM — raw closing price series. 2026-10-23 USD 210.33. 2026-10-26 USD 223.35. 2026-10-27 USD 226.60."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "ticker",
      "close",
      "change_pct",
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/AMZN?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "AMZN weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Exa Markets",
        "excerpt": "US:AMZN — raw closing price series. 2026-10-23 USD 248.00. 2026-10-26 USD 249.09. 2026-10-27 USD 253.10."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "ticker",
      "close",
      "change_pct",
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/GOOGL?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "GOOGL weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Exa Markets",
        "excerpt": "US:GOOGL — raw closing price series. 2026-10-23 USD 320.21. 2026-10-26 USD 316.80. 2026-10-27 USD 320.58."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "ticker",
      "close",
      "change_pct",
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/META?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "META weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Exa Markets",
        "excerpt": "US:META — raw closing price series. 2026-10-23 USD 642.62. 2026-10-26 USD 630.56. 2026-10-27 USD 620.19."
      },
      {
        "source_index": 1,
        "publisher": "Exa Markets",
        "excerpt": "US:NVDA — raw closing price series. 2026-10-23 USD 210.96. 2026-10-26 USD 216.00. 2026-10-27 USD 217.94."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "ticker",
      "close",
      "change_pct",
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/MSFT?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "MSFT weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Exa Markets",
        "excerpt": "US:MSFT — raw closing price series. 2026-10-23 USD 524.51. 2026-10-26 USD 532.60. 2026-10-27 USD 531.33."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "ticker",
      "close",
      "change_pct",
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/TSM?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "TSM weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Exa Markets",
        "excerpt": "US:TSM — raw closing price series. 2026-10-23 USD 418.51. 2026-10-26 USD 424.37. 2026-10-27 USD 436.87."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "ticker",
      "close",
      "change_pct",
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.prnewswire.com/news-releases/guidewire-signs-definitive-agreement-to-acquire-hyperexponential-302920513.html",
    "page": "deals",
    "headline": "Guidewire → hyperexponential",
    "publisher": "PR Newswire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "PR Newswire",
        "excerpt": "Guidewire announced today that it entered into a definitive agreement to acquire Hyperexponential Ltd for a base purchase price of $1.7 billion in cash, subject to adjustments, and up to an additional $400 million in contingent consideration."
      }
    ],
    "extracted": {
      "target": {
        "value": "Hyperexponential Ltd",
        "source_index": 0
      },
      "amount": {
        "value": "$1.7B",
        "source_index": 0
      }
    },
    "missing_fields": [
      "acquirer"
    ]
  },
  {
    "id": "https://openai.com/index/retell-ai",
    "page": "performance",
    "headline": "Retell uses OpenAI models to help power 100M monthly calls",
    "publisher": "OpenAI",
    "sources": [
      {
        "source_index": 0,
        "publisher": "OpenAI",
        "excerpt": "GPT-6 Astra tops Retell’s voice agent benchmark, while Codex helps it reach a $1.6M annual revenue run rate per employee."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.siliconreport.com/capital/archive/2026-10",
    "page": "funding",
    "headline": "General Compute raised $100M Series A",
    "publisher": "SiliconReport",
    "sources": [
      {
        "source_index": 0,
        "publisher": "SiliconReport",
        "excerpt": "Oct 27 General Compute raises $100 million Series A at $800 million valuation."
      }
    ],
    "extracted": {
      "amount": {
        "value": "$100M",
        "source_index": 0
      },
      "stage": {
        "value": "Series A",
        "source_index": 0
      }
    },
    "missing_fields": [
      "lead_investor"
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/26/anthropic-ipo-biggest-surprises",
    "page": "funding",
    "headline": "Inside Anthropic's massive — and wild — IPO prospectus",
    "publisher": "Axios",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Axios",
        "excerpt": "Inside Anthropic's massive — and wild — IPO prospectus"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount",
      "lead_investor"
    ]
  },
  {
    "id": "https://news.crunchbase.com/public/anthropic-ipo-filing-ai-earnings-growth-risks",
    "page": "funding",
    "headline": "Some Observations About Anthropic’s IPO Filing",
    "publisher": "Crunchbase News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Crunchbase News",
        "excerpt": "In an S-1 filing today preceding what could be the largest IPO ever, Anthropic laid out extensive new details about its earnings, growth, key stakeholders and the risks it faces going forward. Clocking in at 335 pages, the document wasn’t exactly light reading. However, in a preliminary once-over,"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.technologyreview.com/2026/10/26/1147672/will-the-real-anthropic-please-stand-up",
    "page": "funding",
    "headline": "Will the real Anthropic please stand up",
    "publisher": "MIT Technology Review",
    "sources": [
      {
        "source_index": 0,
        "publisher": "MIT Technology Review",
        "excerpt": "This story originally appeared in The Algorithm, our weekly newsletter on AI. To get stories like this in your inbox first, sign up here. After weeks of frenzied speculation, Anthropic has filed its IPO prospectus. The 335-page document (100 pages or so are focused on risks) lays out the company’s"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount",
      "lead_investor"
    ]
  },
  {
    "id": "https://twitter.com/FangcunLeap/status/2114719692137136245",
    "page": "performance",
    "headline": "Show HN: DeepSeek v4.1 Flash-1017 Safety Evaluation",
    "publisher": "Hacker News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: DeepSeek v4.1 Flash-1017 Safety Evaluation"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/26/anthropic-ipo-risk-factors-humanity",
    "page": "funding",
    "headline": "Anthropic's IPO outlines AI's extraordinary risks",
    "publisher": "Axios",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Axios",
        "excerpt": "Anthropic's IPO outlines AI's extraordinary risks"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/0001628280-26-067168-index.htm",
    "page": "funding",
    "headline": "S-1 — Anthropic, PBC",
    "publisher": "SEC EDGAR",
    "sources": [
      {
        "source_index": 0,
        "publisher": "SEC EDGAR",
        "excerpt": "S-1; filed by Anthropic, PBC"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "amount",
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.ft.com/content/e2aafede-771a-4fd0-b9fb-67c0bbb828ed",
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
    "id": "https://www.ft.com/content/24a35e41-2641-4cec-97f5-a974412f9952",
    "page": "funding",
    "headline": "Anthropic’s seven founders tighten grip ahead of blockbuster IPO",
    "publisher": "Financial Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Anthropic’s seven founders tighten grip ahead of blockbuster IPO"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.ft.com/content/65a113b4-2a45-49cf-9e68-93f42151166e",
    "page": "funding",
    "headline": "Ex-Merseyside police officer lands $400mn valuation for AI venture",
    "publisher": "Financial Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Ex-Merseyside police officer lands $400mn valuation for AI venture"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "amount",
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-ipo-s1-dario-amodei.html",
    "page": "funding",
    "headline": "Anthropic’s IPO S-1 Spells Out a Future of Promise and Peril",
    "publisher": "The New York Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "The A.I. company took great pains to describe the many benefits that can come from using its Claude chatbot and technology, but also offered up a heavy dose of gloom."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "amount",
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-business-key-numbers.html",
    "page": "funding",
    "headline": "The Key Numbers From Anthropic’s IPO Filing",
    "publisher": "The New York Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "The Key Numbers From Anthropic’s IPO Filing"
      },
      {
        "source_index": 1,
        "publisher": "The New York Times",
        "excerpt": "The Key Numbers From Anthropic’s IPO Filing"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-going-public-stakes.html",
    "page": "funding",
    "headline": "What’s Riding on Anthropic Going Public? Nearly Everything.",
    "publisher": "The New York Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Anthropic sits atop a pyramid of business partners and suppliers, making it a barometer of the broader economy. Its initial public offering will have widespread implications."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "amount",
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-ipo-finances.html",
    "page": "funding",
    "headline": "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO",
    "publisher": "The New York Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount",
      "lead_investor"
    ]
  }
]
