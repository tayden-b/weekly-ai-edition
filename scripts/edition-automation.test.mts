/**
 * I2 guards: the Weekly Edition shipping machinery stays consistent —
 * the versioned session prompt, the Sunday publish workflow + script, and
 * the manual dry-run workflow. These are contract checks on the repo's own
 * automation files (the pieces a Saturday session and the publish cron rely
 * on), not tests of GitHub's or Devin's behaviour.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const PROMPT = "plan/weekly-edition-prompt.md";
const PUBLISH_YML = ".github/workflows/edition-publish.yml";
const PUBLISH_MJS = "scripts/edition-publish.mjs";
const DRY_RUN_YML = ".github/workflows/edition-dry-run.yml";

describe("plan/weekly-edition-prompt.md — the versioned session prompt", () => {
  const prompt = read(PROMPT);

  it("drives the real build in session mode over the committed cache", () => {
    expect(prompt).toContain("pnpm edition:build");
    expect(prompt).toContain("--mode session");
    expect(prompt).toContain("--ingest cache");
  });

  it("uses the edition PR conventions (devin/edition-<week> branch, edition label, no Closes)", () => {
    expect(prompt).toContain("devin/edition-");
    expect(prompt).toContain("`edition`");
    expect(prompt).toMatch(/no `?Closes/i);
  });

  it("leaves publishing to the Sunday workflow (never arms auto-merge itself)", () => {
    expect(prompt).toContain("edition-publish");
    expect(prompt).toMatch(/do NOT arm auto-merge/i);
  });
});

describe("edition-publish — Sunday 17:00 ET publish step", () => {
  const yml = read(PUBLISH_YML);
  const script = read(PUBLISH_MJS);

  it("books both UTC slots so 17:00 ET survives the EST/EDT shift", () => {
    expect(yml).toContain('cron: "0 21 * * 0"');
    expect(yml).toContain('cron: "0 22 * * 0"');
    expect(script).toContain("America/New_York");
    expect(script).toContain('"17"');
  });

  it("is manually dispatchable for dry runs", () => {
    expect(yml).toContain("workflow_dispatch");
    expect(yml).toContain("DRY_RUN");
  });

  it("targets edition-labelled PRs and merges via auto-merge (squash)", () => {
    expect(script).toContain('"--label", "edition"');
    expect(script).toContain('"--auto", "--squash"');
    expect(script).toContain("autoMergeRequest");
  });

  it("refuses to arm a failing edition PR", () => {
    expect(script).toContain("checks.failing.length > 0");
  });
});

describe("edition-dry-run — manual replay proof", () => {
  const yml = read(DRY_RUN_YML);

  it("is workflow_dispatch-only and replays deterministically", () => {
    expect(yml).toContain("workflow_dispatch");
    expect(yml).toContain("--mode replay");
    expect(yml).toContain("--ingest cache");
    expect(yml).toContain("git status --porcelain");
  });
});

describe("docs", () => {
  it("the mechanism is documented", () => {
    const doc = read("docs/weekly-edition.md");
    expect(doc).toContain("Sunday 17:00 ET");
    expect(doc).toContain("auto-merge");
    expect(doc).toContain("`edition`");
    expect(read("docs/adr/0011-weekly-edition-automation.md")).toContain("Weekly Edition");
  });
});
