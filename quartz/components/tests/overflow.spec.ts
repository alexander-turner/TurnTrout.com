import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

const TEST_PAGE_URL = "http://localhost:8080/test-page"

// Sub-pixel layout rounding can report a 1px overflow even when content fits.
const OVERFLOW_TOLERANCE_PX = 1

test.describe("Horizontal overflow", () => {
  test("the page does not scroll horizontally", async ({ page }) => {
    await gotoPage(page, TEST_PAGE_URL)

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      return doc.scrollWidth - doc.clientWidth
    })
    expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX)
  })

  test("glued emoji runs wrap instead of overflowing their paragraph", async ({ page }) => {
    await gotoPage(page, TEST_PAGE_URL)

    const paragraphs = page.locator("article p:has(.emoji-span)")
    const count = await paragraphs.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const overflow = await paragraphs.nth(i).evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(overflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX)
    }
  })
})
