#!/usr/bin/env node
/**
 * edition-publish — the Sunday 17:00 ET publish step (PLAN §5.2, ADR-0003,
 * docs/weekly-edition.md).
 *
 * The Weekly Edition automation's Saturday session opens the edition PR
 * (branch `devin/edition-<week>`, label `edition`, no `Closes`). This script —
 * run by .github/workflows/edition-publish.yml — publishes it by arming
 * `gh pr merge --auto --squash`: a green PR merges to `main`, Vercel deploys,
 * and that merge IS the publish. Deterministic, no LLM, gh + GITHUB_TOKEN
 * only — same model as scripts/dispatch.mjs.
 *
 * Env:
 *   EVENT_NAME  `schedule` | `workflow_dispatch` (workflow passes it through)
 *   DRY_RUN     "true" → report decisions only, never arm or comment
 *   GH_TOKEN    token for `gh`
 *
 * Cron gating: GitHub cron is UTC-only, so the workflow books both 21:00 and
 * 22:00 UTC Sundays; this gate admits only the run landing at 17:00 in
 * America/New_York (handles EST/EDT without workflow edits).
 *
 * Decisions per open `edition` PR:
 *   green   → arm auto-merge (merges immediately — that is the publish)
 *   pending → arm auto-merge (GitHub merges it the moment checks go green)
 *   failing → do NOT arm; comment the failing checks (Supervisor's domain)
 *   already armed → no-op
 */
import { execFileSync } from "node:child_process";

const repo = process.env.GITHUB_REPOSITORY ?? "tayden-b/weekly-ai-edition";
const dryRun = /^(1|true|yes)$/i.test(process.env.DRY_RUN ?? "");
const onCron = process.env.EVENT_NAME === "schedule";

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

// --- ET gate ---------------------------------------------------------------

if (onCron) {
  const etHour = execFileSync("date", ["+%H"], {
    encoding: "utf8",
    env: { ...process.env, TZ: "America/New_York" },
  }).trim();
  if (etHour !== "17") {
    console.log(
      `edition-publish: ${etHour}:00 ET — not the publish hour; the other UTC slot covers this Sunday`,
    );
    process.exit(0);
  }
}

// --- find the open edition PR ----------------------------------------------

const prs = JSON.parse(
  gh([
    "pr", "list", "--repo", repo, "--state", "open", "--label", "edition",
    "--json", "number,title,url,headRefName,mergeStateStatus,statusCheckRollup,autoMergeRequest",
  ]),
);

if (prs.length === 0) {
  console.log("edition-publish: no open PR labelled `edition` — nothing to publish");
  process.exit(0);
}

/** Rollup → {pending, failing, passing} check-name lists. Check runs carry
 * status/conclusion; legacy contexts carry state. */
function rollup(pr) {
  const out = { pending: [], failing: [], passing: [] };
  for (const c of pr.statusCheckRollup ?? []) {
    const name = c.name ?? c.context ?? "unknown";
    if (c.conclusion !== undefined && c.conclusion !== null) {
      // completed check run
      if (["SUCCESS", "NEUTRAL", "SKIPPED"].includes(c.conclusion)) out.passing.push(name);
      else out.failing.push(`${name} (${c.conclusion})`);
    } else if (c.status !== undefined && c.status !== null) {
      if (c.status === "COMPLETED") out.passing.push(name);
      else out.pending.push(name);
    } else if (c.state !== undefined) {
      // commit status context
      if (c.state === "SUCCESS") out.passing.push(name);
      else if (["FAILURE", "ERROR"].includes(c.state)) out.failing.push(`${name} (${c.state})`);
      else out.pending.push(name);
    }
  }
  return out;
}

let failures = 0;
for (const pr of prs) {
  const checks = rollup(pr);
  console.log(
    `edition-publish: PR #${pr.number} "${pr.title}" (${pr.headRefName}) ` +
      `mergeState=${pr.mergeStateStatus} — ${checks.passing.length} green, ` +
      `${checks.pending.length} pending, ${checks.failing.length} failing`,
  );

  if (pr.autoMergeRequest) {
    console.log(`  auto-merge already armed — no-op`);
    continue;
  }

  if (checks.failing.length > 0) {
    console.log(`  FAILING checks: ${checks.failing.join(", ")} — not arming`);
    if (!dryRun) {
      try {
        gh([
          "pr", "comment", String(pr.number), "--repo", repo, "--body",
          `edition-publish (Sunday 17:00 ET): auto-merge NOT armed — ` +
            `failing checks: ${checks.failing.join(", ")}. ` +
            `Publish is skipped until the PR is green; the Supervisor audit picks this up.`,
        ]);
      } catch {
        console.warn(`  could not post the failure comment`);
      }
    }
    failures += 1;
    continue;
  }

  if (dryRun) {
    console.log(
      `  DRY RUN — would arm auto-merge (squash) on ${pr.url}` +
        (checks.pending.length > 0 ? ` with ${checks.pending.length} check(s) still pending` : ""),
    );
    continue;
  }

  try {
    gh(["pr", "merge", String(pr.number), "--repo", repo, "--auto", "--squash"]);
    console.log(
      `  auto-merge armed on ${pr.url}` +
        (checks.pending.length > 0
          ? ` — merges when the pending check(s) go green`
          : ` — green: merging now; merge to main + Vercel deploy = published`),
    );
  } catch {
    console.error(`  gh pr merge --auto failed for #${pr.number}`);
    failures += 1;
  }
}

process.exit(failures > 0 ? 1 : 0);
