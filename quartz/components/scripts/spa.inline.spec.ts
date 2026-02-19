/**
 * This spec file is designed to test the functionality of spa.inline.ts,
 * including client-side routing, scroll behavior, hash navigation,
 * and the route announcer for accessibility.
 *
 * Watch out for:
 *  - Playwright implicitly scrolling when clicking on an anchor
 */

import type { Page } from "@playwright/test"

import { simpleConstants, tightScrollTolerance, testPageSlug } from "../constants"
import { test, expect } from "../tests/fixtures"
import { isDesktopViewport, getAllWithWait } from "../tests/visual_utils"

const { pondVideoId } = simpleConstants

const testingPageSlug = testPageSlug

/*
 * Use this when you're waiting for the browser to complete a scroll. It's a good proxy.
 */
async function waitForHistoryState(page: Page, targetPos: number): Promise<void> {
  await page.waitForFunction(
    ({ target, tolerance }) => {
      return (
        window.history.state &&
        typeof window.history.state.scroll === "number" &&
        Math.abs(window.history.state.scroll - target) <= tolerance
      )
    },
    { target: targetPos, tolerance: tightScrollTolerance },
  )
}

async function waitForHistoryScrollNotEquals(
  page: Page,
  initialScroll: number | undefined,
): Promise<void> {
  await page.waitForFunction((initial) => {
    return window.history.state?.scroll !== initial
  }, initialScroll)
}

/**
 * Waits for hash navigation to complete and scroll position to be saved to history state.
 * More reliable than fixed timeouts for cross-browser compatibility.
 */
async function waitForHashScrollComplete(page: Page): Promise<void> {
  // Wait for scroll to be saved to history (debounced by 100ms)
  await page.waitForFunction(() => {
    return (
      window.history.state &&
      typeof window.history.state.scroll === "number" &&
      window.history.state.scroll > 0
    )
  })

  // Wait for scroll position to stabilize (no changes between checks)
  await page.waitForFunction(() => {
    if (!window.history.state?.scroll) return false
    const stablePos = window.history.state.scroll
    return Math.abs(window.scrollY - stablePos) < 5
  })
}

/*
 * Verifies that the browser has scrolled to approximately the target position.
 */
async function waitForScroll(page: Page, targetScrollY: number, timeout = 30000): Promise<void> {
  await page.waitForFunction(
    ({ target, tolerance }) => {
      const currentScrollY = window.scrollY
      return Math.abs(currentScrollY - target) <= tolerance
    },
    { target: targetScrollY, tolerance: tightScrollTolerance },
    { timeout },
  )
}

// Normal page.reload() will wipe the history state
async function softRefresh(page: Page): Promise<void> {
  await page.goBack()
  await page.goForward()
}

async function addMarker(page: Page): Promise<void> {
  await page.evaluate(() => {
    interface WindowWithMarker extends Window {
      spaNavigationTestMarker?: boolean
    }
    ;(window as WindowWithMarker).spaNavigationTestMarker = true
  })
}

// A reliable way to create an anchor at the bottom of the page
async function createFinalAnchor(page: Page): Promise<string> {
  const anchorId = "final-anchor"
  await page.evaluate((id) => {
    const finalAnchor = document.createElement("a")
    finalAnchor.id = id
    finalAnchor.href = `#${id}`
    finalAnchor.style.marginTop = "2000px"
    document.body.appendChild(finalAnchor)
  }, anchorId)
  return anchorId
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
  await page.goto(`http://localhost:8080/${testingPageSlug}`, { waitUntil: "domcontentloaded" })

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
      // OK to click since we aren't depending on scroll position
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
    // Mock the external URL to avoid real network requests in CI
    await page.route("https://www.example.com/**", (route) =>
      route.fulfill({ status: 200, body: "<html><body>External</body></html>" }),
    )

    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "https://www.example.com"
      link.id = "external-link"
      link.textContent = "External Site"
      document.body.appendChild(link)
    })

    // Check that SPA logic does not intercept external links
    await page.click("#external-link")
    await expect(page).toHaveURL("https://www.example.com")
  })
})

test.describe("Scroll Behavior", () => {
  test("handles hash navigation by scrolling to element", async ({ page }) => {
    const anchorId = await createFinalAnchor(page)
    await page.goto(`http://localhost:8080/${testingPageSlug}#${anchorId}`, {
      waitUntil: "domcontentloaded",
    })
    await waitForHistoryScrollNotEquals(page, undefined)

    const scrollPosition = await page.evaluate(() => window.scrollY)
    expect(Math.abs(scrollPosition)).toBeGreaterThan(0)
  })

  test("clicking the TOC title clears the hash", async ({ page }) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")

    // Scroll down the page
    const finalAnchor = await createFinalAnchor(page)
    await page.goto(`http://localhost:8080/${testingPageSlug}#${finalAnchor}`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForURL(`**/${testingPageSlug}#${finalAnchor}`)
    await waitForHistoryScrollNotEquals(page, undefined)

    const tocTitle = page.locator("#toc-title button")
    await expect(tocTitle).toBeVisible()
    await tocTitle.click()

    // Verify the URL is no longer the anchor
    await page.waitForURL(`**/${testingPageSlug}`)
  })

  test("even when the page is scrolled down, clicking the TOC title scrolls to the top", async ({
    page,
  }) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")

    await page.evaluate(() => window.scrollTo(0, 500))
    // Wait for scroll to enter the history state
    await waitForHistoryScrollNotEquals(page, undefined)

    const tocTitle = page.locator("#toc-title button")
    await expect(tocTitle).toBeVisible()
    await tocTitle.click()

    await waitForScroll(page, 0)
  })

  for (const [scrollPos] of [[100], [300], [1000]]) {
    // eslint-disable-next-line playwright/expect-expect
    test(`restores scroll position on page refresh to ${scrollPos}`, async ({ page }) => {
      await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), scrollPos)
      await waitForScroll(page, scrollPos)
      await waitForHistoryState(page, scrollPos)
      await softRefresh(page)
      await waitForScroll(page, scrollPos)
    })

    // eslint-disable-next-line playwright/expect-expect
    test(`after navigating to a hash and scrolling further, a refresh restores the later scroll position to ${scrollPos}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !isDesktopViewport(page) && testInfo.project.use.browserName === "webkit",
        "Mobile Safari has unreliable scroll restoration after hash navigation",
      )

      const anchorId = await createFinalAnchor(page)
      await page.goto(`http://localhost:8080/${testingPageSlug}#${anchorId}`, {
        waitUntil: "domcontentloaded",
      })

      // Wait for hash scroll to complete and be saved to history
      await waitForHashScrollComplete(page)
      await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), scrollPos)
      await waitForScroll(page, scrollPos)
      await waitForHistoryState(page, scrollPos)
      await softRefresh(page)

      await waitForScroll(page, scrollPos)
    })
  }

  // eslint-disable-next-line playwright/expect-expect
  test("Restores scroll position across multiple refreshes", async ({ page }) => {
    const targetScroll = 200
    await page.evaluate((targetScroll) => window.scrollTo(0, targetScroll), targetScroll)
    await waitForScroll(page, targetScroll)
    await waitForHistoryState(page, targetScroll)

    for (let i = 0; i < 5; i++) {
      await softRefresh(page)
      await waitForScroll(page, targetScroll)
    }
  })

  // NOTE on Safari, sometimes px is ~300 and sometimes it's 517 (like the other browsers); seems to be ~300 when run alone?
  test("restores scroll position when refreshing on hash", async ({ page }) => {
    const anchorId = await createFinalAnchor(page)
    await page.goto(`http://localhost:8080/${testingPageSlug}#${anchorId}`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForFunction(() => window.history.state?.scroll)
    const currentScroll = await page.evaluate(() => window.scrollY)
    expect(currentScroll).toBeGreaterThan(0)

    await softRefresh(page)
    await waitForScroll(page, currentScroll)
  })

  test("handles text fragment navigation for terms that don't exist on page", async ({ page }) => {
    const nonExistentTerm = "xyznonexistentterm123"
    await page.goto(`http://localhost:8080/${testingPageSlug}#:~:text=${nonExistentTerm}`, {
      waitUntil: "domcontentloaded",
    })

    // Even if no matches are found on the page, navigation should succeed
    // and the page should remain at the top (scroll position 0)
    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toEqual(0)
    await expect(page.locator("body")).toBeVisible()
  })
})

test.describe("Instant Scroll Restoration", () => {
  test("restores saved scroll position immediately on reload", async ({ page }) => {
    const scrollPos = 500
    await page.evaluate((pos) => window.scrollTo(0, pos), scrollPos)
    await waitForHistoryState(page, scrollPos)

    // Track network requests to see if our script is loaded
    const requests: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("instantScrollRestoration")) {
        requests.push(request.url())
      }
    })

    await page.reload({ waitUntil: "domcontentloaded" })

    // Check final scroll position
    const finalScroll = await page.evaluate(() => window.scrollY)

    expect(finalScroll).toBeCloseTo(scrollPos, -1)
  })

  test("restores hash position immediately on reload", async ({ page }) => {
    const anchorId = "lists"

    // Navigate to hash and record position
    await page.goto(`http://localhost:8080/${testingPageSlug}#${anchorId}`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForLoadState("load")
    const expectedScrollY = await page.evaluate(() => window.scrollY)
    expect(expectedScrollY).toBeGreaterThan(0)

    // Reload and wait for completion
    await page.reload({ waitUntil: "domcontentloaded" })

    // Wait until the page has scrolled somewhere below the top
    await page.waitForFunction(() => window.scrollY > 0)

    const finalScroll = await page.evaluate(() => window.scrollY)

    expect(finalScroll).toBeGreaterThan(0)
  })

  test("scrolls to hash position on initial page load", async ({ page }) => {
    const slug = "design#color-scheme"
    expect(page.url()).not.toContain(slug)

    await page.goto(`http://localhost:8080/${slug}`)
    await page.waitForLoadState("domcontentloaded")

    const finalScroll = await page.evaluate(() => window.scrollY)
    expect(finalScroll).toBeGreaterThan(0)
  })

  test("layout stability monitoring cancels when user scrolls", async ({ page }) => {
    const scrollPos = 500
    await page.evaluate((pos) => window.scrollTo(0, pos), scrollPos)
    await waitForHistoryState(page, scrollPos)

    // Track console messages to verify monitoring cancellation
    const consoleMessages: string[] = []
    page.on("console", (msg) => {
      if (msg.text().includes("InstantScrollRestoration")) {
        consoleMessages.push(msg.text())
      }
    })

    await page.reload({ waitUntil: "domcontentloaded" })

    // Wait for layout stability monitoring to start
    await page.waitForFunction(() => {
      return window.scrollY > 0
    })

    // Ensure the layout monitoring has begun before triggering user scroll.
    // We wait until at least one InstantScrollRestoration console message has appeared.
    await expect
      .poll(() => consoleMessages.length, { message: "waiting for monitoring to start" })
      .toBeGreaterThan(0)

    await page.evaluate(() => {
      window.scrollBy(0, 100)
    })

    // Wait for the monitoring to detect and cancel by polling the messages array.
    // We poll on the Node.js side because the `consoleMessages` array lives here,
    // not in the browser context that page.waitForFunction evaluates in.
    await expect
      .poll(() => consoleMessages.find((msg) => msg.includes("canceled due to user input")))
      .toBeDefined()
  })
})

test.describe("Popstate (Back/Forward) Navigation", () => {
  // eslint-disable-next-line playwright/expect-expect
  test("browser back and forward updates content appropriately", async ({ page }) => {
    const initialUrl = page.url()

    await page.goto("http://localhost:8080/design", { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.toString() !== initialUrl)

    await page.goBack()
    await page.waitForURL(initialUrl)

    await page.goForward()
    await page.waitForURL((url) => url.toString() !== initialUrl)
  })
})

test.describe("Same-page navigation", () => {
  async function clickToc(page: Page): Promise<void> {
    const tocSelector = isDesktopViewport(page) ? "#toc-content a" : "#toc-content-mobile a"
    await expect(page.locator(tocSelector).nth(10)).toBeVisible()
    await page.locator(tocSelector).nth(10).click()
  }

  test("click same-page link, go back, check scroll is reset to top", async ({ page }) => {
    const initialScroll = await page.evaluate(() => window.scrollY)
    expect(initialScroll).toBe(0)

    await clickToc(page)
    await page.waitForFunction(() => window.scrollY > 0)

    const scrollAfterClick = await page.evaluate(() => window.scrollY)
    expect(scrollAfterClick).toBeGreaterThan(initialScroll)

    await page.goBack()
    await page.waitForFunction((tolerance) => window.scrollY <= tolerance, tightScrollTolerance)
  })

  test("maintains scroll history for multiple same-page navigations", async ({ page }) => {
    // Scroll to some of the middle headings
    const scrollPositions: number[] = []
    const headings = await getAllWithWait(page.locator("h1 > a"))
    for (const heading of headings.slice(2, 5)) {
      // Don't click the heading, just navigate to it
      const headingId = await heading.getAttribute("href")
      expect(headingId?.startsWith("#")).toBe(true)
      await page.goto(`http://localhost:8080/${testingPageSlug}${headingId}`, {
        waitUntil: "domcontentloaded",
      })

      // Wait for scroll to complete and stabilize
      const previousScroll =
        // eslint-disable-next-line playwright/no-conditional-in-test
        scrollPositions.length > 0 ? scrollPositions[scrollPositions.length - 1] : 0

      await page.waitForFunction((prevScroll) => {
        // Ensure history state has a new scroll value different from previous
        if (!window.history.state?.scroll) return false
        if (window.history.state.scroll === prevScroll) return false
        // Ensure actual scroll position matches history state (scroll complete)
        return Math.abs(window.scrollY - window.history.state.scroll) < 5
      }, previousScroll)
      const historyScroll = await page.evaluate(() => window.scrollY)
      await waitForHistoryState(page, historyScroll)
      scrollPositions.push(historyScroll)

      // Sanity check that scroll is stable
      const updatedScroll = await page.evaluate(() => window.scrollY)
      expect(updatedScroll).toBeCloseTo(historyScroll)
    }

    for (let i = 0; i < scrollPositions.length - 1; i++) {
      expect(scrollPositions[i]).toBeLessThan(scrollPositions[i + 1])
    }

    const reversedScrollPositions = scrollPositions.slice().reverse()
    for (const position of reversedScrollPositions.slice(1)) {
      await page.goBack()
      await waitForHistoryState(page, position)
    }

    const forwardScrollPositions = scrollPositions.slice(1)
    for (const position of forwardScrollPositions) {
      await page.goForward()
      await waitForHistoryState(page, position)
    }
  })

  test("going back after anchor navigation returns to original position", async ({ page }) => {
    // NOTE: This scroll target must put the to-be-clicked ToC link in view
    const scrollTarget = 100
    await page.evaluate((scrollTarget) => window.scrollTo(0, scrollTarget), scrollTarget)
    await waitForScroll(page, scrollTarget)
    await waitForHistoryState(page, scrollTarget)

    await clickToc(page)

    await page.goBack()

    const finalScroll = await page.evaluate(() => window.scrollY)
    expect(finalScroll).toBeCloseTo(scrollTarget, -1)
  })
})

test.describe("SPA Navigation DOM Cleanup", () => {
  test("removes unexpected siblings of video element before morphing", async ({ page }) => {
    test.skip(!isDesktopViewport(page), "Video element is not visible on mobile")
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

    await page.evaluate(() => window.spaNavigate(new URL("/design", window.location.origin)))
    await page.waitForURL("**/design")

    await expect(page.locator("#rogue-sibling")).toBeHidden()
    await expect(page.locator(`#${pondVideoId}`)).toBeVisible()
  })
})

// eslint-disable-next-line playwright/expect-expect
test("restores scroll position when returning from external page", async ({ page }) => {
  // Mock the external URL to avoid real network requests in CI
  await page.route("https://example.com/**", (route) =>
    route.fulfill({ status: 200, body: "<html><body>External</body></html>" }),
  )

  await page.evaluate(() => {
    const link = document.createElement("a")
    link.href = "https://example.com/external"
    link.textContent = "External link"
    document.body.prepend(link)
  })

  const externalLink = page.locator("a").first()
  await externalLink.click()
  await page.evaluate(() => window.scrollTo(0, 100))

  // The external scroll should not matter when returning to the SPA
  await page.goBack()
  await waitForScroll(page, 0)
})

test.describe("Fetch & Redirect Handling", () => {
  test("successfully handles meta-refresh redirect", async ({ page }) => {
    const sourcePath = "/redirect-source"
    const targetPath = "/redirect-target"
    const targetContent = "Redirect Target Content"

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

    expect(await doesMarkerExist(page)).toBe(true)
    await expect(page.locator("h1")).toHaveText(targetContent)
    expect(page.url()).toContain(sourcePath)
  })
})

test.describe("Critical CSS", () => {
  test("is removed after popstate navigation to a hash URL", async ({ page }) => {
    const cssLocator = page.locator("style#critical-css")
    await expect(cssLocator).toHaveCount(0)

    const hash = await createFinalAnchor(page)
    await page.goto(`http://localhost:8080/${testingPageSlug}#${hash}`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForURL(`**/${testingPageSlug}#${hash}`)

    await expect(cssLocator).toHaveCount(0)
  })

  test("is removed after navigation to a different page", async ({ page }) => {
    const cssLocator = page.locator("style#critical-css")
    await expect(cssLocator).toHaveCount(0)

    // Create a link to another page
    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "/design"
      link.id = "design-link"
      link.textContent = "Design"
      document.body.appendChild(link)
    })

    await page.click("#design-link")
    await page.waitForURL("**/design")

    await expect(cssLocator).toHaveCount(0)
  })
})

test.describe("Network Behavior", () => {
  test("does not fetch content for same-page hash navigation", async ({ page }) => {
    let requestMade = false

    // Intercept requests for the same page.
    await page.route(`**/${testingPageSlug}`, (route) => {
      requestMade = true
      route.continue()
    })

    // Create an anchor and a link pointing to it
    const finalAnchorId = await createFinalAnchor(page)
    await page.evaluate((id) => {
      const anchorElement = document.createElement("div")
      anchorElement.id = id
      document.body.appendChild(anchorElement)

      const linkElement = document.createElement("a")
      linkElement.href = `#${id}`
      linkElement.id = "link-to-anchor"
      linkElement.textContent = "Go to Anchor"
      document.body.appendChild(linkElement)
    }, finalAnchorId)

    // Click the link to trigger hash navigation
    await page.click("#link-to-anchor")

    // Wait for the URL to reflect the hash change
    await page.waitForURL(`**/*#${finalAnchorId}`)

    // The core assertion: verify that no network request was made
    expect(requestMade).toBe(false)
  })
})

test.describe("Document Head & Body Updates", () => {
  // Helper to ensure the about link is visible (opens mobile menu if needed)
  async function ensureAboutLinkVisible(page: Page): Promise<void> {
    const aboutLink = page.locator('a[href$="/about"]')
    const isVisible = await aboutLink.isVisible().catch(() => false)
    if (!isVisible) {
      // On mobile, the menu might be hidden. Try opening it.
      const menuButton = page.locator("#menu-button")
      const menu = page.locator("#navbar-right .menu")
      if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click()
        // Wait for menu to become visible
        await expect(menu).toBeVisible()
        await expect(menu).toHaveClass(/visible/)
      }
      // If still not visible, use force click
      await aboutLink.scrollIntoViewIfNeeded()
    }
  }

  // Helper to wait for SPA navigation to complete (including DOM updates)
  async function waitForNavigation(page: Page): Promise<() => Promise<void>> {
    const navPromise = page.evaluate(() => {
      return new Promise<void>((resolve) => {
        document.addEventListener("nav", () => resolve(), { once: true })
      })
    })
    return () => navPromise
  }

  async function navigateAndWait(page: Page, url: string): Promise<void> {
    const awaitNav = await waitForNavigation(page)
    await page.click(`a[href$="${url}"]`)
    await page.waitForURL(`**${url}`)
    await awaitNav()
  }

  test("updates page title when navigating between pages", async ({ page }) => {
    await page.waitForFunction(() => document.title !== "")
    const initialTitle = await page.title()
    expect(initialTitle).toBeTruthy()

    await ensureAboutLinkVisible(page)
    await navigateAndWait(page, "/about")
    await page.waitForFunction(() => document.title !== "")

    const newTitle = await page.title()
    expect(newTitle).toBeTruthy()
    expect(newTitle).not.toBe(initialTitle)
  })

  test("updates page title when using browser back button", async ({ page }) => {
    await page.waitForFunction(() => document.title !== "")
    const homeTitle = await page.title()

    await ensureAboutLinkVisible(page)
    await navigateAndWait(page, "/about")
    await page.waitForFunction(() => document.title !== "")
    const aboutTitle = await page.title()

    // Go back
    const awaitNav = await waitForNavigation(page)
    await page.goBack()
    await page.waitForURL(`**/${testingPageSlug}`)
    await awaitNav()
    await page.waitForFunction(() => document.title !== "")

    const restoredTitle = await page.title()
    expect(restoredTitle).toBe(homeTitle)
    expect(restoredTitle).not.toBe(aboutTitle)
  })

  interface MetaTagTest {
    name: string
    selector: string
    attributeName: string
  }

  const metaTagTests: MetaTagTest[] = [
    {
      name: "meta description",
      selector: 'meta[name="description"]',
      attributeName: "content",
    },
    {
      name: "Open Graph title",
      selector: 'meta[property="og:title"]',
      attributeName: "content",
    },
    {
      name: "Open Graph description",
      selector: 'meta[property="og:description"]',
      attributeName: "content",
    },
    {
      name: "Open Graph URL",
      selector: 'meta[property="og:url"]',
      attributeName: "content",
    },
    {
      name: "Twitter Card title",
      selector: 'meta[name="twitter:title"]',
      attributeName: "content",
    },
    {
      name: "Twitter Card description",
      selector: 'meta[name="twitter:description"]',
      attributeName: "content",
    },
  ]

  for (const testCase of metaTagTests) {
    test(`updates ${testCase.name} during navigation`, async ({ page }) => {
      const initialValue = await page.evaluate(
        ({ selector, attributeName }) => {
          const el = document.querySelector(selector)
          return el ? el.getAttribute(attributeName) : null
        },
        { selector: testCase.selector, attributeName: testCase.attributeName },
      )

      await ensureAboutLinkVisible(page)
      await navigateAndWait(page, "/about")

      const newValue = await page.evaluate(
        ({ selector, attributeName }) => {
          const el = document.querySelector(selector)
          return el ? el.getAttribute(attributeName) : null
        },
        { selector: testCase.selector, attributeName: testCase.attributeName },
      )

      expect(newValue).toBeTruthy()
      expect(newValue).not.toBe(initialValue)
    })
  }

  interface PreservedElementTest {
    name: string
    selector: string
    attributeName: string
  }

  const preservedElementTests: PreservedElementTest[] = [
    {
      name: "spa-preserve script elements",
      selector: "script[data-website-id]",
      attributeName: "src",
    },
    {
      name: "spa-preserve link elements",
      selector: 'link[rel="stylesheet"][href="/index.css"]',
      attributeName: "href",
    },
  ]

  for (const testCase of preservedElementTests) {
    test(`preserves ${testCase.name} during navigation`, async ({ page }) => {
      const initialValue = await page.evaluate(
        ({ selector, attributeName }) => {
          const el = document.querySelector(selector)
          return el ? el.getAttribute(attributeName) : null
        },
        { selector: testCase.selector, attributeName: testCase.attributeName },
      )
      expect(initialValue).toBeTruthy()

      await ensureAboutLinkVisible(page)
      await navigateAndWait(page, "/about")

      const newValue = await page.evaluate(
        ({ selector, attributeName }) => {
          const el = document.querySelector(selector)
          return el ? el.getAttribute(attributeName) : null
        },
        { selector: testCase.selector, attributeName: testCase.attributeName },
      )
      expect(newValue).toBe(initialValue)
    })
  }

  test("updates body content during navigation", async ({ page }) => {
    const initialBodyText = await page.evaluate(() => {
      const h1 = document.querySelector("h1")
      return h1?.textContent
    })

    await ensureAboutLinkVisible(page)
    await navigateAndWait(page, "/about")

    const newBodyText = await page.evaluate(() => {
      const h1 = document.querySelector("h1")
      return h1?.textContent
    })

    expect(newBodyText).toBeTruthy()
    expect(newBodyText).not.toBe(initialBodyText)
  })

  test("maintains consistent state after multiple navigations", async ({ page }) => {
    await ensureAboutLinkVisible(page)
    await navigateAndWait(page, "/about")

    const aboutTitle = await page.title()
    const aboutDescription = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]')
      return meta?.getAttribute("content")
    })

    // Navigate back to home
    let awaitNav = await waitForNavigation(page)
    await page.goBack()
    await page.waitForURL(`**/${testingPageSlug}`)
    await awaitNav()

    // Navigate forward to about again
    awaitNav = await waitForNavigation(page)
    await page.goForward()
    await page.waitForURL("**/about")
    await awaitNav()

    const finalTitle = await page.title()
    const finalDescription = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="description"]')
      return meta?.getAttribute("content")
    })

    expect(finalTitle).toBe(aboutTitle)
    expect(finalDescription).toBe(aboutDescription)
  })
})
