/**
 * Mobile behavior of annotated external links. Lives outside popover.spec.ts
 * because that file's beforeEach skips every test on mobile viewports.
 */
import { expect, test } from "./fixtures"
import { gotoPage, isDesktopViewport } from "./visual_utils"

test("Annotated external link on mobile fetches nothing and shows no popover", async ({ page }) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  // Popovers are CSS-hidden on mobile but hover listeners still run via tap
  // emulation; the annotated branch must bail before fetching anything.
  let annotationRequests = 0
  await page.route("**/static/link-annotations.json", async (route) => {
    annotationRequests++
    await route.continue()
  })

  await gotoPage(page, "http://localhost:8080/test-page", "domcontentloaded")
  await page.mouse.move(1, 1)

  // Hover an internal link first: its popover attaches to the DOM even on
  // mobile (hidden by CSS), giving a deterministic marker that the
  // hover→timer→create pipeline is live on this page.
  // A known always-visible internal link in the article intro (sidebar/TOC
  // links are display:none on mobile, and spoiler content is hidden).
  const internalLink = page.locator("a#first-link-test-page")
  await internalLink.scrollIntoViewIfNeeded()
  await internalLink.hover()
  await expect(page.locator(".popover")).toBeAttached()

  const annotatedLink = page.locator('a[data-annotated="true"]').first()
  await annotatedLink.scrollIntoViewIfNeeded()
  await annotatedLink.hover()
  // When the annotated link's popover timer fires, it removes the internal
  // popover and then the annotation branch yields nothing — so an empty
  // .popover set proves the annotated hover pipeline ran to completion.
  await expect(page.locator(".popover")).toHaveCount(0)

  expect(annotationRequests).toBe(0)
})
