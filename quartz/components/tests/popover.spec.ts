import { test as base, expect, type Locator } from "@playwright/test"

import { minDesktopWidth } from "../../styles/variables"
import { IGNORE_POPOVER_IDS, POPOVER_SCROLL_OFFSET } from "../scripts/popover_helpers"
import { takeRegressionScreenshot, isDesktopViewport, showingPreview } from "./visual_utils"

type TestFixtures = {
  dummyLink: Locator
}

const test = base.extend<TestFixtures>({
  dummyLink: async ({ page }, use) => {
    const dummyLink = page.locator("a#first-link-test-page")
    await use(dummyLink)
  },
})

test.beforeEach(async ({ page }) => {
  if (!isDesktopViewport(page)) {
    test.skip()
  }

  await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

  await page.evaluate(() => window.scrollTo(0, 0))
})

test("Internal links show popover on hover (lostpixel)", async ({ page, dummyLink }, testInfo) => {
  await expect(dummyLink).toBeVisible()

  // Initial state - no popover
  let popover = page.locator(".popover")
  await expect(popover).not.toBeVisible()

  // Hover over link
  await dummyLink.hover()
  popover = page.locator(".popover")
  await expect(popover).toBeVisible()
  await expect(popover).toHaveClass(/popover-visible/)
  await takeRegressionScreenshot(page, testInfo, "first-visible-popover", {
    element: popover,
  })

  // Move mouse away
  await page.mouse.move(0, 0)
  await expect(popover).not.toBeVisible()
})

test("External links do not show popover on hover (lostpixel)", async ({ page }) => {
  const externalLink = page.locator(".external").first()
  await externalLink.scrollIntoViewIfNeeded()
  await expect(externalLink).toBeVisible()

  // Initial state - no popover
  let popover = page.locator(".popover")
  await expect(popover).not.toBeVisible()

  await externalLink.hover()
  popover = page.locator(".popover")
  await expect(popover).not.toBeVisible()
})

test("Popover content matches target page content", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()

  const linkHref = await dummyLink.getAttribute("href")
  expect(linkHref).not.toBeNull()

  // Hover and wait for popover
  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()

  // Check content matches
  const popoverContent = await popover.locator(".popover-inner").textContent()
  const sameLink = page.locator(`.internal[href="${linkHref}"]`)
  await sameLink.click()

  // Check that we navigated to the right page
  const url = page.url()
  expect(url).toContain(linkHref?.replace("./", ""))

  const pageContent = await page.locator(".popover-hint").first().textContent()
  expect(popoverContent).toContain(pageContent)
})

test("Multiple popovers don't stack", async ({ page }) => {
  // Get two different internal links
  const firstLink = page.locator(".internal").first()
  const secondLink = page.locator(".internal").nth(1)
  await expect(firstLink).toBeVisible()
  await expect(secondLink).toBeVisible()

  // Hover first link
  await firstLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()
  let popovers = await page.locator(".popover").count()
  expect(popovers).toBe(1)

  // Hover second link
  await secondLink.hover()
  await expect(popover).toBeVisible()
  popovers = await page.locator(".popover").count()
  expect(popovers).toBe(1)
})

test("Popover updates position on window resize", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()

  // Show popover
  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()

  // Get initial position
  const initialRect = await popover.boundingBox()
  const initialWidth = initialRect?.width
  expect(initialWidth).not.toBeUndefined()

  // Resize viewport
  await page.setViewportSize({ width: Number(initialWidth) + 100, height: 600 })

  // Get new position and wait for it to change
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
  const expectedScrollTop = await targetElementInPopover.evaluate((el) => {
    // Assert el is HTMLElement to access offsetTop
    if (!(el instanceof HTMLElement)) {
      throw new Error("Target element inside popover is not an HTMLElement")
    }
    return el.offsetTop - POPOVER_SCROLL_OFFSET
  })

  expect(popoverScrollTop).toBeCloseTo(expectedScrollTop, 0)
})

test("Popover stays hidden after mouse leaves", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()

  // Initial state - no popover
  let popover = page.locator(".popover")
  await expect(popover).not.toBeVisible()

  // Hover over link
  await dummyLink.hover()
  popover = page.locator(".popover")
  await expect(popover).toBeVisible()

  // Move mouse away
  await page.mouse.move(0, 0)
  await expect(popover).not.toBeVisible()

  // Wait a moment and verify it stays hidden
  await page.waitForTimeout(500)
  await expect(popover).not.toBeVisible()

  // Move mouse back near but not over the link
  await page.mouse.move(0, 100)
  await page.waitForTimeout(500)
  await expect(popover).not.toBeVisible()
})

test("Only one popover is visible at a time", async ({ page }) => {
  await page.goto("http://localhost:8080/posts")

  // Find non-anchors
  const linkAnchors = await page.locator(".page-listing a.internal").all()

  // Hover over first 3 internal links
  for (const link of linkAnchors) {
    await link.hover()
  }
  const popovers = page.locator(".popover")
  await expect(popovers).toBeVisible()
  expect(await popovers.count()).toBe(1)
})

test("Popover does not show when noPopover attribute is true", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()

  // Set noPopover attribute
  await page.evaluate(() => {
    const link = document.querySelector(".internal")
    if (link) link.setAttribute("data-no-popover", "true")
  })

  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).not.toBeVisible()
})

test("Popover maintains position when page scrolls", async ({ page, dummyLink }) => {
  // Find a link far enough down the page to test scrolling
  await expect(dummyLink).toBeVisible()

  // Get initial position of the link
  const linkBox = await dummyLink.boundingBox()
  if (!linkBox) throw new Error("Could not get link position")

  // Show popover
  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()

  // Get initial popover position
  const initialPopoverBox = await popover.boundingBox()
  if (!initialPopoverBox) throw new Error("Could not get popover position")

  // Scroll the page
  await page.evaluate(() => window.scrollBy(0, 100))

  // Verify popover position relative to viewport remains the same
  const newPopoverBox = await popover.boundingBox()
  if (!newPopoverBox) throw new Error("Could not get new popover position")

  expect(Math.round(newPopoverBox.x)).toBe(Math.round(initialPopoverBox.x))
  expect(Math.round(newPopoverBox.y)).toBe(Math.round(initialPopoverBox.y))
})

test("Can scroll within popover content", async ({ page, dummyLink }) => {
  await expect(dummyLink).toBeVisible()

  // Show popover
  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()

  // Get popover inner element which is scrollable
  const popoverInner = popover.locator(".popover-inner")

  // Get initial scroll position
  const initialScrollTop = await popoverInner.evaluate((el) => el.scrollTop)

  // Scroll down within the popover
  await popoverInner.evaluate((el) => {
    el.scrollTop = 100
  })

  // Verify scroll position changed
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
  await page.waitForTimeout(1000)
  await expect(popover).not.toBeVisible()
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
  await expect(metaPopover).not.toBeVisible()

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
  await expect(popover).not.toBeVisible()
})

test("Popover appears at minimal viewport width", async ({ page, dummyLink }) => {
  await page.setViewportSize({ width: minDesktopWidth + 20, height: 600 })
  await expect(dummyLink).toBeVisible()
  await dummyLink.hover()
  const popover = page.locator(".popover")
  await expect(popover).toBeVisible()
})

const popoversToTest = IGNORE_POPOVER_IDS.filter((id) => id !== "toc-content-mobile")
for (const id of popoversToTest) {
  test(`Popover does not show on ${id}`, async ({ page }) => {
    const element = page.locator(`#${id}`)
    await expect(element).toBeVisible()

    for (const link of await element.locator("a").all()) {
      await link.hover()
      const popover = page.locator(".popover")
      await expect(popover).not.toBeVisible()
    }
  })
}
