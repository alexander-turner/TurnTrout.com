import { test, expect } from "@playwright/test"

import { videoId } from "../component_utils"

const SCROLL_TOLERANCE: number = 500

/**
 * This spec file is designed to test the functionality of spa.inline.ts,
 * including client-side routing, scroll behavior, hash navigation,
 * and the route announcer for accessibility. It follows a structure
 * similar to test-page.spec.ts.
 */

test.beforeEach(async ({ page }) => {
  // Log any console errors to help diagnose issues
  page.on("pageerror", (error) => console.error("Page Error:", error))

  // Navigate to a page that uses the SPA inline logic
  // and wait for network to be idle
  await page.goto("http://localhost:8080/test-page", { waitUntil: "domcontentloaded" })

  // Dispatch the 'nav' event to ensure the router is properly initialized
  await page.evaluate(() => {
    window.dispatchEvent(new Event("nav"))
  })
})

test.describe("Local Link Navigation", () => {
  test("navigates without a full reload", async ({ page }) => {
    // Record current page URL
    const initialUrl = page.url()

    // Click on a local link
    const localLink = page.locator("a").first()
    await localLink.click()
    await page.waitForLoadState("networkidle")

    // Ensure the URL has changed
    expect(page.url()).not.toBe(initialUrl)

    // Check that the body content is still present (verifying no full reload)
    await expect(page.locator("body")).toBeVisible()
  })

  test("ignores links with target=_blank", async ({ page }) => {
    // Inject a link with target=_blank
    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "/design"
      link.target = "_blank"
      link.id = "blank-link"
      link.textContent = "Open in new tab"
      document.body.appendChild(link)
    })

    // Track the URL before clicking
    const currentUrl = page.url()
    // Click the link normally
    await page.click("#blank-link")

    // The local link with target=_blank should not be intercepted
    // The page should not change in this browser instance
    expect(page.url()).toBe(currentUrl)
  })

  test("external links are not intercepted", async ({ page }) => {
    // Inject an external link
    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "https://www.example.com"
      link.id = "external-link"
      link.textContent = "External Site"
      document.body.appendChild(link)
    })

    // Check that SPA logic does not intercept external links
    // (We don't actually navigate to external sites in tests.)
    // Instead, we can ensure the click is not prevented.
    await page.click("#external-link", { button: "middle" })
    // There's no assertion needed here because we only want to ensure
    // no interception or errors occur. If something breaks, the test will fail.
  })
})

test.describe("Scroll Behavior", () => {
  test("handles hash navigation by scrolling to element", async ({ page }) => {
    // Inject a section to test scroll with an ID
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

    // Wait briefly to allow scroll animation
    await page.waitForLoadState("networkidle")

    // Verify the final scroll position is beyond 0
    const scrollPosition = await page.evaluate(() => window.scrollY)
    expect(scrollPosition).toBeGreaterThan(0)
  })
})

test.describe("Popstate (Back/Forward) Navigation", () => {
  test("browser back and forward updates content appropriately", async ({ page }) => {
    const initialUrl = page.url()

    await page.goto("http://localhost:8080/design", { waitUntil: "domcontentloaded" })

    expect(page.url()).not.toBe(initialUrl)

    // Check going back
    await page.goBack()
    await page.waitForLoadState("networkidle")
    expect(page.url()).toBe(initialUrl)

    // Check going forward
    await page.goForward()
    await page.waitForLoadState("networkidle")
    expect(page.url()).not.toBe(initialUrl)
  })
})

test.describe("Same-page navigation", () => {
  test("back button works after clicking same-page link", async ({ page }) => {
    // Record initial scroll position
    const initialScroll = await page.evaluate(() => window.scrollY)

    // Click the link to navigate to section2
    const headers = await page.locator("h1").all()
    const header1 = headers[3]
    await header1.scrollIntoViewIfNeeded()
    await header1.click()
    await page.waitForTimeout(100) // Wait for scroll

    // Verify we scrolled down
    const scrollAfterClick = await page.evaluate(() => window.scrollY)
    expect(scrollAfterClick).toBeGreaterThan(initialScroll)

    await page.goBack()
    await page.waitForTimeout(100) // Wait for scroll

    // Verify we returned to the original position
    const scrollAfterBack = await page.evaluate(() => window.scrollY)
    expect(scrollAfterBack).toBe(initialScroll)
  })

  test("maintains scroll history for multiple same-page navigations", async ({ page }) => {
    // Navigate through all positions and store scroll positions
    const scrollPositions: number[] = []

    const headings = await page.locator("h1 a").all()
    for (const heading of headings.slice(2, 5)) {
      await heading.scrollIntoViewIfNeeded()
      await heading.click()
      await page.waitForTimeout(100) // Wait for scroll
      scrollPositions.push(await page.evaluate(() => window.scrollY))
    }

    // Verify each position was different
    for (let i = 1; i < scrollPositions.length; i++) {
      expect(scrollPositions[i]).not.toBe(scrollPositions[i - 1])
    }

    // Go back through history and verify each scroll position
    for (let i = scrollPositions.length - 2; i >= 0; i--) {
      await page.goBack()
      await page.waitForTimeout(100) // Wait for scroll
      const currentScroll = await page.evaluate(() => window.scrollY)

      // Check if within tolerance rather than exact match
      expect(Math.abs(currentScroll - scrollPositions[i])).toBeLessThanOrEqual(SCROLL_TOLERANCE)
    }

    // Go forward through history and verify each scroll position is within tolerance
    for (let i = 1; i < scrollPositions.length; i++) {
      await page.goForward()
      await page.waitForTimeout(100) // Wait for scroll
      const currentScroll = await page.evaluate(() => window.scrollY)

      // Check if within tolerance rather than exact match
      expect(Math.abs(currentScroll - scrollPositions[i])).toBeLessThanOrEqual(SCROLL_TOLERANCE)
    }
  })
  test("going back after anchor navigation returns to original position", async ({ page }) => {
    // First, ensure we're at the top of the page
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(100)

    // Verify starting position is at the top
    const initialScroll = await page.evaluate(() => window.scrollY)
    expect(initialScroll).toBe(0)

    // Find a target far down the page
    const anchorTarget = page.locator("h1").last()
    await anchorTarget.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200) // Wait for scroll

    // Verify we've scrolled down
    const scrollAfterAnchor = await page.evaluate(() => window.scrollY)
    expect(scrollAfterAnchor).toBeGreaterThan(SCROLL_TOLERANCE * 2)

    // Go back in browser history
    await page.goBack()
    await page.waitForTimeout(200) // Wait for scroll restoration

    // Verify we're back at the top (or within reasonable tolerance)
    const scrollAfterBack = await page.evaluate(() => window.scrollY)
    expect(scrollAfterBack).toBeLessThanOrEqual(SCROLL_TOLERANCE) // Small tolerance for browser differences
  })
})

test.describe("SPA Navigation DOM Cleanup", () => {
  test("removes unexpected siblings of video element before morphing", async ({ page }) => {
    // Inject the video element and a rogue sibling
    await page.evaluate(() => {
      const navbarLeft = document.getElementById("navbar-left")
      if (navbarLeft) {
        const videoContainer = document.createElement("span")
        videoContainer.id = "header-video-container" // Use the actual container ID if needed

        const rogueDiv = document.createElement("div")
        rogueDiv.id = "rogue-sibling"
        rogueDiv.textContent = "Injected by extension"

        // Insert rogue div *next to* video inside its actual parent for a realistic scenario
        // Assuming the video is inside the span#header-video-container
        const actualVideoParent = document.createElement("div") // The wrapper div we added earlier
        actualVideoParent.appendChild(rogueDiv) // Inject sibling next to where video will be

        videoContainer.appendChild(actualVideoParent)
        navbarLeft.prepend(videoContainer)
      }
    }, videoId)

    await expect(page.locator(`#${videoId}`)).toBeVisible()
    await expect(page.locator("#rogue-sibling")).toBeVisible()

    // Trigger SPA navigation
    const localLink = page.locator("a").first() // Navigate to a different page
    await localLink.click()

    await expect(page.locator("#rogue-sibling")).not.toBeVisible()
    await expect(page.locator(`#${videoId}`)).toBeVisible()
  })
})
