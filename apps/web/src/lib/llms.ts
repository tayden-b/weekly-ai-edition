/**
 * llms.txt builders (T2, PLAN §4 — llmstxt.org convention): a site map for
 * agents at `/llms.txt`, and the latest issue flattened into one document at
 * `/llms-full.txt` (all pages + the sources list). Pure string builders fed
 * by `listEditions()` — both artifacts regenerate from `editions/` at build.
 */
import { pageDropped } from "@weekly/schema";
import type {
  Edition,
  EditionPage,
  EditionSource,
} from "@weekly/schema";

import { DECK_PAGE_NAMES, type SectionItem } from "./deck";
import { dateRangeLabel } from "./fixture";
import { site } from "./site";

function cover(edition: Edition) {
  const page = edition.pages.find((p) => p.type === "cover");
  return page && page.type === "cover" ? page : undefined;
}

function rangeLabel(edition: Edition): string {
  return `${dateRangeLabel(edition.date_start, edition.date_end)}, ${edition.date_end.slice(0, 4)}`;
}

/** `№ 2 · Oct 31–Nov 6: <cover headline>` — the feed/llms listing line. */
function editionLabel(edition: Edition): string {
  return `№ ${edition.issue_number} · ${dateRangeLabel(edition.date_start, edition.date_end)}: ${cover(edition)?.headline ?? edition.id}`;
}

/**
 * `/llms.txt` (llmstxt.org): H1 + blockquote summary, then H2 sections of
 * markdown link lists — what the product is, where the `/{issue}.md` and
 * `/{issue}.json` twins live, the latest issue, the archive, and the feeds.
 */
export function llmsTxt(editions: Edition[]): string {
  const latest = editions[0];
  const lines: string[] = [
    `# ${site.name}`,
    ``,
    `> ${site.tagline} A weekly, print-style briefing — the week's models, benchmarks, launches, funding, deals, markets and discourse — rendered as a swipeable deck on mobile and a newspaper front page on desktop, with a machine-readable twin of every issue for agents.`,
    ``,
    `Editions ship weekly (Saturday→Friday coverage). Each issue lives at \`/{issue}\` with agent twins at \`/{issue}.md\` (Markdown) and \`/{issue}.json\` (the canonical edition object). \`/llms-full.txt\` flattens the latest issue — every page plus its sources — into one document.`,
    ``,
  ];
  if (latest) {
    lines.push(
      `## Latest issue`,
      ``,
      `- [${editionLabel(latest)}](/${latest.id}): the rendered edition`,
      `- [${latest.id}.md](/${latest.id}.md): Markdown twin — briefing and every item, no chrome`,
      `- [${latest.id}.json](/${latest.id}.json): the canonical edition object`,
      `- [Latest issue in one document](/llms-full.txt): all pages + the sources list`,
      ``,
    );
  }
  lines.push(
    `## Editions`,
    ``,
    `- [Issues archive](/issues): every edition, newest first`,
    ...editions.map(
      (ed) => `- [${ed.id}](/${ed.id}): ${editionLabel(ed)}`,
    ),
    ``,
    `## Feeds`,
    ``,
    `- [RSS 2.0](/feed.xml): one entry per edition — the subscription mechanism`,
    `- [JSON Feed](/feed.json): one entry per edition`,
    ``,
  );
  return lines.join("\n");
}

function sourceLine(s: EditionSource): string {
  const published = s.published_at.slice(0, 10);
  return `- [${s.publisher}](${s.url}) — ${published}`;
}

function sourcesBlock(sources: readonly EditionSource[]): string[] {
  return [`Sources:`, ...sources.map(sourceLine)];
}

function itemLines(item: SectionItem): string[] {
  const lines = [`### ${item.headline}`, ``, item.one_liner];
  if (item.take) lines[2] += ` — ${item.take}`;
  // Same mono-slot rule as the renderers (deck.ts mapItem): number, then
  // amount, then "undisclosed" on deals.
  const mono =
    ("number" in item ? item.number : undefined) ??
    ("amount" in item ? item.amount : undefined);
  if ("acquirer" in item && "target" in item) {
    lines.push(
      ``,
      `${item.acquirer} → ${item.target} · ${mono ?? "undisclosed"}`,
    );
  } else {
    let facts = "";
    if ("stage" in item && item.stage) facts += ` · ${item.stage}`;
    if ("lead" in item && item.lead) facts += ` · led by ${item.lead}`;
    if (mono) lines.push(``, `${mono}${facts}`);
  }
  lines.push(``, ...sourcesBlock(item.sources), ``);
  return lines;
}

function pageLines(page: EditionPage): string[] {
  const head = `## ${DECK_PAGE_NAMES[page.type]}`;
  switch (page.type) {
    case "cover":
      return [head, ``, `### ${page.headline}`, ``, ...(page.deck ? [page.deck, ``] : [``])];
    case "briefing":
      return [head, ``, ...page.sentences, ``];
    case "markets": {
      const lines = [
        head,
        ``,
        `**${page.chart.title}** (${page.chart.unit})`,
        ``,
        ...page.chart.series.map((p) => `- ${p.date}: ${p.value}`),
        ``,
        `Tickers:`,
        ...page.tickers.map(
          (t) =>
            `- ${t.ticker} (${t.name}): ${t.close} — ${t.change_pct}% week over week`,
        ),
        ``,
        ...sourcesBlock(page.sources),
        ``,
      ];
      return lines;
    }
    case "most_covered":
      return [
        head,
        ``,
        ...page.entries.map(
          (e, i) =>
            `${i + 1}. ${e.name} — ${e.stories} ${e.stories === 1 ? "story" : "stories"} (${e.trend})`,
        ),
        ``,
      ];
    case "back_page": {
      const lines = [
        head,
        ``,
        `${page.sources_total} fetched source records this week.`,
        ``,
        ...page.source_counts.map((c) => `- ${c.publisher}: ${c.count}`),
        ``,
        `### How this issue was made`,
        ``,
        page.how_made,
      ];
      if (page.colophon) lines.push(``, page.colophon);
      lines.push(``);
      return lines;
    }
    default:
      // models, performance, launches, funding, deals, discourse
      return [head, ``, ...page.items.flatMap(itemLines)];
  }
}

/**
 * `/llms-full.txt`: the latest issue's full content in one document — every
 * page's rendered content plus each item's source list. Twins derive from the
 * edition id, never `agent_links` (they're the same contract, `/{issue}.md`).
 */
export function llmsFullTxt(edition: Edition): string {
  const lines = [
    `# ${site.name} № ${edition.issue_number} — ${rangeLabel(edition)}`,
    ``,
    `> The complete latest issue of ${site.name} — ${site.tagline} Flattened into a single document for agents. Canonical twins: [${edition.id}.md](/${edition.id}.md) (Markdown) and [${edition.id}.json](/${edition.id}.json) (the edition object).`,
    ``,
    ...edition.pages.filter((p) => !pageDropped(p)).flatMap(pageLines),
    `## Agent access`,
    ``,
    `- [${edition.id}.md](/${edition.id}.md): this issue as Markdown`,
    `- [${edition.id}.json](/${edition.id}.json): this issue as JSON`,
    `- [llms.txt](/llms.txt): the site map for agents`,
    `- [RSS 2.0](/feed.xml) / [JSON Feed](/feed.json): one entry per edition`,
    ``,
  ];
  return lines.join("\n");
}
