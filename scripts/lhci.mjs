/**
 * `pnpm lhci` — Lighthouse CI over the built app (I5 / DESIGN §5 / PLAN §7.2).
 * Points @lhci/cli at the Chromium Playwright already installs (no second
 * browser download), then runs `lhci autorun` — collect → assert budgets →
 * write .lhci/ reports. Needs `pnpm build` first (CI runs it; the lhci config
 * starts `next start` itself).
 */
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const WEB = path.join(ROOT, "apps/web");

const chromePath = execFileSync(
  "pnpm",
  [
    "--filter",
    "@weekly/web",
    "exec",
    "node",
    "-e",
    "process.stdout.write(require('@playwright/test').chromium.executablePath())",
  ],
  { cwd: ROOT, encoding: "utf8" },
).trim();

const env = { ...process.env, CHROME_PATH: chromePath };
const lhci = (...args) =>
  spawnSync("pnpm", ["--filter", "@weekly/web", "exec", "lhci", ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env,
  }).status;

// @lhci/cli cannot assert a budgets file and score assertions in one pass,
// so: autorun = collect + assert(resource budgets in budget.json) + upload
// .lhci reports, then a second assert pass for the §5 score gates.
//
// numberOfRuns=7 (was 3→5, #95): the §5 score gate is `minScore` — LHCI's
// default aggregation for it is OPTIMISTIC (best run must hit ≥0.95).
// On a noisy shared GHA runner a whole batch can land at 0.90–0.93 even
// though the page sits at ~0.95+ (local medians ~0.96–0.98 after the
// fragment-split + browserslist fixes); more runs cut the all-miss
// probability without touching the 0.95 bar — the issue's sanctioned
// "raise run count" fix, not a threshold relaxation.
const first = lhci(
  "autorun",
  `--config=${path.join(WEB, "lighthouserc.json")}`,
);
if (first !== 0) process.exit(first ?? 1);

const second = lhci(
  "assert",
  `--config=${path.join(WEB, "lighthouserc.scores.json")}`,
);
process.exit(second ?? 1);
