import { test, expect } from "@playwright/test"

import { videoId } from "../component_utils"
import { isDesktopViewport } from "../tests/visual_utils"

const LARGE_SCROLL_TOLERANCE: number = 500 // TODO make this smaller after fixing image CLS
const TIGHT_SCROLL_TOLERANCE: number = 10

/**
 * This spec file is designed to test the functionality of spa.inline.ts,
 * including client-side routing, scroll behavior, hash navigation,
 * and the route announcer for accessibility.
 */

test.beforeEach(async ({ page }) => {
  // Log any console errors to help diagnose issues
  page.on("pageerror", (error) => console.error("Page Error:", error))

  // Navigate to a page that uses the SPA inline logic
  await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })

  // Dispatch the 'nav' event to ensure the router is properly initialized
  await page.evaluate(() => {
    window.dispatchEvent(new Event("nav"))
  })
})

test.describe("Local Link Navigation", () => {
  test("navigates without a full reload", async ({ page }) => {
    const initialUrl = page.url()

    const localLink = page.locator("a").first()
    await localLink.click()
    await page.waitForLoadState("networkidle")

    expect(page.url()).not.toBe(initialUrl)
    await expect(page.locator("body")).toBeVisible()
  })

  test("ignores links with target=_blank", async ({ page }) => {
    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "/design"
      link.target = "_blank"
      link.id = "blank-link"
      link.textContent = "Open in new tab"
      document.body.appendChild(link)
    })

    const currentUrl = page.url()
    await page.click("#blank-link")

    // The local link with target=_blank should not be intercepted
    expect(page.url()).toBe(currentUrl)
  })

  test("external links are not intercepted", async ({ page }) => {
    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "https://www.example.com"
      link.id = "external-link"
      link.textContent = "External Site"
      document.body.appendChild(link)
    })

    // Check that SPA logic does not intercept external links
    // We don't actually navigate to external sites in tests.
    // Instead, we can ensure the click is not prevented by middle-clicking.
    await page.click("#external-link", { button: "middle" })
  })
})

test.describe("Scroll Behavior", () => {
  test("handles hash navigation by scrolling to element", async ({ page }) => {
    // Inject a section far down the page to test scroll
    await page.evaluate(() => {
      const section = document.createElement("div")
      section.id = "test-scroll-section"
      section.style.marginTop = "1500px"
      document.body.appendChild(section)
    })

    // Create a hash link and click it
    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "#test-scroll-section"
      link.id = "hash-link"
      link.textContent = "Scroll to test section"
      document.body.appendChild(link)
    })
    await page.click("#hash-link")
    await page.waitForLoadState("networkidle")

    const scrollPosition = await page.evaluate(() => window.scrollY)
    expect(Math.abs(scrollPosition)).toBeGreaterThan(0)
  })

  test("restores scroll position on page refresh", async ({ page }) => {
    const targetScroll = 50
    await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), targetScroll)
    await page.waitForLoadState("networkidle")

    let currentScroll = await page.evaluate(() => window.scrollY)
    expect(currentScroll).toBe(targetScroll)

    await page.reload({ waitUntil: "networkidle" })

    currentScroll = await page.evaluate(() => window.scrollY)
    expect(Math.abs(currentScroll - targetScroll)).toBeLessThanOrEqual(TIGHT_SCROLL_TOLERANCE)
  })

  test("Restores scroll position when refreshing on hash", async ({ page }) => {
    const hash = "header-3"
    await page.goto(`http://localhost:8080/test-page#${hash}`, { waitUntil: "load" })
    const currentScroll = await page.evaluate(() => window.scrollY)
    expect(currentScroll).toBeGreaterThan(0)

    await page.reload({ waitUntil: "networkidle" })
    const newScroll = await page.evaluate(() => window.scrollY)
    expect(newScroll).toBeGreaterThan(0)
    expect(Math.abs(newScroll - currentScroll)).toBeLessThanOrEqual(TIGHT_SCROLL_TOLERANCE)
  })
})

// TODO make tests ignore images/videos? Due to CLS
test.describe("Popstate (Back/Forward) Navigation", () => {
  test("browser back and forward updates content appropriately", async ({ page }) => {
    const initialUrl = page.url()

    await page.goto("http://localhost:8080/design", { waitUntil: "domcontentloaded" })
    expect(page.url()).not.toBe(initialUrl)

    await page.goBack()
    await page.waitForLoadState("networkidle")
    expect(page.url()).toBe(initialUrl)

    await page.goForward()
    await page.waitForLoadState("networkidle")
    expect(page.url()).not.toBe(initialUrl)
  })
})

test.describe("Same-page navigation", () => {
  test("click same-page link, go back, check scroll is reset to top", async ({ page }) => {
    const initialScroll = await page.evaluate(() => window.scrollY)
    expect(initialScroll).toBe(0)

    const selector = isDesktopViewport(page) ? "#toc-content a" : "#toc-content-mobile a"
    const headers = await page.locator(selector).all()
    await headers[3].click()
    await page.waitForFunction(() => window.scrollY > 0)

    const scrollAfterClick = await page.evaluate(() => window.scrollY)
    expect(scrollAfterClick).toBeGreaterThan(initialScroll)

    await page.goBack()
    await page.waitForFunction((tolerance) => window.scrollY <= tolerance, TIGHT_SCROLL_TOLERANCE)

    const scrollAfterBack = await page.evaluate(() => window.scrollY)
    expect(scrollAfterBack).toBeLessThanOrEqual(TIGHT_SCROLL_TOLERANCE)
  })

  // TODO test can go forward and back multiple times

  test("maintains scroll history for multiple same-page navigations", async ({ page }) => {
    const scrollPositions: number[] = []

    const headings = await page.locator("h1 a").all()
    for (const heading of headings.slice(2, 5)) {
      await heading.scrollIntoViewIfNeeded()
      await heading.click()
      await page.waitForLoadState("networkidle")
      scrollPositions.push(await page.evaluate(() => window.scrollY))
    }

    // Verify each position was different
    for (let i = 1; i < scrollPositions.length; i++) {
      expect(scrollPositions[i]).not.toBe(scrollPositions[i - 1])
    }

    // Go back through history and verify each scroll position
    for (let i = scrollPositions.length - 2; i >= 0; i--) {
      await page.goBack()
      await page.waitForLoadState("networkidle")
      const currentScroll = await page.evaluate(() => window.scrollY)
      expect(Math.abs(currentScroll - scrollPositions[i])).toBeLessThanOrEqual(
        LARGE_SCROLL_TOLERANCE,
      )
    }

    // Go forward through history and verify scroll positions
    for (let i = 1; i < scrollPositions.length; i++) {
      await page.goForward()
      await page.waitForLoadState("networkidle")
      const currentScroll = await page.evaluate(() => window.scrollY)
      expect(Math.abs(currentScroll - scrollPositions[i])).toBeLessThanOrEqual(
        LARGE_SCROLL_TOLERANCE,
      )
    }
  })

  test("going back after anchor navigation returns to original position", async ({ page }) => {
    // Ensure we're at the top
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForLoadState("networkidle")
    const initialScroll = await page.evaluate(() => window.scrollY)
    expect(initialScroll).toBe(0)

    // Find a target far down the page and scroll to it
    const anchorTarget = page.locator("h1").last()
    await anchorTarget.scrollIntoViewIfNeeded()
    await page.waitForLoadState("networkidle")

    const scrollAfterAnchor = await page.evaluate(() => window.scrollY)
    expect(scrollAfterAnchor).toBeGreaterThan(LARGE_SCROLL_TOLERANCE * 2)

    // Go back
    await page.goBack()
    await page.waitForLoadState("networkidle")

    // Verify we're back at the top (within tolerance)
    const scrollAfterBack = await page.evaluate(() => window.scrollY)
    expect(scrollAfterBack).toBeLessThanOrEqual(LARGE_SCROLL_TOLERANCE)
  })
})

test.describe("SPA Navigation DOM Cleanup", () => {
  test("removes unexpected siblings of video element before morphing", async ({ page }) => {
    if (!isDesktopViewport(page)) {
      // Video element is not visible on mobile
      test.skip()
    }
    // Inject the video element structure and a rogue sibling for testing
    await page.evaluate(() => {
      const navbarLeft = document.getElementById("navbar-left")
      if (navbarLeft) {
        const videoContainer = document.createElement("span")
        videoContainer.id = "header-video-container"

        const rogueDiv = document.createElement("div")
        rogueDiv.id = "rogue-sibling"
        rogueDiv.textContent = "Injected by extension"

        const actualVideoParent = document.createElement("div")
        actualVideoParent.appendChild(rogueDiv) // Inject sibling

        videoContainer.appendChild(actualVideoParent)
        navbarLeft.prepend(videoContainer)
      }
    }, videoId)

    await expect(page.locator(`#${videoId}`)).toBeVisible()
    await expect(page.locator("#rogue-sibling")).toBeVisible()

    // Trigger SPA navigation
    const localLink = page.locator("a").first()
    await localLink.click()

    // Verify rogue sibling is removed, video remains
    await expect(page.locator("#rogue-sibling")).not.toBeVisible()
    await expect(page.locator(`#${videoId}`)).toBeVisible()
  })
})

// TODO http://localhost:8080/read-hpmor can't refresh partway through page without flash before it sets the scroll position
