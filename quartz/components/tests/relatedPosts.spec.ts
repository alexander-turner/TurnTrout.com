import type { Page } from "@playwright/test"

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

/**
 * The block lists the test page's nearest neighbors in the committed
 * `related_posts.json`, which shifts whenever the corpus is re-embedded. Swap
 * in fixed entries (same markup as `buildRelatedPostsBlock`) so the screenshot
 * tracks only the block's styling.
 */
async function setDummyRelatedPosts(page: Page): Promise<void> {
  await page.locator(`${RELATED_POSTS} > ul`).evaluate((list) => {
    list.innerHTML = [
      ["dummy-post-one", "Dummy post one", "A short excerpt for the first dummy post."],
      [
        "dummy-post-two",
        "Dummy post two",
        "A longer excerpt for the second dummy post, long enough to wrap onto a second line on narrow viewports.",
      ],
    ]
      .map(
        ([slug, title, excerpt]) =>
          `<li class="related-post"><a href="/${slug}" class="internal can-trigger-popover">${title}</a><span class="related-post-excerpt">${excerpt}</span></li>`,
      )
      .join("")
  })
}

test.describe("Related posts visual regression", () => {
  // Visual regression tests don't need assertions
  // eslint-disable-next-line playwright/expect-expect
  test("Similar posts block (screenshot)", async ({ page }, testInfo) => {
    await setDummyRelatedPosts(page)
    const block = page.locator(RELATED_POSTS)
    await block.scrollIntoViewIfNeeded()
    await block.waitFor({ state: "visible" })
    await takeRegressionScreenshot(page, testInfo, "related-posts-block", {
      elementToScreenshot: block,
    })
  })
})
