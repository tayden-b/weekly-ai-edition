/**
 * T1 agent twin (PLAN §4) — renders a canonical `Edition` as `/{issue}.md`:
 * YAML frontmatter (id, date range, page list, source counts) + the full
 * briefing + every page's items in clean Markdown, no nav chrome. Also the
 * `Accept: text/markdown` negotiation used by `src/proxy.ts` on `/{issue}`.
 */
import { pageDropped, primarySource } from "@weekly/schema";
import type {
  Edition,
  EditionBackPage,
  EditionItem,
  EditionItemDeal,
  EditionItemDiscourse,
  EditionItemFunding,
  EditionItemNumbered,
  EditionMarketsPage,
  EditionPage,
  EditionSource,
} from "@weekly/schema";

import { dateRangeLabel, SECTION_TITLES } from "./fixture";
import { site } from "./site";

type TwinItem =
  | EditionItem
  | EditionItemNumbered
  | EditionItemFunding
  | EditionItemDeal
  | EditionItemDiscourse;

const PAGE_TITLES: Record<string, string> = {
  briefing: "The Briefing",
  ...SECTION_TITLES,
  markets: "Markets",
  most_covered: "Most Covered",
  back_page: "Back Page",
};

/** YAML double-quoted scalar — `JSON.stringify` escapes are valid YAML 1.2. */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** Escape the characters that would break `[text](url)` syntax. */
function mdLinkText(value: string): string {
  return value.replace(/([\\\]])/g, "\\$1");
}

function sourceLink(s: EditionSource): string {
  const via = s.via ? ` (via ${s.via})` : "";
  return `[${mdLinkText(s.publisher)}](${s.url})${via}`;
}

/** "Evidence: "quote" — Publisher" for §5.3 provenance in the twin. */
function evidenceLine(
  evidence: { source_index: number; quote: string } | undefined,
  sources: EditionSource[],
): string | undefined {
  if (!evidence) return undefined;
  const source = sources[evidence.source_index];
  const origin = source ? ` — ${source.publisher}` : "";
  return `Evidence: "${evidence.quote}"${origin}`;
}

/** The mono slot, per renderer rules: number → amount → "undisclosed" (deals). */
function itemNumber(item: TwinItem, pageType: string): string | undefined {
  if ("number" in item && item.number) return item.number;
  if ("amount" in item && item.amount) return item.amount;
  return pageType === "deals" ? "undisclosed" : undefined;
}

function itemBlock(item: TwinItem, pageType: string): string {
  // L1: every headline links to the story's primary source.
  const primary = primarySource(item.sources);
  const headline = primary
    ? `### [${mdLinkText(item.headline)}](${primary.url})`
    : `### ${item.headline}`;
  const lines: string[] = [headline, ""];

  const meta: string[] = [];
  const number = itemNumber(item, pageType);
  if (number) meta.push(`**\`${number}\`**`);
  if ("stage" in item && item.stage) meta.push(item.stage);
  if ("lead" in item && item.lead) meta.push(`led by ${item.lead}`);
  if (meta.length > 0) lines.push(meta.join(" · "), "");

  lines.push(item.one_liner, "");
  if ("take" in item && item.take) lines.push(`> ${item.take}`, "");

  const evidence = evidenceLine(
    "evidence" in item ? item.evidence : undefined,
    item.sources,
  );
  if (evidence) lines.push(evidence, "");

  if ("companies" in item && item.companies && item.companies.length > 0) {
    lines.push(
      `Companies: ${item.companies.map((c) => `\`${c}\``).join(" ")}`,
      "",
    );
  }

  lines.push(`Sources: ${item.sources.map(sourceLink).join(" · ")}`);
  return lines.join("\n");
}

function itemsBlock(page: EditionPage): string {
  const title = PAGE_TITLES[page.type] ?? page.type;
  if (!("items" in page) || !page.items) return `## ${title}`;
  const items = (page.items as TwinItem[]).map((i) => itemBlock(i, page.type));
  return [`## ${title}`, "", items.join("\n\n")].join("\n");
}

function marketsBlock(page: EditionMarketsPage): string {
  const lines: string[] = [
    `## Markets`,
    "",
    `**${page.chart.title}** (${page.chart.unit})`,
    "",
    "| Date | Value |",
    "| --- | ---: |",
    ...page.chart.series.map((p) => `| ${p.date} | ${p.value} |`),
    "",
    "| Ticker | Name | Close | WoW |",
    "| --- | --- | ---: | ---: |",
    ...page.tickers.map((t) => {
      const delta = t.change_pct > 0 ? `+${t.change_pct}` : `${t.change_pct}`;
      return `| ${t.ticker} | ${t.name} | ${t.close} | ${delta}% |`;
    }),
  ];

  const evidence = page.tickers
    .map((t) =>
      evidenceLine(t.evidence, page.sources)?.replace(
        /^Evidence:/,
        `${t.ticker}:`,
      ),
    )
    .filter((l): l is string => l !== undefined);
  if (evidence.length > 0) lines.push("", ...evidence.map((l) => `- ${l}`));

  const publishers = [...new Set(page.sources.map((s) => s.publisher))];
  lines.push(
    "",
    `Data: ${publishers.join(" · ")}`,
    "",
    `Sources: ${page.sources.map(sourceLink).join(" · ")}`,
  );
  return lines.join("\n");
}

function mostCoveredBlock(page: EditionPage): string {
  const lines = [`## ${PAGE_TITLES["most_covered"]}`, ""];
  if (page.type === "most_covered") {
    lines.push(
      ...page.entries.map(
        (e, i) =>
          `${i + 1}. **${e.name}** (\`${e.company}\`) — ${e.stories} ${
            e.stories === 1 ? "story" : "stories"
          }, trending ${e.trend}`,
      ),
    );
  }
  return lines.join("\n");
}

function backPageBlock(page: EditionBackPage): string {
  const lines: string[] = [
    `## ${PAGE_TITLES["back_page"]}`,
    "",
    "**Sources**",
    "",
    "| Outlet | Items |",
    "| --- | ---: |",
    ...page.source_counts.map((c) => `| ${c.publisher} | ${c.count} |`),
    "",
    `${page.sources_total} fetched source records this week.`,
    "",
    "**How this issue was made**",
    "",
    page.how_made,
    "",
    "**For agents**",
    "",
    `- Markdown: ${page.agent_links.markdown}`,
    `- JSON: ${page.agent_links.json}`,
    `- llms.txt: ${page.agent_links.llms_txt}`,
    `- Feed: ${page.agent_links.feed}`,
  ];
  if (page.colophon) lines.push("", page.colophon);
  return lines.join("\n");
}

/** YAML frontmatter: issue id, date range, page list, source counts (T1). */
function frontmatter(ed: Edition, backPage: EditionBackPage): string {
  const lines: string[] = [
    "---",
    `id: ${ed.id}`,
    `schema_version: ${ed.schema_version}`,
    `issue_number: ${ed.issue_number}`,
    `title: ${yamlString(ed.pages[0].headline)}`,
    `date_start: ${ed.date_start}`,
    `date_end: ${ed.date_end}`,
    "pages:",
    ...ed.pages.filter((p) => !pageDropped(p)).map((p) => `  - ${p.type}`),
    `sources_total: ${backPage.sources_total}`,
    "source_counts:",
    ...backPage.source_counts.map(
      (c) => `  ${yamlString(c.publisher)}: ${c.count}`,
    ),
    `markdown: ${backPage.agent_links.markdown}`,
    `json: ${backPage.agent_links.json}`,
    "---",
  ];
  return lines.join("\n");
}

/**
 * The `/{issue}.md` document: frontmatter + cover headline + full briefing +
 * every page's items. No navigation, no site chrome — one URL hands an agent
 * the whole week (PLAN §4).
 */
export function editionToMarkdown(ed: Edition): string {
  const [cover] = ed.pages;
  const backPage = ed.pages[10];

  const doc: string[] = [
    frontmatter(ed, backPage),
    "",
    cover.url !== undefined
      ? `# [${mdLinkText(cover.headline)}](${cover.url})`
      : `# ${cover.headline}`,
    "",
    `*${site.name} · № ${ed.issue_number} · ${dateRangeLabel(
      ed.date_start,
      ed.date_end,
    )} (${ed.date_start} → ${ed.date_end})*`,
  ];
  if (cover.deck) doc.push("", cover.deck);

  for (const page of ed.pages.slice(1)) {
    if (pageDropped(page)) continue;
    doc.push("", pageBlock(page));
  }
  return `${doc.join("\n")}\n`;
}

function pageBlock(page: EditionPage): string {
  switch (page.type) {
    case "briefing":
      return [`## ${PAGE_TITLES["briefing"]}`, "", ...page.sentences].join(
        "\n",
      );
    case "markets":
      return marketsBlock(page);
    case "most_covered":
      return mostCoveredBlock(page);
    case "back_page":
      return backPageBlock(page);
    default:
      return itemsBlock(page);
  }
}

/**
 * Content negotiation for `/{issue}`: true when `text/markdown` is requested
 * at least as strongly as HTML — `Accept: text/markdown` (curl) wins, a
 * browser's html-first header never does.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  let markdown = 0;
  let html = 0;
  for (const entry of accept.split(",")) {
    const [type, ...params] = entry.split(";").map((s) => s.trim());
    const qParam = params.find((p) => p.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) || 0 : 1;
    const media = type!.toLowerCase();
    if (media === "text/markdown") markdown = Math.max(markdown, q);
    else if (
      media === "text/html" ||
      media === "application/xhtml+xml" ||
      media === "text/*" ||
      media === "*/*"
    ) {
      html = Math.max(html, q);
    }
  }
  return markdown > 0 && markdown >= html;
}
