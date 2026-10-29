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
  "Anthropic filed its S-1 to go public on Tuesday, the first IPO prospectus from a frontier model lab, and the week's coverage framed both its rapid growth and its unusually long risk register.",
  "The filing headlined a $235 billion week of AI dealmaking that also saw Foundry Robotics raise $100 million and IREN finance $363 million of AI compute.",
  "Amazon agreed to buy satellite operator Globalstar for $11.57 billion to challenge Starlink — the week's largest acquisition, already cleared by a US agency.",
  "On the model side Google shipped Gemini 4 Carbon and DeepMind's Genie 4 world simulator, while Microsoft's MAI Image 2.7 debuted at No. 3 on Arena Edit.",
  "Two labs claimed to refute the Exponential Time Hypothesis, but outside checkers said nobody can verify the proofs — the week's live debate over whether frontier AI claims are checkable at all.",
  "AP and Reuters spent the week asking whether debt-funded AI capital expenditure can pay for itself — the open question over the entire AI buildout."
],
  "supports": {
  "0": [
    "funding-3"
  ],
  "1": [
    "funding-0",
    "funding-1"
  ],
  "2": [
    "deals-1",
    "deals-0"
  ],
  "3": [
    "models-0",
    "models-3",
    "performance-0"
  ],
  "4": [
    "discourse-2"
  ],
  "5": [
    "discourse-1"
  ]
},
  "items": [
  {
    "id": "models-0",
    "page": "models",
    "headline": "Google ships **Gemini 4 Carbon**",
    "one_liner": "Google's Gemini 4 Carbon is the week's flagship model release — reasoning upgrades aimed at the agent workload.",
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
    "headline": "Early progress on accelerating drug development with Claude",
    "one_liner": "Anthropic reports early drug-development acceleration with Claude — a concrete pharma deployment read.",
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
    "id": "models-2",
    "page": "models",
    "headline": "Working with academic communities to build scientific understanding",
    "one_liner": "OpenAI details its academic-community science programme — a positioning move amid the benchmark wars.",
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
    "id": "models-3",
    "page": "models",
    "headline": "Genie 4: A new generation of world simulation",
    "one_liner": "Google DeepMind's Genie 4 turns prompts into playable worlds — the strongest world-model release of the week.",
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
    "id": "models-4",
    "page": "models",
    "headline": "Show HN: Homi, open decision model for audio, near Flash on MMSU and 50x cheaper",
    "one_liner": "Weights - https:&x2F;&x2F;huggingface.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Weights - https:&#x2F;&#x2F;huggingface.co&#x2F;egma-ai&#x2F;homi"
      }
    ]
  },
  {
    "id": "models-5",
    "page": "models",
    "headline": "As AI agents reshape the web, Google opens Gemini and Search to more apps",
    "one_liner": "A new developer platform lets businesses bring services to Google's AI experiences — app distribution shifts to the agent.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "A new developer platform will let businesses bring their services to Google's AI experiences, potentially changing how consumers discover and use apps."
      }
    ]
  },
  {
    "id": "performance-0",
    "page": "performance",
    "headline": "MAI Image 2.7",
    "one_liner": "Microsoft's MAI Image 2.7 debuts at No. 3 on Arena Edit — an in-house image model outside the usual labs.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Microsoft AI",
        "excerpt": "MAI Image 2.7, our latest image editing model, launches with even stronger control for edits that are hardest to get right. It launches in preview at No. 3 on Arena Edit, making Microsoft AI the No. 2 lab, and No. 2 on Artificial Analysis's image editing leaderboard."
      }
    ]
  },
  {
    "id": "launches-0",
    "page": "launches",
    "headline": "The Agent SDK",
    "one_liner": ".",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "The Agent SDK"
      }
    ]
  },
  {
    "id": "launches-1",
    "page": "launches",
    "headline": "Show HN: Silo – an open source secure CLI sandbox for running agents locally",
    "one_liner": ".",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Show HN: Silo – an open source secure CLI sandbox for running agents locally"
      }
    ]
  },
  {
    "id": "launches-2",
    "page": "launches",
    "headline": "Rocker Launches as the Context-Aware AI Work Assistant for the Busiest People at the World’s Most Ambitious Companies",
    "one_liner": "SAN FRANCISCO--(BUSINESS WIRE)--Rocker, the AI assistant for busiest people at the world’s most ambitious companies, today announced.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Rocker, the AI assistant for busiest people at the world’s most ambitious companies, today announced $12.85M in funding led by Greycroft, with participation from Anthropic and Menlo Ventures' Anthology Fund, Matchstick, Stripe, and operators Jeanne DeWitt Grosser"
      }
    ]
  },
  {
    "id": "launches-3",
    "page": "launches",
    "headline": "Anthropic just launched tools to show companies what their AI spending is buying",
    "one_liner": "The frontier lab is lifting the curtain on how users spend money on its models ahead of a planned IPO.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "TechCrunch",
        "excerpt": "The frontier lab is lifting the curtain on how users spend money on its models ahead of a planned IPO."
      }
    ]
  },
  {
    "id": "launches-4",
    "page": "launches",
    "headline": "Microsoft is ending Copilot support on smart TVs",
    "one_liner": "Nearly two years after LG and Samsung announced at CES 2025 that their latest smart TVs would include access to Microsofts Copilot.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Nearly two years after LG and Samsung announced at CES 2025 that their latest smart TVs would include access to Microsoft's Copilot, the company is ending support for the AI assistant's functionality on all TVs this year, according to a report by Windows Central. The news comes not from an official"
      }
    ]
  },
  {
    "id": "launches-5",
    "page": "launches",
    "headline": "Show HN: 42Loop - Agent runs the product, I assist it",
    "one_liner": "As my first experiment in AI autonomy, I set up an agent that runs the product, while I assist it.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "As my first experiment in AI autonomy, I set up an agent that runs the product, while I assist it. The product is the community board hosted on the homepage of 42Loop.com On Product Development front, the agent ideates with me the features, positioning, UX etc. and provides me the prompts that I"
      }
    ]
  },
  {
    "id": "funding-0",
    "page": "funding",
    "headline": "Foundry Robotics raised $100M Series A led by Marlinspike Partners",
    "one_liner": "EMERYVILLE, Calif.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "EMERYVILLE, Calif.--(BUSINESS WIRE)--Foundry Robotics today announced its oversubscribed $100 million Series A funding round led by Marlinspike Partners. Participating in the round are early backers Khosla Ventures and Red Glass Ventures, and new investors SE Ventures, Wing VC, and Axiom Ventures,"
      }
    ]
  },
  {
    "id": "funding-1",
    "page": "funding",
    "headline": "IREN raised $363 million equipment financing",
    "one_liner": "Equipment financing for high-density AI data centers — the debt side of the capex wave.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "TUSTIN, Calif. & SYDNEY--(BUSINESS WIRE)--Wingspire Equipment Finance and IREN Limited (NASDAQ: IREN) (“IREN”) announced the closing of a $363 million equipment financing transaction supporting IREN’s AI compute business.The Equipment Finance Agreement refinanced recently acquired,"
      }
    ]
  },
  {
    "id": "funding-2",
    "page": "funding",
    "headline": "Anthropic raised an undisclosed amount IPO",
    "one_liner": "The prospectus builds an elaborate governance moat to keep Wall Street at bay after listing.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "The Verge",
        "excerpt": "Anthropic wants to have it both ways. With its impending IPO, it wants to tap the vast riches of the public markets and insists it doesn't want to compromise its core mission of developing AI safely and for the benefit of humanity. But greater model capabilities bring greater risks, and"
      }
    ]
  },
  {
    "id": "funding-3",
    "page": "funding",
    "headline": "Anthropic raised an undisclosed amount S-1",
    "one_liner": "Anthropic filed its S-1 to go public — the first frontier-lab IPO filing, and the week's most consequential document.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "SEC EDGAR",
        "excerpt": "S-1; filed by Anthropic, PBC"
      }
    ]
  },
  {
    "id": "funding-4",
    "page": "funding",
    "headline": "Ex-Merseyside founder raised an undisclosed amount — $400mn valuation",
    "one_liner": "A $400mn valuation for an AI venture founded by a former UK police officer — the froth end of the funding tape.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Financial Times",
        "excerpt": "Ex-Merseyside police officer lands $400mn valuation for AI venture"
      }
    ]
  },
  {
    "id": "funding-5",
    "page": "funding",
    "headline": "Tenstorrent raised $1.5B Series E",
    "one_liner": "The RISC-V chip shop banked $1.5B to chase NVIDIA's inference business — the week's largest chip raise.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Business Wire",
        "excerpt": "Innovation X, a late-stage venture capital firm investing in privately held technology leaders, today announced that it co-led Tenstorrent's $1.5 billion Series E financing at a $6.2 billion post-money valuation."
      }
    ]
  },
  {
    "id": "deals-0",
    "page": "deals",
    "headline": "US agency approves Amazon Leo’s $11.5B acquisition of Globalstar",
    "one_liner": ".",
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
    "headline": "Amazon → Globalstar — **$11.57B**",
    "one_liner": "Amazon agreed to buy Globalstar for $11.57B — a satellite footprint to challenge Starlink on Amazon Leo.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "Hacker News",
        "excerpt": "Amazon to buy satellite firm Globalstar in $11.57B deal"
      }
    ]
  },
  {
    "id": "deals-2",
    "page": "deals",
    "headline": "Guidewire → hyperexponential — undisclosed",
    "one_liner": "Guidewire absorbs hyperexponential's pricing AI — insurance underwriting software consolidation continues.",
    "sources": [
      {
        "source_index": 0,
        "publisher": "PR Newswire",
        "excerpt": "Guidewire announced today that it entered into a definitive agreement to acquire Hyperexponential Ltd for a base purchase price of $1.7 billion in cash, subject to adjustments, and up to an additional $400 million in contingent consideration."
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
    "headline": "Is Washington telling AI executives to shut up — and why now?",
    "one_liner": "Axios and Bloomberg report Washington telling AI executives to quiet down — political cover vs industry messaging.",
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
    "id": "discourse-1",
    "page": "discourse",
    "headline": "Can debt-funded AI capital expenditure pay for itself?",
    "one_liner": "AP and Reuters weigh whether debt-funded AI capex can pay for itself — bulls cite contracts, bears cite circularity.",
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
    "id": "discourse-2",
    "page": "discourse",
    "headline": "Did two frontier labs just refute the Exponential Time Hypothesis — or can nobody actually check the proofs?",
    "one_liner": "AI Atlas and Third Run Time disagree on whether two frontier-lab complexity papers actually refute ETH — the claim vs the check.",
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
