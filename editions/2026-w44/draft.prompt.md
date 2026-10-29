---
stage: draft
prompt_version: 1
owns: PLAN §5.2 draft (LLM stage; one-liners + Briefing per STYLE.md)
reads: classified items for the week; STYLE.md (normative, attached in full)
writes: draft.response.json (hand-off format below)
consumers: P6 (packages/pipeline/src/stages/draft.ts), P7 (entailment check)
---

# Prompt: draft one-liners, takes, headlines, and the Briefing

> P6 renders this file by substituting the `{{…}}` placeholders, then hands the
> rendered prompt to the `llm()` seam. In session mode the Devin session fills
> `draft.response.json`; in replay mode the recorded response is reused. Edit
> this file only via PR — the version is part of the product.

## System

You are the `draft` stage of The Weekly AI Edition. You receive the week's
classified items (item-bearing pages only — `markets` is a dataset page and
`unsorted` never appears). You write the prose the reader sees: one
`one_liner` per item, an optional `take` (at most one per page), a `headline`
override where house style requires it, and the 5–7 sentence `briefing`.
STYLE.md is attached in full below and is the contract — follow it exactly;
this prompt never overrides it.

Hard constraints (enforced again in code, but your output must already
satisfy them):

1. Every `one_liner` ≤ 140 characters, exactly one sentence, ends with a
   period, what-it-is + why-it-matters, never a restatement of the item's
   `headline`. Plain text — no links, no markup, no emoji, no `!`.
2. `briefing.sentences` is 5–7 sentences: no links, no URLs, no page or
   section names; it synthesizes the week and leads with consequence.
3. Every company, product, number, and quoted fact you write appears
   verbatim in the supplied item `sources` excerpts or `extracted` fields.
   You may not use outside knowledge.
4. `discourse` items: you MUST supply `headline` — a question ending in `?`
   that frames both sides and gives no verdict.
5. `funding` items: do NOT supply `headline`. The stage generates it
   deterministically (`Company raised $Xm Stage led by Lead`, or
   "undisclosed") from `extracted` + `companies`; anything you send is
   dropped. Your `one_liner` may still carry valuation/context.
6. `take` is bare text (the renderer adds ` — ` and italics — do not write
   the markers), at most one per page, never on `discourse`, and never on an
   item whose take you cannot defend from the sources.
7. Every briefing sentence index MUST appear in `briefing.supports` mapped
   to ≥1 item id that supports it — P7's entailment gate fails otherwise.
8. No banned words or patterns from STYLE.md §7; no banned openings from §2;
   no second person.

## Request format (`draft.request.json`)

```json
{
  "week": "2026-w44",
  "prompt_version": 1,
  "style_rev": "25e18d610b9cbdca74cd2956c508c775737ad3de",
  "style_md": "<STYLE.md verbatim>",
  "items": [
    {
      "id": "cl-0001",
      "page": "models",
      "headline": "…",
      "publisher": "…",
      "published_at": "…",
      "companies": [{ "slug": "openai", "name": "OpenAI" }],
      "extracted": { "metric_value": "92.4%" },
      "sources": [{ "source_index": 0, "publisher": "…", "excerpt": "…" }]
    }
  ]
}
```

## Response format (`draft.response.json`)

```json
{
  "prompt_version": 1,
  "one_liners": [
    { "item_id": "cl-0001", "one_liner": "…", "take": null, "headline": null }
  ],
  "briefing": {
    "sentences": ["…", "…"],
    "supports": { "0": ["cl-0001", "cl-0007"], "1": ["cl-0012"] }
  }
}
```

Every request item id gets exactly one `one_liners` entry (`take`/`headline`
may be null or omitted). `supports` covers every briefing sentence index.
Output is only this JSON object.

## Items

[
  {
    "id": "https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon",
    "page": "models",
    "headline": "Gemini 4 Carbon",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T17:01:23.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      },
      {
        "slug": "google-deepmind",
        "name": "Google DeepMind"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Gemini 4 Carbon"
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "Gemini 4 Carbon"
      }
    ]
  },
  {
    "id": "https://artificialanalysis.ai/articles/gemini-4-carbon-new-number-1",
    "page": "performance",
    "headline": "Gemini 4 Carbon is the new #1 on the Artificial Analysis Intelligence Index v5",
    "publisher": "Hacker News",
    "published_at": "2026-10-29T12:41:56.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      }
    ],
    "extracted": {
      "metric_name": "Artificial Analysis Intelligence Index",
      "metric_value": "#1"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Gemini 4 Carbon is the new #1 on the Artificial Analysis Intelligence Index v5"
      }
    ]
  },
  {
    "id": "https://huggingface.co/blog/nvidia/nemotron-transcribe-granary",
    "page": "models",
    "headline": "NVIDIA Nemotron 3.5 Transcribe and Granary v2: Intelligent Multilingual Transcription You Can Prompt and Adapt",
    "publisher": "Hugging Face",
    "published_at": "2026-10-28T00:00:00.000Z",
    "companies": [
      {
        "slug": "nvidia",
        "name": "NVIDIA"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hugging Face",
        "excerpt": "NVIDIA Nemotron 3.5 Transcribe and Granary v2: Intelligent Multilingual Transcription You Can Prompt and Adapt"
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "Nvidia Nemotron 3.5 Transcribe: open ASR for 40 languages"
      }
    ]
  },
  {
    "id": "https://surgehq.ai/blog/dayjob-tax",
    "page": "performance",
    "headline": "Dayjob: Tax – evaluating AI agents on 50 professional tax assignments",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T15:46:30.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Dayjob: Tax – evaluating AI agents on 50 professional tax assignments"
      }
    ]
  },
  {
    "id": "https://www.reuters.com/business/media-telecom/us-agency-approves-amazon-leos-115-billion-acquisition-globalstar-2026-10-27",
    "page": "deals",
    "headline": "US agency approves Amazon Leo’s $11.5B acquisition of Globalstar",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T11:54:23.000Z",
    "companies": [
      {
        "slug": "amazon",
        "name": "Amazon"
      },
      {
        "slug": "globalstar",
        "name": "Globalstar"
      }
    ],
    "extracted": {
      "acquirer": "Amazon Leo",
      "target": "Globalstar",
      "amount": "$11.5B",
      "amount_usd": 11500000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "US agency approves Amazon Leo’s $11.5B acquisition of Globalstar"
      }
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1021476/anthropic-s-1-compute-recursive",
    "page": "funding",
    "headline": "Anthropic’s business plan: Build God or die trying",
    "publisher": "The Verge",
    "published_at": "2026-10-29T13:30:00.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "S-1"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "The Anthropic S-1 seems to have provided the financial justification for the company to spend as much as it possibly can on compute. If you are the kind of person who wonders if Anthropic is doing its level best to build a machine god while convincing Wall Street it's in the business of selling IT"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261021024495/en/Xsolla-Acquires-GamePix-to-Build-a-Complete-Platform-for-Web-and-AI-Created-Video-Games?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "deals",
    "headline": "Xsolla Acquires GamePix to Build a Complete Platform for Web and AI-Created Video Games",
    "publisher": "Business Wire",
    "published_at": "2026-10-29T13:00:00.000Z",
    "companies": [
      {
        "slug": "xsolla",
        "name": "Xsolla"
      }
    ],
    "extracted": {
      "target": "GamePix",
      "acquirer": "Xsolla"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "LOS ANGELES--(BUSINESS WIRE)--Xsolla, a global commerce company, today announced it acquired GamePix, the web games platform that publishes and distributes browser games worldwide. GamePix brings a catalog of 10,000+ web titles, a community of 4,000+ developers, and a publishing solution that"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261029104545/en/Opentrons-Announces-40M-Series-E-Round-to-Standardize-AI-Driven-Science-on-Its-Robots?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "Opentrons Announces $40M Series E Round to Standardize AI-Driven Science on Its Robots",
    "publisher": "Business Wire",
    "published_at": "2026-10-29T13:00:00.000Z",
    "companies": [
      {
        "slug": "opentrons",
        "name": "Opentrons"
      }
    ],
    "extracted": {
      "amount": "$40M",
      "stage": "Series E",
      "amount_usd": 40000000,
      "lead_investor": "Avego"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "LONG ISLAND CITY, N.Y.--(BUSINESS WIRE)--Opentrons Labworks Inc., the leader in open, AI-native laboratory automation, today announced a $40 million Series E financing led by healthcare investor Avego, with additional investment from BroadOak Capital Partners. Opentrons will use the capital to"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261029417588/en/TrashLab-Raises-12M-to-Scale-the-AI-Native-Operating-System-for-Waste-Haulers?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "TrashLab Raises $12M to Scale the AI-Native Operating System for Waste Haulers",
    "publisher": "Business Wire",
    "published_at": "2026-10-29T13:00:00.000Z",
    "companies": [
      {
        "slug": "trashlab",
        "name": "TrashLab"
      }
    ],
    "extracted": {
      "amount": "$12M",
      "stage": "Growth",
      "amount_usd": 12000000,
      "lead_investor": "Ventana"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--TrashLab, an AI-native operating system for waste haulers, today announced it has raised a $12 million growth round led by early-growth equity firm Ventana, with participation from existing investors Bienville Capital, Harlem Capital, and CreativeCo. TrashLab will"
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/29/amazon-updates-alexa-to-help-you-manage-shopping-lists-subscriptions-and-update-delivery-instructions",
    "page": "launches",
    "headline": "Amazon updates Alexa to help you manage shopping lists, subscriptions, and update delivery instructions",
    "publisher": "TechCrunch",
    "published_at": "2026-10-29T13:00:00.000Z",
    "companies": [
      {
        "slug": "amazon",
        "name": "Amazon"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "The update allows you to use Alexa to create lists, register them, see what's on them, and add or edit items. You can also manage subscriptions with the AI bot."
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/29/deepgram-acquires-pipecat-maker-daily-to-bolster-its-voice-ai-infrastructure",
    "page": "deals",
    "headline": "Deepgram acquires Pipecat-maker Daily to bolster its voice AI infrastructure",
    "publisher": "TechCrunch",
    "published_at": "2026-10-29T13:00:00.000Z",
    "companies": [
      {
        "slug": "daily",
        "name": "Daily"
      },
      {
        "slug": "deepgram",
        "name": "Deepgram"
      }
    ],
    "extracted": {
      "acquirer": "Deepgram",
      "target": "Pipecat"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Deepgram said that it is committed to keep Pipecat open source."
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261029062593/en/Rockmont-Partners-backs-Veriv-as-verification-pioneers-join-its-board?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "Rockmont Partners backs Veriv as verification pioneers join its board",
    "publisher": "Business Wire",
    "published_at": "2026-10-29T12:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "CHICAGO--(BUSINESS WIRE)-- #AI--Veriv, the financial verification network, today announced a new investment from Rockmont Partners and two additions to its board of directors: Brian Fox, who will serve as Board Chair, and Christopher Schellhorn, both industry veterans with experience scaling"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261029969930/en/Solink-Raises-More-Than-100-Million-in-New-Funding-to-Bring-its-AI-Vision-Intelligence-to-Physical-Business-Operations-Around-the-World?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "Solink Raises More Than $100 Million in New Funding to Bring its AI Vision Intelligence to Physical Business Operations Around the World",
    "publisher": "Business Wire",
    "published_at": "2026-10-29T12:00:00.000Z",
    "companies": [
      {
        "slug": "solink",
        "name": "Solink"
      }
    ],
    "extracted": {
      "amount": "$100M",
      "lead_investor": "Vertu Capital",
      "stage": "Growth",
      "amount_usd": 100000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "OTTAWA, Ontario--(BUSINESS WIRE)--Solink®, a leader in AI Vision Intelligence, today announced more than $100 million in new funding led by Vertu Capital, with material participation from existing investor Growth Equity at Goldman Sachs Alternatives and participation from new investors, Golub"
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-29/anthropic-ipo-may-spark-ai-rally-as-short-bets-on-tech-pile-up",
    "page": "funding",
    "headline": "Anthropic IPO May Spark AI Rally as Short Bets on Tech Pile Up",
    "publisher": "Bloomberg",
    "published_at": "2026-10-29T11:52:40.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Wall Street’s recent risk aversion toward stocks may have created an opening for a sharp rebound, particularly in technology shares, if Anthropic PBC’s planned initial public offering reignites enthusiasm for artificial intelligence."
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-29/microsoft-kicks-off-first-us-high-grade-bond-sale-since-2017",
    "page": "funding",
    "headline": "Microsoft Eyes at Least $25 Billion in First US Bond Since 2017",
    "publisher": "Bloomberg",
    "published_at": "2026-10-29T11:47:22.000Z",
    "companies": [
      {
        "slug": "microsoft",
        "name": "Microsoft"
      }
    ],
    "extracted": {
      "amount": "$25B",
      "amount_usd": 25000000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Microsoft Corp. is looking to raise at least $25 billion from its first US investment-grade bond sale in more than nine years, joining rivals in a relentless borrowing spree to fund the artificial intelligence boom."
      }
    ]
  },
  {
    "id": "https://www.reuters.com/business/media-telecom/amazon-signs-1157-billion-deal-satellite-firm-globalstar-challenge-starlink-2026-04-14/1157-billion-deal-satellite-firm-globalstar-challenge-starlink-2026-04-14",
    "page": "deals",
    "headline": "Amazon to buy satellite firm Globalstar in $11.57B deal",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T11:54:23.000Z",
    "companies": [
      {
        "slug": "amazon",
        "name": "Amazon"
      },
      {
        "slug": "globalstar",
        "name": "Globalstar"
      }
    ],
    "extracted": {
      "acquirer": "Amazon",
      "amount": "$11.57B",
      "amount_usd": 11570000000,
      "target": "Globalstar"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Amazon to buy satellite firm Globalstar in $11.57B deal"
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-29/ai-assistant-startup-wabi-raises-55-million-at-1-25-billion-value",
    "page": "funding",
    "headline": "AI Assistant Startup Wabi Raises $55 Million at $1.25 Billion Value",
    "publisher": "Bloomberg",
    "published_at": "2026-10-29T11:00:00.000Z",
    "companies": [
      {
        "slug": "wabi",
        "name": "Wabi"
      }
    ],
    "extracted": {
      "amount": "$55M",
      "amount_usd": 55000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "AI assistant startup Wabi Inc. has raised $55 million at a $1.25 billion valuation to build out its software that lets groups of people interact with artificial intelligence agents to coordinate activities and make collective decisions."
      }
    ]
  },
  {
    "id": "https://cursor.com/blog/agent-sdk",
    "page": "launches",
    "headline": "The Agent SDK",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T14:02:20.000Z",
    "companies": [
      {
        "slug": "anysphere",
        "name": "Anysphere (Cursor)"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "The Agent SDK"
      }
    ]
  },
  {
    "id": "https://github.com/trytilde/tilde",
    "page": "discourse",
    "headline": "Parents sue OpenAI, alleging GPT-4o coached their daughter off seizure medication",
    "publisher": "TechCrunch",
    "published_at": "2026-10-27T23:34:27.000Z",
    "companies": [
      {
        "slug": "openai",
        "name": "OpenAI"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "A family is suing OpenAI, saying ChatGPT coached their daughter to quietly taper off her seizure medication and keep it from her doctors before she died in February."
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "Show HN: ~, An open-source agent registry"
      }
    ]
  },
  {
    "id": "https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation",
    "page": "models",
    "headline": "Genie 4: A new generation of world simulation",
    "publisher": "Google DeepMind",
    "published_at": "2026-10-27T00:00:00.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      },
      {
        "slug": "google-deepmind",
        "name": "Google DeepMind"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Google DeepMind",
        "excerpt": "Genie 4: our new world model unlocking unprecedented realism in real-time simulation."
      },
      {
        "source_index": 1,
        "publisher": "Google DeepMind",
        "excerpt": "Genie 4: A new generation of world simulation"
      }
    ]
  },
  {
    "id": "https://huggingface.co/blog/anydecisionmodel",
    "page": "models",
    "headline": "Introducing AnySpeechRecognizer and AnyDecisionModel: Open Models for Speech and Decisions on Apple Platforms",
    "publisher": "Hugging Face",
    "published_at": "2026-10-29T00:00:00.000Z",
    "companies": [
      {
        "slug": "apple",
        "name": "Apple"
      },
      {
        "slug": "hugging-face",
        "name": "Hugging Face"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hugging Face",
        "excerpt": "Introducing AnySpeechRecognizer and AnyDecisionModel: Open Models for Speech and Decisions on Apple Platforms"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028655033/en/FuriosaAI-Secures-620-Million-Series-D-to-Meet-Surging-Enterprise-AI-Inference-Demand-and-Accelerate-Next-Gen-Silicon?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "FuriosaAI Secures $620 Million Series D to Meet Surging Enterprise AI Inference Demand and Accelerate Next-Gen Silicon",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T23:57:00.000Z",
    "companies": [
      {
        "slug": "furiosaai",
        "name": "FuriosaAI"
      }
    ],
    "extracted": {
      "amount": "$620M",
      "stage": "Series D",
      "amount_usd": 620000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SEOUL, South Korea--(BUSINESS WIRE)-- #AI--AI inference chipmaker FuriosaAI announces a $620 million Series D at a $2.9 billion valuation."
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/furiosaai-quadruples-valuation-to-2-9-billion-in-nvidia-chase",
    "page": "funding",
    "headline": "FuriosaAI Quadruples Value to $2.9 Billion in Nvidia Chase",
    "publisher": "Bloomberg",
    "published_at": "2026-10-28T23:00:00.000Z",
    "companies": [
      {
        "slug": "furiosaai",
        "name": "FuriosaAI"
      }
    ],
    "extracted": {
      "amount": "$2.9B",
      "amount_usd": 2900000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "South Korean AI chip startup FuriosaAI quadrupled its valuation to $2.9 billion in a fresh funding round, bolstering its bid to challenge the likes of Nvidia Corp."
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/microsoft-just-shared-azures-actual-revenue-in-dollars-33-2-billion",
    "page": "performance",
    "headline": "Microsoft just shared Azure’s actual revenue in dollars: $33.2 billion",
    "publisher": "TechCrunch",
    "published_at": "2026-10-28T21:58:32.000Z",
    "companies": [],
    "extracted": {
      "metric_name": "Azure's quarterly revenue"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Microsoft has never disclosed Azure's quarterly revenue in dollars. But for the first time, we can see just how close it is getting to besting the biggest competitor in the market, AWS."
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/microsoft-recorded-10-billion-in-revenue-from-openai",
    "page": "performance",
    "headline": "Microsoft recorded $10 billion in revenue from OpenAI",
    "publisher": "TechCrunch",
    "published_at": "2026-10-28T21:34:30.000Z",
    "companies": [],
    "extracted": {
      "metric_name": "revenue from commercial arrangements with OpenAI",
      "metric_value": "$10 billion"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Microsoft said it made $10 billion in revenue from commercial arrangements with OpenAI, including revenue-sharing payments, in the quarter ending September 30. It underscores the still-enormous financial dependency of the partnership."
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/marvell-is-said-to-near-deal-for-lumentum-in-ai-related-megadeal",
    "page": "deals",
    "headline": "Marvell Is Said to Near Megadeal for Lumentum in AI Push",
    "publisher": "Bloomberg",
    "published_at": "2026-10-28T21:05:20.000Z",
    "companies": [
      {
        "slug": "lumentum",
        "name": "Lumentum Holdings"
      },
      {
        "slug": "marvell",
        "name": "Marvell Technology"
      }
    ],
    "extracted": {
      "acquirer": "Inc. is in advanced talks",
      "target": "Lumentum Holdings Inc"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Marvell Technology Inc. is in advanced talks to buy data center optics maker Lumentum Holdings Inc., according to people familiar with the matter, putting it on the cusp of a potential megadeal amid the race to scale up in the artificial intelligence sector."
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/microsoft-reports-quarterly-cloud-sales-that-beat-estimates",
    "page": "performance",
    "headline": "Microsoft’s Surging Cloud Sales Show AI Spending Paying Off",
    "publisher": "Bloomberg",
    "published_at": "2026-10-28T20:08:01.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Microsoft Corp. posted increasing growth in its cloud business and kept its capital expenditures in check, satisfying investors amid a drumbeat of concern that spending on artificial intelligence won’t pay off."
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/alphabet-reports-disappointing-revenue-income-shares-drop",
    "page": "performance",
    "headline": "Google Drops a Record 13% After Sales Miss Sparks AI Skepticism",
    "publisher": "Bloomberg",
    "published_at": "2026-10-28T20:06:48.000Z",
    "companies": [],
    "extracted": {
      "metric_name": "Alphabet Inc.’s shares",
      "metric_value": "13%"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Alphabet Inc.’s shares fell more than 13%, for its biggest-ever market value wipeout, after the company reported disappointing search and advertising sales that reinforced investor concerns about AI’s threat to its core business."
      }
    ]
  },
  {
    "id": "https://www.theverge.com/tech/1021339/google-gemini-4-carbon-cybersecurity-frontier",
    "page": "models",
    "headline": "Google launches Gemini 4 Carbon with a ‘significant leap’ in cybersecurity",
    "publisher": "The Verge",
    "published_at": "2026-10-28T20:03:00.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      },
      {
        "slug": "google-deepmind",
        "name": "Google DeepMind"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Google has released its latest frontier model, Gemini 4 Carbon, offering \"significant gains\" in coding, agentic tasks, and cybersecurity. In an announcement on Wednesday, Google highlights Carbon's top spot on the Artificial Analysis Intelligence Index (v5.0) benchmark, with Claude Opus 5.5 and"
      }
    ]
  },
  {
    "id": "https://arstechnica.com/ai/2026/10/google-announces-gemini-4-carbon-its-latest-frontier-ai-model-that-you-cant-use",
    "page": "models",
    "headline": "Google announces Gemini 4 Carbon, its latest frontier AI model that you can't use",
    "publisher": "Ars Technica",
    "published_at": "2026-10-28T18:47:27.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      },
      {
        "slug": "google-deepmind",
        "name": "Google DeepMind"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Ars Technica",
        "excerpt": "Gemini 4 Carbon is essentially a slightly better version of Argon."
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/oracle-projects-30-billion-free-cash-flow-in-fiscal-2029",
    "page": "performance",
    "headline": "Oracle Jumps After Projecting Return to Positive Cash Flow",
    "publisher": "Bloomberg",
    "published_at": "2026-10-28T18:34:57.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Oracle Corp. shares jumped after the company gave a long-term outlook for free cash flow that eased investor nerves about the potential payoff from its artificial intelligence spending."
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/anthropic-said-to-pick-jpmorgan-to-lead-ipo-video",
    "page": "funding",
    "headline": "Anthropic Weighs Offering 15%-20% of IPO to Retail Investors",
    "publisher": "Bloomberg",
    "published_at": "2026-10-28T17:44:28.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO",
      "lead_investor": "JPMorgan Chase"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Anthropic is weighing a retail offering of 15% to 20% of the shares available in the IPO, according to people familiar with the matter. Those sources say the company behind Claude has tapped JPMorgan Chase to lead the US retail offering. Bloomberg’s Ryan Gould discusses the plans with Ed Ludlow on"
      }
    ]
  },
  {
    "id": "https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5",
    "page": "performance",
    "headline": "Artificial Analysis Intelligence Index v5",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T03:06:22.000Z",
    "companies": [],
    "extracted": {
      "metric_name": "Artificial Analysis Intelligence Index"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Artificial Analysis Intelligence Index v5"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028508802/en/Foundry-Robotics-Raises-100-Million-Series-A-to-Build-America%E2%80%99s-First-Autonomous-Factory-for-Assembly?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "Foundry Robotics Raises $100 Million Series A to Build America’s First Autonomous Factory for Assembly",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T15:00:00.000Z",
    "companies": [
      {
        "slug": "foundry-robotics",
        "name": "Foundry Robotics"
      }
    ],
    "extracted": {
      "amount": "$100M",
      "stage": "Series A",
      "lead_investor": "Marlinspike Partners",
      "amount_usd": 100000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "EMERYVILLE, Calif.--(BUSINESS WIRE)--Foundry Robotics today announced its oversubscribed $100 million Series A funding round led by Marlinspike Partners. Participating in the round are early backers Khosla Ventures and Red Glass Ventures, and new investors SE Ventures, Wing VC, and Axiom Ventures,"
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/voice-ai-in-vogue-nvidia-releases-new-open-transcription-model",
    "page": "models",
    "headline": "Voice AI in vogue: Nvidia releases new open transcription model",
    "publisher": "TechCrunch",
    "published_at": "2026-10-28T15:00:00.000Z",
    "companies": [
      {
        "slug": "nvidia",
        "name": "NVIDIA"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Nvidia just released a free speech-to-text model that can transcribe up to 40 languages, but it only works on recordings, not live audio, so it’s a big step for meeting and medical transcription tools while still leaving real-time use to rivals like ElevenLabs."
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028683272/en/IREN-and-Wingspire-Equipment-Finance-Complete-363-Million-Financing-for-High-Density-AI-Compute-Assets?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "IREN and Wingspire Equipment Finance Complete $363 Million Financing for High-Density AI Compute Assets",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T13:17:00.000Z",
    "companies": [
      {
        "slug": "iren",
        "name": "IREN"
      }
    ],
    "extracted": {
      "amount": "$363M",
      "amount_usd": 363000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "TUSTIN, Calif. & SYDNEY--(BUSINESS WIRE)--Wingspire Equipment Finance and IREN Limited (NASDAQ: IREN) (“IREN”) announced the closing of a $363 million equipment financing transaction supporting IREN’s AI compute business.The Equipment Finance Agreement refinanced recently acquired,"
      }
    ]
  },
  {
    "id": "https://www.theguardian.com/uk-news/2026/oct/27/uk-government-environmental-groups-ai-datacentres-expansion-plans-investigation",
    "page": "discourse",
    "headline": "UK government met 137 businesses over AI datacentres – but no environmental groups",
    "publisher": "The Guardian",
    "published_at": "2026-10-27T07:00:04.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "UK government met 137 businesses over AI datacentres – but no environmental groups"
      },
      {
        "source_index": 1,
        "publisher": "The Guardian",
        "excerpt": "Investigation finds dozens of ministers and civil servants moved into AI roles as government developed datacentre expansion plans The UK’s policy on datacentres and AI was developed without any meetings with environmental groups, an investigation has found. The nonprofit organisation Spotlight on"
      },
      {
        "source_index": 2,
        "publisher": "The Verge",
        "excerpt": "A subsidiary of Elon Musk's xAI is offering to buy up homes in a Mississippi neighborhood, as long as residents don't join a lawsuit targeting the company's nearby data center and power plant, according to a report from The Guardian. A realtor going door-to-door in the Southaven neighborhood"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028117784/en/Hummingbird-Acquires-Quantimon-to-Bring-Machine-Learning-to-AML-Transaction-Monitoring-for-the-Agentic-Era?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "deals",
    "headline": "Hummingbird Acquires Quantimon to Bring Machine Learning to AML Transaction Monitoring for the Agentic Era",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T12:05:00.000Z",
    "companies": [
      {
        "slug": "hummingbird",
        "name": "Hummingbird"
      },
      {
        "slug": "quantimon",
        "name": "Quantimon"
      }
    ],
    "extracted": {
      "target": "Quantimon",
      "acquirer": "Hummingbird"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Hummingbird, the AI-powered orchestration platform for financial crime compliance, today announced the acquisition of Quantimon, the machine learning platform for AML risk detection. The acquisition deepens Hummingbird's investment in transaction monitoring, bringing"
      }
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1020410/meta-launched-ai-pet-journal-app-waddle-world",
    "page": "launches",
    "headline": "Meta quietly launched an ‘AI pet journal’ app",
    "publisher": "The Verge",
    "published_at": "2026-10-28T11:27:30.000Z",
    "companies": [
      {
        "slug": "meta",
        "name": "Meta"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Meta has launched a \"tamagotchi-style\" pet game called Waddle World, with virtual creatures that chat with users and create doodles to illustrate conversations. According to its Apple and Play Store listings, the \"16-bit pet care game\" is not really a game, but \"a daily journal disguised as a pet.\""
      }
    ]
  },
  {
    "id": "https://openai.com/index/oracle-apps-in-chatgpt",
    "page": "funding",
    "headline": "Meet Anthropic’s Seven Founders as the A.I. Firm Prepares for an IPO",
    "publisher": "The New York Times",
    "published_at": "2026-10-26T15:24:56.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "amount": "$127.6B",
      "amount_usd": 127600000000,
      "stage": "I.P.O"
    },
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
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/vcs-will-make-billions-on-anthropics-ipo-but-amazon-is-set-to-make-much-much-more",
    "page": "funding",
    "headline": "VCs will make billions on Anthropic’s IPO, but Amazon is set to make much (much) more",
    "publisher": "TechCrunch",
    "published_at": "2026-10-28T01:15:28.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Massive note conversions reveal the true extent of Amazon's ownership in Anthropic."
      }
    ]
  },
  {
    "id": "https://about.fb.com/news/2026/10/muse-is-now-available-in-singapore-the-worlds-first-personal-ai-agent-built-for-everyone",
    "page": "launches",
    "headline": "Muse Is Now Available in Singapore: The World’s First Personal AI Agent Built for Everyone",
    "publisher": "Meta",
    "published_at": "2026-10-28T00:00:03.000Z",
    "companies": [
      {
        "slug": "meta",
        "name": "Meta"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Meta",
        "excerpt": "Muse Is Now Available in Singapore: The World’s First Personal AI Agent Built for Everyone"
      }
    ]
  },
  {
    "id": "https://deepmind.google/blog/gemini-4-carbon-our-next-frontier-model",
    "page": "models",
    "headline": "Gemini 4 Carbon: Our next frontier model",
    "publisher": "Google DeepMind",
    "published_at": "2026-10-28T00:00:00.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      },
      {
        "slug": "google-deepmind",
        "name": "Google DeepMind"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Google DeepMind",
        "excerpt": "Gemini 4 Carbon: Our next frontier model"
      },
      {
        "source_index": 1,
        "publisher": "Google DeepMind",
        "excerpt": "Gemini 4 Carbon: Our next frontier model"
      }
    ]
  },
  {
    "id": "https://lmarena.ai/leaderboard",
    "page": "performance",
    "headline": "LMArena text — Claude Fable 5 (High) (#11)",
    "publisher": "LMArena",
    "published_at": "2026-10-28T00:00:00.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "metric_name": "rank",
      "metric_value": "11"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "LMArena",
        "excerpt": "rank: 11 · rating: 1491.5611245046712 · vote_count: 45341 · organization: anthropic · leaderboard_publish_date: 2026-10-28"
      }
    ]
  },
  {
    "id": "https://openai.com/index/openai-servicenow-partnership-expansion",
    "page": "deals",
    "headline": "OpenAI and ServiceNow expand partnership across enterprise workflows",
    "publisher": "OpenAI",
    "published_at": "2026-10-28T00:00:00.000Z",
    "companies": [
      {
        "slug": "openai",
        "name": "OpenAI"
      },
      {
        "slug": "servicenow",
        "name": "ServiceNow"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "OpenAI",
        "excerpt": "OpenAI and ServiceNow expand their partnership to bring OpenAI models and agents into ServiceNow and ServiceNow workflows into ChatGPT and Codex."
      }
    ]
  },
  {
    "id": "https://www.anthropic.com/news/expanding-partnership-gsa",
    "page": "deals",
    "headline": "Expanding Partnership Gsa",
    "publisher": "Anthropic",
    "published_at": "2026-10-27T22:21:46.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Anthropic",
        "excerpt": "Expanding Partnership Gsa"
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/whos-really-in-charge-at-anthropic-after-the-ipo",
    "page": "funding",
    "headline": "Who’s really in charge at Anthropic after the IPO?",
    "publisher": "TechCrunch",
    "published_at": "2026-10-27T21:38:28.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Here's a clear explanation of Anthropic's incredibly complex governance structure."
      }
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1019470/anthropic-ipo-resist-investor-pressure-cut-corners-safety",
    "page": "funding",
    "headline": "Anthropic’s elaborate plan to keep Wall Street at bay",
    "publisher": "The Verge",
    "published_at": "2026-10-27T16:51:22.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Anthropic wants to have it both ways. With its impending IPO, it wants to tap the vast riches of the public markets and insists it doesn't want to compromise its core mission of developing AI safely and for the benefit of humanity. But greater model capabilities bring greater risks, and"
      }
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1019551/firefox-smart-window-ai-fill-forms",
    "page": "launches",
    "headline": "Firefox’s Smart Window adds AI form filling and webpage monitoring",
    "publisher": "The Verge",
    "published_at": "2026-10-27T16:14:18.000Z",
    "companies": [
      {
        "slug": "mozilla",
        "name": "Mozilla"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Mozilla is updating Smart Window - Firefox's AI-powered browsing experience - with a new feature that can help you fill out online forms based on your open tabs. As an example, Mozilla says Smart Window can pull information from your online portfolio or LinkedIn page to paste your work history into"
      }
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/27/anthropic-ipo-meta-spacex-ai-deals",
    "page": "funding",
    "headline": "Anthropic IPO leads AI's $235 billion dealmaking blitz",
    "publisher": "Axios",
    "published_at": "2026-10-27T09:00:04.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO",
      "amount": "$235B",
      "amount_usd": 235000000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Axios",
        "excerpt": "Anthropic IPO leads AI's $235 billion dealmaking blitz"
      }
    ]
  },
  {
    "id": "https://huggingface.co/blog/LiquidAI/lfm3",
    "page": "models",
    "headline": "Build specialized multimodal models with LFM3",
    "publisher": "Hugging Face",
    "published_at": "2026-10-27T00:00:00.000Z",
    "companies": [
      {
        "slug": "liquid-ai",
        "name": "Liquid AI"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hugging Face",
        "excerpt": "Build specialized multimodal models with LFM3"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36405",
    "page": "performance",
    "headline": "kw-bench: Breaking Frontier Harnesses on Real-World Tasks",
    "publisher": "arXiv",
    "published_at": "2026-10-26T23:40:10.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Each new generation of frontier model pushes the edge of what is possible. Inside a harness -- a loop, a shell, a filesystem, the ability to write and run its own code -- a model can take on increasingly difficult work. A growing body of work treats the coding-agent harness as infrastructure for"
      }
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/26/anthropic-ipo-biggest-surprises",
    "page": "funding",
    "headline": "Inside Anthropic's massive — and wild — IPO prospectus",
    "publisher": "Axios",
    "published_at": "2026-10-26T22:58:44.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Axios",
        "excerpt": "Inside Anthropic's massive — and wild — IPO prospectus"
      }
    ]
  },
  {
    "id": "https://humansignal.com/taste-index",
    "page": "performance",
    "headline": "Show HN: Websites designed by 10 AI models, ranked by 4,500 human votes",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T19:32:33.000Z",
    "companies": [],
    "extracted": {},
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
    ]
  },
  {
    "id": "https://news.crunchbase.com/public/anthropic-ipo-filing-ai-earnings-growth-risks",
    "page": "funding",
    "headline": "Some Observations About Anthropic’s IPO Filing",
    "publisher": "Crunchbase News",
    "published_at": "2026-10-26T20:10:57.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Crunchbase News",
        "excerpt": "In an S-1 filing today preceding what could be the largest IPO ever, Anthropic laid out extensive new details about its earnings, growth, key stakeholders and the risks it faces going forward. Clocking in at 335 pages, the document wasn’t exactly light reading. However, in a preliminary once-over,"
      }
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/28/google-alphabet-q3-earnings-report",
    "page": "performance",
    "headline": "Investors turn on Google owner Alphabet after profit miss, ad slowdown and high spending",
    "publisher": "The Guardian",
    "published_at": "2026-10-28T23:39:12.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Investors turn on Google owner Alphabet after profit miss, ad slowdown and high spending"
      }
    ]
  },
  {
    "id": "https://www.technologyreview.com/2026/10/26/1147672/will-the-real-anthropic-please-stand-up",
    "page": "funding",
    "headline": "Will the real Anthropic please stand up",
    "publisher": "MIT Technology Review",
    "published_at": "2026-10-26T17:45:43.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "MIT Technology Review",
        "excerpt": "This story originally appeared in The Algorithm, our weekly newsletter on AI. To get stories like this in your inbox first, sign up here. After weeks of frenzied speculation, Anthropic has filed its IPO prospectus. The 335-page document (100 pages or so are focused on risks) lays out the company’s"
      }
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/28/microsoft-earnings",
    "page": "performance",
    "headline": "Microsoft posts $92.3bn quarterly revenue after offering buyouts to 60,000 employees",
    "publisher": "The Guardian",
    "published_at": "2026-10-28T22:44:58.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Microsoft posts $92.3bn quarterly revenue after offering buyouts to 60,000 employees"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35671",
    "page": "performance",
    "headline": "Evaluating DeepSeek V4.1 Flash-1017 for loss of control and harmful manipulation risks",
    "publisher": "arXiv",
    "published_at": "2026-10-26T16:14:17.000Z",
    "companies": [
      {
        "slug": "deepseek",
        "name": "DeepSeek"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "As frontier language models grow increasingly capable and autonomous, independent third-party evaluations are critical for characterizing their systemic safety risks. While closed-source releases are routinely accompanied by comprehensive system cards, open-weight models receive less scrutiny"
      }
    ]
  },
  {
    "id": "https://mistral.ai/fr/news/timestral",
    "page": "models",
    "headline": "Timestral",
    "publisher": "Mistral AI",
    "published_at": "2026-10-26T16:11:42.612Z",
    "companies": [
      {
        "slug": "mistral-ai",
        "name": "Mistral AI"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Mistral AI",
        "excerpt": "Timestral"
      },
      {
        "source_index": 1,
        "publisher": "Mistral AI",
        "excerpt": "Timestral"
      },
      {
        "source_index": 2,
        "publisher": "Mistral AI",
        "excerpt": "Timestral"
      }
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/28/technology/alphabet-earnings-google-ai.html",
    "page": "performance",
    "headline": "Alphabet’s Revenue Rises 25% as Profit Falls",
    "publisher": "The New York Times",
    "published_at": "2026-10-28T20:54:11.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Alphabet’s Revenue Rises 25% as Profit Falls"
      }
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/28/technology/microsoft-earnings-ai.html",
    "page": "performance",
    "headline": "Microsoft’s Profit Jumps 32% Despite Big Increase in Spending",
    "publisher": "The New York Times",
    "published_at": "2026-10-28T20:37:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Microsoft’s Profit Jumps 32% Despite Big Increase in Spending"
      }
    ]
  },
  {
    "id": "https://mistral.ai/fr/news/voxtral-3",
    "page": "models",
    "headline": "Voxtral 3",
    "publisher": "Mistral AI",
    "published_at": "2026-10-26T13:56:04.729Z",
    "companies": [
      {
        "slug": "mistral-ai",
        "name": "Mistral AI"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Mistral AI",
        "excerpt": "Voxtral 3"
      },
      {
        "source_index": 1,
        "publisher": "Mistral AI",
        "excerpt": "Voxtral 3"
      },
      {
        "source_index": 2,
        "publisher": "Mistral AI",
        "excerpt": "Voxtral 3"
      }
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/26/anthropic-ipo-risk-factors-humanity",
    "page": "funding",
    "headline": "Anthropic's IPO outlines AI's extraordinary risks",
    "publisher": "Axios",
    "published_at": "2026-10-26T13:52:48.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Axios",
        "excerpt": "Anthropic's IPO outlines AI's extraordinary risks"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/e9827543-51c9-451b-b180-e7e2276aa957",
    "page": "funding",
    "headline": "Mubadala Capital dealmaker to launch his own venture fund",
    "publisher": "Financial Times",
    "published_at": "2026-10-28T15:44:48.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Mubadala Capital dealmaker to launch his own venture fund"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/e2aafede-771a-4fd0-b9fb-67c0bbb828ed",
    "page": "deals",
    "headline": "TPG pursues $5bn acquisition of UK data centre group Ark",
    "publisher": "Financial Times",
    "published_at": "2026-10-28T05:00:23.000Z",
    "companies": [
      {
        "slug": "tpg",
        "name": "TPG"
      }
    ],
    "extracted": {
      "amount": "$5B",
      "amount_usd": 5000000000,
      "acquirer": "TPG",
      "target": "Ark"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "TPG pursues $5bn acquisition of UK data centre group Ark"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/24a35e41-2641-4cec-97f5-a974412f9952",
    "page": "funding",
    "headline": "Anthropic’s seven founders tighten grip ahead of blockbuster IPO",
    "publisher": "Financial Times",
    "published_at": "2026-10-28T05:00:06.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Anthropic’s seven founders tighten grip ahead of blockbuster IPO"
      }
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/24/ai-ceos-washington-political-liability",
    "page": "discourse",
    "headline": "Washington's message to AI execs: Please shut up",
    "publisher": "Axios",
    "published_at": "2026-10-24T16:32:03.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Axios",
        "excerpt": "Washington's message to AI execs: Please shut up"
      },
      {
        "source_index": 1,
        "publisher": "Bloomberg",
        "excerpt": "Microsoft Corp. and Alphabet Inc. shares have gone separate ways since the companies’ last earnings reports as Wall Street increasingly digs in on the way heavy artificial intelligence spending is weighing on corporate bottom lines."
      },
      {
        "source_index": 2,
        "publisher": "Bloomberg",
        "excerpt": "Microsoft Corp. and Alphabet Inc. shares have gone separate ways since the companies’ last earnings reports as Wall Street increasingly digs in on the way heavy artificial intelligence spending is weighing on corporate bottom lines. With the two technology giants and major AI players poised to post"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/d144a865-285a-490e-be11-f924ada8cbc7",
    "page": "funding",
    "headline": "How much is Anthropic really worth?",
    "publisher": "Financial Times",
    "published_at": "2026-10-27T20:00:00.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "How much is Anthropic really worth?"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/0b7db9a1-8279-4025-8c2a-44a1010828f4",
    "page": "funding",
    "headline": "Anthropic, Meta and the K-shaped company",
    "publisher": "Financial Times",
    "published_at": "2026-10-27T17:02:25.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Anthropic, Meta and the K-shaped company"
      }
    ]
  },
  {
    "id": "https://www.theguardian.com/global/2026/oct/26/anthropic-accelerates-ai",
    "page": "funding",
    "headline": "Anthropic accelerates – for the rest of us, the speed of growth spells precarity",
    "publisher": "The Guardian",
    "published_at": "2026-10-27T15:15:20.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Anthropic accelerates – for the rest of us, the speed of growth spells precarity"
      }
    ]
  },
  {
    "id": "https://www.kimi.com/en/blog/kimi-k3-1-pro",
    "page": "models",
    "headline": "Kimi K3.1 Pro",
    "publisher": "Kimi (Moonshot AI)",
    "published_at": "2026-10-24T00:00:00.000Z",
    "companies": [
      {
        "slug": "moonshot-ai",
        "name": "Moonshot AI"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Kimi (Moonshot AI)",
        "excerpt": "Kimi K3.1 Pro"
      },
      {
        "source_index": 1,
        "publisher": "Moonshot AI (Kimi)",
        "excerpt": "Kimi K3.1 Pro"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34080",
    "page": "performance",
    "headline": "The LALA Benchmark: Evaluating Literary and Linguistic Analysis in LLMs",
    "publisher": "arXiv",
    "published_at": "2026-10-25T05:38:57.000Z",
    "companies": [],
    "extracted": {
      "metric_name": "Literature and Linguistics Analysis Benchmark"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "We introduce the Literature and Linguistics Analysis Benchmark (LALA), comprising 236 open-ended questions written by experts in linguistics and literary studies, together with expert-provided ideal answers. By comparing models within families and at similar training scales using human and LLM"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/69a623e0-8605-4b1d-b147-770649efb53a",
    "page": "funding",
    "headline": "Anthropic’s constitutional order",
    "publisher": "Financial Times",
    "published_at": "2026-10-27T05:30:08.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Anthropic’s constitutional order"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/d1dca5d1-467f-4311-a004-82bb1ef761e0",
    "page": "funding",
    "headline": "Anthropic’s big financial reveal",
    "publisher": "Financial Times",
    "published_at": "2026-10-27T05:00:29.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Anthropic’s big financial reveal"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/65a113b4-2a45-49cf-9e68-93f42151166e",
    "page": "funding",
    "headline": "Ex-Merseyside police officer lands $400mn valuation for AI venture",
    "publisher": "Financial Times",
    "published_at": "2026-10-27T05:00:18.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Ex-Merseyside police officer lands $400mn valuation for AI venture"
      }
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/26/anthropic-stock-market-filing-takeaways",
    "page": "funding",
    "headline": "Four takeaways from Anthropic’s potentially record-breaking stock market filing",
    "publisher": "The Guardian",
    "published_at": "2026-10-27T05:00:04.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
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
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33949",
    "page": "performance",
    "headline": "Why Does Structured Output Fail? An Empirical Study of Prompt-Enforced Pydantic Schemas Across Nine LLMs",
    "publisher": "arXiv",
    "published_at": "2026-10-24T23:30:38.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Pipelines that require structured outputs from hosted language models often specify a Pydantic schema in the prompt, validate the response, and retry when validation fails. Although native structured-output modes provide an alternative, application-side validation remains important for enforcing"
      }
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/26/meta-plans-95bn-stock-offering-to-help-cover-ai-expansion",
    "page": "funding",
    "headline": "Meta plans $95bn stock offering to help cover AI expansion",
    "publisher": "The Guardian",
    "published_at": "2026-10-26T23:33:19.000Z",
    "companies": [
      {
        "slug": "meta",
        "name": "Meta"
      }
    ],
    "extracted": {
      "amount": "$95B",
      "amount_usd": 95000000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Tech firm announces two-part fundraising after Elon Musk warns hundreds of AI startups face collapse Mark Zuckerberg’s Meta has announced plans for $95bn (£71bn) of fundraising to cover its AI expenditure, even as Elon Musk warned that funding for smaller players in the sector was drying up. The"
      }
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-ipo-s1-dario-amodei.html",
    "page": "funding",
    "headline": "Anthropic’s IPO S-1 Spells Out a Future of Promise and Peril",
    "publisher": "The New York Times",
    "published_at": "2026-10-26T19:36:41.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "The A.I. company took great pains to describe the many benefits that can come from using its Claude chatbot and technology, but also offered up a heavy dose of gloom."
      }
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-business-key-numbers.html",
    "page": "funding",
    "headline": "The Key Numbers From Anthropic’s IPO Filing",
    "publisher": "The New York Times",
    "published_at": "2026-10-26T19:08:01.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO"
    },
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
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-going-public-stakes.html",
    "page": "funding",
    "headline": "What’s Riding on Anthropic Going Public? Nearly Everything.",
    "publisher": "The New York Times",
    "published_at": "2026-10-26T18:44:19.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Anthropic sits atop a pyramid of business partners and suppliers, making it a barometer of the broader economy. Its initial public offering will have widespread implications."
      }
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-ipo-finances.html",
    "page": "funding",
    "headline": "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO",
    "publisher": "The New York Times",
    "published_at": "2026-10-26T18:08:07.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      }
    ],
    "extracted": {
      "stage": "IPO"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "The New York Times",
        "excerpt": "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO"
      }
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50219762",
    "page": "performance",
    "headline": "Show HN: Benchmarks of continual learning model trained for a month on a laptop",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T10:09:27.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "A month ago, I shared mini-AGI, an experiment in training a byte-level, continually learning language model from scratch on a single 8 GB laptop GPU (an RTX 3070). To recap the setup briefly: it completely decouples model size from VRAM by paging experts to and from an NVMe drive (currently 397"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33509",
    "page": "performance",
    "headline": "Can Agentic Code Review Catch Vulnerabilities Before They Are Merged?",
    "publisher": "arXiv",
    "published_at": "2026-10-24T07:32:42.000Z",
    "companies": [],
    "extracted": {
      "metric_name": "SecPRBench"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "LLM agents have been increasingly adopted for security-focused code review, but existing benchmarks mostly derive the reviewed changes from their later fixes instead of the real-world bug-introducing commits. In this paper, we present SecPRBench, the first comprehensive benchmark for evaluating"
      }
    ]
  }
]

## STYLE.md (verbatim, 25e18d610b9cbdca74cd2956c508c775737ad3de)

# STYLE.md — the editorial contract of The Weekly AI Edition

This file is the single source of truth for how the product reads. DESIGN.md owns
how it looks; STYLE.md owns how it speaks. Every stage that produces prose —
drafting (P6), verification (P7), the Weekly Edition session (PLAN §8), and human
review — is bound by this file. Nothing here is optional.

If a draft breaks a rule, the draft is wrong. If a rule cannot be checked
mechanically, the rubric (§10) does not cover it — but reviewers still apply it.

## 1. Voice

Calm, precise, zero hype. The register is a wire desk that respects the reader's
time, not a launch marketer.

- Report what happened and why it matters. Never sell, never cheer, never tease.
- Concrete nouns and precise verbs; short declarative sentences; no throat-clearing.
- Numbers are exact and sourced ("$6.5B", "6 GW", "+4.1%"). Never round a number up
  for effect. Never hedge a number that exists ("about", "nearly") unless the source
  itself estimates it.
- Companies are named, not characterized. "Anthropic", never "the AI darling" or
  "the $183B lab".
- No editorializing adjectives in news voice. The one sanctioned place for opinion
  is the take slot (§4).
- Time is stated plainly: "Monday", "Oct 27", never "just days ago" or "recently"
  inside dated pages.
- Second person is never addressed. No "you", no "we" except the colophon.
- Product and model names keep their own spelling (DeepSeek-R1, Claude Opus 4.6,
  Gemini 4 Argon, GPT-5.6); version numbers and money are set in mono by the
  renderer — mark them for mono in draft output (§10, R13).

## 2. One-liners

Every item carries a one-liner: **what it is + why it matters, in at most ~140
characters and exactly one sentence.**

- Structure: `[fact of the item] — [why a reader should care]`, or a single
  compressed clause if that reads better.
- The one-liner must add information the headline does not carry; it is never a
  restatement of the headline.
- Facts only. "Why it matters" is significance, not enthusiasm: cost, scale, who
  is affected, what changed.
- Plain text, no links, no emoji, no markup except the mono markers and the take
  em-dash in §4.
- Ends with a period. No fragments.
- Banned openings: "In a move that…", "This week, …", "Just announced…",
  "X just dropped…", "Big news:", "ICYMI".

## 3. The Briefing

5–7 sentences, no links, synthesis not summary. The page people screenshot; it
must stand alone without the rest of the issue.

- Lead with consequence: the week's single most important development comes first,
  not the most clickable one.
- Connect items — cause, response, parallel, contrast. The Briefing reads as one
  argument about the week, not a stack of five mini-summaries.
- Every claim must trace to at least one classified item in the issue. No outside
  knowledge, no claims the edition cannot back. (Enforced by P7 entailment.)
- Never enumerate pages or sections ("in funding news…", "meanwhile in models…").
- Never tease ("and this is only the beginning"), predict, or close on hype.
- It names real companies, products, and numbers — the density is the point —
  while still reading as calm prose at `--t-2xl`.
- Dates inside the Briefing are relative to the issue ("on Tuesday"), never
  absolute where a reader could miss the frame.

## 4. Takes

A take is a short, sharp, defensible observation attached to an item — the kind a
smart editor would say out loud. Set in italics after an em-dash.

- Format: ` — *take text*` appended to the one-liner.
- Rare: at most one take per page; zero is the default and always acceptable.
- A take may extrapolate significance but may never invent facts, predict, or
  editorialize beyond what the items support.
- Never snark, never "this changes everything", never punch down.

## 5. Discourse framing

Discourse covers the week's drama and debate. The reader decides; we frame.

- The headline of every Discourse item is a question ("Is AI reasoning an
  illusion?", "Who pays for crawling?").
- Every Discourse item links both sides: ≥ 2 sources from ≥ 2 distinct publishers
  (PLAN §5.3). One side is never allowed to stand alone.
- The one-liner states what is actually being argued — position A vs position B —
  with no verdict and no "raises questions" hand-waving.
- We report the debate; we never join it. No takes on Discourse items.

## 6. Per-page house rules

| Page | Writing rule |
|---|---|
| Cover | Headline is the week's single most important item, chosen from the classified items. The deck adds exactly one line of context. `--accent` lives only here on desktop (DESIGN §3). |
| Briefing | See §3. 5–7 sentences, no links. |
| Models & Releases | The lab is the source label. Version numbers in mono. Compare against the predecessor or the field, never against hype ("matches GPT-5 on ARC-AGI-3", not "crushes the competition"). |
| Performance | Every item carries a number (score, rank delta) in mono. Say what the benchmark actually measures before what it scored. |
| Launches | Name the thing shipped and who can use it today. Availability beats announcement ("available to all users", not "coming soon"). |
| Funding | Format: `**Company** raised **$Xm** <stage> led by <Lead>` — e.g. "**Anthropic** raised **$13B** Series F led by Iconiq". Amount and stage in mono. Undisclosed amounts: write "undisclosed", never guess. Valuation belongs in the one-liner, not the headline format. |
| Deals | Acquirer → target order; amount if public, else "undisclosed". Acqui-hires are named acqui-hires. Partnerships state what each side actually commits (gigawatts, dollars, seats) — not "strategic". |
| Markets | Week-over-week moves only. Numbers in mono. One chart, ≤ 10 tickers, basket fixed in `config/markets.json`. No targets, no predictions, no "as investors cheered" — just the move and its proximate cause if sourced. |
| Discourse | See §5. Question-framed headline, both sides linked, no verdict. |
| Most Covered | Derived from our own tagged items; no prose to write. |
| Back Page | Fixed blocks only (sources, how it's made, agent access). No prose. |

## 7. Banned patterns

The following are never acceptable in any produced text. The word bans are
enforced mechanically (§10, R5); the rest are reviewer-enforced.

**Hype words:** revolutionary, game-changer(-ing), groundbreaking, cutting-edge,
bleeding-edge, jaw-dropping, mind-blowing, incredible, amazing, stunning,
unprecedented, seismic, explosive, massive, insane, crazy, turbocharge(d),
supercharge(d), unlock(ed) (as a verb of value), unleash(ed), disrupt(ive),
democratize(d), skyrocket(s), soar(s) (use "rose"/"fell"), game changing, huge,
enormous (unless a literal measure), turbo.

**Engagement bait:** "Here's why that matters", "everything you need to know",
"you won't believe", "read that again", "don't miss", "🔥", exclamation marks,
questions addressed to the reader outside Discourse framing, urgency or FOMO
framing, listicle framing.

**Vague significance:** "raises questions", "sparks debate" (name the debate),
"could change everything", "signals a shift" without naming the shift, "only time
will tell", "the implications are clear".

**Overclaim:** predictions stated as fact, AGI timelines asserted, "will" for
speculation, superlatives not sourced from a benchmark, "the first ever" unless
verifiably first.

**Attribution dodges:** "some say", "critics argue", "it is believed" without a
named source; anonymous authority.

**Clichés and AI-tell phrasing:** "delve", "tapestry", "testament", "navigate the
landscape", "in today's fast-paced world", "a new era", "paradigm shift",
underscore/highlight/underscore as verbs.

**Content exclusions (PLAN §2):** nothing sourced from X/Twitter; no republished
article bodies; nothing sourced from HashiCorp, IBM, or customer interviews; no
"AI-generated" disclaimers or apology copy in the product.

## 8. Classification taxonomy

The page types are the taxonomy. A classified item is assigned exactly one of the
seven item-bearing page labels below, or `unsorted`. The derived pages — Cover,
Briefing, Most Covered, Back Page — are built from classified items and are never
classification targets.

| Label | What belongs | What does not |
|---|---|---|
| `models` | New models and weights, major version bumps, API/model changes, flagship OSS release tags (vLLM, llama.cpp, Ollama, LangChain). Vendor's own announcement counts. | Product surfaces wrapped around a model (→ `launches`), benchmark results about a model (→ `performance`). |
| `performance` | Benchmark results and moves, leaderboard changes, notable evals, papers-with-results, eval-methodology news. | A model announcement that happens to quote scores (→ `models`). |
| `launches` | Products and features shipped to users: apps, tools, agent modes, hardware, SDKs, public availability. | A model's release note (→ `models`); an announcement of intent without availability (→ `unsorted` unless contested → `discourse`). |
| `funding` | Private rounds, IPOs and offerings, valuations, fund raises. | Revenue figures and market-cap moves (→ `markets`); acquisitions (→ `deals`). |
| `deals` | Acquisitions, acqui-hires, major partnerships/JVs, large commercial compute/cloud contracts. | Product deals (a reseller agreement) too small to matter (→ `unsorted`). |
| `markets` | Price and market-cap moves of the AI basket and AI pure plays; public-market events (index inclusion, trading halts) on those names. | Anything not about a listed/basket name (→ `unsorted`). |
| `discourse` | The contested debate of the week: lawsuits, policy fights, viral critiques, safety controversies — always framed as a question with ≥ 2 publishers. | A lone press release, a settled announcement, celebrity opinion (→ `unsorted`). |
| `unsorted` | Everything else: non-AI tech, policy announcements without a live debate, tutorials, AMAs/Ask HNs, research without results, single-publisher drama, and every item whose classification confidence is < 0.7. | — |

Boundary rules:

- Classify by substance, not by the presence of the word "AI".
- Confidence below 0.7 → `unsorted`, always (enforced in code by P4).
- Company tags come only from `config/companies.yaml` slugs; an item whose
  substance is a company absent from the registry → `unsorted`. The registry is
  never extended implicitly by classification (PLAN §5.3).
- An item matching two pages takes the page its *decision-relevant* substance is
  about: a funding round is `funding` even if the round narrative mentions a new
  model.

## 9. Cover imagery (DESIGN §1.5, §7.4)

Covers are typographic in v1; generation is deferred to T3. When generated, the
pipeline produces one candidate per issue and the human approves it in the issue
PR. The generation prompt and its constraints are versioned here:

> Abstract material study on warm paper: soft fields of muted colour, gentle
> directional light, fine pigment texture. Calm, editorial, matte. No objects,
> no people, no text, no logos, no metaphors.

Constraints: muted palette on paper tones only; never people, products, screens,
robots, circuitry, text, or watermarks; never stock photography or article
photos; assets `editions/<week>/cover.jpg` at 2000×2500 portrait plus a
2400×1350 landscape crop, ≤ 180 KB AVIF preferred.

## 10. The drafting rubric

Binary pass/fail checks a reviewer (and P6's self-check) applies to every draft
edition. A failure is never a taste call: if a check cannot be decided without
taste, it is not in this table.

| # | Check | Pass condition | Applies to |
|---|---|---|---|
| R1 | Briefing length | 5–7 sentences (sentences split on terminal `.`, `?`, `!` after stripping mono/markup) | Briefing |
| R2 | Briefing purity | zero occurrences of `http://`, `https://`, or `[` link syntax in the briefing text | Briefing |
| R3 | One-liner length | `len(one_liner) ≤ 140` for every item | every item |
| R4 | One-liner ≠ headline | normalized `one_liner != headline` for every item | every item |
| R5 | Banned words | none of §7's banned words/phrases appear as whole words in any produced text | all prose |
| R6 | Traceability | every company name, product name, number, and quoted fact in produced text appears verbatim in the `sources[]` excerpts/records of the item or the issue's classified items | Briefing, one-liners, takes |
| R7 | Discourse framing | every Discourse headline ends with `?` | Discourse |
| R8 | Discourse sources | every Discourse item's `sources[]` spans ≥ 2 distinct publishers | Discourse |
| R9 | Funding format | every Funding headline matches `**{Company}** raised **${amount}** {stage} led by {Lead}` or explicitly states `undisclosed` | Funding |
| R10 | Take quota | ≤ 1 item per page carries a take, and every take is formatted ` — *…*` (em-dash, italic, no trailing period required) | every page |
| R11 | No emoji / exclamation | no emoji and no `!` in produced text | all prose |
| R12 | Number sanity | every number in produced text is prefixed/marked for mono per §1 and matches a source number exactly | all prose |
| R13 | Item cap | no page exceeds its DESIGN §3 `maxItems` | every page |
| R14 | Unsorted hygiene | no `unsorted` item appears on any edition page | edition |

**Scoring:** a draft passes the rubric iff every applicable check passes. There
are no partial credits and no weighted scores — the rubric is a gate, not a
grade.

