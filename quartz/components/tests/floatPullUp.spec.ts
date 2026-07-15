import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { gotoPage, isDesktopViewport, openSearch, search } from "./visual_utils"

// `.float-desktop-pull-up` raises a floated testimonial image beside its
// callout title with a negative top margin calibrated for the article
// column. Popovers and the search preview render the same markup in far
// narrower containers, where that offset would paint the image over the
// title and subtitle — so the pull-up must be inert there while staying
// active in the article.

const FIXTURE_URL = "http://localhost:8080/float-pull-up-fixture"

// The viewport width at which custom.scss disables the pull-up.
const PULL_UP_MIN_VIEWPORT_WIDTH = 700

interface PullUpGeometry {
  readonly marginTop: number
  readonly float: string
  readonly imgTop: number
  readonly subtitleBottom: number
}

/** Measure the pull-up image against the subtitle above it within `root`. */
async function measurePullUp(root: Locator): Promise<PullUpGeometry> {
  const img = root.locator("img.float-desktop-pull-up").first()
  await expect(img).toBeAttached({ timeout: 15_000 })
  return img.evaluate((el) => {
    const content = el.closest(".admonition-content")
    const subtitle = content?.querySelector("p.subtitle")
    if (!subtitle) {
      throw new Error("Pull-up image is not inside a callout with a subtitle")
    }
    return {
      marginTop: parseFloat(getComputedStyle(el).marginTop),
      float: getComputedStyle(el).float,
      imgTop: el.getBoundingClientRect().top,
      subtitleBottom: subtitle.getBoundingClientRect().bottom,
    }
  })
}

/** True on viewports wide enough for custom.scss to keep the pull-up active. */
function isPullUpViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) > PULL_UP_MIN_VIEWPORT_WIDTH
}

test("pull-up is active in the article on wide viewports", async ({ page }) => {
  test.skip(!isPullUpViewport(page), "the pull-up is disabled below the article-column width")

  await gotoPage(page, FIXTURE_URL)
  test.skip(
    (page.viewportSize()?.width ?? 0) <= PULL_UP_MIN_VIEWPORT_WIDTH,
    "pull-up is inert at or below the breakpoint",
  )

  const geometry = await measurePullUp(page.locator("article"))
  expect(geometry.float).toBe("right")
  expect(geometry.marginTop).toBeLessThan(0)
})

test("pull-up is inert in the article on narrow viewports", async ({ page }) => {
  test.skip(isPullUpViewport(page), "wide viewports keep the pull-up active")

  await gotoPage(page, FIXTURE_URL)

  const geometry = await measurePullUp(page.locator("article"))
  expect(geometry.float).toBe("right")
  expect(geometry.marginTop).toBe(0)
  expect(geometry.imgTop).toBeGreaterThanOrEqual(geometry.subtitleBottom)
})

test("popover content keeps the floated image below the callout subtitle", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "popovers are hidden on mobile")

  await gotoPage(page, "http://localhost:8080/test-page")
  // Clear the post-navigation mouse-suppression flag so hover popovers fire.
  await page.mouse.move(1, 1)

  const link = page.locator("a#first-link-test-page")
  await expect(link).toBeVisible()
  await link.evaluate((el) => {
    ;(el as HTMLAnchorElement).setAttribute("href", "./float-pull-up-fixture")
  })
  await link.hover()

  const geometry = await measurePullUp(page.locator(".popover .popover-inner"))
  expect(geometry.float).toBe("right")
  expect(geometry.marginTop).toBe(0)
  expect(geometry.imgTop).toBeGreaterThanOrEqual(geometry.subtitleBottom)
})

function isPreviewPanelViewport(page: Page): boolean {
  // The side preview panel only renders above the tablet breakpoint.
  return isDesktopViewport(page)
}

test("search preview keeps the floated image below the callout subtitle", async ({ page }) => {
  test.skip(!isPreviewPanelViewport(page), "the search preview panel is hidden on mobile")

  await gotoPage(page, "http://localhost:8080/test-page")
  await openSearch(page)
  await search(page, "Quotesmith")

  const card = page.locator('.result-card[id="float-pull-up-fixture"]')
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.hover()

  const geometry = await measurePullUp(page.locator("#preview-container"))
  expect(geometry.float).toBe("right")
  expect(geometry.marginTop).toBe(0)
  expect(geometry.imgTop).toBeGreaterThanOrEqual(geometry.subtitleBottom)
})
