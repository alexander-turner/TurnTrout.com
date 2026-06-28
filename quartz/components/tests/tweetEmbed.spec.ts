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

  test("the X-logo source link changes color on hover", async ({ page }) => {
    const logo = page
      .locator(".tweet-embed:not(.tweet-thread) .tweet-source-link .tweet-x-logo")
      .first()
    await logo.scrollIntoViewIfNeeded()
    const fillBefore = await logo.evaluate((el) => getComputedStyle(el).fill)
    await logo.hover()
    await expect
      .poll(async () => logo.evaluate((el) => getComputedStyle(el).fill))
      .not.toBe(fillBefore)
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
