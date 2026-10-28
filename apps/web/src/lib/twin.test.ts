import { describe, expect, it } from "vitest";

import { editionToMarkdown, prefersMarkdown } from "./twin";
import { getEdition, getEditionRaw, listEditions } from "./editions";

const edition = getEdition("2026-w44")!;
const md = editionToMarkdown(edition);

describe("editionToMarkdown (the /{issue}.md twin)", () => {
  it("leads with YAML frontmatter carrying the issue id, range, pages, counts", () => {
    const frontmatter = md.slice(0, md.indexOf("---\n\n") + 4);
    expect(md.startsWith("---\n")).toBe(true);
    expect(frontmatter).toContain("id: 2026-w44");
    expect(frontmatter).toContain("issue_number: 1");
    expect(frontmatter).toContain("date_start: 2026-10-24");
    expect(frontmatter).toContain("date_end: 2026-10-30");
    for (const type of edition.pages.map((p) => p.type)) {
      expect(frontmatter).toContain(`  - ${type}`);
    }
    expect(frontmatter).toContain("sources_total: 34");
    expect(frontmatter).toContain('"Exa Markets": 8');
    expect(frontmatter).toContain("markdown: /2026-w44.md");
    expect(frontmatter).toContain("json: /2026-w44.json");
  });

  it("carries the cover headline, the deck, and every briefing sentence", () => {
    expect(md).toContain(
      "# Two labs claim the death of the Exponential Time Hypothesis",
    );
    expect(md).toContain("Outside reviewers are now checking the proofs.");
    for (const sentence of edition.pages[1].sentences) {
      expect(md).toContain(sentence);
    }
  });

  it("renders every page's items with numbers, takes, sources and evidence", () => {
    for (const page of edition.pages) {
      if (!("items" in page) || !page.items) continue;
      for (const item of page.items) {
        expect(md).toContain(`### ${item.headline}`);
        expect(md).toContain(item.one_liner);
      }
    }
    // numbered item: mono value + the §5.3 evidence quote
    expect(md).toContain("**`50.3%`**");
    expect(md).toContain(
      'Evidence: "scores 50.3% on Terminal-Bench 4.0 at max effort"',
    );
    // funding item: amount + stage + lead
    expect(md).toContain("**`$1.5B`** · Series E · led by Innovation X");
    // deal without an amount → undisclosed
    expect(md).toContain("**`undisclosed`**");
    // take rendered as a blockquote
    expect(md).toContain("> The price cut, not the benchmark, is the story.");
    // sources rendered as markdown links
    expect(md).toContain(
      "[AI Lately](https://ailately.com/rn/2026-10-27-12)",
    );
  });

  it("renders markets, most-covered and back-page sections without chrome", () => {
    expect(md).toContain("## Markets");
    expect(md).toContain("| NVDA | NVIDIA | 217.94 | +3.31% |");
    expect(md).toContain("## Most Covered");
    expect(md).toContain("1. **OpenAI** (`openai`) — 3 stories, trending up");
    expect(md).toContain("## Back Page");
    expect(md).toContain("| Exa Markets | 8 |");
    expect(md).toContain("- Markdown: /2026-w44.md");
    // no nav / site chrome: the document is headings + markdown links only
    expect(md).not.toMatch(/<\/?(nav|main|header|footer|a)\b/);
    expect(md).not.toContain("/issues");
  });

  it("ends with a trailing newline", () => {
    expect(md.endsWith("\n")).toBe(true);
  });
});

describe("getEditionRaw (the /{issue}.json twin)", () => {
  it("returns the exact edition object bytes for each edition on disk", () => {
    for (const ed of listEditions()) {
      const raw = getEditionRaw(ed.id);
      expect(raw).toBeDefined();
      expect(JSON.parse(raw!)).toEqual(ed);
    }
  });

  it("is undefined for missing or malformed ids", () => {
    expect(getEditionRaw("2026-w99")).toBeUndefined();
    expect(getEditionRaw("not-a-week")).toBeUndefined();
  });
});

describe("prefersMarkdown (Accept negotiation on /{issue})", () => {
  it("is true for an explicit text/markdown request", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("TEXT/MARKDOWN")).toBe(true);
    expect(prefersMarkdown("text/markdown;q=0.8")).toBe(true);
  });

  it("is false for browsers, */*, and absent headers", () => {
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown("*/*")).toBe(false);
    expect(prefersMarkdown("")).toBe(false);
    expect(
      prefersMarkdown(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ),
    ).toBe(false);
  });

  it("honours q-values in both directions", () => {
    expect(prefersMarkdown("text/html;q=1, text/markdown;q=0.4")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0.9, text/html;q=0.4")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/markdown;q=0")).toBe(false);
    expect(prefersMarkdown("text/markdown;q=0.5, */*;q=0.8")).toBe(false);
  });
});
