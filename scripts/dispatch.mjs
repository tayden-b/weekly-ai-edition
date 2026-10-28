#!/usr/bin/env node
/**
 * Repo-as-state-machine dispatcher (HANDOFF.md §2, PLAN.md §7.2).
 *
 * Runs from .github/workflows/dispatch.yml on pull_request:closed,
 * issues:closed, workflow_dispatch, and an hourly cron. Deterministic,
 * no external dependencies — drives `gh` with the workflow's GITHUB_TOKEN.
 *
 * For every issue labelled `status:blocked` whose `depends_on` items are all
 * closed, swap `status:blocked` → `devin:ready`. When every dag item is
 * closed and no issue titled `v1-complete` exists, create it with labels
 * `devin:ready` + `wave:5` and the S1 brief.
 *
 * Items with `status: deferred` in dag.yaml (e.g. T3) are never promoted
 * and are not required for completion.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseDag } from "./lib/dag.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = process.env.GITHUB_REPOSITORY ?? "tayden-b/weekly-ai-edition";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

const dag = parseDag(readFileSync(resolve(root, "plan/dag.yaml"), "utf8"));
const items = dag.items;
const byId = new Map(items.map((item) => [item.id, item]));

const issues = JSON.parse(
  gh([
    "issue", "list", "--repo", repo, "--state", "all",
    "--limit", "500", "--json", "number,title,state,labels",
  ]),
);
const byNumber = new Map(issues.map((issue) => [issue.number, issue]));

const hasLabel = (issue, name) => issue.labels?.some((label) => label.name === name);
const isClosed = (issue) => issue?.state === "CLOSED";

function depClosed(depId) {
  const dep = byId.get(depId);
  if (!dep) return true; // unreachable — validate-dag.mjs guards this
  if (dep.status === "deferred") return true;
  if (!dep.issue) return false;
  return isClosed(byNumber.get(dep.issue));
}

let changes = 0;

// Promotion pass: blocked → ready when every dependency is closed.
for (const item of items) {
  if (item.status === "deferred" || !item.issue) continue;
  const issue = byNumber.get(item.issue);
  if (!issue || isClosed(issue) || !hasLabel(issue, "status:blocked")) continue;
  if (item.depends_on.every(depClosed)) {
    gh([
      "issue", "edit", String(item.issue), "--repo", repo,
      "--remove-label", "status:blocked", "--add-label", "devin:ready",
    ]);
    console.log(`dispatch: ${item.id} (#${item.issue}) → devin:ready`);
    changes += 1;
  }
}

// Completion pass: every non-deferred dag item closed → open v1-complete once.
const required = items.filter((item) => item.status !== "deferred" && item.issue);
const allClosed = required.length > 0 && required.every((item) => isClosed(byNumber.get(item.issue)));
const v1Exists = issues.some((issue) => issue.title === "v1-complete");

if (allClosed && !v1Exists) {
  const s1 = byId.get("S1");
  if (!s1) throw new Error("dag.yaml is missing the S1 item");
  const brief = readFileSync(resolve(root, s1.brief), "utf8");
  const acceptance = s1.acceptance.map((c) => `- [ ] ${c}`).join("\n");
  gh([
    "issue", "create", "--repo", repo,
    "--title", "v1-complete",
    "--label", "devin:ready",
    "--label", "wave:5",
    "--body", `${brief}\n\n## Acceptance\n\n${acceptance}\n`,
  ]);
  console.log("dispatch: created issue 'v1-complete' (devin:ready, wave:5)");
  changes += 1;
}

console.log(`dispatch: done — ${changes} change(s)`);
