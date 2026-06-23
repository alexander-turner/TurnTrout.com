import { expect, test } from "./fixtures"
import { takeRegressionScreenshot } from "./visual_utils"

const TEST_PAGE_URL = "http://localhost:8080/test-page"
const RELATED_POSTS = ".related-posts"

test.beforeEach(async ({ page }) => {
  await page.goto(TEST_PAGE_URL, { waitUntil: "domcontentloaded" })
})

test.describe("Related posts block", () => {
  test("sits after the subscription/contact box", async ({ page }) => {
    const block = page.locator(RELATED_POSTS)
    await block.scrollIntoViewIfNeeded()
    const blockBox = await block.boundingBox()
    const subscriptionBox = await page.locator("#subscription-and-contact").boundingBox()
    expect(blockBox && subscriptionBox && blockBox.y > subscriptionBox.y).toBe(true)
  })

  test("registers its heading in the table of contents", async ({ page }) => {
    // The heading is a top-level article `<h1>` (sibling of the list block), so
    // it behaves like any other section heading.
    await expect(page.locator("article > h1#similar-posts.related-posts-title")).toHaveCount(1)
    await expect(
      page.locator('#table-of-contents a.same-page-link[data-for="similar-posts"]'),
    ).toHaveCount(1)
  })
})

test.describe("Related posts visual regression", () => {
  // Visual regression tests don't need assertions
  // eslint-disable-next-line playwright/expect-expect
  test("Similar posts block (screenshot)", async ({ page }, testInfo) => {
    const block = page.locator(RELATED_POSTS)
    await block.scrollIntoViewIfNeeded()
    await block.waitFor({ state: "visible" })
    await takeRegressionScreenshot(page, testInfo, "related-posts-block", {
      elementToScreenshot: block,
    })
  })
})
