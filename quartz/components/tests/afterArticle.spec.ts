import { expect, test } from "./fixtures"
import { gotoPage, takeRegressionScreenshot } from "./visual_utils"

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
})
