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
    "id": "https://artificialanalysis.ai/articles/gemini-4-carbon-new-number-1",
    "page": "performance",
    "headline": "Gemini 4 Carbon is the new #1 on the Artificial Analysis Intelligence Index v5",
    "publisher": "Hacker News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Gemini 4 Carbon is the new #1 on the Artificial Analysis Intelligence Index v5"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://surgehq.ai/blog/dayjob-tax",
    "page": "performance",
    "headline": "Dayjob: Tax – evaluating AI agents on 50 professional tax assignments",
    "publisher": "Hacker News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Dayjob: Tax – evaluating AI agents on 50 professional tax assignments"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1021476/anthropic-s-1-compute-recursive",
    "page": "funding",
    "headline": "Anthropic’s business plan: Build God or die trying",
    "publisher": "The Verge",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "The Anthropic S-1 seems to have provided the financial justification for the company to spend as much as it possibly can on compute. If you are the kind of person who wonders if Anthropic is doing its level best to build a machine god while convincing Wall Street it's in the business of selling IT"
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
    "id": "http://www.businesswire.com/news/home/20261021024495/en/Xsolla-Acquires-GamePix-to-Build-a-Complete-Platform-for-Web-and-AI-Created-Video-Games?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "deals",
    "headline": "Xsolla Acquires GamePix to Build a Complete Platform for Web and AI-Created Video Games",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "LOS ANGELES--(BUSINESS WIRE)--Xsolla, a global commerce company, today announced it acquired GamePix, the web games platform that publishes and distributes browser games worldwide. GamePix brings a catalog of 10,000+ web titles, a community of 4,000+ developers, and a publishing solution that"
      }
    ],
    "extracted": {
      "target": {
        "value": "GamePix",
        "source_index": 0
      }
    },
    "missing_fields": [
      "acquirer",
      "amount"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261029104545/en/Opentrons-Announces-40M-Series-E-Round-to-Standardize-AI-Driven-Science-on-Its-Robots?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "Opentrons Announces $40M Series E Round to Standardize AI-Driven Science on Its Robots",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "LONG ISLAND CITY, N.Y.--(BUSINESS WIRE)--Opentrons Labworks Inc., the leader in open, AI-native laboratory automation, today announced a $40 million Series E financing led by healthcare investor Avego, with additional investment from BroadOak Capital Partners. Opentrons will use the capital to"
      }
    ],
    "extracted": {
      "amount": {
        "value": "$40M",
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
    "id": "http://www.businesswire.com/news/home/20261029417588/en/TrashLab-Raises-12M-to-Scale-the-AI-Native-Operating-System-for-Waste-Haulers?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "TrashLab Raises $12M to Scale the AI-Native Operating System for Waste Haulers",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--TrashLab, an AI-native operating system for waste haulers, today announced it has raised a $12 million growth round led by early-growth equity firm Ventana, with participation from existing investors Bienville Capital, Harlem Capital, and CreativeCo. TrashLab will"
      }
    ],
    "extracted": {
      "amount": {
        "value": "$12M",
        "source_index": 0
      },
      "stage": {
        "value": "Growth",
        "source_index": 0
      }
    },
    "missing_fields": [
      "lead_investor"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/29/deepgram-acquires-pipecat-maker-daily-to-bolster-its-voice-ai-infrastructure",
    "page": "deals",
    "headline": "Deepgram acquires Pipecat-maker Daily to bolster its voice AI infrastructure",
    "publisher": "TechCrunch",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Deepgram said that it is committed to keep Pipecat open source."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "acquirer",
      "target",
      "amount"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261029062593/en/Rockmont-Partners-backs-Veriv-as-verification-pioneers-join-its-board?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "Rockmont Partners backs Veriv as verification pioneers join its board",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "CHICAGO--(BUSINESS WIRE)-- #AI--Veriv, the financial verification network, today announced a new investment from Rockmont Partners and two additions to its board of directors: Brian Fox, who will serve as Board Chair, and Christopher Schellhorn, both industry veterans with experience scaling"
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
    "id": "https://www.bloomberg.com/news/articles/2026-10-29/anthropic-ipo-may-spark-ai-rally-as-short-bets-on-tech-pile-up",
    "page": "funding",
    "headline": "Anthropic IPO May Spark AI Rally as Short Bets on Tech Pile Up",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Wall Street’s recent risk aversion toward stocks may have created an opening for a sharp rebound, particularly in technology shares, if Anthropic PBC’s planned initial public offering reignites enthusiasm for artificial intelligence."
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
    "id": "https://www.bloomberg.com/news/articles/2026-10-29/microsoft-kicks-off-first-us-high-grade-bond-sale-since-2017",
    "page": "funding",
    "headline": "Microsoft Eyes at Least $25 Billion in First US Bond Since 2017",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Microsoft Corp. is looking to raise at least $25 billion from its first US investment-grade bond sale in more than nine years, joining rivals in a relentless borrowing spree to fund the artificial intelligence boom."
      }
    ],
    "extracted": {
      "amount": {
        "value": "$25B",
        "source_index": 0
      }
    },
    "missing_fields": [
      "stage",
      "lead_investor"
    ]
  },
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
    "id": "https://www.bloomberg.com/news/articles/2026-10-29/ai-assistant-startup-wabi-raises-55-million-at-1-25-billion-value",
    "page": "funding",
    "headline": "AI Assistant Startup Wabi Raises $55 Million at $1.25 Billion Value",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "AI assistant startup Wabi Inc. has raised $55 million at a $1.25 billion valuation to build out its software that lets groups of people interact with artificial intelligence agents to coordinate activities and make collective decisions."
      }
    ],
    "extracted": {
      "amount": {
        "value": "$55M",
        "source_index": 0
      }
    },
    "missing_fields": [
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028655033/en/FuriosaAI-Secures-620-Million-Series-D-to-Meet-Surging-Enterprise-AI-Inference-Demand-and-Accelerate-Next-Gen-Silicon?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "FuriosaAI Secures $620 Million Series D to Meet Surging Enterprise AI Inference Demand and Accelerate Next-Gen Silicon",
    "publisher": "Business Wire",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SEOUL, South Korea--(BUSINESS WIRE)-- #AI--AI inference chipmaker FuriosaAI announces a $620 million Series D at a $2.9 billion valuation."
      }
    ],
    "extracted": {
      "amount": {
        "value": "$620M",
        "source_index": 0
      },
      "stage": {
        "value": "Series D",
        "source_index": 0
      }
    },
    "missing_fields": [
      "lead_investor"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/furiosaai-quadruples-valuation-to-2-9-billion-in-nvidia-chase",
    "page": "funding",
    "headline": "FuriosaAI Quadruples Value to $2.9 Billion in Nvidia Chase",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "South Korean AI chip startup FuriosaAI quadrupled its valuation to $2.9 billion in a fresh funding round, bolstering its bid to challenge the likes of Nvidia Corp."
      }
    ],
    "extracted": {
      "amount": {
        "value": "$2.9B",
        "source_index": 0
      }
    },
    "missing_fields": [
      "stage",
      "lead_investor"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/microsoft-just-shared-azures-actual-revenue-in-dollars-33-2-billion",
    "page": "performance",
    "headline": "Microsoft just shared Azure’s actual revenue in dollars: $33.2 billion",
    "publisher": "TechCrunch",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Microsoft has never disclosed Azure's quarterly revenue in dollars. But for the first time, we can see just how close it is getting to besting the biggest competitor in the market, AWS."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/microsoft-recorded-10-billion-in-revenue-from-openai",
    "page": "performance",
    "headline": "Microsoft recorded $10 billion in revenue from OpenAI",
    "publisher": "TechCrunch",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Microsoft said it made $10 billion in revenue from commercial arrangements with OpenAI, including revenue-sharing payments, in the quarter ending September 30. It underscores the still-enormous financial dependency of the partnership."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/marvell-is-said-to-near-deal-for-lumentum-in-ai-related-megadeal",
    "page": "deals",
    "headline": "Marvell Is Said to Near Megadeal for Lumentum in AI Push",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Marvell Technology Inc. is in advanced talks to buy data center optics maker Lumentum Holdings Inc., according to people familiar with the matter, putting it on the cusp of a potential megadeal amid the race to scale up in the artificial intelligence sector."
      }
    ],
    "extracted": {
      "acquirer": {
        "value": "Inc. is in advanced talks",
        "source_index": 0
      }
    },
    "missing_fields": [
      "target",
      "amount"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/microsoft-reports-quarterly-cloud-sales-that-beat-estimates",
    "page": "performance",
    "headline": "Microsoft’s Surging Cloud Sales Show AI Spending Paying Off",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Microsoft Corp. posted increasing growth in its cloud business and kept its capital expenditures in check, satisfying investors amid a drumbeat of concern that spending on artificial intelligence won’t pay off."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/alphabet-reports-disappointing-revenue-income-shares-drop",
    "page": "performance",
    "headline": "Google Drops a Record 13% After Sales Miss Sparks AI Skepticism",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Alphabet Inc.’s shares fell more than 13%, for its biggest-ever market value wipeout, after the company reported disappointing search and advertising sales that reinforced investor concerns about AI’s threat to its core business."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/oracle-projects-30-billion-free-cash-flow-in-fiscal-2029",
    "page": "performance",
    "headline": "Oracle Jumps After Projecting Return to Positive Cash Flow",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Oracle Corp. shares jumped after the company gave a long-term outlook for free cash flow that eased investor nerves about the potential payoff from its artificial intelligence spending."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/anthropic-said-to-pick-jpmorgan-to-lead-ipo-video",
    "page": "funding",
    "headline": "Anthropic Weighs Offering 15%-20% of IPO to Retail Investors",
    "publisher": "Bloomberg",
    "sources": [
      {
        "source_index": 0,
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
        "source_index": 0
      }
    },
    "missing_fields": [
      "amount"
    ]
  },
  {
    "id": "https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5",
    "page": "performance",
    "headline": "Artificial Analysis Intelligence Index v5",
    "publisher": "Hacker News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Artificial Analysis Intelligence Index v5"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
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
      },
      {
        "source_index": 2,
        "publisher": "TechCrunch",
        "excerpt": "The announcement came alongside parent company Alphabet's third-quarter earnings report, which saw revenue grow 25% year over year to $127.6 billion."
      }
    ],
    "extracted": {
      "amount": {
        "value": "$127.6B",
        "source_index": 2
      }
    },
    "missing_fields": [
      "stage",
      "lead_investor"
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
    "id": "https://openai.com/index/openai-servicenow-partnership-expansion",
    "page": "deals",
    "headline": "OpenAI and ServiceNow expand partnership across enterprise workflows",
    "publisher": "OpenAI",
    "sources": [
      {
        "source_index": 0,
        "publisher": "OpenAI",
        "excerpt": "OpenAI and ServiceNow expand their partnership to bring OpenAI models and agents into ServiceNow and ServiceNow workflows into ChatGPT and Codex."
      }
    ],
    "extracted": {},
    "missing_fields": [
      "acquirer",
      "target",
      "amount"
    ]
  },
  {
    "id": "https://www.anthropic.com/news/expanding-partnership-gsa",
    "page": "deals",
    "headline": "Expanding Partnership Gsa",
    "publisher": "Anthropic",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Anthropic",
        "excerpt": "Expanding Partnership Gsa"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "acquirer",
      "target",
      "amount"
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
    "id": "https://exa.ai/library/markets/stock/AMD?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "AMD weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Exa Markets",
        "excerpt": "US:AMD — raw closing price series. 2026-10-23 USD 516.79. 2026-10-26 USD 531.28. 2026-10-27 USD 560.26."
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
    "id": "https://exa.ai/library/markets/stock/ARM?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "ARM weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
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
    "id": "https://exa.ai/library/markets/stock/NVDA?date=2026-10-27&from=2026-10-19&view=series",
    "page": "markets",
    "headline": "NVDA weekly closing series",
    "publisher": "Exa Markets",
    "sources": [
      {
        "source_index": 0,
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
    "id": "https://www.axios.com/2026/10/27/anthropic-ipo-meta-spacex-ai-deals",
    "page": "funding",
    "headline": "Anthropic IPO leads AI's $235 billion dealmaking blitz",
    "publisher": "Axios",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Axios",
        "excerpt": "Anthropic IPO leads AI's $235 billion dealmaking blitz"
      }
    ],
    "extracted": {
      "stage": {
        "value": "IPO",
        "source_index": 0
      },
      "amount": {
        "value": "$235B",
        "source_index": 0
      }
    },
    "missing_fields": [
      "lead_investor"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36405",
    "page": "performance",
    "headline": "kw-bench: Breaking Frontier Harnesses on Real-World Tasks",
    "publisher": "arXiv",
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Each new generation of frontier model pushes the edge of what is possible. Inside a harness -- a loop, a shell, a filesystem, the ability to write and run its own code -- a model can take on increasingly difficult work. A growing body of work treats the coding-agent harness as infrastructure for"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
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
    "id": "https://humansignal.com/taste-index",
    "page": "performance",
    "headline": "Show HN: Websites designed by 10 AI models, ranked by 4,500 human votes",
    "publisher": "Hacker News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Websites designed by 10 AI models, ranked by 4,500 human votes"
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Rocus: Browser local LLM that organizes your websites, notes and files"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
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
    "id": "https://www.theguardian.com/technology/2026/oct/28/google-alphabet-q3-earnings-report",
    "page": "performance",
    "headline": "Investors turn on Google owner Alphabet after profit miss, ad slowdown and high spending",
    "publisher": "The Guardian",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Investors turn on Google owner Alphabet after profit miss, ad slowdown and high spending"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
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
    "id": "https://www.theguardian.com/technology/2026/oct/28/microsoft-earnings",
    "page": "performance",
    "headline": "Microsoft posts $92.3bn quarterly revenue after offering buyouts to 60,000 employees",
    "publisher": "The Guardian",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Microsoft posts $92.3bn quarterly revenue after offering buyouts to 60,000 employees"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35671",
    "page": "performance",
    "headline": "Evaluating DeepSeek V4.1 Flash-1017 for loss of control and harmful manipulation risks",
    "publisher": "arXiv",
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "As frontier language models grow increasingly capable and autonomous, independent third-party evaluations are critical for characterizing their systemic safety risks. While closed-source releases are routinely accompanied by comprehensive system cards, open-weight models receive less scrutiny"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/28/technology/alphabet-earnings-google-ai.html",
    "page": "performance",
    "headline": "Alphabet’s Revenue Rises 25% as Profit Falls",
    "publisher": "The New York Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Alphabet’s Revenue Rises 25% as Profit Falls"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/28/technology/microsoft-earnings-ai.html",
    "page": "performance",
    "headline": "Microsoft’s Profit Jumps 32% Despite Big Increase in Spending",
    "publisher": "The New York Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Microsoft’s Profit Jumps 32% Despite Big Increase in Spending"
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
    "id": "https://www.ft.com/content/e9827543-51c9-451b-b180-e7e2276aa957",
    "page": "funding",
    "headline": "Mubadala Capital dealmaker to launch his own venture fund",
    "publisher": "Financial Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Mubadala Capital dealmaker to launch his own venture fund"
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
    "id": "https://www.ft.com/content/d144a865-285a-490e-be11-f924ada8cbc7",
    "page": "funding",
    "headline": "How much is Anthropic really worth?",
    "publisher": "Financial Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "How much is Anthropic really worth?"
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
    "id": "https://www.ft.com/content/0b7db9a1-8279-4025-8c2a-44a1010828f4",
    "page": "funding",
    "headline": "Anthropic, Meta and the K-shaped company",
    "publisher": "Financial Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Anthropic, Meta and the K-shaped company"
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
    "id": "https://www.theguardian.com/global/2026/oct/26/anthropic-accelerates-ai",
    "page": "funding",
    "headline": "Anthropic accelerates – for the rest of us, the speed of growth spells precarity",
    "publisher": "The Guardian",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Anthropic accelerates – for the rest of us, the speed of growth spells precarity"
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
    "id": "https://arxiv.org/abs/2610.34080",
    "page": "performance",
    "headline": "The LALA Benchmark: Evaluating Literary and Linguistic Analysis in LLMs",
    "publisher": "arXiv",
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "We introduce the Literature and Linguistics Analysis Benchmark (LALA), comprising 236 open-ended questions written by experts in linguistics and literary studies, together with expert-provided ideal answers. By comparing models within families and at similar training scales using human and LLM"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.ft.com/content/69a623e0-8605-4b1d-b147-770649efb53a",
    "page": "funding",
    "headline": "Anthropic’s constitutional order",
    "publisher": "Financial Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Anthropic’s constitutional order"
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
    "id": "https://www.ft.com/content/d1dca5d1-467f-4311-a004-82bb1ef761e0",
    "page": "funding",
    "headline": "Anthropic’s big financial reveal",
    "publisher": "Financial Times",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Anthropic’s big financial reveal"
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
    "id": "https://www.theguardian.com/technology/2026/oct/26/anthropic-stock-market-filing-takeaways",
    "page": "funding",
    "headline": "Four takeaways from Anthropic’s potentially record-breaking stock market filing",
    "publisher": "The Guardian",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Four takeaways from Anthropic’s potentially record-breaking stock market filing"
      },
      {
        "source_index": 1,
        "publisher": "The Guardian",
        "excerpt": "The AI company’s first public financial disclosures reveal explosive growth, huge costs and risks ranging from cyber-attacks to the limits of safeguards Anthropic has filed to go public on the US stock market, revealing for the first time the AI research lab’s financials and all the risks – more"
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
    "id": "https://arxiv.org/abs/2610.33949",
    "page": "performance",
    "headline": "Why Does Structured Output Fail? An Empirical Study of Prompt-Enforced Pydantic Schemas Across Nine LLMs",
    "publisher": "arXiv",
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Pipelines that require structured outputs from hosted language models often specify a Pydantic schema in the prompt, validate the response, and retry when validation fails. Although native structured-output modes provide an alternative, application-side validation remains important for enforcing"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/26/meta-plans-95bn-stock-offering-to-help-cover-ai-expansion",
    "page": "funding",
    "headline": "Meta plans $95bn stock offering to help cover AI expansion",
    "publisher": "The Guardian",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Tech firm announces two-part fundraising after Elon Musk warns hundreds of AI startups face collapse Mark Zuckerberg’s Meta has announced plans for $95bn (£71bn) of fundraising to cover its AI expenditure, even as Elon Musk warned that funding for smaller players in the sector was drying up. The"
      }
    ],
    "extracted": {
      "amount": {
        "value": "$95B",
        "source_index": 0
      }
    },
    "missing_fields": [
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
  },
  {
    "id": "https://news.ycombinator.com/item?id=50219762",
    "page": "performance",
    "headline": "Show HN: Benchmarks of continual learning model trained for a month on a laptop",
    "publisher": "Hacker News",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "A month ago, I shared mini-AGI, an experiment in training a byte-level, continually learning language model from scratch on a single 8 GB laptop GPU (an RTX 3070). To recap the setup briefly: it completely decouples model size from VRAM by paging experts to and from an NVMe drive (currently 397"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33509",
    "page": "performance",
    "headline": "Can Agentic Code Review Catch Vulnerabilities Before They Are Merged?",
    "publisher": "arXiv",
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "LLM agents have been increasingly adopted for security-focused code review, but existing benchmarks mostly derive the reviewed changes from their later fixes instead of the real-world bug-introducing commits. In this paper, we present SecPRBench, the first comprehensive benchmark for evaluating"
      }
    ],
    "extracted": {},
    "missing_fields": [
      "metric_name",
      "metric_value"
    ]
  }
]
