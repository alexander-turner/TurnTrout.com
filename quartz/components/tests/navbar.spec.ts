import { test, expect, type Page, type Locator } from "@playwright/test"

import { pondVideoId } from "../component_utils"
import { type Theme } from "../scripts/darkmode"
import { takeRegressionScreenshot, isDesktopViewport, setTheme } from "./visual_utils"

interface VideoElements {
  video: Locator
  autoplayToggle: Locator
  playIcon: Locator
  pauseIcon: Locator
}

function getVideoElements(page: Page): VideoElements {
  return {
    video: page.locator(`video#${pondVideoId}`),
    autoplayToggle: page.locator("#video-toggle"),
    playIcon: page.locator("#play-icon"),
    pauseIcon: page.locator("#pause-icon"),
  }
}

async function getCurrentTime(video: Locator): Promise<number> {
  return video.evaluate((v: HTMLVideoElement) => v.currentTime)
}

async function isPaused(video: Locator): Promise<boolean> {
  return video.evaluate((v: HTMLVideoElement) => v.paused)
}

async function ensureVideoPlaying(videoElements: VideoElements): Promise<void> {
  const { video } = videoElements

  // Ensure video has loaded enough data to play
  await video.evaluate((v: HTMLVideoElement) => {
    if (v.readyState < 3) {
      return new Promise<void>((resolve) => {
        v.addEventListener("canplay", () => resolve(), { once: true })
      })
    }
  })

  // Check if video is already playing
  const isCurrentlyPaused = await isPaused(video)

  // If video is paused, click toggle to enable autoplay
  if (isCurrentlyPaused) {
    await videoElements.autoplayToggle.click()
    // Wait for video to actually be playing (not just !paused, but actively playing)
    await video.page().waitForFunction((id: string) => {
      const v = document.querySelector<HTMLVideoElement>(`#${id}`)
      return v && !v.paused && v.readyState >= 3 && v.currentTime > 0
    }, pondVideoId)
  }
}

const fixedTimestamp = 2.5
/**
 * Prepares a video at a known timestamp for tests that verify timestamp preservation.
 * Ensures the video is playing and sets it to a fixed timestamp, pauses it, then validates the
 * timestamp was set correctly within tolerance.
 *
 * @param videoElements - The video element locators
 * @returns The actual timestamp after setting (for comparison in tests)
 */
async function setupVideoForTimestampTest(videoElements: VideoElements): Promise<number> {
  await ensureVideoPlaying(videoElements)

  const { video, autoplayToggle } = videoElements

  // Set currentTime and wait for seeked event (which fires when seeking completes)
  await video.evaluate((v: HTMLVideoElement, timestamp: number) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        v.removeEventListener("seeked", onSeeked)
        reject(new Error(`Seek to ${timestamp} timed out`))
      }, 5000)

      const onSeeked = () => {
        clearTimeout(timeout)
        v.pause()
        // Trigger timeupdate to ensure sessionStorage is saved
        v.dispatchEvent(new Event("timeupdate"))
        resolve()
      }

      v.addEventListener("seeked", onSeeked, { once: true })
      v.currentTime = timestamp
    })
  }, fixedTimestamp)

  // Wait for currentTime to stabilize at the expected value (handles Safari async behavior)
  await video.page().waitForFunction(
    (args: { id: string; expectedTime: number; tolerance: number }) => {
      const v = document.querySelector<HTMLVideoElement>(`#${args.id}`)
      if (!v) return false
      const diff = Math.abs(v.currentTime - args.expectedTime)
      return diff < args.tolerance
    },
    { id: pondVideoId, expectedTime: fixedTimestamp, tolerance: 0.1 },
  )

  // Disable autoplay to ensure video stays paused
  const isCurrentlyPaused = await isPaused(video)
  if (!isCurrentlyPaused) {
    await autoplayToggle.click()
    await expect(isPaused(video)).resolves.toBe(true)
  }

  const timestamp = await getCurrentTime(video)
  expect(timestamp).toBeCloseTo(fixedTimestamp, 0.1)

  return timestamp
}

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:8080/test-page", { waitUntil: "load" })

  await page.evaluate(() => window.scrollTo(0, 0))
})

test("Clicking away closes the menu (lostpixel)", async ({ page }, testInfo) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const menuButton = page.locator("#menu-button")
  const navbarRightMenu = page.locator("#navbar-right .menu")
  await expect(menuButton).toBeVisible()

  await menuButton.click()
  await expect(navbarRightMenu).toBeVisible()
  await expect(navbarRightMenu).toHaveClass(/visible/)
  // Move mouse away
  await page.mouse.move(0, 0)
  await takeRegressionScreenshot(page, testInfo, "visible-menu", {
    elementToScreenshot: navbarRightMenu,
  })

  const body = page.locator("body")
  await body.click()
  await expect(navbarRightMenu).toBeHidden()
  await expect(navbarRightMenu).not.toHaveClass(/visible/)
})

test("Menu button makes menu visible (lostpixel)", async ({ page }, testInfo) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const menuButton = page.locator("#menu-button")
  const navbarRightMenu = page.locator("#navbar-right .menu")

  // Test initial state
  const originalMenuButtonState = await menuButton.screenshot()
  await expect(navbarRightMenu).toBeHidden()
  await expect(navbarRightMenu).not.toHaveClass(/visible/)

  // Test opened state
  await menuButton.click()
  const openedMenuButtonState = await menuButton.screenshot()
  expect(openedMenuButtonState).not.toEqual(originalMenuButtonState)
  await expect(navbarRightMenu).toBeVisible()
  await expect(navbarRightMenu).toHaveClass(/visible/)
  await takeRegressionScreenshot(page, testInfo, "visible-menu", {
    elementToScreenshot: navbarRightMenu,
  })

  // Test closed state
  await menuButton.click()
  const newMenuButtonState = await menuButton.screenshot()
  expect(newMenuButtonState).toEqual(originalMenuButtonState)
  await expect(navbarRightMenu).toBeHidden()
  await expect(navbarRightMenu).not.toHaveClass(/visible/)
})

test("Can't see the menu at desktop size", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const menuButton = page.locator("#menu-button")
  await expect(menuButton).toBeHidden()
})

// Test scrolling down, seeing the menu disappears, and then reappears when scrolling back up
test("Menu disappears when scrolling down and reappears when scrolling up", async ({ page }) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const navbar = page.locator("#navbar")

  await expect(navbar).toBeVisible()
  await expect(navbar).not.toHaveClass(/hide-above-screen/)

  await page.evaluate(() => {
    window.scrollTo({
      top: 250,
      behavior: "instant",
    })
  })

  await expect(navbar).toHaveClass(/hide-above-screen/)
  await expect(navbar).toHaveCSS("opacity", "0")

  await page.evaluate(() => {
    window.scrollTo({
      top: 0,
      behavior: "instant",
    })
  })

  await expect(navbar).not.toHaveClass(/hide-above-screen/)
  await expect(navbar).toBeVisible()
})

test("Menu disappears gradually when scrolling down", async ({ page }) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const navbar = page.locator("#navbar")
  await expect(navbar).toHaveCSS("opacity", "1")

  await page.evaluate(() => window.scrollBy(0, 100))

  await page.evaluate(() => {
    // @ts-expect-error - for test
    window.lastOpacity = 1
    // @ts-expect-error - for test
    window.consecutiveDecreases = 0
  })

  await page.waitForFunction(() => {
    const navbarEl = document.querySelector("#navbar")
    if (!navbarEl) return false
    const currentOpacity = Number(getComputedStyle(navbarEl).opacity)

    // @ts-expect-error - for test
    if (currentOpacity < window.lastOpacity) {
      // @ts-expect-error - for test
      window.consecutiveDecreases++
    } else {
      // @ts-expect-error - for test
      window.consecutiveDecreases = 0
    }

    // @ts-expect-error - for test
    window.lastOpacity = currentOpacity
    // @ts-expect-error - for test
    return window.consecutiveDecreases >= 2
  })

  await expect(navbar).toHaveCSS("opacity", "0")
})

test("Navbar shows shadow when scrolling down (lostpixel)", async ({ page }, testInfo) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const navbar = page.locator("#navbar")

  const takeNavbarScreenshot = async (suffix: string) => {
    const box = await navbar.boundingBox()
    test.fail(!box, "Could not find navbar")
    // skipcq: JS-0339 - box is checked for nullability above
    await takeRegressionScreenshot(page, testInfo, suffix, {
      clip: {
        // skipcq: JS-0339
        x: box!.x,
        // skipcq: JS-0339
        y: box!.y,
        // skipcq: JS-0339
        width: box!.width,
        // skipcq: JS-0339
        height: box!.height + 12,
      },
    })
  }

  await expect(navbar).not.toHaveClass(/shadow/)
  await takeNavbarScreenshot("navbar-no-shadow")

  // Scroll down slightly to trigger shadow
  await page.evaluate(() => {
    window.scrollTo({
      top: 50,
      behavior: "instant",
    })
  })

  await expect(navbar).toHaveClass(/shadow/)
  await takeNavbarScreenshot("navbar-with-shadow")

  await page.evaluate(() => {
    window.scrollTo({
      top: 0,
      behavior: "instant",
    })
  })

  await expect(navbar).not.toHaveClass(/shadow/)
})

for (const theme of ["light", "dark", "auto"]) {
  test(`Left sidebar is visible on desktop in ${theme} mode (lostpixel)`, async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktopViewport(page), "Desktop-only test")

    const leftSidebar = page.locator("#left-sidebar")
    await expect(leftSidebar).toBeVisible()
    await setTheme(page, theme as Theme)
    await takeRegressionScreenshot(page, testInfo, `left-sidebar-${theme}`, {
      elementToScreenshot: leftSidebar,
    })
  })
}

async function backgroundMatchesBodyDuringTransition(
  page: Page,
  selector: string,
  theme: Theme,
): Promise<boolean> {
  // Start from opposite theme to trigger transition
  const startTheme = theme === "light" ? "dark" : "light"
  await setTheme(page, startTheme)

  // Set up polling and trigger theme change in one evaluation
  await page.evaluate(
    (args) => {
      let mismatchFound = false
      let isPolling = true
      let transitionComplete = false

      const poll = () => {
        const el = document.querySelector(args.selector)
        if (
          el &&
          getComputedStyle(el).backgroundColor !== getComputedStyle(document.body).backgroundColor
        ) {
          mismatchFound = true
        }
        if (isPolling) {
          requestAnimationFrame(poll)
        }
      }

      // Start polling
      requestAnimationFrame(poll)

      // Set up listener for transition end on temporary-transition class removal
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "class" &&
            !document.documentElement.classList.contains("temporary-transition")
          ) {
            transitionComplete = true
          }
        })
      })
      observer.observe(document.documentElement, { attributes: true })

      // @ts-expect-error - for test instrumentation
      window.bgPollingState = {
        stopPolling: () => {
          isPolling = false
          observer.disconnect()
          return !mismatchFound
        },
        isTransitionComplete: () => transitionComplete,
      }
    },
    { selector },
  )

  // Trigger theme change
  const darkmodeButton = page.locator("#theme-toggle")
  await darkmodeButton.click()

  // Wait for transition to complete
  await page.waitForFunction(
    () => {
      // @ts-expect-error - for test instrumentation
      return window.bgPollingState?.isTransitionComplete()
    },
    { timeout: 2000 },
  )

  // Stop polling and get result
  return page.evaluate(() => {
    // @ts-expect-error - for test instrumentation
    if (!window.bgPollingState?.stopPolling) {
      return false
    }
    // @ts-expect-error - for test instrumentation
    return window.bgPollingState.stopPolling()
  })
}

for (const theme of ["light", "dark"]) {
  test(`Left sidebar background matches body throughout transition to ${theme}`, async ({
    page,
  }) => {
    test.skip(isDesktopViewport(page), "Mobile-only test")

    const ok = await backgroundMatchesBodyDuringTransition(page, "#left-sidebar", theme as Theme)
    expect(ok).toBe(true)
  })
}

test("Right sidebar is visible on desktop on page load", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const sidebar = document.querySelector<HTMLElement>("#right-sidebar")
      let sidebarStyle: string | null = null
      if (sidebar) {
        sidebarStyle = window.getComputedStyle(sidebar).display
      } else {
        sidebarStyle = "not-found"
      }
      // @ts-expect-error - test instrumentation
      window.initialSidebarDisplayStyle = sidebarStyle
    })
  })

  // Reload the page to trigger the init script
  await page.reload()

  const initialDisplayStyle = await page.evaluate(() => {
    // @ts-expect-error - test instrumentation
    return window.initialSidebarDisplayStyle
  })
  expect(initialDisplayStyle).toBe("flex")
})

test("Clicking TOC title scrolls to top", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }))
  await page.waitForFunction(() => window.scrollY === 500)

  const tocTitle = page.locator("#toc-title button")
  await expect(tocTitle).toBeVisible()
  await tocTitle.click()

  await page.waitForFunction(() => window.scrollY === 0)
})

test("Video toggle button is visible and functional", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const { autoplayToggle, playIcon, pauseIcon } = getVideoElements(page)

  await expect(autoplayToggle).toBeVisible()
  await expect(playIcon).toBeVisible()
  await expect(pauseIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Enable video autoplay")
})

test("Video toggle changes autoplay behavior", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const { video, autoplayToggle, playIcon, pauseIcon } = getVideoElements(page)

  await expect(video).toBeVisible()
  await expect(playIcon).toBeVisible()
  await expect(pauseIcon).toBeHidden()

  await autoplayToggle.click()

  // Video should play and icons should switch
  await page.waitForFunction((id) => {
    const v = document.querySelector<HTMLVideoElement>(`#${id}`)
    return v && !v.paused && v.readyState >= 3
  }, pondVideoId)
  await expect(pauseIcon).toBeVisible()
  await expect(playIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Disable video autoplay")

  await autoplayToggle.click()

  await page.waitForFunction(
    (id) => document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )
  await expect(playIcon).toBeVisible()
  await expect(pauseIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Enable video autoplay")
})

test("Video autoplay preference persists across page reloads", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const { video, autoplayToggle, playIcon, pauseIcon } = getVideoElements(page)

  await autoplayToggle.click()
  await expect(pauseIcon).toBeVisible()
  await expect(playIcon).toBeHidden()

  await page.reload({ waitUntil: "load" })

  await expect(pauseIcon).toBeVisible()
  await expect(playIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Disable video autoplay")

  // Wait for video to have enough data loaded, then verify it starts playing
  await video.evaluate((v: HTMLVideoElement) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Video failed to reach playable state: readyState=${v.readyState}, paused=${v.paused}`,
          ),
        )
      }, 10000)

      const checkPlayable = () => {
        if (v.readyState >= 3 && !v.paused && v.currentTime > 0) {
          clearTimeout(timeout)
          resolve()
        }
      }

      if (v.readyState >= 3 && !v.paused && v.currentTime > 0) {
        clearTimeout(timeout)
        resolve()
      } else {
        v.addEventListener("canplay", checkPlayable, { once: true })
        v.addEventListener("playing", checkPlayable, { once: true })
        v.addEventListener("timeupdate", checkPlayable, { once: true })
      }
    })
  })
  await expect(isPaused(video)).resolves.toBe(false)
})

test("Video autoplay works correctly after SPA navigation", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const { video, autoplayToggle } = getVideoElements(page)

  await autoplayToggle.click()
  await page.waitForFunction((id) => {
    const v = document.querySelector<HTMLVideoElement>(`#${id}`)
    return v && !v.paused && v.readyState >= 3
  }, pondVideoId)

  const initialUrl = page.url()
  // TODO might not be local
  const localLink = page.locator("a").first()
  await localLink.click()
  await page.waitForURL((url) => url.pathname !== initialUrl)

  // Setting should persist and video should still be playing
  await expect(isPaused(video)).resolves.toBe(false)

  await autoplayToggle.click()
  await page.waitForFunction(
    (id) => document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )
})

async function getTimestampAfterNavigation(page: Page): Promise<number | null> {
  const timestampAfterNavigationHandle = await page.waitForFunction((id) => {
    const videoEl = document.querySelector<HTMLVideoElement>(`#${id}`)
    return videoEl && videoEl.currentTime > 0 ? videoEl.currentTime : null
  }, pondVideoId)
  return await timestampAfterNavigationHandle.jsonValue()
}

test("Video timestamp is preserved during SPA navigation", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const videoElements = getVideoElements(page)
  const timestampBeforeNavigation = await setupVideoForTimestampTest(videoElements)

  const initialUrl = page.url()
  const localLink = page.locator("a").first()
  await localLink.click()
  await page.waitForURL((url) => url.pathname !== initialUrl)

  const timestampAfterNavigation = await getTimestampAfterNavigation(page)
  expect(timestampAfterNavigation).toBeCloseTo(timestampBeforeNavigation, 0)
})

test("Video timestamp is preserved during refresh", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const videoElements = getVideoElements(page)
  const timestampBeforeRefresh = await setupVideoForTimestampTest(videoElements)

  await page.reload()

  const timestampAfterRefresh = await getTimestampAfterNavigation(page)
  test.fail(timestampAfterRefresh === null, "Timestamp after refresh is null")
  expect(timestampAfterRefresh).toBeCloseTo(timestampBeforeRefresh, 0)
})
