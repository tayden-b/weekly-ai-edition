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
