import { expect, test } from "./fixtures"
import { gotoPage, requireBoundingBox, takeRegressionScreenshot } from "./visual_utils"

const AFTER_ARTICLE_URL = "http://localhost:8080/after-article-fixture"

test.describe("After-article components", () => {
  test("subscription box and sequence links spacing (screenshot)", async ({ page }, testInfo) => {
    await gotoPage(page, AFTER_ARTICLE_URL)

    const afterArticle = page.locator(".after-article-components")
    await expect(afterArticle.locator("#subscription-and-contact")).toBeVisible()
    await expect(afterArticle.locator(".sequence-links")).toBeVisible()

    await afterArticle.scrollIntoViewIfNeeded()
    await takeRegressionScreenshot(page, testInfo, "after-article-spacing", {
      elementToScreenshot: afterArticle,
    })
  })

  test("newsletter & RSS links share a line when the sentence wraps", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await gotoPage(page, AFTER_ARTICLE_URL)

    const paragraph = page.locator("#subscription-and-contact p").first()
    const newsletterBox = await requireBoundingBox(
      paragraph.locator('a[href="https://turntrout.substack.com/subscribe"]'),
    )
    const rssBox = await requireBoundingBox(paragraph.locator("#rss-link"))

    const newsletterMidY = newsletterBox.y + newsletterBox.height / 2
    expect(rssBox.y).toBeLessThan(newsletterMidY)
    expect(rssBox.y + rssBox.height).toBeGreaterThan(newsletterMidY)
  })
})
