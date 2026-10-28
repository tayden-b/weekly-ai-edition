# lab-blogs adapter — licence & ToS note (A1)

Scope: this adapter ingests **public** lab blogs and news indexes for the
Models & Releases page (PLAN §5.1). It exists to collect *evidence of
publication* — never article content.

## What we store (all sources)

Per `RawItem` / §5.1 rules, and nothing else:

- `headline` — the publisher's title, verbatim.
- `canonical_url` — link to the publisher's page.
- `publisher` — display name of the lab.
- `published_at` — the publisher's own timestamp (`pubDate`, `lastmod`,
  or the date rendered on the index card/sidebar).
- `fetched_at` — our fetch timestamp.
- `excerpt` — at most 300 chars of the publisher's own summary text,
  truncated at a word boundary (`EXCERPT_MAX_CHARS`). Where the source has
  no summary (e.g. DeepMind/HF items, sitemap entries), the excerpt is the
  headline itself.
- `source_ids` — the feed `guid`/`id` or the URL slug.

We **never** store or republish article bodies. `content:encoded` /
`content` bodies in RSS items are never read. The adapter keeps only what
is listed above; full posts live at the publisher and are linked, not copied.

## Access posture per source

| Source | Transport | Terms posture |
| --- | --- | --- |
| OpenAI | `openai.com/news/rss.xml` (RSS) | Public feed, published for syndication. Headline/link/excerpt only. |
| Anthropic | `anthropic.com/sitemap.xml` (urlset) | No public RSS (verified 2026-10). Sitemap discovery of `/news/` + `/research/` pages; headline+link only; `published_at` = `lastmod`. |
| Google DeepMind | `deepmind.google/blog/rss.xml` (RSS) | Public feed. Items carry no `description` — excerpt falls back to headline. |
| Google AI | `blog.google/.../ai/rss/` (RSS) | Public feed; entity-encoded descriptions are decoded for the excerpt. |
| Meta AI | `ai.meta.com/blog/` (HTML index) | No public feed/sitemap; card anchors on the public index give title+date. Headline+link only. |
| Mistral AI | `mistral.ai/sitemap.xml` (sitemapindex) | No public feed; child urlset scoped to `/news/`; `published_at` = `lastmod`. |
| xAI | `x.ai/news` (HTML index) | No feed/sitemap; index cards give title+blurb+date. Live endpoint is Cloudflare-gated (HTTP 403 verified 2026-10): the adapter backs off and degrades — the fixture slice is verbatim x.ai markup fetched via the Wayback Machine (capture 2026-10-22) so the parser stays proven while live access is blocked. |
| Microsoft Research | `microsoft.com/en-us/research/feed/` (RSS) | Public feed; `content:encoded` bodies ignored. |
| Amazon Science | `amazon.science/index.rss` (RSS) | Public feed; `content:encoded` bodies ignored. |
| Moonshot AI (Kimi) | `kimi.com/en/blog/` (HTML index) | No feed; `moonshot.cn/news` is a JS shell, so the server-rendered EN research blog index (aria-label title + ISO date) is the scrape target. Headline+link only. |
| DeepSeek | `api-docs.deepseek.com/news/` (HTML index) | No feed; docs-site news pages carry a full sidebar of dated post links (`Title YYYY/MM/DD`); root page is followed to the latest news page via `meta.follow_first`. Headline+link only. |
| Alibaba Qwen | `qwenlm.github.io/en/sitemap.xml` (urlset) | No feed; `qwen.ai` is an SPA. EN GitHub-Pages sitemap scoped to `/blog/`; `published_at` = `lastmod`. |
| Hugging Face | `huggingface.co/blog/feed.xml` (RSS) | Public feed. Items carry no `description` — excerpt falls back to headline. |

## Rate limits

All sources: **≤1 request/second per host** courtesy gap (enforced in
`fetch()`), single GET per endpoint (plus one child-sitemap fetch per
sitemapindex, and one follow for `meta.follow_first`), project User-Agent
`weekly-ai-edition/0 (+https://github.com/tayden-b/weekly-ai-edition)` on
every request, per-request timeout, no retries on 403/404 — the source is
reported unhealthy and the page degrades, the run never does.
