/**
 * This spec file is designed to test the functionality of spa.inline.ts,
 * including client-side routing, scroll behavior, hash navigation,
 * and the route announcer for accessibility.
 */

import { type Page, test, expect } from "@playwright/test"

import { pondVideoId } from "../component_utils"
import { DEBOUNCE_WAIT_MS } from "../scripts/spa_utils"
import { isDesktopViewport } from "../tests/visual_utils"

const LARGE_SCROLL_TOLERANCE: number = 500 // TODO make this smaller after fixing image CLS
const TIGHT_SCROLL_TOLERANCE: number = 10
const DEBOUNCE_WAIT_BUFFERED: number = DEBOUNCE_WAIT_MS + 50

async function scrollWithWait(page: Page, scrollPos: number): Promise<void> {
  await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), scrollPos)
  await page.waitForTimeout(DEBOUNCE_WAIT_BUFFERED)
  await page.waitForFunction(
    () =>
      window.history.state &&
      typeof window.history.state.scroll === "number" &&
      window.history.state.scroll >= 0,
  )
}

async function addMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface WindowWithMarker extends Window {
      spaNavigationTestMarker?: boolean
    }
    ;(window as WindowWithMarker).spaNavigationTestMarker = true
  })
}

async function doesMarkerExist(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    interface WindowWithMarker extends Window {
      spaNavigationTestMarker?: boolean
    }
    return (window as WindowWithMarker).spaNavigationTestMarker === true
  })
}

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
  const testCases: [string, string][] = [
    ["http://localhost:8080/design", "Design"],
    ["http://localhost:8080/", "Home"], // An alias for /index.html
  ]

  for (const [href] of testCases) {
    test(`navigates without a full reload for ${href}`, async ({ page }: { page: Page }) => {
      const initialUrl = page.url()

      await addMarker(page)

      await page.evaluate((linkHref: string) => {
        const link = document.createElement("a")
        link.href = linkHref
        link.textContent = "Text"
        document.body.appendChild(link)
      }, href)

      const designLink = page.locator("a").last()
      await designLink.scrollIntoViewIfNeeded()
      await designLink.click()
      await page.waitForLoadState("domcontentloaded")

      // Explicitly wait for the URL to change
      await page.waitForURL((url) => url.toString() !== initialUrl)

      // Check if the marker still exists, indicating no full reload
      const markerExists = await doesMarkerExist(page)
      expect(markerExists).toBe(true)
      await expect(page.locator("body")).toBeVisible()
    })
  }

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

  for (const [scrollPos] of [[50], [100], [1000]]) {
    test(`restores scroll position on page refresh to ${scrollPos}`, async ({ page }) => {
      await scrollWithWait(page, scrollPos)
      await page.reload({ waitUntil: "networkidle" })

      const currentScroll = await page.evaluate(() => window.scrollY)
      expect(Math.abs(currentScroll - scrollPos)).toBeLessThanOrEqual(TIGHT_SCROLL_TOLERANCE)
    })

    test(`after navigating to a hash and scrolling further, a refresh restores the later scroll position to ${scrollPos}`, async ({
      page,
    }) => {
      await page.goto("http://localhost:8080/test-page#header-3")

      await scrollWithWait(page, scrollPos)
      await page.reload()

      const currentScroll = await page.evaluate(() => window.scrollY)
      expect(Math.abs(currentScroll - scrollPos)).toBeLessThanOrEqual(TIGHT_SCROLL_TOLERANCE)
    })
  }

  test("restores scroll position when refreshing on hash", async ({ page }) => {
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

  test("maintains scroll history for multiple same-page navigations", async ({ page }) => {
    const scrollPositions: number[] = []

    const headings = await page.locator("h1 a").all()
    for (const heading of headings.slice(2, 5)) {
      await heading.scrollIntoViewIfNeeded()
      await heading.click()
      await page.waitForTimeout(DEBOUNCE_WAIT_BUFFERED)
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
      await page.waitForTimeout(DEBOUNCE_WAIT_BUFFERED)
      await page.waitForLoadState("networkidle")
      const currentScroll = await page.evaluate(() => window.scrollY)
      expect(Math.abs(currentScroll - scrollPositions[i])).toBeLessThanOrEqual(
        LARGE_SCROLL_TOLERANCE,
      )
    }

    // Go forward through history and verify scroll positions
    for (let i = 1; i < scrollPositions.length; i++) {
      await page.goForward()
      await page.waitForTimeout(DEBOUNCE_WAIT_BUFFERED)
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
    }, pondVideoId)

    await expect(page.locator(`#${pondVideoId}`)).toBeVisible()
    await expect(page.locator("#rogue-sibling")).toBeVisible()

    // Trigger SPA navigation
    const localLink = page.locator("a").first()
    await localLink.click()

    // Verify rogue sibling is removed, video remains
    await expect(page.locator("#rogue-sibling")).not.toBeVisible()
    await expect(page.locator(`#${pondVideoId}`)).toBeVisible()
  })
})

// TODO http://localhost:8080/read-hpmor can't refresh partway through page without flash before it sets the scroll position

test("restores scroll position when returning from external page", async ({ page }) => {
  // Insert link to external page
  await page.evaluate(() => {
    const link = document.createElement("a")
    link.href = "https://github.com/alexander-turner"
    link.textContent = "External link"
    document.body.prepend(link)
  })

  // Navigate to external page
  const externalLink = page.locator("a").first()
  await externalLink.click()

  await page.evaluate(() => window.scrollTo(0, 100))

  await page.goBack({ waitUntil: "networkidle" })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test.describe("Fetch & Redirect Handling", () => {
  test("successfully handles meta-refresh redirect", async ({ page }) => {
    const sourcePath = "/redirect-source"
    const targetPath = "/redirect-target"
    const targetContent = "Redirect Target Content"

    // Mock the server response for the source and target paths
    await page.route(`**${sourcePath}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<html><head><meta http-equiv="refresh" content="0; url=${targetPath}"></head><body>Redirecting...</body></html>`,
      })
    })
    await page.route(`**${targetPath}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<html><head><title>Target Page</title></head><body><h1>${targetContent}</h1></body></html>`,
      })
    })

    await addMarker(page)
    await page.evaluate(
      (path) => window.spaNavigate(new URL(path, window.location.origin)),
      sourcePath,
    )
    await page.waitForLoadState("domcontentloaded")

    // Check marker, content, and URL
    expect(await doesMarkerExist(page)).toBe(true)
    await expect(page.locator("h1")).toHaveText(targetContent)
    expect(page.url()).toContain(sourcePath) // URL should be the original requested one
  })

  test("falls back to full load on non-HTML initial fetch", async ({ page }) => {
    const nonHtmlPath = "/non-html"
    await page.route(`**${nonHtmlPath}`, (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    })

    await addMarker(page)
    // Use evaluate to trigger navigation and wait for potential reload
    await page.evaluate(
      (path) => window.spaNavigate(new URL(path, window.location.origin)),
      nonHtmlPath,
    )
    await page.waitForLoadState("load") // Wait for full potentially reloaded page

    await expect(doesMarkerExist(page)).rejects.toThrow(/Execution context was destroyed/)
  })

  test("falls back to full load on initial fetch error", async ({ page }) => {
    const errorPath = "/fetch-error"
    await page.route(`**${errorPath}`, (route) => route.abort())

    await addMarker(page)
    await page.evaluate(
      (path) => window.spaNavigate(new URL(path, window.location.origin)),
      errorPath,
    )
    await page.waitForLoadState("load")

    await expect(doesMarkerExist(page)).rejects.toThrow(/Execution context was destroyed/)
  })

  test("falls back to full load on non-HTML redirect target", async ({ page }) => {
    const sourcePath = "/redirect-source-bad-target"
    const targetPath = "/non-html-target"

    await page.route(`**${sourcePath}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<html><head><meta http-equiv="refresh" content="0; url=${targetPath}"></head></html>`,
      })
    })
    await page.route(`**${targetPath}`, (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    })

    await addMarker(page)
    await page.evaluate(
      (path) => window.spaNavigate(new URL(path, window.location.origin)),
      sourcePath,
    )
    await page.waitForLoadState("load")

    expect(page.url()).toContain(targetPath)
  })

  test("falls back to full load on redirect target fetch error", async ({ page }) => {
    const sourcePath = "/redirect-source-error-target"
    const targetPath = "/error-target"

    await page.route(`**${sourcePath}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<html><head><meta http-equiv="refresh" content="0; url=${targetPath}"></head></html>`,
      })
    })
    // Abort the request to the target path
    await page.route(`**${targetPath}`, (route) => route.abort())

    await addMarker(page)

    let targetRequestFailed = false
    page.on("requestfailed", (request) => {
      if (request.url().endsWith(targetPath)) {
        targetRequestFailed = true
      }
    })

    // Trigger the navigation that should lead to the failed fetch and fallback attempt
    await page.evaluate(
      (path) => window.spaNavigate(new URL(path, window.location.origin)),
      sourcePath,
    )

    expect(targetRequestFailed).toBe(true)
  })
})
