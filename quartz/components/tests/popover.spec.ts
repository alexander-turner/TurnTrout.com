import { test as base, expect, type Locator } from "@playwright/test"

import { minDesktopWidth } from "../../styles/variables"
import { POPOVER_SCROLL_OFFSET } from "../scripts/popover_helpers"
import { takeRegressionScreenshot, isDesktopViewport, showingPreview } from "./visual_utils"

type TestFixtures = {
  dummyLink: Locator
}

const SCROLL_TOLERANCE = 30

const test = base.extend<TestFixtures>({
  dummyLink: async ({ page }, use) => {
    const dummyLink = page.locator("a#first-link-test-page")
    await expect(dummyLink).toBeVisible()
    await use(dummyLink)
  },
})

test.beforeEach(async ({ page }) => {
  if (!isDesktopViewport(page)) {
    test.skip()
  }

  // I don't trust playwright's test isolation
  await page.reload()
  await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

  await page.evaluate(() => window.scrollTo(0, 0))
})

test(".can-trigger-popover links show popover on hover (lostpixel)", async ({
  page,
  dummyLink,
}, testInfo) => {
  await expect(dummyLink).toBeVisible()

  // Initial state - no popover
  let popover = page.locator(".popover")
  await expect(popover).toBeHidden()

  await dummyLink.hover()
  popover = page.locator(".popover")
  await expect(popover).toBeVisible()
  await expect(popover).toHaveClass(/popover-visible/)
  await takeRegressionScreenshot(page, testInfo, "first-visible-popover", {
    element: popover,
  })

  // Move mouse away
  await page.mouse.move(0, 0)
  await expect(popover).toBeHidden()
})

test("External links do not show popover on hover (lostpixel)", async ({ page }) => {
  const externalLink = page.locator(".external").first()
  await externalLink.scrollIntoViewIfNeeded()
  await expect(externalLink).toBeVisible()

  // Initial state - no popover
  let popover = page.locator(".popover")
  await expect(popover).toBeHidden()

  await externalLink.hover()
  popover = page.locator(".popover")
  await expect(popover).toBeHidden()
})

test("Popover content matches target page content", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()
  const linkHref = await dummyLink.getAttribute("href")
  expect(linkHref).not.toBeNull()

  // Capture the original h1 text before navigation
  const selector = "#article-title"
  const originalH1Text = await page.locator(selector).first().textContent()

  // Hover and wait for popover
  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()
  const popoverContent = await popover.locator(".popover-inner").textContent()

  // Check that we navigated to the right page
  await dummyLink.click()
  const targetHref = linkHref?.replace("./", "")
  await page.waitForURL(`**/${targetHref}`)

  // Wait until the h1 changes, indicating navigation completed
  await expect(page.locator(selector).first()).not.toHaveText(originalH1Text || "")

  // Check content matches
  const pageContent = await page.locator(".popover-hint").first().textContent()
  expect(popoverContent).toContain(pageContent)
})

test("Multiple popovers don't stack with wait", async ({ page }) => {
  const allLinks = await page.locator(".can-trigger-popover").all()
  const firstLinks = allLinks.slice(0, 5)
  for (const link of firstLinks) {
    await link.scrollIntoViewIfNeeded()
    await expect(link).toBeVisible()
    await link.hover()

    const popover = page.locator(".popover")
    await expect(popover).toBeVisible()
  }

  const popoverCount = await page.locator(".popover").count()
  expect(popoverCount).toBe(1)
})

test("Multiple popovers don't stack without wait", async ({ page }) => {
  const allLinks = await page.locator(".can-trigger-popover").all()
  const firstLinks = allLinks.slice(0, 5)
  for (const link of firstLinks) {
    await expect(link).toBeAttached()
    await link.scrollIntoViewIfNeeded()
    await expect(link).toBeVisible()
    await link.hover()
    await page.mouse.move(0, 0)
  }

  await expect(page.locator(".popover")).toHaveCount(0)
})

test("Popover updates position on window resize", async ({ page, dummyLink }) => {
  const initialPageWidth = await page.evaluate(() => window.innerWidth)

  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()
  const initialRect = await popover.boundingBox()

  await page.setViewportSize({ width: Number(initialPageWidth) + 100, height: 600 })

  await expect(async () => {
    const newRect = await popover.boundingBox()
    expect(newRect).not.toEqual(initialRect)
  }).toPass()
})

test("Popover scrolls to hash target", async ({ page }) => {
  const hashLink = page.locator("#first-link-test-page")
  await expect(hashLink).toBeVisible()

  const href = await hashLink.getAttribute("href")
  const targetHref = "/design#visual-regression-testing"
  expect(href).toContain(targetHref)

  await hashLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()
  const popoverInner = popover.locator(".popover-inner")
  const popoverScrollTop = await popoverInner.evaluate((el) => el.scrollTop)

  // Find the target element *inside* the popover
  // Note: The ID is modified in the popover content
  const targetElementInPopover = popoverInner.locator(`#${targetHref.split("#")[1]}-popover`)
  await expect(targetElementInPopover).toBeVisible()

  // Calculate the expected scroll position based on the target's offsetTop
  const expectedScrollTop = await targetElementInPopover.evaluate((el, offset) => {
    // Assert el is HTMLElement to access offsetTop
    if (!(el instanceof HTMLElement)) {
      throw new Error("Target element inside popover is not an HTMLElement")
    }
    return el.offsetTop - offset
  }, POPOVER_SCROLL_OFFSET)

  expect(Math.abs(popoverScrollTop - expectedScrollTop)).toBeLessThanOrEqual(SCROLL_TOLERANCE)
})

test("Popover stays hidden after mouse leaves", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()

  // Initial state - no popover
  let popover = page.locator(".popover")
  await expect(popover).toBeHidden()

  await dummyLink.hover()
  popover = page.locator(".popover")
  await expect(popover).toBeVisible()

  await page.mouse.move(0, 0)
  await expect(popover).toBeHidden()

  // Wait a moment and verify it stays hidden
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(500)
  await expect(popover).toBeHidden()
})
test("Popover does not show when noPopover attribute is true", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()

  // Set noPopover attribute
  await page.evaluate(() => {
    const link = document.querySelector(".can-trigger-popover")
    if (link) link.setAttribute("data-no-popover", "true")
  })

  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeHidden()
})

test("Popover is hidden when page scrolls", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()
  await dummyLink.hover()

  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()

  const scrollAmount = 500
  await page.evaluate((scrollAmount) => window.scrollBy(0, scrollAmount), scrollAmount)

  await expect(popover).toBeHidden()
})

test("Can scroll within popover content", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()

  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()

  // Get popover inner element which is scrollable
  const popoverInner = popover.locator(".popover-inner")

  const initialScrollTop = await popoverInner.evaluate((el) => el.scrollTop)

  // Scroll down within the popover
  await popoverInner.evaluate((el) => {
    el.scrollTop = 100
  })

  const newScrollTop = await popoverInner.evaluate((el) => el.scrollTop)
  expect(newScrollTop).not.toBe(initialScrollTop)
})

test("Popovers do not appear in search previews", async ({ page }) => {
  // Open search and search for a term that will have internal links
  await page.keyboard.press("/")
  const searchBar = page.locator("#search-bar")
  await searchBar.fill("Test page")

  // Wait for search results and preview
  const previewContainer = page.locator("#preview-container")
  await expect(previewContainer).toBeVisible({ visible: showingPreview(page) })

  // Find an internal link in the preview and hover over it
  const searchDummyLink = previewContainer.locator("a#first-link-test-page")
  await searchDummyLink.hover()

  // Verify no popover appears
  const popover = page.locator(".popover")
  await expect(popover).toBeHidden()
})

test("Popovers appear for content-meta links", async ({ page, dummyLink }) => {
  const metaLink = page.locator("#content-meta a.tag-link").first()
  await metaLink.scrollIntoViewIfNeeded()
  await expect(metaLink).toBeVisible()
  await metaLink.hover()

  const metaPopover = page.locator(".popover")
  await expect(metaPopover).toBeVisible()
  const metaX = (await metaPopover.boundingBox())?.x

  // Move mouse and wait for it to go away
  await page.mouse.move(0, 0)
  await expect(metaPopover).toBeHidden()

  await dummyLink.scrollIntoViewIfNeeded()
  await expect(dummyLink).toBeVisible()
  await dummyLink.hover()

  const dummyPopover = page.locator(".popover")
  await expect(dummyPopover).toBeVisible()
  const dummyX = (await dummyPopover.boundingBox())?.x

  expect(metaX).not.toEqual(dummyX)
})

test("Popover is hidden on mobile", async ({ page, dummyLink }) => {
  await page.setViewportSize({ width: 320, height: 600 })
  await expect(dummyLink).toBeVisible()
  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeHidden()
})

test("Popover appears at minimal viewport width", async ({ page, dummyLink }) => {
  await page.setViewportSize({ width: minDesktopWidth + 20, height: 600 })
  await expect(dummyLink).toBeVisible()
  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()
})

for (const id of ["navbar", "toc-content"]) {
  test(`Popover does not show on ${id}`, async ({ page }) => {
    const element = page.locator(`#${id}`)
    await expect(element).toBeVisible()

    for (const link of await element.locator("a").all()) {
      await link.hover()
      const popover = page.locator(".popover")
      await expect(popover).toBeHidden()
    }
  })
}

test("Popover does not appear on next page after navigation", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()
  const linkHref = await dummyLink.getAttribute("href")
  const linkSlug = linkHref?.split("/").pop()

  // Hover over the link to initiate a popover, but don't wait for it to appear
  await dummyLink.hover()

  // Immediately click the link to navigate
  await dummyLink.click()

  // Wait for navigation to the new page. The href of dummyLink is /design.
  await page.waitForURL(`**/${linkSlug}`)

  // The 'nav' event should have cleared the pending popover timer.
  // Wait a bit to ensure the popover doesn't appear.
  // The popover timeout is 300ms, let's wait a little longer.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(500)

  const popover = page.locator(".popover")
  await expect(popover).toBeHidden()
})
