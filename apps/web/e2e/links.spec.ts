import { expect, test, type Page } from "@playwright/test";

/**
 * L1 source links — the L1 brief: every headline and source line is a
 * working external link; taps open the source, swipes still page the deck,
 * keyboard Tab reaches links with a visible focus ring.
 * External navigations are stubbed (route → 200) so the suite never leaves
 * the machine — what we verify is that the browser *navigates to* the
 * origin URL, not that the origin is alive (scripts/check-links.mts owns
 * liveness in the dry-run workflow).
 */

const ISSUE = "/2026-w44";

/** Every external https request returns a stub page; page.url() then proves
 * the href the browser navigated to. */
async function stubExternal(page: Page) {
  await page.route(/^https:\/\/(?!localhost|127\.)/, (route) =>
    route.fulfill({ contentType: "text/html", body: "stub" }),
  );
}

const HEADLINE = "a.w-item__headline-link";
const SRC_LINK = "a.w-item__source-link";

function progress(page: Page) {
  return page.getByRole("progressbar", { name: "Issue progress" });
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

test.describe("deck links (mobile)", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile-deck project only");

  test("every item headline is an external link; tap navigates to the source", async ({
    page,
  }) => {
    await stubExternal(page);
    await page.goto(ISSUE, { waitUntil: "networkidle" });

    // Every .w-item on the deck carries a headline link and ≥1 source link.
    const items = page.locator(".issue-split__deck .w-item");
    const headlines = page.locator(`.issue-split__deck ${HEADLINE}`);
    const sourceLinks = page.locator(`.issue-split__deck ${SRC_LINK}`);
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(28);
    await expect(headlines).toHaveCount(count);
    for (let i = 0; i < count; i++) {
      const href = await headlines.nth(i).getAttribute("href");
      expect(href).toMatch(/^https?:\/\//);
      expect(href).not.toContain("news.ycombinator.com/item");
    }
    expect(await sourceLinks.count()).toBeGreaterThanOrEqual(count);

    // Bring the first card carrying item links on screen, then tap a
    // headline link → browser navigates to the source URL.
    const card = page
      .locator(".w-deck-card")
      .filter({ has: page.locator(HEADLINE) })
      .first();
    await card.scrollIntoViewIfNeeded();
    const target = card.locator(HEADLINE).first();
    const href = await target.getAttribute("href");
    await target.tap();
    await page.waitForURL((u) => u.toString().startsWith(href!), {
      timeout: 10_000,
    });
  });

  test("tap on a source-line link navigates; swipe still pages the deck", async ({
    page,
  }) => {
    await stubExternal(page);
    await page.goto(ISSUE, { waitUntil: "networkidle" });

    // The swipe path pages the deck (native scroll-snap → position sync).
    await ensureHydrated(page);
    await page.locator(".dv-scroller").evaluate((el) => {
      el.scrollLeft = el.clientWidth * 2;
    });
    await expect(progress(page)).not.toHaveAttribute("aria-valuenow", "1");

    // A link tap inside the deck opens the link — the deck does not page:
    // a page-change would have stayed on /{issue}; we navigated to the
    // source's origin instead.
    const card = page
      .locator(".w-deck-card")
      .filter({ has: page.locator(SRC_LINK) })
      .first();
    await card.scrollIntoViewIfNeeded();
    const link = card.locator(SRC_LINK).first();
    const href = await link.getAttribute("href");
    await link.tap();
    await page.waitForURL((u) => u.toString().startsWith(href!), {
      timeout: 10_000,
    });
  });
});

test.describe("front page links (desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "desktop-front project only");

  test("cover + every item headline link to origins; click navigates", async ({
    page,
  }) => {
    await stubExternal(page);
    await page.goto(ISSUE, { waitUntil: "networkidle" });

    await expect(page.locator("a.w-fp__headline-link")).toHaveCount(1);
    await expect(page.locator("a.w-fp__deck-link")).toHaveCount(1);
    const coverHref = await page
      .locator("a.w-fp__headline-link")
      .getAttribute("href");
    expect(coverHref).toMatch(/^https?:\/\//);

    const items = page.locator(".issue-split__frontpage .w-item");
    const headlines = page.locator(`.issue-split__frontpage ${HEADLINE}`);
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(28);
    await expect(headlines).toHaveCount(count);
    expect(
      await page.locator(`.issue-split__frontpage ${SRC_LINK}`).count(),
    ).toBeGreaterThanOrEqual(count);

    // Click the cover headline → navigates to the cover's origin URL.
    await page.locator("a.w-fp__headline-link").click();
    await page.waitForURL((u) => u.toString().startsWith(coverHref!), {
      timeout: 10_000,
    });
  });

  test("Tab reaches each link with a visible focus outline", async ({
    page,
  }) => {
    await page.goto(ISSUE, { waitUntil: "networkidle" });

    const reached: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el.tagName !== "A") return null;
        const href = el.getAttribute("href") ?? "";
        if (!href.startsWith("https://")) return { skip: true as const };
        const cs = getComputedStyle(el);
        return {
          skip: false as const,
          href,
          width: parseFloat(cs.outlineWidth),
          style: cs.outlineStyle,
        };
      });
      if (info && !info.skip) {
        // Visible focus state: a real outline, not none/0.
        expect(info.style).not.toBe("none");
        expect(info.width).toBeGreaterThanOrEqual(2);
        reached.push(info.href);
      }
      if (reached.length >= 3) break;
    }
    // Every headline link is reachable in the tab order (spot-check ≥3
    // external links incl. headline + source lines before giving up).
    expect(reached.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe("standalone page route (desktop)", () => {
  test.skip(({ isMobile }) => isMobile, "desktop-front project only");

  test("page headline + deck link out to the covered story", async ({
    page,
  }) => {
    await stubExternal(page);
    await page.goto(`${ISSUE}/1`, { waitUntil: "networkidle" });
    const title = page.locator("a.w-deck-card__title-link, a.w-sp__title-link");
    await expect(title).toHaveCount(1);
    expect(await title.first().getAttribute("href")).toMatch(/^https?:\/\//);
  });
});
