---
# DESIGN.md — Weekly AI Edition

## 0. Direction: "Broadsheet, redrawn"

A newspaper's structure — masthead, kickers, hairline-ruled columns, section heads — executed with the restraint of a design studio site. Warm paper ground, near-black ink, one red accent, big tight grotesk headlines, tiny uppercase labels, images as the only colour. Nothing decorative. If an element is not type, rule, image, or data, it does not exist.

Reference board (what each contributes, and only that):

| Ref | Take | Leave |
|---|---|---|
| distribute.software | Data density handled calmly; the Tech Index (rank, logo, count, trend arrow); red kicker for "top" | Calendar grid, dashboard chrome, three-column everything |
| Enfold Studio | Oversized headline type bleeding to the edges; confident scale jumps; muted photography | Agency tone, logo wall |
| A17.2 | Whitespace as structure; image-first grid with caption-sized type under it; hairline-thin nav | Portfolio sparseness (we carry more items per page) |
| Gega "Art Magazine" | Full-width ruled grid; cards defined by rules not shadows; pill category labels; uppercase masthead | Card thumbnails on every item |
| The Fox Newspaper | Masthead + tagline + date line; section heads as heavy display type with a rule; column structure; the "Latest" red | Victorian density, serif body, photo on everything |

## 1. Tokens

### 1.1 Colour

```
--paper:        #F4F3EF   /* ground, light */
--paper-2:      #ECEBE6   /* recessed panels, code, chart bg */
--ink:          #111111   /* text, rules at full strength */
--ink-2:        #5C5C58   /* secondary text, captions, metadata */
--ink-3:        #A3A29D   /* tertiary, disabled, placeholder */
--rule:         #D9D8D2   /* hairlines */
--accent:       #D9281C   /* red: live/top signals ONLY */
--up:           #1F7A3A   /* trend up (Markets, Most Covered) */
--down:         #B3261E   /* trend down */

dark scheme (prefers-color-scheme: dark):
--paper:        #121212   --paper-2: #1B1B1B
--ink:          #F1F0EC   --ink-2:   #A8A7A2   --ink-3: #6B6A66
--rule:         #2A2A2A   --accent:  #FF4A3D
```

Rules: accent appears at most once per viewport (kicker, "Latest", the cover's issue number). Never on buttons, never as a background. Up/down only next to a number.

### 1.2 Type

Two families, three roles.

| Role | Face | Fallback | Notes |
|---|---|---|---|
| Display / headlines | **Inter Tight** (Google) | Geist, Helvetica Neue | weight 600, tracking −0.02em to −0.04em as size grows |
| Text / UI | **Inter** | system-ui | weight 400/500, tracking 0 |
| Data / mono | **Geist Mono** | JetBrains Mono | tickers, amounts, dates in tables, the agent-access block |

Masthead: "THE WEEKLY AI EDITION" (working name) set in Inter Tight 700, uppercase, tracking +0.08em at small size (nav) and −0.03em at hero size (cover). No logo mark in v1; the wordmark is the brand.

Scale (rem; mobile → desktop via clamp):

```
--t-xs    0.6875 / 0.6875   labels, kickers, metadata (uppercase, +0.08em)
--t-sm    0.8125 / 0.8125   captions, takes, source lines
--t-base  1.0    / 1.0625   body
--t-lg    1.25   / 1.375    item headlines
--t-xl    1.75   / 2.25     page titles (section heads)
--t-2xl   2.5    / 4.0      Briefing lead, cover deck
--t-3xl   3.5    / 7.0      cover headline
```

Line-height: display 0.95–1.05; text 1.45; data 1.3. Max measure 64ch for body, 28ch for display.

### 1.3 Space, grid, rules

- Base unit 4px. Scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.
- Desktop grid: 12 columns, 24px gutter, max-width 1280px, 32px side padding. Mobile: 4 columns, 16px gutter, 20px side padding.
- Hairlines: 1px `--rule`. Section-head rule: 2px `--ink`. Rules separate; they never box (no four-sided borders on cards except the Most Covered table).
- Radius: 0 on everything except pills (999px) and images (2px). No shadows anywhere.

### 1.4 Motion

- Page transitions (mobile swipe): 240ms, `cubic-bezier(0.2, 0, 0, 1)`, translate only. No fades on content, no parallax.
- Progress segments: fill 200ms linear.
- Hover on desktop: underline-in 120ms for links; nothing moves.
- Respect `prefers-reduced-motion`: swipe becomes instant cut.

### 1.5 Imagery policy

No article photographs. Reasons: licence, inconsistency, and it is what every aggregator looks like. Instead:

1. **Typographic first.** Most pages carry no image; type and rules carry them.
2. **Cover**: one full-bleed image per issue — generated abstract/material imagery (soft colour fields, light, texture — cf. the A17.2 red blur and the Enfold stills), muted, never depicting people or products. Stored in `editions/<week>/cover.jpg`, 2000×2500 portrait + 2400×1350 landscape crop.
3. **Company logos**: official marks, monochrome `--ink` at ≤ 24px, only on Most Covered and Markets.
4. **Charts**: Markets and One Chart drawn in-house (SVG), 1.5px lines, `--ink` + one tint; axis labels in mono `--t-xs`.
5. **OG images**: generated per page from the template — paper ground, masthead, page kicker, headline. 1200×630.

## 2. Two renderers, one edition

The edition JSON renders two ways. Both are complete; neither is a fallback.

### 2.1 Mobile (< 768px): the deck

Full-viewport cards, one per template page, horizontal swipe + tap-right/tap-left, like Stories but with no auto-advance.

Card anatomy (top → bottom):
```
[progress: 11 hairline segments, filled = read, current = --ink, rest = --rule]   16px top safe area
[masthead row: "THE WEEKLY AI EDITION" --t-xs tracking+  ·  right: "№ 44 · Oct 25–31"]
[kicker: page name, --t-xs uppercase, --accent only on Cover]
[title: --t-xl Inter Tight 600]
[body: items list — see 3.x per page]            scrolls vertically inside the card if needed
[footer: source count for this page · page n/11]  bottom safe area
```
Items are stacked, separated by hairlines, each: headline (`--t-lg`), one-liner (`--t-base`), source line (`--t-sm --ink-2`, "Outlet · Mon 27"). A "take" when present is set in italics after an em-dash, same size as the one-liner.

Vertical overflow inside a card is allowed (it scrolls) but the schema caps items so the common case fits one viewport at 390×844.

Last card (Back Page) ends with a single row: "Hand this week to your agent → /2026-w44.md" in mono.

### 2.2 Desktop (≥ 768px): the front page

One long page per issue, newspaper-structured, scroll-driven, with a sticky thin top bar (masthead · issue · section links). Keyboard: `j/k` or arrow keys jump sections. `?` shows shortcuts.

Layout, top to bottom (12-col grid):

1. **Masthead band**: wordmark at `--t-2xl` centred, tagline below in `--t-xs` uppercase ("One link a week. Everything that mattered in AI."), date line left, "Issues" + "For agents" links right. 2px rule under.
2. **Cover**: cols 1–8 the cover image (4:5), cols 9–12 the headline stack: red kicker "№ 44", headline `--t-3xl`, deck `--t-lg --ink-2`.
3. **The Briefing**: cols 3–10, `--t-2xl` first sentence as a drop lead, remaining in `--t-lg`. Hairline above and below. This is the screenshot block; it is also the OG image for the issue root.
4. **Section band pattern** (used for Models, Performance, Launches, Funding, Deals, Discourse): heavy section head (`--t-xl` uppercase Inter Tight 700, 2px rule under it, like Fox) then items in a 3-column rule-separated grid (4 cols each), max 6 items → two rows. Item = headline / one-liner / source line, no image.
5. **Markets**: cols 1–7 the chart, cols 8–12 a mono table: ticker · close · Δ week with `--up/--down`. Caption below with data source.
6. **Most Covered**: 5-row table across cols 4–9 modelled on distribute's Tech Index: rank · logo · name · stories · trend arrow. Rules on all sides here (the one boxed element).
7. **Back page / footer**: three columns: Sources (count by outlet, mono), How this issue was made (3 lines), For agents (`.md`, `.json`, `llms.txt`, feed links in mono). Copyright line and licence.

Page density target: whole issue readable in ~4 minutes of scrolling. No sidebars, no "related", no infinite feed.

## 3. Per-page rules

| Page | Max items | Special |
|---|---|---|
| Cover | — | Only place for `--accent` on desktop; headline is the week's single most important item |
| Briefing | 5–7 sentences | No links inside; linked items appear on later pages |
| Models & Releases | 6 | Lab name as the source; version numbers in mono |
| Performance | 5 | Each item carries a number in mono (score, rank delta) |
| Launches | 6 | — |
| Funding | 6 | Format: **Company** raised **$Xm** Series B led by Lead — amounts in mono, right-aligned on desktop |
| Deals | 4 | Acquirer → target; amount if public, else "undisclosed" |
| Markets | 1 chart + ≤ 10 tickers | Basket fixed in config; week-over-week only |
| Discourse | 3 | Two sources minimum per item, framed as a question |
| Most Covered | 5 | Derived from our tagged items only |
| Back Page | — | Agent-access block always present |

## 4. Components (packages/ui)

`Masthead`, `IssueMeta`, `Kicker`, `SectionHead`, `Item`, `ItemList`, `Rule`, `Pill`, `MonoTable`, `TrendDelta`, `ProgressSegments`, `DeckCard`, `Deck`, `FrontPage`, `CoverImage`, `LineChart`, `AgentAccess`, `OgCard`. Each has a story in the kitchen-sink route rendering the fixture issue in both light and dark.

## 5. Accessibility and performance budgets

- WCAG AA contrast on all text; `--ink-3` is never used for text under 14px.
- Deck is fully operable by keyboard and screen reader (cards are `role="region"` with page name; progress is `aria-valuenow`).
- Lighthouse mobile ≥ 95 performance / 100 accessibility on the deck. Fonts self-hosted, subset, `font-display: swap`; cover image ≤ 180KB AVIF.
- No client JS on the front page except the sticky bar, keyboard nav, and chart hydration.

## 6. Don'ts

Gradients on UI. Shadows. Rounded cards. Icons as decoration. Stock photos of robots. Emoji. More than one accent. Skeleton loaders (the page is static). Carousels on desktop. Any "AI-generated" badge styling — the design should look like a newspaper made by people who care.

## 7. Decisions (locked 2026-10-28)

1. Desktop renderer: **front page** (§2.2). Spreads and desktop-deck rejected.
2. Masthead name: **The Weekly AI Edition**. Name is still a single config value (`site.name`) so a rename is one PR.
3. Type: **Inter Tight / Inter / Geist Mono**, self-hosted. Display face is a single token (`--font-display`) so it can be swapped from previews later.
4. Cover imagery: **generated abstract** per §1.5. The generation prompt + style constraints live in `STYLE.md`; the pipeline produces a candidate, the human approves it in the issue PR.
