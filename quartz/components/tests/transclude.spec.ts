import { expect, test } from "./fixtures"

const TEST_PAGE_URL = "http://localhost:8080/test-page"

// The "Section to transclude" contains a within-page link to #admonitions. It is
// rendered twice: once inline (a genuine same-page link) and once inside the
// `[!quote]` transclude above it, where it is rebased to a cross-page link and
// must be demoted to a normal internal link.
const TRANSCLUDED_LINK = 'span.transclude a[href$="#admonitions"]'
const INLINE_LINK = 'article > p a.same-page-link[href="#admonitions"]'

test.beforeEach(async ({ page }) => {
  await page.goto(TEST_PAGE_URL, { waitUntil: "domcontentloaded" })
})

test.describe("Within-page links inside transcludes", () => {
  test("are demoted from same-page links to internal links", async ({ page }) => {
    const transcludedLink = page.locator(TRANSCLUDED_LINK).first()
    await expect(transcludedLink).toHaveCount(1)

    // No longer a same-page link (so the SPA router navigates instead of trying
    // to scroll to a non-existent host-page anchor), but still internal.
    await expect(transcludedLink).not.toHaveClass(/same-page-link/)
    await expect(transcludedLink).toHaveClass(/internal/)

    // The same-page (anchor) favicon was swapped for the internal turntrout one.
    await expect(transcludedLink.locator("svg.favicon")).toHaveAttribute(
      "data-domain",
      "turntrout_com",
    )
  })

  test("leave the inline same-page link untouched", async ({ page }) => {
    const inlineLink = page.locator(INLINE_LINK).first()
    await expect(inlineLink).toHaveCount(1)
    await expect(inlineLink.locator("svg.favicon")).toHaveAttribute("data-domain", "anchor")
  })

  test("scroll to the target header when clicked", async ({ page }) => {
    const heading = page.locator("#admonitions")
    await expect(heading).toHaveCount(1)

    await page.locator(TRANSCLUDED_LINK).first().click()

    // The header should be scrolled into view near the top of the viewport.
    await expect
      .poll(async () => {
        const box = await heading.boundingBox()
        return box ? box.y : Number.POSITIVE_INFINITY
      })
      .toBeLessThan(200)
  })
})
