import { expect, test } from "./fixtures"
import { takeRegressionScreenshot } from "./visual_utils"

const TEST_PAGE_URL = "http://localhost:8080/test-page"
const RELATED_POSTS = ".related-posts"

test.beforeEach(async ({ page }) => {
  await page.goto(TEST_PAGE_URL, { waitUntil: "domcontentloaded" })
})

test.describe("Related posts block", () => {
  test("renders a Similar links list of internal popover links with excerpts", async ({ page }) => {
    const block = page.locator(RELATED_POSTS)
    await block.scrollIntoViewIfNeeded()
    await expect(block).toBeVisible()
    await expect(block.locator(".related-posts-title")).toHaveText("Similar links")

    const links = block.locator("li.related-post a.internal.can-trigger-popover")
    await expect(links.first()).toBeVisible()
    expect(await links.count()).toBeGreaterThan(0)
    await expect(block.locator(".related-post-excerpt").first()).toBeVisible()
  })

  test("sits between the trout ornament and the subscription box", async ({ page }) => {
    const block = page.locator(RELATED_POSTS)
    await block.scrollIntoViewIfNeeded()
    const ornamentBox = await page.locator("#trout-ornament-container").boundingBox()
    const blockBox = await block.boundingBox()
    const subscriptionBox = await page.locator("#subscription-and-contact").boundingBox()
    expect(ornamentBox && blockBox && blockBox.y > ornamentBox.y).toBe(true)
    expect(blockBox && subscriptionBox && blockBox.y < subscriptionBox.y).toBe(true)
  })
})

test.describe("Related posts visual regression", () => {
  // Visual regression tests don't need assertions
  // eslint-disable-next-line playwright/expect-expect
  test("Similar links block (screenshot)", async ({ page }, testInfo) => {
    const block = page.locator(RELATED_POSTS)
    await block.scrollIntoViewIfNeeded()
    await block.waitFor({ state: "visible" })
    await takeRegressionScreenshot(page, testInfo, "related-posts-block", {
      elementToScreenshot: block,
    })
  })
})
