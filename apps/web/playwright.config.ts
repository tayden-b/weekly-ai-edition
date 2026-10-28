import { defineConfig, devices } from "@playwright/test";

/**
 * I5 — Playwright smoke over the built app (DESIGN §5 / PLAN §7.2).
 * Two renderers of the same `/{issue}` route, one project each:
 *   mobile-deck    390×844, touch — the §2.1 swipe deck
 *   desktop-front  1440×900 — the §2.2 newspaper front page
 * Runs against `next start` — `pnpm build` first (CI does; locally:
 * `pnpm --filter @weekly/web build && pnpm --filter @weekly/web test:e2e`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  ...(process.env.CI ? { retries: 1, workers: 2 } : {}),
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-deck",
      use: {
        ...devices["Pixel 7"],
        // DESIGN §2.1's design point, not Pixel 7's 412×915.
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "desktop-front",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3000/2026-w44",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
