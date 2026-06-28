import { type Theme } from "../scripts/darkmode"
import { expect, test } from "./fixtures"
import { gotoPage, setTheme, takeRegressionScreenshot } from "./visual_utils"

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "/test-page")
})

test.describe("Tweet embeds", () => {
  test("single tweet renders author, body, and an xcancel permalink", async ({ page }) => {
    const card = page.locator(".tweet-embed:not(.tweet-thread) .tweet-card").first()
    await card.scrollIntoViewIfNeeded()
    await expect(card).toBeVisible()
    await expect(card.locator(".tweet-name")).toContainText("Alex Turner")
    // The handle links to the author's xcancel profile (not the post).
    await expect(card.locator("a.tweet-handle")).toHaveAttribute("href", /xcancel\.com\/[^/]+$/)
    // The date is plain text, not a link.
    await expect(card.locator("a.tweet-date")).toHaveCount(0)
    // No favicons are stamped on the card's links.
    await expect(card.locator(".favicon")).toHaveCount(0)
    // Avatar and media are self-hosted on the CDN, never twimg.
    await expect(card.locator("img.tweet-avatar")).toHaveAttribute("src", /assets\.turntrout\.com/)
  })

  test("thread renders two connected cards", async ({ page }) => {
    await expect(page.locator(".tweet-thread .tweet-card")).toHaveCount(2)
  })

  test("an image that fits the height cap renders in full without a fade", async ({ page }) => {
    const grid = page.locator(".tweet-embed:not(.tweet-thread) .tweet-media-grid").first()
    await grid.scrollIntoViewIfNeeded()
    const img = grid.locator("img.tweet-media").first()
    // Wait for the image to load so the fade script has measured the final layout.
    await img.evaluate(
      (el: HTMLImageElement) =>
        el.complete ||
        new Promise((resolve) => el.addEventListener("load", () => resolve(null), { once: true })),
    )
    // A landscape photo fits under the 40rem cap at its natural aspect ratio, so the
    // frame's bottom edge is the real edge of the image and no fade is applied.
    await expect(grid).not.toHaveClass(/tweet-media-grid-fade-bottom/)
  })

  test("an image clipped by the height cap fades into the card at the bottom", async ({ page }) => {
    const grid = page.locator(".tweet-embed:not(.tweet-thread) .tweet-media-grid").first()
    await grid.scrollIntoViewIfNeeded()
    // Force a tiny cap so the image must cover-crop its top and bottom. Shrinking
    // the grid trips the ResizeObserver, which re-measures and adds the fade.
    await page.addStyleTag({
      content: ".tweet-media-count-1 .tweet-media { max-height: 4rem !important; }",
    })
    await expect(grid).toHaveClass(/tweet-media-grid-fade-bottom/)
  })

  test("the X-logo source link changes color on hover", async ({ page }) => {
    const logo = page
      .locator(".tweet-embed:not(.tweet-thread) .tweet-source-link .tweet-x-logo")
      .first()
    await logo.scrollIntoViewIfNeeded()
    const fillBefore = await logo.evaluate((el) => getComputedStyle(el).fill)
    await logo.hover()
    await expect.poll(() => logo.evaluate((el) => getComputedStyle(el).fill)).not.toBe(fillBefore)
  })

  for (const theme of ["light", "dark"] as Theme[]) {
    // Visual regression tests don't need assertions
    // eslint-disable-next-line playwright/expect-expect
    test(`single tweet ${theme} (screenshot)`, async ({ page }, testInfo) => {
      await setTheme(page, theme)
      const card = page.locator(".tweet-embed:not(.tweet-thread)").first()
      await card.scrollIntoViewIfNeeded()
      await card.waitFor({ state: "visible" })
      await takeRegressionScreenshot(page, testInfo, `tweet-single-${theme}`, {
        elementToScreenshot: card,
      })
    })

    // eslint-disable-next-line playwright/expect-expect
    test(`thread ${theme} (screenshot)`, async ({ page }, testInfo) => {
      await setTheme(page, theme)
      const thread = page.locator(".tweet-thread")
      await thread.scrollIntoViewIfNeeded()
      await thread.waitFor({ state: "visible" })
      await takeRegressionScreenshot(page, testInfo, `tweet-thread-${theme}`, {
        elementToScreenshot: thread,
      })
    })
  }
})
