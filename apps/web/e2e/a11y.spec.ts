import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * §5 axe gate — the main routes must carry zero critical/serious axe
 * violations in BOTH renderers (each spec runs once per project). The two
 * edition routes are held to a full clean sweep: the Lighthouse a11y-100
 * budget on the deck counts every violation, not just serious ones.
 */

const ROUTES: { path: string; label: string; strict: boolean }[] = [
  { path: "/2026-w44", label: "fixture deck/front page", strict: true },
  { path: "/2026-w45", label: "latest edition", strict: true },
  { path: "/2026-w44/3", label: "standalone page", strict: true },
  { path: "/issues", label: "archive", strict: true },
  { path: "/brand", label: "brand", strict: true },
  {
    path: "/kitchen-sink",
    label: "dev showcase (landmark/region moderates are inherent)",
    strict: false,
  },
];

const BLOCKING = new Set(["critical", "serious"]);

for (const { path, label, strict } of ROUTES) {
  test(`axe: ${label} (${path})`, async ({ page }, testInfo) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = strict
      ? violations
      : violations.filter((v) => BLOCKING.has(v.impact ?? ""));
    expect(
      blocking.map(
        (v) =>
          `${v.impact} ${v.id}: ${v.nodes
            .map((n) => n.target.join(" "))
            .join(" | ")}`,
      ),
      `${testInfo.project.name} ${path} violations`,
    ).toEqual([]);
  });
}
