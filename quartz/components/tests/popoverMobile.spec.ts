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

  const link = page.locator('a[data-annotated="true"]').first()
  await link.scrollIntoViewIfNeeded()
  await link.hover()
  // The popover timer is 300ms; wait past it before asserting nothing happened
  await page.waitForTimeout(1_000)

  expect(annotationRequests).toBe(0)
  await expect(page.locator(".popover")).toHaveCount(0)
})
