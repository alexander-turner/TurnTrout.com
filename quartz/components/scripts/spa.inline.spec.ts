/**
 * This spec file is designed to test the functionality of spa.inline.ts,
 * including client-side routing, scroll behavior, hash navigation,
 * and the route announcer for accessibility.
 *
 * Watch out for:
 *  - Playwright implicitly scrolling when clicking on an anchor
 */

import { type Page, test, expect } from "@playwright/test"

import { pondVideoId } from "../component_utils"
import { isDesktopViewport } from "../tests/visual_utils"

const FIREFOX_SCROLL_DELAY = 2000
const TIGHT_SCROLL_TOLERANCE: number = 10

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
    { target: targetPos, tolerance: TIGHT_SCROLL_TOLERANCE },
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

/*
 * Verifies that the browser has scrolled to approximately the target position.
 */
async function waitForScroll(page: Page, targetScrollY: number, timeout = 30000): Promise<void> {
  await page.waitForFunction(
    ({ target, tolerance }) => {
      const currentScrollY = window.scrollY
      return Math.abs(currentScrollY - target) <= tolerance
    },
    { target: targetScrollY, tolerance: TIGHT_SCROLL_TOLERANCE, timeout },
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
    await page.goto(`http://localhost:8080/test-page#${anchorId}`)
    await waitForHistoryScrollNotEquals(page, undefined)

    const scrollPosition = await page.evaluate(() => window.scrollY)
    expect(Math.abs(scrollPosition)).toBeGreaterThan(0)
  })

  for (const [scrollPos] of [[50], [100], [1000]]) {
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
    }) => {
      const anchorId = await createFinalAnchor(page)
      await page.goto(`http://localhost:8080/test-page#${anchorId}`)

      // Wait so that we don't race in Firefox
      // IIRC I tried alternatives like waitForFunction, but it didn't work
      // eslint-disable-next-line playwright/no-wait-for-timeout
      await page.waitForTimeout(FIREFOX_SCROLL_DELAY)
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
    await page.goto(`http://localhost:8080/test-page#${anchorId}`)
    await page.waitForFunction(() => window.history.state?.scroll)
    const currentScroll = await page.evaluate(() => window.scrollY)
    expect(currentScroll).toBeGreaterThan(0)

    await softRefresh(page)
    await waitForScroll(page, currentScroll)
  })
})

test.describe("Flicker-Free Reload", () => {
  // eslint-disable-next-line playwright/expect-expect
  test("restores scroll position on refresh without flickering", async ({ page }) => {
    const scrollPos = 500
    await page.evaluate((pos) => window.scrollTo(0, pos), scrollPos)
    await waitForHistoryState(page, scrollPos)

    // Add a script to capture scroll position during page load
    await page.addInitScript(() => {
      // @ts-expect-error: Attaching to window for test purposes
      window.scrollYAtFirstPaint = window.scrollY
    })

    await softRefresh(page)

    // Wait for page to load and then check scroll position
    await page.waitForLoadState("domcontentloaded")

    // Wait for scroll position to be restored to approximately the right position
    const tolerance = 50
    await page.waitForFunction(
      ({ target, tolerance }) => {
        const currentScrollY = window.scrollY
        return Math.abs(currentScrollY - target) <= tolerance
      },
      { target: scrollPos, tolerance },
      { timeout: 5000 },
    )
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
  test("click same-page link, go back, check scroll is reset to top", async ({ page }) => {
    const initialScroll = await page.evaluate(() => window.scrollY)
    expect(initialScroll).toBe(0)

    // eslint-disable-next-line playwright/no-conditional-in-test
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
    // Scroll to some of the middle headings
    const scrollPositions: number[] = []
    const headings = await page.locator("h1 > a").all()
    for (const heading of headings.slice(2, 5)) {
      // Don't click the heading, just navigate to it
      const headingId = await heading.getAttribute("href")
      expect(headingId?.startsWith("#")).toBe(true)
      await page.goto(`http://localhost:8080/test-page${headingId}`)

      // Firefox will error without waiting for scroll to complete
      const previousScroll =
        // eslint-disable-next-line playwright/no-conditional-in-test
        scrollPositions.length > 0 ? scrollPositions[scrollPositions.length - 1] : 0
      await waitForHistoryScrollNotEquals(page, previousScroll)

      // eslint-disable-next-line playwright/no-wait-for-timeout
      await page.waitForTimeout(FIREFOX_SCROLL_DELAY)
      const historyScroll = await page.evaluate(() => window.scrollY)
      await waitForHistoryState(page, historyScroll)
      scrollPositions.push(historyScroll)

      // Sanity check that scroll is stable
      const updatedScroll = await page.evaluate(() => window.scrollY)
      expect(updatedScroll).toBe(historyScroll)
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
    const anchorId = await createFinalAnchor(page)
    await page.goto(`http://localhost:8080/test-page#${anchorId}`)
    await waitForHistoryScrollNotEquals(page, undefined)

    const scrollAfterAnchor = await page.evaluate(() => window.scrollY)
    expect(scrollAfterAnchor).toBeGreaterThan(1000)

    await page.goBack()
    await waitForScroll(page, 0)
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

    // Click is ok because it doesn't scroll to it first
    const localLink = page.locator("a").first()
    await localLink.click()

    await expect(page.locator("#rogue-sibling")).toBeHidden()
    await expect(page.locator(`#${pondVideoId}`)).toBeVisible()
  })
})

// eslint-disable-next-line playwright/expect-expect
test("restores scroll position when returning from external page", async ({ page }) => {
  await page.evaluate(() => {
    const link = document.createElement("a")
    link.href = "https://github.com/alexander-turner"
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
    await page.goto(`http://localhost:8080/test-page#${hash}`)
    await page.waitForURL(`**/test-page#${hash}`)

    await expect(cssLocator).toHaveCount(0)
  })

  test("is removed after navigation to a different page", async ({ page }) => {
    const cssLocator = page.locator("style#critical-css")
    await expect(cssLocator).toHaveCount(0)

    // Create a link to another page
    await page.evaluate(() => {
      const link = document.createElement("a")
      link.href = "/design"
      link.id = "design-link" // TODO improve robustness?
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
    await page.route("**/test-page", (route) => {
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
