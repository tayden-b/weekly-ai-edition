import { expect, test, type Page } from "@playwright/test";

/**
 * §2.2 front page smoke — the same `/{issue}` route at 1440×900: the
 * newspaper layout, the sticky bar, and its keyboard nav (`j`/`k`, `?`).
 * Desktop project only.
 */

const ISSUE = "/2026-w44";

test.skip(({ isMobile }) => isMobile, "desktop-front project only");

async function scrollY(page: Page) {
  return page.evaluate(() => window.scrollY);
}

/** Index of the nav section currently at the top — the app's own rule:
 * the last jump target sitting above the 64px sticky-bar line. */
function currentSectionIndex(page: Page) {
  return page.evaluate(() => {
    const ids = [
      ...document.querySelectorAll<HTMLAnchorElement>('.w-topbar a[href^="#"]'),
    ].map((a) => a.getAttribute("href")!.slice(1));
    let current = -1;
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 80) current = i;
    });
    return current;
  });
}

/** Wait until window.scrollY has been still for ~400ms (smooth scroll finished). */
async function settleScroll(page: Page) {
  await page.waitForFunction(
    () =>
      new Promise((resolve) => {
        let still = 0;
        let prev = window.scrollY;
        const t = setInterval(() => {
          if (window.scrollY === prev && ++still >= 4) {
            clearInterval(t);
            resolve(true);
          }
          prev = window.scrollY;
        }, 100);
      }),
    undefined,
    { timeout: 10_000 },
  );
}

/** First `j` press may land before the chrome hydrates; press until it takes. */
async function jumpOnce(page: Page) {
  await expect(async () => {
    const before = await scrollY(page);
    await page.keyboard.press("j");
    await expect
      .poll(() => scrollY(page), { timeout: 750 })
      .toBeGreaterThan(before);
  }).toPass({ timeout: 15_000 });
}

test.describe("desktop front page", () => {
  test("renders the fixture edition as a newspaper front page", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });

    await expect(page.locator(".issue-split__frontpage")).toBeVisible();
    await expect(page.locator(".issue-split__deck")).toBeHidden();

    // Masthead band, cover stack, briefing lead, section bands, markets table.
    await expect(
      page.getByRole("heading", { name: "The Weekly AI Edition", level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".w-fp__cover-stack")).toBeVisible();
    await expect(page.locator(".w-fp__briefing")).toBeVisible();
    const sections = page.locator(".w-fp__section");
    expect(await sections.count()).toBeGreaterThanOrEqual(5);
    await expect(page.locator(".w-fp__markets table")).toBeVisible();
    await expect(page.locator(".w-fp__markets")).toContainText("NVDA");
  });

  test("sticky bar appears after the masthead scrolls out", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });
    const bar = page.locator(".w-topbar");
    await expect(bar).toHaveAttribute("aria-hidden", "true");

    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(bar).toHaveAttribute("data-show", "true");
    await expect(bar).toHaveAttribute("aria-hidden", "false");
    await expect(
      bar.getByRole("link", { name: "Markets" }),
    ).toBeVisible();
  });

  test("j/k jump between sections and ? shows the shortcuts sheet", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });

    // j jumps to the next nav section, k back — compare which section
    // sits at the top rather than raw scrollY (smooth scroll animates,
    // and sections' offsets depend on viewport height).
    await jumpOnce(page);
    await settleScroll(page);
    const first = await currentSectionIndex(page);
    expect(first).toBeGreaterThanOrEqual(0);

    await page.keyboard.press("j");
    await settleScroll(page);
    expect(await currentSectionIndex(page)).toBe(first + 1);

    await page.keyboard.press("k");
    await settleScroll(page);
    expect(await currentSectionIndex(page)).toBe(first);

    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await page.keyboard.press("?");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
});
