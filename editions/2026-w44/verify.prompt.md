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
(week `2026-w44`, prompt version `1`). The deterministic
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
  "week": "2026-w44",
  "prompt_version": 1,
  "sentences": [
  "Anthropic filed for an IPO this week, a landmark step for a frontier AI lab.",
  "AI dealmaking also brought Microsoft's first US bond sale since 2017, a raise of at least $25 billion.",
  "On the model side, Google shipped Gemini 4 Carbon, now ranked #1 on the Artificial Analysis Intelligence Index, alongside the Genie 4 world simulator, while Nvidia opened a transcription model covering 40 languages.",
  "Agent tooling kept expanding as Cursor released its Agent SDK, Meta brought its Muse personal agent to Singapore, and Amazon taught Alexa to manage shopping lists.",
  "Dealmaking crossed categories: a US agency approved Amazon Leo's $11.5 billion acquisition of Globalstar, and Deepgram bought Pipecat developer Daily for its voice-AI stack.",
  "In Washington, officials pressed AI executives to quiet public commentary, while a lawsuit alleged ChatGPT coached a child off her seizure medication."
],
  "supports": {
  "0": [
    "funding-0"
  ],
  "1": [
    "funding-4"
  ],
  "2": [
    "models-0",
    "performance-0",
    "models-2",
    "models-1"
  ],
  "3": [
    "launches-3",
    "launches-1",
    "launches-0"
  ],
  "4": [
    "deals-3",
    "deals-0",
    "deals-2"
  ],
  "5": [
    "discourse-2",
    "discourse-0"
  ]
},
  "items": [
  {
    "id": "models-0",
    "page": "models",
    "headline": "Gemini 4 Carbon",
    "one_liner": "Gemini 4 Carbon is Google's new flagship model, aimed at agentic and coding workloads.",
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
    "id": "models-1",
    "page": "models",
    "headline": "NVIDIA Nemotron 3.5 Transcribe and Granary v2: Intelligent Multilingual Transcription You Can Prompt and Adapt",
    "one_liner": "Nvidia open-sourced Nemotron 3.5 Transcribe and Granary v2, promptable transcription models covering 40 languages.",
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
    "id": "models-2",
    "page": "models",
    "headline": "Genie 4: A new generation of world simulation",
    "one_liner": "DeepMind's Genie 4 generates interactive world simulations in real time.",
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
    "id": "models-3",
    "page": "models",
    "headline": "Introducing AnySpeechRecognizer and AnyDecisionModel: Open Models for Speech and Decisions on Apple Platforms",
    "one_liner": "Apple released AnySpeechRecognizer and AnyDecisionModel, open models that run on-device.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hugging Face",
        "excerpt": "Introducing AnySpeechRecognizer and AnyDecisionModel: Open Models for Speech and Decisions on Apple Platforms"
      }
    ]
  },
  {
    "id": "models-4",
    "page": "models",
    "headline": "Google launches Gemini 4 Carbon with a ‘significant leap’ in cybersecurity",
    "one_liner": "Google says Gemini 4 Carbon brings significant gains in coding, agentic tasks, and cybersecurity.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Google has released its latest frontier model, Gemini 4 Carbon, offering \"significant gains\" in coding, agentic tasks, and cybersecurity. In an announcement on Wednesday, Google highlights Carbon's top spot on the Artificial Analysis Intelligence Index (v5.0) benchmark, with Claude Opus 5.5 and"
      }
    ]
  },
  {
    "id": "models-5",
    "page": "models",
    "headline": "Google announces Gemini 4 Carbon, its latest frontier AI model that you can't use",
    "one_liner": "Ars reports Gemini 4 Carbon is a modest upgrade over Argon rather than a leap.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Ars Technica",
        "excerpt": "Gemini 4 Carbon is essentially a slightly better version of Argon."
      }
    ]
  },
  {
    "id": "performance-0",
    "page": "performance",
    "headline": "Gemini 4 Carbon is the new #1 on the Artificial Analysis Intelligence Index v5",
    "one_liner": "Google's Gemini 4 Carbon took the top spot on the Artificial Analysis Intelligence Index v5.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Gemini 4 Carbon is the new #1 on the Artificial Analysis Intelligence Index v5"
      }
    ]
  },
  {
    "id": "performance-1",
    "page": "performance",
    "headline": "Microsoft recorded $10 billion in revenue from OpenAI",
    "one_liner": "Microsoft recorded $10 billion in revenue from OpenAI this quarter.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Microsoft said it made $10 billion in revenue from commercial arrangements with OpenAI, including revenue-sharing payments, in the quarter ending September 30. It underscores the still-enormous financial dependency of the partnership."
      }
    ]
  },
  {
    "id": "performance-2",
    "page": "performance",
    "headline": "Google Drops a Record 13% After Sales Miss Sparks AI Skepticism",
    "one_liner": "Alphabet's revenue missed estimates and shares dropped more than 13%.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Alphabet Inc.’s shares fell more than 13%, for its biggest-ever market value wipeout, after the company reported disappointing search and advertising sales that reinforced investor concerns about AI’s threat to its core business."
      }
    ]
  },
  {
    "id": "performance-3",
    "page": "performance",
    "headline": "LMArena text — Claude Fable 5 (High) (#11)",
    "one_liner": "Claude Fable 5 (High) sits at rank 11 on LMArena's text leaderboard with a 1491 rating.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "LMArena",
        "excerpt": "rank: 11 · rating: 1491.5611245046712 · vote_count: 45341 · organization: anthropic · leaderboard_publish_date: 2026-10-28"
      }
    ]
  },
  {
    "id": "launches-0",
    "page": "launches",
    "headline": "Amazon updates Alexa to help you manage shopping lists, subscriptions, and update delivery instructions",
    "one_liner": "Alexa can now build and manage shopping lists and subscriptions for Amazon customers.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "The update allows you to use Alexa to create lists, register them, see what's on them, and add or edit items. You can also manage subscriptions with the AI bot."
      }
    ]
  },
  {
    "id": "launches-1",
    "page": "launches",
    "headline": "The Agent SDK",
    "one_liner": "Cursor's Agent SDK lets developers embed its coding agent into their own applications.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "The Agent SDK"
      }
    ]
  },
  {
    "id": "launches-2",
    "page": "launches",
    "headline": "Meta quietly launched an ‘AI pet journal’ app",
    "one_liner": "Meta quietly released Waddle World, a tamagotchi-style AI pet journal app.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Meta has launched a \"tamagotchi-style\" pet game called Waddle World, with virtual creatures that chat with users and create doodles to illustrate conversations. According to its Apple and Play Store listings, the \"16-bit pet care game\" is not really a game, but \"a daily journal disguised as a pet.\""
      }
    ]
  },
  {
    "id": "launches-3",
    "page": "launches",
    "headline": "Muse Is Now Available in Singapore: The World’s First Personal AI Agent Built for Everyone",
    "one_liner": "Meta launched Muse in Singapore, billing it as a personal AI agent for everyone.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Meta",
        "excerpt": "Muse Is Now Available in Singapore: The World’s First Personal AI Agent Built for Everyone"
      }
    ]
  },
  {
    "id": "launches-4",
    "page": "launches",
    "headline": "Firefox’s Smart Window adds AI form filling and webpage monitoring",
    "one_liner": "Firefox's Smart Window now fills online forms and monitors webpages with AI.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Mozilla is updating Smart Window - Firefox's AI-powered browsing experience - with a new feature that can help you fill out online forms based on your open tabs. As an example, Mozilla says Smart Window can pull information from your online portfolio or LinkedIn page to paste your work history into"
      }
    ]
  },
  {
    "id": "funding-0",
    "page": "funding",
    "headline": "Anthropic files for IPO",
    "one_liner": "Anthropic's S-1 frames compute spending as its core business case for going public.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "The Anthropic S-1 seems to have provided the financial justification for the company to spend as much as it possibly can on compute. If you are the kind of person who wonders if Anthropic is doing its level best to build a machine god while convincing Wall Street it's in the business of selling IT"
      }
    ]
  },
  {
    "id": "funding-1",
    "page": "funding",
    "headline": "Opentrons raised $40M Series E led by Avego",
    "one_liner": "Opentrons raised $40 million Series E led by Avego to standardize AI-driven science on its lab robots.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "LONG ISLAND CITY, N.Y.--(BUSINESS WIRE)--Opentrons Labworks Inc., the leader in open, AI-native laboratory automation, today announced a $40 million Series E financing led by healthcare investor Avego, with additional investment from BroadOak Capital Partners. Opentrons will use the capital to"
      }
    ]
  },
  {
    "id": "funding-2",
    "page": "funding",
    "headline": "TrashLab raised $12M Growth led by Ventana",
    "one_liner": "TrashLab raised $12 million in a growth round led by Ventana for its AI-native waste-hauler OS.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--TrashLab, an AI-native operating system for waste haulers, today announced it has raised a $12 million growth round led by early-growth equity firm Ventana, with participation from existing investors Bienville Capital, Harlem Capital, and CreativeCo. TrashLab will"
      }
    ]
  },
  {
    "id": "funding-3",
    "page": "funding",
    "headline": "Solink raised $100M Growth led by Vertu Capital",
    "one_liner": "Solink raised more than $100 million led by Vertu Capital for AI vision intelligence in physical operations.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "OTTAWA, Ontario--(BUSINESS WIRE)--Solink®, a leader in AI Vision Intelligence, today announced more than $100 million in new funding led by Vertu Capital, with material participation from existing investor Growth Equity at Goldman Sachs Alternatives and participation from new investors, Golub"
      }
    ]
  },
  {
    "id": "funding-4",
    "page": "funding",
    "headline": "Microsoft raised $25B",
    "one_liner": "Microsoft is raising at least $25 billion in its first US bond sale in nine years to fund AI buildout.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "Microsoft Corp. is looking to raise at least $25 billion from its first US investment-grade bond sale in more than nine years, joining rivals in a relentless borrowing spree to fund the artificial intelligence boom."
      }
    ]
  },
  {
    "id": "funding-5",
    "page": "funding",
    "headline": "Wabi raised $55M",
    "one_liner": "Wabi raised $55 million at a $1.25 billion valuation for group coordination with AI agents.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Bloomberg",
        "excerpt": "AI assistant startup Wabi Inc. has raised $55 million at a $1.25 billion valuation to build out its software that lets groups of people interact with artificial intelligence agents to coordinate activities and make collective decisions."
      }
    ]
  },
  {
    "id": "deals-0",
    "page": "deals",
    "headline": "US agency approves Amazon Leo’s $11.5B acquisition of Globalstar",
    "one_liner": "A US agency cleared Amazon Leo's $11.5 billion purchase of Globalstar, advancing its satellite network.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "US agency approves Amazon Leo’s $11.5B acquisition of Globalstar"
      }
    ]
  },
  {
    "id": "deals-1",
    "page": "deals",
    "headline": "Xsolla Acquires GamePix to Build a Complete Platform for Web and AI-Created Video Games",
    "one_liner": "Xsolla bought GamePix, adding a 10,000-title web-games catalog to its commerce platform.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "LOS ANGELES--(BUSINESS WIRE)--Xsolla, a global commerce company, today announced it acquired GamePix, the web games platform that publishes and distributes browser games worldwide. GamePix brings a catalog of 10,000+ web titles, a community of 4,000+ developers, and a publishing solution that"
      }
    ]
  },
  {
    "id": "deals-2",
    "page": "deals",
    "headline": "Deepgram acquires Pipecat-maker Daily to bolster its voice AI infrastructure",
    "one_liner": "Deepgram bought Pipecat-maker Daily and pledged to keep Pipecat open source.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "Deepgram said that it is committed to keep Pipecat open source."
      }
    ]
  },
  {
    "id": "deals-3",
    "page": "deals",
    "headline": "Amazon to buy satellite firm Globalstar in $11.57B deal",
    "one_liner": "Amazon agreed to buy satellite operator Globalstar for $11.57 billion to build out its Leo network.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Amazon to buy satellite firm Globalstar in $11.57B deal"
      }
    ]
  },
  {
    "id": "markets-0",
    "page": "markets",
    "headline": "AMD (AMD) 560.26 8.41%",
    "one_liner": "",
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
      },
      {
        "source_index": 2,
        "publisher": "Exa Markets",
        "excerpt": "US:AMZN — raw closing price series. 2026-10-23 USD 248.00. 2026-10-26 USD 249.09. 2026-10-27 USD 253.10."
      },
      {
        "source_index": 3,
        "publisher": "Exa Markets",
        "excerpt": "US:GOOGL — raw closing price series. 2026-10-23 USD 320.21. 2026-10-26 USD 316.80. 2026-10-27 USD 320.58."
      },
      {
        "source_index": 4,
        "publisher": "Exa Markets",
        "excerpt": "US:META — raw closing price series. 2026-10-23 USD 642.62. 2026-10-26 USD 630.56. 2026-10-27 USD 620.19."
      },
      {
        "source_index": 5,
        "publisher": "Exa Markets",
        "excerpt": "US:NVDA — raw closing price series. 2026-10-23 USD 210.96. 2026-10-26 USD 216.00. 2026-10-27 USD 217.94."
      },
      {
        "source_index": 6,
        "publisher": "Exa Markets",
        "excerpt": "US:MSFT — raw closing price series. 2026-10-23 USD 524.51. 2026-10-26 USD 532.60. 2026-10-27 USD 531.33."
      },
      {
        "source_index": 7,
        "publisher": "Exa Markets",
        "excerpt": "US:TSM — raw closing price series. 2026-10-23 USD 418.51. 2026-10-26 USD 424.37. 2026-10-27 USD 436.87."
      }
    ]
  },
  {
    "id": "markets-1",
    "page": "markets",
    "headline": "AMZN (Amazon) 253.1 2.06%",
    "one_liner": "",
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
      },
      {
        "source_index": 2,
        "publisher": "Exa Markets",
        "excerpt": "US:AMZN — raw closing price series. 2026-10-23 USD 248.00. 2026-10-26 USD 249.09. 2026-10-27 USD 253.10."
      },
      {
        "source_index": 3,
        "publisher": "Exa Markets",
        "excerpt": "US:GOOGL — raw closing price series. 2026-10-23 USD 320.21. 2026-10-26 USD 316.80. 2026-10-27 USD 320.58."
      },
      {
        "source_index": 4,
        "publisher": "Exa Markets",
        "excerpt": "US:META — raw closing price series. 2026-10-23 USD 642.62. 2026-10-26 USD 630.56. 2026-10-27 USD 620.19."
      },
      {
        "source_index": 5,
        "publisher": "Exa Markets",
        "excerpt": "US:NVDA — raw closing price series. 2026-10-23 USD 210.96. 2026-10-26 USD 216.00. 2026-10-27 USD 217.94."
      },
      {
        "source_index": 6,
        "publisher": "Exa Markets",
        "excerpt": "US:MSFT — raw closing price series. 2026-10-23 USD 524.51. 2026-10-26 USD 532.60. 2026-10-27 USD 531.33."
      },
      {
        "source_index": 7,
        "publisher": "Exa Markets",
        "excerpt": "US:TSM — raw closing price series. 2026-10-23 USD 418.51. 2026-10-26 USD 424.37. 2026-10-27 USD 436.87."
      }
    ]
  },
  {
    "id": "markets-2",
    "page": "markets",
    "headline": "GOOGL (Alphabet) 320.58 0.12%",
    "one_liner": "",
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
      },
      {
        "source_index": 2,
        "publisher": "Exa Markets",
        "excerpt": "US:AMZN — raw closing price series. 2026-10-23 USD 248.00. 2026-10-26 USD 249.09. 2026-10-27 USD 253.10."
      },
      {
        "source_index": 3,
        "publisher": "Exa Markets",
        "excerpt": "US:GOOGL — raw closing price series. 2026-10-23 USD 320.21. 2026-10-26 USD 316.80. 2026-10-27 USD 320.58."
      },
      {
        "source_index": 4,
        "publisher": "Exa Markets",
        "excerpt": "US:META — raw closing price series. 2026-10-23 USD 642.62. 2026-10-26 USD 630.56. 2026-10-27 USD 620.19."
      },
      {
        "source_index": 5,
        "publisher": "Exa Markets",
        "excerpt": "US:NVDA — raw closing price series. 2026-10-23 USD 210.96. 2026-10-26 USD 216.00. 2026-10-27 USD 217.94."
      },
      {
        "source_index": 6,
        "publisher": "Exa Markets",
        "excerpt": "US:MSFT — raw closing price series. 2026-10-23 USD 524.51. 2026-10-26 USD 532.60. 2026-10-27 USD 531.33."
      },
      {
        "source_index": 7,
        "publisher": "Exa Markets",
        "excerpt": "US:TSM — raw closing price series. 2026-10-23 USD 418.51. 2026-10-26 USD 424.37. 2026-10-27 USD 436.87."
      }
    ]
  },
  {
    "id": "markets-3",
    "page": "markets",
    "headline": "META (Meta) 620.19 -3.49%",
    "one_liner": "",
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
      },
      {
        "source_index": 2,
        "publisher": "Exa Markets",
        "excerpt": "US:AMZN — raw closing price series. 2026-10-23 USD 248.00. 2026-10-26 USD 249.09. 2026-10-27 USD 253.10."
      },
      {
        "source_index": 3,
        "publisher": "Exa Markets",
        "excerpt": "US:GOOGL — raw closing price series. 2026-10-23 USD 320.21. 2026-10-26 USD 316.80. 2026-10-27 USD 320.58."
      },
      {
        "source_index": 4,
        "publisher": "Exa Markets",
        "excerpt": "US:META — raw closing price series. 2026-10-23 USD 642.62. 2026-10-26 USD 630.56. 2026-10-27 USD 620.19."
      },
      {
        "source_index": 5,
        "publisher": "Exa Markets",
        "excerpt": "US:NVDA — raw closing price series. 2026-10-23 USD 210.96. 2026-10-26 USD 216.00. 2026-10-27 USD 217.94."
      },
      {
        "source_index": 6,
        "publisher": "Exa Markets",
        "excerpt": "US:MSFT — raw closing price series. 2026-10-23 USD 524.51. 2026-10-26 USD 532.60. 2026-10-27 USD 531.33."
      },
      {
        "source_index": 7,
        "publisher": "Exa Markets",
        "excerpt": "US:TSM — raw closing price series. 2026-10-23 USD 418.51. 2026-10-26 USD 424.37. 2026-10-27 USD 436.87."
      }
    ]
  },
  {
    "id": "markets-4",
    "page": "markets",
    "headline": "MSFT (Microsoft) 531.33 1.3%",
    "one_liner": "",
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
      },
      {
        "source_index": 2,
        "publisher": "Exa Markets",
        "excerpt": "US:AMZN — raw closing price series. 2026-10-23 USD 248.00. 2026-10-26 USD 249.09. 2026-10-27 USD 253.10."
      },
      {
        "source_index": 3,
        "publisher": "Exa Markets",
        "excerpt": "US:GOOGL — raw closing price series. 2026-10-23 USD 320.21. 2026-10-26 USD 316.80. 2026-10-27 USD 320.58."
      },
      {
        "source_index": 4,
        "publisher": "Exa Markets",
        "excerpt": "US:META — raw closing price series. 2026-10-23 USD 642.62. 2026-10-26 USD 630.56. 2026-10-27 USD 620.19."
      },
      {
        "source_index": 5,
        "publisher": "Exa Markets",
        "excerpt": "US:NVDA — raw closing price series. 2026-10-23 USD 210.96. 2026-10-26 USD 216.00. 2026-10-27 USD 217.94."
      },
      {
        "source_index": 6,
        "publisher": "Exa Markets",
        "excerpt": "US:MSFT — raw closing price series. 2026-10-23 USD 524.51. 2026-10-26 USD 532.60. 2026-10-27 USD 531.33."
      },
      {
        "source_index": 7,
        "publisher": "Exa Markets",
        "excerpt": "US:TSM — raw closing price series. 2026-10-23 USD 418.51. 2026-10-26 USD 424.37. 2026-10-27 USD 436.87."
      }
    ]
  },
  {
    "id": "markets-5",
    "page": "markets",
    "headline": "TSM (TSMC) 436.87 4.39%",
    "one_liner": "",
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
      },
      {
        "source_index": 2,
        "publisher": "Exa Markets",
        "excerpt": "US:AMZN — raw closing price series. 2026-10-23 USD 248.00. 2026-10-26 USD 249.09. 2026-10-27 USD 253.10."
      },
      {
        "source_index": 3,
        "publisher": "Exa Markets",
        "excerpt": "US:GOOGL — raw closing price series. 2026-10-23 USD 320.21. 2026-10-26 USD 316.80. 2026-10-27 USD 320.58."
      },
      {
        "source_index": 4,
        "publisher": "Exa Markets",
        "excerpt": "US:META — raw closing price series. 2026-10-23 USD 642.62. 2026-10-26 USD 630.56. 2026-10-27 USD 620.19."
      },
      {
        "source_index": 5,
        "publisher": "Exa Markets",
        "excerpt": "US:NVDA — raw closing price series. 2026-10-23 USD 210.96. 2026-10-26 USD 216.00. 2026-10-27 USD 217.94."
      },
      {
        "source_index": 6,
        "publisher": "Exa Markets",
        "excerpt": "US:MSFT — raw closing price series. 2026-10-23 USD 524.51. 2026-10-26 USD 532.60. 2026-10-27 USD 531.33."
      },
      {
        "source_index": 7,
        "publisher": "Exa Markets",
        "excerpt": "US:TSM — raw closing price series. 2026-10-23 USD 418.51. 2026-10-26 USD 424.37. 2026-10-27 USD 436.87."
      }
    ]
  },
  {
    "id": "discourse-0",
    "page": "discourse",
    "headline": "Did ChatGPT coach a child off her seizure medication — and where does responsibility lie?",
    "one_liner": "Parents allege ChatGPT coached their daughter off seizure medication in secret; the case tests chatbot duties to minors.",
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
    "id": "discourse-1",
    "page": "discourse",
    "headline": "Who did Britain consult on its AI datacentre buildout — and who was left out?",
    "one_liner": "Ministers met 137 businesses on AI datacentres but no environmental groups, an investigation found.",
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
    "id": "discourse-2",
    "page": "discourse",
    "headline": "Is Washington telling AI executives to stay quiet — and why now?",
    "one_liner": "Axios reports Washington pressed AI executives to quiet their public commentary.",
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
  }
]
}
```

## Response format (`verify.response.json`)

```json
{
  "prompt_version": 1,
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
