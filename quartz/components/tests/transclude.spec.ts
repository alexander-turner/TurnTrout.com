import { expect, test } from "./fixtures"

const TEST_PAGE_URL = "http://localhost:8080/test-page"

// The "Section to transclude" contains a within-page link to #admonitions. It is
// rendered twice: once inline and once inside the `[!quote]` transclude above it.
// Because that transclude is from the same page (`![[/test-page#...]]`), the link
// still resolves on this page, so both copies must stay normal same-page links
// (anchor favicon kept, not demoted to an internal turntrout link).
// Scoped to #center-content to exclude the desktop ToC's own #admonitions entry,
// which also matches this selector.
const WITHIN_PAGE_LINKS =
  '#center-content a.same-page-link.can-trigger-popover[href="#admonitions"]'
const DEMOTED_LINK = 'a[href$="test-page#admonitions"]'

test.beforeEach(async ({ page }) => {
  await page.goto(TEST_PAGE_URL, { waitUntil: "domcontentloaded" })
})

test.describe("Within-page links inside same-page transcludes", () => {
  test("keep their within-page (anchor) favicon", async ({ page }) => {
    // Both the inline copy and the transcluded copy survive as same-page links.
    await expect(page.locator(WITHIN_PAGE_LINKS)).toHaveCount(2)
    await expect(
      page.locator(`${WITHIN_PAGE_LINKS} svg.favicon[data-domain="anchor"]`),
    ).toHaveCount(2)

    // The link was not rebased to a cross-page link, so nothing was demoted.
    await expect(page.locator(DEMOTED_LINK)).toHaveCount(0)
  })

  test("scroll to the target header when clicked", async ({ page }) => {
    const heading = page.locator("#admonitions")
    await expect(heading).toHaveCount(1)

    await page.locator(WITHIN_PAGE_LINKS).first().click()

    // The header should be scrolled into view near the top of the viewport.
    await expect
      .poll(async () => {
        const box = await heading.boundingBox()
        return box ? box.y : Number.POSITIVE_INFINITY
      })
      .toBeLessThan(200)
  })
})
