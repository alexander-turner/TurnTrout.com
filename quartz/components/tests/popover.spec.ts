import { test as base, expect, type Locator } from "@playwright/test"

import { minDesktopWidth } from "../../styles/variables"
import { scrollTolerance, popoverScrollOffset } from "../constants"
import {
  takeRegressionScreenshot,
  isDesktopViewport,
  showingPreview,
  getAllWithWait,
  isElementChecked,
} from "./visual_utils"

/** Type guard that asserts a value is defined, using expect for the assertion */
function assertDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined()
  expect(value).not.toBeNull()
}

type TestFixtures = {
  dummyLink: Locator
}

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
})

test(".can-trigger-popover links show popover on hover (lostpixel)", async ({
  page,
  dummyLink,
}, testInfo) => {
  await expect(dummyLink).toBeVisible()

  // Initial state - no popover
  let popover = page.locator(".popover-inner").first()
  await expect(popover).toBeHidden()

  await dummyLink.hover()
  popover = page.locator(".popover")
  await takeRegressionScreenshot(page, testInfo, "first-visible-popover", {
    elementToScreenshot: popover,
    preserveSiblings: true,
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
  const pageContent = await page.locator(".previewable").first().textContent()
  expect(popoverContent).toContain(pageContent)
})

test("Multiple popovers don't stack with wait", async ({ page }) => {
  const allLinks = await getAllWithWait(page.locator("#center-content .can-trigger-popover"))
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
  const allLinks = await getAllWithWait(page.locator("#center-content .can-trigger-popover"))
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
  }, popoverScrollOffset)

  expect(Math.abs(popoverScrollTop - expectedScrollTop)).toBeLessThanOrEqual(scrollTolerance)
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

test.describe("Footnote popovers", () => {
  test("Footnote popover shows only footnote content, not full article", async ({ page }) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()
    await footnoteRef.hover()

    const popover = page.locator(".popover")
    await expect(popover).toBeVisible()

    const popoverInner = popover.locator(".popover-inner")

    // Should NOT contain the li wrapper (footnote content is unwrapped)
    await expect(popoverInner.locator('li[id^="user-content-fn-"]')).toHaveCount(0)

    // Should NOT contain the back arrow link
    await expect(popoverInner.locator("[data-footnote-backref]")).toHaveCount(0)

    // Should NOT contain the article title or other page elements
    await expect(popoverInner.locator("#article-title-popover")).toHaveCount(0)
    await expect(popoverInner.locator("h1")).toHaveCount(0)
    await expect(popoverInner.locator("article")).toHaveCount(0)

    // Should contain footnote content (verify it has some content)
    const content = popoverInner
    await expect(content).not.toBeEmpty()
  })

  test("Footnote popover size reflects content size", async ({ page }) => {
    // Find the footnote with a table (should be larger)
    const tableFootnoteRef = page.locator('a[href="#user-content-fn-table"]')
    await tableFootnoteRef.scrollIntoViewIfNeeded()
    await tableFootnoteRef.hover()

    const tablePopover = page.locator(".popover")
    await expect(tablePopover).toBeVisible()
    const tablePopoverBox = await tablePopover.boundingBox()
    assertDefined(tablePopoverBox)
    const tableHeight = tablePopoverBox.height

    // Move mouse away to close popover
    await page.mouse.move(0, 0)
    await expect(tablePopover).toBeHidden()

    // Find a simple footnote (should be smaller)
    const simpleFootnoteRef = page.locator('a[href="#user-content-fn-nested"]')
    await simpleFootnoteRef.scrollIntoViewIfNeeded()
    await simpleFootnoteRef.hover()

    const simplePopover = page.locator(".popover")
    await expect(simplePopover).toBeVisible()
    const simplePopoverBox = await simplePopover.boundingBox()
    assertDefined(simplePopoverBox)
    const simpleHeight = simplePopoverBox.height

    // Table footnote should be significantly taller than simple footnote
    expect(tableHeight).toBeGreaterThan(simpleHeight * 1.5)
  })

  test("Clicking footnote link opens pinned popover (lostpixel)", async ({ page }, testInfo) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()

    await footnoteRef.click()
    const popover = page.locator(".popover.footnote-popover")
    await expect(popover).toBeVisible()
    await takeRegressionScreenshot(page, testInfo, "footnote-popover-pinned", {
      elementToScreenshot: popover,
      preserveSiblings: true,
    })
  })

  test("Clicking footnote link opens pinned popover with close button", async ({ page }) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()

    await footnoteRef.click()
    const popover = page.locator(".popover")
    await expect(popover).toBeVisible()
    await expect(popover).toHaveClass(/footnote-popover/)
    await expect(popover).toHaveAttribute("data-pinned", "true")

    // Close button should be visible
    const closeBtn = popover.locator(".popover-close")
    await expect(closeBtn).toBeVisible()

    // Clicking X closes the popover
    await closeBtn.click()
    await expect(popover).toBeHidden()
  })

  test("Pressing Escape closes pinned footnote popover", async ({ page }) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()

    await footnoteRef.click()
    const popover = page.locator(".popover")
    await expect(popover).toBeVisible()

    await page.keyboard.press("Escape")
    await expect(popover).toBeHidden()
  })

  test("Hover-triggered footnote popover closes on mouseleave", async ({ page }) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()

    await footnoteRef.hover()
    const popover = page.locator(".popover")
    await expect(popover).toBeVisible()
    // Hover-triggered: should NOT be pinned
    await expect(popover).not.toHaveAttribute("data-pinned")

    await page.mouse.move(0, 0)
    await expect(popover).toBeHidden()
  })

  test("Clicking footnote link does not scroll to footnote section", async ({ page }) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()

    const scrollBefore = await page.evaluate(() => window.scrollY)
    await footnoteRef.click()

    // Give the browser time to potentially scroll
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(300)
    const scrollAfter = await page.evaluate(() => window.scrollY)

    // Page should NOT have scrolled to the footnote section
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(50)
  })
})

// Use base (not test) so mobile tests don't inherit the desktop-only skip from the
// file-level test.beforeEach. These tests explicitly set a mobile viewport.
base.describe("Footnote popover on mobile", () => {
  base.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })
  })

  base("Tapping footnote opens pinned popover, close button dismisses it", async ({ page }) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()

    await footnoteRef.click()
    const popover = page.locator(".popover.footnote-popover")
    await expect(popover).toBeVisible()
    await expect(popover).toHaveAttribute("data-pinned", "true")

    // Close via X button
    const closeBtn = popover.locator(".popover-close")
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()
    await expect(popover).toBeHidden()
  })

  base("Tapping outside does NOT close footnote popover", async ({ page }) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()

    await footnoteRef.click()
    const popover = page.locator(".popover.footnote-popover")
    await expect(popover).toBeVisible()

    // Tap somewhere else on the page - popover should persist
    await page.locator("body").click({ position: { x: 10, y: 10 } })
    await expect(popover).toBeVisible()
  })

  base("Close button is fully visible within viewport on mobile", async ({ page }) => {
    const footnoteRef = page.locator('a[href^="#user-content-fn-"]').first()
    await footnoteRef.scrollIntoViewIfNeeded()
    await footnoteRef.click()

    const popover = page.locator(".popover.footnote-popover")
    await expect(popover).toBeVisible()

    const closeBtn = popover.locator(".popover-close")
    await expect(closeBtn).toBeVisible()

    const viewport = page.viewportSize()
    assertDefined(viewport)
    const btnBox = await closeBtn.boundingBox()
    assertDefined(btnBox)

    // Close button must be fully within the viewport
    expect(btnBox.x).toBeGreaterThanOrEqual(0)
    expect(btnBox.y).toBeGreaterThanOrEqual(0)
    expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(viewport.width)
    expect(btnBox.y + btnBox.height).toBeLessThanOrEqual(viewport.height)
  })

  base("Non-footnote popovers are still hidden on mobile", async ({ page }) => {
    const regularLink = page
      .locator('.can-trigger-popover:not([href^="#user-content-fn-"])')
      .first()
    await regularLink.scrollIntoViewIfNeeded()
    await regularLink.click()
    const popover = page.locator(".popover:not(.footnote-popover)")
    await expect(popover).toBeHidden()
  })
})

test.describe("Popover checkbox state preservation", () => {
  const baseSelector = "h1 + ol #checkbox-0"

  test.beforeEach(async ({ page }) => {
    // Check a checkbox on the test page
    const mainPageCheckbox = page.locator(baseSelector).first()
    await mainPageCheckbox.scrollIntoViewIfNeeded()

    const initialChecked = await isElementChecked(mainPageCheckbox)
    expect(initialChecked).toBe(false)

    await mainPageCheckbox.click()
    const checkedAfterClick = await isElementChecked(mainPageCheckbox)
    expect(checkedAfterClick).toBe(true)
  })

  test("Popover preserves checkbox state", async ({ page }) => {
    await page.goto("http://localhost:8080/design", { waitUntil: "load" })

    const linkToTestPage = page.locator('a[href*="test-page"]').last()
    await linkToTestPage.scrollIntoViewIfNeeded()
    await expect(linkToTestPage).toBeVisible()

    await linkToTestPage.hover()
    const popover = page.locator(".popover")
    await expect(popover).toBeVisible()

    const popoverCheckbox = popover.locator(baseSelector).first()
    const popoverChecked = await isElementChecked(popoverCheckbox)
    expect(popoverChecked).toBe(true)
  })

  test("Popover with checked checkbox visual appearance (lostpixel)", async ({
    page,
  }, testInfo) => {
    const linkToHover = page.locator("a#checkboxes-link").first()
    await linkToHover.hover()

    const popover = page.locator(".popover")
    await expect(popover).toBeVisible()
    await takeRegressionScreenshot(page, testInfo, "popover-checked-checkbox", {
      elementToScreenshot: popover,
      preserveSiblings: true, // Need this to take screenshot
    })
  })
})
