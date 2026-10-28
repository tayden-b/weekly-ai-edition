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
