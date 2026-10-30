import { expect, test, type Page } from "@playwright/test";

/**
 * §2.1 deck smoke — the fixture edition (editions/2026-w44.json is the C2
 * fixture) at the 390×844 design point: render, keyboard nav, tap zones,
 * and the native scroll-snap path a swipe drives. Mobile project only.
 */

const ISSUE = "/2026-w44";
const CARD_COUNT = 11; // pages in the fixture edition

test.skip(({ isMobile }) => !isMobile, "mobile-deck project only");

function progress(page: Page) {
  return page.getByRole("progressbar", { name: "Issue progress" });
}

function cards(page: Page) {
  return page.locator(".w-deck-card");
}

/** First ArrowRight press may land before hydration; press until it takes. */
async function ensureHydrated(page: Page) {
  await expect(async () => {
    await page.keyboard.press("ArrowRight");
    await expect(progress(page)).not.toHaveAttribute("aria-valuenow", "1", {
      timeout: 750,
    });
  }).toPass({ timeout: 15_000 });
}

test.describe("mobile deck", () => {
  test("renders the fixture edition as a labelled card deck", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });

    await expect(page.locator(".issue-split__deck")).toBeVisible();
    await expect(page.locator(".issue-split__frontpage")).toBeHidden();

    await expect(cards(page)).toHaveCount(CARD_COUNT);
    const cover = cards(page).first();
    await expect(cover).toHaveAttribute("role", "region");
    await expect(cover).toHaveAttribute("aria-label", "Cover");
    await expect(cover).toContainText("№ 1"); // fixture issue_number

    // §5: progressbar exposes position to SR.
    const bar = progress(page);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
    await expect(bar).toHaveAttribute("aria-valuemax", String(CARD_COUNT));

    // The scroller itself is keyboard-operable + named.
    await expect(page.locator(".dv-scroller")).toHaveAttribute(
      "aria-roledescription",
      "carousel",
    );
  });

  test("off-screen cards leave the a11y tree and tab order", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });
    const second = cards(page).nth(1);
    await expect(second).toHaveAttribute("aria-hidden", "true");
    await expect(second).toHaveAttribute("inert", "");

    await ensureHydrated(page);
    // Card 2 is now current: perceivable, and card 1 is hidden instead.
    await expect(second).toHaveAttribute("aria-hidden", "false");
    await expect(cards(page).first()).toHaveAttribute("aria-hidden", "true");
  });

  test("arrow keys / Home / End turn pages and move SR focus", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });
    const bar = progress(page);
    await ensureHydrated(page);

    await page.keyboard.press("Home");
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
    await expect(cards(page).first()).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(bar).toHaveAttribute("aria-valuenow", "2");
    // Focus lands on the new region so screen readers name it.
    await expect(cards(page).nth(1)).toBeFocused();

    await page.keyboard.press("End");
    await expect(bar).toHaveAttribute("aria-valuenow", String(CARD_COUNT));
    await expect(cards(page).last()).toBeFocused();
    await expect(cards(page).last()).toHaveAttribute(
      "aria-label",
      "Back Page",
    );

    await page.keyboard.press("ArrowRight"); // clamped at the end
    await expect(bar).toHaveAttribute("aria-valuenow", String(CARD_COUNT));

    await page.keyboard.press("ArrowLeft");
    await expect(bar).toHaveAttribute(
      "aria-valuenow",
      String(CARD_COUNT - 1),
    );
  });

  test("hidden front-page layer captures no keys", async ({ page }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });
    await ensureHydrated(page);

    // `?` must not toggle the desktop shortcuts sheet while its layer is
    // display:none — before the gate it mounted invisibly and swallowed
    // later j/k presses via `sheetOpen`.
    await page.keyboard.press("?");
    await expect(
      page.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toHaveCount(0);

    // Nor may the toggle latch: widening to the front-page breakpoint
    // must reveal no sheet.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".issue-split__frontpage")).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toHaveCount(0);
  });

  test("tap zones: right edge advances, left third goes back", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });
    await ensureHydrated(page);
    await page.keyboard.press("Home");
    const bar = progress(page);
    await expect(bar).toHaveAttribute("aria-valuenow", "1");

    await page.touchscreen.tap(360, 420); // right two-thirds of 390px
    await expect(bar).toHaveAttribute("aria-valuenow", "2");

    await page.touchscreen.tap(30, 420); // left third
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
  });

  test("native horizontal scroll (the swipe path) syncs position", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });
    const bar = progress(page);
    const deck = page.locator(".w-deck");

    await deck.evaluate((el) => {
      el.scrollLeft = el.clientWidth * 2;
    });
    await expect(bar).toHaveAttribute("aria-valuenow", "3");

    await deck.evaluate((el) => {
      el.scrollLeft = 0;
    });
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
  });
});
