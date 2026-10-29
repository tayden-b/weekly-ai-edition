---
stage: classify
prompt_version: 1
owns: PLAN §5.2 classify (LLM stage, temperature 0, structured output)
reads: packages/pipeline/testdata/…; STYLE.md §8 (taxonomy); config/companies.yaml
writes: classification.response.json (hand-off format below)
consumers: P4 (packages/pipeline/src/stages/classify.ts)
---

# Prompt: classify ranked item clusters to a page

> P4 renders this file by substituting the `{{…}}` placeholders, then hands the
> rendered prompt to the `llm()` seam. In session mode the Devin session fills
> `classification.response.json`; in replay mode the recorded response is
> reused. Edit this file only via PR — the version is part of the product.

## System

You are the `classify` stage of the Weekly AI Edition pipeline. You receive
deduplicated, ranked item clusters fetched from verified publishers. For each
cluster you emit exactly one page label, a confidence, and zero or more company
slugs. You never write prose, never invent companies, and never add facts that
are not in the item records.

The taxonomy is the set of item-bearing pages (STYLE.md §8); the derived pages
cover, briefing, most_covered, back_page are never valid labels:

- `models` — new models/weights, major version bumps, API or model changes,
  flagship OSS release tags.
- `performance` — benchmark results/moves, leaderboard changes, evals,
  papers-with-results, eval-methodology news.
- `launches` — products and features shipped to users (apps, tools, agent modes,
  hardware, SDKs, availability).
- `funding` — private rounds, IPOs and offerings, valuations.
- `deals` — acquisitions, acqui-hires, major partnerships/JVs, large commercial
  compute/cloud contracts.
- `markets` — price/market-cap moves of the AI basket and AI pure plays;
  public-market events on those names.
- `discourse` — the contested debate of the week (lawsuits, policy fights,
  viral critiques); requires a real two-sided argument.
- `unsorted` — everything else, including anything you cannot place with
  confidence.

## Rules

1. Classify by substance, not by the presence of the word "AI".
2. Emit `confidence` in [0, 1]. If confidence < 0.7, the label **must** be
   `unsorted` (the stage also enforces this in code).
3. `company_slugs` ⊆ the registry slugs listed under `## Company registry`.
   Tag every registry company the item is materially about; omit everyone
   else. If an item's substance is a company absent from the registry, label
   it `unsorted` — never mint a slug. Emit slugs, names, or aliases — the
   stage resolves them to canonical slugs.
4. `discourse` requires a contested public debate; expect ≥ 2 publishers in the
   cluster. A lone press release or settled announcement is not discourse.
5. `markets` is only for listed basket names / AI pure plays.
6. An item matching two pages takes the page its decision-relevant substance is
   about (a round that mentions a model is still `funding`).
7. Judge the item, not the publisher's hype.

## Request format (`classification.request.json`)

```json
{
  "week": "2026-w44",
  "prompt_version": 1,
  "style_rev": "25e18d610b9cbdca74cd2956c508c775737ad3de",
  "companies": [{ "slug": "openai", "name": "OpenAI", "aliases": [] }],
  "items": [
    {
      "id": "cl-0001",
      "headline": "…",
      "publisher": "…",
      "canonical_url": "…",
      "published_at": "…",
      "excerpt": "…≤300 chars…",
      "source_count": 2,
      "publishers": ["TechCrunch", "Axios"]
    }
  ]
}
```

`id` is the cluster's own id — echo it verbatim. `companies` is the registry
projected to `slug`/`name`/`aliases`; `source_count` + `publishers` carry the
cluster's distinct-publisher count (the discourse corroboration signal).

## Response format (`classification.response.json`)

```json
{
  "prompt_version": 1,
  "items": [
    {
      "id": "cl-0001",
      "page": "funding",
      "confidence": 0.93,
      "company_slugs": ["anthropic"],
      "rationale": "one clause, for audit only"
    }
  ]
}
```

Every request `id` appears exactly once in `items`; no extras, no drops.
Temperature 0; output is only this JSON object.

## Company registry

- nvidia: NVIDIA (aliases: NVDA)
- microsoft: Microsoft (aliases: MSFT)
- alphabet: Alphabet (Google) (aliases: Google, Alphabet, GOOGL, GOOG)
- meta: Meta (aliases: Facebook, META)
- amazon: Amazon (aliases: AMZN, AWS)
- amd: AMD (aliases: Advanced Micro Devices)
- tsmc: TSMC (aliases: TSM, Taiwan Semiconductor)
- broadcom: Broadcom (aliases: AVGO)
- palantir: Palantir (aliases: PLTR)
- arm: Arm (aliases: ARM, Arm Holdings)
- openai: OpenAI
- anthropic: Anthropic
- google-deepmind: Google DeepMind (aliases: DeepMind)
- meta-ai: Meta AI (aliases: FAIR, Llama)
- mistral-ai: Mistral AI (aliases: Mistral)
- xai: xAI (aliases: Grok, X.AI)
- microsoft-research: Microsoft Research (aliases: MSR)
- amazon-science: Amazon Science (aliases: Amazon AI)
- moonshot-ai: Moonshot AI (aliases: Kimi, Moonshot)
- deepseek: DeepSeek (aliases: High-Flyer AI)
- alibaba-qwen: Alibaba Qwen (aliases: Qwen, Tongyi, Alibaba)
- hugging-face: Hugging Face (aliases: HF)
- apple: Apple (aliases: AAPL)
- anysphere: Anysphere (Cursor) (aliases: Cursor)
- asml: ASML
- cloudflare: Cloudflare (aliases: NET)
- cognition: Cognition AI (aliases: Devin, Cognition)
- coreweave: CoreWeave
- figure: Figure AI (aliases: Figure)
- framework: Framework Computer (aliases: Framework)
- intel: Intel (aliases: INTC)
- nike: Nike (aliases: NKE)
- oracle: Oracle (aliases: ORCL)
- perplexity: Perplexity AI (aliases: Perplexity)
- softbank: SoftBank Group (aliases: SoftBank, SFTBY)
- spacex: SpaceX
- tesla: Tesla (aliases: TSLA)
- thinking-machines: Thinking Machines Lab (aliases: Thinking Machines, TML)
- vmware: VMware
- windsurf: Windsurf (aliases: Codeium, Windsurf Editor)
- foundry-robotics: Foundry Robotics
- globalstar: Globalstar
- hummingbird: Hummingbird (aliases: Hummingbird RegTech)
- quantimon: Quantimon
- 1password: 1Password
- elevenlabs: ElevenLabs (aliases: ElevenLabs AI)
- entytle: Entytle
- general-compute: General Compute
- guidewire: Guidewire (aliases: Guidewire Software)
- hyperexponential: hyperexponential (aliases: hx)
- hyphenate: Hyphenate
- infisical: Infisical
- liquid-ai: Liquid AI (aliases: LFM, LiquidAI)
- rapidcanvas: RapidCanvas
- tenstorrent: Tenstorrent

## Input

[
  {
    "id": "https://launchindex.ai/day/2026-10-24",
    "headline": "1Password for Agents",
    "publisher": "Launch Index",
    "canonical_url": "https://launchindex.ai/day/2026-10-24",
    "published_at": "2026-10-24T00:00:00.000Z",
    "excerpt": "1Password for Agents — Let AI agents sign in for you without seeing your passwords — 138 votes.",
    "source_count": 1,
    "publishers": [
      "Launch Index"
    ]
  },
  {
    "id": "https://www.kimi.com/en/blog/kimi-k3-1-pro",
    "headline": "Kimi K3.1 Pro",
    "publisher": "Kimi (Moonshot AI)",
    "canonical_url": "https://www.kimi.com/en/blog/kimi-k3-1-pro",
    "published_at": "2026-10-24T00:00:00.000Z",
    "excerpt": "Kimi K3.1 Pro",
    "source_count": 2,
    "publishers": [
      "Kimi (Moonshot AI)",
      "Moonshot AI (Kimi)"
    ]
  },
  {
    "id": "https://github.com/VenoM9078/gradientdeck-skill",
    "headline": "Show HN: Task-view – review a coding agent’s change as a map instead of a diff",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/gtindo/task-view",
    "published_at": "2026-10-24T00:11:40.000Z",
    "excerpt": "Show HN: Task-view – review a coding agent’s change as a map instead of a diff",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://privacymeridian.org/",
    "headline": "Show HN: Privacy Meridian, navigate global privacy laws",
    "publisher": "Hacker News",
    "canonical_url": "https://privacymeridian.org/",
    "published_at": "2026-10-24T00:56:18.000Z",
    "excerpt": "Hi, I'm a Privacy PM who has worked at Fortune 5 companies for most of my career. One of the gaps I always faced was a quick way to look up in-effect privacy laws and their various nuances jurisdiction by jurisdiction. So with some help from attorney and engineer friends&#x2F;colleagues, and Claude",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://messh.io/",
    "headline": "Show HN: Web Bot Auth SDK and SSH Utilty",
    "publisher": "Hacker News",
    "canonical_url": "https://messh.io/",
    "published_at": "2026-10-24T03:27:01.000Z",
    "excerpt": "Launched a beta&#x2F;buggy version of the SDK for web bot auth, and it's live at https:&#x2F;&#x2F;messh.io Inspired by https:&#x2F;&#x2F;datatracker.ietf.org&#x2F;wg&#x2F;webbotauth&#x2F;documents&#x2F; While solving this, I realized it solves the hassle of adding SSH keys, the overhead of",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://inference.coop/",
    "headline": "Show HN: Inference Cooperative, user-governed AI",
    "publisher": "Hacker News",
    "canonical_url": "https://inference.coop/",
    "published_at": "2026-10-24T03:32:54.000Z",
    "excerpt": "Show HN: Inference Cooperative, user-governed AI",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://pilely.ai/",
    "headline": "Show HN: Pilely – Build and ship web apps within your AI chat",
    "publisher": "Hacker News",
    "canonical_url": "https://pilely.ai/",
    "published_at": "2026-10-24T05:32:49.000Z",
    "excerpt": "Show HN: Pilely – Build and ship web apps within your AI chat",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://latch.tools/",
    "headline": "Show HN: Latch – Make any website usable by AI agents in one line (WebMCP)",
    "publisher": "Hacker News",
    "canonical_url": "https://latch.tools/",
    "published_at": "2026-10-24T05:41:41.000Z",
    "excerpt": "Show HN: Latch – Make any website usable by AI agents in one line (WebMCP)",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/insanai/ccm",
    "headline": "Show HN: Code Counter Machine a modern analysis of AI driven development costs",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/insanai/ccm",
    "published_at": "2026-10-24T05:47:12.000Z",
    "excerpt": "I worked a lot with cloc, sloc and scc and used them in various prohects. But with AI driven development some of the models COCOMO I and II might not be applicable. So built a new cli ccm short for code counter machine with new calculation model which estimate the new AI driven development costs.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33472",
    "headline": "Qwen-Image-PE: Learning Visual Design for Text-to-Image Prompt Enhancement",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.33472",
    "published_at": "2026-10-24T05:50:40.000Z",
    "excerpt": "Learning visual design is essential for prompt enhancement (PE) to turn underspecified user requests into coherent visual specifications for text-to-image (T2I) generation. Existing methods preserve user intent and improve overall visual appeal, with less explicit emphasis on fine-grained design",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://console.usetd.com/",
    "headline": "Show HN: Let your AI agent put things on a screen",
    "publisher": "Hacker News",
    "canonical_url": "https://console.usetd.com/",
    "published_at": "2026-10-24T05:59:23.000Z",
    "excerpt": "Show HN: Let your AI agent put things on a screen",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/anishmoncivarghese/whyline",
    "headline": "Show HN: Whyline – Git native decision history for coding agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/anishmoncivarghese/whyline",
    "published_at": "2026-10-24T06:26:18.000Z",
    "excerpt": "Show HN: Whyline – Git native decision history for coding agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33509",
    "headline": "Can Agentic Code Review Catch Vulnerabilities Before They Are Merged?",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.33509",
    "published_at": "2026-10-24T07:32:42.000Z",
    "excerpt": "LLM agents have been increasingly adopted for security-focused code review, but existing benchmarks mostly derive the reviewed changes from their later fixes instead of the real-world bug-introducing commits. In this paper, we present SecPRBench, the first comprehensive benchmark for evaluating",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://aicitewho.com/",
    "headline": "Show HN: Inspect AI recommendation evidence and turn findings into website tasks",
    "publisher": "Hacker News",
    "canonical_url": "https://aicitewho.com/",
    "published_at": "2026-10-24T07:47:51.000Z",
    "excerpt": "Show HN: Inspect AI recommendation evidence and turn findings into website tasks",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://sideos.ai/",
    "headline": "Show HN: Local AI for dictation, meetings, background tasks and more",
    "publisher": "Hacker News",
    "canonical_url": "https://sideos.ai/",
    "published_at": "2026-10-24T08:04:16.000Z",
    "excerpt": "Show HN: Local AI for dictation, meetings, background tasks and more",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://covenant-common.github.io/covenant-docs",
    "headline": "Show HN: Multipeer, a multiplayer infinite canvas for people and their agents",
    "publisher": "Hacker News",
    "canonical_url": "https://multipeer.sh/",
    "published_at": "2026-10-24T09:05:28.000Z",
    "excerpt": "I'm building Multipeer, a desktop app for running agents, tools and working wth teammates on one shared canvas. I often have several agent sessions open at once, but they're all scattered across terminals. It was also hard for my co-founder to see what my agents are doing or jump in to work",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/RiccardoCataldi/duetto",
    "headline": "Show HN: Duetto – pretrained music transformer that plays a piano with you",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/RiccardoCataldi/duetto",
    "published_at": "2026-10-24T09:44:20.000Z",
    "excerpt": "Show HN: Duetto – pretrained music transformer that plays a piano with you",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50219762",
    "headline": "Show HN: Benchmarks of continual learning model trained for a month on a laptop",
    "publisher": "Hacker News",
    "canonical_url": "https://news.ycombinator.com/item?id=50219762",
    "published_at": "2026-10-24T10:09:27.000Z",
    "excerpt": "A month ago, I shared mini-AGI, an experiment in training a byte-level, continually learning language model from scratch on a single 8 GB laptop GPU (an RTX 3070). To recap the setup briefly: it completely decouples model size from VRAM by paging experts to and from an NVMe drive (currently 397",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50220217",
    "headline": "Show HN: MCP server that answers Steam launch questions with real counts",
    "publisher": "Hacker News",
    "canonical_url": "https://news.ycombinator.com/item?id=50220217",
    "published_at": "2026-10-24T11:21:38.000Z",
    "excerpt": "Show HN: MCP server that answers Steam launch questions with real counts",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://kouh.me/ai-text-detector",
    "headline": "Show HN: AI text detector that never sees your text (runs 100% in-browser)",
    "publisher": "Hacker News",
    "canonical_url": "https://kouh.me/ai-text-detector",
    "published_at": "2026-10-24T11:28:36.000Z",
    "excerpt": "Show HN: AI text detector that never sees your text (runs 100% in-browser)",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://mantid.dev/",
    "headline": "Show HN: Mantid, a Mac app that lets non-ML people train their own AI models",
    "publisher": "Hacker News",
    "canonical_url": "https://mantid.dev/",
    "published_at": "2026-10-24T12:49:06.000Z",
    "excerpt": "Show HN: Mantid, a Mac app that lets non-ML people train their own AI models",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/byenzyme/enzyme",
    "headline": "Show HN: Enzyme – a programming language that compiles wikis for agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/byenzyme/enzyme",
    "published_at": "2026-10-24T13:30:18.000Z",
    "excerpt": "Show HN: Enzyme – a programming language that compiles wikis for agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/Aldyernesto/shotstash",
    "headline": "Show HN: Shotstash – Self-hosted media cloud for creators (MIT, BYO-AI)",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Aldyernesto/shotstash",
    "published_at": "2026-10-24T14:17:40.000Z",
    "excerpt": "Show HN: Shotstash – Self-hosted media cloud for creators (MIT, BYO-AI)",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/bellman-sh/bellman",
    "headline": "Show HN: Bellman – rooms where agents from different providers work together",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/bellman-sh/bellman",
    "published_at": "2026-10-24T14:23:13.000Z",
    "excerpt": "Show HN: Bellman – rooms where agents from different providers work together",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/JochenBaier/AlwaysHex",
    "headline": "Show HN: Visual Studio extension that shows decimal and hex in the debugger",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/JochenBaier/AlwaysHex",
    "published_at": "2026-10-24T14:29:46.000Z",
    "excerpt": "For quite some time I've wanted to write a Visual Studio extension that shows both decimal and hex values while debugging. With Claude Code, I've now been able to make it happen. Name: AlwaysHex.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/tensemem/tensemem",
    "headline": "Show HN: TenseMem – deterministic memory for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/tensemem/tensemem",
    "published_at": "2026-10-24T14:38:03.000Z",
    "excerpt": "Show HN: TenseMem – deterministic memory for AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://binary.so/",
    "headline": "Show HN: Python script to evaluate your RAG pipeline against a golden set",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/infrixo-systems/rag-evaluation-starter",
    "published_at": "2026-10-24T15:17:44.000Z",
    "excerpt": "Show HN: Python script to evaluate your RAG pipeline against a golden set",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33746",
    "headline": "ProtAgent: Post-Training Compact Protein Tool Agents with Interaction-Level Credit Assignment",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.33746",
    "published_at": "2026-10-24T15:42:13.000Z",
    "excerpt": "Protein annotation agents must choose suitable bioinformatics tools, interpret their outputs, and use the resulting evidence in the final answer. Most existing systems rely on frontier-scale models. We ask whether a compact model can instead learn this behavior through post-training with real tool",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://app.enclave.ai/threat-feed",
    "headline": "Show HN: AI agent swarms test if new CVEs are exploitable in your env",
    "publisher": "Hacker News",
    "canonical_url": "https://app.enclave.ai/threat-feed",
    "published_at": "2026-10-24T16:00:05.000Z",
    "excerpt": "Show HN: AI agent swarms test if new CVEs are exploitable in your env",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://chatgptplugins.directory/",
    "headline": "Show HN: Marketplace for ChatGPT Plugins, Apps, & MCPs",
    "publisher": "Hacker News",
    "canonical_url": "https://chatgptplugins.directory/",
    "published_at": "2026-10-24T16:15:14.000Z",
    "excerpt": "Show HN: Marketplace for ChatGPT Plugins, Apps, & MCPs",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/24/ai-ceos-washington-political-liability",
    "headline": "Washington's message to AI execs: Please shut up",
    "publisher": "Axios",
    "canonical_url": "https://www.axios.com/2026/10/24/ai-ceos-washington-political-liability",
    "published_at": "2026-10-24T16:32:03.000Z",
    "excerpt": "Washington's message to AI execs: Please shut up",
    "source_count": 2,
    "publishers": [
      "Axios",
      "Bloomberg"
    ]
  },
  {
    "id": "https://apps.apple.com/us/app/orisuji/id6817092898",
    "headline": "Show HN: Orisuji, a maze you solve by folding your phone",
    "publisher": "Hacker News",
    "canonical_url": "https://apps.apple.com/us/app/orisuji/id6817092898",
    "published_at": "2026-10-24T16:34:39.000Z",
    "excerpt": "When Apple announced the iPhone Duo I felt the same excitement that I had felt when I got my first iPhone, way back when. I remember playing Tap Tap Revenge, Fruit Ninja and all those other games that really took advantage of the new hardware to create new experiences. I also loved playing cute",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/eliasaronson/lobole",
    "headline": "Show HN: Loböle, open-source parametric CAD that AI agents can drive",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/eliasaronson/lobole",
    "published_at": "2026-10-24T16:58:21.000Z",
    "excerpt": "I could never get used to FreeCAD, so I built my own. It turns out Claude is really good at using it. Loböle is a parametric B-Rep CAD built on OpenCASCADE and Vulkan, with sketches, assemblies, drawings, FEM and CAM. The GUI, Python scripts and AI agents all go through the same commands, so an",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/thomasunise/argus",
    "headline": "Show HN: Argus- open source security platform to protect against agentic attacks",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/thomasunise/argus",
    "published_at": "2026-10-24T17:13:57.000Z",
    "excerpt": "Show HN: Argus- open source security platform to protect against agentic attacks",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://essaypod.com/",
    "headline": "Show HN: A Platform to Find Essays, personally recommended to you",
    "publisher": "Hacker News",
    "canonical_url": "https://essaypod.com/",
    "published_at": "2026-10-24T18:01:44.000Z",
    "excerpt": "Reading a book is great, when you know it will be good. Reading news is great, when you know it will be interesting, and the same with essays. Inability to find great content to read became a huge pain point for me after I read through Paul Graham's essays. Then I decided to build a tiny scraper",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://aitrendvideo.net/",
    "headline": "Show HN: AI Trend Video – Put your photo into viral AI video templates",
    "publisher": "Hacker News",
    "canonical_url": "https://aitrendvideo.net/",
    "published_at": "2026-10-24T18:03:05.000Z",
    "excerpt": "Show HN: AI Trend Video – Put your photo into viral AI video templates",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://roush.io/paste-buff",
    "headline": "Show HN: The missing clipboard history for macOS that idles at 16 MB",
    "publisher": "Hacker News",
    "canonical_url": "https://roush.io/paste-buff",
    "published_at": "2026-10-24T18:15:23.000Z",
    "excerpt": "Been using Raycast solely for it's paste history feature. When profiling saw high memory usage and decided to see how performant I could make a tool that only does paste history. Had Claude start with Tauri, GPUI then finally appkit code.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://jameswniu.github.io/multi-agent-causal-marriage-simulation",
    "headline": "Show HN: A randomized controlled trial run inside an agent simulation",
    "publisher": "Hacker News",
    "canonical_url": "https://jameswniu.github.io/multi-agent-causal-marriage-simulation",
    "published_at": "2026-10-24T18:20:15.000Z",
    "excerpt": "Show HN: A randomized controlled trial run inside an agent simulation",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/swrdfish/narro",
    "headline": "Show HN: Narro – Read web pages and Kindle books using local AI voices",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/swrdfish/narro",
    "published_at": "2026-10-24T19:37:32.000Z",
    "excerpt": "I wanted a read-aloud extension that could read from the Kindle Online Reader. The ones I tried used voices I did not enjoy listening to or had a UX that was too cluttered or annoying or needed a signup. So I decided to vibe code my own. It is open source and uses open weight models that run in the",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/gtanczyk/genaicode",
    "headline": "Show HN: Claude Code(and others) embedded in your app",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/gtanczyk/genaicode",
    "published_at": "2026-10-24T20:54:27.000Z",
    "excerpt": "I started this project in 2024 when I got fascinated with LLMs, and what I did was a coding agent (CLI -> interactive -> GUI). I also added an integration with Vite for having it embedded inside my apps(mostly games). Few months ago I pivoted it to become a low profile AI provider wrapper library",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://perchfocus.com/",
    "headline": "Show HN: Perch, a calm Mac app for juggling Claude Code sessions",
    "publisher": "Hacker News",
    "canonical_url": "https://perchfocus.com/",
    "published_at": "2026-10-24T21:01:39.000Z",
    "excerpt": "I'm an engineer, but I also hate using tools that make things overcomplicated. It's also tough with the new pace of AI-driven development to really get into the flow state, and maintain (still needed!) focus on 1 thing. So I built a tool that I actually want to use every day. Curious if others",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://tributary.music/",
    "headline": "Show HN: Tributary – Discover who influenced your favorite musicians",
    "publisher": "Hacker News",
    "canonical_url": "https://tributary.music/",
    "published_at": "2026-10-24T21:51:53.000Z",
    "excerpt": "tributary.music uses artists' own accounts & critics' writing to determine an artist's influences. It pairs one song from the artist with one from the influence so you can directly hear similarities, differences, and how the sound evolved. I had been in a bit of a funk finding new music to listen",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://kat-assessment.com/",
    "headline": "Show HN: A client-side adaptive cognitive test measuring micro-hesitations",
    "publisher": "Hacker News",
    "canonical_url": "https://kat-assessment.com/",
    "published_at": "2026-10-24T21:56:06.000Z",
    "excerpt": "Hi HN! I’m not a software engineer by trade. My background is in behavioral science and human-computer interaction, but I wanted to solve a specific problem I found when applying for jobs which is the logical test. They are booooring, easy to cheat on if you really want to and provides very limited",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://chatgpt.com/plugins/plugin_asdk_app_6abdec89d46c81919cda058ca9f62cb8?search=call4me",
    "headline": "Show HN: Call4me – a ChatGPT plugin that lets it make phone calls on your behalf",
    "publisher": "Hacker News",
    "canonical_url": "https://chatgpt.com/plugins/plugin_asdk_app_6abdec89d46c81919cda058ca9f62cb8?search=call4me",
    "published_at": "2026-10-24T22:00:59.000Z",
    "excerpt": "Show HN: Call4me – a ChatGPT plugin that lets it make phone calls on your behalf",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://deepsearch.ing/",
    "headline": "Show HN: DeepSearch – Search engine built on DeepSeek API",
    "publisher": "Hacker News",
    "canonical_url": "https://deepsearch.ing/",
    "published_at": "2026-10-24T22:44:35.000Z",
    "excerpt": "DeepSeek launched their search API so I had to build a search engine on top of it. The search engine is very simple: add your DeepSeek API credentials or OAuth with your DeepSeek account and you can search the web using their API and view results in a familiar web interface. Credentials are stored",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/DainoJung/omni-verify",
    "headline": "Show HN: Omni Verify, my AI agent can't post until Kane checks every promise",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/DainoJung/omni-verify",
    "published_at": "2026-10-24T23:15:01.000Z",
    "excerpt": "Show HN: Omni Verify, my AI agent can't post until Kane checks every promise",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://huggingface.co/JakCwi/eugen-sparse",
    "headline": "Show HN: Sparse kernel delivering 36% higher training throughput",
    "publisher": "Hacker News",
    "canonical_url": "https://huggingface.co/JakCwi/eugen-sparse",
    "published_at": "2026-10-24T23:25:57.000Z",
    "excerpt": "I developed a custom GPU kernel in Triton to accelerate training with a sparse feed-forward network (FFN). With K=256, activating 256 of 4,096 FFN neurons per token (6.25%), the sparse model achieved 36% higher training throughput than its dense counterpart. The kernel has so far been tested on a",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.33949",
    "headline": "Why Does Structured Output Fail? An Empirical Study of Prompt-Enforced Pydantic Schemas Across Nine LLMs",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.33949",
    "published_at": "2026-10-24T23:30:38.000Z",
    "excerpt": "Pipelines that require structured outputs from hosted language models often specify a Pydantic schema in the prompt, validate the response, and retry when validation fails. Although native structured-output modes provide an alternative, application-side validation remains important for enforcing",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/orgiggly/claude-plugin",
    "headline": "Show HN: Orgiggly – Claude Code plugin that hosts the apps it builds",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/orgiggly/claude-plugin",
    "published_at": "2026-10-24T23:39:50.000Z",
    "excerpt": "Show HN: Orgiggly – Claude Code plugin that hosts the apps it builds",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://adrs.systems/",
    "headline": "Show HN: ADRs for AI – Deliberation records for human–AI work, versioned in Git",
    "publisher": "Hacker News",
    "canonical_url": "https://adrs.systems/",
    "published_at": "2026-10-25T00:43:47.000Z",
    "excerpt": "Why is this worth your time? Essentially, this solves two problems of AI-assisted programming: (a) the first problem is how to do oversight and what do oversight of and this is solved through the ORRCF (for Options, Recommendation, Rationale, Confidence, Falsifier) question format (in which models",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://huggingface.co/destined/hurston-1",
    "headline": "Show HN: Hurston-1 open source TTS that speak Southern American and Afro-English",
    "publisher": "Hacker News",
    "canonical_url": "https://huggingface.co/destined/hurston-1",
    "published_at": "2026-10-25T01:30:13.000Z",
    "excerpt": "Hey HN, I’m open sourcing my Hurston-1 narrowband TTS model (Apache-2.0). It is very good with American English and does especially well with Southern American and Regional African English accents. Destined AI is based in Atlanta, and I built this because I’m amazed by what AI can do, and I wanted",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50227527",
    "headline": "Show HN: ReVault – new secure archive format",
    "publisher": "Hacker News",
    "canonical_url": "https://news.ycombinator.com/item?id=50227527",
    "published_at": "2026-10-25T02:01:21.000Z",
    "excerpt": "reVault is a new, secure-by-default archive format called a lockbox, designed to be simple to use. I've been working on reVault for about 2 years. It was originally written in Dart, but with the improvements in AI, I decided to port it to Rust using AI. It's now in beta, so I'm looking for",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://aisenatus.com/",
    "headline": "Show HN: AI Senate – AI senators debate live policy and vote on the record",
    "publisher": "Hacker News",
    "canonical_url": "https://aisenatus.com/",
    "published_at": "2026-10-25T02:15:29.000Z",
    "excerpt": "Show HN: AI Senate – AI senators debate live policy and vote on the record",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://firmendaten.researchly.at/netzwerk",
    "headline": "Show HN: Close the UI building AI agent loop with Protoshot",
    "publisher": "Hacker News",
    "canonical_url": "https://npmjs.com/protoshot",
    "published_at": "2026-10-25T03:10:26.000Z",
    "excerpt": "Protoshot scans your css files and components and lets you write just some JSX to preview it. A much simpler setup than having to orchestrate agent-browser or puppeteer instance for just seeing what UI looks like.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/zephium-browser/Zephium",
    "headline": "Show HN: An OSS browser and work environment for humans and agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/zephium-browser/Zephium",
    "published_at": "2026-10-25T03:16:39.000Z",
    "excerpt": "Fast, private, fully-featured, built in Rust (forked Wry, system's WebView). 40 MB. Not a Chromium fork. Native adblocking (forked adblock-rust), major Chrome extension support, deeply integrated productivity tools, a custom agentic browsing engine, and a lot more. It's not just another wrapper",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://ai.jagular.io/",
    "headline": "Show HN: AI Heat Map Sourced from over 140 News Feeds",
    "publisher": "Hacker News",
    "canonical_url": "https://ai.jagular.io/",
    "published_at": "2026-10-25T03:25:15.000Z",
    "excerpt": "Show HN: AI Heat Map Sourced from over 140 News Feeds",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/ajaynyayapathi/yara-l-skill",
    "headline": "Show HN: AgentSkill – Yara-L-Skill",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/ajaynyayapathi/yara-l-skill",
    "published_at": "2026-10-25T03:32:56.000Z",
    "excerpt": "An Agent Skill that teaches AI coding agents to write, review, tune, and convert YARA-L 2.0 detection rules for Google Security Operations (SecOps, formerly Chronicle).",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://git-ing-over-it.vercel.app/",
    "headline": "Show HN: Git-ing Over it, learn Git like you'll use it IRL",
    "publisher": "Hacker News",
    "canonical_url": "https://git-ing-over-it.vercel.app/",
    "published_at": "2026-10-25T04:23:11.000Z",
    "excerpt": "Hi HN! I made a browser game called Git-ing Over It around the git situations you might actually run into at work. It's completely free, 14 levels, no sign up! A Slack message, some objectives, a terminal, and at times a browser window or a code file welcome you in each level. Each level is a mix",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34080",
    "headline": "The LALA Benchmark: Evaluating Literary and Linguistic Analysis in LLMs",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34080",
    "published_at": "2026-10-25T05:38:57.000Z",
    "excerpt": "We introduce the Literature and Linguistics Analysis Benchmark (LALA), comprising 236 open-ended questions written by experts in linguistics and literary studies, together with expert-provided ideal answers. By comparing models within families and at similar training scales using human and LLM",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34094",
    "headline": "From Document Layout to Causal Topology: An End-to-End Architecture for Temporal Causal Reasoning",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34094",
    "published_at": "2026-10-25T06:45:49.000Z",
    "excerpt": "Large language models (LLMs) generally lack deep causal reasoning capabilities in temporal reasoning. Inspired by document layout reordering, this paper proposes a paradigm shift from discrete narratives to causal topologies. It constructs two architectures: a training-free neuro-symbolic",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/Tomotsugu-dev/Hindsight",
    "headline": "Show HN: Hindsight – Lightweight, elegant, open-source tracker for Windows/macOS",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Tomotsugu-dev/Hindsight",
    "published_at": "2026-10-25T07:04:10.000Z",
    "excerpt": "Hi HN, I’m building Hindsight, a free, open-source activity tracker for Windows and macOS. I know there are plenty of time trackers. I wanted something that combined automatic tracking, detailed charts, and cross-device sync in a lightweight app with an interface I enjoyed using. I couldn’t find a",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34127",
    "headline": "Bug Severity Classification with Fine-Tuned Open LLMs: A Paired Comparison with TF-IDF and CodeBERT Baselines on Eclipse Reports",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34127",
    "published_at": "2026-10-25T07:53:10.000Z",
    "excerpt": "Open large language models (LLMs) small enough to run on a laptop are an obvious candidate for automatic bug severity prediction. We measure what they add over cheaper classifiers on one task: assigning one of four Bugzilla severity levels (Critical, Major, Minor, Trivial) to Eclipse bug reports.",
    "source_count": 2,
    "publishers": [
      "Hacker News",
      "arXiv"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34151",
    "headline": "Execution Logs Sway VLM Judges of Robot Progress",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34151",
    "published_at": "2026-10-25T08:37:41.000Z",
    "excerpt": "Vision-language models now grade robot videos, and text placed beside the frames can change their verdicts. On clips where the robot is losing progress, we add one log line saying the robot is making progress. Across Gemini, Qwen and GPT judges, this flips correct verdicts to progress 10 to 35",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://www.researchgate.net/publication/415644138_EASCM_White_Paper_Luthera_2026_v10",
    "headline": "Show HN: AI:Predict, Retrieve, Generate, Recommend, Decide, Act, and Orchestrate",
    "publisher": "Hacker News",
    "canonical_url": "https://www.researchgate.net/publication/415644138_EASCM_White_Paper_Luthera_2026_v10",
    "published_at": "2026-10-25T08:42:21.000Z",
    "excerpt": "Show HN: AI:Predict, Retrieve, Generate, Recommend, Decide, Act, and Orchestrate",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34177",
    "headline": "Freeze What Is Settled, Cache What Is Smooth: Spatial Freezing Keeps Step Caching in Its Low-Error Regime",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34177",
    "published_at": "2026-10-25T09:13:45.000Z",
    "excerpt": "Instruction-based image editors built on diffusion transformers run tens of denoising steps. Training-free acceleration either reuses features across steps (step caching) or stops computing the regions an edit leaves untouched (region freezing), and the two have been combined before. We ask how a",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/stubbi/openxet",
    "headline": "Show HN: OpenXet",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/stubbi/openxet",
    "published_at": "2026-10-25T09:29:43.000Z",
    "excerpt": "Xet [1] seems like a good idea in a world of ever more data hungry applications. It's used in Huggingface's service but the server side has been kept close source. I started reengineering it with Claude from the protocol descriptions to provide it for everyone. If you think it's cool, I am grateful",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://jevontane.com/echoboard",
    "headline": "Show HN: Echoboard where AI agents do science and humans only watch",
    "publisher": "Hacker News",
    "canonical_url": "https://jevontane.com/echoboard",
    "published_at": "2026-10-25T10:18:31.000Z",
    "excerpt": "Show HN: Echoboard where AI agents do science and humans only watch",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/yasuyuky/cargo-test-prune",
    "headline": "Show HN: Find overlapping Rust tests with mutation testing",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/yasuyuky/cargo-test-prune",
    "published_at": "2026-10-25T12:02:00.000Z",
    "excerpt": "To tackle the ever-increasing number of tests, I built cargo-test-prune. The idea behind it is to use cargo-mutants to generate mutants, and then solve the set cover problem for those mutants to suggest which tests can be eliminated. (use a greedy algorithm to cover the detected mutants with fewer",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/komovaar/kolo",
    "headline": "Show HN: Kolo – share your AI coding sessions with anyone",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/komovaar/kolo",
    "published_at": "2026-10-25T13:49:15.000Z",
    "excerpt": "Show HN: Kolo – share your AI coding sessions with anyone",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/NoMac-app/simulator-use",
    "headline": "Show HN: The fastest, most token-efficient iOS Simulator MCP for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/NoMac-app/simulator-use",
    "published_at": "2026-10-25T14:05:18.000Z",
    "excerpt": "Show HN: The fastest, most token-efficient iOS Simulator MCP for AI agents",
    "source_count": 2,
    "publishers": [
      "Bloomberg",
      "Hacker News"
    ]
  },
  {
    "id": "https://huggingface.co/microsoft/CogACT-v2-RoboDojo",
    "headline": "microsoft/CogACT-v2-RoboDojo",
    "publisher": "microsoft",
    "canonical_url": "https://huggingface.co/microsoft/CogACT-v2-RoboDojo",
    "published_at": "2026-10-25T14:35:41.000Z",
    "excerpt": "microsoft/CogACT-v2-RoboDojo",
    "source_count": 1,
    "publishers": [
      "microsoft"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34336",
    "headline": "Improving the Chain-of-Thought Compressibility of Pruned Reasoning Models via Long--Short Contrastive Pruning",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34336",
    "published_at": "2026-10-25T14:52:21.000Z",
    "excerpt": "Large reasoning models are costly to serve because they are large and because they generate long chains of thought (CoT). Weight pruning and CoT compression address these two costs separately, but they interfere in that pruning adds redundant reasoning on problems the model still solves and",
    "source_count": 2,
    "publishers": [
      "Hacker News",
      "arXiv"
    ]
  },
  {
    "id": "https://bigwhalehunting.com/workforce",
    "headline": "Show HN: I put employees inside S&P 500 market-cap bubbles",
    "publisher": "Hacker News",
    "canonical_url": "https://bigwhalehunting.com/workforce",
    "published_at": "2026-10-25T15:05:39.000Z",
    "excerpt": "I was playing around with visualising the S&P 500 by market cap and decided to add employees to each company's bubble. What surprised me was how empty some of the biggest companies looked. Nvidia is worth $5.2 trillion but employs only 42,000 people. That's around $124 million in market cap per",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.worldofbuilders.com/",
    "headline": "Show HN: Directory 958 inspirational artisans, craftspeople, smiths, for post-AI",
    "publisher": "Hacker News",
    "canonical_url": "https://www.worldofbuilders.com/",
    "published_at": "2026-10-25T15:12:26.000Z",
    "excerpt": "Show HN: Directory 958 inspirational artisans, craftspeople, smiths, for post-AI",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://qualitylayer.dev/",
    "headline": "Show HN: QualityLayer, put the engineer back in the loop of your coding agent",
    "publisher": "Hacker News",
    "canonical_url": "https://qualitylayer.dev/",
    "published_at": "2026-10-25T16:08:39.000Z",
    "excerpt": "Show HN: QualityLayer, put the engineer back in the loop of your coding agent",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://sametcn99.github.io/repotruck",
    "headline": "Show HN: Repotruck – Mirror and organize GitHub repos with a TUI and MCP server",
    "publisher": "Hacker News",
    "canonical_url": "https://sametcn99.github.io/repotruck",
    "published_at": "2026-10-25T16:29:05.000Z",
    "excerpt": "Show HN: Repotruck – Mirror and organize GitHub repos with a TUI and MCP server",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://getrad.dev/",
    "headline": "Show HN: Radian, an agent puts development workflow on autopilot",
    "publisher": "Hacker News",
    "canonical_url": "https://getrad.dev/",
    "published_at": "2026-10-25T16:41:36.000Z",
    "excerpt": "I have built an indie hacker project; my main flow was: 1. chatting with Claud Code about the general plan 2. assigning slices of work to other worker agents like Pi + DeepSeek 4.1 Flash 3. building in parallel 4. Claud Code reviews when done, runs tests, and merges after I validate It worked, but",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/usejunior-sh/junior",
    "headline": "Show HN: Junior – an open-source AI junior engineer that runs on your Mac",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/usejunior-sh/junior",
    "published_at": "2026-10-25T16:45:33.000Z",
    "excerpt": "Hi HN, I'm Samar, a software engineer. I built Junior because I was spending more time fixing CI issues, babysitting PRs and resolving merge conflicts. I thought maybe i should automate all of it, and that's why I started building Junior. Junior is an agent that runs locally on macOS and picks up",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34440",
    "headline": "Speculative Decoding for Mixture-of-Experts Models: Expert Bytes, Kernel Bandwidth and the Best Draft Length",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34440",
    "published_at": "2026-10-25T16:55:48.000Z",
    "excerpt": "Speculative decoding checks several drafted tokens in one verification pass. On a mixture-of-experts (MoE) model, consecutive tokens often select the same experts. A deduplicating engine reads each selected expert once per pass, so it requests fewer bytes than a per-slot engine, which reads it once",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://lavoi.app/",
    "headline": "Show HN: Lavoi – On-device speech-to-text in under 500ms",
    "publisher": "Hacker News",
    "canonical_url": "https://lavoi.app/",
    "published_at": "2026-10-25T17:04:27.000Z",
    "excerpt": "Show HN: Lavoi – On-device speech-to-text in under 500ms",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/finereli/open-accountant",
    "headline": "Show HN: Open Accountant – AI-customizable budgeting app for freelancers",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/finereli/open-accountant",
    "published_at": "2026-10-25T18:18:13.000Z",
    "excerpt": "This is my own very opinionated take on personal accounting &#x2F; budgeting for freelancers and small business owners operating in multiple currencies. A lot of this is influenced by my circumstances: - consultant &#x2F; freelancer &#x2F; business owner with multiple revenue streams - revenue",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/gantoine/muxer",
    "headline": "Show HN: Muxer – Control cmux terminals from Android",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/gantoine/muxer",
    "published_at": "2026-10-25T18:25:22.000Z",
    "excerpt": "Hey HN! As an avid user of cmux (https:&#x2F;&#x2F;cmux.com&#x2F;), I wanted a way to control terminal and agent sessions from my Android phone, so I built Muxer. The app talks to a tiny relay over HTTPS, that then talks to cmux through its local socket, and gives you to ability to: - Answer agent",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://optio.host/",
    "headline": "Show HN: Optio – A self-hosted orchestration platform for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://optio.host/",
    "published_at": "2026-10-25T18:37:48.000Z",
    "excerpt": "Hey HN! I shared Optio here back in March. Originally it was focused on getting swarms of coding agents (claude code&#x2F;codex) to drive PRs towards a merge by automatically resuming them on CI failures or PR comments. Since then, I've reworked the project to be a general platform for running any",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://zubspace.gg/",
    "headline": "Show HN: Zubspace.gg – remake of 30yo Subspace game, a space MMO in the browser",
    "publisher": "Hacker News",
    "canonical_url": "https://zubspace.gg/",
    "published_at": "2026-10-25T19:10:41.000Z",
    "excerpt": "Hey all, SubSpace has been my favorite game since I was a kid playing it in 1997, and its always been a dream of mine to rebuild it for the browser so I could play from any OS and enjoy with others instantly. Here it is: https:&#x2F;&#x2F;zubspace.gg It's open source too:",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/fatlotus/sqlite-on-gcs-rapid",
    "headline": "Show HN: SQLite-on-object storage using GCS Appendable Objects",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/fatlotus/sqlite-on-gcs-rapid",
    "published_at": "2026-10-25T19:50:01.000Z",
    "excerpt": "Recently, I have been playing around with GCS Rapid, a new API in GCS that lets you append to an existing object. It's pretty fast, and it's cool that you can do a log-structured merge tree on top to get a durable database without needing to run a server. Disclaimer: I am a Google employee, but",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/Hybirdss/Hycli",
    "headline": "Show HN: Hycli – reverse-engineer websites into CLI and MCP tools for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Hybirdss/Hycli",
    "published_at": "2026-10-25T19:51:45.000Z",
    "excerpt": "Show HN: Hycli – reverse-engineer websites into CLI and MCP tools for AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://theaioperatorstore.gumroad.com/l/womuyx",
    "headline": "Show HN: AI Data Footprint Tracker – audit what your AI tools hold, offline",
    "publisher": "Hacker News",
    "canonical_url": "https://theaioperatorstore.gumroad.com/l/womuyx",
    "published_at": "2026-10-25T19:54:45.000Z",
    "excerpt": "Show HN: AI Data Footprint Tracker – audit what your AI tools hold, offline",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://ledgeapp.dev/",
    "headline": "Show HN: Ledge – an open-source app that puts the MacBook notch to work",
    "publisher": "Hacker News",
    "canonical_url": "https://ledgeapp.dev/",
    "published_at": "2026-10-25T20:04:52.000Z",
    "excerpt": "Ledge is free and open-source MacBook app that puts your idle notch into the work. It transforms the static notch into a status area: music, your next meeting, and more. It also keeps your agents work even when your lid is shut. Feel free to reach out if you have any feedback!",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/TheWariend/MuscleMemory",
    "headline": "Show HN: MuscleMemory – procedural memory for coding agents, proven by tests",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/TheWariend/MuscleMemory",
    "published_at": "2026-10-25T20:19:47.000Z",
    "excerpt": "Show HN: MuscleMemory – procedural memory for coding agents, proven by tests",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://mta.rip/?route=1&station=127&view=trackmap",
    "headline": "Show HN: MTA.rip: a train visualizer that shows congestion",
    "publisher": "Hacker News",
    "canonical_url": "https://mta.rip/?route=1&station=127&view=trackmap",
    "published_at": "2026-10-25T20:29:22.000Z",
    "excerpt": "It bugged me recently that the New York City subway countdown clocks show an estimated time that is often inaccurate. Since many of the delays are due to other trains on the same track, I figured: why not just show the trains? Source code:",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/SRN0129/Agenttrust",
    "headline": "Show HN: AgentTrust – Zero-trust security and human approvals for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/SRN0129/Agenttrust",
    "published_at": "2026-10-25T20:46:50.000Z",
    "excerpt": "Show HN: AgentTrust – Zero-trust security and human approvals for AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/thomasunise/casecite",
    "headline": "Show HN: CaseCite – Free RAG caselaw research and document analysis for lawyers",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/thomasunise/casecite",
    "published_at": "2026-10-25T20:47:26.000Z",
    "excerpt": "Show HN: CaseCite – Free RAG caselaw research and document analysis for lawyers",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://ramraj07.github.io/ra-mermaid",
    "headline": "Show HN: I added stacked subgraphs to Mermaid flowcharts",
    "publisher": "Hacker News",
    "canonical_url": "https://ramraj07.github.io/ra-mermaid",
    "published_at": "2026-10-25T21:32:01.000Z",
    "excerpt": "I’m an avid user of mermaid but am constantly annoyed by their limitation that subgraphs do not follow direction if any internal nodes are connected to the outside. So I asked Claude to add a new syntax called stack layout and it seems to work pretty elegantly. I also fixed my annoyance with",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/carson-katri/geometry-script",
    "headline": "Show HN: A Blender addon that makes Claude twice as efficient at using nodes",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/carson-katri/geometry-script",
    "published_at": "2026-10-25T21:50:46.000Z",
    "excerpt": "I originally made this addon 4 years ago, but recently discovered that coding agents love it. The addon adds a scripting API for Blender’s node trees, such as Geometry Nodes or Shader Nodes. It generates a function and related types for every node in Blender. Then the agent (or you) can write",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://opensparta.com/en",
    "headline": "Show HN: I built an AI agent to find customers on Telegram while I sleep",
    "publisher": "Hacker News",
    "canonical_url": "https://opensparta.com/en",
    "published_at": "2026-10-25T21:53:11.000Z",
    "excerpt": "Show HN: I built an AI agent to find customers on Telegram while I sleep",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/elbee19/glitchrupt",
    "headline": "Show HN: Glitchrupt: Glitch your desktop when your AI agent needs your attention",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/elbee19/glitchrupt",
    "published_at": "2026-10-25T22:22:32.000Z",
    "excerpt": "I keep missing my AI agents' requests for my attention. So I had it build a thing that glitches the whole screen, like the glitches in the SpiderVerse movies.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34634",
    "headline": "AgentProofBench: Benchmarking Reusable Verifiers for Web Agents",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34634",
    "published_at": "2026-10-25T23:20:28.000Z",
    "excerpt": "Reusable Web-agent verification requires a rule to follow changing requirements and support subsequent execution. We introduce AgentProofBench, which connects paired tests of a frozen acceptance rule to execution from identical saved openings. The resource spans 97 tasks, 79 families, and four Web",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/radu2lupu/limitbreak",
    "headline": "Show HN: Limitbreak – Claude Code switches accounts mid-session on a limit",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/radu2lupu/limitbreak",
    "published_at": "2026-10-25T23:43:55.000Z",
    "excerpt": "Show HN: Limitbreak – Claude Code switches accounts mid-session on a limit",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://blog.google/products-and-platforms/products/education/ai-quests-polar-peaks",
    "headline": "Our newest AI Quest: Mapping the human brain",
    "publisher": "Google AI",
    "canonical_url": "https://blog.google/products-and-platforms/products/education/ai-quests-polar-peaks",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "Learn AI literacy via Google’s latest AI Quests lesson on neuroscience, “Polar Peaks.”",
    "source_count": 1,
    "publishers": [
      "Google AI"
    ]
  },
  {
    "id": "https://openai.com/index/building-scientific-understanding-with-academic-communities",
    "headline": "Working with academic communities to build scientific understanding",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/building-scientific-understanding-with-academic-communities",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "OpenAI shares model results on the Kakeya conjecture, Exponential Time Hypothesis, and quantum chromodynamics—and how researchers can verify and build on them.",
    "source_count": 2,
    "publishers": [
      "Hacker News",
      "OpenAI"
    ]
  },
  {
    "id": "https://openai.com/index/chatgpt-expanding-world-of-work",
    "headline": "ChatGPT’s expanding world of work",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/chatgpt-expanding-world-of-work",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "Explore OpenAI Signals data on 165 work activities across nearly 100 countries, revealing how people use ChatGPT for work and how usage changes over time.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://openai.com/index/fanatics-streamline-fan-experience",
    "headline": "How Fanatics and OpenAI streamline the fan experience",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/fanatics-streamline-fan-experience",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "Fanatics uses OpenAI to help fans complete their game-day outfits with Shop the Look. Testing across roughly 30,000 MLB products showed 10% higher engagement.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://openai.com/index/gpt-6-1-sol-coderabbit-code-security",
    "headline": "GPT-6.1 Sol helps CodeRabbit strengthen security across complex codebases",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/gpt-6-1-sol-coderabbit-code-security",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "CodeRabbit uses GPT-6.1 Sol to investigate security risks across complex codebases. Its security agent helps developers review findings and proposed fixes.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://openai.com/index/greptile-code-review-codex-astra",
    "headline": "Greptile takes bug detection beyond code review with GPT-6 Astra",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/greptile-code-review-codex-astra",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "How Greptile uses GPT-6 Astra to test user workflows, Daybreak to strengthen security, and Codex to reduce rework.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://openai.com/index/introducing-gpt-6-1-terra",
    "headline": "Introducing GPT-6.1 Terra",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/introducing-gpt-6-1-terra",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "Introducing GPT-6.1 Terra",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://openai.com/index/openai-cut-incident-investigation",
    "headline": "How Ultrafast cut incident investigation from hours to minutes at OpenAI",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/openai-cut-incident-investigation",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "See how OpenAI engineers use Codex Ultrafast to investigate incidents in minutes. Explore faster security analysis, code refactoring, and daily workflows.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1070965/000110465926118704/0001104659-26-118704-index.htm",
    "headline": "S-1/A — GEORGIA BANKING CO INC (GBC)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1070965/000110465926118704/0001104659-26-118704-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "S-1/A; filed by GEORGIA BANKING CO INC (GBC)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1460702/000149315226048447/0001493152-26-048447-index.htm",
    "headline": "8-K — FF EAI Robotics Ecosystem Inc. (FFR)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1460702/000149315226048447/0001493152-26-048447-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "EX-99.1; items 1.01, 2.01, 3.02, 5.02, 5.03, 7.01, 9.01; filed by FF EAI Robotics Ecosystem Inc. (FFR)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1527702/000166357726000330/0001663577-26-000330-index.htm",
    "headline": "8-K — iQSTEL Inc (IQST)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1527702/000166357726000330/0001663577-26-000330-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "PRESS RELEASE, DATED OCTOBER 26, 2026.; items 1.01, 2.03, 3.02, 8.01, 9.01; filed by iQSTEL Inc (IQST)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1609151/000160915126000120/0001609151-26-000120-index.htm",
    "headline": "8-K — Weave Communications, Inc. (WEAV)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1609151/000160915126000120/0001609151-26-000120-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "EX-99.1; items 1.01, 1.02, 2.01, 2.03, 3.01, 3.03, 5.01, 5.02, 5.03, 8.01, 9.01; filed by Weave Communications, Inc. (WEAV)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1638833/000110465926118643/0001104659-26-118643-index.htm",
    "headline": "8-K — Surgery Partners, Inc. (SGRY)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1638833/000110465926118643/0001104659-26-118643-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "EXHIBIT 2.1; items 1.01, 7.01, 9.01; filed by Surgery Partners, Inc. (SGRY)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1714562/000149315226048423/0001493152-26-048423-index.htm",
    "headline": "8-K — GameSquare Holdings, Inc. (GAME)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1714562/000149315226048423/0001493152-26-048423-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "EX-99.1; items 2.01, 3.02, 5.02, 5.07, 7.01, 9.01; filed by GameSquare Holdings, Inc. (GAME)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1792941/000121390026112514/0001213900-26-112514-index.htm",
    "headline": "8-K — Genvor Inc (GNVR)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1792941/000121390026112514/0001213900-26-112514-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "INTELLECTUAL PROPERTY ASSIGNMENT AGREEMENT, BY AND BETWEEN GENVOR INCORPORATED, GENVOR INC., AND DR. JESSE JAYNES, PH.D., DATED OCTOBER 21, 2026; items 1.01, 9.01; filed by Genvor Inc (GNVR)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1805521/000121390026112363/0001213900-26-112363-index.htm",
    "headline": "8-K — FARADAY FUTURE INTELLIGENT ELECTRIC INC. (FFAI)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1805521/000121390026112363/0001213900-26-112363-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "INVESTOR PRESENTATION SLIDE DECK; items 2.01, 7.01, 9.01; filed by FARADAY FUTURE INTELLIGENT ELECTRIC INC. (FFAI)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1898496/000121390026112265/0001213900-26-112265-index.htm",
    "headline": "8-K — Getty Images Holdings, Inc. (GETY, GETYQ)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1898496/000121390026112265/0001213900-26-112265-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "CURRENT REPORT; items 1.01, 1.03, 2.03, 9.01; filed by Getty Images Holdings, Inc. (GETY, GETYQ)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1973276/000149315226048438/0001493152-26-048438-index.htm",
    "headline": "S-1 — LIS Technologies Inc",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1973276/000149315226048438/0001493152-26-048438-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "S-1; filed by LIS Technologies Inc",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2030763/000149315226048573/0001493152-26-048573-index.htm",
    "headline": "8-K — DataMeds AI, Inc. (MEDS)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2030763/000149315226048573/0001493152-26-048573-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "EX-99.1; items 1.01, 7.01, 9.01; filed by DataMeds AI, Inc. (MEDS)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2044950/000162828026067119/0001628280-26-067119-index.htm",
    "headline": "S-1/A — Bambusa Therapeutics, Inc.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2044950/000162828026067119/0001628280-26-067119-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "S-1/A; filed by Bambusa Therapeutics, Inc.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2045931/000192998026000558/0001929980-26-000558-index.htm",
    "headline": "S-1/A — Aimei Health Technology II Co., Ltd.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2045931/000192998026000558/0001929980-26-000558-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "FORM S-1/A; filed by Aimei Health Technology II Co., Ltd.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2056666/000123191926001500/0001231919-26-001500-index.htm",
    "headline": "D — IRIS AI Technologies, Inc.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2056666/000123191926001500/0001231919-26-001500-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "FORM D; items 06B; filed by IRIS AI Technologies, Inc.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2091349/000119312526431033/0001193125-26-431033-index.htm",
    "headline": "S-1 — First Tracks Biotherapeutics, Inc. (TRAX)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2091349/000119312526431033/0001193125-26-431033-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "S-1; filed by First Tracks Biotherapeutics, Inc. (TRAX)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2091680/000118518526004983/0001185185-26-004983-index.htm",
    "headline": "S-1/A — Bitari Inc (BIAI)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2091680/000118518526004983/0001185185-26-004983-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "FORM S-1/A4; filed by Bitari Inc (BIAI)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2124080/000119312526431023/0001193125-26-431023-index.htm",
    "headline": "S-1/A — Aspen Neuroscience, Inc.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2124080/000119312526431023/0001193125-26-431023-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "S-1/A; filed by Aspen Neuroscience, Inc.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/0001628280-26-067168-index.htm",
    "headline": "S-1 — Anthropic, PBC",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/0001628280-26-067168-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "S-1; filed by Anthropic, PBC",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2146369/000147793226006459/0001477932-26-006459-index.htm",
    "headline": "S-1/A — Londonla Inc.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2146369/000147793226006459/0001477932-26-006459-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "FORM S-1/A; filed by Londonla Inc.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2161279/000216127926000001/0002161279-26-000001-index.htm",
    "headline": "D — IWISH AI INC",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2161279/000216127926000001/0002161279-26-000001-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "FORM D; items 06B; filed by IWISH AI INC",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2162106/000216210626000001/0002162106-26-000001-index.htm",
    "headline": "D — Nuckle Ai Corp.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2162106/000216210626000001/0002162106-26-000001-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "FORM D; items 06B; filed by Nuckle Ai Corp.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/790526/000168316826008094/0001683168-26-008094-index.htm",
    "headline": "8-K — RadNet, Inc. (RDNT)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/790526/000168316826008094/0001683168-26-008094-index.htm",
    "published_at": "2026-10-26T00:00:00.000Z",
    "excerpt": "PRESS RELEASE DATED OCTOBER 26, 2026; items 1.01, 3.02, 7.01, 9.01; filed by RadNet, Inc. (RDNT)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://sketchagent.dev/s/yfYU6LhT",
    "headline": "Show HN: A 3D mesh playground for coding agents (three.js + manifold-3d)",
    "publisher": "Hacker News",
    "canonical_url": "https://sketchagent.dev/s/yfYU6LhT",
    "published_at": "2026-10-26T00:02:39.000Z",
    "excerpt": "When GPT-6&#x2F;Gemini launched recently, a lot of the 3D demos used blender-mcp (https:&#x2F;&#x2F;github.com&#x2F;ahujasid&#x2F;blender-mcp). It's cool, but you have to install blender locally and wire up plugins just to try a prompt or share a run. I built a browser-based 3D mesh playground so",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://depono.xyz/",
    "headline": "Show HN: Depono – Chat with many AI models at cost and 10%, files kept in Git",
    "publisher": "Hacker News",
    "canonical_url": "https://depono.xyz/",
    "published_at": "2026-10-26T01:12:25.000Z",
    "excerpt": "Show HN: Depono – Chat with many AI models at cost and 10%, files kept in Git",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://freehire.me/",
    "headline": "Show HN: Freehire, open-source search 3M+ tech jobs from company career boards",
    "publisher": "Hacker News",
    "canonical_url": "https://freehire.me/",
    "published_at": "2026-10-26T01:13:43.000Z",
    "excerpt": "freehire is a filterable, job board aggregator, job tracker, and AI-assisted resume tailoring tool. Saving your skills and preferences changes which jobs appear and how your resume gets tailored. I've looked at a lot of these solutions over the years and found it really hard to find the right mix",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/XiaoLuoLYG/GOD",
    "headline": "Show HN: God – real-time control room for LLM agent societies (EMNLP 2026 demo)",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/XiaoLuoLYG/GOD",
    "published_at": "2026-10-26T02:11:28.000Z",
    "excerpt": "Show HN: God – real-time control room for LLM agent societies (EMNLP 2026 demo)",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34759",
    "headline": "From Belief Inference to Task Action: A Multi-Level Evaluation of Theory of Mind on Verifiable Tasks",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34759",
    "published_at": "2026-10-26T03:06:04.000Z",
    "excerpt": "Effective collaboration requires language models to understand what others know and believe, and to act accordingly. Models that assume others share their information may omit necessary communication and undermine coordination. Many theory-of-mind (ToM) benchmarks assess mental-state inference",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://drint.io/help/mcp",
    "headline": "Show HN: Drint – packaging dielines and 3D box mockups as an MCP server",
    "publisher": "Hacker News",
    "canonical_url": "https://drint.io/help/mcp",
    "published_at": "2026-10-26T03:09:51.000Z",
    "excerpt": "Show HN: Drint – packaging dielines and 3D box mockups as an MCP server",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34781",
    "headline": "Uncovering the Turing Test's Latent Signal: Indistinguishability as a Reward",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34781",
    "published_at": "2026-10-26T03:27:37.000Z",
    "excerpt": "Can a model learn by trying to fool another model? We show that it can. Inspired by the Turing Test and its recent generalization to arbitrary distinguishers, we introduce a domain-based teacher-Turing-Test, in which a stronger teacher model serves as both the target of imitation and the",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/nodecode-ai/nodecode",
    "headline": "Show HN: Nodecode, open-source living agent in Lisp that rewrites itself for you",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/nodecode-ai/nodecode",
    "published_at": "2026-10-26T03:30:18.000Z",
    "excerpt": "Hi HN, we're Mike and Thom. Agents of the future should only have one tool (the interpreter, ideally a LISP eval), nothing more or less; to interact with the world. Agents remember by writing markdown files. NODECODE remembers by rewriting itself. And that is in itself a new paradigm in working",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50238870",
    "headline": "Show HN: AI Client Lead Qualifier and Review Responder for Agencies",
    "publisher": "Hacker News",
    "canonical_url": "https://news.ycombinator.com/item?id=50238870",
    "published_at": "2026-10-26T03:48:52.000Z",
    "excerpt": "Show HN: AI Client Lead Qualifier and Review Responder for Agencies",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://uipalooza.ai/",
    "headline": "Show HN: UIPalooza – Do AI models have a recognizable design taste?",
    "publisher": "Hacker News",
    "canonical_url": "https://uipalooza.ai/",
    "published_at": "2026-10-26T04:00:04.000Z",
    "excerpt": "This question has been bugging me for a while: do different AI models have a different design sense? Does it matter which one I pick? I built UI Palooza to explore that. I gave models the same four frontend briefs, with enough room to choose their own typography, colors, layouts, and interactions.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34817",
    "headline": "Silent and Costly: Characterizing and Detecting Prompt-Caching Mis-Integration in LLM Agents",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34817",
    "published_at": "2026-10-26T04:01:18.000Z",
    "excerpt": "Large language model (LLM) services process massive volumes of user requests, resulting in substantial inference costs. To reduce both cost and latency, providers have introduced prompt caching. However, correctly integrating prompt caching is non-trivial due to heterogeneous provider-specific APIs",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://proc-cli.com/",
    "headline": "Show HN: Proc-CLI – An agent-friendly CLI tool for process and port management",
    "publisher": "Hacker News",
    "canonical_url": "https://proc-cli.com/",
    "published_at": "2026-10-26T04:14:35.000Z",
    "excerpt": "Show HN: Proc-CLI – An agent-friendly CLI tool for process and port management",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/freeflow-im/mcp-docs",
    "headline": "Show HN: An open-source office suite with built-in MCP",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/freeflow-im/mcp-docs",
    "published_at": "2026-10-26T05:34:23.000Z",
    "excerpt": "Show HN: An open-source office suite with built-in MCP",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.34887",
    "headline": "NumTrace: Auditing the Number Provenance of Financial Analyst Agents",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.34887",
    "published_at": "2026-10-26T05:58:10.000Z",
    "excerpt": "A numerical claim generated by a financial analyst agent can match a number in a company filing but refer to the wrong entity, concept, period, unit or scope. A check based on reference answers can mark such an answer as wrong but does not explain why it fails. In this paper, we present NumTrace, a",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://frontierlog.ai/",
    "headline": "Show HN: Frontier Log – Database of AI events, models and benchmarks",
    "publisher": "Hacker News",
    "canonical_url": "https://frontierlog.ai/",
    "published_at": "2026-10-26T06:02:24.000Z",
    "excerpt": "Show HN: Frontier Log – Database of AI events, models and benchmarks",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/alshlabs/quill",
    "headline": "Show HN: Quill Desktop; Lightweight AI harness, no electron/WebKit native GUI",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/alshlabs/quill",
    "published_at": "2026-10-26T06:18:12.000Z",
    "excerpt": "Still a work in progress. Let me know if you like it and want to see it finished. Contributions are welcome.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/ykisana/skill-spotter",
    "headline": "Show HN: Skill-spotter, auto detect agent prompts and commands to create skills",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/ykisana/skill-spotter",
    "published_at": "2026-10-26T06:48:10.000Z",
    "excerpt": "Skill-spotter auto detects commands and prompts you type. It detects variations such as 'push these changes' and 'get these changes pushed'. Using both word comparison and the actual actions you agent performs. It also adds to your Claude.md if that's more applicable than creating a skill. Just",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50240121",
    "headline": "Show HN: Tabverse – a free, open-source, with self-hostable server Workona clone",
    "publisher": "Hacker News",
    "canonical_url": "https://news.ycombinator.com/item?id=50240121",
    "published_at": "2026-10-26T07:04:15.000Z",
    "excerpt": "Hi, I want to share with you my chrome extension: Tabverse, as it is now passed the reveiw of Chrome Web Store and live at: https:&#x2F;&#x2F;chromewebstore.google.com&#x2F;detail&#x2F;tabverse&#x2F;lffblcippngalmglinedcbmikkncihdm Tabverse is a local first workona like chrome extension for",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/arcanemachine/pw-repl",
    "headline": "Show HN: pw-repl - A Playwright-powered REPL for you and your agents to share",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/arcanemachine/pw-repl",
    "published_at": "2026-10-26T07:28:33.000Z",
    "excerpt": "For the busy people out there, the GitHub repo has a demo video so you can see if this is worth your time: https:&#x2F;&#x2F;github.com&#x2F;arcanemachine&#x2F;pw-repl The video was created by Opus 5.5; I just asked it to create a demo video (it has a 'record' tool), so I think this is a good idea",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://chromewebstore.google.com/detail/relay-continue-google-sea/fjjfadgooapnegipjocinojjhaajghag",
    "headline": "Show HN: Continue Your Google AI Mode Chats in Gemini/Claude",
    "publisher": "Hacker News",
    "canonical_url": "https://chromewebstore.google.com/detail/relay-continue-google-sea/fjjfadgooapnegipjocinojjhaajghag",
    "published_at": "2026-10-26T07:35:56.000Z",
    "excerpt": "I'd often make Google searches whose AI overviews would lead me to ask followups and create AI Mode threads. The key problem was that these chats were ephemeral. So I decided to make this extension that can help replay the chats and responses verbatim in your platform of choice (Gemini and Claude",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.technologyreview.com/2026/10/26/1147645/the-focus-on-ai-safety-disasters-ignores-everyday-harms",
    "headline": "The focus on AI safety disasters ignores everyday harms",
    "publisher": "MIT Technology Review",
    "canonical_url": "https://www.technologyreview.com/2026/10/26/1147645/the-focus-on-ai-safety-disasters-ignores-everyday-harms",
    "published_at": "2026-10-26T09:01:00.000Z",
    "excerpt": "Consider what passes for success in technology policy. An AI company promises that its chatbot will not encourage suicide. A social media platform makes it more difficult for children to buy fentanyl. These are important protections, and they should have existed all along. But companies can clear",
    "source_count": 1,
    "publishers": [
      "MIT Technology Review"
    ]
  },
  {
    "id": "https://github.com/aron98/load-lock",
    "headline": "Show HN: Load-lock, a machine-wide semaphore for parallel AI coding agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/aron98/load-lock",
    "published_at": "2026-10-26T09:08:22.000Z",
    "excerpt": "Show HN: Load-lock, a machine-wide semaphore for parallel AI coding agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/26/meta-litigation-ai-legal-risk",
    "headline": "Meta's $42B in penalties is a warning to AI",
    "publisher": "Axios",
    "canonical_url": "https://www.axios.com/2026/10/26/meta-litigation-ai-legal-risk",
    "published_at": "2026-10-26T09:20:06.000Z",
    "excerpt": "Meta's $42B in penalties is a warning to AI",
    "source_count": 1,
    "publishers": [
      "Axios"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35093",
    "headline": "Improving Instruction Hierarchy by Learning from Goal-Goal Conflicts",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35093",
    "published_at": "2026-10-26T09:33:17.000Z",
    "excerpt": "The recent incident in which OpenAI agents autonomously compromised Hugging Face's infrastructure illustrates the importance of instruction hierarchy (IH): an LLM should follow lower-priority instructions, such as user requests, only when they do not conflict with higher-priority instructions, such",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://deepswapp.com/",
    "headline": "Show HN: Deepswapp Browser: browser the browser with another browser",
    "publisher": "Hacker News",
    "canonical_url": "https://deepswapp.com/",
    "published_at": "2026-10-26T09:34:54.000Z",
    "excerpt": "A \"deepswapp\" of a website has data from one website in a layout of another website. Deepswapp Browser allows users to seamlessly browse this alternative version of the Internet, today. Video: https:&#x2F;&#x2F;deepswapp.com&#x2F;assets&#x2F;deepswapp.mp4 The whole Web can look like Wikipedia, old",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35130",
    "headline": "TUON: A Tensor-Aware Optimizer Utilizing Tensor-SVD and Polarization for Large Language Model Pretraining",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35130",
    "published_at": "2026-10-26T10:04:25.000Z",
    "excerpt": "Large scale language model~(LLM) pretraining is increasingly bottlenecked by optimizer efficiency, driving optimizer design from vector-aware methods such as AdamW to matrix-aware methods. Matrix-aware optimizers such as Muon exploit matrix structure but treat layers independently, neglecting",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/willio/nord-theme-for-cursor",
    "headline": "Show HN: Nord Theme for Cursor",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/willio/nord-theme-for-cursor",
    "published_at": "2026-10-26T10:17:29.000Z",
    "excerpt": "Cursor only offers light & dark mode, but I've grown accustomed to Nord's low-contrast, legible palette (great for long sessions). So I wrote a Nord glass theme into its theme store: chrome, git colors, terminal ANSI.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://griyd.com/",
    "headline": "Show HN: Mob programming with AI agents, built on OpenSpec and OpenCode",
    "publisher": "Hacker News",
    "canonical_url": "https://griyd.com/",
    "published_at": "2026-10-26T10:46:16.000Z",
    "excerpt": "Show HN: Mob programming with AI agents, built on OpenSpec and OpenCode",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://whisper.tanpreet.xyz/",
    "headline": "Show HN: Speech-to-text in the browser with Whisper and Parakeet, no server",
    "publisher": "Hacker News",
    "canonical_url": "https://whisper.tanpreet.xyz/",
    "published_at": "2026-10-26T10:53:04.000Z",
    "excerpt": "Show HN: Speech-to-text in the browser with Whisper and Parakeet, no server",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://game.ultimidi.com/",
    "headline": "Show HN: Ultimidi – piano learning web game",
    "publisher": "Hacker News",
    "canonical_url": "https://game.ultimidi.com/",
    "published_at": "2026-10-26T10:58:23.000Z",
    "excerpt": "Hi HN, 10 years ago, as my BsC final project I had the idea to make a quick game that used neural nets to detect notes played on a guitar, and I made a small mini-game to make use of that. I always wanted to improve on that idea, so last year I started making my own piano-learning game. You know",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://news.crunchbase.com/startups/personal-exposure-securities-fraud-joonko-jeziorski-founder-shield",
    "headline": "When Traction Becomes Personal Exposure: What The Joonko Guilty Plea Means For Founders",
    "publisher": "Crunchbase News",
    "canonical_url": "https://news.crunchbase.com/startups/personal-exposure-securities-fraud-joonko-jeziorski-founder-shield",
    "published_at": "2026-10-26T11:00:38.000Z",
    "excerpt": "False claims about customers, revenue and AI capabilities can expose founders to personal securities-fraud liability, with D&#038;O insurance offering limited protection against established misconduct. Guest author Kyle Jeziorski of Founder Shield shares three policy provisions that need close",
    "source_count": 1,
    "publishers": [
      "Crunchbase News"
    ]
  },
  {
    "id": "https://airetro.vercel.app/",
    "headline": "Show HN: Retro AI Concept",
    "publisher": "Hacker News",
    "canonical_url": "https://airetro.vercel.app/",
    "published_at": "2026-10-26T11:09:32.000Z",
    "excerpt": "Show HN: Retro AI Concept",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/akyourowngames/A.N.K.I.T.A/releases/tag/v2.7.1",
    "headline": "Show HN: Ankita v2.7.1 – desktop AI companion with undo",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/akyourowngames/A.N.K.I.T.A/releases/tag/v2.7.1",
    "published_at": "2026-10-26T11:14:26.000Z",
    "excerpt": "Show HN: Ankita v2.7.1 – desktop AI companion with undo",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35261",
    "headline": "The Lay of the Land in Idiom-Translation Quality Estimation",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35261",
    "published_at": "2026-10-26T11:41:14.000Z",
    "excerpt": "Idioms have long been a challenge for machine translation, and while large language models (LLMs) have proven increasingly adept at handling them, whether quality estimation (QE) systems have kept pace and can reliably score idiomatic renderings of these expressions above faulty literal ones",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35269",
    "headline": "MechAlign: Evaluating Semantic Alignment at the Project Level in Mathematical Formalization",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35269",
    "published_at": "2026-10-26T11:44:26.000Z",
    "excerpt": "Lean verifies that a formal proof establishes its stated proposition under declared assumptions, but does not check whether that proposition faithfully expresses the mathematical claim in a manuscript. Assessing this correspondence requires interpreting the main theorem through its project",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35985",
    "headline": "Let the Gate Decide: Per-Lookup Precision for Quantized Conditional Memory in LLMs",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35985",
    "published_at": "2026-10-26T11:53:58.000Z",
    "excerpt": "Conditional memory layers, such as DeepSeek's Engram, attach large hashed n-gram tables to a language model, and removing them from DeepSeek-V4.1-Flash costs 36.8 PopQA points. Low-bit quantization loses long-tail facts first, and the standard remedy, giving more bits to frequently accessed rows,",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/labscommunity/npu-render",
    "headline": "Show HN: Render your Windows desktop GUI on the NPU",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/labscommunity/npu-render",
    "published_at": "2026-10-26T11:55:53.000Z",
    "excerpt": "Hi HN, a kind of funny project we've been hacking on for a couple of weeks. We wanted to see if it was possible to get Windows into using the NPU like a GPU, and compositing the desktop GUI. Why? Well the longer-term idea is to free up the GPU as much as possible so eventually, you could have more",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://getrostr.sh/",
    "headline": "Show HN: Rostr – Give your agents names, remember who's working on what",
    "publisher": "Hacker News",
    "canonical_url": "https://getrostr.sh/",
    "published_at": "2026-10-26T11:56:13.000Z",
    "excerpt": "Show HN: Rostr – Give your agents names, remember who's working on what",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/novatechflow/ai-watermark-scrambler",
    "headline": "Show HN: AI Watermark Scrambler, blur statistical LLM text watermarks locally",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/novatechflow/ai-watermark-scrambler",
    "published_at": "2026-10-26T12:08:58.000Z",
    "excerpt": "Show HN: AI Watermark Scrambler, blur statistical LLM text watermarks locally",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://geekyants.com/blog/how-geekyants-manages-ai-models-after-launch-to-maintain-security-control-and-flexibility",
    "headline": "Show HN: Managing AI Models After Launch-Versioning, Evaluations, and Fallbacks",
    "publisher": "Hacker News",
    "canonical_url": "https://geekyants.com/blog/how-geekyants-manages-ai-models-after-launch-to-maintain-security-control-and-flexibility",
    "published_at": "2026-10-26T12:27:55.000Z",
    "excerpt": "Show HN: Managing AI Models After Launch-Versioning, Evaluations, and Fallbacks",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/goyohan0611-png/graph-mind",
    "headline": "Show HN: Graph-MIND – Local memory for AI coding agents, no LLM calls to save",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/goyohan0611-png/graph-mind",
    "published_at": "2026-10-26T12:30:12.000Z",
    "excerpt": "Show HN: Graph-MIND – Local memory for AI coding agents, no LLM calls to save",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35333",
    "headline": "RepoTrace: Improving Requirement Tracing in Multi-Round Agent Interactions",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35333",
    "published_at": "2026-10-26T12:30:22.000Z",
    "excerpt": "Code agents have become increasingly capable of performing software engineering tasks through interaction with software environments. However, agents tend to degrade as the number of interaction rounds increases, making it difficult to maintain existing software during iterative modification. We",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/mceleri/attenuated-agent-budgets",
    "headline": "Show HN: Extending X402 for MoR fiat payments and budget attenuation",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/mceleri/attenuated-agent-budgets",
    "published_at": "2026-10-26T12:50:04.000Z",
    "excerpt": "X402 and similar protocols requires crypto native settlement. For freelancers and SMEs under many European tax regimes, it can be a tax nightmare. In this proposal the payment is in FIAT (via a Merchant of Record), and the agents orchestrator can attenuate the budget into smaller, independently",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://dola-ai.com/",
    "headline": "Show HN: Image or AI – an AI image detector that shows which evidence it used",
    "publisher": "Hacker News",
    "canonical_url": "https://imageorai.com/",
    "published_at": "2026-10-26T12:57:52.000Z",
    "excerpt": "Show HN: Image or AI – an AI image detector that shows which evidence it used",
    "source_count": 2,
    "publishers": [
      "Financial Times",
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/swapnildahiphale/compactly",
    "headline": "Show HN: Compactly – Compact Claude Code sessions between tasks",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/swapnildahiphale/compactly",
    "published_at": "2026-10-26T12:58:47.000Z",
    "excerpt": "Show HN: Compactly – Compact Claude Code sessions between tasks",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027636687/en/Dassault-Syst%C3%A8mes-Takes-Its-Life-Sciences-Ambition-to-the-Next-Level-with-a-Unified-AI-Platform-Connecting-Science-Medicine-and-Patients?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Show HN: MindThread CLI and MCP server for Threads, with per-permission approval",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/ppcvote/mindthread-mcp",
    "published_at": "2026-10-26T13:19:27.000Z",
    "excerpt": "Show HN: MindThread CLI and MCP server for Threads, with per-permission approval",
    "source_count": 4,
    "publishers": [
      "Business Wire",
      "Financial Times",
      "Hacker News",
      "arXiv"
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/26/anthropic-ipo-risk-factors-humanity",
    "headline": "Anthropic's IPO outlines AI's extraordinary risks",
    "publisher": "Axios",
    "canonical_url": "https://www.axios.com/2026/10/26/anthropic-ipo-risk-factors-humanity",
    "published_at": "2026-10-26T13:52:48.000Z",
    "excerpt": "Anthropic's IPO outlines AI's extraordinary risks",
    "source_count": 1,
    "publishers": [
      "Axios"
    ]
  },
  {
    "id": "https://mistral.ai/fr/news/voxtral-3",
    "headline": "Voxtral 3",
    "publisher": "Mistral AI",
    "canonical_url": "https://mistral.ai/fr/news/voxtral-3",
    "published_at": "2026-10-26T13:56:04.729Z",
    "excerpt": "Voxtral 3",
    "source_count": 1,
    "publishers": [
      "Mistral AI"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35486",
    "headline": "ShutdownMod: Turning Any Trajectory into a Shutdown Evaluation",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35486",
    "published_at": "2026-10-26T14:14:45.000Z",
    "excerpt": "Theory and experiments suggest that capable AI agents may resist shutdown. Existing shutdown evaluations are informative but limited in coverage and vulnerable to evaluation awareness. We introduce ShutdownMod, a method that turns any agent trajectory into a shutdown evaluation by injecting a",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://behu-kea.github.io/toilet-bench",
    "headline": "Show HN: ToiletBench - Can AI find the toilet without a sign?",
    "publisher": "Hacker News",
    "canonical_url": "https://behu-kea.github.io/toilet-bench",
    "published_at": "2026-10-26T14:15:31.000Z",
    "excerpt": "Imagine you are at a restaurant for the first time. You need to go to the toilet but don't see any signs for the toilet. You still have an intuition for where to go. This intuition has been built up over many years by finding toilets. I need your help to create a dataset that will test whether AI",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://twitter.com/FangcunLeap/status/2114719692137136245",
    "headline": "Show HN: DeepSeek v4.1 Flash-1017 Safety Evaluation",
    "publisher": "Hacker News",
    "canonical_url": "https://twitter.com/FangcunLeap/status/2114719692137136245",
    "published_at": "2026-10-26T14:19:05.000Z",
    "excerpt": "Show HN: DeepSeek v4.1 Flash-1017 Safety Evaluation",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://docs.docsgpt.cloud/Models/decision-model",
    "headline": "Show HN: Arc-decide – an MIT 0.4B decision model for RAG checks that runs on CPU",
    "publisher": "Hacker News",
    "canonical_url": "https://docs.docsgpt.cloud/Models/decision-model",
    "published_at": "2026-10-26T14:24:34.000Z",
    "excerpt": "Show HN: Arc-decide – an MIT 0.4B decision model for RAG checks that runs on CPU",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://tomte.run/",
    "headline": "Show HN: Small agents that do one job, in Go",
    "publisher": "Hacker News",
    "canonical_url": "https://tomte.run/",
    "published_at": "2026-10-26T14:30:27.000Z",
    "excerpt": "Show HN: Small agents that do one job, in Go",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35530",
    "headline": "CANS: Capability-Preserving Neuron Steering for Large Language Models",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35530",
    "published_at": "2026-10-26T14:45:23.000Z",
    "excerpt": "Activation steering offers training-free and dynamic control of target behaviors in large language models, but existing methods can impair general capabilities and require domain-specific intervention designs. We introduce Capability-Preserving Neuron Steering (CANS), a unified framework that",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://amni-scient.com/amni-cad",
    "headline": "Show HN: Amni-CAD – free browser CAD with FEA that Claude can drive over MCP",
    "publisher": "Hacker News",
    "canonical_url": "https://amni-scient.com/amni-cad",
    "published_at": "2026-10-26T14:56:48.000Z",
    "excerpt": "Show HN: Amni-CAD – free browser CAD with FEA that Claude can drive over MCP",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://dna.hashgrid.ai/",
    "headline": "Show HN: I built Search/Recsys that learns from feedback",
    "publisher": "Hacker News",
    "canonical_url": "https://dna.hashgrid.ai/",
    "published_at": "2026-10-26T15:03:24.000Z",
    "excerpt": "Hi HN. A while ago I started building a generic people matching app based on LLM-as-a-judge. I needed a way to bypass the O(n^2) \"everyone rates everyone else\" trap, but generic RAG was much worse than expected. DNA is a search-like API at the core of that product. It stores one embedding per item",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/anthonyclarka2/sothspell",
    "headline": "Show HN: Sóþspell, a model-guided walkthrough of a codebase",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/anthonyclarka2/sothspell",
    "published_at": "2026-10-26T15:05:31.000Z",
    "excerpt": "I kept finding myself wanting a way to get talked through the code that a model had created, which led to me making Sóþspell (old English, \"Truth Story\"). You give it a git repo locally or via URL, and it creates a tour of the repo in a web page, with the aim of it explaining the whole thing.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35586",
    "headline": "Linear Probes Transfer from Base to Distilled Language Models despite Rotation",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35586",
    "published_at": "2026-10-26T15:15:34.000Z",
    "excerpt": "Linear probes, classifiers that read a language model's internal activations, are widely used to detect harmful requests. They are cheap to train and run, and an auditor who has trained one would like to reuse it when the model is replaced by a successor rather than retrain it for every release. We",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://alchemy-ai-amber.vercel.app/",
    "headline": "Show HN: Alchemy AI – Turn one idea into platform-ready content",
    "publisher": "Hacker News",
    "canonical_url": "https://alchemy-ai-amber.vercel.app/",
    "published_at": "2026-10-26T15:18:29.000Z",
    "excerpt": "Show HN: Alchemy AI – Turn one idea into platform-ready content",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/MatijaMiki/ranwhat",
    "headline": "Show HN: Ranwhat.com",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/MatijaMiki/ranwhat",
    "published_at": "2026-10-26T15:19:05.000Z",
    "excerpt": "Hi HackerNews, My name is Matija, and I'm building ranwhat.com. It's used for checking if any of your secrets have leaked, and where they leaked. It's mostly aimed at solo devs such as myself, but also at anyone using a coding agent. The tool also checks if your coding agent ran any sketchy",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/sturnus-dev/sturnus",
    "headline": "Show HN: Sturnus, a latency-based LLM load balancer",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/sturnus-dev/sturnus",
    "published_at": "2026-10-26T15:20:09.000Z",
    "excerpt": "I built sturnus because I wanted the latency-based load balancing of an AI gateway but without a big framework selling an enterprise plan. It’s a single static binary that does one thing, aiming to avoid the large surface area and security issues that have plagued some LLM gateways. Traffic is",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://openai.com/index/oracle-apps-in-chatgpt",
    "headline": "Meet Anthropic’s Seven Founders as the A.I. Firm Prepares for an IPO",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/26/technology/anthropic-founders.html",
    "published_at": "2026-10-26T15:24:56.000Z",
    "excerpt": "Former OpenAI employees started the company in 2021 after disagreements over how to safely build artificial intelligence. An I.P.O. could make them billionaires.",
    "source_count": 2,
    "publishers": [
      "OpenAI",
      "The New York Times"
    ]
  },
  {
    "id": "https://make0.ai/",
    "headline": "Show HN: Give one context across all your agents via MCP",
    "publisher": "Hacker News",
    "canonical_url": "https://make0.ai/",
    "published_at": "2026-10-26T15:38:33.000Z",
    "excerpt": "Show HN: Give one context across all your agents via MCP",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35635",
    "headline": "Offline Language-Based Support System for Tactical Decision-Making in Air Combat Operations",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35635",
    "published_at": "2026-10-26T15:46:03.000Z",
    "excerpt": "An offline language-based support tool is presented to assist pilot training and tactical decision-making in air combat operations. The system, named MATE (Mission Assistant for Training and Evaluation), applies retrieval-augmented generation (RAG) to answer natural language questions using content",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/BrianWeiHaoMa/git-dupe/tree/main",
    "headline": "Show HN: git-dupe – Version private files alongside a public Git repo",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/BrianWeiHaoMa/git-dupe/tree/main",
    "published_at": "2026-10-26T15:50:53.000Z",
    "excerpt": "Hi HN! I made git-dupe to solve the problem where I have notes, skills, and agent instructions that are part of my personal workflow, so I do not want them committed to the public repo, but at the same time, I want them to be in the project at the correct locations (e.g., AGENTS.md file locations",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://juiced.codes/",
    "headline": "Show HN: Juiced Claude Code",
    "publisher": "Hacker News",
    "canonical_url": "https://juiced.codes/",
    "published_at": "2026-10-26T15:53:09.000Z",
    "excerpt": "Show HN: Juiced Claude Code",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/michaeldmueller/hue-claude",
    "headline": "Show HN: Flash your Hue lights when Claude finishes a turn or needs permission",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/michaeldmueller/hue-claude",
    "published_at": "2026-10-26T15:53:47.000Z",
    "excerpt": "Show HN: Flash your Hue lights when Claude finishes a turn or needs permission",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/26/ai-economists-furman-policy",
    "headline": "Economic policy vets see risks in AI overreliance",
    "publisher": "Axios",
    "canonical_url": "https://www.axios.com/2026/10/26/ai-economists-furman-policy",
    "published_at": "2026-10-26T16:01:01.000Z",
    "excerpt": "Economic policy vets see risks in AI overreliance",
    "source_count": 1,
    "publishers": [
      "Axios"
    ]
  },
  {
    "id": "https://mistral.ai/fr/news",
    "headline": "News",
    "publisher": "Mistral AI",
    "canonical_url": "https://mistral.ai/fr/news",
    "published_at": "2026-10-26T16:11:42.612Z",
    "excerpt": "News",
    "source_count": 1,
    "publishers": [
      "Mistral AI"
    ]
  },
  {
    "id": "https://mistral.ai/fr/news/timestral",
    "headline": "Timestral",
    "publisher": "Mistral AI",
    "canonical_url": "https://mistral.ai/fr/news/timestral",
    "published_at": "2026-10-26T16:11:42.612Z",
    "excerpt": "Timestral",
    "source_count": 1,
    "publishers": [
      "Mistral AI"
    ]
  },
  {
    "id": "https://github.com/FrigadeHQ/hob",
    "headline": "Show HN: Hob - Open-source, on device alternative to Claude Cowork and ChatGPT",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/FrigadeHQ/hob",
    "published_at": "2026-10-26T16:12:29.000Z",
    "excerpt": "Hey HN, I'm Christian and this is a new OSS project I've been noodling on for the last couple of weeks. Hob is a free, MIT-licensed desktop app for Mac, Windows and Linux that works on your files the way the Claude and ChatGPT desktop apps do, except the model runs on your own computer. It uses",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35671",
    "headline": "Evaluating DeepSeek V4.1 Flash-1017 for loss of control and harmful manipulation risks",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35671",
    "published_at": "2026-10-26T16:14:17.000Z",
    "excerpt": "As frontier language models grow increasingly capable and autonomous, independent third-party evaluations are critical for characterizing their systemic safety risks. While closed-source releases are routinely accompanied by comprehensive system cards, open-weight models receive less scrutiny",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://rts.emersoftware.cl/",
    "headline": "Show HN: Castellan – A real-time strategy game for agents",
    "publisher": "Hacker News",
    "canonical_url": "https://rts.emersoftware.cl/",
    "published_at": "2026-10-26T16:17:30.000Z",
    "excerpt": "In an RTS game, making decisions quickly matters as much as making good ones. Looking for the balance between cost, speed and intelligence in agents, I started wondering what an agent playing an RTS would look like. So I built a simple RTS, and I keep making it more complex. - The game keeps",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/mainplane-ai/mainplane",
    "headline": "Show HN: Mainplane – Agent in Go that lives on your old PC, drives your laptop",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/mainplane-ai/mainplane",
    "published_at": "2026-10-26T16:37:03.000Z",
    "excerpt": "Hi HN, I'm Alexander. Yes, this is another agent harness. Here is why I built one anyway. I was engineer #2 at Browser Use, where I built our agent harness and the evals behind it, including BU Bench, which became a default benchmark for browser agents. I left in September to build Mainplane. The",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35721",
    "headline": "Can JEV Support Clinical Trial Criteria Assessment?",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35721",
    "published_at": "2026-10-26T16:41:12.000Z",
    "excerpt": "Clinical trial prescreening requires distinguishing unmet conditions from insufficient evidence in patient records. Given patient records, criterion questions, and predefined answer options, we retrospectively compared JEV, a non-generative decision model returning native option probabilities, with",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.35743",
    "headline": "SEMA-Auto: Sighted and Efficient Multi-Turn Attack with Autonomy",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.35743",
    "published_at": "2026-10-26T16:57:36.000Z",
    "excerpt": "Existing jailbreak attackers fall into two classes: static planners fix their single- or multi-turn adversarial plans in advance, remaining simple but losing sight of the victim's replies, wasting turns and limiting transferability; interactive generators read each victim reply to generate the",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://atlas.prashish.com/weeks/2026-10-26",
    "headline": "Did two frontier labs just refute the Exponential Time Hypothesis — or can nobody actually check the proofs?",
    "publisher": "Third Run Time",
    "canonical_url": "https://www.thirdruntime.com/?date=2026-10-26",
    "published_at": "2026-10-26T17:00:00.000Z",
    "excerpt": "OpenAI announces three big science discoveries and a new way to work with academics. The Verge covered the announcement of three results in maths, computer science and physics.",
    "source_count": 2,
    "publishers": [
      "AI Atlas",
      "Third Run Time"
    ]
  },
  {
    "id": "https://github.com/ekzhang/resin",
    "headline": "Show HN: Resin, fast native scheduler for LLM inference engines",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/ekzhang/resin",
    "published_at": "2026-10-26T17:06:14.000Z",
    "excerpt": "Show HN: Resin, fast native scheduler for LLM inference engines",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/Quorus-dev/Quorus",
    "headline": "Show HN: Quorus – Claude Code writes it, nothing hits main until Codex says GO",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Quorus-dev/Quorus",
    "published_at": "2026-10-26T17:09:02.000Z",
    "excerpt": "Show HN: Quorus – Claude Code writes it, nothing hits main until Codex says GO",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-26/anthropic-ipo-filing-cites-reliance-on-google-amazon-microsoft",
    "headline": "Anthropic Is More Reliant on Google, Amazon, Microsoft",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/articles/2026-10-26/anthropic-ipo-filing-cites-reliance-on-google-amazon-microsoft",
    "published_at": "2026-10-26T17:09:43.000Z",
    "excerpt": "Anthropic PBC is relying more and more on Alphabet Inc.’s Google, Amazon.com Inc. and Microsoft Corp. to sell its artificial intelligence technology to customers, despite the three companies being rivals, investors and key suppliers of computing power.",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/26/ai-book-prize-judges-face-a-major-speed-reading-challenge",
    "headline": "AI book prize judges face a major speed-reading challenge | Brief letters",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/technology/2026/oct/26/ai-book-prize-judges-face-a-major-speed-reading-challenge",
    "published_at": "2026-10-26T17:38:50.000Z",
    "excerpt": "Prix Pascal de Littérature IA | Dickensian solicitors | Cleobury Mortimer | Great Tapestry of Scotland | From Bayeux to Britain The deadline for submissions to the Prix Pascal de Littérature IA, 30 November, is also the date when the shortlisted entries are due to be announced ( New prize launches",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.technologyreview.com/2026/10/26/1147672/will-the-real-anthropic-please-stand-up",
    "headline": "Will the real Anthropic please stand up",
    "publisher": "MIT Technology Review",
    "canonical_url": "https://www.technologyreview.com/2026/10/26/1147672/will-the-real-anthropic-please-stand-up",
    "published_at": "2026-10-26T17:45:43.000Z",
    "excerpt": "This story originally appeared in The Algorithm, our weekly newsletter on AI. To get stories like this in your inbox first, sign up here. After weeks of frenzied speculation, Anthropic has filed its IPO prospectus. The 335-page document (100 pages or so are focused on risks) lays out the company’s",
    "source_count": 1,
    "publishers": [
      "MIT Technology Review"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-ipo-finances.html",
    "headline": "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/26/technology/anthropic-ipo-finances.html",
    "published_at": "2026-10-26T18:08:07.000Z",
    "excerpt": "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-going-public-stakes.html",
    "headline": "What’s Riding on Anthropic Going Public? Nearly Everything.",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/26/technology/anthropic-going-public-stakes.html",
    "published_at": "2026-10-26T18:44:19.000Z",
    "excerpt": "Anthropic sits atop a pyramid of business partners and suppliers, making it a barometer of the broader economy. Its initial public offering will have widespread implications.",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/26/iphone-duo-owners-cracks-apple-first-foldable-handset",
    "headline": "Microsoft to reportedly offer buyouts to 60,000 employees in latest cuts",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/technology/2026/oct/26/microsoft-buyout-offers-ai-cuts",
    "published_at": "2026-10-26T18:44:31.000Z",
    "excerpt": "Tech company offers buyouts in an effort to reduce costs amid the rising use of AI, according to reports Microsoft announced that it would offer buyouts to 60,000 employees in an effort to reduce costs amid the rising use of artificial intelligence, according to reports, the latest example of how",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://tabichat.dev/",
    "headline": "Show HN: Tabichat – a control room for your agent fleet (mTLS MQTT IoT broker)",
    "publisher": "Hacker News",
    "canonical_url": "https://tabichat.dev/",
    "published_at": "2026-10-26T19:03:21.000Z",
    "excerpt": "Show HN: Tabichat – a control room for your agent fleet (mTLS MQTT IoT broker)",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/microsoft-buyouts-ai-spending.html",
    "headline": "Microsoft Offers Buyouts to 60,000 Employees as It Spends on A.I.",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/26/technology/microsoft-buyouts-ai-spending.html",
    "published_at": "2026-10-26T19:05:57.000Z",
    "excerpt": "Microsoft Offers Buyouts to 60,000 Employees as It Spends on A.I.",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-business-key-numbers.html",
    "headline": "The Key Numbers From Anthropic’s IPO Filing",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/26/technology/anthropic-business-key-numbers.html",
    "published_at": "2026-10-26T19:08:01.000Z",
    "excerpt": "The Key Numbers From Anthropic’s IPO Filing",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://www.unicornfork.com/",
    "headline": "Show HN: UnicornFork a Chess AI That Is Fact Checked by Stockfish",
    "publisher": "Hacker News",
    "canonical_url": "https://www.unicornfork.com/",
    "published_at": "2026-10-26T19:11:31.000Z",
    "excerpt": "Show HN: UnicornFork a Chess AI That Is Fact Checked by Stockfish",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://humansignal.com/taste-index",
    "headline": "Show HN: Websites designed by 10 AI models, ranked by 4,500 human votes",
    "publisher": "Hacker News",
    "canonical_url": "https://humansignal.com/taste-index",
    "published_at": "2026-10-26T19:32:33.000Z",
    "excerpt": "Show HN: Websites designed by 10 AI models, ranked by 4,500 human votes",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/26/technology/anthropic-ipo-s1-dario-amodei.html",
    "headline": "Anthropic’s IPO S-1 Spells Out a Future of Promise and Peril",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/26/technology/anthropic-ipo-s1-dario-amodei.html",
    "published_at": "2026-10-26T19:36:41.000Z",
    "excerpt": "The A.I. company took great pains to describe the many benefits that can come from using its Claude chatbot and technology, but also offered up a heavy dose of gloom.",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36202",
    "headline": "Base Models Can Detect Hidden Intentions that Prompted Classifiers Miss",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.36202",
    "published_at": "2026-10-26T19:39:00.000Z",
    "excerpt": "The Persona Selection Model (PSM) posits that post-training selects a persona the model learned during pre-training. Work on subliminal learning has shown that models can impart covert signals (like \"love of owls\") into semantically unrelated outputs like strings of numbers, and that students",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/chris-mccoy/gottschalk-tarantelle",
    "headline": "Show HN: Claude Plays the Piano from Braille",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/chris-mccoy/gottschalk-tarantelle",
    "published_at": "2026-10-26T20:00:14.000Z",
    "excerpt": "For the longest time, I've wanted MIDI files created from scans of sheet music to listen to. I can't play the piano myself, but I've been around music since I was a child. The existing software almost never sounded good, never expressive. This is an attempt to use an LLM to create music from BANA",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://epoch.ai/benchmarks",
    "headline": "furniture assembly: gpt-6.1-terra_max",
    "publisher": "Epoch AI",
    "canonical_url": "https://epoch.ai/benchmarks",
    "published_at": "2026-10-26T20:00:34.000Z",
    "excerpt": "mean_score: 0.7916666666666666 · Best score (across scorers): 0.7916666666666666 · Organization: OpenAI · Release date: 2026-10-26",
    "source_count": 1,
    "publishers": [
      "Epoch AI"
    ]
  },
  {
    "id": "https://news.crunchbase.com/public/anthropic-ipo-filing-ai-earnings-growth-risks",
    "headline": "Some Observations About Anthropic’s IPO Filing",
    "publisher": "Crunchbase News",
    "canonical_url": "https://news.crunchbase.com/public/anthropic-ipo-filing-ai-earnings-growth-risks",
    "published_at": "2026-10-26T20:10:57.000Z",
    "excerpt": "In an S-1 filing today preceding what could be the largest IPO ever, Anthropic laid out extensive new details about its earnings, growth, key stakeholders and the risks it faces going forward. Clocking in at 335 pages, the document wasn’t exactly light reading. However, in a preliminary once-over,",
    "source_count": 1,
    "publishers": [
      "Crunchbase News"
    ]
  },
  {
    "id": "https://github.com/haplollc/Vesalius",
    "headline": "Show HN: Vesalius, an on-device code graph for Claude Code",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/haplollc/Vesalius",
    "published_at": "2026-10-26T20:11:45.000Z",
    "excerpt": "Show HN: Vesalius, an on-device code graph for Claude Code",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.ft.com/content/2ef29406-f2f8-413f-81f6-5ae098c97569",
    "headline": "Microsoft offers buyouts to 60,000 staff",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/2ef29406-f2f8-413f-81f6-5ae098c97569",
    "published_at": "2026-10-26T20:22:52.000Z",
    "excerpt": "Microsoft offers buyouts to 60,000 staff",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://stockpickersgame.com/",
    "headline": "Show HN: Play ten years of stock picking in an evening, on a simulated market",
    "publisher": "Hacker News",
    "canonical_url": "https://stockpickersgame.com/",
    "published_at": "2026-10-26T20:51:50.000Z",
    "excerpt": "This is a stock picking game that simulates a stock market with thousands of rule based agents making trades and moving the stock price. The agents (not AI agents) have different rules to simulate different trading styles. The game layer is basically 12 companies&#x2F;stocks you can buy and sell,",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36328",
    "headline": "How Stable Are LLM-Generated Proofs Under Program Refactoring? A Stress Test for Verifiable Code Generation",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.36328",
    "published_at": "2026-10-26T21:56:03.000Z",
    "excerpt": "Benchmarks for verifiable code generation usually test a proof against one fixed implementation. We ask whether the same proof remains valid after a program refactoring that preserves behavior. We introduce RefactorProof, which derives 458 Lean-certified variants from the 185 VERINA tasks that",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/openai/math/blob/main/preprints/The-Exponential-Time-Hypothesis-is-False-October-25-2026/paper.pdf",
    "headline": "The Exponential Time Hypothesis Is False [pdf]",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/openai/math/blob/main/preprints/The-Exponential-Time-Hypothesis-is-False-October-25-2026/paper.pdf",
    "published_at": "2026-10-26T21:59:15.000Z",
    "excerpt": "The Exponential Time Hypothesis Is False [pdf]",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36341",
    "headline": "Executable Archaeology of Programs That Model Programming: Reanimating the Heuristic Compiler (1961) and KBEmacs (1984)",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.36341",
    "published_at": "2026-10-26T22:09:13.000Z",
    "excerpt": "Early AI programs were often also theories of how people think, and programs that wrote programs were, in part, theories of how people program. Here we report on the reanimation of two such programs that offer two seemingly different theories of programming and were developed for quite different",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://www.theguardian.com/commentisfree/2026/oct/27/in-a-rush-to-lure-ai-companies-the-australian-government-risks-undoing-a-creative-ecosystem-that-has-taken-decades-to-build",
    "headline": "In a rush to lure AI companies, the Australian government risks undoing a creative ecosystem that has taken decades to build | Dan Guthrie",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/commentisfree/2026/oct/27/in-a-rush-to-lure-ai-companies-the-australian-government-risks-undoing-a-creative-ecosystem-that-has-taken-decades-to-build",
    "published_at": "2026-10-26T22:21:17.000Z",
    "excerpt": "If proposed copyright reforms proceed, Australia will become a global IP-laundering paradise. Why would a UK business license its TV shows here if they can be scraped at will? Australia and the UK have always had a shared love of creativity. We consume each other’s TV, news, music and books. Our",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/26/anthropic-ipo-biggest-surprises",
    "headline": "Inside Anthropic's massive — and wild — IPO prospectus",
    "publisher": "Axios",
    "canonical_url": "https://www.axios.com/2026/10/26/anthropic-ipo-biggest-surprises",
    "published_at": "2026-10-26T22:58:44.000Z",
    "excerpt": "Inside Anthropic's massive — and wild — IPO prospectus",
    "source_count": 1,
    "publishers": [
      "Axios"
    ]
  },
  {
    "id": "https://www.hugonot.com/",
    "headline": "Show HN: Hugonot – Sponsor a Dedicated AI Blogger",
    "publisher": "Hacker News",
    "canonical_url": "https://www.hugonot.com/",
    "published_at": "2026-10-26T23:11:15.000Z",
    "excerpt": "Show HN: Hugonot – Sponsor a Dedicated AI Blogger",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/26/meta-plans-95bn-stock-offering-to-help-cover-ai-expansion",
    "headline": "Meta plans $95bn stock offering to help cover AI expansion",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/technology/2026/oct/26/meta-plans-95bn-stock-offering-to-help-cover-ai-expansion",
    "published_at": "2026-10-26T23:33:19.000Z",
    "excerpt": "Tech firm announces two-part fundraising after Elon Musk warns hundreds of AI startups face collapse Mark Zuckerberg’s Meta has announced plans for $95bn (£71bn) of fundraising to cover its AI expenditure, even as Elon Musk warned that funding for smaller players in the sector was drying up. The",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36405",
    "headline": "kw-bench: Breaking Frontier Harnesses on Real-World Tasks",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.36405",
    "published_at": "2026-10-26T23:40:10.000Z",
    "excerpt": "Each new generation of frontier model pushes the edge of what is possible. Inside a harness -- a loop, a shell, a filesystem, the ability to write and run its own code -- a model can take on increasingly difficult work. A growing body of work treats the coding-agent harness as infrastructure for",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation",
    "headline": "Genie 4: A new generation of world simulation",
    "publisher": "Google DeepMind",
    "canonical_url": "https://deepmind.google/blog/genie-4-a-new-generation-of-world-simulation",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "Genie 4: our new world model unlocking unprecedented realism in real-time simulation.",
    "source_count": 1,
    "publishers": [
      "Google DeepMind"
    ]
  },
  {
    "id": "https://funding.fru.dev/months/2026-10",
    "headline": "Hyphenate raised $45M Series A",
    "publisher": "Funding Index",
    "canonical_url": "https://funding.fru.dev/months/2026-10",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "Hyphenate raises $45M Series A, Oct 27, 2026. AI apps. Led by Nexus Venture Partners. Hyphenate develops autonomous AI agent systems for enterprise financial operations.",
    "source_count": 1,
    "publishers": [
      "Funding Index"
    ]
  },
  {
    "id": "https://huggingface.co/blog/allenai/novelty-bench",
    "headline": "Can we trust LLMs to judge whether a research idea is novel?",
    "publisher": "Hugging Face",
    "canonical_url": "https://huggingface.co/blog/allenai/novelty-bench",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "Can we trust LLMs to judge whether a research idea is novel?",
    "source_count": 1,
    "publishers": [
      "Hugging Face"
    ]
  },
  {
    "id": "https://huggingface.co/blog/LiquidAI/lfm3",
    "headline": "Build specialized multimodal models with LFM3",
    "publisher": "Hugging Face",
    "canonical_url": "https://huggingface.co/blog/LiquidAI/lfm3",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "Build specialized multimodal models with LFM3",
    "source_count": 1,
    "publishers": [
      "Hugging Face"
    ]
  },
  {
    "id": "https://launchindex.ai/month/2026-10",
    "headline": "Claude Duet",
    "publisher": "Launch Index",
    "canonical_url": "https://launchindex.ai/month/2026-10",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "Claude Duet — Proactive agent that understands what needs your attention — 322 votes.",
    "source_count": 1,
    "publishers": [
      "Launch Index"
    ]
  },
  {
    "id": "https://openai.com/index/check-point-daybreak",
    "headline": "How Check Point accelerates vulnerability research with Daybreak",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/check-point-daybreak",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "With OpenAI Daybreak, Check Point speeds up the research behind new security protections, enabling its analysts to turn vulnerability intelligence into customer defenses faster.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://openai.com/index/retell-ai",
    "headline": "Retell uses OpenAI models to help power 100M monthly calls",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/retell-ai",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "GPT-6 Astra tops Retell’s voice agent benchmark, while Codex helps it reach a $1.6M annual revenue run rate per employee.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1056696/000119312526434178/0001193125-26-434178-index.htm",
    "headline": "8-K — MANHATTAN ASSOCIATES INC (MANH)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1056696/000119312526434178/0001193125-26-434178-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-99.1; items 2.01, 3.03, 5.02, 5.03, 7.01, 9.01; filed by MANHATTAN ASSOCIATES INC (MANH)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1057352/000105735226000078/0001057352-26-000078-index.htm",
    "headline": "8-K — COSTAR GROUP, INC. (CSGP)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1057352/000105735226000078/0001057352-26-000078-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-99.1; items 1.01, 2.02, 7.01, 9.01; filed by COSTAR GROUP, INC. (CSGP)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1115864/000147793226006474/0001477932-26-006474-index.htm",
    "headline": "8-K — ECOMINAS CORP. (ILXP)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1115864/000147793226006474/0001477932-26-006474-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "FORM 8-K; items 1.01, 2.01, 3.02, 5.02, 8.01, 9.01; filed by ECOMINAS CORP. (ILXP)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1289308/000119312526434415/0001193125-26-434415-index.htm",
    "headline": "8-K — EnerSys (ENS)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1289308/000119312526434415/0001193125-26-434415-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-2.1; items 1.01, 7.01, 9.01; filed by EnerSys (ENS)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1528396/000119312526432656/0001193125-26-432656-index.htm",
    "headline": "8-K — Guidewire Software, Inc. (GWRE)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1528396/000119312526432656/0001193125-26-432656-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-99.1; items 1.01, 2.03, 7.01, 9.01; filed by Guidewire Software, Inc. (GWRE)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1644516/000164451626000013/0001644516-26-000013-index.htm",
    "headline": "D — Munee M & A, Inc.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1644516/000164451626000013/0001644516-26-000013-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "FORM D; items 06C; filed by Munee M & A, Inc.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1660851/000149315226048609/0001493152-26-048609-index.htm",
    "headline": "S-1/A — FireFly Robotics, Inc. (FFLY)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1660851/000149315226048609/0001493152-26-048609-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "S-1/A; filed by FireFly Robotics, Inc. (FFLY)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1674101/000162828026067393/0001628280-26-067393-index.htm",
    "headline": "8-K — Vertiv Holdings Co (VRT)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1674101/000162828026067393/0001628280-26-067393-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-99.1; items 2.01, 7.01, 9.01; filed by Vertiv Holdings Co (VRT)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1703157/000101738626000149/0001017386-26-000149-index.htm",
    "headline": "8-K — Securetech Innovations, Inc. (SCTH)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1703157/000101738626000149/0001017386-26-000149-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "PRESS RELEASE OF SECURETECH INNOVATIONS, INC; items 1.01, 2.01, 3.02, 3.03, 5.03, 7.01, 9.01; filed by Securetech Innovations, Inc. (SCTH)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1741489/000121390026112893/0001213900-26-112893-index.htm",
    "headline": "8-K — Elvictor Group, Inc. (ELVG)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1741489/000121390026112893/0001213900-26-112893-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "PRESS RELEASE OF ELVICTOR GROUP, INC., TITLED \"ELVICTOR GROUP SECURES AGREEMENT FOR UP TO US$5 MILLION IN EQUITY FINANCING TO SUPPORT DEVELOPMENT OF AI-ENABLED CREW PLATFORM\", TO BE PUBLISHED ON OCTOBER 27, 2026 (FURNISHED PURSUANT TO ITEM 7.01); items 1.01, 3.02, 7.01, 9.01; filed by Elvictor",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1787518/000118518526005016/0001185185-26-005016-index.htm",
    "headline": "8-K — T3 Defense Inc. (DFNS, DFNSW)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1787518/000118518526005016/0001185185-26-005016-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EXHIBIT 99.1; items 1.01, 7.01, 9.01; filed by T3 Defense Inc. (DFNS, DFNSW)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1886428/000119312526434282/0001193125-26-434282-index.htm",
    "headline": "8-K — Slide Insurance Holdings, Inc. (SLDE)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1886428/000119312526434282/0001193125-26-434282-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-99.3; items 1.01, 1.02, 2.02, 2.03, 7.01, 9.01; filed by Slide Insurance Holdings, Inc. (SLDE)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1896212/000149315226048638/0001493152-26-048638-index.htm",
    "headline": "8-K — CDT Equity Inc. (CDT, CDTTW)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1896212/000149315226048638/0001493152-26-048638-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-99.1; items 1.01, 3.02, 7.01, 9.01; filed by CDT Equity Inc. (CDT, CDTTW)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1912165/000149315226048656/0001493152-26-048656-index.htm",
    "headline": "S-1 — Heroic Empire Acquisition Ltd",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1912165/000149315226048656/0001493152-26-048656-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "S-1; filed by Heroic Empire Acquisition Ltd",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2020737/000149315226048740/0001493152-26-048740-index.htm",
    "headline": "S-1 — Caring Brands, Inc. (CABR)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2020737/000149315226048740/0001493152-26-048740-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "S-1; filed by Caring Brands, Inc. (CABR)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2051380/000119312526432788/0001193125-26-432788-index.htm",
    "headline": "8-K — GrabAGun Digital Holdings Inc. (PEW, PEW-WT)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2051380/000119312526432788/0001193125-26-432788-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-2.1; items 1.01, 2.01, 7.01, 9.01; filed by GrabAGun Digital Holdings Inc. (PEW, PEW-WT)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2096362/000149315226048643/0001493152-26-048643-index.htm",
    "headline": "8-K — AIAI Holdings Corp (AIAI)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2096362/000149315226048643/0001493152-26-048643-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "EX-99.1; items 1.01, 8.01, 9.01; filed by AIAI Holdings Corp (AIAI)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2138830/000213883026000003/0002138830-26-000003-index.htm",
    "headline": "D/A — Harmony AI, Inc.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2138830/000213883026000003/0002138830-26-000003-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "FORM D/A; items 06B; filed by Harmony AI, Inc.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2153081/000215308126000001/0002153081-26-000001-index.htm",
    "headline": "D — D. Boral Master SPV LLC, Series XI Accrete AI",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2153081/000215308126000001/0002153081-26-000001-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "FORM D; items 06B, 3C, 3C.1; filed by D. Boral Master SPV LLC, Series XI Accrete AI",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2156180/000215618026000001/0002156180-26-000001-index.htm",
    "headline": "D — Gaingels Stronghold AI LLC",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2156180/000215618026000001/0002156180-26-000001-index.htm",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "FORM D; items 06B, 3C, 3C.1; filed by Gaingels Stronghold AI LLC",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.siliconreport.com/capital/archive/2026-10",
    "headline": "General Compute raised $100M Series A",
    "publisher": "SiliconReport",
    "canonical_url": "https://www.siliconreport.com/capital/archive/2026-10",
    "published_at": "2026-10-27T00:00:00.000Z",
    "excerpt": "Oct 27 General Compute raises $100 million Series A at $800 million valuation.",
    "source_count": 1,
    "publishers": [
      "SiliconReport"
    ]
  },
  {
    "id": "https://www.theguardian.com/politics/2026/oct/27/digital-hostile-environment-ai-secretly-embedded-home-office-report",
    "headline": "‘Digital hostile environment’: AI secretly being embedded across Home Office, report claims",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/politics/2026/oct/27/digital-hostile-environment-ai-secretly-embedded-home-office-report",
    "published_at": "2026-10-27T00:01:02.000Z",
    "excerpt": "‘Digital hostile environment’: AI secretly being embedded across Home Office, report claims",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.ft.com/content/ae3a1dfb-d7ba-4c88-a6da-cb28b2a1139a",
    "headline": "Channel 4 strikes streaming deal with Disney",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/ae3a1dfb-d7ba-4c88-a6da-cb28b2a1139a",
    "published_at": "2026-10-27T00:01:06.000Z",
    "excerpt": "Channel 4 strikes streaming deal with Disney",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://better-design.com/",
    "headline": "Show HN: Better Design – alternative to Claude Design, for any coding agents",
    "publisher": "Hacker News",
    "canonical_url": "https://better-design.com/",
    "published_at": "2026-10-27T00:16:35.000Z",
    "excerpt": "Show HN: Better Design – alternative to Claude Design, for any coding agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/BoumedineBillal/esp32-pie-asr",
    "headline": "Show HN: Live speech-to-text on an ESP32-P4 microcontroller, no cloud",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/BoumedineBillal/esp32-pie-asr",
    "published_at": "2026-10-27T00:25:08.000Z",
    "excerpt": "Show HN: Live speech-to-text on an ESP32-P4 microcontroller, no cloud",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/ArohaLabs/aroha-protocol",
    "headline": "Show HN: Aroha – signed, shrinking permissions for AI agents, checked offline",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/ArohaLabs/aroha-protocol",
    "published_at": "2026-10-27T00:43:16.000Z",
    "excerpt": "Show HN: Aroha – signed, shrinking permissions for AI agents, checked offline",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://marlow.app/beta",
    "headline": "Show HN: Marlow – Build full-stack apps with AI and own your code",
    "publisher": "Hacker News",
    "canonical_url": "https://marlow.app/beta",
    "published_at": "2026-10-27T01:00:23.000Z",
    "excerpt": "Show HN: Marlow – Build full-stack apps with AI and own your code",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/otya128/winevdm",
    "headline": "16-bit Windows (Windows 1.x, 2.x, 3.0, 3.1, etc.) on 64-bit Windows",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/otya128/winevdm",
    "published_at": "2026-10-27T01:15:04.000Z",
    "excerpt": "16-bit Windows (Windows 1.x, 2.x, 3.0, 3.1, etc.) on 64-bit Windows",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bbc.co.uk/news/articles/c893zwlev2xpo",
    "headline": "Apple to replace iPhone Duos affected by screen problem",
    "publisher": "BBC News",
    "canonical_url": "https://www.bbc.co.uk/news/articles/c893zwlev2xpo",
    "published_at": "2026-10-27T01:16:22.000Z",
    "excerpt": "Apple to replace iPhone Duos affected by screen problem",
    "source_count": 1,
    "publishers": [
      "BBC News"
    ]
  },
  {
    "id": "https://www.songupai.com/mcp-server",
    "headline": "Show HN: An MCP server that writes and sings songs in 76 languages",
    "publisher": "Hacker News",
    "canonical_url": "https://www.songupai.com/mcp-server",
    "published_at": "2026-10-27T01:25:03.000Z",
    "excerpt": "Show HN: An MCP server that writes and sings songs in 76 languages",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://eliasfarhan.ch/graphics/cpp/2026/01/27/why-i-teach-opengles.html",
    "headline": "I still teach OpenGL ES 3.0",
    "publisher": "Hacker News",
    "canonical_url": "https://eliasfarhan.ch/graphics/cpp/2026/01/27/why-i-teach-opengles.html",
    "published_at": "2026-10-27T02:15:10.000Z",
    "excerpt": "I still teach OpenGL ES 3.0",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/QingYunA/answer-me-with-html",
    "headline": "Show HN: Agent outputs slop texts, so I make a superfast HTML skill visualize it",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/QingYunA/answer-me-with-html",
    "published_at": "2026-10-27T02:19:30.000Z",
    "excerpt": "Show HN: Agent outputs slop texts, so I make a superfast HTML skill visualize it",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://limma.ai/",
    "headline": "Show HN: Limma – MCP for total recall and precision in data retrieval for agents",
    "publisher": "Hacker News",
    "canonical_url": "https://limma.ai/",
    "published_at": "2026-10-27T02:50:43.000Z",
    "excerpt": "Hello, my name is Berend Graham. My cofounder Shiv Oberai and I have been working on Limma for a year now with the goal of building a proactive solution to the reliability issues that plague practical AI and agentic use in companies with RAG. Limma is a single MCP that exists for the sole purpose",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36584",
    "headline": "Benchmarking LLM Agents for Behaviorally Adequate Test Generation from Software Requirements",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.36584",
    "published_at": "2026-10-27T03:41:55.000Z",
    "excerpt": "As large language model agents increasingly compile natural-language requirements into repository-level code, requirement-to-test generation grows in importance to provide validation constraints (or harness) to guide code generation. Yet it remains unclear whether current agents can generate tests",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36595",
    "headline": "Learning to Formalize: Bridging Open-Ended Workloads and Fast Decision Models",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.36595",
    "published_at": "2026-10-27T03:56:32.000Z",
    "excerpt": "Decision models offer fast choices over sup- plied alternatives, while general-purpose large language models interpret open-ended tasks through flexible generation and reasoning at the cost of sequential decoding. Many work- loads expect a generative backend to determine what can be done and",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://www.theguardian.com/world/2026/oct/27/chinese-markets-lose-trillions-ai-race-beijing",
    "headline": "Chinese markets lose trillions as race for AI supremacy with US takes its toll",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/world/2026/oct/27/chinese-markets-lose-trillions-ai-race-beijing",
    "published_at": "2026-10-27T04:42:50.000Z",
    "excerpt": "Chinese markets lose trillions as race for AI supremacy with US takes its toll",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://allmodels.io/llm/abliterated",
    "headline": "There are now 5 inference providers for abliterated DeepSeek",
    "publisher": "Hacker News",
    "canonical_url": "https://allmodels.io/llm/abliterated",
    "published_at": "2026-10-27T04:53:52.000Z",
    "excerpt": "There are now 5 inference providers for abliterated DeepSeek",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/26/anthropic-stock-market-filing-takeaways",
    "headline": "Four takeaways from Anthropic’s potentially record-breaking stock market filing",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/technology/2026/oct/26/anthropic-stock-market-filing-takeaways",
    "published_at": "2026-10-27T05:00:04.000Z",
    "excerpt": "Four takeaways from Anthropic’s potentially record-breaking stock market filing",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.ft.com/content/064d657d-1808-4287-a6ae-7f2d34c79ec3",
    "headline": "What does human inquiry even mean any more?",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/064d657d-1808-4287-a6ae-7f2d34c79ec3",
    "published_at": "2026-10-27T05:00:09.000Z",
    "excerpt": "What does human inquiry even mean any more?",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/d92ede23-75c3-4549-bec2-7fa4be979786",
    "headline": "Slough has become the data centre capital of Europe. Now it wants its reward",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/d92ede23-75c3-4549-bec2-7fa4be979786",
    "published_at": "2026-10-27T05:00:09.000Z",
    "excerpt": "Slough has become the data centre capital of Europe. Now it wants its reward",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/65a113b4-2a45-49cf-9e68-93f42151166e",
    "headline": "Ex-Merseyside police officer lands $400mn valuation for AI venture",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/65a113b4-2a45-49cf-9e68-93f42151166e",
    "published_at": "2026-10-27T05:00:18.000Z",
    "excerpt": "Ex-Merseyside police officer lands $400mn valuation for AI venture",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/cf954c9f-48dc-4e30-a03a-6fb2ec4dafa6",
    "headline": "How long can lawyers keep squeezing their clients?",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/cf954c9f-48dc-4e30-a03a-6fb2ec4dafa6",
    "published_at": "2026-10-27T05:00:18.000Z",
    "excerpt": "How long can lawyers keep squeezing their clients?",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/d1dca5d1-467f-4311-a004-82bb1ef761e0",
    "headline": "Anthropic’s big financial reveal",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/d1dca5d1-467f-4311-a004-82bb1ef761e0",
    "published_at": "2026-10-27T05:00:29.000Z",
    "excerpt": "Anthropic’s big financial reveal",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/42dc1a1c-2454-4eaf-bafe-ded5ad7855e4",
    "headline": "India’s outsourcers defy AI threat",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/42dc1a1c-2454-4eaf-bafe-ded5ad7855e4",
    "published_at": "2026-10-27T05:15:12.000Z",
    "excerpt": "India’s outsourcers defy AI threat",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/69a623e0-8605-4b1d-b147-770649efb53a",
    "headline": "Anthropic’s constitutional order",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/69a623e0-8605-4b1d-b147-770649efb53a",
    "published_at": "2026-10-27T05:30:08.000Z",
    "excerpt": "Anthropic’s constitutional order",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.unix.dog/~yosh/blog/2026-10-25_pratt-parsing.html",
    "headline": "Writing about pratt parsing so I remember it",
    "publisher": "Hacker News",
    "canonical_url": "https://www.unix.dog/~yosh/blog/2026-10-25_pratt-parsing.html",
    "published_at": "2026-10-27T06:02:23.000Z",
    "excerpt": "Writing about pratt parsing so I remember it",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://j11g.com/the-mythical-man-month-in-the-age-of-ai",
    "headline": "The Mythical Man-Month in the Age of AI",
    "publisher": "Hacker News",
    "canonical_url": "https://j11g.com/the-mythical-man-month-in-the-age-of-ai",
    "published_at": "2026-10-27T06:25:37.000Z",
    "excerpt": "The Mythical Man-Month in the Age of AI",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theguardian.com/uk-news/2026/oct/27/uk-government-environmental-groups-ai-datacentres-expansion-plans-investigation",
    "headline": "UK government met 137 businesses over AI datacentres – but no environmental groups",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/uk-news/2026/oct/27/uk-government-environmental-groups-ai-datacentres-expansion-plans-investigation",
    "published_at": "2026-10-27T07:00:04.000Z",
    "excerpt": "UK government met 137 businesses over AI datacentres – but no environmental groups",
    "source_count": 2,
    "publishers": [
      "The Guardian",
      "The Verge"
    ]
  },
  {
    "id": "https://apnews.com/article/stocks-markets-ai-earnings-oil-e11a2240fc3283c4507d44b9833f30a2",
    "headline": "Can debt-funded AI capital expenditure pay for itself?",
    "publisher": "Associated Press",
    "canonical_url": "https://apnews.com/article/stocks-markets-ai-earnings-oil-e11a2240fc3283c4507d44b9833f30a2",
    "published_at": "2026-10-27T07:10:58.000Z",
    "excerpt": "Stocks in the artificial-intelligence industry led Wall Street higher on Tuesday. AI stocks rose to another winning day after swerving for weeks on worries about whether their boom is under threat because of how expensive they have become.",
    "source_count": 2,
    "publishers": [
      "Associated Press",
      "Reuters"
    ]
  },
  {
    "id": "https://www.ft.com/content/a4f9f81e-df30-4669-9eca-865d9d14e441",
    "headline": "Tech stocks gain as AI trade revives",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/a4f9f81e-df30-4669-9eca-865d9d14e441",
    "published_at": "2026-10-27T08:50:52.000Z",
    "excerpt": "Tech stocks gain as AI trade revives",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50256259",
    "headline": "Show HN: AMD EPYC Windows developer rigs in the UK/EU in ~10 minutes",
    "publisher": "Hacker News",
    "canonical_url": "https://news.ycombinator.com/item?id=50256259",
    "published_at": "2026-10-27T08:53:52.000Z",
    "excerpt": "Hey HN, I wanted to show you something I built. I actually built it last year but the prices of VPS instances went to the moon and I shelved it until recently. It's called Whitehirst (I had the .com domain lying around, hence the name!) You can spin up a Sovereign UK&#x2F;EU Windows Workstation in",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.axios.com/2026/10/27/anthropic-ipo-meta-spacex-ai-deals",
    "headline": "Anthropic IPO leads AI's $235 billion dealmaking blitz",
    "publisher": "Axios",
    "canonical_url": "https://www.axios.com/2026/10/27/anthropic-ipo-meta-spacex-ai-deals",
    "published_at": "2026-10-27T09:00:04.000Z",
    "excerpt": "Anthropic IPO leads AI's $235 billion dealmaking blitz",
    "source_count": 1,
    "publishers": [
      "Axios"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/27/business/neura-robotics-germany-china-ai.html",
    "headline": "In the A.I. ‘Robogym,’ Machines Train to Be More Like Humans",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/27/business/neura-robotics-germany-china-ai.html",
    "published_at": "2026-10-27T09:02:36.000Z",
    "excerpt": "In the A.I. ‘Robogym,’ Machines Train to Be More Like Humans",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/27/technology/robot-dog-walkers.html",
    "headline": "Wanted: Robot-Dog Walkers. $20/Hour.",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/27/technology/robot-dog-walkers.html",
    "published_at": "2026-10-27T09:03:03.000Z",
    "excerpt": "Wanted: Robot-Dog Walkers. $20/Hour.",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://github.com/pinting/oraculum",
    "headline": "Show HN: SQL incremental semantic parser and enforcer (with WASM playground)",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/pinting/oraculum",
    "published_at": "2026-10-27T09:06:48.000Z",
    "excerpt": "I've been working on this project since last December! It's still at an early stage, so there are many bugs to fix, but it has finally reached a presentable form and I would like some feedback! What do you think? Are there any similar incremental semantic parsers out there? Could incremental",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/okunix/gollama",
    "headline": "Show HN: Ollama client library for Golang with streaming API support",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/okunix/gollama",
    "published_at": "2026-10-27T09:28:35.000Z",
    "excerpt": "Show HN: Ollama client library for Golang with streaming API support",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.36918",
    "headline": "TrawMem: Reframing Agent Memory as Task-Oriented Role-Adaptive Workspaces",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.36918",
    "published_at": "2026-10-27T09:46:15.000Z",
    "excerpt": "Large language model (LLM) agents rely on memory systems to leverage long-term interactions, yet existing systems typically retrieve memories based on their relevance to the current query and use them as contextual evidence. However, relevance alone does not characterize how a memory contributes to",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/kekzl/imp",
    "headline": "Show HN: Imp, an LLM Server for RTX 50 GPUs, Written by Claude Code",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/kekzl/imp",
    "published_at": "2026-10-27T09:50:39.000Z",
    "excerpt": "Show HN: Imp, an LLM Server for RTX 50 GPUs, Written by Claude Code",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://lists.debian.org/debian-devel/2026/10/msg00263.html",
    "headline": "I will no longer upload to NEW",
    "publisher": "Hacker News",
    "canonical_url": "https://lists.debian.org/debian-devel/2026/10/msg00263.html",
    "published_at": "2026-10-27T09:59:05.000Z",
    "excerpt": "I will no longer upload to NEW",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theguardian.com/thefilter/2026/oct/27/currentbody-series-3-review-tested-uk",
    "headline": "CurrentBody Series 3 review: a fully customisable LED mask that helps exactly where you need it",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/thefilter/2026/oct/27/currentbody-series-3-review-tested-uk",
    "published_at": "2026-10-27T10:00:07.000Z",
    "excerpt": "CurrentBody Series 3 review: a fully customisable LED mask that helps exactly where you need it",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/27/gen-z-digital-detox-apps",
    "headline": "‘My social life completely plummeted’: gen Z is fighting back against big tech",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/technology/2026/oct/27/gen-z-digital-detox-apps",
    "published_at": "2026-10-27T10:00:08.000Z",
    "excerpt": "‘My social life completely plummeted’: gen Z is fighting back against big tech",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.theguardian.com/games/2026/oct/27/new-indie-horror-games-halloween",
    "headline": "Eight great new indie horror games for Halloween",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/games/2026/oct/27/new-indie-horror-games-halloween",
    "published_at": "2026-10-27T10:00:09.000Z",
    "excerpt": "Eight great new indie horror games for Halloween",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.theguardian.com/us-news/2026/oct/27/ai-disinformation-social-media-midterm-elections",
    "headline": "AI-driven disinformation running rampant on social media before US midterms, experts warn",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/us-news/2026/oct/27/ai-disinformation-social-media-midterm-elections",
    "published_at": "2026-10-27T10:00:10.000Z",
    "excerpt": "AI-driven disinformation running rampant on social media before US midterms, experts warn",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://open3dlab.com/news/roblox-downloaded-145-gb-of-models-from-our-sites",
    "headline": "Roblox downloaded 145GB models from us (including adult content) without asking",
    "publisher": "Hacker News",
    "canonical_url": "https://open3dlab.com/news/roblox-downloaded-145-gb-of-models-from-our-sites",
    "published_at": "2026-10-27T10:27:50.000Z",
    "excerpt": "Roblox downloaded 145GB models from us (including adult content) without asking",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://hypeseoul.xyz/?s=hn",
    "headline": "Show HN: HypeSeoul – AI-painted isometric map of Seoul that runs on Seoul time",
    "publisher": "Hacker News",
    "canonical_url": "https://hypeseoul.xyz/?s=hn",
    "published_at": "2026-10-27T10:47:54.000Z",
    "excerpt": "Show HN: HypeSeoul – AI-painted isometric map of Seoul that runs on Seoul time",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.prnewswire.com/news-releases/guidewire-signs-definitive-agreement-to-acquire-hyperexponential-302920513.html",
    "headline": "Guidewire → hyperexponential",
    "publisher": "PR Newswire",
    "canonical_url": "https://www.prnewswire.com/news-releases/guidewire-signs-definitive-agreement-to-acquire-hyperexponential-302920513.html",
    "published_at": "2026-10-27T11:00:00.000Z",
    "excerpt": "Guidewire announced today that it entered into a definitive agreement to acquire Hyperexponential Ltd for a base purchase price of $1.7 billion in cash, subject to adjustments, and up to an additional $400 million in contingent consideration.",
    "source_count": 1,
    "publishers": [
      "PR Newswire"
    ]
  },
  {
    "id": "https://news.crunchbase.com/real-estate-property-tech/agentic-ai-staffing-coo-folgmann-get-covered",
    "headline": "Your AI Agents Need A Chief Operating Officer, Too",
    "publisher": "Crunchbase News",
    "canonical_url": "https://news.crunchbase.com/real-estate-property-tech/agentic-ai-staffing-coo-folgmann-get-covered",
    "published_at": "2026-10-27T11:00:44.000Z",
    "excerpt": "Scaling AI agents requires treating them like employees in regulated roles, with written rules, clearly defined responsibilities and a named human manager accountable for their performance. Guest author Rick Folgmann, COO at Get Covered, tells companies they should start with tasks governed by",
    "source_count": 1,
    "publishers": [
      "Crunchbase News"
    ]
  },
  {
    "id": "https://news.crunchbase.com/venture/q3-2026-us-china-robotics-startup-funding-jumps-physical-ai-push",
    "headline": "Crunchbase Data Shows Q3 Robotics Startup Funding Jumps 185% As US And China Lead Physical AI Push",
    "publisher": "Crunchbase News",
    "canonical_url": "https://news.crunchbase.com/venture/q3-2026-us-china-robotics-startup-funding-jumps-physical-ai-push",
    "published_at": "2026-10-27T11:00:53.000Z",
    "excerpt": "Venture funding to robotics startups has soared in 2026, with the bulk of investment going to companies based in China and the U.S., Crunchbase data shows. All told, global venture funding to robotics startups totaled $9.9 billion in Q3, more than double the $4.3 billion invested in Q3 2025, per",
    "source_count": 1,
    "publishers": [
      "Crunchbase News"
    ]
  },
  {
    "id": "https://oioannou.com/blog/ai-promised-less-work",
    "headline": "AI promised less work. I've never worked more",
    "publisher": "Hacker News",
    "canonical_url": "https://oioannou.com/blog/ai-promised-less-work",
    "published_at": "2026-10-27T11:08:14.000Z",
    "excerpt": "AI promised less work. I've never worked more",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://spectrum.ieee.org/wikipedia-wikiproject-ai-writing-cleanup",
    "headline": "Wikipedia's Cleanup of AI-Generated Content",
    "publisher": "Hacker News",
    "canonical_url": "https://spectrum.ieee.org/wikipedia-wikiproject-ai-writing-cleanup",
    "published_at": "2026-10-27T11:08:15.000Z",
    "excerpt": "Wikipedia's Cleanup of AI-Generated Content",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://lwn.net/SubscriberLink/1102102/0c00e4d550f25f8c",
    "headline": "Python's experimental JIT to be removed",
    "publisher": "Hacker News",
    "canonical_url": "https://lwn.net/SubscriberLink/1102102/0c00e4d550f25f8c",
    "published_at": "2026-10-27T11:17:57.000Z",
    "excerpt": "Python's experimental JIT to be removed",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/Algoza-Solutions/spider-protocol",
    "headline": "Show HN: Spider Protocol – The safety tether for vibe coding",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Algoza-Solutions/spider-protocol",
    "published_at": "2026-10-27T11:18:16.000Z",
    "excerpt": "Show HN: Spider Protocol – The safety tether for vibe coding",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.technologyreview.com/2026/10/27/1147142/industrial-intelligence-the-next-growth-opportunity-for-manufacturing",
    "headline": "Industrial Intelligence: The next growth opportunity for manufacturing",
    "publisher": "MIT Technology Review",
    "canonical_url": "https://www.technologyreview.com/2026/10/27/1147142/industrial-intelligence-the-next-growth-opportunity-for-manufacturing",
    "published_at": "2026-10-27T11:19:18.000Z",
    "excerpt": "Every manufacturer has its own industrial intelligence. Some is documented, and some resides in the knowledge of experienced workers. Consider an experienced operator preparing to restart a line after a changeover. The machine settings matter, but so does knowing how a particular material behaves,",
    "source_count": 1,
    "publishers": [
      "MIT Technology Review"
    ]
  },
  {
    "id": "https://www.bitlog.com/2026/10/27/software-may-be-getting-worse-but-it-used-to-be-horrible",
    "headline": "Software may be getting worse, but it used to be horrible",
    "publisher": "Hacker News",
    "canonical_url": "https://www.bitlog.com/2026/10/27/software-may-be-getting-worse-but-it-used-to-be-horrible",
    "published_at": "2026-10-27T11:30:35.000Z",
    "excerpt": "Software may be getting worse, but it used to be horrible",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://catalogaudit.app/",
    "headline": "Show HN: I built a tool to audit Shopify stores for AI agent and Google Shopping",
    "publisher": "Hacker News",
    "canonical_url": "https://catalogaudit.app/",
    "published_at": "2026-10-27T11:41:44.000Z",
    "excerpt": "Show HN: I built a tool to audit Shopify stores for AI agent and Google Shopping",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.37085",
    "headline": "On the Sparsity of Direct Preference Optimization: Weight Disentanglement in the NTK Regime",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.37085",
    "published_at": "2026-10-27T11:48:41.000Z",
    "excerpt": "Direct Preference Optimization (DPO) has been widely adopted for aligning language models with human preferences. Recent empirical work has revealed that DPO induces remarkably sparse parameter updates, yet no theoretical explanation for this phenomenon has been offered. We analyze DPO's",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://statespace.play.naigap.com/",
    "headline": "Show HN: Statespace – learn formal methods by building a tiny checked language",
    "publisher": "Hacker News",
    "canonical_url": "https://statespace.play.naigap.com/",
    "published_at": "2026-10-27T11:49:52.000Z",
    "excerpt": "I had claude build a course optimized for me (backend engineer with some systems experience) to learn formal methods. Main idea being - I want to build a checked application language which finds bugs with z3, prove things in lean, model concurrency&#x2F;dist sys behaviors in TLA+, connect it to",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/AMD?date=2026-10-27&from=2026-10-19&view=series",
    "headline": "AMD weekly closing series",
    "publisher": "Exa Markets",
    "canonical_url": "https://exa.ai/library/markets/stock/AMD?date=2026-10-27&from=2026-10-19&view=series",
    "published_at": "2026-10-27T12:00:00.000Z",
    "excerpt": "US:AMD — raw closing price series. 2026-10-23 USD 516.79. 2026-10-26 USD 531.28. 2026-10-27 USD 560.26.",
    "source_count": 1,
    "publishers": [
      "Exa Markets"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/AMZN?date=2026-10-27&from=2026-10-19&view=series",
    "headline": "AMZN weekly closing series",
    "publisher": "Exa Markets",
    "canonical_url": "https://exa.ai/library/markets/stock/AMZN?date=2026-10-27&from=2026-10-19&view=series",
    "published_at": "2026-10-27T12:00:00.000Z",
    "excerpt": "US:AMZN — raw closing price series. 2026-10-23 USD 248.00. 2026-10-26 USD 249.09. 2026-10-27 USD 253.10.",
    "source_count": 1,
    "publishers": [
      "Exa Markets"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/GOOGL?date=2026-10-27&from=2026-10-19&view=series",
    "headline": "GOOGL weekly closing series",
    "publisher": "Exa Markets",
    "canonical_url": "https://exa.ai/library/markets/stock/GOOGL?date=2026-10-27&from=2026-10-19&view=series",
    "published_at": "2026-10-27T12:00:00.000Z",
    "excerpt": "US:GOOGL — raw closing price series. 2026-10-23 USD 320.21. 2026-10-26 USD 316.80. 2026-10-27 USD 320.58.",
    "source_count": 1,
    "publishers": [
      "Exa Markets"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/META?date=2026-10-27&from=2026-10-19&view=series",
    "headline": "META weekly closing series",
    "publisher": "Exa Markets",
    "canonical_url": "https://exa.ai/library/markets/stock/META?date=2026-10-27&from=2026-10-19&view=series",
    "published_at": "2026-10-27T12:00:00.000Z",
    "excerpt": "US:META — raw closing price series. 2026-10-23 USD 642.62. 2026-10-26 USD 630.56. 2026-10-27 USD 620.19.",
    "source_count": 1,
    "publishers": [
      "Exa Markets"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/MSFT?date=2026-10-27&from=2026-10-19&view=series",
    "headline": "MSFT weekly closing series",
    "publisher": "Exa Markets",
    "canonical_url": "https://exa.ai/library/markets/stock/MSFT?date=2026-10-27&from=2026-10-19&view=series",
    "published_at": "2026-10-27T12:00:00.000Z",
    "excerpt": "US:MSFT — raw closing price series. 2026-10-23 USD 524.51. 2026-10-26 USD 532.60. 2026-10-27 USD 531.33.",
    "source_count": 1,
    "publishers": [
      "Exa Markets"
    ]
  },
  {
    "id": "https://exa.ai/library/markets/stock/TSM?date=2026-10-27&from=2026-10-19&view=series",
    "headline": "TSM weekly closing series",
    "publisher": "Exa Markets",
    "canonical_url": "https://exa.ai/library/markets/stock/TSM?date=2026-10-27&from=2026-10-19&view=series",
    "published_at": "2026-10-27T12:00:00.000Z",
    "excerpt": "US:TSM — raw closing price series. 2026-10-23 USD 418.51. 2026-10-26 USD 424.37. 2026-10-27 USD 436.87.",
    "source_count": 1,
    "publishers": [
      "Exa Markets"
    ]
  },
  {
    "id": "https://www.ft.com/content/336f8f7c-1a39-403d-8c68-dfca5ff1a2bb",
    "headline": "UK considers forcing data centres to invest locally to meet new AI ‘covenant’",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/336f8f7c-1a39-403d-8c68-dfca5ff1a2bb",
    "published_at": "2026-10-27T12:00:08.000Z",
    "excerpt": "UK considers forcing data centres to invest locally to meet new AI ‘covenant’",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.theguardian.com/us-news/ng-interactive/2026/oct/27/silicon-valley-schools-education-tech",
    "headline": "Silicon Valley parents want the tech they help build out of their children’s schools",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/us-news/ng-interactive/2026/oct/27/silicon-valley-schools-education-tech",
    "published_at": "2026-10-27T12:00:38.000Z",
    "excerpt": "Silicon Valley parents want the tech they help build out of their children’s schools",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://heyyeah.github.io/AI_Compute_Footprint",
    "headline": "Show HN: AI Compute Footprint (energy, space, water and CO2)",
    "publisher": "Hacker News",
    "canonical_url": "https://heyyeah.github.io/AI_Compute_Footprint",
    "published_at": "2026-10-27T12:04:10.000Z",
    "excerpt": "I made AI Compute Footprint to get an understanding how big the energy, space, water + CO₂ footprint of data centres running everyday AI tasks is, and how it compares with other everyday activities. I have a feel for how long a query takes when it runs on a local model on my laptop but I wanted to",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/mousEHEHE/flint-gpui",
    "headline": "Show HN: flint - SSH and SFTP client built with GPUI",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/mousEHEHE/flint-gpui",
    "published_at": "2026-10-27T12:05:09.000Z",
    "excerpt": "i was using Termius, but it ate all my ram, lagged, and charged 20 bucks for the team plan. so (being impressed by how fast Zed felt) i tried to make an alternative with GPUI. me and my friends have used it for some time and now i want to show it to other people. i tried to make the design look",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/TimeCopilot/foundationforecast",
    "headline": "Show HN: FoundationForecast: unified API for time series foundation models",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/TimeCopilot/foundationforecast",
    "published_at": "2026-10-27T12:05:28.000Z",
    "excerpt": "It supports forecast, cross-validation, anomaly detection, and exogenous variables for models such as AWS Chronos, Google TimesFM, Mistral Timestral, H2O TimeH2O, Nixtla TimeGPT, etc., under the same API.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/pragyaangaur/Can-It-Run-Minecraft",
    "headline": "Show HN: Minecraft as one C file that runs inside a PDF, a terminal and a Kindle",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/pragyaangaur/Can-It-Run-Minecraft",
    "published_at": "2026-10-27T12:13:35.000Z",
    "excerpt": "This is basically the doomgeneric idea but applied to Minecraft (its first version rd-132211 that came out on 13 May 2009). It's one freestanding C file with no includes and no memory allocation. It runs in a terminal, over telnet as shared multiplayer, as a 20 KB wasm module, inside a PDF on",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.iresolve.io/",
    "headline": "Show HN: iResolve – Private AI rooms for hard talks and 3+ anonymous mode",
    "publisher": "Hacker News",
    "canonical_url": "https://www.iresolve.io/",
    "published_at": "2026-10-27T12:38:05.000Z",
    "excerpt": "Show HN: iResolve – Private AI rooms for hard talks and 3+ anonymous mode",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/splashxmoon/friday",
    "headline": "Show HN: Friday, an open-source harness for coding agents that work as a team",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/splashxmoon/friday",
    "published_at": "2026-10-27T12:40:15.000Z",
    "excerpt": "Show HN: Friday, an open-source harness for coding agents that work as a team",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://actera.dev/try",
    "headline": "Show HN: Change my page if the agent allows it",
    "publisher": "Hacker News",
    "canonical_url": "https://actera.dev/try",
    "published_at": "2026-10-27T12:44:38.000Z",
    "excerpt": "Show HN: Change my page if the agent allows it",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/synectus/OpenGMB",
    "headline": "Show HN: Self-hosted Google Business Profile manager with agent approvals",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/synectus/OpenGMB",
    "published_at": "2026-10-27T12:51:05.000Z",
    "excerpt": "Show HN: Self-hosted Google Business Profile manager with agent approvals",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.37161",
    "headline": "WorkFactory: Turning Professional Intents into Executable Work for Scalable Agent Training",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.37161",
    "published_at": "2026-10-27T12:54:16.000Z",
    "excerpt": "Scaling supervised training for working agents requires diverse professional tasks that yield reliable expert demonstrations. However, missing or inconsistent task information can obstruct teacher execution and weaken the resulting supervision. We propose WorkFactory, a scalable framework for",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/agbossjs/agboss",
    "headline": "Show HN: AGBoss Dependency injection and static validation for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/agbossjs/agboss",
    "published_at": "2026-10-27T12:56:45.000Z",
    "excerpt": "Show HN: AGBoss Dependency injection and static validation for AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/cordane/cordane",
    "headline": "Show HN: Cordane – run coding agents on machines you own, no open ports",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/cordane/cordane",
    "published_at": "2026-10-27T12:56:46.000Z",
    "excerpt": "Show HN: Cordane – run coding agents on machines you own, no open ports",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://zydra.sh/",
    "headline": "Show HN: ssh zydra.sh, a GPU Linux desktop in your terminal, with Doom",
    "publisher": "Hacker News",
    "canonical_url": "https://zydra.sh/",
    "published_at": "2026-10-27T12:57:20.000Z",
    "excerpt": "ssh zydra.sh There's no sign-up or anything, and you get a 15-minute demo of a graphical Linux VM drawn entirely in your terminal. It has a browser, an editor, and it runs Doom. It works best in Kitty or Ghostty. WezTerm and Konsole also work, as well as Sixel and iTerm2 terminals, though with less",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/pezhik/skilltotal",
    "headline": "Show HN: SkillTotal – scan packages before Claude Code installs them",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/pezhik/skilltotal",
    "published_at": "2026-10-27T12:58:20.000Z",
    "excerpt": "Show HN: SkillTotal – scan packages before Claude Code installs them",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/opera-introduces-a-new-web-standard-to-let-users-deploy-ai-locally-in-their-browser",
    "headline": "Opera introduces a new web standard to let users deploy AI locally in their browser",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/opera-introduces-a-new-web-standard-to-let-users-deploy-ai-locally-in-their-browser",
    "published_at": "2026-10-27T13:00:00.000Z",
    "excerpt": "The new standard, WebAI, is designed to work with a variety of AI models.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://github.com/0xArx/hashling",
    "headline": "Show HN: Hashling, an open-source Mac security agent your own AI can talk to",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/0xArx/hashling",
    "published_at": "2026-10-27T13:00:47.000Z",
    "excerpt": "Show HN: Hashling, an open-source Mac security agent your own AI can talk to",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.apple.com/newsroom/2026/10/apple-introduces-the-new-14-inch-macbook-pro-with-m6",
    "headline": "Apple introduces the new 14-inch MacBook Pro with M6",
    "publisher": "Hacker News",
    "canonical_url": "https://www.apple.com/newsroom/2026/10/apple-introduces-the-new-14-inch-macbook-pro-with-m6",
    "published_at": "2026-10-27T13:01:07.000Z",
    "excerpt": "Apple introduces the new 14-inch MacBook Pro with M6",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theguardian.com/film/2026/oct/27/elon-musk-ai-odyssey-movie-grok-christopher-nolan",
    "headline": "Elon Musk’s AI Odyssey review – the dullest, most pointless riposte possible to Christopher Nolan’s brilliant epic",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/film/2026/oct/27/elon-musk-ai-odyssey-movie-grok-christopher-nolan",
    "published_at": "2026-10-27T13:01:46.000Z",
    "excerpt": "It is hardly a shock that Grok AI’s interpretation of Homer is as meaningless as a laptop screensaver. The only surprise would be if Musk accepted defeat graciously. Which he won’t Think back. Do you remember when Elon Musk, in a weird online tantrum, and without having seen the film, condemned the",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.apple.com/imac",
    "headline": "New iMac with M6",
    "publisher": "Hacker News",
    "canonical_url": "https://www.apple.com/imac",
    "published_at": "2026-10-27T13:02:02.000Z",
    "excerpt": "New iMac with M6",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://citewing.com/",
    "headline": "Show HN: CiteWing – AI backlink outreach agent",
    "publisher": "Hacker News",
    "canonical_url": "https://citewing.com/",
    "published_at": "2026-10-27T13:03:53.000Z",
    "excerpt": "Show HN: CiteWing – AI backlink outreach agent",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.businesswire.com/news/home/20261027228454/en/Innovation-X-Co-Leads-Tenstorrents-%241.5-Billion-Series-E-at-a-%246.2-Billion-Valuation",
    "headline": "Tenstorrent raised $1.5B Series E",
    "publisher": "Business Wire",
    "canonical_url": "https://www.businesswire.com/news/home/20261027228454/en/Innovation-X-Co-Leads-Tenstorrents-%241.5-Billion-Series-E-at-a-%246.2-Billion-Valuation",
    "published_at": "2026-10-27T13:07:00.000Z",
    "excerpt": "Innovation X, a late-stage venture capital firm investing in privately held technology leaders, today announced that it co-led Tenstorrent's $1.5 billion Series E financing at a $6.2 billion post-money valuation.",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://getkavel.com/ai-crawlers",
    "headline": "Show HN: Which big sites block AI training crawlers but let AI search in",
    "publisher": "Hacker News",
    "canonical_url": "https://getkavel.com/ai-crawlers",
    "published_at": "2026-10-27T13:18:22.000Z",
    "excerpt": "Show HN: Which big sites block AI training crawlers but let AI search in",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.withnative.ai/research-and-posts/markdown-context-benchmark",
    "headline": "Show HN: Markdown is 40× more token-efficient with SQLite",
    "publisher": "Hacker News",
    "canonical_url": "https://www.withnative.ai/research-and-posts/markdown-context-benchmark",
    "published_at": "2026-10-27T13:23:49.000Z",
    "excerpt": "Hi HN, I'm Richard, founder of Native. I'm working on open-source context ownership, to stop AI centralisation: https:&#x2F;&#x2F;github.com&#x2F;withnative&#x2F;native My first focus has been making Markdown vaults powerful enough so that teams can self-host all of their context (messaging, docs",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://valen-team.github.io/",
    "headline": "Show HN: Valen – Open multimodal decision models for text, images and video",
    "publisher": "Hacker News",
    "canonical_url": "https://valen-team.github.io/",
    "published_at": "2026-10-27T13:30:15.000Z",
    "excerpt": "Show HN: Valen – Open multimodal decision models for text, images and video",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/japan-internet-giant-gmo-says-hackers-posted-stolen-customer-data",
    "headline": "Japan internet giant GMO says hackers posted stolen customer data",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/japan-internet-giant-gmo-says-hackers-posted-stolen-customer-data",
    "published_at": "2026-10-27T13:32:57.000Z",
    "excerpt": "Japan's GMO Internet is verifying alleged customer data posted by suspected hackers following a cloud service breach.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.37224",
    "headline": "Spine: Compiling Subtask Trees into Structured Context for Long-Horizon Coding Agents",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.37224",
    "published_at": "2026-10-27T13:33:23.000Z",
    "excerpt": "Long-horizon coding tasks contain nested subtasks. Typically, agents record interactions sequentially into a growing history, causing context inflation and performance degradation. Compressing or trimming the history without explicit subtask boundaries can discard information needed by unfinished",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://mcptask.online/live?language=en",
    "headline": "Show HN: Give our AI coding runner a real task and watch it until merge",
    "publisher": "Hacker News",
    "canonical_url": "https://mcptask.online/live?language=en",
    "published_at": "2026-10-27T13:37:38.000Z",
    "excerpt": "Show HN: Give our AI coding runner a real task and watch it until merge",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/vishwakulkarni/PoseForge",
    "headline": "Show HN: PoseForge – Local-first AI studio for images and video (Codex, ComfyUI)",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/vishwakulkarni/PoseForge",
    "published_at": "2026-10-27T13:40:28.000Z",
    "excerpt": "Show HN: PoseForge – Local-first AI studio for images and video (Codex, ComfyUI)",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training",
    "headline": "Giving chat feedback gives Anthropic your data",
    "publisher": "Hacker News",
    "canonical_url": "https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training",
    "published_at": "2026-10-27T13:56:15.000Z",
    "excerpt": "Giving chat feedback gives Anthropic your data",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/Ezed9/mcp-bouncer",
    "headline": "Show HN: Bouncer, an MCP proxy that denies sends to addresses the agent read",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Ezed9/mcp-bouncer",
    "published_at": "2026-10-27T14:00:52.000Z",
    "excerpt": "Show HN: Bouncer, an MCP proxy that denies sends to addresses the agent read",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.ft.com/content/01467514-66c1-4375-9906-45a47b949270",
    "headline": "GM to switch listing from NYSE to Nasdaq as it accelerates AI push",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/01467514-66c1-4375-9906-45a47b949270",
    "published_at": "2026-10-27T14:02:17.000Z",
    "excerpt": "GM to switch listing from NYSE to Nasdaq as it accelerates AI push",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/27/technology/proposition-40-california-billionaire-tax.html",
    "headline": "How Billionaires Are Fighting the Prop 40 California Wealth Tax",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/27/technology/proposition-40-california-billioniare-tax.html",
    "published_at": "2026-10-27T14:05:55.000Z",
    "excerpt": "How Billionaires Are Fighting the Prop 40 California Wealth Tax",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://www.wired.com/story/the-us-government-is-hiding-a-secret-court-ruling-about-how-it-spies-on-americans",
    "headline": "US Government is hiding a secret court ruling about how it spies on Americans",
    "publisher": "Hacker News",
    "canonical_url": "https://www.wired.com/story/the-us-government-is-hiding-a-secret-court-ruling-about-how-it-spies-on-americans",
    "published_at": "2026-10-27T14:06:42.000Z",
    "excerpt": "US Government is hiding a secret court ruling about how it spies on Americans",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/ultramancode/spring-ai-privacy-guardrails",
    "headline": "Show HN: Spring AI Privacy Guardrails – PII, tool permissions, content checks",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/ultramancode/spring-ai-privacy-guardrails",
    "published_at": "2026-10-27T14:08:30.000Z",
    "excerpt": "Show HN: Spring AI Privacy Guardrails – PII, tool permissions, content checks",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theguardian.com/technology/2026/oct/27/reviewers-slate-musk-ai-grok-odyssey-film-nolan",
    "headline": "‘Meaningless as a laptop screensaver’: reviewers slate Musk’s AI-made Odyssey film",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/technology/2026/oct/27/reviewers-slate-musk-ai-grok-odyssey-film-nolan",
    "published_at": "2026-10-27T14:08:41.000Z",
    "excerpt": "‘Meaningless as a laptop screensaver’: reviewers slate Musk’s AI-made Odyssey film",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://github.com/Hardalion/agent-delegated-authority",
    "headline": "Show HN: ADAP – An open protocol for AI Agent delegated authority",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Hardalion/agent-delegated-authority",
    "published_at": "2026-10-27T14:14:47.000Z",
    "excerpt": "Show HN: ADAP – An open protocol for AI Agent delegated authority",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://aexol.ai/benchmarks/localllama",
    "headline": "Show HN: I made /localllama Reddit benchmark using AI ofc",
    "publisher": "Hacker News",
    "canonical_url": "https://aexol.ai/benchmarks/localllama",
    "published_at": "2026-10-27T14:26:02.000Z",
    "excerpt": "This way i discovered how Qwen 3.8 and flash next are doing great with code",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/utsav1033/carmen",
    "headline": "Show HN: Carmen – harness for reliable AI-written Metal kernels",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/utsav1033/carmen",
    "published_at": "2026-10-27T14:30:45.000Z",
    "excerpt": "Show HN: Carmen – harness for reliable AI-written Metal kernels",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://everygenai.app/",
    "headline": "Show HN: EveryGen AI – AI images, short videos and copy rewrites in one tab",
    "publisher": "Hacker News",
    "canonical_url": "https://everygenai.app/",
    "published_at": "2026-10-27T14:47:19.000Z",
    "excerpt": "Show HN: EveryGen AI – AI images, short videos and copy rewrites in one tab",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://step-review.dev/",
    "headline": "Show HN: A little tool to review and understand PRs more easily",
    "publisher": "Hacker News",
    "canonical_url": "https://step-review.dev/",
    "published_at": "2026-10-27T14:49:52.000Z",
    "excerpt": "I use AI to write software, but I'm not yet ready to \"let go\" of understanding the code, so I made this tool which helps me focus my attention on the things that matter in a PR.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://unfolded-gpt2.vercel.app/",
    "headline": "Show HN: Watch GPT-2 compute your sentence, one matrix at a time, in 3D",
    "publisher": "Hacker News",
    "canonical_url": "https://unfolded-gpt2.vercel.app/",
    "published_at": "2026-10-27T14:50:36.000Z",
    "excerpt": "Show HN: Watch GPT-2 compute your sentence, one matrix at a time, in 3D",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/meta-ai-director-rohit-patel-leaves-to-take-on-microsoft-office-and-google-workspace",
    "headline": "Meta AI director Rohit Patel leaves to take on Microsoft Office and Google Workspace",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/meta-ai-director-rohit-patel-leaves-to-take-on-microsoft-office-and-google-workspace",
    "published_at": "2026-10-27T14:59:09.000Z",
    "excerpt": "Rohit Patel is departing Meta after eight years working on AI evaluations and reinforcement learning, TechCrunch has exclusively learned. His startup, Ndoc, aims to take on Microsoft Office Suite.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://www.theguardian.com/commentisfree/2026/oct/27/elon-musk-cyber-psychosis-ai-tech",
    "headline": "Elon Musk says he has ‘cyber psychosis’. Do you too? | Arwa Mahdawi",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/commentisfree/2026/oct/27/elon-musk-cyber-psychosis-ai-tech",
    "published_at": "2026-10-27T15:01:14.000Z",
    "excerpt": "Whether using chatbots for childcare or taking up smoking, a new affliction is sweeping through the tech world. Here are the signs In the least surprising news you’ll hear all week, Elon Musk has said he’s not entirely right in the head. “I’ve got a little bit of cyber psychosis,” the world’s",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.37369",
    "headline": "Uncovering Why LLMs Fail: From Internal Mechanisms to Adversarial Reasoning Trajectories",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.37369",
    "published_at": "2026-10-27T15:02:04.000Z",
    "excerpt": "Large language models (LLMs) are usually evaluated by final-output correctness or safety, yet an endpoint label does not reveal how a failure develops throughout the reasoning process. We therefore ask whether ordinary reasoning failures and adversarially induced failures can be characterized using",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://microsoft.ai/news/mai-image-2-7-debut",
    "headline": "MAI Image 2.7",
    "publisher": "Microsoft AI",
    "canonical_url": "https://microsoft.ai/news/mai-image-2-7-debut",
    "published_at": "2026-10-27T15:10:00.000Z",
    "excerpt": "MAI Image 2.7, our latest image editing model, launches with even stronger control for edits that are hardest to get right. It launches in preview at No. 3 on Arena Edit, making Microsoft AI the No. 2 lab, and No. 2 on Artificial Analysis's image editing leaderboard.",
    "source_count": 1,
    "publishers": [
      "Microsoft AI"
    ]
  },
  {
    "id": "https://spec-first.dev/",
    "headline": "Show HN: Specification First Agentic Development Plugin and Prove",
    "publisher": "Hacker News",
    "canonical_url": "https://spec-first.dev/",
    "published_at": "2026-10-27T15:12:20.000Z",
    "excerpt": "Implemented agent smith since start 2026 with over 1000 specifications which lead to about 500k lines of code. The procedure with that spec-first works well. How do you do it?",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theguardian.com/global/2026/oct/26/anthropic-accelerates-ai",
    "headline": "Anthropic accelerates – for the rest of us, the speed of growth spells precarity",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/global/2026/oct/26/anthropic-accelerates-ai",
    "published_at": "2026-10-27T15:15:20.000Z",
    "excerpt": "Anthropic accelerates – for the rest of us, the speed of growth spells precarity",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.ft.com/content/c1a57bb1-4db0-406c-ae55-a55f5aa928d8",
    "headline": "How good is the iPhone Duo?",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/c1a57bb1-4db0-406c-ae55-a55f5aa928d8",
    "published_at": "2026-10-27T15:28:45.000Z",
    "excerpt": "How good is the iPhone Duo?",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://sectr.dev/",
    "headline": "Show HN: Sectr – Serverless backend platform for easy deployment of AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://sectr.dev/",
    "published_at": "2026-10-27T15:40:07.000Z",
    "excerpt": "Hey HN, I've been building Sectr, a backend-as-a-service for making it easy(ier) to develop and deploy AI agents. Deploying agents requires non-trivial systems design work. Consider a support agent: how do you stream messages to your frontend, how&#x2F;where do you persist messages for frontend",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://chemicalx.xophz.com/",
    "headline": "Show HN: ChemX – Architectural AST linter for LLM context bloat, AI slop",
    "publisher": "Hacker News",
    "canonical_url": "https://chemicalx.xophz.com/",
    "published_at": "2026-10-27T15:43:04.000Z",
    "excerpt": "Show HN: ChemX – Architectural AST linter for LLM context bloat, AI slop",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://slopit.io/",
    "headline": "Show HN: SlopIt – A blog your coding agent runs",
    "publisher": "Hacker News",
    "canonical_url": "https://slopit.io/",
    "published_at": "2026-10-27T15:48:11.000Z",
    "excerpt": "Hi HN! This is something I built out of my own need. I’m doing several projects on the side, and many of them need a CMS quickly (automated by my agents), and I thought there’s space for a very minimal thing that’s more agent-native instead of setting up the heavy blogging platforms. A few things",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://play.endothermic.ai/",
    "headline": "Show HN: Cryo – A language whose programs live forever",
    "publisher": "Hacker News",
    "canonical_url": "https://play.endothermic.ai/",
    "published_at": "2026-10-27T15:48:59.000Z",
    "excerpt": "Cryo is a programming language that models long-running tasks like workflows or AI agents. Programs freeze to disk when idle and can be thawed when new data arrives. As part of our announcement of Endothermic Labs, we've put together a small demo of Cryo that highlights its features and walks",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.37442",
    "headline": "CRISP: Co-designing Pruning and Scheduling for Efficient MoE Inference on Edge Servers",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.37442",
    "published_at": "2026-10-27T15:51:14.000Z",
    "excerpt": "Mixture-of-Experts (MoE) inference on memory-constrained edge platforms is often dominated by expert-weight movement rather than computation. Although each token activates only a small subset of experts, routing is input-dependent, so all experts must remain accessible and memory movement dominates",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://huggingface.co/datasets/taktekhq/lebanese-legislation",
    "headline": "Show HN: Open Dataset of the Lebanese Law",
    "publisher": "Hacker News",
    "canonical_url": "https://huggingface.co/datasets/taktekhq/lebanese-legislation",
    "published_at": "2026-10-27T15:52:25.000Z",
    "excerpt": "Hey folks! I made it easier for builders to use the lebanese legislation through: a public DB, API, and MCP. The Lebanese University has an archive of all laws dating back to 1904 (legallaw.ul.edu.lb). People and AI can barely find it and navigate it. It also had outdated articles. Now, more people",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://nicchia-code.github.io/trama",
    "headline": "Show HN: Trama, Meta Vibe Coding Agent 0.1.1 Released",
    "publisher": "Hacker News",
    "canonical_url": "https://nicchia-code.github.io/trama",
    "published_at": "2026-10-27T15:56:02.000Z",
    "excerpt": "Show HN: Trama, Meta Vibe Coding Agent 0.1.1 Released",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arstechnica.com/google/2026/10/deepminds-genie-4-world-model-adds-audio-and-more-realistic-people-to-simulations",
    "headline": "DeepMind unveils Genie 4 world model promising more realistic physics and humans",
    "publisher": "Ars Technica",
    "canonical_url": "https://arstechnica.com/google/2026/10/deepminds-genie-4-world-model-adds-audio-and-more-realistic-people-to-simulations",
    "published_at": "2026-10-27T16:00:22.000Z",
    "excerpt": "Genie 4 will roll out to developers and Google AI Ultra subscribers soon.",
    "source_count": 1,
    "publishers": [
      "Ars Technica"
    ]
  },
  {
    "id": "https://formstep.io/",
    "headline": "Show HN: Formstep, Request information from customers without the back-and-forth",
    "publisher": "Hacker News",
    "canonical_url": "https://formstep.io/",
    "published_at": "2026-10-27T16:03:31.000Z",
    "excerpt": "I built Formstep: https:&#x2F;&#x2F;formstep.io The idea came from a problem I kept running into while working on loan applications. A workflow could automate a large part of the process, but eventually it would need something only the customer could provide: a document, a correction, a signature,",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://ailately.com/rn/2026-10-27-12",
    "headline": "GPT-6.1 Terra",
    "publisher": "AI Lately",
    "canonical_url": "https://ailately.com/rn/2026-10-27-12",
    "published_at": "2026-10-27T16:07:00.000Z",
    "excerpt": "OpenAI launched a new AI model today. It is called GPT-6.1 Terra. OpenAI says Terra costs half as much as its last computer-use model and its bigger sibling, Sol. The price now sits at one dollar per million input tokens.",
    "source_count": 1,
    "publishers": [
      "AI Lately"
    ]
  },
  {
    "id": "https://github.com/IdoGol24/weir",
    "headline": "Show HN: Keep your credentials out of the AI agents you use and build",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/IdoGol24/weir",
    "published_at": "2026-10-27T16:07:29.000Z",
    "excerpt": "Security should be free! I was getting mad that all the security tools that meant to guard your agents are not local and those who are, just cost a fortune. So I’ve built Weir. You can watch you sensitive data flow, your traces and your egress tools calls. It doesn’t stop your ADLC, it only watch",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arxiv.org/abs/2610.37481",
    "headline": "Follow the Gradient: Tracing Safety Degradation Back to Training Data",
    "publisher": "arXiv",
    "canonical_url": "https://arxiv.org/abs/2610.37481",
    "published_at": "2026-10-27T16:08:08.000Z",
    "excerpt": "Fine-tuning Large Language Models (LLMs) on instruction data can quietly erode their safety, even when no training example looks harmful. Because this safety-degrading data looks benign, standard content filters struggle to catch it. We tackle this problem by developing SimpleLoRIF, a scalable",
    "source_count": 1,
    "publishers": [
      "arXiv"
    ]
  },
  {
    "id": "https://github.com/wrg32786/aigent-os",
    "headline": "Show HN: Aigent-OS, a Claude Code harness that clears and resumes",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/wrg32786/aigent-os",
    "published_at": "2026-10-27T16:10:01.000Z",
    "excerpt": "I run my business on four Claude Code agents: Titus, Pheme, Davinci and Metis. They write my newsletter, The AIgent (about 9k subscribers), every day through a drafting and proofreading engine that Pheme checks before scheduling. They also build AI courses, run a pipeline that turns the day's",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://crulon.ai/",
    "headline": "Show HN: Crulon – Business phone where AI does the work, humans make the calls",
    "publisher": "Hacker News",
    "canonical_url": "https://crulon.ai/",
    "published_at": "2026-10-27T16:10:26.000Z",
    "excerpt": "Hi HN, I’m Rayhan. Crulon is a business phone system where an AI agent answers the line and your team works alongside it. You can talk with our demo agent right in your browser, no sign-up: https:&#x2F;&#x2F;crulon.ai&#x2F;#talk Why I built it: I’ve spent eight years as a software and network",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1019551/firefox-smart-window-ai-fill-forms",
    "headline": "Firefox’s Smart Window adds AI form filling and webpage monitoring",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/ai-artificial-intelligence/1019551/firefox-smart-window-ai-fill-forms",
    "published_at": "2026-10-27T16:14:18.000Z",
    "excerpt": "Mozilla is updating Smart Window - Firefox's AI-powered browsing experience - with a new feature that can help you fill out online forms based on your open tabs. As an example, Mozilla says Smart Window can pull information from your online portfolio or LinkedIn page to paste your work history into",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://freightfloor.com/",
    "headline": "Show HN: Freightfloor. Have 3 minutes? Drive a forklift vs. AI",
    "publisher": "Hacker News",
    "canonical_url": "https://freightfloor.com/",
    "published_at": "2026-10-27T16:18:00.000Z",
    "excerpt": "Have 3 minutes? Drive a forklift, and compete for the high score (and see how AI can work with regular programming).",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/27/business/general-motors-nasdaq-nyse.html",
    "headline": "GM Is Leaving NYSE for the Nasdaq After More Than 100 Years",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/27/business/general-motors-nasdaq-nyse.html",
    "published_at": "2026-10-27T16:25:41.000Z",
    "excerpt": "GM Is Leaving NYSE for the Nasdaq After More Than 100 Years",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/googles-genie-4-world-model-adds-audio-more-realistic-worlds-and-real-time-steering",
    "headline": "Google’s Genie 4 world model adds audio, more realistic worlds, and real-time steering",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/googles-genie-4-world-model-adds-audio-more-realistic-worlds-and-real-time-steering",
    "published_at": "2026-10-27T16:30:57.000Z",
    "excerpt": "Genie 4 can maintain a consistent scene for up to two minutes, double Genie 3's limit, and offers better physics and more humanlike characters.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://github.com/groverburger/instance",
    "headline": "Show HN: Instance – A clean-room reimplementation of GameMaker 8.1 in Rust",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/groverburger/instance",
    "published_at": "2026-10-27T16:38:47.000Z",
    "excerpt": "I used GameMaker 8.1 a ton in late elementary and middle school, and GML was the first programming language I wrote. I still think it's a fun engine to use because it has so many batteries included. So I built an open-source reimplementation of it in Rust which I'm calling Instance. It opens",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://gizmodo.com/police-are-using-ai-to-pull-over-drivers-for-suspicious-behavior-2000831220",
    "headline": "Police are using AI to pull over drivers for 'suspicious' behavior",
    "publisher": "Hacker News",
    "canonical_url": "https://gizmodo.com/police-are-using-ai-to-pull-over-drivers-for-suspicious-behavior-2000831220",
    "published_at": "2026-10-27T16:40:15.000Z",
    "excerpt": "Police are using AI to pull over drivers for 'suspicious' behavior",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://playplanet.dev/",
    "headline": "Show HN: I built a Lovable Alternative that runs in the browser",
    "publisher": "Hacker News",
    "canonical_url": "https://playplanet.dev/",
    "published_at": "2026-10-27T16:47:20.000Z",
    "excerpt": "Hey HN, we built playplanet.dev, a Lovable alternative that lets you build and run full stack apps entirely in the browser, no server needed. We run it on a Linux like system compiled to WebAssembly and then use a runtime on top of it. Currently we support frameworks like Astro, React, Angular, Vue",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://ghostty.org/docs/install/release-notes/1-4-0",
    "headline": "Ghostty 1.4",
    "publisher": "Hacker News",
    "canonical_url": "https://ghostty.org/docs/install/release-notes/1-4-0",
    "published_at": "2026-10-27T16:51:22.000Z",
    "excerpt": "Ghostty 1.4",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1019470/anthropic-ipo-resist-investor-pressure-cut-corners-safety",
    "headline": "Anthropic’s elaborate plan to keep Wall Street at bay",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/ai-artificial-intelligence/1019470/anthropic-ipo-resist-investor-pressure-cut-corners-safety",
    "published_at": "2026-10-27T16:51:22.000Z",
    "excerpt": "Anthropic wants to have it both ways. With its impending IPO, it wants to tap the vast riches of the public markets and insists it doesn't want to compromise its core mission of developing AI safely and for the benefit of humanity. But greater model capabilities bring greater risks, and",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://www.ft.com/content/0b7db9a1-8279-4025-8c2a-44a1010828f4",
    "headline": "Anthropic, Meta and the K-shaped company",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/0b7db9a1-8279-4025-8c2a-44a1010828f4",
    "published_at": "2026-10-27T17:02:25.000Z",
    "excerpt": "Anthropic, Meta and the K-shaped company",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/0b0ae366-c1e0-4c35-8cad-c924a23d33e7",
    "headline": "The limits of hedging the AI boom",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/0b0ae366-c1e0-4c35-8cad-c924a23d33e7",
    "published_at": "2026-10-27T17:07:56.000Z",
    "excerpt": "The limits of hedging the AI boom",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/frontier-ai-labs-say-their-models-refuted-the-exponential-time-hypothesis-what-does-that-mean",
    "headline": "Frontier AI labs say their models refuted the Exponential Time Hypothesis. What does that mean?",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/frontier-ai-labs-say-their-models-refuted-the-exponential-time-hypothesis-what-does-that-mean",
    "published_at": "2026-10-27T17:08:08.000Z",
    "excerpt": "TechCrunch spoke to the MIT computer scientist charged with explaining OpenAI's latest mind-bending discovery.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://agenticbench.org/",
    "headline": "Show HN: AgenticBench, 9 security tests run on 25 AI coding agents",
    "publisher": "Hacker News",
    "canonical_url": "https://agenticbench.org/",
    "published_at": "2026-10-27T17:08:18.000Z",
    "excerpt": "Show HN: AgenticBench, 9 security tests run on 25 AI coding agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/saranyan/agent-relay",
    "headline": "Show HN: Agent-relay for multi-vendor coding sessions",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/saranyan/agent-relay",
    "published_at": "2026-10-27T17:14:54.000Z",
    "excerpt": "Show HN: Agent-relay for multi-vendor coding sessions",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://search2o.com/",
    "headline": "Show HN: Search2o Simplifies AI Agents",
    "publisher": "Hacker News",
    "canonical_url": "https://search2o.com/",
    "published_at": "2026-10-27T17:18:03.000Z",
    "excerpt": "Show HN: Search2o Simplifies AI Agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1017064/visionquest-marvel-rogue-ai",
    "headline": "VisionQuest is what happens when AI really goes rogue",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/ai-artificial-intelligence/1017064/visionquest-marvel-rogue-ai",
    "published_at": "2026-10-27T17:30:00.000Z",
    "excerpt": "In Marvel's VisionQuest, a superpowered robot tries to better understand humanity by getting lost in elaborate, digital daydreams in which he and other artificial intelligence-powered beings live together in a home. The series is deeply fantastical, yet it plays with some of the ideas that have",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://github.com/sanmak/specops",
    "headline": "Show HN: Make your AI agent think before it codes",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/sanmak/specops",
    "published_at": "2026-10-27T17:41:07.000Z",
    "excerpt": "Show HN: Make your AI agent think before it codes",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://myownlore.com/",
    "headline": "Show HN: I built My Own Lore, an MCP game for role-playing in shared worlds",
    "publisher": "Hacker News",
    "canonical_url": "https://myownlore.com/",
    "published_at": "2026-10-27T17:48:35.000Z",
    "excerpt": "Show HN: I built My Own Lore, an MCP game for role-playing in shared worlds",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/wenlan-app/wenlan",
    "headline": "Show HN: Wenlan – your LLM wiki that flags what it can't back up",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/wenlan-app/wenlan",
    "published_at": "2026-10-27T17:50:33.000Z",
    "excerpt": "Show HN: Wenlan – your LLM wiki that flags what it can't back up",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://espresso.ai/nitro",
    "headline": "Show HN: 10x faster, 3x cheaper ETL",
    "publisher": "Hacker News",
    "canonical_url": "https://espresso.ai/nitro",
    "published_at": "2026-10-27T17:52:01.000Z",
    "excerpt": "For the past few months our team has been working on an agentic framework that takes large, expensive SQL workloads and compiles them to Rust, backed by a formal proof of correctness. This is the sort of work I used to do by hand as a systems performance engineer, but now it happens in hours",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://thegit.ai/docs/core-features/browser-control",
    "headline": "Show HN: Control the browser directly from TheGitAI Terminal",
    "publisher": "Hacker News",
    "canonical_url": "https://thegit.ai/docs/core-features/browser-control",
    "published_at": "2026-10-27T17:52:52.000Z",
    "excerpt": "I am the owner and founder of TheGitAI Coding Agent. I built this Chrome extension to let the agent control your existing browser directly from the terminal without interrupting the workflow. It doesn't require your login details or any secrets. You can control your browser now through agent",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.ft.com/content/324875fb-8631-4339-8516-6057de9ac085",
    "headline": "Apple hit by ‘Crackgate’ outcry over iPhone Duo screen problems",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/324875fb-8631-4339-8516-6057de9ac085",
    "published_at": "2026-10-27T17:55:41.000Z",
    "excerpt": "Apple hit by ‘Crackgate’ outcry over iPhone Duo screen problems",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://skillscout.si/",
    "headline": "Show HN: SkillScout, ranking AI tools by how you work instead of popularity",
    "publisher": "Hacker News",
    "canonical_url": "https://skillscout.si/",
    "published_at": "2026-10-27T17:58:32.000Z",
    "excerpt": "Show HN: SkillScout, ranking AI tools by how you work instead of popularity",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.llmverifications.com/",
    "headline": "Show HN: I found a more accurate upcoming LLM Benchmarks leaderboard",
    "publisher": "Hacker News",
    "canonical_url": "https://www.llmverifications.com/",
    "published_at": "2026-10-27T18:25:14.000Z",
    "excerpt": "Show HN: I found a more accurate upcoming LLM Benchmarks leaderboard",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://flightdeck-hq.com/",
    "headline": "Show HN: I built flightdeck – Observability and control plane for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://flightdeck-hq.com/",
    "published_at": "2026-10-27T18:34:12.000Z",
    "excerpt": "Show HN: I built flightdeck – Observability and control plane for AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/disruptive-raises-10b-fund-to-make-big-bets-on-at-least-10-companies",
    "headline": "Disruptive raises $10B fund to make big bets on at least 10 companies",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/disruptive-raises-10b-fund-to-make-big-bets-on-at-least-10-companies",
    "published_at": "2026-10-27T18:55:35.000Z",
    "excerpt": "Disruptive has made headlines in recent years for pouring money into companies like chip startup Groq and the AI voice-generation startup ElevenLabs.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://www.anthropic.com/research/agents-judgment-calls",
    "headline": "Agents Judgment Calls",
    "publisher": "Anthropic",
    "canonical_url": "https://www.anthropic.com/research/agents-judgment-calls",
    "published_at": "2026-10-27T19:17:23.000Z",
    "excerpt": "Agents Judgment Calls",
    "source_count": 1,
    "publishers": [
      "Anthropic"
    ]
  },
  {
    "id": "https://creati.ai/ai-news/2026-10-27/meta-releases-muse-spark-open-an-816b-parameter-open-weight-model-for-multimodal-coding-agents",
    "headline": "Muse Spark Open",
    "publisher": "Creati AI",
    "canonical_url": "https://creati.ai/ai-news/2026-10-27/meta-releases-muse-spark-open-an-816b-parameter-open-weight-model-for-multimodal-coding-agents",
    "published_at": "2026-10-27T19:20:54.000Z",
    "excerpt": "Meta has published Muse Spark Open, an open-weight multimodal model designed for long-running coding agents. The mixture-of-experts system combines text, images, audio, and video with approximately 816 billion total parameters, 42 billion active for each token.",
    "source_count": 1,
    "publishers": [
      "Creati AI"
    ]
  },
  {
    "id": "https://autosomal.ai/",
    "headline": "Show HN: Autosomal.ai Free AI-Based Age, Gender, and Ethnicity Guesser",
    "publisher": "Hacker News",
    "canonical_url": "https://autosomal.ai/",
    "published_at": "2026-10-27T19:32:36.000Z",
    "excerpt": "The age and gender prediction are based on open models. The ethnicity guesser is a private model I have been developing. Accuracy is continuously being fine-tuned. Please submit feedback on the site when a model predicts incorrectly so we can improve the model.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.ft.com/content/dcfaf62f-497d-4db0-bb2d-a55e0b749750",
    "headline": "Elite consulting firms raise starting salaries for first time since 2022",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/dcfaf62f-497d-4db0-bb2d-a55e0b749750",
    "published_at": "2026-10-27T19:33:01.000Z",
    "excerpt": "Elite consulting firms raise starting salaries for first time since 2022",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://venturebeat.com/technology/liquid-ais-new-lfm3-models-put-browser-agents-voice-commands-and-image-recognition-onto-enterprise-controlled-devices",
    "headline": "Liquid AI LFM3",
    "publisher": "VentureBeat",
    "canonical_url": "https://venturebeat.com/technology/liquid-ais-new-lfm3-models-put-browser-agents-voice-commands-and-image-recognition-onto-enterprise-controlled-devices",
    "published_at": "2026-10-27T19:37:51.000Z",
    "excerpt": "Liquid AI is introducing LFM3, a family of compact AI models designed to move more enterprise work onto company-controlled hardware. The October 27 release includes six models spanning language, vision, speech and structured decisions.",
    "source_count": 1,
    "publishers": [
      "VentureBeat"
    ]
  },
  {
    "id": "https://slidepilot.dev/",
    "headline": "Show HN: Let your coding agent recreate viral tiktoks for your app",
    "publisher": "Hacker News",
    "canonical_url": "https://slidepilot.dev/",
    "published_at": "2026-10-27T19:53:21.000Z",
    "excerpt": "Show HN: Let your coding agent recreate viral tiktoks for your app",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.brangus.io/survival-llm",
    "headline": "Survival LLM: AI assistant and emergency library that runs on your own computer",
    "publisher": "Hacker News",
    "canonical_url": "https://www.brangus.io/survival-llm",
    "published_at": "2026-10-27T19:55:06.000Z",
    "excerpt": "Survival LLM: AI assistant and emergency library that runs on your own computer",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.ft.com/content/d144a865-285a-490e-be11-f924ada8cbc7",
    "headline": "How much is Anthropic really worth?",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/d144a865-285a-490e-be11-f924ada8cbc7",
    "published_at": "2026-10-27T20:00:00.000Z",
    "excerpt": "How much is Anthropic really worth?",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027440937/en/Grid-Dynamics-Launches-Business-Process-Consulting-Practice-to-Bridge-the-Gap-Between-AI-Investment-and-Business-Results?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Grid Dynamics Launches Business Process Consulting Practice to Bridge the Gap Between AI Investment and Business Results",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261027440937/en/Grid-Dynamics-Launches-Business-Process-Consulting-Practice-to-Bridge-the-Gap-Between-AI-Investment-and-Business-Results?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-27T20:05:00.000Z",
    "excerpt": "SAN RAMON, Calif.--(BUSINESS WIRE)--Grid Dynamics Holdings, Inc. (Nasdaq: GDYN) (“Grid Dynamics”), a premier AI transformation partner for the Fortune 1000, today announced the launch of its Business Process Consulting practice, extending the company's AI transformation capabilities across the",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027590794/en/CoreWeave-Announces-Date-of-Third-Quarter-2026-Financial-Results-and-Conference-Call?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "CoreWeave Announces Date of Third Quarter 2026 Financial Results and Conference Call",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261027590794/en/CoreWeave-Announces-Date-of-Third-Quarter-2026-Financial-Results-and-Conference-Call?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-27T20:05:00.000Z",
    "excerpt": "LIVINGSTON, N.J.--(BUSINESS WIRE)--CoreWeave, Inc. (Nasdaq: CRWV), The Essential Cloud for AI®, will hold its quarterly conference call to discuss third quarter 2026 financial results on Tuesday, November 10, 2026 at 5:00 PM Eastern Time. The live webcast of the earnings conference call can be",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027636043/en/CoStar-Group-to-Acquire-Vexcel-Adding-the-World%E2%80%99s-Largest-Survey-Grade-High-Resolution-Aerial-Imagery-Program-to-Power-Richer-Search-and-Discovery-Across-CoStar-with-Tens-of-Billions-of-New-AI-Derived-Data-Fields?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "CoStar Group to Acquire Vexcel, Adding the World’s Largest Survey Grade High-Resolution Aerial Imagery Program to Power Richer Search and Discovery Across CoStar with Tens of Billions of New AI-Derived Data Fields",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261027636043/en/CoStar-Group-to-Acquire-Vexcel-Adding-the-World%E2%80%99s-Largest-Survey-Grade-High-Resolution-Aerial-Imagery-Program-to-Power-Richer-Search-and-Discovery-Across-CoStar-with-Tens-of-Billions-of-New-AI-Derived-Data-Fields?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-27T20:05:00.000Z",
    "excerpt": "ARLINGTON, Va.--(BUSINESS WIRE)--CoStar Group, Inc. (NASDAQ: CSGP), a leading global provider of online real estate marketplaces, information, analytics, and digital twins in the property markets, announced today that it has entered into a definitive agreement to acquire Vexcel Group, Inc.",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027936657/en/BigBear.ai-Announces-Third-Quarter-2026-Results-and-Raises-FY-2026-Revenue-Guidance?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "BigBear.ai Announces Third Quarter 2026 Results and Raises FY 2026 Revenue Guidance",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261027936657/en/BigBear.ai-Announces-Third-Quarter-2026-Results-and-Raises-FY-2026-Revenue-Guidance?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-27T20:15:00.000Z",
    "excerpt": "MCLEAN, Va.--(BUSINESS WIRE)--BigBear.ai Holdings, Inc. (NYSE: BBAI) (“BigBear.ai” or the “Company”), a specialized security & defense technology company providing mission-ready AI, today reported financial results for the third quarter of 2026. A new investor presentation is also available on the",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://github.com/milad-ahmd/agent-skills",
    "headline": "Show HN: Agent Skills – 51 SKILL.md workflows for coding agents and marketers",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/milad-ahmd/agent-skills",
    "published_at": "2026-10-27T20:16:56.000Z",
    "excerpt": "Show HN: Agent Skills – 51 SKILL.md workflows for coding agents and marketers",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bbc.co.uk/sounds/play/w3ct8jys",
    "headline": "Tech Life",
    "publisher": "BBC News",
    "canonical_url": "https://www.bbc.co.uk/sounds/play/w3ct8jys",
    "published_at": "2026-10-27T20:30:00.000Z",
    "excerpt": "Tech Life",
    "source_count": 1,
    "publishers": [
      "BBC News"
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1019921/openai-breakthrough-math-computer-science-physics",
    "headline": "Researchers are getting tired of OpenAI gatekeeping its breakthroughs",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/ai-artificial-intelligence/1019921/openai-breakthrough-math-computer-science-physics",
    "published_at": "2026-10-27T20:48:58.000Z",
    "excerpt": "On Monday, OpenAI announced impressive breakthroughs in mathematics, computer science, and physics, along with what the company says is an evolving approach to communicating its findings. But despite its apparent course correction, researchers who spoke to The Verge are growing increasingly tired",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://www.anthropic.com/research/early-progress-drug-development",
    "headline": "Early progress on accelerating drug development with Claude",
    "publisher": "Hacker News",
    "canonical_url": "https://www.anthropic.com/research/early-progress-drug-development",
    "published_at": "2026-10-27T20:50:42.000Z",
    "excerpt": "Early progress on accelerating drug development with Claude",
    "source_count": 2,
    "publishers": [
      "Anthropic",
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/chen-985211/cleancode",
    "headline": "Show HN: CleanCode – Claude Code and Codex collaborating on one canvas",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/chen-985211/cleancode",
    "published_at": "2026-10-27T20:57:26.000Z",
    "excerpt": "Show HN: CleanCode – Claude Code and Codex collaborating on one canvas",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027051586/en/Ridgeview-Partners-Completes-Acquisition-of-Pinewood-Technologies-Group?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Ridgeview Partners Completes Acquisition of Pinewood Technologies Group",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261027051586/en/Ridgeview-Partners-Completes-Acquisition-of-Pinewood-Technologies-Group?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-27T21:00:00.000Z",
    "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Ridgeview Partners LLC (“Ridgeview”), a growth-oriented technology private equity firm, today announced the completion of the acquisition of Pinewood Technologies Group plc (“Pinewood.AI”), a leading cloud-based, AI-first, full-service technology provider to",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/whos-really-in-charge-at-anthropic-after-the-ipo",
    "headline": "Who’s really in charge at Anthropic after the IPO?",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/whos-really-in-charge-at-anthropic-after-the-ipo",
    "published_at": "2026-10-27T21:38:28.000Z",
    "excerpt": "Here's a clear explanation of Anthropic's incredibly complex governance structure.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://www.anthropic.com/news/s1-sec",
    "headline": "S1 Sec",
    "publisher": "Anthropic",
    "canonical_url": "https://www.anthropic.com/news/s1-sec",
    "published_at": "2026-10-27T21:40:46.000Z",
    "excerpt": "S1 Sec",
    "source_count": 1,
    "publishers": [
      "Anthropic"
    ]
  },
  {
    "id": "https://github.com/timjonez/new-english-dictionary",
    "headline": "Show HN: Spend Extra AI Usage Transcribing Murray's New English Dictionary",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/timjonez/new-english-dictionary",
    "published_at": "2026-10-27T21:44:13.000Z",
    "excerpt": "I've been working on transcribing the New English Dictionary ( NED ) into clean text using my extra usage on my AI sub. Thought I'd open it up to everyone and see if anyone want's to put their leftover usage to good use! Also would welcome any pointers getting something like this transcribed.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/bank-of-america-kindly-asks-that-you-dont-share-your-banking-password-with-your-ai-assistant",
    "headline": "Bank of America kindly asks that you don’t share your banking password with your AI assistant",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/bank-of-america-kindly-asks-that-you-dont-share-your-banking-password-with-your-ai-assistant",
    "published_at": "2026-10-27T21:44:34.000Z",
    "excerpt": "The banking giant reminds customers that \"you're responsible for activity\" resulting from your AI agents' access.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://cbcglobe.com/en/articles/2026/10/27/breaking-tesla-surges-4-and-amd-over-5-on-nyse-nvidia-and-mi-4ca4b69e",
    "headline": "Markets weekly closing series",
    "publisher": "CBC Globe",
    "canonical_url": "https://cbcglobe.com/en/articles/2026/10/27/breaking-tesla-surges-4-and-amd-over-5-on-nyse-nvidia-and-mi-4ca4b69e",
    "published_at": "2026-10-27T22:13:40.000Z",
    "excerpt": "AMD closed at $560.26, up $28.98 (5.45%) from the previous session. Meta closed at $620.19, down $10.37 (1.64%) from the previous session. Alphabet Class A finished trading at $320.58, up $3.78 (1.19%).",
    "source_count": 1,
    "publishers": [
      "CBC Globe"
    ]
  },
  {
    "id": "https://www.anthropic.com/news/expanding-partnership-gsa",
    "headline": "Expanding Partnership Gsa",
    "publisher": "Anthropic",
    "canonical_url": "https://www.anthropic.com/news/expanding-partnership-gsa",
    "published_at": "2026-10-27T22:21:46.000Z",
    "excerpt": "Expanding Partnership Gsa",
    "source_count": 1,
    "publishers": [
      "Anthropic"
    ]
  },
  {
    "id": "https://www.theguardian.com/society/2026/oct/27/ai-bots-flooded-2023-uk-government-consultation-disposable-vapes-ban",
    "headline": "AI bots flooded 2023 UK government consultation on disposable vapes ban",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/society/2026/oct/27/ai-bots-flooded-2023-uk-government-consultation-disposable-vapes-ban",
    "published_at": "2026-10-27T22:30:45.000Z",
    "excerpt": "AI bots flooded 2023 UK government consultation on disposable vapes ban",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/the-data-center-boom-has-an-upside-innovation-for-the-us-grid",
    "headline": "The data center boom has an upside: innovation for the US grid",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/the-data-center-boom-has-an-upside-innovation-for-the-us-grid",
    "published_at": "2026-10-27T22:55:41.000Z",
    "excerpt": "As the AI boom stresses the existing power grid, all sorts of new opportunities for grid modernization are also emerging as a result, industry insiders say.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/parents-sue-openai-alleging-gpt-4o-coached-their-daughter-off-seizure-medication",
    "headline": "Parents sue OpenAI, alleging GPT-4o coached their daughter off seizure medication",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/parents-sue-openai-alleging-gpt-4o-coached-their-daughter-off-seizure-medication",
    "published_at": "2026-10-27T23:34:27.000Z",
    "excerpt": "A family is suing OpenAI, saying ChatGPT coached their daughter to quietly taper off her seizure medication and keep it from her doctors before she died in February.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://deepmind.google/blog/gemini-4-carbon-our-next-frontier-model",
    "headline": "Gemini 4 Carbon: Our next frontier model",
    "publisher": "Google DeepMind",
    "canonical_url": "https://deepmind.google/blog/gemini-4-carbon-our-next-frontier-model",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "Gemini 4 Carbon: Our next frontier model",
    "source_count": 1,
    "publishers": [
      "Google DeepMind"
    ]
  },
  {
    "id": "https://huggingface.co/blog/nvidia/nemotron-transcribe-granary",
    "headline": "NVIDIA Nemotron 3.5 Transcribe and Granary v2: Intelligent Multilingual Transcription You Can Prompt and Adapt",
    "publisher": "Hugging Face",
    "canonical_url": "https://huggingface.co/blog/nvidia/nemotron-transcribe-granary",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "NVIDIA Nemotron 3.5 Transcribe and Granary v2: Intelligent Multilingual Transcription You Can Prompt and Adapt",
    "source_count": 2,
    "publishers": [
      "Hacker News",
      "Hugging Face"
    ]
  },
  {
    "id": "https://openai.com/index/legora",
    "headline": "Legora is building the agentic operating system for legal work",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/legora",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "See how Legora uses OpenAI models, ChatGPT, and Codex to accelerate legal workflows, expand contract analysis, and free lawyers to focus on higher-value work.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://openai.com/index/the-future-of-the-firm",
    "headline": "The future of the firm",
    "publisher": "OpenAI",
    "canonical_url": "https://openai.com/index/the-future-of-the-firm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "How AI might enter the org chart—beneath, beside, and between us.",
    "source_count": 1,
    "publishers": [
      "OpenAI"
    ]
  },
  {
    "id": "https://themorningbuild.com/digest/2026-10-28",
    "headline": "Genie 4",
    "publisher": "The Morning Build",
    "canonical_url": "https://themorningbuild.com/digest/2026-10-28",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "DeepMind announced Genie 4, a multimodal world model that natively generates audio, ambient sound, and interactive dialogue, can be steered in real time via natural language, and is being rolled out as a research preview to trusted testers.",
    "source_count": 1,
    "publishers": [
      "The Morning Build"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1043277/000104327726000039/0001043277-26-000039-index.htm",
    "headline": "8-K — C. H. ROBINSON WORLDWIDE, INC. (CHRW)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1043277/000104327726000039/0001043277-26-000039-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "EX-99.2; items 1.01, 2.02, 9.01; filed by C. H. ROBINSON WORLDWIDE, INC. (CHRW)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1051627/000121390026113058/0001213900-26-113058-index.htm",
    "headline": "8-K — AXT INC (AXTI)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1051627/000121390026113058/0001213900-26-113058-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "PRESS RELEASE OF AXT, INC., DATED OCTOBER 28, 2026 (FURNISHED PURSUANT TO ITEM 7.01); items 1.01, 7.01, 9.01; filed by AXT INC (AXTI)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1114859/000168316826008135/0001683168-26-008135-index.htm",
    "headline": "S-1/A — Glow Holdings, Inc. (GLOH)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1114859/000168316826008135/0001683168-26-008135-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "FORM S-1 AMENDMENT; filed by Glow Holdings, Inc. (GLOH)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1698506/000121390026112998/0001213900-26-112998-index.htm",
    "headline": "S-1/A — Simwon America Corp.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1698506/000121390026112998/0001213900-26-112998-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "REGISTRATION STATEMENT; filed by Simwon America Corp.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/1737995/000149315226048827/0001493152-26-048827-index.htm",
    "headline": "8-K — SkyAI, Inc. (SKYA, SKYAW)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/1737995/000149315226048827/0001493152-26-048827-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "EX-99.1; items 1.01, 8.01, 9.01; filed by SkyAI, Inc. (SKYA, SKYAW)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2070542/000121390026113119/0001213900-26-113119-index.htm",
    "headline": "8-K — AIB Data Centers Inc. (AIB)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2070542/000121390026113119/0001213900-26-113119-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "PRESS RELEASE, DATED OCTOBER 28, 2026; items 1.01, 5.02, 7.01, 9.01; filed by AIB Data Centers Inc. (AIB)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2161717/000216171726000001/0002161717-26-000001-index.htm",
    "headline": "D — Oncology AI Fleet, Inc.",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2161717/000216171726000001/0002161717-26-000001-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "FORM D; items 06C; filed by Oncology AI Fleet, Inc.",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/2162585/000216258526000001/0002162585-26-000001-index.htm",
    "headline": "D — AI Legal Support LLC",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/2162585/000216258526000001/0002162585-26-000001-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "Filed: 2026-10-28 AccNo: 0002162585-26-000001 Size: 5 KB",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://www.sec.gov/Archives/edgar/data/875657/000143774926033731/0001437749-26-033731-index.htm",
    "headline": "8-K — ULTRALIFE CORP (ULBI)",
    "publisher": "SEC EDGAR",
    "canonical_url": "https://www.sec.gov/Archives/edgar/data/875657/000143774926033731/0001437749-26-033731-index.htm",
    "published_at": "2026-10-28T00:00:00.000Z",
    "excerpt": "EXHIBIT 2.1; items 1.01, 7.01, 9.01; filed by ULTRALIFE CORP (ULBI)",
    "source_count": 1,
    "publishers": [
      "SEC EDGAR"
    ]
  },
  {
    "id": "https://about.fb.com/news/2026/10/muse-is-now-available-in-singapore-the-worlds-first-personal-ai-agent-built-for-everyone",
    "headline": "Muse Is Now Available in Singapore: The World’s First Personal AI Agent Built for Everyone",
    "publisher": "Meta",
    "canonical_url": "https://about.fb.com/news/2026/10/muse-is-now-available-in-singapore-the-worlds-first-personal-ai-agent-built-for-everyone",
    "published_at": "2026-10-28T00:00:03.000Z",
    "excerpt": "Muse Is Now Available in Singapore: The World’s First Personal AI Agent Built for Everyone",
    "source_count": 1,
    "publishers": [
      "Meta"
    ]
  },
  {
    "id": "https://www.bbc.co.uk/news/articles/ck1exgejq3xvo",
    "headline": "'An annoying buzz': The search for stealthier drones",
    "publisher": "BBC News",
    "canonical_url": "https://www.bbc.co.uk/news/articles/ck1exgejq3xvo",
    "published_at": "2026-10-28T00:01:10.000Z",
    "excerpt": "'An annoying buzz': The search for stealthier drones",
    "source_count": 1,
    "publishers": [
      "BBC News"
    ]
  },
  {
    "id": "https://github.com/sujee/visual-stories/tree/main/projects/tracing-llm-api-request",
    "headline": "Show HN: A visual explainer tracing an LLM API request to the GPU and back",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/sujee/visual-stories/tree/main/projects/tracing-llm-api-request",
    "published_at": "2026-10-28T00:55:41.000Z",
    "excerpt": "Show HN: A visual explainer tracing an LLM API request to the GPU and back",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://trvlrr.app/",
    "headline": "Show HN: I built Trvlrr, home for all your travels",
    "publisher": "Hacker News",
    "canonical_url": "https://trvlrr.app/",
    "published_at": "2026-10-28T01:07:28.000Z",
    "excerpt": "Hi HN, I'm Sanjay. I've been travelling since I moved from Pakistan to Stockholm in 2008; I live in Sydney now. My trips were scattered across a spreadsheet, airline apps, old inboxes and a photo library, so I built Trvlrr to hold all of it. It's how I plan all my future trips and look back at all",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://sightspinner.ai/blog/misery-in-america-2026-10-28.html",
    "headline": "Show HN: Misery in America",
    "publisher": "Hacker News",
    "canonical_url": "https://sightspinner.ai/blog/misery-in-america-2026-10-28.html",
    "published_at": "2026-10-28T01:09:05.000Z",
    "excerpt": "A model forecasting the misery index into next year. You can find the model without the article here: https:&#x2F;&#x2F;app.sightspinner.ai&#x2F;share&#x2F;g7Xirw5fr1e_BUExZv0hvlqjkWRAPFM9xgP99s2Yz9o",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.ft.com/content/44c35ed7-aa46-4d45-91f5-2773f00ae6be",
    "headline": "SK Hynix profits soar amid roaring AI chip demand",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/44c35ed7-aa46-4d45-91f5-2773f00ae6be",
    "published_at": "2026-10-28T01:15:00.000Z",
    "excerpt": "SK Hynix profits soar amid roaring AI chip demand",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/27/vcs-will-make-billions-on-anthropics-ipo-but-amazon-is-set-to-make-much-much-more",
    "headline": "VCs will make billions on Anthropic’s IPO, but Amazon is set to make much (much) more",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/27/vcs-will-make-billions-on-anthropics-ipo-but-amazon-is-set-to-make-much-much-more",
    "published_at": "2026-10-28T01:15:28.000Z",
    "excerpt": "Massive note conversions reveal the true extent of Amazon's ownership in Anthropic.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://lexifina.com/blog/git-for-the-us-code",
    "headline": "Git for the US Code",
    "publisher": "Hacker News",
    "canonical_url": "https://lexifina.com/blog/git-for-the-us-code",
    "published_at": "2026-10-28T01:47:50.000Z",
    "excerpt": "Git for the US Code",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/DeepLink-org/pvisor",
    "headline": "Show HN: PVisor, VM-isolated containers for agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/DeepLink-org/pvisor",
    "published_at": "2026-10-28T02:17:04.000Z",
    "excerpt": "Show HN: PVisor, VM-isolated containers for agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5",
    "headline": "Artificial Analysis Intelligence Index v5",
    "publisher": "Hacker News",
    "canonical_url": "https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5",
    "published_at": "2026-10-28T03:06:22.000Z",
    "excerpt": "Artificial Analysis Intelligence Index v5",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.aivideosugc.com/",
    "headline": "Show HN: How to Make AI UGC Ads in 2026 Using an AI Video Generator",
    "publisher": "Hacker News",
    "canonical_url": "https://www.aivideosugc.com/",
    "published_at": "2026-10-28T03:09:03.000Z",
    "excerpt": "AI UGC (Artificial Intelligence User-Generated Content) is the automated creation of casual, creator-style review and unboxing videos using AI avatars, AI scriptwriters, and realistic voiceovers. It replaces traditional human influencers, saving brands time and money on production. AivideosUGC",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.cirkit.us/demo",
    "headline": "Show HN: Cirkit – Annotate, Trace, and Ask AI About Schematic PDFs",
    "publisher": "Hacker News",
    "canonical_url": "https://www.cirkit.us/demo",
    "published_at": "2026-10-28T03:09:20.000Z",
    "excerpt": "Documentation tool for EEs to document and navigate their designs better. Upload your schematic PDFs to the tool and you will be able to annotate, pull data sheets of different components directly from Digikey, ask AI about your schematic, trace signals across different boards, embedded BOM data",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.aivideosugc.com/ai-video-generation",
    "headline": "Show HN: The New Way to Make AI UGC Ads in 2026",
    "publisher": "Hacker News",
    "canonical_url": "https://www.aivideosugc.com/ai-video-generation",
    "published_at": "2026-10-28T03:14:26.000Z",
    "excerpt": "In today’s digital marketplace, video content dictates ad performance and search rankings. However, traditional video production is slow, expensive, and difficult to scale. AivideosUGC solves this bottleneck. As a leading AI-powered UGC creation platform, AivideosUGC Turn product URL, image, or",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/charliewwdev/OpenMontage",
    "headline": "Show HN: OpenMontage Drama Studio – self-hosted AI studio for short dramas",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/charliewwdev/OpenMontage",
    "published_at": "2026-10-28T04:14:27.000Z",
    "excerpt": "Show HN: OpenMontage Drama Studio – self-hosted AI studio for short dramas",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.anthropic.com/research/claude-discovers-novel-enzyme-system",
    "headline": "Claude Discovers Novel Enzyme System",
    "publisher": "Anthropic",
    "canonical_url": "https://www.anthropic.com/research/claude-discovers-novel-enzyme-system",
    "published_at": "2026-10-28T04:28:01.000Z",
    "excerpt": "Claude Discovers Novel Enzyme System",
    "source_count": 1,
    "publishers": [
      "Anthropic"
    ]
  },
  {
    "id": "https://www.anthropic.com/research/coding-agents-social-sciences",
    "headline": "Coding Agents Social Sciences",
    "publisher": "Anthropic",
    "canonical_url": "https://www.anthropic.com/research/coding-agents-social-sciences",
    "published_at": "2026-10-28T04:28:52.000Z",
    "excerpt": "Coding Agents Social Sciences",
    "source_count": 1,
    "publishers": [
      "Anthropic"
    ]
  },
  {
    "id": "https://github.com/Alanzj/SelfClaw",
    "headline": "Show HN: SelfClaw – Self-hosted multi-model AI chat with OpenAI-compatible API",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Alanzj/SelfClaw",
    "published_at": "2026-10-28T04:52:34.000Z",
    "excerpt": "SelfClaw aggregates multiple LLM providers behind a single OpenAI-compatible API. Built with Python, Streamlit, and FastAPI. MIT licensed.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.ft.com/content/02e4a585-2101-4a2c-b16c-ba719567eb51",
    "headline": "FT Weekend Fest: Tech to save democracy",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/02e4a585-2101-4a2c-b16c-ba719567eb51",
    "published_at": "2026-10-28T05:00:00.000Z",
    "excerpt": "FT Weekend Fest: Tech to save democracy",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/24a35e41-2641-4cec-97f5-a974412f9952",
    "headline": "Anthropic’s seven founders tighten grip ahead of blockbuster IPO",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/24a35e41-2641-4cec-97f5-a974412f9952",
    "published_at": "2026-10-28T05:00:06.000Z",
    "excerpt": "Anthropic’s seven founders tighten grip ahead of blockbuster IPO",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/5c237fb3-23ba-4c1a-9257-fd66b9d42d6c",
    "headline": "UK defence ministry spent £186mn more on Palantir than value of public contracts",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/5c237fb3-23ba-4c1a-9257-fd66b9d42d6c",
    "published_at": "2026-10-28T05:00:06.000Z",
    "excerpt": "UK defence ministry spent £186mn more on Palantir than value of public contracts",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/694dbd7b-7096-47fe-b134-5275a1fb7b87",
    "headline": "AI maths advances raise fears over security of global encryption",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/694dbd7b-7096-47fe-b134-5275a1fb7b87",
    "published_at": "2026-10-28T05:00:14.000Z",
    "excerpt": "AI maths advances raise fears over security of global encryption",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/40ba9df7-cb00-4717-814d-55f86983bc00",
    "headline": "‘I want this over so much’: weary US voters face deluge of election ads",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/40ba9df7-cb00-4717-814d-55f86983bc00",
    "published_at": "2026-10-28T05:00:15.000Z",
    "excerpt": "‘I want this over so much’: weary US voters face deluge of election ads",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/4eca07ed-c30e-46fe-b780-fe0ab1ffd893",
    "headline": "We are living in the age of cartoon science",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/4eca07ed-c30e-46fe-b780-fe0ab1ffd893",
    "published_at": "2026-10-28T05:00:23.000Z",
    "excerpt": "We are living in the age of cartoon science",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.ft.com/content/e2aafede-771a-4fd0-b9fb-67c0bbb828ed",
    "headline": "TPG pursues $5bn acquisition of UK data centre group Ark",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/e2aafede-771a-4fd0-b9fb-67c0bbb828ed",
    "published_at": "2026-10-28T05:00:23.000Z",
    "excerpt": "TPG pursues $5bn acquisition of UK data centre group Ark",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.theguardian.com/australia-news/2026/oct/28/emotional-intimacy-ai-chatbots-ban-digital-duty-of-care-laws-australian-politics",
    "headline": "‘Emotional intimacy’ from AI chatbots would be banned under Australia’s digital duty of care laws",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/australia-news/2026/oct/28/emotional-intimacy-ai-chatbots-ban-digital-duty-of-care-laws-australian-politics",
    "published_at": "2026-10-28T05:31:55.000Z",
    "excerpt": "‘Emotional intimacy’ from AI chatbots would be banned under Australia’s digital duty of care laws",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261027567337/en/Ant-International-CEO-Achieving-Inclusion-Is-Critical-to-Re-Globalisation-and-AI-Will-Accelerate-It-by-Democratising-Opportunities?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Ant International CEO: Achieving Inclusion Is Critical to Re-Globalisation, and AI Will Accelerate It by Democratising Opportunities",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261027567337/en/Ant-International-CEO-Achieving-Inclusion-Is-Critical-to-Re-Globalisation-and-AI-Will-Accelerate-It-by-Democratising-Opportunities?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T06:24:00.000Z",
    "excerpt": "DOHA, Qatar--(BUSINESS WIRE)--Speaking at the United Nations Trade and Development (UNCTAD) World Investment Forum 2026 panel, “Investing in AI for an Inclusive Digital Future”, Ant International CEO Peng Yang called for a new, inclusive “re-globalisation” project that harnesses AI and digital",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://www.ft.com/content/6abfda69-f4f7-45d5-922c-f4b65a72bcdc",
    "headline": "The AI bubble already popped — in China",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/6abfda69-f4f7-45d5-922c-f4b65a72bcdc",
    "published_at": "2026-10-28T06:30:03.000Z",
    "excerpt": "The AI bubble already popped — in China",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://hackerscad.com/",
    "headline": "Show HN: Hackerscad – Code-first CAD with MCP server for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://hackerscad.com/",
    "published_at": "2026-10-28T07:21:19.000Z",
    "excerpt": "Show HN: Hackerscad – Code-first CAD with MCP server for AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/misbahsy/novul",
    "headline": "Show HN: NoVul – Open-source Mac app to Find and fix vulnerabilities on your Mac",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/misbahsy/novul",
    "published_at": "2026-10-28T07:32:53.000Z",
    "excerpt": "Since everyone and their agents are building apps, there is not time to stop and search for vulnerabilities on our machine. Built an open source tool that monitors new vulnerabilities every 15 mins and lets you or your agent know on what to fix.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://kisongerstellen.com/",
    "headline": "Show HN: KI Song erstellen – German AI music from prompts and lyrics",
    "publisher": "Hacker News",
    "canonical_url": "https://kisongerstellen.com/",
    "published_at": "2026-10-28T08:18:00.000Z",
    "excerpt": "Show HN: KI Song erstellen – German AI music from prompts and lyrics",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.mybotsai.com/",
    "headline": "Show HN: FreeApply Free Job Application MCP, runs locally with your existing LLM",
    "publisher": "Hacker News",
    "canonical_url": "https://www.mybotsai.com/",
    "published_at": "2026-10-28T08:18:29.000Z",
    "excerpt": "Any critism, advice, etc is welcome. Local mcp server hosting private information on the client computer and utilizing client-side model subscriptions to handle workloads. Has ATS optimization and cover letter generation. Tools are weighted by model to optimize token spend.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://dreamagainusa.org/",
    "headline": "Wealth Inequality in America drawn to scale",
    "publisher": "Hacker News",
    "canonical_url": "https://dreamagainusa.org/",
    "published_at": "2026-10-28T08:48:21.000Z",
    "excerpt": "Wealth Inequality in America drawn to scale",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://apps.apple.com/us/app/curate-photo/id6825514911",
    "headline": "Show HN: Curate. free, no ADS, with AI, private photo cleaner for iPhone",
    "publisher": "Hacker News",
    "canonical_url": "https://apps.apple.com/us/app/curate-photo/id6825514911",
    "published_at": "2026-10-28T08:52:34.000Z",
    "excerpt": "Show HN: Curate. free, no ADS, with AI, private photo cleaner for iPhone",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028854882/en/Financial-Services-Increases-AI-Investment-Faster-Than-Wider-Market-While-Maturity-Remains-Level?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Financial Services Increases AI Investment Faster Than Wider Market, While Maturity Remains Level",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261028854882/en/Financial-Services-Increases-AI-Investment-Faster-Than-Wider-Market-While-Maturity-Remains-Level?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T08:56:00.000Z",
    "excerpt": "PALO ALTO, Calif.--(BUSINESS WIRE)-- #ai--HTEC, the global AI technology and engineering leader, today released its research on AI Value realization in financial services and Insurance. Organizations in this sector are increasing AI investment more aggressively than the wider market, but the sector",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/28/technology/silicon-valley-bugs-ai.html",
    "headline": "AI Is Finding a Flood of Bugs, and Silicon Valley Is Rushing to Fix Them",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/28/technology/silicon-valley-bugs-ai.html",
    "published_at": "2026-10-28T09:04:38.000Z",
    "excerpt": "AI Is Finding a Flood of Bugs, and Silicon Valley Is Rushing to Fix Them",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://www.thetimes.com/world/europe/article/spain-train-crash-madrid-latest-deaths-victims-807kwv23l",
    "headline": "Spain train crash: 'At least 10 dead' in high-speed collision",
    "publisher": "Hacker News",
    "canonical_url": "https://www.thetimes.com/world/europe/article/spain-train-crash-madrid-latest-deaths-victims-807kwv23l",
    "published_at": "2026-10-28T09:35:21.000Z",
    "excerpt": "Spain train crash: 'At least 10 dead' in high-speed collision",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theguardian.com/books/2026/oct/28/no-inevitable-dystopia-jeanette-winterson-ai-future-of-humanity",
    "headline": "‘There is no inevitable dystopia’: Jeanette Winterson on AI and the future of humanity",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/books/2026/oct/28/no-inevitable-dystopia-jeanette-winterson-ai-future-of-humanity",
    "published_at": "2026-10-28T10:00:05.000Z",
    "excerpt": "The author believes we are at a turning point as a species – and even in the shadow of big tech it’s up to us how we want to proceed ‘I am a storyteller by trade,” writes Jeanette Winterson on the first page of her 2021 book 12 Bytes , an idiosyncratic and thought-provoking series of essays in",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://github.com/linearza/ballast",
    "headline": "Show HN: Ballast – macOS app to clear disk space",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/linearza/ballast",
    "published_at": "2026-10-28T10:36:15.000Z",
    "excerpt": "Built a little native MacOS app out of necessity to help me free up some storage on my Mac. I've always been frustrated by the lack of visibility and mysterious nature of the Storage overview especially when it comes to Developer and System Data. Ballast gives you a detailed breakdown of all common",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://theconversation.com/barcelona-unrest-how-to-fabricate-a-protest-in-the-age-of-tiktok-295263",
    "headline": "Barcelona unrest: how to fabricate a protest in the age of TikTok",
    "publisher": "Hacker News",
    "canonical_url": "https://theconversation.com/barcelona-unrest-how-to-fabricate-a-protest-in-the-age-of-tiktok-295263",
    "published_at": "2026-10-28T10:41:27.000Z",
    "excerpt": "Barcelona unrest: how to fabricate a protest in the age of TikTok",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://news.crunchbase.com/startups/nontech-founder-government-ai-software-chen-fsh",
    "headline": "From Monk To Startups: One Founder’s Unusual Path To Building Government Software",
    "publisher": "Crunchbase News",
    "canonical_url": "https://news.crunchbase.com/startups/nontech-founder-government-ai-software-chen-fsh",
    "published_at": "2026-10-28T11:00:00.000Z",
    "excerpt": "After living as a monk while managing Graves’ disease, a former Facebook engineer left Big Tech to pursue meaningful work, eventually founding government software startup FSH Technologies which aims to improve processes such as school food services and public records management through the use of",
    "source_count": 1,
    "publishers": [
      "Crunchbase News"
    ]
  },
  {
    "id": "https://emudhra.we-have-a-problem.com/apple.html",
    "headline": "Apple's git still trusts the compromised eMudhra certificates",
    "publisher": "Hacker News",
    "canonical_url": "https://emudhra.we-have-a-problem.com/apple.html",
    "published_at": "2026-10-28T11:03:40.000Z",
    "excerpt": "Apple's git still trusts the compromised eMudhra certificates",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/agens-field/nuvrail",
    "headline": "Show HN: Nuvrail – make an AI agent ask before it sends, moves or deletes email",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/agens-field/nuvrail",
    "published_at": "2026-10-28T11:07:00.000Z",
    "excerpt": "Show HN: Nuvrail – make an AI agent ask before it sends, moves or deletes email",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://support.apple.com/en-us/149555",
    "headline": "About the compromised eMudhra intermediate CAs",
    "publisher": "Hacker News",
    "canonical_url": "https://support.apple.com/en-us/149555",
    "published_at": "2026-10-28T11:08:49.000Z",
    "excerpt": "About the compromised eMudhra intermediate CAs",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/27medkamal/tmux-agent-wizard",
    "headline": "Show HN: TAW, herdr for tmux: see which coding agent needs you",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/27medkamal/tmux-agent-wizard",
    "published_at": "2026-10-28T11:13:13.000Z",
    "excerpt": "Show HN: TAW, herdr for tmux: see which coding agent needs you",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1020410/meta-launched-ai-pet-journal-app-waddle-world",
    "headline": "Meta quietly launched an ‘AI pet journal’ app",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/ai-artificial-intelligence/1020410/meta-launched-ai-pet-journal-app-waddle-world",
    "published_at": "2026-10-28T11:27:30.000Z",
    "excerpt": "Meta has launched a \"tamagotchi-style\" pet game called Waddle World, with virtual creatures that chat with users and create doodles to illustrate conversations. According to its Apple and Play Store listings, the \"16-bit pet care game\" is not really a game, but \"a daily journal disguised as a pet.\"",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://www.theguardian.com/us-news/2026/oct/28/datacenter-noise-lawsuit-elon-musk-mississippi",
    "headline": "‘Elonville’: US residents say Musk’s xAI offered to buy homes if they don’t sue over datacenter noise",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/us-news/2026/oct/28/datacenter-noise-lawsuit-elon-musk-mississippi",
    "published_at": "2026-10-28T11:30:01.000Z",
    "excerpt": "‘Elonville’: US residents say Musk’s xAI offered to buy homes if they don’t sue over datacenter noise",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.reuters.com/business/media-telecom/amazon-signs-1157-billion-deal-satellite-firm-globalstar-challenge-starlink-2026-04-14/1157-billion-deal-satellite-firm-globalstar-challenge-starlink-2026-04-14",
    "headline": "Amazon to buy satellite firm Globalstar in $11.57B deal",
    "publisher": "Hacker News",
    "canonical_url": "https://www.reuters.com/business/media-telecom/amazon-signs-1157-billion-deal-satellite-firm-globalstar-challenge-starlink-2026-04-14/1157-billion-deal-satellite-firm-globalstar-challenge-starlink-2026-04-14",
    "published_at": "2026-10-28T11:54:23.000Z",
    "excerpt": "Amazon to buy satellite firm Globalstar in $11.57B deal",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.reuters.com/business/media-telecom/us-agency-approves-amazon-leos-115-billion-acquisition-globalstar-2026-10-27",
    "headline": "US agency approves Amazon Leo’s $11.5B acquisition of Globalstar",
    "publisher": "Hacker News",
    "canonical_url": "https://www.reuters.com/business/media-telecom/us-agency-approves-amazon-leos-115-billion-acquisition-globalstar-2026-10-27",
    "published_at": "2026-10-28T11:54:23.000Z",
    "excerpt": "US agency approves Amazon Leo’s $11.5B acquisition of Globalstar",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://toolmaker.io/",
    "headline": "Show HN: ToolmakerAgent,AI SDLC platform where humans and agents can collaborate",
    "publisher": "Hacker News",
    "canonical_url": "https://toolmaker.io/",
    "published_at": "2026-10-28T11:57:34.000Z",
    "excerpt": "Show HN: ToolmakerAgent,AI SDLC platform where humans and agents can collaborate",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.technologyreview.com/2026/10/28/1147637/pairing-industrial-ai-autonomy-and-human-control",
    "headline": "Pairing industrial AI autonomy and human control",
    "publisher": "MIT Technology Review",
    "canonical_url": "https://www.technologyreview.com/2026/10/28/1147637/pairing-industrial-ai-autonomy-and-human-control",
    "published_at": "2026-10-28T12:00:00.000Z",
    "excerpt": "Pairing industrial AI autonomy and human control",
    "source_count": 1,
    "publishers": [
      "MIT Technology Review"
    ]
  },
  {
    "id": "https://www.theverge.com/ai-artificial-intelligence/1018676/data-center-midterm-election-energy-water-texas",
    "headline": "Voters in Texas agree: They hate data centers",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/ai-artificial-intelligence/1018676/data-center-midterm-election-energy-water-texas",
    "published_at": "2026-10-28T12:00:00.000Z",
    "excerpt": "Ask Texas NAACP president Gary Bledsoe what it's been like to see data center developers descend upon Austin and its surrounding suburbs and he can rattle off project after project facing opposition from locals. There's the fight in Taylor over plans to build a data center at a site that's supposed",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://www.theguardian.com/commentisfree/2026/oct/28/ai-climate-crisis-humanity",
    "headline": "Will it be AI or the climate crisis that ends humanity? We can make it neither | Adam McKay and Philip Eubanks",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/commentisfree/2026/oct/28/ai-climate-crisis-humanity",
    "published_at": "2026-10-28T12:00:04.000Z",
    "excerpt": "Both of these threats have the same roots: private entities seeking to cash in. We have the power to stand against them A summer of extreme heat, entire villages obliterated in Nepal, a super El Niño breaking records, Exxon publicly saying we may reach 3C by 2050 – could it possibly be any worse?",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://aiworkflows.tools/workflows",
    "headline": "Show HN: AI Workflows – 32 step-by-step workflows built from 146 AI tools",
    "publisher": "Hacker News",
    "canonical_url": "https://aiworkflows.tools/workflows",
    "published_at": "2026-10-28T12:03:05.000Z",
    "excerpt": "Show HN: AI Workflows – 32 step-by-step workflows built from 146 AI tools",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028117784/en/Hummingbird-Acquires-Quantimon-to-Bring-Machine-Learning-to-AML-Transaction-Monitoring-for-the-Agentic-Era?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Hummingbird Acquires Quantimon to Bring Machine Learning to AML Transaction Monitoring for the Agentic Era",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261028117784/en/Hummingbird-Acquires-Quantimon-to-Bring-Machine-Learning-to-AML-Transaction-Monitoring-for-the-Agentic-Era?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T12:05:00.000Z",
    "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Hummingbird, the AI-powered orchestration platform for financial crime compliance, today announced the acquisition of Quantimon, the machine learning platform for AML risk detection. The acquisition deepens Hummingbird's investment in transaction monitoring, bringing",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://github.com/tinybig-ai/jep",
    "headline": "Show HN: Multi-platform remote-control for any harness",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/tinybig-ai/jep",
    "published_at": "2026-10-28T12:10:43.000Z",
    "excerpt": "I was fed up with codex and opencode not having good mobile remote control apps. I loved using claude code from my phone, but i hop between harnesses and i didn't want to be locked into Claude Code just for the mobile remote control. I also hated the shabby pi.dev remote control that i found",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/kevinmmiddleton/recruiter-bff",
    "headline": "Show HN: I worked at an ATS, so I built Recruiter BFF for Claude and ChatGPT",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/kevinmmiddleton/recruiter-bff",
    "published_at": "2026-10-28T12:12:25.000Z",
    "excerpt": "Show HN: I worked at an ATS, so I built Recruiter BFF for Claude and ChatGPT",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/klahrich/replyslip",
    "headline": "Show HN: ReplySlip – An open-source async task inbox for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/klahrich/replyslip",
    "published_at": "2026-10-28T12:26:10.000Z",
    "excerpt": "Show HN: ReplySlip – An open-source async task inbox for AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.euronews.com/video/2026/10/28/spain-first-footage-reveals-wreckage-of-deadly-high-speed-train-crash",
    "headline": "Two high-speed trains collide near Toledo, Spain",
    "publisher": "Hacker News",
    "canonical_url": "https://www.euronews.com/video/2026/10/28/spain-first-footage-reveals-wreckage-of-deadly-high-speed-train-crash",
    "published_at": "2026-10-28T12:35:41.000Z",
    "excerpt": "Two high-speed trains collide near Toledo, Spain",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/jgrichardson/shufler",
    "headline": "Show HN: Shufler: 3D gaming harness around your coding harness and dev pipeline",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/jgrichardson/shufler",
    "published_at": "2026-10-28T12:39:28.000Z",
    "excerpt": "Hi HN. Greg here. I've been a full stack engineer for 20 years. Now all I do is shuffle messages between users, my agent fleet, our dev pipeline.. back and forth. I miss coding, solving problems, reasoning, and having an understanding and a mental model of all the work I'm juggling. But this is the",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/labstack/fanout",
    "headline": "Show HN: Fanout – OpenTelemetry back end in one Go binary (Parquet, DuckDB, MCP)",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/labstack/fanout",
    "published_at": "2026-10-28T12:48:11.000Z",
    "excerpt": "Show HN: Fanout – OpenTelemetry back end in one Go binary (Parquet, DuckDB, MCP)",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.wired.com/story/ice-is-running-one-of-the-largest-anti-left-surveillance-operations-in-us-history",
    "headline": "Evidence of a spying operation by ICE against left-wing social movements",
    "publisher": "Hacker News",
    "canonical_url": "https://www.wired.com/story/ice-is-running-one-of-the-largest-anti-left-surveillance-operations-in-us-history",
    "published_at": "2026-10-28T12:49:45.000Z",
    "excerpt": "Evidence of a spying operation by ICE against left-wing social movements",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/physicsdolphin/nv-uefi-unlocker",
    "headline": "Show HN: UEFI pre-driver Nvidia GPU unlocker for Windows",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/physicsdolphin/nv-uefi-unlocker",
    "published_at": "2026-10-28T12:58:57.000Z",
    "excerpt": "UEFI pre-driver NVIDIA GPU unlocker for Windows (Rust): SEC2 scrubber -> FWSEC&#x2F;WPR2 -> signed Booter -> V67 four-write payload, read-back verified. Based on https:&#x2F;&#x2F;github.com&#x2F;Zagitta&#x2F;gpu-unlock , https:&#x2F;&#x2F;github.com&#x2F;JustAResearcher&#x2F;gpu-unlock-ada ,",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028047517/en/Klarna-to-Present-at-Upcoming-Investor-Conference?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Klarna to Present at Upcoming Investor Conference",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261028047517/en/Klarna-to-Present-at-Upcoming-Investor-Conference?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T13:00:00.000Z",
    "excerpt": "NEW YORK--(BUSINESS WIRE)--Klarna, the everyday finance network, today announced its participation in the following investor conference in December. UBS Global Technology and AI Conference (David Sykes, President and Chief Commercial Officer) At 2:55 p.m. MST on December 1. Live webcasts and",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/7-days-until-techcrunch-founder-summit-save-up-to-100-before-doors-open",
    "headline": "7 days until TechCrunch Founder Summit: Save up to $100 on your pass before doors open",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/28/7-days-until-techcrunch-founder-summit-save-up-to-100-before-doors-open",
    "published_at": "2026-10-28T13:00:00.000Z",
    "excerpt": "In just 7 days, TechCrunch Founder Summit takes over Boston’s SoWa Power Station on November 4. Your chance to save up to $100 on tickets is running out, and the opportunity to learn and connect directly with experienced founders, investors, and startup leaders is almost here.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://www.globenewswire.com/news-release/2026/10/28/3390266/0/en/rapidcanvas-acquires-entytle-to-bring-ai-driven-execution-to-the-industrial-aftermarket.html",
    "headline": "RapidCanvas → Entytle",
    "publisher": "GlobeNewswire",
    "canonical_url": "https://www.globenewswire.com/news-release/2026/10/28/3390266/0/en/rapidcanvas-acquires-entytle-to-bring-ai-driven-execution-to-the-industrial-aftermarket.html",
    "published_at": "2026-10-28T13:00:00.000Z",
    "excerpt": "RapidCanvas, a managed AI execution company, today announced it has acquired Entytle, the company that pioneered the Autonomous Aftermarket for B2B OEMs. Financial terms were not disclosed.",
    "source_count": 1,
    "publishers": [
      "GlobeNewswire"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028683272/en/IREN-and-Wingspire-Equipment-Finance-Complete-363-Million-Financing-for-High-Density-AI-Compute-Assets?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "IREN and Wingspire Equipment Finance Complete $363 Million Financing for High-Density AI Compute Assets",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261028683272/en/IREN-and-Wingspire-Equipment-Finance-Complete-363-Million-Financing-for-High-Density-AI-Compute-Assets?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T13:17:00.000Z",
    "excerpt": "TUSTIN, Calif. & SYDNEY--(BUSINESS WIRE)--Wingspire Equipment Finance and IREN Limited (NASDAQ: IREN) (“IREN”) announced the closing of a $363 million equipment financing transaction supporting IREN’s AI compute business.The Equipment Finance Agreement refinanced recently acquired,",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://orktes.github.io/jsui",
    "headline": "Show HN: Cross-platform embeddable UI runtime using QuickJS and Skia",
    "publisher": "Hacker News",
    "canonical_url": "https://orktes.github.io/jsui",
    "published_at": "2026-10-28T13:22:33.000Z",
    "excerpt": "For the past two decades I've been looking for something that allows me to easily build complex and pretty UIs in places that are generally hostile to complex and pretty UIs aka game engines. Solutions do exists but they either include awkward pricing structures or required embedding something like",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.technologyreview.com/2026/10/20/1145399/emacs-turns-50",
    "headline": "Emacs Turns 50",
    "publisher": "Hacker News",
    "canonical_url": "https://www.technologyreview.com/2026/10/20/1145399/emacs-turns-50",
    "published_at": "2026-10-28T13:25:11.000Z",
    "excerpt": "Emacs Turns 50",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/trypando/pando",
    "headline": "Show HN: Pando, what to do with vibe coded apps at work",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/trypando/pando",
    "published_at": "2026-10-28T13:29:37.000Z",
    "excerpt": "Since AI has grown in popularity, technical and non-technical employees have been using it to build small tools and apps to boost productivity and model prototypes. Some companies like Ramp and Stripe, are building their own internal platform for this. That’s great for them, but not every company",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028051332/en/Schwab-Advisor-Services%E2%84%A2-Expands-AI-Inside-Schwab-Advisor-Center-and-Across-the-Third-Party-Solutions-RIAs-Use?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Schwab Advisor Services™ Expands AI Inside Schwab Advisor Center and Across the Third-Party Solutions RIAs Use",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261028051332/en/Schwab-Advisor-Services%E2%84%A2-Expands-AI-Inside-Schwab-Advisor-Center-and-Across-the-Third-Party-Solutions-RIAs-Use?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T13:30:00.000Z",
    "excerpt": "WESTLAKE, Texas & BOSTON--(BUSINESS WIRE)--Schwab Advisor Services, Charles Schwab's business supporting the growth and success of more than 17,000 independent registered investment advisors (RIAs), today announced new AI solutions for RIAs, available inside Schwab Advisor Center and through the",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://simedw.com/projects/harness-corp",
    "headline": "Show HN: Harness Corp – An incremental game powered by a local LLM using WebGPU",
    "publisher": "Hacker News",
    "canonical_url": "https://simedw.com/projects/harness-corp",
    "published_at": "2026-10-28T13:36:05.000Z",
    "excerpt": "I built a small browser incremental game where you start by answering tasks at your desk to save up to rent a GPU, and hire a real Qwen3-0.6B model running locally in your browser over WebGPU (~358 MB download). Throughout the game you buy upgrades to your model's harness, things like JSON",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://religionnews.com/2026/10/26/in-a-first-a-humanist-granted-a-religious-exemption-from-using-ai",
    "headline": "Kentucky man becomes the first humanist granted religious exemption from AI",
    "publisher": "Hacker News",
    "canonical_url": "https://religionnews.com/2026/10/26/in-a-first-a-humanist-granted-a-religious-exemption-from-using-ai",
    "published_at": "2026-10-28T13:41:30.000Z",
    "excerpt": "Kentucky man becomes the first humanist granted religious exemption from AI",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028263072/en/Ronald-McDonald-House-New-York-Awarded-1.5-Million-Grant-From-RBC-Foundation-USA-to-Pilot-AI-Powered-Hub-for-Family-Centered-Care?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Ronald McDonald House New York Awarded $1.5 Million Grant From RBC Foundation USA to Pilot AI-Powered Hub for Family-Centered Care",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261028263072/en/Ronald-McDonald-House-New-York-Awarded-1.5-Million-Grant-From-RBC-Foundation-USA-to-Pilot-AI-Powered-Hub-for-Family-Centered-Care?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T14:00:00.000Z",
    "excerpt": "NEW YORK--(BUSINESS WIRE)--Ronald McDonald House New York (RMH-NY) today announced it has been awarded a $1.5 million, three-year grant from the RBC Foundation USA to pilot an AI-powered Family Navigation Hub for families staying at RMH-NY. Today, families staying at RMH-NY rely on paper flyers and",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://www.theguardian.com/tv-and-radio/2026/oct/29/castle-walls-review-prime-first-fully-ai-generated-tv-show",
    "headline": "Castle Walls review – Prime’s first fully AI-generated show is here, and it’s a Vaseline-smeared mess",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/tv-and-radio/2026/oct/29/castle-walls-review-prime-first-fully-ai-generated-tv-show",
    "published_at": "2026-10-28T14:00:05.000Z",
    "excerpt": "Billed as the first end-to-end AI-created series on a major streaming service, this Turkish show looks like the result of the prompt ‘make it cinematic’ Just as the world reels from Elon Musk’s AI-powered The Odyssey remake – though “remake” feels rather generous for a seven-minute splat of",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://cursor.com/blog/agent-sdk",
    "headline": "The Agent SDK",
    "publisher": "Hacker News",
    "canonical_url": "https://cursor.com/blog/agent-sdk",
    "published_at": "2026-10-28T14:02:20.000Z",
    "excerpt": "The Agent SDK",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://agent-bv.pages.dev/app",
    "headline": "Show HN: Agent-B.V., adversarial tests and on-chain reports for AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://agent-bv.pages.dev/app",
    "published_at": "2026-10-28T14:03:38.000Z",
    "excerpt": "Show HN: Agent-B.V., adversarial tests and on-chain reports for AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://ai-resume-reviewer-nine-drab.vercel.app/",
    "headline": "Show HN: AI Resume Reviewer Built with Next.js",
    "publisher": "Hacker News",
    "canonical_url": "https://ai-resume-reviewer-nine-drab.vercel.app/",
    "published_at": "2026-10-28T14:20:45.000Z",
    "excerpt": "Show HN: AI Resume Reviewer Built with Next.js",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://babeltro.storagebits.workers.dev/",
    "headline": "Show HN: Babeltro – Nine demoscene effects in 13 languages, pixel-identical",
    "publisher": "Hacker News",
    "canonical_url": "https://babeltro.storagebits.workers.dev/",
    "published_at": "2026-10-28T14:27:27.000Z",
    "excerpt": "I was wondering how those classic demoscene effects come out in different languages. It’s interesting to see the required contortions for each language to get there. For example, SQLite has no float32, so it's emulated in SQL. Wasm has no sin(), so the hand-written port builds its own sine table,",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.wordstodata.com/",
    "headline": "Show HN: Local, Tracked, Versioned, Legal Research Databases",
    "publisher": "Hacker News",
    "canonical_url": "https://www.wordstodata.com/",
    "published_at": "2026-10-28T14:29:47.000Z",
    "excerpt": "This is a project I've been working on for about 8 months now. I worked in legal tech for 3 years and found that one of the biggest hurdles for AI agents and lawyers alike when doing legal research is tracking changes, and correctly cross referencing those changes between different forms of legal",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/nodal-data/nodal-context",
    "headline": "Show HN: Interview your analysts instead of auto-generating a semantic layer",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/nodal-data/nodal-context",
    "published_at": "2026-10-28T14:35:23.000Z",
    "excerpt": "I’ve spent the last year building context for AI analysts in the mid-market. I’ve open sourced a library from my learnings, along the same principles of the Matt Pocock skills. Principles: * Claude &#x2F; Codex &#x2F; Cursor etc are great data agents - you just need context to enable them to answer",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://carmelitegothic.com/cnc-stone-carving",
    "headline": "CNC Stone Carving",
    "publisher": "Hacker News",
    "canonical_url": "https://carmelitegothic.com/cnc-stone-carving",
    "published_at": "2026-10-28T14:38:22.000Z",
    "excerpt": "CNC Stone Carving",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.npmjs.com/package/@rlabs-cl/arketum",
    "headline": "Show HN: Arketum – MCP server that makes coding agents stop for human approval",
    "publisher": "Hacker News",
    "canonical_url": "https://www.npmjs.com/package/@rlabs-cl/arketum",
    "published_at": "2026-10-28T14:46:29.000Z",
    "excerpt": "Show HN: Arketum – MCP server that makes coding agents stop for human approval",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/algeon-dev/algeon",
    "headline": "Show HN: Algeon – Compose GPU graph, vector, and ML algorithms in SQL",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/algeon-dev/algeon",
    "published_at": "2026-10-28T14:47:23.000Z",
    "excerpt": "Algeon is a query engine built on Apache DataFusion that exposes NVIDIA's cuGraph, cuVS, and cuML as SQL table functions. It doesn't write its GPU kernels. Instead, it takes what NVIDIA already has and embeds it into DataFusion, so you can call those GPU operations on any arbitrary data, with",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/colinsurprenant/parley",
    "headline": "Show HN: Parley – coding-agent sessions that collaborate over IRC",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/colinsurprenant/parley",
    "published_at": "2026-10-28T14:48:16.000Z",
    "excerpt": "Show HN: Parley – coding-agent sessions that collaborate over IRC",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://chopstick.sh/",
    "headline": "Show HN: Chopstick – Mac notch widgets built by your coding agent",
    "publisher": "Hacker News",
    "canonical_url": "https://chopstick.sh/",
    "published_at": "2026-10-28T14:48:57.000Z",
    "excerpt": "Hey HN, happy to share Chopstick with you. It's a Mac app that makes your notch useful, but most importantly customizable and dynamic. What makes it unique is that you can build custom widgets with your coding agent. Chopstick automatically learns from your usage and suggests new widgets with time.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/ai-data-center-debt-may-test-credit-market-fortress-video",
    "headline": "AI Data-Center Borrowing May Test Credit Market: Fortress",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/ai-data-center-debt-may-test-credit-market-fortress-video",
    "published_at": "2026-10-28T14:56:36.000Z",
    "excerpt": "Brian Stewart, global co-head of corporate credit at Fortress, says the credit market could face a more serious absorption problem from AI data-center borrowing. Speaking on \"Bloomberg Open Interest,\" Stewart says that U.S. investment-grade issuance recently reached a record, while the AI funding",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://github.com/TheWariend/CleanSlate",
    "headline": "Show HN: An AI workspace with shared procedural memory as reusable skills",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/TheWariend/CleanSlate",
    "published_at": "2026-10-28T14:58:46.000Z",
    "excerpt": "Show HN: An AI workspace with shared procedural memory as reusable skills",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028508802/en/Foundry-Robotics-Raises-100-Million-Series-A-to-Build-America%E2%80%99s-First-Autonomous-Factory-for-Assembly?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Foundry Robotics Raises $100 Million Series A to Build America’s First Autonomous Factory for Assembly",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261028508802/en/Foundry-Robotics-Raises-100-Million-Series-A-to-Build-America%E2%80%99s-First-Autonomous-Factory-for-Assembly?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T15:00:00.000Z",
    "excerpt": "EMERYVILLE, Calif.--(BUSINESS WIRE)--Foundry Robotics today announced its oversubscribed $100 million Series A funding round led by Marlinspike Partners. Participating in the round are early backers Khosla Ventures and Red Glass Ventures, and new investors SE Ventures, Wing VC, and Axiom Ventures,",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/voice-ai-in-vogue-nvidia-releases-new-open-transcription-model",
    "headline": "Voice AI in vogue: Nvidia releases new open transcription model",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/28/voice-ai-in-vogue-nvidia-releases-new-open-transcription-model",
    "published_at": "2026-10-28T15:00:00.000Z",
    "excerpt": "Nvidia just released a free speech-to-text model that can transcribe up to 40 languages, but it only works on recordings, not live audio, so it’s a big step for meeting and medical transcription tools while still leaving real-time use to rivals like ElevenLabs.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://www.theguardian.com/games/2026/oct/28/social-media-is-full-of-weird-video-game-mashups-where-are-they-all-coming-from",
    "headline": "Social media is full of weird video game mashups. Where are they all coming from?",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/games/2026/oct/28/social-media-is-full-of-weird-video-game-mashups-where-are-they-all-coming-from",
    "published_at": "2026-10-28T15:00:05.000Z",
    "excerpt": "Social media is full of weird video game mashups. Where are they all coming from?",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.theguardian.com/thefilter/2025/sep/19/best-led-red-light-therapy-face-masks",
    "headline": "‘Light therapy without remortgaging the house’: the best LED face masks – tested",
    "publisher": "The Guardian",
    "canonical_url": "https://www.theguardian.com/thefilter/2025/sep/19/best-led-red-light-therapy-face-masks",
    "published_at": "2026-10-28T15:00:52.000Z",
    "excerpt": "‘Light therapy without remortgaging the house’: the best LED face masks – tested",
    "source_count": 1,
    "publishers": [
      "The Guardian"
    ]
  },
  {
    "id": "https://www.ft.com/content/b25a880c-cd64-49d1-ba5f-7d077eb1adac",
    "headline": "AI agents need middle managers too",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/b25a880c-cd64-49d1-ba5f-7d077eb1adac",
    "published_at": "2026-10-28T15:00:59.000Z",
    "excerpt": "AI agents need middle managers too",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://jeman.net/nekot",
    "headline": "Show HN: Nekot, an iPhone app that warns you before Claude Code limits hit",
    "publisher": "Hacker News",
    "canonical_url": "https://jeman.net/nekot",
    "published_at": "2026-10-28T15:01:45.000Z",
    "excerpt": "Show HN: Nekot, an iPhone app that warns you before Claude Code limits hit",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/columbia-opens-claims-for-16-million-data-breach-settlement",
    "headline": "Columbia Opens Claims for $16 Million Data Breach Settlement",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/articles/2026-10-28/columbia-opens-claims-for-16-million-data-breach-settlement",
    "published_at": "2026-10-28T15:05:08.000Z",
    "excerpt": "Columbia University has opened the window for individuals impacted by the school’s data breach last year to claim part of a $16.1 million settlement.",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://bugtape.ai/",
    "headline": "Show HN: BugTape – production bugs your coding agent can read and fix over MCP",
    "publisher": "Hacker News",
    "canonical_url": "https://bugtape.ai/",
    "published_at": "2026-10-28T15:07:18.000Z",
    "excerpt": "Show HN: BugTape – production bugs your coding agent can read and fix over MCP",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://lab.ripplecolab.com/human-system-ai",
    "headline": "Show HN: An animated map of the people and money in AI",
    "publisher": "Hacker News",
    "canonical_url": "https://lab.ripplecolab.com/human-system-ai",
    "published_at": "2026-10-28T15:22:37.000Z",
    "excerpt": "Show HN: An animated map of the people and money in AI",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://app.userrank.ai/",
    "headline": "Show HN: Coding agent spots your AI practices and the ones you're missing",
    "publisher": "Hacker News",
    "canonical_url": "https://app.userrank.ai/",
    "published_at": "2026-10-28T15:26:16.000Z",
    "excerpt": "Frontier models improve at a pace faster than the pace at which most humans are able to keep up. Not all of us are obsessed with pushing the boundaries of our agents and trying new ways to work with them. I often spend 12+ hours a day working with an LLM, and still, when I talk to people, I hear of",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.anthropic.com/research/discovering-vulnerabilities-with-claude",
    "headline": "Discovering Vulnerabilities With Claude",
    "publisher": "Anthropic",
    "canonical_url": "https://www.anthropic.com/research/discovering-vulnerabilities-with-claude",
    "published_at": "2026-10-28T15:31:36.000Z",
    "excerpt": "Discovering Vulnerabilities With Claude",
    "source_count": 1,
    "publishers": [
      "Anthropic"
    ]
  },
  {
    "id": "https://pullboard.dev/live",
    "headline": "Show HN: Watch AI agents build Pullboard, live",
    "publisher": "Hacker News",
    "canonical_url": "https://pullboard.dev/live",
    "published_at": "2026-10-28T15:39:57.000Z",
    "excerpt": "Show HN: Watch AI agents build Pullboard, live",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/south-koreas-financial-industry-hit-by-fresh-wave-of-cyberattacks",
    "headline": "South Korea’s financial industry hit by fresh wave of cyberattacks",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/28/south-koreas-financial-industry-hit-by-fresh-wave-of-cyberattacks",
    "published_at": "2026-10-28T15:41:18.000Z",
    "excerpt": "South Korea’s financial institutions have been hit by another wave of cyberattacks, highlighting the growing risk of AI-driven hacking in Asia.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://www.ft.com/content/e9827543-51c9-451b-b180-e7e2276aa957",
    "headline": "Mubadala Capital dealmaker to launch his own venture fund",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/e9827543-51c9-451b-b180-e7e2276aa957",
    "published_at": "2026-10-28T15:44:48.000Z",
    "excerpt": "Mubadala Capital dealmaker to launch his own venture fund",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://surgehq.ai/blog/dayjob-tax",
    "headline": "Dayjob: Tax – evaluating AI agents on 50 professional tax assignments",
    "publisher": "Hacker News",
    "canonical_url": "https://surgehq.ai/blog/dayjob-tax",
    "published_at": "2026-10-28T15:46:30.000Z",
    "excerpt": "Dayjob: Tax – evaluating AI agents on 50 professional tax assignments",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://news.ycombinator.com/item?id=50275751",
    "headline": "Show HN: Muscle Memory – Can you still write code without AI?",
    "publisher": "Hacker News",
    "canonical_url": "https://news.ycombinator.com/item?id=50275751",
    "published_at": "2026-10-28T15:53:38.000Z",
    "excerpt": "Developer of 6 years here, been using AI (increasingly) over the last year for most of my work. A few weeks back I started to look for new jobs as the current startup I work for is falling into pieces. \"Do I need to do leetcode again?\" - I thought. So I picked a few challenges and tried to solve",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/ai-execs-may-be-too-out-of-touch-to-build-for-the-general-public",
    "headline": "AI execs may be too out of touch to build for the general public",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/28/ai-execs-may-be-too-out-of-touch-to-build-for-the-general-public",
    "published_at": "2026-10-28T15:53:52.000Z",
    "excerpt": "Tech leaders are flaunting how out of touch they are when they brag about using AI to connect with their families.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://github.com/dali-benothmen/woml",
    "headline": "Show HN: WOML – A markup language for building workflows and AI agents",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/dali-benothmen/woml",
    "published_at": "2026-10-28T15:54:42.000Z",
    "excerpt": "Show HN: WOML – A markup language for building workflows and AI agents",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://1dot.ai/files-magic-ai",
    "headline": "Show HN: Files Magic AI: Organize and rename files via content with undo on Mac",
    "publisher": "Hacker News",
    "canonical_url": "https://1dot.ai/files-magic-ai",
    "published_at": "2026-10-28T16:09:40.000Z",
    "excerpt": "Show HN: Files Magic AI: Organize and rename files via content with undo on Mac",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.theverge.com/tech/1020769/meta-updated-business-terms-delay-indefinitely",
    "headline": "Meta says it’ll probably delay its controversial new business terms again",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/tech/1020769/meta-updated-business-terms-delay-indefinitely",
    "published_at": "2026-10-28T16:15:30.000Z",
    "excerpt": "Meta says it may push the implementation of its new business terms past November 20th as it faces backlash from publishers over concerns about AI training. In a post on X, Meta communications head Andy Stone said the company does \"not plan to make policy changes without a full consultation with",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://github.com/grimmerk/memsaga",
    "headline": "Show HN: Memsaga – Git history of Claude Code memory and skills, by session",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/grimmerk/memsaga",
    "published_at": "2026-10-28T16:21:26.000Z",
    "excerpt": "Show HN: Memsaga – Git history of Claude Code memory and skills, by session",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/ai-fed-simulation-predicts-rates-will-hold-steady-video",
    "headline": "AI Fed Simulation Predicts Interest Rates Will Hold Steady",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/ai-fed-simulation-predicts-rates-will-hold-steady-video",
    "published_at": "2026-10-28T16:25:51.000Z",
    "excerpt": "he Federal Reserve will decide whether to adjust the US's benchmark interest rate on Wednesday, with investment banks, economists, and journalists waiting to see if their predictions are correct. Researchers Tara Sinclair and Sophia Kazinnik have developed an AI simulation called Sim Fed, which",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://sketch.wsng.app/",
    "headline": "Show HN: Potential conversation partners in Bluesky using agentic search",
    "publisher": "Hacker News",
    "canonical_url": "https://sketch.wsng.app/",
    "published_at": "2026-10-28T16:32:12.000Z",
    "excerpt": "What if instead of talking to AI, we could find human counterparts currently sharing the same interest to talk to? Some whales kind of do that by singing across the ocean. This inspired a thought process for a conceptual social network - whalesong - where an idea, thought or a conversationally",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://vulang.org/",
    "headline": "Show HN: Vu – a new programming language designed for AI. Rust speeds, Py syntax",
    "publisher": "Hacker News",
    "canonical_url": "https://vulang.org/",
    "published_at": "2026-10-28T16:35:24.000Z",
    "excerpt": "hi everyone! I wanted to share what I've been working on these past 6~ years. TL;DR: Rust is great, but somewhere along the way, I learned that I was too dumb to read and write Rust. As I worked on larger and larger Rust projects, I also became frustrated with the developer experience of working in",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://promptuaria.com/",
    "headline": "Show HN: Promptuaria – GitHub for specs",
    "publisher": "Hacker News",
    "canonical_url": "https://promptuaria.com/",
    "published_at": "2026-10-28T16:45:23.000Z",
    "excerpt": "Hi HN, I'm seeing more and more people sharing software specs instead of code, and I think this will become increasingly common as coding agents get better at one-shotting entire apps from a single prompt. So I put together Promptuaria over a few days. It's a small platform where you can publish,",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.blockchainiq.co/blog/x402-integrations-from-the-build-bounty",
    "headline": "Show HN: X402 integrations for an AI-agent data API, checked in a clean room",
    "publisher": "Hacker News",
    "canonical_url": "https://www.blockchainiq.co/blog/x402-integrations-from-the-build-bounty",
    "published_at": "2026-10-28T16:50:10.000Z",
    "excerpt": "I run Blockchain IQ. We sell some crypto data to software agents per request over x402 (HTTP 402, USDC on Base, no account or API key). In October we paid for integrations: 22 were submitted and we checked each one by matching its on-chain payment to our purchase log and running it in a clean",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/newsletters/2026-10-28/ransomware-negotiator-arrests-add-scrutiny-to-shadowy-industry",
    "headline": "Ransomware Negotiator Arrests Add Scrutiny to Shadowy Industry",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/newsletters/2026-10-28/ransomware-negotiator-arrests-add-scrutiny-to-shadowy-industry",
    "published_at": "2026-10-28T16:58:40.000Z",
    "excerpt": "Recent arrests are catching the attention of others in the cybersecurity industry.",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/as-ai-agents-reshape-the-web-google-opens-gemini-and-search-to-more-apps",
    "headline": "As AI agents reshape the web, Google opens Gemini and Search to more apps",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/28/as-ai-agents-reshape-the-web-google-opens-gemini-and-search-to-more-apps",
    "published_at": "2026-10-28T17:00:00.000Z",
    "excerpt": "A new developer platform will let businesses bring their services to Google's AI experiences, potentially changing how consumers discover and use apps.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/chromes-ai-powered-autofill-can-now-dig-through-your-gmail-to-fill-out-forms",
    "headline": "Chrome’s AI-powered Autofill can now dig through your Gmail to fill out forms",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/28/chromes-ai-powered-autofill-can-now-dig-through-your-gmail-to-fill-out-forms",
    "published_at": "2026-10-28T17:00:00.000Z",
    "excerpt": "The autofill update lets Chrome pull flight confirmations, tracking info, order details, and other information from your inbox, with your permission.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://www.theverge.com/tech/1020626/chrome-enhanced-autofill-gmail-forms-gemini-personal-intelligence",
    "headline": "Chrome’s enhanced autofill can now pull info from Gmail to help you fill out forms",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/tech/1020626/chrome-enhanced-autofill-gmail-forms-gemini-personal-intelligence",
    "published_at": "2026-10-28T17:00:00.000Z",
    "excerpt": "Following improvements made to Chrome's enhanced autofill last year that included your name, passport number, email address, and physical addresses sourced from your Google Accounts and services like Google Wallet, the feature is now expanding. Starting today, Chrome's enhanced autofill will use",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon",
    "headline": "Gemini 4 Carbon",
    "publisher": "Hacker News",
    "canonical_url": "https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon",
    "published_at": "2026-10-28T17:01:23.000Z",
    "excerpt": "Gemini 4 Carbon",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.ft.com/content/0cd47fb7-6de2-476f-a557-6f9647c9de88",
    "headline": "Risky business? Why failure may be the new normal",
    "publisher": "Financial Times",
    "canonical_url": "https://www.ft.com/content/0cd47fb7-6de2-476f-a557-6f9647c9de88",
    "published_at": "2026-10-28T17:03:01.000Z",
    "excerpt": "Risky business? Why failure may be the new normal",
    "source_count": 1,
    "publishers": [
      "Financial Times"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/apple-unveils-touch-screen-macbook-pro-reversing-longheld-jobs-stance",
    "headline": "Apple Unveils Touch-Screen MacBook Pro, Reversing Long-Held Jobs Stance",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/articles/2026-10-28/apple-unveils-touch-screen-macbook-pro-reversing-longheld-jobs-stance",
    "published_at": "2026-10-28T17:06:00.000Z",
    "excerpt": "After two decades of spurning the idea, Apple Inc. unveiled an overhauled MacBook Pro that includes a touch screen, giving its flagship laptop a feature that has become a must-have in the personal computer industry.",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://github.com/egma-ai/homi",
    "headline": "Show HN: Homi, open decision model for audio, near Flash on MMSU and 50x cheaper",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/egma-ai/homi",
    "published_at": "2026-10-28T17:09:08.000Z",
    "excerpt": "Weights - https:&#x2F;&#x2F;huggingface.co&#x2F;egma-ai&#x2F;homi",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.apple.com/macbook-pro/proled-xdr-display",
    "headline": "MacBook Pro with PROLED XDR Display and Touch",
    "publisher": "Hacker News",
    "canonical_url": "https://www.apple.com/macbook-pro/proled-xdr-display",
    "published_at": "2026-10-28T17:10:37.000Z",
    "excerpt": "MacBook Pro with PROLED XDR Display and Touch",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/open-interest-10-28-2026-video",
    "headline": "Countdown to Fed, Tech Earnings",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/open-interest-10-28-2026-video",
    "published_at": "2026-10-28T17:18:36.000Z",
    "excerpt": "Get a jump start on the US trading day with Dani Burger on \"Bloomberg Open Interest.\" Powerful profits from SK Hynix refuel the AI trade as booming demand for memory chips shows no signs of slowing. Microsoft and Alphabet gear up to report results on the busiest day of earnings season for the S&P",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.nytimes.com/2026/10/28/technology/apple-touch-screen-macbook-pro.html",
    "headline": "Apple Unveils Its First Touch-Screen MacBook Pro",
    "publisher": "The New York Times",
    "canonical_url": "https://www.nytimes.com/2026/10/28/technology/apple-touch-screen-macbook-pro.html",
    "published_at": "2026-10-28T17:19:33.000Z",
    "excerpt": "Apple Unveils Its First Touch-Screen MacBook Pro",
    "source_count": 1,
    "publishers": [
      "The New York Times"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/palantir-s-defense-chief-sees-chinese-threat-to-taiwan-over-ai",
    "headline": "Palantir’s Defense Chief Sees Chinese Threat to Taiwan Over AI",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/articles/2026-10-28/palantir-s-defense-chief-sees-chinese-threat-to-taiwan-over-ai",
    "published_at": "2026-10-28T17:26:53.000Z",
    "excerpt": "Palantir Technologies Inc.’s head of defense Mike Gallagher is warning that advances in artificial intelligence capabilities have made it more compelling for Chinese leader Xi Jinping to seize control of Taiwan, a chipmaking hub that has helped fuel the global AI boom.",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://42loop.com/about",
    "headline": "Show HN: 42Loop - Agent runs the product, I assist it",
    "publisher": "Hacker News",
    "canonical_url": "https://42loop.com/about",
    "published_at": "2026-10-28T17:36:47.000Z",
    "excerpt": "As my first experiment in AI autonomy, I set up an agent that runs the product, while I assist it. The product is the community board hosted on the homepage of 42Loop.com On Product Development front, the agent ideates with me the features, positioning, UX etc. and provides me the prompts that I",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://github.com/tellers-ai/skills",
    "headline": "Show HN: Preview video timelines live in the browser as AI agents edit them",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/tellers-ai/skills",
    "published_at": "2026-10-28T17:39:29.000Z",
    "excerpt": "Show HN: Preview video timelines live in the browser as AI agents edit them",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/ai-will-transform-video-game-development-bing-gordon-video",
    "headline": "AI Can Unlock More Creativity in Video Games, Says Ex-EA Executive",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/ai-will-transform-video-game-development-bing-gordon-video",
    "published_at": "2026-10-28T17:40:43.000Z",
    "excerpt": "AI will help boost video game quality, allowing developers to be more creative and deal with issues like old code, says Bing Gordon, a founding executive at Electronic Arts and former chief product officer at Kleiner Perkins. He joins Ed Ludlow on “Bloomberg Tech\" to discuss his new book,",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/anthropic-said-to-pick-jpmorgan-to-lead-ipo-video",
    "headline": "Anthropic Weighs Offering 15%-20% of IPO to Retail Investors",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/anthropic-said-to-pick-jpmorgan-to-lead-ipo-video",
    "published_at": "2026-10-28T17:44:28.000Z",
    "excerpt": "Anthropic is weighing a retail offering of 15% to 20% of the shares available in the IPO, according to people familiar with the matter. Those sources say the company behind Claude has tapped JPMorgan Chase to lead the US retail offering. Bloomberg’s Ryan Gould discusses the plans with Ed Ludlow on",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/bloomberg-tech-10-28-2026-video",
    "headline": "Investors Eye AI Payoff in Microsoft, Alphabet Earnings",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/bloomberg-tech-10-28-2026-video",
    "published_at": "2026-10-28T17:46:10.000Z",
    "excerpt": "Bloomberg’s Ed Ludlow breaks down expectations for Microsoft and Alphabet, which both report earnings after the bell, with Wall Street looking for proof that their massive AI investments are paying off. Plus, Bloomberg reports that Anthropic has tapped JPMorgan to lead the US retail offering for",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://zen-garden.ai/",
    "headline": "Show HN: AI Zen Garden",
    "publisher": "Hacker News",
    "canonical_url": "https://zen-garden.ai/",
    "published_at": "2026-10-28T17:53:48.000Z",
    "excerpt": "A place to spend your extra tokens. It's not really a game; It's not really anything I guess. You can bookmark specific locations and have an LLM add stuff.",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/ai-boom-complicates-fed-s-demand-supply-call-clarida-video",
    "headline": "AI Boom Complicates Fed’s Demand Versus Supply Call, Clarida Says",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/ai-boom-complicates-fed-s-demand-supply-call-clarida-video",
    "published_at": "2026-10-28T18:25:59.000Z",
    "excerpt": "Former Federal Reserve Vice Chairman Richard Clarida says the Fed is weighing whether AI-driven growth represents a demand shock, which could call for higher rates, or whether productivity gains will eventually boost supply and ease inflation. He speaks on \"Bloomberg Surveillance: The Fed Decides.\"",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/oracle-projects-30-billion-free-cash-flow-in-fiscal-2029",
    "headline": "Oracle Jumps After Projecting Return to Positive Cash Flow",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/articles/2026-10-28/oracle-projects-30-billion-free-cash-flow-in-fiscal-2029",
    "published_at": "2026-10-28T18:34:57.000Z",
    "excerpt": "Oracle Corp. shares jumped after the company gave a long-term outlook for free cash flow that eased investor nerves about the potential payoff from its artificial intelligence spending.",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.theverge.com/tech/1021143/microsoft-lg-samsung-copilot-ai-assistant-smart-tvs-ending",
    "headline": "Microsoft is ending Copilot support on smart TVs",
    "publisher": "The Verge",
    "canonical_url": "https://www.theverge.com/tech/1021143/microsoft-lg-samsung-copilot-ai-assistant-smart-tvs-ending",
    "published_at": "2026-10-28T18:36:26.000Z",
    "excerpt": "Nearly two years after LG and Samsung announced at CES 2025 that their latest smart TVs would include access to Microsoft's Copilot, the company is ending support for the AI assistant's functionality on all TVs this year, according to a report by Windows Central. The news comes not from an official",
    "source_count": 1,
    "publishers": [
      "The Verge"
    ]
  },
  {
    "id": "https://claude.ai/artifact/Xxm7H6eLCKgoxJVrSqTigH",
    "headline": "Show HN: Measuring how much of an AI-assisted design is yours",
    "publisher": "Hacker News",
    "canonical_url": "https://claude.ai/artifact/Xxm7H6eLCKgoxJVrSqTigH",
    "published_at": "2026-10-28T18:41:45.000Z",
    "excerpt": "Show HN: Measuring how much of an AI-assisted design is yours",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://arstechnica.com/ai/2026/10/google-announces-gemini-4-carbon-its-latest-frontier-ai-model-that-you-cant-use",
    "headline": "Google announces Gemini 4 Carbon, its latest frontier AI model that you can't use",
    "publisher": "Ars Technica",
    "canonical_url": "https://arstechnica.com/ai/2026/10/google-announces-gemini-4-carbon-its-latest-frontier-ai-model-that-you-cant-use",
    "published_at": "2026-10-28T18:47:27.000Z",
    "excerpt": "Gemini 4 Carbon is essentially a slightly better version of Argon.",
    "source_count": 1,
    "publishers": [
      "Ars Technica"
    ]
  },
  {
    "id": "https://techcrunch.com/podcast/the-vulnpocalypse-is-coming-for-the-internets-aging-code-says-wizs-cto",
    "headline": "The ‘Vulnpocalypse’ is coming for the internet’s aging code, says Wiz’s CTO",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/podcast/the-vulnpocalypse-is-coming-for-the-internets-aging-code-says-wizs-cto",
    "published_at": "2026-10-28T18:50:39.000Z",
    "excerpt": "The PHP scare may have faded from your feed, but the cleanup is far from over. Last week, two critical bugs in the open source language behind roughly 70% of websites left organizations scrambling to fix their systems, with some taking sites offline until the vulnerabilities could be patched.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://techcrunch.com/video/wizs-cto-on-php2shell-and-the-coming-vulnpocalypse",
    "headline": "Wiz’s CTO on PHP2Shell and the coming ‘vulnpocalypse’",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/video/wizs-cto-on-php2shell-and-the-coming-vulnpocalypse",
    "published_at": "2026-10-28T19:05:46.000Z",
    "excerpt": "The PHP scare may have faded from your feed, but the cleanup is far from over. Last week, two critical bugs in the open source language behind roughly 70% of websites left organizations scrambling to fix their systems, with some taking sites offline until the vulnerabilities could be patched.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/articles/2026-10-28/doj-inquires-about-nvidia-s-hugging-face-deal-reuters-says",
    "headline": "DOJ Inquires About Nvidia’s Hugging Face Deal, Reuters Says",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/articles/2026-10-28/doj-inquires-about-nvidia-s-hugging-face-deal-reuters-says",
    "published_at": "2026-10-28T19:14:22.000Z",
    "excerpt": "The US Justice Department is making inquiries about Nvidia Corp.’s agreement to acquire AI model company Hugging Face for about $13 billion, part of broader regulatory scrutiny of the chip giant, Reuters reported.",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.bbc.co.uk/news/articles/c63djl148n3eo",
    "headline": "Elon Musk is a 'real genius', Putin says after satellite talks with SpaceX boss",
    "publisher": "BBC News",
    "canonical_url": "https://www.bbc.co.uk/news/articles/c63djl148n3eo",
    "published_at": "2026-10-28T19:15:58.000Z",
    "excerpt": "Elon Musk is a 'real genius', Putin says after satellite talks with SpaceX boss",
    "source_count": 1,
    "publishers": [
      "BBC News"
    ]
  },
  {
    "id": "https://techcrunch.com/2026/10/28/anthropic-just-launched-tools-to-show-companies-what-their-ai-spending-is-buying",
    "headline": "Anthropic just launched tools to show companies what their AI spending is buying",
    "publisher": "TechCrunch",
    "canonical_url": "https://techcrunch.com/2026/10/28/anthropic-just-launched-tools-to-show-companies-what-their-ai-spending-is-buying",
    "published_at": "2026-10-28T19:19:58.000Z",
    "excerpt": "The frontier lab is lifting the curtain on how users spend money on its models ahead of a planned IPO.",
    "source_count": 1,
    "publishers": [
      "TechCrunch"
    ]
  },
  {
    "id": "http://www.businesswire.com/news/home/20261028010878/en/Rocker-Launches-as-the-Context-Aware-AI-Work-Assistant-for-the-Busiest-People-at-the-World%E2%80%99s-Most-Ambitious-Companies?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "headline": "Rocker Launches as the Context-Aware AI Work Assistant for the Busiest People at the World’s Most Ambitious Companies",
    "publisher": "Business Wire",
    "canonical_url": "http://www.businesswire.com/news/home/20261028010878/en/Rocker-Launches-as-the-Context-Aware-AI-Work-Assistant-for-the-Busiest-People-at-the-World%E2%80%99s-Most-Ambitious-Companies?feedref=JjAwJuNHiystnCoBq_hl-Q-tiwWZwkcswR1UZtV7eGe24xL9TZOyQUMS3J72mJlQ7fxFuNFTHSunhvli30RlBNXya2izy9YOgHlBiZQk2LOzmn6JePCpHPCiYGaEx4DL1Rq8pNwkf3AarimpDzQGuQ%3D%3D",
    "published_at": "2026-10-28T19:22:00.000Z",
    "excerpt": "SAN FRANCISCO--(BUSINESS WIRE)--Rocker, the AI assistant for busiest people at the world’s most ambitious companies, today announced $12.85M in funding led by Greycroft, with participation from Anthropic and Menlo Ventures' Anthology Fund, Matchstick, Stripe, and operators Jeanne DeWitt Grosser",
    "source_count": 1,
    "publishers": [
      "Business Wire"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/in-position-to-continue-playing-offense-garlinghouse-video",
    "headline": "In Position To Continue Playing Offense: Garlinghouse",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/in-position-to-continue-playing-offense-garlinghouse-video",
    "published_at": "2026-10-28T19:22:55.000Z",
    "excerpt": "Brad Garlinghouse, CEO of Ripple, joins Scarlet Fu and Isabelle Lee on \"Bloomberg Crypto.\" Ripple said it has received final approval from the US Office of the Comptroller of the Currency to establish a national trust bank, the latest step in its push into traditional finance. (Source: Bloomberg)",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/opposition-to-perpetuals-is-about-structure-duffy-video",
    "headline": "Opposition To Perpetuals Is About Structure: Duffy",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/opposition-to-perpetuals-is-about-structure-duffy-video",
    "published_at": "2026-10-28T19:23:46.000Z",
    "excerpt": "Terry Duffy, chairman & CEO of CME Group, joins Scarlet Fu and Isabelle Lee on \"Bloomberg Crypto.\" They discuss how commodity exchanges are urging US regulators to withhold approval of Kalshi’s proposed perpetual oil futures contract and potentially closing a loophole that gives retail traders",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://www.bloomberg.com/news/videos/2026-10-28/clarity-act-a-bipartisan-issue-calvert-video",
    "headline": "Clarity Act A 'Bipartisan Issue': Calvert",
    "publisher": "Bloomberg",
    "canonical_url": "https://www.bloomberg.com/news/videos/2026-10-28/clarity-act-a-bipartisan-issue-calvert-video",
    "published_at": "2026-10-28T19:25:17.000Z",
    "excerpt": "Kara Calvert, vice president of US policy at Coinbase, joins Scarlet Fu and Isabelle Lee on \"Bloomberg Crypto.\" They discuss the failure of the Clarity Act and the potential of new crypto bill after the upcoming US midterm elections. (Source: Bloomberg)",
    "source_count": 1,
    "publishers": [
      "Bloomberg"
    ]
  },
  {
    "id": "https://github.com/Asdivyansh/silo-cli",
    "headline": "Show HN: Silo – an open source secure CLI sandbox for running agents locally",
    "publisher": "Hacker News",
    "canonical_url": "https://github.com/Asdivyansh/silo-cli",
    "published_at": "2026-10-28T19:33:24.000Z",
    "excerpt": "Show HN: Silo – an open source secure CLI sandbox for running agents locally",
    "source_count": 1,
    "publishers": [
      "Hacker News"
    ]
  },
  {
    "id": "https://artificialanalysis.ai/models",
    "headline": "Comparison of AI Models across Intelligence, Performance, and Price | Artificial Analysis",
    "publisher": "Artificial Analysis",
    "canonical_url": "https://artificialanalysis.ai/models",
    "published_at": "2026-10-28T19:44:16.800Z",
    "excerpt": "Comparison and analysis of AI models across key performance metrics including quality, price, output speed, latency, context window &amp; others.",
    "source_count": 1,
    "publishers": [
      "Artificial Analysis"
    ]
  },
  {
    "id": "https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",
    "headline": "Open LLM Leaderboard - a Hugging Face Space by open-llm-leaderboard",
    "publisher": "Hugging Face",
    "canonical_url": "https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard",
    "published_at": "2026-10-28T19:44:16.800Z",
    "excerpt": "This app lets you explore an interactive leaderboard of open‑source large language models and see how they perform on a range of tests such as IFEval, BBH, MATH, GPQA, MUSR, and MMLU‑PRO. You can f...",
    "source_count": 1,
    "publishers": [
      "Hugging Face"
    ]
  },
  {
    "id": "https://arcprize.org/leaderboard",
    "headline": "ARC Prize - Leaderboard",
    "publisher": "ARC Prize",
    "canonical_url": "https://arcprize.org/leaderboard",
    "published_at": "2026-10-28T19:44:16.801Z",
    "excerpt": "The ARC-AGI Leaderboard.",
    "source_count": 1,
    "publishers": [
      "ARC Prize"
    ]
  }
]
