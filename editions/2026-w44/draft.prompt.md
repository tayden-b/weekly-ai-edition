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
    "companies": [],
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
    "id": "https://www.anthropic.com/research/early-progress-drug-development",
    "page": "models",
    "headline": "Early progress on accelerating drug development with Claude",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T20:50:42.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Early progress on accelerating drug development with Claude"
      },
      {
        "source_index": 1,
        "publisher": "Anthropic",
        "excerpt": "Early Progress Drug Development"
      }
    ]
  },
  {
    "id": "https://openai.com/index/building-scientific-understanding-with-academic-communities",
    "page": "models",
    "headline": "Working with academic communities to build scientific understanding",
    "publisher": "OpenAI",
    "published_at": "2026-10-26T00:00:00.000Z",
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
        "publisher": "OpenAI",
        "excerpt": "OpenAI shares model results on the Kakeya conjecture, Exponential Time Hypothesis, and quantum chromodynamics—and how researchers can verify and build on them."
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "Three new discoveries in mathematics, computer science, and physics"
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
    "id": "https://cursor.com/blog/agent-sdk",
    "page": "launches",
    "headline": "The Agent SDK",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T14:02:20.000Z",
    "companies": [],
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
    "id": "https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation",
    "page": "models",
    "headline": "Genie 4: A new generation of world simulation",
    "publisher": "Google DeepMind",
    "published_at": "2026-10-27T00:00:00.000Z",
    "companies": [],
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
    "id": "https://github.com/Asdivyansh/silo-cli",
    "page": "launches",
    "headline": "Show HN: Silo – an open source secure CLI sandbox for running agents locally",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T19:33:24.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Silo – an open source secure CLI sandbox for running agents locally"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028010878/en/Rocker-Launches-as-the-Context-Aware-AI-Work-Assistant-for-the-Busiest-People-at-the-World%E2%80%99s-Most-Ambitious-Companies?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "Rocker Launches as the Context-Aware AI Work Assistant for the Busiest People at the World’s Most Ambitious Companies",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T19:22:00.000Z",
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
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Rocker, the AI assistant for busiest people at the world’s most ambitious companies, today announced $12.85M in funding led by Greycroft, with participation from Anthropic and Menlo Ventures' Anthology Fund, Matchstick, Stripe, and operators Jeanne DeWitt Grosser"
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/anthropic-just-launched-tools-to-show-companies-what-their-ai-spending-is-buying",
    "page": "launches",
    "headline": "Anthropic just launched tools to show companies what their AI spending is buying",
    "publisher": "TechCrunch",
    "published_at": "2026-10-28T19:19:58.000Z",
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
        "excerpt": "The frontier lab is lifting the curtain on how users spend money on its models ahead of a planned IPO."
      }
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/doj-inquires-about-nvidia-s-hugging-face-deal-reuters-says",
    "page": "deals",
    "headline": "DOJ Inquires About Nvidia’s Hugging Face Deal, Reuters Says",
    "publisher": "Bloomberg",
    "published_at": "2026-10-28T19:14:22.000Z",
    "companies": [
      {
        "slug": "hugging-face",
        "name": "Hugging Face"
      },
      {
        "slug": "nvidia",
        "name": "NVIDIA"
      }
    ],
    "extracted": {
      "target": "AI model company Hugging Face",
      "amount": "$13B",
      "amount_usd": 13000000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "The US Justice Department is making inquiries about Nvidia Corp.’s agreement to acquire AI model company Hugging Face for about $13 billion, part of broader regulatory scrutiny of the chip giant, Reuters reported."
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
    "id": "https://www.theverge.com/tech/1021143/microsoft-lg-samsung-copilot-ai-assistant-smart-tvs-ending",
    "page": "launches",
    "headline": "Microsoft is ending Copilot support on smart TVs",
    "publisher": "The Verge",
    "published_at": "2026-10-28T18:36:26.000Z",
    "companies": [
      {
        "slug": "microsoft",
        "name": "Microsoft"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Nearly two years after LG and Samsung announced at CES 2025 that their latest smart TVs would include access to Microsoft's Copilot, the company is ending support for the AI assistant's functionality on all TVs this year, according to a report by Windows Central. The news comes not from an official"
      }
    ]
  },
  {
    "id": "https://42loop.com/about",
    "page": "launches",
    "headline": "Show HN: 42Loop - Agent runs the product, I assist it",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T17:36:47.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "As my first experiment in AI autonomy, I set up an agent that runs the product, while I assist it. The product is the community board hosted on the homepage of 42Loop.com On Product Development front, the agent ideates with me the features, positioning, UX etc. and provides me the prompts that I"
      }
    ]
  },
  {
    "id": "https://github.com/tellers-ai/skills",
    "page": "launches",
    "headline": "Show HN: Preview video timelines live in the browser as AI agents edit them",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T17:39:29.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Preview video timelines live in the browser as AI agents edit them"
      }
    ]
  },
  {
    "id": "https://github.com/egma-ai/homi",
    "page": "models",
    "headline": "Show HN: Homi, open decision model for audio, near Flash on MMSU and 50x cheaper",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T17:09:08.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Weights - https:&#x2F;&#x2F;huggingface.co&#x2F;egma-ai&#x2F;homi"
      }
    ]
  },
  {
    "id": "https://www.blockchainiq.co/blog/x402-integrations-from-the-build-bounty",
    "page": "launches",
    "headline": "Show HN: X402 integrations for an AI-agent data API, checked in a clean room",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T16:50:10.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I run Blockchain IQ. We sell some crypto data to software agents per request over x402 (HTTP 402, USDC on Base, no account or API key). In October we paid for integrations: 22 were submitted and we checked each one by matching its on-chain payment to our purchase log and running it in a clean"
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/as-ai-agents-reshape-the-web-google-opens-gemini-and-search-to-more-apps",
    "page": "models",
    "headline": "As AI agents reshape the web, Google opens Gemini and Search to more apps",
    "publisher": "TechCrunch",
    "published_at": "2026-10-28T17:00:00.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "A new developer platform will let businesses bring their services to Google's AI experiences, potentially changing how consumers discover and use apps."
      }
    ]
  },
  {
    "id": "https://github.com/grimmerk/memsaga",
    "page": "models",
    "headline": "Show HN: Memsaga – Git history of Claude Code memory and skills, by session",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T16:21:26.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Memsaga – Git history of Claude Code memory and skills, by session"
      }
    ]
  },
  {
    "id": "https://github.com/colinsurprenant/parley",
    "page": "launches",
    "headline": "Show HN: Parley – coding-agent sessions that collaborate over IRC",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T14:48:16.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Parley – coding-agent sessions that collaborate over IRC"
      }
    ]
  },
  {
    "id": "https://app.userrank.ai/",
    "page": "launches",
    "headline": "Show HN: Coding agent spots your AI practices and the ones you're missing",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T15:26:16.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Frontier models improve at a pace faster than the pace at which most humans are able to keep up. Not all of us are obsessed with pushing the boundaries of our agents and trying new ways to work with them. I often spend 12+ hours a day working with an LLM, and still, when I talk to people, I hear of"
      }
    ]
  },
  {
    "id": "https://github.com/nodal-data/nodal-context",
    "page": "models",
    "headline": "Show HN: Interview your analysts instead of auto-generating a semantic layer",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T14:35:23.000Z",
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
        "excerpt": "I’ve spent the last year building context for AI analysts in the mid-market. I’ve open sourced a library from my learnings, along the same principles of the Matt Pocock skills. Principles: * Claude &#x2F; Codex &#x2F; Cursor etc are great data agents - you just need context to enable them to answer"
      }
    ]
  },
  {
    "id": "https://www.anthropic.com/research/discovering-vulnerabilities-with-claude",
    "page": "models",
    "headline": "Discovering Vulnerabilities With Claude",
    "publisher": "Anthropic",
    "published_at": "2026-10-28T15:31:36.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Anthropic",
        "excerpt": "Discovering Vulnerabilities With Claude"
      }
    ]
  },
  {
    "id": "https://bugtape.ai/",
    "page": "launches",
    "headline": "Show HN: BugTape – production bugs your coding agent can read and fix over MCP",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T15:07:18.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: BugTape – production bugs your coding agent can read and fix over MCP"
      }
    ]
  },
  {
    "id": "https://jeman.net/nekot",
    "page": "models",
    "headline": "Show HN: Nekot, an iPhone app that warns you before Claude Code limits hit",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T15:01:45.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Nekot, an iPhone app that warns you before Claude Code limits hit"
      }
    ]
  },
  {
    "id": "https://chopstick.sh/",
    "page": "launches",
    "headline": "Show HN: Chopstick – Mac notch widgets built by your coding agent",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T14:48:57.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hey HN, happy to share Chopstick with you. It's a Mac app that makes your notch useful, but most importantly customizable and dynamic. What makes it unique is that you can build custom widgets with your coding agent. Chopstick automatically learns from your usage and suggests new widgets with time."
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
        "slug": "elevenlabs",
        "name": "ElevenLabs"
      },
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
    "id": "http://www.businesswire.com/news/home/20261027636687/en/Dassault-Syst%C3%A8mes-Takes-Its-Life-Sciences-Ambition-to-the-Next-Level-with-a-Unified-AI-Platform-Connecting-Science-Medicine-and-Patients?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "Show HN: MindThread CLI and MCP server for Threads, with per-permission approval",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T13:19:27.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: MindThread CLI and MCP server for Threads, with per-permission approval"
      },
      {
        "source_index": 1,
        "publisher": "arXiv",
        "excerpt": "Background: To localize a fault, a coding agent can reason from source code alone or use debugger assistance by running the program and stepping through it in an interactive debugger. While earlier agents struggled with static execution tracing and debugger operation, frontier LLMs have improved at"
      },
      {
        "source_index": 2,
        "publisher": "Financial Times",
        "excerpt": "Australia’s drive to transform economy with data centres, aerospace — and meat pies"
      },
      {
        "source_index": 3,
        "publisher": "Business Wire",
        "excerpt": "VELIZY-VILLACOUBLAY, France--(BUSINESS WIRE)-- #3DEXPERIENCE--Dassault Systèmes (Euronext Paris: FR0014003TT8, DSY.PA) today announced it has completed the acquisition of ArisGlobal and is now uniting its Life Sciences and Healthcare capabilities into a unified AI platform that connects science,"
      }
    ]
  },
  {
    "id": "https://agent-bv.pages.dev/app",
    "page": "launches",
    "headline": "Show HN: Agent-B.V., adversarial tests and on-chain reports for AI agents",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T14:03:38.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Agent-B.V., adversarial tests and on-chain reports for AI agents"
      }
    ]
  },
  {
    "id": "https://simedw.com/projects/harness-corp",
    "page": "launches",
    "headline": "Show HN: Harness Corp – An incremental game powered by a local LLM using WebGPU",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T13:36:05.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I built a small browser incremental game where you start by answering tasks at your desk to save up to rent a GPU, and hire a real Qwen3-0.6B model running locally in your browser over WebGPU (~358 MB download). Throughout the game you buy upgrades to your model's harness, things like JSON"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028263072/en/Ronald-McDonald-House-New-York-Awarded-1.5-Million-Grant-From-RBC-Foundation-USA-to-Pilot-AI-Powered-Hub-for-Family-Centered-Care?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "Ronald McDonald House New York Awarded $1.5 Million Grant From RBC Foundation USA to Pilot AI-Powered Hub for Family-Centered Care",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T14:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "NEW YORK--(BUSINESS WIRE)--Ronald McDonald House New York (RMH-NY) today announced it has been awarded a $1.5 million, three-year grant from the RBC Foundation USA to pilot an AI-powered Family Navigation Hub for families staying at RMH-NY. Today, families staying at RMH-NY rely on paper flyers and"
      }
    ]
  },
  {
    "id": "https://github.com/trypando/pando",
    "page": "models",
    "headline": "Show HN: Pando, what to do with vibe coded apps at work",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T13:29:37.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Since AI has grown in popularity, technical and non-technical employees have been using it to build small tools and apps to boost productivity and model prototypes. Some companies like Ramp and Stripe, are building their own internal platform for this. That’s great for them, but not every company"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028051332/en/Schwab-Advisor-Services%E2%84%A2-Expands-AI-Inside-Schwab-Advisor-Center-and-Across-the-Third-Party-Solutions-RIAs-Use?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "Schwab Advisor Services™ Expands AI Inside Schwab Advisor Center and Across the Third-Party Solutions RIAs Use",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T13:30:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "WESTLAKE, Texas & BOSTON--(BUSINESS WIRE)--Schwab Advisor Services, Charles Schwab's business supporting the growth and success of more than 17,000 independent registered investment advisors (RIAs), today announced new AI solutions for RIAs, available inside Schwab Advisor Center and through the"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028683272/en/IREN-and-Wingspire-Equipment-Finance-Complete-363-Million-Financing-for-High-Density-AI-Compute-Assets?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "funding",
    "headline": "IREN and Wingspire Equipment Finance Complete $363 Million Financing for High-Density AI Compute Assets",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T13:17:00.000Z",
    "companies": [],
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
    "id": "https://apnews.com/article/stocks-markets-ai-earnings-oil-e11a2240fc3283c4507d44b9833f30a2",
    "page": "discourse",
    "headline": "Can debt-funded AI capital expenditure pay for itself?",
    "publisher": "Associated Press",
    "published_at": "2026-10-27T07:10:58.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Associated Press",
        "excerpt": "Stocks in the artificial-intelligence industry led Wall Street higher on Tuesday. AI stocks rose to another winning day after swerving for weeks on worries about whether their boom is under threat because of how expensive they have become."
      },
      {
        "source_index": 1,
        "publisher": "Reuters",
        "excerpt": "An AI-fueled tech rally sent US stocks to a higher close on Tuesday. The buzz surrounding details of Anthropic's impending initial public offering helped boost chip stocks for the third consecutive session. Growing concerns over the viability of debt-funded spending have weighed on the AI trade."
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028047517/en/Klarna-to-Present-at-Upcoming-Investor-Conference?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "Klarna to Present at Upcoming Investor Conference",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T13:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "NEW YORK--(BUSINESS WIRE)--Klarna, the everyday finance network, today announced its participation in the following investor conference in December. UBS Global Technology and AI Conference (David Sykes, President and Chief Commercial Officer) At 2:55 p.m. MST on December 1. Live webcasts and"
      }
    ]
  },
  {
    "id": "https://www.globenewswire.com/news-release/2026/10/28/3390266/0/en/rapidcanvas-acquires-entytle-to-bring-ai-driven-execution-to-the-industrial-aftermarket.html",
    "page": "deals",
    "headline": "RapidCanvas → Entytle",
    "publisher": "GlobeNewswire",
    "published_at": "2026-10-28T13:00:00.000Z",
    "companies": [
      {
        "slug": "entytle",
        "name": "Entytle"
      },
      {
        "slug": "rapidcanvas",
        "name": "RapidCanvas"
      }
    ],
    "extracted": {
      "target": "Entytle"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "GlobeNewswire",
        "excerpt": "RapidCanvas, a managed AI execution company, today announced it has acquired Entytle, the company that pioneered the Autonomous Aftermarket for B2B OEMs. Financial terms were not disclosed."
      }
    ]
  },
  {
    "id": "https://github.com/jgrichardson/shufler",
    "page": "models",
    "headline": "Show HN: Shufler: 3D gaming harness around your coding harness and dev pipeline",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T12:39:28.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN. Greg here. I've been a full stack engineer for 20 years. Now all I do is shuffle messages between users, my agent fleet, our dev pipeline.. back and forth. I miss coding, solving problems, reasoning, and having an understanding and a mental model of all the work I'm juggling. But this is the"
      }
    ]
  },
  {
    "id": "https://github.com/kevinmmiddleton/recruiter-bff",
    "page": "models",
    "headline": "Show HN: I worked at an ATS, so I built Recruiter BFF for Claude and ChatGPT",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T12:12:25.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: I worked at an ATS, so I built Recruiter BFF for Claude and ChatGPT"
      }
    ]
  },
  {
    "id": "https://github.com/tinybig-ai/jep",
    "page": "models",
    "headline": "Show HN: Multi-platform remote-control for any harness",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T12:10:43.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I was fed up with codex and opencode not having good mobile remote control apps. I loved using claude code from my phone, but i hop between harnesses and i didn't want to be locked into Claude Code just for the mobile remote control. I also hated the shabby pi.dev remote control that i found"
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
      "target": "Quantimon"
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
    "id": "https://github.com/27medkamal/tmux-agent-wizard",
    "page": "launches",
    "headline": "Show HN: TAW, herdr for tmux: see which coding agent needs you",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T11:13:13.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: TAW, herdr for tmux: see which coding agent needs you"
      }
    ]
  },
  {
    "id": "https://github.com/agens-field/nuvrail",
    "page": "launches",
    "headline": "Show HN: Nuvrail – make an AI agent ask before it sends, moves or deletes email",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T11:07:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Nuvrail – make an AI agent ask before it sends, moves or deletes email"
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
        "slug": "apple",
        "name": "Apple"
      },
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
    "id": "https://github.com/linearza/ballast",
    "page": "launches",
    "headline": "Show HN: Ballast – macOS app to clear disk space",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T10:36:15.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Built a little native MacOS app out of necessity to help me free up some storage on my Mac. I've always been frustrated by the lack of visibility and mysterious nature of the Storage overview especially when it comes to Developer and System Data. Ballast gives you a detailed breakdown of all common"
      }
    ]
  },
  {
    "id": "https://www.mybotsai.com/",
    "page": "models",
    "headline": "Show HN: FreeApply Free Job Application MCP, runs locally with your existing LLM",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T08:18:29.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Any critism, advice, etc is welcome. Local mcp server hosting private information on the client computer and utilizing client-side model subscriptions to handle workloads. Has ATS optimization and cover letter generation. Tools are weighted by model to optimize token spend."
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028854882/en/Financial-Services-Increases-AI-Investment-Faster-Than-Wider-Market-While-Maturity-Remains-Level?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "Financial Services Increases AI Investment Faster Than Wider Market, While Maturity Remains Level",
    "publisher": "Business Wire",
    "published_at": "2026-10-28T08:56:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "PALO ALTO, Calif.--(BUSINESS WIRE)-- #ai--HTEC, the global AI technology and engineering leader, today released its research on AI Value realization in financial services and Insurance. Organizations in this sector are increasing AI investment more aggressively than the wider market, but the sector"
      }
    ]
  },
  {
    "id": "https://github.com/misbahsy/novul",
    "page": "launches",
    "headline": "Show HN: NoVul – Open-source Mac app to Find and fix vulnerabilities on your Mac",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T07:32:53.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Since everyone and their agents are building apps, there is not time to stop and search for vulnerabilities on our machine. Built an open source tool that monitors new vulnerabilities every 15 mins and lets you or your agent know on what to fix."
      }
    ]
  },
  {
    "id": "https://github.com/Alanzj/SelfClaw",
    "page": "models",
    "headline": "Show HN: SelfClaw – Self-hosted multi-model AI chat with OpenAI-compatible API",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T04:52:34.000Z",
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
        "publisher": "Hacker News",
        "excerpt": "SelfClaw aggregates multiple LLM providers behind a single OpenAI-compatible API. Built with Python, Streamlit, and FastAPI. MIT licensed."
      }
    ]
  },
  {
    "id": "https://www.anthropic.com/research/claude-discovers-novel-enzyme-system",
    "page": "models",
    "headline": "Claude Discovers Novel Enzyme System",
    "publisher": "Anthropic",
    "published_at": "2026-10-28T04:28:01.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Anthropic",
        "excerpt": "Claude Discovers Novel Enzyme System"
      }
    ]
  },
  {
    "id": "https://sightspinner.ai/blog/misery-in-america-2026-10-28.html",
    "page": "models",
    "headline": "Show HN: Misery in America",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T01:09:05.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "A model forecasting the misery index into next year. You can find the model without the article here: https:&#x2F;&#x2F;app.sightspinner.ai&#x2F;share&#x2F;g7Xirw5fr1e_BUExZv0hvlqjkWRAPFM9xgP99s2Yz9o"
      }
    ]
  },
  {
    "id": "https://spec-first.dev/",
    "page": "launches",
    "headline": "Show HN: Specification First Agentic Development Plugin and Prove",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T15:12:20.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Implemented agent smith since start 2026 with over 1000 specifications which lead to about 500k lines of code. The procedure with that spec-first works well. How do you do it?"
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
        "slug": "amazon",
        "name": "Amazon"
      },
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
    "id": "https://github.com/sujee/visual-stories/tree/main/projects/tracing-llm-api-request",
    "page": "launches",
    "headline": "Show HN: A visual explainer tracing an LLM API request to the GPU and back",
    "publisher": "Hacker News",
    "published_at": "2026-10-28T00:55:41.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: A visual explainer tracing an LLM API request to the GPU and back"
      }
    ]
  },
  {
    "id": "https://about.fb.com/news/2026/10/muse-is-now-available-in-singapore-the-worlds-first-personal-ai-agent-built-for-everyone",
    "page": "launches",
    "headline": "Muse Is Now Available in Singapore: The World’s First Personal AI Agent Built for Everyone",
    "publisher": "Meta",
    "published_at": "2026-10-28T00:00:03.000Z",
    "companies": [],
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
    "companies": [],
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
    "id": "https://themorningbuild.com/digest/2026-10-28",
    "page": "models",
    "headline": "Genie 4",
    "publisher": "The Morning Build",
    "published_at": "2026-10-28T00:00:00.000Z",
    "companies": [
      {
        "slug": "google-deepmind",
        "name": "Google DeepMind"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Morning Build",
        "excerpt": "DeepMind announced Genie 4, a multimodal world model that natively generates audio, ambient sound, and interactive dialogue, can be steered in real time via natural language, and is being rolled out as a research preview to trusted testers."
      }
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1051627/000121390026113058/0001213900-26-113058-index.htm",
    "page": "launches",
    "headline": "8-K — AXT INC (AXTI)",
    "publisher": "SEC EDGAR",
    "published_at": "2026-10-28T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "SEC EDGAR",
        "excerpt": "PRESS RELEASE OF AXT, INC., DATED OCTOBER 28, 2026 (FURNISHED PURSUANT TO ITEM 7.01); items 1.01, 7.01, 9.01; filed by AXT INC (AXTI)"
      }
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2070542/000121390026113119/0001213900-26-113119-index.htm",
    "page": "launches",
    "headline": "8-K — AIB Data Centers Inc. (AIB)",
    "publisher": "SEC EDGAR",
    "published_at": "2026-10-28T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "SEC EDGAR",
        "excerpt": "PRESS RELEASE, DATED OCTOBER 28, 2026; items 1.01, 5.02, 7.01, 9.01; filed by AIB Data Centers Inc. (AIB)"
      }
    ]
  },
  {
    "id": "https://atlas.prashish.com/weeks/2026-10-26",
    "page": "discourse",
    "headline": "Did two frontier labs just refute the Exponential Time Hypothesis — or can nobody actually check the proofs?",
    "publisher": "Third Run Time",
    "published_at": "2026-10-26T17:00:00.000Z",
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
        "publisher": "Third Run Time",
        "excerpt": "OpenAI announces three big science discoveries and a new way to work with academics. The Verge covered the announcement of three results in maths, computer science and physics."
      },
      {
        "source_index": 1,
        "publisher": "AI Atlas",
        "excerpt": "OpenAI announced on 26 October that its models found sub-exponential algorithms for a hard class of logic puzzles, which would make the Exponential Time Hypothesis false, and The Information reports that Anthropic claimed its own refutation hours later."
      }
    ]
  },
  {
    "id": "https://github.com/chen-985211/cleancode",
    "page": "models",
    "headline": "Show HN: CleanCode – Claude Code and Codex collaborating on one canvas",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T20:57:26.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: CleanCode – Claude Code and Codex collaborating on one canvas"
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
    "id": "https://openai.com/index/oracle-apps-in-chatgpt",
    "page": "funding",
    "headline": "Meet Anthropic’s Seven Founders as the A.I. Firm Prepares for an IPO",
    "publisher": "The New York Times",
    "published_at": "2026-10-26T15:24:56.000Z",
    "companies": [
      {
        "slug": "anthropic",
        "name": "Anthropic"
      },
      {
        "slug": "openai",
        "name": "OpenAI"
      }
    ],
    "extracted": {},
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
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027051586/en/Ridgeview-Partners-Completes-Acquisition-of-Pinewood-Technologies-Group?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "deals",
    "headline": "Ridgeview Partners Completes Acquisition of Pinewood Technologies Group",
    "publisher": "Business Wire",
    "published_at": "2026-10-27T21:00:00.000Z",
    "companies": [],
    "extracted": {
      "target": "Pinewood Technologies Group plc"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Ridgeview Partners LLC (“Ridgeview”), a growth-oriented technology private equity firm, today announced the completion of the acquisition of Pinewood Technologies Group plc (“Pinewood.AI”), a leading cloud-based, AI-first, full-service technology provider to"
      }
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1019921/openai-breakthrough-math-computer-science-physics",
    "page": "launches",
    "headline": "Researchers are getting tired of OpenAI gatekeeping its breakthroughs",
    "publisher": "The Verge",
    "published_at": "2026-10-27T20:48:58.000Z",
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
        "publisher": "The Verge",
        "excerpt": "On Monday, OpenAI announced impressive breakthroughs in mathematics, computer science, and physics, along with what the company says is an evolving approach to communicating its findings. But despite its apparent course correction, researchers who spoke to The Verge are growing increasingly tired"
      }
    ]
  },
  {
    "id": "https://github.com/milad-ahmd/agent-skills",
    "page": "launches",
    "headline": "Show HN: Agent Skills – 51 SKILL.md workflows for coding agents and marketers",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T20:16:56.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Agent Skills – 51 SKILL.md workflows for coding agents and marketers"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027936657/en/BigBear.ai-Announces-Third-Quarter-2026-Results-and-Raises-FY-2026-Revenue-Guidance?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "BigBear.ai Announces Third Quarter 2026 Results and Raises FY 2026 Revenue Guidance",
    "publisher": "Business Wire",
    "published_at": "2026-10-27T20:15:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "MCLEAN, Va.--(BUSINESS WIRE)--BigBear.ai Holdings, Inc. (NYSE: BBAI) (“BigBear.ai” or the “Company”), a specialized security & defense technology company providing mission-ready AI, today reported financial results for the third quarter of 2026. A new investor presentation is also available on the"
      }
    ]
  },
  {
    "id": "https://autosomal.ai/",
    "page": "models",
    "headline": "Show HN: Autosomal.ai Free AI-Based Age, Gender, and Ethnicity Guesser",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T19:32:36.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "The age and gender prediction are based on open models. The ethnicity guesser is a private model I have been developing. Accuracy is continuously being fine-tuned. Please submit feedback on the site when a model predicts incorrectly so we can improve the model."
      }
    ]
  },
  {
    "id": "https://slidepilot.dev/",
    "page": "launches",
    "headline": "Show HN: Let your coding agent recreate viral tiktoks for your app",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T19:53:21.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Let your coding agent recreate viral tiktoks for your app"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027440937/en/Grid-Dynamics-Launches-Business-Process-Consulting-Practice-to-Bridge-the-Gap-Between-AI-Investment-and-Business-Results?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "Grid Dynamics Launches Business Process Consulting Practice to Bridge the Gap Between AI Investment and Business Results",
    "publisher": "Business Wire",
    "published_at": "2026-10-27T20:05:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN RAMON, Calif.--(BUSINESS WIRE)--Grid Dynamics Holdings, Inc. (Nasdaq: GDYN) (“Grid Dynamics”), a premier AI transformation partner for the Fortune 1000, today announced the launch of its Business Process Consulting practice, extending the company's AI transformation capabilities across the"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027590794/en/CoreWeave-Announces-Date-of-Third-Quarter-2026-Financial-Results-and-Conference-Call?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "launches",
    "headline": "CoreWeave Announces Date of Third Quarter 2026 Financial Results and Conference Call",
    "publisher": "Business Wire",
    "published_at": "2026-10-27T20:05:00.000Z",
    "companies": [
      {
        "slug": "coreweave",
        "name": "CoreWeave"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "LIVINGSTON, N.J.--(BUSINESS WIRE)--CoreWeave, Inc. (Nasdaq: CRWV), The Essential Cloud for AI®, will hold its quarterly conference call to discuss third quarter 2026 financial results on Tuesday, November 10, 2026 at 5:00 PM Eastern Time. The live webcast of the earnings conference call can be"
      }
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027636043/en/CoStar-Group-to-Acquire-Vexcel-Adding-the-World%E2%80%99s-Largest-Survey-Grade-High-Resolution-Aerial-Imagery-Program-to-Power-Richer-Search-and-Discovery-Across-CoStar-with-Tens-of-Billions-of-New-AI-Derived-Data-Fields?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "page": "deals",
    "headline": "CoStar Group to Acquire Vexcel, Adding the World’s Largest Survey Grade High-Resolution Aerial Imagery Program to Power Richer Search and Discovery Across CoStar with Tens of Billions of New AI-Derived Data Fields",
    "publisher": "Business Wire",
    "published_at": "2026-10-27T20:05:00.000Z",
    "companies": [],
    "extracted": {
      "target": "Vexcel Group"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "ARLINGTON, Va.--(BUSINESS WIRE)--CoStar Group, Inc. (NASDAQ: CSGP), a leading global provider of online real estate marketplaces, information, analytics, and digital twins in the property markets, announced today that it has entered into a definitive agreement to acquire Vexcel Group, Inc."
      }
    ]
  },
  {
    "id": "https://venturebeat.com/technology/liquid-ais-new-lfm3-models-put-browser-agents-voice-commands-and-image-recognition-onto-enterprise-controlled-devices",
    "page": "models",
    "headline": "Liquid AI LFM3",
    "publisher": "VentureBeat",
    "published_at": "2026-10-27T19:37:51.000Z",
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
        "publisher": "VentureBeat",
        "excerpt": "Liquid AI is introducing LFM3, a family of compact AI models designed to move more enterprise work onto company-controlled hardware. The October 27 release includes six models spanning language, vision, speech and structured decisions."
      }
    ]
  },
  {
    "id": "https://github.com/FrigadeHQ/hob",
    "page": "models",
    "headline": "Show HN: Hob - Open-source, on device alternative to Claude Cowork and ChatGPT",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T16:12:29.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hey HN, I'm Christian and this is a new OSS project I've been noodling on for the last couple of weeks. Hob is a free, MIT-licensed desktop app for Mac, Windows and Linux that works on your files the way the Claude and ChatGPT desktop apps do, except the model runs on your own computer. It uses"
      }
    ]
  },
  {
    "id": "https://creati.ai/ai-news/2026-10-27/meta-releases-muse-spark-open-an-816b-parameter-open-weight-model-for-multimodal-coding-agents",
    "page": "models",
    "headline": "Muse Spark Open",
    "publisher": "Creati AI",
    "published_at": "2026-10-27T19:20:54.000Z",
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
        "publisher": "Creati AI",
        "excerpt": "Meta has published Muse Spark Open, an open-weight multimodal model designed for long-running coding agents. The mixture-of-experts system combines text, images, audio, and video with approximately 816 billion total parameters, 42 billion active for each token."
      }
    ]
  },
  {
    "id": "https://www.llmverifications.com/",
    "page": "performance",
    "headline": "Show HN: I found a more accurate upcoming LLM Benchmarks leaderboard",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T18:25:14.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: I found a more accurate upcoming LLM Benchmarks leaderboard"
      }
    ]
  },
  {
    "id": "https://allmodels.io/llm/abliterated",
    "page": "models",
    "headline": "There are now 5 inference providers for abliterated DeepSeek",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T04:53:52.000Z",
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
        "publisher": "Hacker News",
        "excerpt": "There are now 5 inference providers for abliterated DeepSeek"
      }
    ]
  },
  {
    "id": "https://github.com/sanmak/specops",
    "page": "launches",
    "headline": "Show HN: Make your AI agent think before it codes",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T17:41:07.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Make your AI agent think before it codes"
      }
    ]
  },
  {
    "id": "https://github.com/saranyan/agent-relay",
    "page": "launches",
    "headline": "Show HN: Agent-relay for multi-vendor coding sessions",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T17:14:54.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Agent-relay for multi-vendor coding sessions"
      }
    ]
  },
  {
    "id": "https://thegit.ai/docs/core-features/browser-control",
    "page": "launches",
    "headline": "Show HN: Control the browser directly from TheGitAI Terminal",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T17:52:52.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I am the owner and founder of TheGitAI Coding Agent. I built this Chrome extension to let the agent control your existing browser directly from the terminal without interrupting the workflow. It doesn't require your login details or any secrets. You can control your browser now through agent"
      }
    ]
  },
  {
    "id": "https://nicchia-code.github.io/trama",
    "page": "launches",
    "headline": "Show HN: Trama, Meta Vibe Coding Agent 0.1.1 Released",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T15:56:02.000Z",
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
        "publisher": "Hacker News",
        "excerpt": "Show HN: Trama, Meta Vibe Coding Agent 0.1.1 Released"
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
    "id": "https://sectr.dev/",
    "page": "launches",
    "headline": "Show HN: Sectr – Serverless backend platform for easy deployment of AI agents",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T15:40:07.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hey HN, I've been building Sectr, a backend-as-a-service for making it easy(ier) to develop and deploy AI agents. Deploying agents requires non-trivial systems design work. Consider a support agent: how do you stream messages to your frontend, how&#x2F;where do you persist messages for frontend"
      }
    ]
  },
  {
    "id": "https://crulon.ai/",
    "page": "launches",
    "headline": "Show HN: Crulon – Business phone where AI does the work, humans make the calls",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T16:10:26.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN, I’m Rayhan. Crulon is a business phone system where an AI agent answers the line and your team works alongside it. You can talk with our demo agent right in your browser, no sign-up: https:&#x2F;&#x2F;crulon.ai&#x2F;#talk Why I built it: I’ve spent eight years as a software and network"
      }
    ]
  },
  {
    "id": "https://github.com/wrg32786/aigent-os",
    "page": "models",
    "headline": "Show HN: Aigent-OS, a Claude Code harness that clears and resumes",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T16:10:01.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I run my business on four Claude Code agents: Titus, Pheme, Davinci and Metis. They write my newsletter, The AIgent (about 9k subscribers), every day through a drafting and proofreading engine that Pheme checks before scheduling. They also build AI courses, run a pipeline that turns the day's"
      }
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/googles-genie-4-world-model-adds-audio-more-realistic-worlds-and-real-time-steering",
    "page": "models",
    "headline": "Google’s Genie 4 world model adds audio, more realistic worlds, and real-time steering",
    "publisher": "TechCrunch",
    "published_at": "2026-10-27T16:30:57.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Genie 4 can maintain a consistent scene for up to two minutes, double Genie 3's limit, and offers better physics and more humanlike characters."
      }
    ]
  },
  {
    "id": "https://huggingface.co/datasets/taktekhq/lebanese-legislation",
    "page": "launches",
    "headline": "Show HN: Open Dataset of the Lebanese Law",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T15:52:25.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hey folks! I made it easier for builders to use the lebanese legislation through: a public DB, API, and MCP. The Lebanese University has an archive of all laws dating back to 1904 (legallaw.ul.edu.lb). People and AI can barely find it and navigate it. It also had outdated articles. Now, more people"
      }
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1019551/firefox-smart-window-ai-fill-forms",
    "page": "launches",
    "headline": "Firefox’s Smart Window adds AI form filling and webpage monitoring",
    "publisher": "The Verge",
    "published_at": "2026-10-27T16:14:18.000Z",
    "companies": [],
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
    "id": "https://slopit.io/",
    "page": "launches",
    "headline": "Show HN: SlopIt – A blog your coding agent runs",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T15:48:11.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN! This is something I built out of my own need. I’m doing several projects on the side, and many of them need a CMS quickly (automated by my agents), and I thought there’s space for a very minimal thing that’s more agent-native instead of setting up the heavy blogging platforms. A few things"
      }
    ]
  },
  {
    "id": "https://ailately.com/rn/2026-10-27-12",
    "page": "models",
    "headline": "GPT-6.1 Terra",
    "publisher": "AI Lately",
    "published_at": "2026-10-27T16:07:00.000Z",
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
        "publisher": "AI Lately",
        "excerpt": "OpenAI launched a new AI model today. It is called GPT-6.1 Terra. OpenAI says Terra costs half as much as its last computer-use model and its bigger sibling, Sol. The price now sits at one dollar per million input tokens."
      }
    ]
  },
  {
    "id": "https://arstechnica.com/google/2026/10/deepminds-genie-4-world-model-adds-audio-and-more-realistic-people-to-simulations",
    "page": "models",
    "headline": "DeepMind unveils Genie 4 world model promising more realistic physics and humans",
    "publisher": "Ars Technica",
    "published_at": "2026-10-27T16:00:22.000Z",
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
        "excerpt": "Genie 4 will roll out to developers and Google AI Ultra subscribers soon."
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.37442",
    "page": "models",
    "headline": "CRISP: Co-designing Pruning and Scheduling for Efficient MoE Inference on Edge Servers",
    "publisher": "arXiv",
    "published_at": "2026-10-27T15:51:14.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Mixture-of-Experts (MoE) inference on memory-constrained edge platforms is often dominated by expert-weight movement rather than computation. Although each token activates only a small subset of experts, routing is input-dependent, so all experts must remain accessible and memory movement dominates"
      }
    ]
  },
  {
    "id": "https://microsoft.ai/news/mai-image-2-7-debut",
    "page": "performance",
    "headline": "MAI Image 2.7",
    "publisher": "Microsoft AI",
    "published_at": "2026-10-27T15:10:00.000Z",
    "companies": [
      {
        "slug": "microsoft",
        "name": "Microsoft"
      }
    ],
    "extracted": {
      "metric_name": "Arena Edit",
      "metric_value": "No. 3"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Microsoft AI",
        "excerpt": "MAI Image 2.7, our latest image editing model, launches with even stronger control for edits that are hardest to get right. It launches in preview at No. 3 on Arena Edit, making Microsoft AI the No. 2 lab, and No. 2 on Artificial Analysis's image editing leaderboard."
      }
    ]
  },
  {
    "id": "https://unfolded-gpt2.vercel.app/",
    "page": "models",
    "headline": "Show HN: Watch GPT-2 compute your sentence, one matrix at a time, in 3D",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T14:50:36.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Watch GPT-2 compute your sentence, one matrix at a time, in 3D"
      }
    ]
  },
  {
    "id": "https://github.com/Hardalion/agent-delegated-authority",
    "page": "launches",
    "headline": "Show HN: ADAP – An open protocol for AI Agent delegated authority",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T14:14:47.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: ADAP – An open protocol for AI Agent delegated authority"
      }
    ]
  },
  {
    "id": "https://github.com/Ezed9/mcp-bouncer",
    "page": "launches",
    "headline": "Show HN: Bouncer, an MCP proxy that denies sends to addresses the agent read",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T14:00:52.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Bouncer, an MCP proxy that denies sends to addresses the agent read"
      }
    ]
  },
  {
    "id": "https://mcptask.online/live?language=en",
    "page": "launches",
    "headline": "Show HN: Give our AI coding runner a real task and watch it until merge",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T13:37:38.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Give our AI coding runner a real task and watch it until merge"
      }
    ]
  },
  {
    "id": "https://actera.dev/try",
    "page": "launches",
    "headline": "Show HN: Change my page if the agent allows it",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T12:44:38.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Change my page if the agent allows it"
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "Hello HN! We're building a single search&#x2F;browse API interface to thousands of ecommerce stores (hopefully, eventually, all of them). Inspired by Shopify's https:&#x2F;&#x2F;shop.dev, we embedded a WASM bridge of our CLI in our website. The idea is to provide an efficient commerce interface for"
      }
    ]
  },
  {
    "id": "https://citewing.com/",
    "page": "launches",
    "headline": "Show HN: CiteWing – AI backlink outreach agent",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T13:03:53.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: CiteWing – AI backlink outreach agent"
      }
    ]
  },
  {
    "id": "https://github.com/0xArx/hashling",
    "page": "launches",
    "headline": "Show HN: Hashling, an open-source Mac security agent your own AI can talk to",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T13:00:47.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Hashling, an open-source Mac security agent your own AI can talk to"
      }
    ]
  },
  {
    "id": "https://github.com/pezhik/skilltotal",
    "page": "models",
    "headline": "Show HN: SkillTotal – scan packages before Claude Code installs them",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T12:58:20.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: SkillTotal – scan packages before Claude Code installs them"
      }
    ]
  },
  {
    "id": "https://www.businesswire.com/news/home/20261027228454/en/Innovation-X-Co-Leads-Tenstorrents-%241.5-Billion-Series-E-at-a-%246.2-Billion-Valuation",
    "page": "funding",
    "headline": "Tenstorrent raised $1.5B Series E",
    "publisher": "Business Wire",
    "published_at": "2026-10-27T13:07:00.000Z",
    "companies": [
      {
        "slug": "tenstorrent",
        "name": "Tenstorrent"
      }
    ],
    "extracted": {
      "amount": "$1.5B",
      "stage": "Series E",
      "amount_usd": 1500000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "Innovation X, a late-stage venture capital firm investing in privately held technology leaders, today announced that it co-led Tenstorrent's $1.5 billion Series E financing at a $6.2 billion post-money valuation."
      }
    ]
  },
  {
    "id": "https://github.com/synectus/OpenGMB",
    "page": "launches",
    "headline": "Show HN: Self-hosted Google Business Profile manager with agent approvals",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T12:51:05.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Self-hosted Google Business Profile manager with agent approvals"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.37161",
    "page": "launches",
    "headline": "WorkFactory: Turning Professional Intents into Executable Work for Scalable Agent Training",
    "publisher": "arXiv",
    "published_at": "2026-10-27T12:54:16.000Z",
    "companies": [
      {
        "slug": "framework",
        "name": "Framework Computer"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Scaling supervised training for working agents requires diverse professional tasks that yield reliable expert demonstrations. However, missing or inconsistent task information can obstruct teacher execution and weaken the resulting supervision. We propose WorkFactory, a scalable framework for"
      }
    ]
  },
  {
    "id": "https://catalogaudit.app/",
    "page": "launches",
    "headline": "Show HN: I built a tool to audit Shopify stores for AI agent and Google Shopping",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T11:41:44.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: I built a tool to audit Shopify stores for AI agent and Google Shopping"
      }
    ]
  },
  {
    "id": "https://github.com/TimeCopilot/foundationforecast",
    "page": "models",
    "headline": "Show HN: FoundationForecast: unified API for time series foundation models",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T12:05:28.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      },
      {
        "slug": "amazon",
        "name": "Amazon"
      },
      {
        "slug": "mistral-ai",
        "name": "Mistral AI"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "It supports forecast, cross-validation, anomaly detection, and exogenous variables for models such as AWS Chronos, Google TimesFM, Mistral Timestral, H2O TimeH2O, Nixtla TimeGPT, etc., under the same API."
      }
    ]
  },
  {
    "id": "https://heyyeah.github.io/AI_Compute_Footprint",
    "page": "models",
    "headline": "Show HN: AI Compute Footprint (energy, space, water and CO2)",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T12:04:10.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I made AI Compute Footprint to get an understanding how big the energy, space, water + CO₂ footprint of data centres running everyday AI tasks is, and how it compares with other everyday activities. I have a feel for how long a query takes when it runs on a local model on my laptop but I wanted to"
      }
    ]
  },
  {
    "id": "https://statespace.play.naigap.com/",
    "page": "models",
    "headline": "Show HN: Statespace – learn formal methods by building a tiny checked language",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T11:49:52.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I had claude build a course optimized for me (backend engineer with some systems experience) to learn formal methods. Main idea being - I want to build a checked application language which finds bugs with z3, prove things in lean, model concurrency&#x2F;dist sys behaviors in TLA+, connect it to"
      }
    ]
  },
  {
    "id": "https://www.prnewswire.com/news-releases/guidewire-signs-definitive-agreement-to-acquire-hyperexponential-302920513.html",
    "page": "deals",
    "headline": "Guidewire → hyperexponential",
    "publisher": "PR Newswire",
    "published_at": "2026-10-27T11:00:00.000Z",
    "companies": [
      {
        "slug": "guidewire",
        "name": "Guidewire"
      },
      {
        "slug": "hyperexponential",
        "name": "hyperexponential"
      }
    ],
    "extracted": {
      "target": "Hyperexponential Ltd",
      "amount": "$1.7B",
      "amount_usd": 1700000000,
      "acquirer": "Guidewire"
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "PR Newswire",
        "excerpt": "Guidewire announced today that it entered into a definitive agreement to acquire Hyperexponential Ltd for a base purchase price of $1.7 billion in cash, subject to adjustments, and up to an additional $400 million in contingent consideration."
      }
    ]
  },
  {
    "id": "https://github.com/kekzl/imp",
    "page": "models",
    "headline": "Show HN: Imp, an LLM Server for RTX 50 GPUs, Written by Claude Code",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T09:50:39.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Imp, an LLM Server for RTX 50 GPUs, Written by Claude Code"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36918",
    "page": "models",
    "headline": "TrawMem: Reframing Agent Memory as Task-Oriented Role-Adaptive Workspaces",
    "publisher": "arXiv",
    "published_at": "2026-10-27T09:46:15.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Large language model (LLM) agents rely on memory systems to leverage long-term interactions, yet existing systems typically retrieve memories based on their relevance to the current query and use them as contextual evidence. However, relevance alone does not characterize how a memory contributes to"
      }
    ]
  },
  {
    "id": "https://github.com/okunix/gollama",
    "page": "launches",
    "headline": "Show HN: Ollama client library for Golang with streaming API support",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T09:28:35.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Ollama client library for Golang with streaming API support"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36584",
    "page": "models",
    "headline": "Benchmarking LLM Agents for Behaviorally Adequate Test Generation from Software Requirements",
    "publisher": "arXiv",
    "published_at": "2026-10-27T03:41:55.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "As large language model agents increasingly compile natural-language requirements into repository-level code, requirement-to-test generation grows in importance to provide validation constraints (or harness) to guide code generation. Yet it remains unclear whether current agents can generate tests"
      }
    ]
  },
  {
    "id": "https://github.com/QingYunA/answer-me-with-html",
    "page": "launches",
    "headline": "Show HN: Agent outputs slop texts, so I make a superfast HTML skill visualize it",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T02:19:30.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Agent outputs slop texts, so I make a superfast HTML skill visualize it"
      }
    ]
  },
  {
    "id": "https://better-design.com/",
    "page": "models",
    "headline": "Show HN: Better Design – alternative to Claude Design, for any coding agents",
    "publisher": "Hacker News",
    "published_at": "2026-10-27T00:16:35.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Better Design – alternative to Claude Design, for any coding agents"
      }
    ]
  },
  {
    "id": "https://funding.fru.dev/months/2026-10",
    "page": "funding",
    "headline": "Hyphenate raised $45M Series A",
    "publisher": "Funding Index",
    "published_at": "2026-10-27T00:00:00.000Z",
    "companies": [
      {
        "slug": "hyphenate",
        "name": "Hyphenate"
      }
    ],
    "extracted": {
      "amount": "$45M",
      "stage": "Series A",
      "lead_investor": "Nexus Venture Partners",
      "amount_usd": 45000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Funding Index",
        "excerpt": "Hyphenate raises $45M Series A, Oct 27, 2026. AI apps. Led by Nexus Venture Partners. Hyphenate develops autonomous AI agent systems for enterprise financial operations."
      }
    ]
  },
  {
    "id": "https://huggingface.co/blog/LiquidAI/lfm3",
    "page": "models",
    "headline": "Build specialized multimodal models with LFM3",
    "publisher": "Hugging Face",
    "published_at": "2026-10-27T00:00:00.000Z",
    "companies": [],
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
    "id": "https://launchindex.ai/month/2026-10",
    "page": "models",
    "headline": "Claude Duet",
    "publisher": "Launch Index",
    "published_at": "2026-10-27T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Launch Index",
        "excerpt": "Claude Duet — Proactive agent that understands what needs your attention — 322 votes."
      }
    ]
  },
  {
    "id": "https://openai.com/index/retell-ai",
    "page": "performance",
    "headline": "Retell uses OpenAI models to help power 100M monthly calls",
    "publisher": "OpenAI",
    "published_at": "2026-10-27T00:00:00.000Z",
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
        "publisher": "OpenAI",
        "excerpt": "GPT-6 Astra tops Retell’s voice agent benchmark, while Codex helps it reach a $1.6M annual revenue run rate per employee."
      }
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1703157/000101738626000149/0001017386-26-000149-index.htm",
    "page": "launches",
    "headline": "8-K — Securetech Innovations, Inc. (SCTH)",
    "publisher": "SEC EDGAR",
    "published_at": "2026-10-27T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "SEC EDGAR",
        "excerpt": "PRESS RELEASE OF SECURETECH INNOVATIONS, INC; items 1.01, 2.01, 3.02, 3.03, 5.03, 7.01, 9.01; filed by Securetech Innovations, Inc. (SCTH)"
      }
    ]
  },
  {
    "id": "https://www.siliconreport.com/capital/archive/2026-10",
    "page": "funding",
    "headline": "General Compute raised $100M Series A",
    "publisher": "SiliconReport",
    "published_at": "2026-10-27T00:00:00.000Z",
    "companies": [
      {
        "slug": "general-compute",
        "name": "General Compute"
      }
    ],
    "extracted": {
      "amount": "$100M",
      "stage": "Series A",
      "amount_usd": 100000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "SiliconReport",
        "excerpt": "Oct 27 General Compute raises $100 million Series A at $800 million valuation."
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
    "id": "https://arxiv.org/abs/2610.36341",
    "page": "models",
    "headline": "Executable Archaeology of Programs That Model Programming: Reanimating the Heuristic Compiler (1961) and KBEmacs (1984)",
    "publisher": "arXiv",
    "published_at": "2026-10-26T22:09:13.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Early AI programs were often also theories of how people think, and programs that wrote programs were, in part, theories of how people program. Here we report on the reanimation of two such programs that offer two seemingly different theories of programming and were developed for quite different"
      }
    ]
  },
  {
    "id": "https://stockpickersgame.com/",
    "page": "launches",
    "headline": "Show HN: Play ten years of stock picking in an evening, on a simulated market",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T20:51:50.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "This is a stock picking game that simulates a stock market with thousands of rule based agents making trades and moving the stock price. The agents (not AI agents) have different rules to simulate different trading styles. The game layer is basically 12 companies&#x2F;stocks you can buy and sell,"
      }
    ]
  },
  {
    "id": "https://github.com/chris-mccoy/gottschalk-tarantelle",
    "page": "models",
    "headline": "Show HN: Claude Plays the Piano from Braille",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T20:00:14.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "For the longest time, I've wanted MIDI files created from scans of sheet music to listen to. I can't play the piano myself, but I've been around music since I was a child. The existing software almost never sounded good, never expressive. This is an attempt to use an LLM to create music from BANA"
      }
    ]
  },
  {
    "id": "https://github.com/haplollc/Vesalius",
    "page": "models",
    "headline": "Show HN: Vesalius, an on-device code graph for Claude Code",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T20:11:45.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Vesalius, an on-device code graph for Claude Code"
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
    "id": "https://epoch.ai/benchmarks",
    "page": "models",
    "headline": "furniture assembly: gpt-6.1-terra_max",
    "publisher": "Epoch AI",
    "published_at": "2026-10-26T20:00:34.000Z",
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
        "publisher": "Epoch AI",
        "excerpt": "mean_score: 0.7916666666666666 · Best score (across scorers): 0.7916666666666666 · Organization: OpenAI · Release date: 2026-10-26"
      }
    ]
  },
  {
    "id": "https://tabichat.dev/",
    "page": "launches",
    "headline": "Show HN: Tabichat – a control room for your agent fleet (mTLS MQTT IoT broker)",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T19:03:21.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Tabichat – a control room for your agent fleet (mTLS MQTT IoT broker)"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36202",
    "page": "models",
    "headline": "Base Models Can Detect Hidden Intentions that Prompted Classifiers Miss",
    "publisher": "arXiv",
    "published_at": "2026-10-26T19:39:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "The Persona Selection Model (PSM) posits that post-training selects a persona the model learned during pre-training. Work on subliminal learning has shown that models can impart covert signals (like \"love of owls\") into semantically unrelated outputs like strings of numbers, and that students"
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
    "id": "https://rts.emersoftware.cl/",
    "page": "launches",
    "headline": "Show HN: Castellan – A real-time strategy game for agents",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T16:17:30.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "In an RTS game, making decisions quickly matters as much as making good ones. Looking for the balance between cost, speed and intelligence in agents, I started wondering what an agent playing an RTS would look like. So I built a simple RTS, and I keep making it more complex. - The game keeps"
      }
    ]
  },
  {
    "id": "https://github.com/mainplane-ai/mainplane",
    "page": "launches",
    "headline": "Show HN: Mainplane – Agent in Go that lives on your old PC, drives your laptop",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T16:37:03.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN, I'm Alexander. Yes, this is another agent harness. Here is why I built one anyway. I was engineer #2 at Browser Use, where I built our agent harness and the evals behind it, including BU Bench, which became a default benchmark for browser agents. I left in September to build Mainplane. The"
      }
    ]
  },
  {
    "id": "https://github.com/Quorus-dev/Quorus",
    "page": "models",
    "headline": "Show HN: Quorus – Claude Code writes it, nothing hits main until Codex says GO",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T17:09:02.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Quorus – Claude Code writes it, nothing hits main until Codex says GO"
      }
    ]
  },
  {
    "id": "https://github.com/BrianWeiHaoMa/git-dupe/tree/main",
    "page": "launches",
    "headline": "Show HN: git-dupe – Version private files alongside a public Git repo",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T15:50:53.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN! I made git-dupe to solve the problem where I have notes, skills, and agent instructions that are part of my personal workflow, so I do not want them committed to the public repo, but at the same time, I want them to be in the project at the correct locations (e.g., AGENTS.md file locations"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35721",
    "page": "models",
    "headline": "Can JEV Support Clinical Trial Criteria Assessment?",
    "publisher": "arXiv",
    "published_at": "2026-10-26T16:41:12.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Clinical trial prescreening requires distinguishing unmet conditions from insufficient evidence in patient records. Given patient records, criterion questions, and predefined answer options, we retrospectively compared JEV, a non-generative decision model returning native option probabilities, with"
      }
    ]
  },
  {
    "id": "https://github.com/michaeldmueller/hue-claude",
    "page": "models",
    "headline": "Show HN: Flash your Hue lights when Claude finishes a turn or needs permission",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T15:53:47.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Flash your Hue lights when Claude finishes a turn or needs permission"
      }
    ]
  },
  {
    "id": "https://juiced.codes/",
    "page": "models",
    "headline": "Show HN: Juiced Claude Code",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T15:53:09.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Juiced Claude Code"
      }
    ]
  },
  {
    "id": "https://dna.hashgrid.ai/",
    "page": "launches",
    "headline": "Show HN: I built Search/Recsys that learns from feedback",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T15:03:24.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN. A while ago I started building a generic people matching app based on LLM-as-a-judge. I needed a way to bypass the O(n^2) \"everyone rates everyone else\" trap, but generic RAG was much worse than expected. DNA is a search-like API at the core of that product. It stores one embedding per item"
      }
    ]
  },
  {
    "id": "https://github.com/MatijaMiki/ranwhat",
    "page": "launches",
    "headline": "Show HN: Ranwhat.com",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T15:19:05.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HackerNews, My name is Matija, and I'm building ranwhat.com. It's used for checking if any of your secrets have leaked, and where they leaked. It's mostly aimed at solo devs such as myself, but also at anyone using a coding agent. The tool also checks if your coding agent ran any sketchy"
      }
    ]
  },
  {
    "id": "https://amni-scient.com/amni-cad",
    "page": "models",
    "headline": "Show HN: Amni-CAD – free browser CAD with FEA that Claude can drive over MCP",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T14:56:48.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Amni-CAD – free browser CAD with FEA that Claude can drive over MCP"
      }
    ]
  },
  {
    "id": "https://github.com/anthonyclarka2/sothspell",
    "page": "models",
    "headline": "Show HN: Sóþspell, a model-guided walkthrough of a codebase",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T15:05:31.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I kept finding myself wanting a way to get talked through the code that a model had created, which led to me making Sóþspell (old English, \"Truth Story\"). You give it a git repo locally or via URL, and it creates a tour of the repo in a web page, with the aim of it explaining the whole thing."
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35586",
    "page": "models",
    "headline": "Linear Probes Transfer from Base to Distilled Language Models despite Rotation",
    "publisher": "arXiv",
    "published_at": "2026-10-26T15:15:34.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Linear probes, classifiers that read a language model's internal activations, are widely used to detect harmful requests. They are cheap to train and run, and an auditor who has trained one would like to reuse it when the model is replaced by a successor rather than retrain it for every release. We"
      }
    ]
  },
  {
    "id": "https://docs.docsgpt.cloud/Models/decision-model",
    "page": "models",
    "headline": "Show HN: Arc-decide – an MIT 0.4B decision model for RAG checks that runs on CPU",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T14:24:34.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Arc-decide – an MIT 0.4B decision model for RAG checks that runs on CPU"
      }
    ]
  },
  {
    "id": "https://twitter.com/FangcunLeap/status/2114719692137136245",
    "page": "performance",
    "headline": "Show HN: DeepSeek v4.1 Flash-1017 Safety Evaluation",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T14:19:05.000Z",
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
        "publisher": "Hacker News",
        "excerpt": "Show HN: DeepSeek v4.1 Flash-1017 Safety Evaluation"
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
    "id": "https://github.com/swapnildahiphale/compactly",
    "page": "models",
    "headline": "Show HN: Compactly – Compact Claude Code sessions between tasks",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T12:58:47.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Compactly – Compact Claude Code sessions between tasks"
      }
    ]
  },
  {
    "id": "https://geekyants.com/blog/how-geekyants-manages-ai-models-after-launch-to-maintain-security-control-and-flexibility",
    "page": "launches",
    "headline": "Show HN: Managing AI Models After Launch-Versioning, Evaluations, and Fallbacks",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T12:27:55.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Managing AI Models After Launch-Versioning, Evaluations, and Fallbacks"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35333",
    "page": "launches",
    "headline": "RepoTrace: Improving Requirement Tracing in Multi-Round Agent Interactions",
    "publisher": "arXiv",
    "published_at": "2026-10-26T12:30:22.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Code agents have become increasingly capable of performing software engineering tasks through interaction with software environments. However, agents tend to degrade as the number of interaction rounds increases, making it difficult to maintain existing software during iterative modification. We"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35985",
    "page": "models",
    "headline": "Let the Gate Decide: Per-Lookup Precision for Quantized Conditional Memory in LLMs",
    "publisher": "arXiv",
    "published_at": "2026-10-26T11:53:58.000Z",
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
        "excerpt": "Conditional memory layers, such as DeepSeek's Engram, attach large hashed n-gram tables to a language model, and removing them from DeepSeek-V4.1-Flash costs 36.8 PopQA points. Low-bit quantization loses long-tail facts first, and the standard remedy, giving more bits to frequently accessed rows,"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35130",
    "page": "models",
    "headline": "TUON: A Tensor-Aware Optimizer Utilizing Tensor-SVD and Polarization for Large Language Model Pretraining",
    "publisher": "arXiv",
    "published_at": "2026-10-26T10:04:25.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Large scale language model~(LLM) pretraining is increasingly bottlenecked by optimizer efficiency, driving optimizer design from vector-aware methods such as AdamW to matrix-aware methods. Matrix-aware optimizers such as Muon exploit matrix structure but treat layers independently, neglecting"
      }
    ]
  },
  {
    "id": "https://proc-cli.com/",
    "page": "launches",
    "headline": "Show HN: Proc-CLI – An agent-friendly CLI tool for process and port management",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T04:14:35.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Proc-CLI – An agent-friendly CLI tool for process and port management"
      }
    ]
  },
  {
    "id": "https://chromewebstore.google.com/detail/relay-continue-google-sea/fjjfadgooapnegipjocinojjhaajghag",
    "page": "models",
    "headline": "Show HN: Continue Your Google AI Mode Chats in Gemini/Claude",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T07:35:56.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I'd often make Google searches whose AI overviews would lead me to ask followups and create AI Mode threads. The key problem was that these chats were ephemeral. So I decided to make this extension that can help replay the chats and responses verbatim in your platform of choice (Gemini and Claude"
      }
    ]
  },
  {
    "id": "https://github.com/ykisana/skill-spotter",
    "page": "models",
    "headline": "Show HN: Skill-spotter, auto detect agent prompts and commands to create skills",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T06:48:10.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Skill-spotter auto detects commands and prompts you type. It detects variations such as 'push these changes' and 'get these changes pushed'. Using both word comparison and the actual actions you agent performs. It also adds to your Claude.md if that's more applicable than creating a skill. Just"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34887",
    "page": "launches",
    "headline": "NumTrace: Auditing the Number Provenance of Financial Analyst Agents",
    "publisher": "arXiv",
    "published_at": "2026-10-26T05:58:10.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "A numerical claim generated by a financial analyst agent can match a number in a company filing but refer to the wrong entity, concept, period, unit or scope. A check based on reference answers can mark such an answer as wrong but does not explain why it fails. In this paper, we present NumTrace, a"
      }
    ]
  },
  {
    "id": "https://github.com/nodecode-ai/nodecode",
    "page": "launches",
    "headline": "Show HN: Nodecode, open-source living agent in Lisp that rewrites itself for you",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T03:30:18.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN, we're Mike and Thom. Agents of the future should only have one tool (the interpreter, ideally a LISP eval), nothing more or less; to interact with the world. Agents remember by writing markdown files. NODECODE remembers by rewriting itself. And that is in itself a new paradigm in working"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34817",
    "page": "models",
    "headline": "Silent and Costly: Characterizing and Detecting Prompt-Caching Mis-Integration in LLM Agents",
    "publisher": "arXiv",
    "published_at": "2026-10-26T04:01:18.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Large language model (LLM) services process massive volumes of user requests, resulting in substantial inference costs. To reduce both cost and latency, providers have introduced prompt caching. However, correctly integrating prompt caching is non-trivial due to heterogeneous provider-specific APIs"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34781",
    "page": "models",
    "headline": "Uncovering the Turing Test's Latent Signal: Indistinguishability as a Reward",
    "publisher": "arXiv",
    "published_at": "2026-10-26T03:27:37.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Can a model learn by trying to fool another model? We show that it can. Inspired by the Turing Test and its recent generalization to arbitrary distinguishers, we introduce a domain-based teacher-Turing-Test, in which a stronger teacher model serves as both the target of imitation and the"
      }
    ]
  },
  {
    "id": "https://github.com/XiaoLuoLYG/GOD",
    "page": "launches",
    "headline": "Show HN: God – real-time control room for LLM agent societies (EMNLP 2026 demo)",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T02:11:28.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: God – real-time control room for LLM agent societies (EMNLP 2026 demo)"
      }
    ]
  },
  {
    "id": "https://sketchagent.dev/s/yfYU6LhT",
    "page": "models",
    "headline": "Show HN: A 3D mesh playground for coding agents (three.js + manifold-3d)",
    "publisher": "Hacker News",
    "published_at": "2026-10-26T00:02:39.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "When GPT-6&#x2F;Gemini launched recently, a lot of the 3D demos used blender-mcp (https:&#x2F;&#x2F;github.com&#x2F;ahujasid&#x2F;blender-mcp). It's cool, but you have to install blender locally and wire up plugins just to try a prompt or share a run. I built a browser-based 3D mesh playground so"
      }
    ]
  },
  {
    "id": "https://openai.com/index/gpt-6-1-sol-coderabbit-code-security",
    "page": "models",
    "headline": "GPT-6.1 Sol helps CodeRabbit strengthen security across complex codebases",
    "publisher": "OpenAI",
    "published_at": "2026-10-26T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "OpenAI",
        "excerpt": "CodeRabbit uses GPT-6.1 Sol to investigate security risks across complex codebases. Its security agent helps developers review findings and proposed fixes."
      },
      {
        "source_index": 1,
        "publisher": "OpenAI",
        "excerpt": "GPT-6.1 Sol helps CodeRabbit strengthen security across complex codebases"
      }
    ]
  },
  {
    "id": "https://openai.com/index/greptile-code-review-codex-astra",
    "page": "models",
    "headline": "Greptile takes bug detection beyond code review with GPT-6 Astra",
    "publisher": "OpenAI",
    "published_at": "2026-10-26T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "OpenAI",
        "excerpt": "How Greptile uses GPT-6 Astra to test user workflows, Daybreak to strengthen security, and Codex to reduce rework."
      }
    ]
  },
  {
    "id": "https://openai.com/index/introducing-gpt-6-1-terra",
    "page": "models",
    "headline": "Introducing GPT-6.1 Terra",
    "publisher": "OpenAI",
    "published_at": "2026-10-26T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "OpenAI",
        "excerpt": "Introducing GPT-6.1 Terra"
      },
      {
        "source_index": 1,
        "publisher": "OpenAI",
        "excerpt": "Bringing fast and capable computer use to everyone"
      }
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1527702/000166357726000330/0001663577-26-000330-index.htm",
    "page": "launches",
    "headline": "8-K — iQSTEL Inc (IQST)",
    "publisher": "SEC EDGAR",
    "published_at": "2026-10-26T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "SEC EDGAR",
        "excerpt": "PRESS RELEASE, DATED OCTOBER 26, 2026.; items 1.01, 2.03, 3.02, 8.01, 9.01; filed by iQSTEL Inc (IQST)"
      }
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/0001628280-26-067168-index.htm",
    "page": "funding",
    "headline": "S-1 — Anthropic, PBC",
    "publisher": "SEC EDGAR",
    "published_at": "2026-10-26T00:00:00.000Z",
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
        "publisher": "SEC EDGAR",
        "excerpt": "S-1; filed by Anthropic, PBC"
      }
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/790526/000168316826008094/0001683168-26-008094-index.htm",
    "page": "launches",
    "headline": "8-K — RadNet, Inc. (RDNT)",
    "publisher": "SEC EDGAR",
    "published_at": "2026-10-26T00:00:00.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "SEC EDGAR",
        "excerpt": "PRESS RELEASE DATED OCTOBER 26, 2026; items 1.01, 3.02, 7.01, 9.01; filed by RadNet, Inc. (RDNT)"
      }
    ]
  },
  {
    "id": "https://www.ft.com/content/e2aafede-771a-4fd0-b9fb-67c0bbb828ed",
    "page": "deals",
    "headline": "TPG pursues $5bn acquisition of UK data centre group Ark",
    "publisher": "Financial Times",
    "published_at": "2026-10-28T05:00:23.000Z",
    "companies": [],
    "extracted": {
      "amount": "$5B",
      "amount_usd": 5000000000
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
    "id": "https://github.com/radu2lupu/limitbreak",
    "page": "models",
    "headline": "Show HN: Limitbreak – Claude Code switches accounts mid-session on a limit",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T23:43:55.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Limitbreak – Claude Code switches accounts mid-session on a limit"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34634",
    "page": "launches",
    "headline": "AgentProofBench: Benchmarking Reusable Verifiers for Web Agents",
    "publisher": "arXiv",
    "published_at": "2026-10-25T23:20:28.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Reusable Web-agent verification requires a rule to follow changing requirements and support subsequent execution. We introduce AgentProofBench, which connects paired tests of a frozen acceptance rule to execution from identical saved openings. The resource spans 97 tasks, 79 families, and four Web"
      }
    ]
  },
  {
    "id": "https://github.com/elbee19/glitchrupt",
    "page": "launches",
    "headline": "Show HN: Glitchrupt: Glitch your desktop when your AI agent needs your attention",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T22:22:32.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I keep missing my AI agents' requests for my attention. So I had it build a thing that glitches the whole screen, like the glitches in the SpiderVerse movies."
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
    "id": "https://opensparta.com/en",
    "page": "launches",
    "headline": "Show HN: I built an AI agent to find customers on Telegram while I sleep",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T21:53:11.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: I built an AI agent to find customers on Telegram while I sleep"
      }
    ]
  },
  {
    "id": "https://github.com/carson-katri/geometry-script",
    "page": "models",
    "headline": "Show HN: A Blender addon that makes Claude twice as efficient at using nodes",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T21:50:46.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I originally made this addon 4 years ago, but recently discovered that coding agents love it. The addon adds a scripting API for Blender’s node trees, such as Geometry Nodes or Shader Nodes. It generates a function and related types for every node in Blender. Then the agent (or you) can write"
      }
    ]
  },
  {
    "id": "https://ramraj07.github.io/ra-mermaid",
    "page": "models",
    "headline": "Show HN: I added stacked subgraphs to Mermaid flowcharts",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T21:32:01.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I’m an avid user of mermaid but am constantly annoyed by their limitation that subgraphs do not follow direction if any internal nodes are connected to the outside. So I asked Claude to add a new syntax called stack layout and it seems to work pretty elegantly. I also fixed my annoyance with"
      }
    ]
  },
  {
    "id": "https://ledgeapp.dev/",
    "page": "launches",
    "headline": "Show HN: Ledge – an open-source app that puts the MacBook notch to work",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T20:04:52.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Ledge is free and open-source MacBook app that puts your idle notch into the work. It transforms the static notch into a status area: music, your next meeting, and more. It also keeps your agents work even when your lid is shut. Feel free to reach out if you have any feedback!"
      }
    ]
  },
  {
    "id": "https://github.com/fatlotus/sqlite-on-gcs-rapid",
    "page": "launches",
    "headline": "Show HN: SQLite-on-object storage using GCS Appendable Objects",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T19:50:01.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Recently, I have been playing around with GCS Rapid, a new API in GCS that lets you append to an existing object. It's pretty fast, and it's cool that you can do a log-structured merge tree on top to get a durable database without needing to run a server. Disclaimer: I am a Google employee, but"
      }
    ]
  },
  {
    "id": "https://github.com/Hybirdss/Hycli",
    "page": "launches",
    "headline": "Show HN: Hycli – reverse-engineer websites into CLI and MCP tools for AI agents",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T19:51:45.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Hycli – reverse-engineer websites into CLI and MCP tools for AI agents"
      }
    ]
  },
  {
    "id": "https://github.com/finereli/open-accountant",
    "page": "launches",
    "headline": "Show HN: Open Accountant – AI-customizable budgeting app for freelancers",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T18:18:13.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "This is my own very opinionated take on personal accounting &#x2F; budgeting for freelancers and small business owners operating in multiple currencies. A lot of this is influenced by my circumstances: - consultant &#x2F; freelancer &#x2F; business owner with multiple revenue streams - revenue"
      }
    ]
  },
  {
    "id": "https://optio.host/",
    "page": "launches",
    "headline": "Show HN: Optio – A self-hosted orchestration platform for AI agents",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T18:37:48.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hey HN! I shared Optio here back in March. Originally it was focused on getting swarms of coding agents (claude code&#x2F;codex) to drive PRs towards a merge by automatically resuming them on CI failures or PR comments. Since then, I've reworked the project to be a general platform for running any"
      }
    ]
  },
  {
    "id": "https://github.com/gantoine/muxer",
    "page": "launches",
    "headline": "Show HN: Muxer – Control cmux terminals from Android",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T18:25:22.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hey HN! As an avid user of cmux (https:&#x2F;&#x2F;cmux.com&#x2F;), I wanted a way to control terminal and agent sessions from my Android phone, so I built Muxer. The app talks to a tiny relay over HTTPS, that then talks to cmux through its local socket, and gives you to ability to: - Answer agent"
      }
    ]
  },
  {
    "id": "https://github.com/usejunior-sh/junior",
    "page": "launches",
    "headline": "Show HN: Junior – an open-source AI junior engineer that runs on your Mac",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T16:45:33.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN, I'm Samar, a software engineer. I built Junior because I was spending more time fixing CI issues, babysitting PRs and resolving merge conflicts. I thought maybe i should automate all of it, and that's why I started building Junior. Junior is an agent that runs locally on macOS and picks up"
      }
    ]
  },
  {
    "id": "https://getrad.dev/",
    "page": "launches",
    "headline": "Show HN: Radian, an agent puts development workflow on autopilot",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T16:41:36.000Z",
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
        "publisher": "Hacker News",
        "excerpt": "I have built an indie hacker project; my main flow was: 1. chatting with Claud Code about the general plan 2. assigning slices of work to other worker agents like Pi + DeepSeek 4.1 Flash 3. building in parallel 4. Claud Code reviews when done, runs tests, and merges after I validate It worked, but"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34440",
    "page": "models",
    "headline": "Speculative Decoding for Mixture-of-Experts Models: Expert Bytes, Kernel Bandwidth and the Best Draft Length",
    "publisher": "arXiv",
    "published_at": "2026-10-25T16:55:48.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Speculative decoding checks several drafted tokens in one verification pass. On a mixture-of-experts (MoE) model, consecutive tokens often select the same experts. A deduplicating engine reads each selected expert once per pass, so it requests fewer bytes than a per-slot engine, which reads it once"
      }
    ]
  },
  {
    "id": "https://huggingface.co/destined/hurston-1",
    "page": "models",
    "headline": "Show HN: Hurston-1 open source TTS that speak Southern American and Afro-English",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T01:30:13.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hey HN, I’m open sourcing my Hurston-1 narrowband TTS model (Apache-2.0). It is very good with American English and does especially well with Southern American and Regional African English accents. Destined AI is based in Atlanta, and I built this because I’m amazed by what AI can do, and I wanted"
      }
    ]
  },
  {
    "id": "https://qualitylayer.dev/",
    "page": "launches",
    "headline": "Show HN: QualityLayer, put the engineer back in the loop of your coding agent",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T16:08:39.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: QualityLayer, put the engineer back in the loop of your coding agent"
      }
    ]
  },
  {
    "id": "https://github.com/stubbi/openxet",
    "page": "models",
    "headline": "Show HN: OpenXet",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T09:29:43.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Xet [1] seems like a good idea in a world of ever more data hungry applications. It's used in Huggingface's service but the server side has been kept close source. I started reengineering it with Claude from the protocol descriptions to provide it for everyone. If you think it's cool, I am grateful"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34151",
    "page": "models",
    "headline": "Execution Logs Sway VLM Judges of Robot Progress",
    "publisher": "arXiv",
    "published_at": "2026-10-25T08:37:41.000Z",
    "companies": [
      {
        "slug": "alibaba-qwen",
        "name": "Alibaba Qwen"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Vision-language models now grade robot videos, and text placed beside the frames can change their verdicts. On clips where the robot is losing progress, we add one log line saying the robot is making progress. Across Gemini, Qwen and GPT judges, this flips correct verdicts to progress 10 to 35"
      }
    ]
  },
  {
    "id": "https://www.theguardian.com/film/2026/oct/27/elon-musk-ai-odyssey-movie-grok-christopher-nolan",
    "page": "models",
    "headline": "Elon Musk’s AI Odyssey review – the dullest, most pointless riposte possible to Christopher Nolan’s brilliant epic",
    "publisher": "The Guardian",
    "published_at": "2026-10-27T13:01:46.000Z",
    "companies": [
      {
        "slug": "xai",
        "name": "xAI"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "It is hardly a shock that Grok AI’s interpretation of Homer is as meaningless as a laptop screensaver. The only surprise would be if Musk accepted defeat graciously. Which he won’t Think back. Do you remember when Elon Musk, in a weird online tantrum, and without having seen the film, condemned the"
      }
    ]
  },
  {
    "id": "https://github.com/Tomotsugu-dev/Hindsight",
    "page": "launches",
    "headline": "Show HN: Hindsight – Lightweight, elegant, open-source tracker for Windows/macOS",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T07:04:10.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi HN, I’m building Hindsight, a free, open-source activity tracker for Windows and macOS. I know there are plenty of time trackers. I wanted something that combined automatic tracking, detailed charts, and cross-device sync in a lightweight app with an interface I enjoyed using. I couldn’t find a"
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
    "id": "https://news.ycombinator.com/item?id=50227527",
    "page": "launches",
    "headline": "Show HN: ReVault – new secure archive format",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T02:01:21.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "reVault is a new, secure-by-default archive format called a lockbox, designed to be simple to use. I've been working on reVault for about 2 years. It was originally written in Dart, but with the improvements in AI, I decided to port it to Rust using AI. It's now in beta, so I'm looking for"
      }
    ]
  },
  {
    "id": "https://github.com/ajaynyayapathi/yara-l-skill",
    "page": "launches",
    "headline": "Show HN: AgentSkill – Yara-L-Skill",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T03:32:56.000Z",
    "companies": [
      {
        "slug": "alphabet",
        "name": "Alphabet (Google)"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "An Agent Skill that teaches AI coding agents to write, review, tune, and convert YARA-L 2.0 detection rules for Google Security Operations (SecOps, formerly Chronicle)."
      }
    ]
  },
  {
    "id": "https://firmendaten.researchly.at/netzwerk",
    "page": "launches",
    "headline": "Show HN: Close the UI building AI agent loop with Protoshot",
    "publisher": "Hacker News",
    "published_at": "2026-10-25T03:10:26.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Protoshot scans your css files and components and lets you write just some JSX to preview it. A much simpler setup than having to orchestrate agent-browser or puppeteer instance for just seeing what UI looks like."
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "At Researchly (https:&#x2F;&#x2F;www.researchly.at) we automate market and competitive analysis. We learned that on-the-fly web search through AI agents isn't reliable enough for consistent, in-depth work. Existing data providers such as PitchBook or Crunchbase are either too expensive or lack the"
      }
    ]
  },
  {
    "id": "https://github.com/orgiggly/claude-plugin",
    "page": "models",
    "headline": "Show HN: Orgiggly – Claude Code plugin that hosts the apps it builds",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T23:39:50.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Orgiggly – Claude Code plugin that hosts the apps it builds"
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
    "extracted": {
      "amount": "$400M",
      "amount_usd": 400000000
    },
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Ex-Merseyside police officer lands $400mn valuation for AI venture"
      }
    ]
  },
  {
    "id": "https://deepsearch.ing/",
    "page": "models",
    "headline": "Show HN: DeepSearch – Search engine built on DeepSeek API",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T22:44:35.000Z",
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
        "publisher": "Hacker News",
        "excerpt": "DeepSeek launched their search API so I had to build a search engine on top of it. The search engine is very simple: add your DeepSeek API credentials or OAuth with your DeepSeek account and you can search the web using their API and view results in a familiar web interface. Credentials are stored"
      }
    ]
  },
  {
    "id": "https://huggingface.co/JakCwi/eugen-sparse",
    "page": "models",
    "headline": "Show HN: Sparse kernel delivering 36% higher training throughput",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T23:25:57.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I developed a custom GPU kernel in Triton to accelerate training with a sparse feed-forward network (FFN). With K=256, activating 256 of 4,096 FFN neurons per token (6.25%), the sparse model achieved 36% higher training throughput than its dense counterpart. The kernel has so far been tested on a"
      }
    ]
  },
  {
    "id": "https://github.com/DainoJung/omni-verify",
    "page": "launches",
    "headline": "Show HN: Omni Verify, my AI agent can't post until Kane checks every promise",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T23:15:01.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Omni Verify, my AI agent can't post until Kane checks every promise"
      }
    ]
  },
  {
    "id": "https://chatgpt.com/plugins/plugin_asdk_app_6abdec89d46c81919cda058ca9f62cb8?search=call4me",
    "page": "launches",
    "headline": "Show HN: Call4me – a ChatGPT plugin that lets it make phone calls on your behalf",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T22:00:59.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Call4me – a ChatGPT plugin that lets it make phone calls on your behalf"
      }
    ]
  },
  {
    "id": "https://perchfocus.com/",
    "page": "models",
    "headline": "Show HN: Perch, a calm Mac app for juggling Claude Code sessions",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T21:01:39.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I'm an engineer, but I also hate using tools that make things overcomplicated. It's also tough with the new pace of AI-driven development to really get into the flow state, and maintain (still needed!) focus on 1 thing. So I built a tool that I actually want to use every day. Curious if others"
      }
    ]
  },
  {
    "id": "https://github.com/gtanczyk/genaicode",
    "page": "models",
    "headline": "Show HN: Claude Code(and others) embedded in your app",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T20:54:27.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I started this project in 2024 when I got fascinated with LLMs, and what I did was a coding agent (CLI -> interactive -> GUI). I also added an integration with Vite for having it embedded inside my apps(mostly games). Few months ago I pivoted it to become a low profile AI provider wrapper library"
      }
    ]
  },
  {
    "id": "https://roush.io/paste-buff",
    "page": "models",
    "headline": "Show HN: The missing clipboard history for macOS that idles at 16 MB",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T18:15:23.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Been using Raycast solely for it's paste history feature. When profiling saw high memory usage and decided to see how performant I could make a tool that only does paste history. Had Claude start with Tauri, GPUI then finally appkit code."
      }
    ]
  },
  {
    "id": "https://apps.apple.com/us/app/orisuji/id6817092898",
    "page": "launches",
    "headline": "Show HN: Orisuji, a maze you solve by folding your phone",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T16:34:39.000Z",
    "companies": [
      {
        "slug": "apple",
        "name": "Apple"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "When Apple announced the iPhone Duo I felt the same excitement that I had felt when I got my first iPhone, way back when. I remember playing Tap Tap Revenge, Fruit Ninja and all those other games that really took advantage of the new hardware to create new experiences. I also loved playing cute"
      }
    ]
  },
  {
    "id": "https://jameswniu.github.io/multi-agent-causal-marriage-simulation",
    "page": "launches",
    "headline": "Show HN: A randomized controlled trial run inside an agent simulation",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T18:20:15.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: A randomized controlled trial run inside an agent simulation"
      }
    ]
  },
  {
    "id": "https://github.com/eliasaronson/lobole",
    "page": "models",
    "headline": "Show HN: Loböle, open-source parametric CAD that AI agents can drive",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T16:58:21.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I could never get used to FreeCAD, so I built my own. It turns out Claude is really good at using it. Loböle is a parametric B-Rep CAD built on OpenCASCADE and Vulkan, with sketches, assemblies, drawings, FEM and CAM. The GUI, Python scripts and AI agents all go through the same commands, so an"
      }
    ]
  },
  {
    "id": "https://app.enclave.ai/threat-feed",
    "page": "launches",
    "headline": "Show HN: AI agent swarms test if new CVEs are exploitable in your env",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T16:00:05.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: AI agent swarms test if new CVEs are exploitable in your env"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33746",
    "page": "models",
    "headline": "ProtAgent: Post-Training Compact Protein Tool Agents with Interaction-Level Credit Assignment",
    "publisher": "arXiv",
    "published_at": "2026-10-24T15:42:13.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Protein annotation agents must choose suitable bioinformatics tools, interpret their outputs, and use the resulting evidence in the final answer. Most existing systems rely on frontier-scale models. We ask whether a compact model can instead learn this behavior through post-training with real tool"
      }
    ]
  },
  {
    "id": "https://github.com/JochenBaier/AlwaysHex",
    "page": "models",
    "headline": "Show HN: Visual Studio extension that shows decimal and hex in the debugger",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T14:29:46.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "For quite some time I've wanted to write a Visual Studio extension that shows both decimal and hex values while debugging. With Claude Code, I've now been able to make it happen. Name: AlwaysHex."
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
    "id": "https://www.theguardian.com/technology/2026/oct/26/iphone-duo-owners-cracks-apple-first-foldable-handset",
    "page": "launches",
    "headline": "Microsoft to reportedly offer buyouts to 60,000 employees in latest cuts",
    "publisher": "The Guardian",
    "published_at": "2026-10-26T18:44:31.000Z",
    "companies": [
      {
        "slug": "microsoft",
        "name": "Microsoft"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Guardian",
        "excerpt": "Tech company offers buyouts in an effort to reduce costs amid the rising use of AI, according to reports Microsoft announced that it would offer buyouts to 60,000 employees in an effort to reduce costs amid the rising use of artificial intelligence, according to reports, the latest example of how"
      },
      {
        "source_index": 1,
        "publisher": "The Guardian",
        "excerpt": "iPhone Duo owners report cracks in Apple’s first foldable handset"
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
    "id": "https://mantid.dev/",
    "page": "launches",
    "headline": "Show HN: Mantid, a Mac app that lets non-ML people train their own AI models",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T12:49:06.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Mantid, a Mac app that lets non-ML people train their own AI models"
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
    "id": "https://covenant-common.github.io/covenant-docs",
    "page": "launches",
    "headline": "Show HN: Multipeer, a multiplayer infinite canvas for people and their agents",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T09:05:28.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I'm building Multipeer, a desktop app for running agents, tools and working wth teammates on one shared canvas. I often have several agent sessions open at once, but they're all scattered across terminals. It was also hard for my co-founder to see what my agents are doing or jump in to work"
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "Hi team, Have been working on something to help agents draft complex agreements with other agents and also have a way to figure out if agreements have been upheld, revise existing agreements, make payments and hold monies in escrow, resort to evidence elsewhere etc. and store this on the blockchain"
      },
      {
        "source_index": 2,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Agent Referee – signed, checkable reviews and tie-breaks for AI agents"
      }
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50220217",
    "page": "launches",
    "headline": "Show HN: MCP server that answers Steam launch questions with real counts",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T11:21:38.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: MCP server that answers Steam launch questions with real counts"
      }
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50219762",
    "page": "models",
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
    "page": "launches",
    "headline": "Can Agentic Code Review Catch Vulnerabilities Before They Are Merged?",
    "publisher": "arXiv",
    "published_at": "2026-10-24T07:32:42.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "LLM agents have been increasingly adopted for security-focused code review, but existing benchmarks mostly derive the reviewed changes from their later fixes instead of the real-world bug-introducing commits. In this paper, we present SecPRBench, the first comprehensive benchmark for evaluating"
      }
    ]
  },
  {
    "id": "https://console.usetd.com/",
    "page": "launches",
    "headline": "Show HN: Let your AI agent put things on a screen",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T05:59:23.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Let your AI agent put things on a screen"
      }
    ]
  },
  {
    "id": "https://github.com/insanai/ccm",
    "page": "models",
    "headline": "Show HN: Code Counter Machine a modern analysis of AI driven development costs",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T05:47:12.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "I worked a lot with cloc, sloc and scc and used them in various prohects. But with AI driven development some of the models COCOMO I and II might not be applicable. So built a new cli ccm short for code counter machine with new calculation model which estimate the new AI driven development costs."
      }
    ]
  },
  {
    "id": "https://pilely.ai/",
    "page": "launches",
    "headline": "Show HN: Pilely – Build and ship web apps within your AI chat",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T05:32:49.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Pilely – Build and ship web apps within your AI chat"
      }
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33472",
    "page": "models",
    "headline": "Qwen-Image-PE: Learning Visual Design for Text-to-Image Prompt Enhancement",
    "publisher": "arXiv",
    "published_at": "2026-10-24T05:50:40.000Z",
    "companies": [
      {
        "slug": "alibaba-qwen",
        "name": "Alibaba Qwen"
      }
    ],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "arXiv",
        "excerpt": "Learning visual design is essential for prompt enhancement (PE) to turn underspecified user requests into coherent visual specifications for text-to-image (T2I) generation. Existing methods preserve user intent and improve overall visual appeal, with less explicit emphasis on fine-grained design"
      }
    ]
  },
  {
    "id": "https://messh.io/",
    "page": "launches",
    "headline": "Show HN: Web Bot Auth SDK and SSH Utilty",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T03:27:01.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Launched a beta&#x2F;buggy version of the SDK for web bot auth, and it's live at https:&#x2F;&#x2F;messh.io Inspired by https:&#x2F;&#x2F;datatracker.ietf.org&#x2F;wg&#x2F;webbotauth&#x2F;documents&#x2F; While solving this, I realized it solves the hassle of adding SSH keys, the overhead of"
      }
    ]
  },
  {
    "id": "https://github.com/VenoM9078/gradientdeck-skill",
    "page": "launches",
    "headline": "Show HN: Task-view – review a coding agent’s change as a map instead of a diff",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T00:11:40.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Task-view – review a coding agent’s change as a map instead of a diff"
      },
      {
        "source_index": 1,
        "publisher": "Hacker News",
        "excerpt": "Show HN: GradientDeck – a design skill for coding agents"
      },
      {
        "source_index": 2,
        "publisher": "Hacker News",
        "excerpt": "This is hardly a greenfield area. There are tons of agent-to-agent communication apps. But, at least to my taste, a lot of them are too complicated or too opinionated. If we learned anything from the HuggingFace incident, it's that modern AI agents don't need a lot of help communicating. They are"
      },
      {
        "source_index": 3,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Snippet – An Always-On AI Agent"
      },
      {
        "source_index": 4,
        "publisher": "Hacker News",
        "excerpt": "Hi HN, I built an always on always listening AI Agent, here's some backstory: I've always struggled with the attention problem while developing. Even with agents, I can work fast, but I don't know if I can keep working for long, or if I can come back to a problem once I get distracted. So a little"
      }
    ]
  },
  {
    "id": "https://privacymeridian.org/",
    "page": "models",
    "headline": "Show HN: Privacy Meridian, navigate global privacy laws",
    "publisher": "Hacker News",
    "published_at": "2026-10-24T00:56:18.000Z",
    "companies": [],
    "extracted": {},
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Hi, I'm a Privacy PM who has worked at Fortune 5 companies for most of my career. One of the gaps I always faced was a quick way to look up in-effect privacy laws and their various nuances jurisdiction by jurisdiction. So with some help from attorney and engineer friends&#x2F;colleagues, and Claude"
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

