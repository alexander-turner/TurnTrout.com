import { test, expect, type Page, type Locator } from "@playwright/test"

import { simpleConstants } from "../constants"
import { type Theme } from "../scripts/darkmode"
import { takeRegressionScreenshot, isDesktopViewport, setTheme } from "./visual_utils"

const { pondVideoId } = simpleConstants

interface VideoElements {
  video: Locator
  autoplayToggle: Locator
  playIcon: Locator
  pauseIcon: Locator
}

export async function isSafariBrowser(page: Page): Promise<boolean> {
  return await page.evaluate(() => navigator.userAgent.includes("Safari"))
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
  return video.evaluate((videoElement: HTMLVideoElement) => videoElement.currentTime)
}

async function isPaused(video: Locator): Promise<boolean> {
  return video.evaluate((videoElement: HTMLVideoElement) => videoElement.paused)
}

async function ensureVideoPlaying(videoElements: VideoElements): Promise<void> {
  const { video } = videoElements

  // Ensure video has loaded enough data to play
  await video.evaluate((videoElement: HTMLVideoElement) => {
    if (videoElement.readyState < 3) {
      return new Promise<void>((resolve) => {
        videoElement.addEventListener("canplay", () => resolve(), { once: true })
      })
    }
    return undefined
  })

  // Check if video is already playing
  const isCurrentlyPaused = await isPaused(video)

  // If video is paused, click toggle to enable autoplay
  if (isCurrentlyPaused) {
    await videoElements.autoplayToggle.click()
    // Wait for video to actually be playing (not just !paused, but actively playing)
    await video.page().waitForFunction((id: string) => {
      const videoElement = document.querySelector<HTMLVideoElement>(`#${id}`)
      return (
        videoElement &&
        !videoElement.paused &&
        videoElement.readyState >= 3 &&
        videoElement.currentTime > 0
      )
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
  await video.evaluate((videoElement: HTMLVideoElement, timestamp: number) => {
    return new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        const timeout = setTimeout(() => {
          videoElement.removeEventListener("seeked", onSeeked)
          reject(new Error(`Seek to ${timestamp} timed out`))
        }, 5000)

        clearTimeout(timeout)
        videoElement.pause()
        // Trigger timeupdate to ensure sessionStorage is saved
        videoElement.dispatchEvent(new Event("timeupdate"))
        resolve()
      }

      videoElement.addEventListener("seeked", onSeeked, { once: true })
      videoElement.currentTime = timestamp
    })
  }, fixedTimestamp)

  await autoplayToggle.click()
  await expect(isPaused(video)).resolves.toBe(true)

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

  // Move mouse away to avoid hover states
  await page.mouse.move(0, 0)
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

test("Content behind hidden navbar is clickable on mobile", async ({ page }) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const navbar = page.locator("#navbar")
  const leftSidebar = page.locator("#left-sidebar")

  // Navbar visible: sidebar should not intercept, navbar should intercept
  await expect(leftSidebar).toHaveCSS("pointer-events", "none")
  await expect(navbar).toHaveCSS("pointer-events", "auto")

  // Scroll down to hide navbar
  await page.evaluate(() => window.scrollTo({ top: 250, behavior: "instant" }))
  await expect(navbar).toHaveClass(/hide-above-screen/)

  // When hidden, navbar should also not intercept clicks
  await expect(navbar).toHaveCSS("pointer-events", "none")

  // Find a link near the top of viewport and verify it's clickable
  const firstVisibleLink = page.locator("article a[href]").first()
  await firstVisibleLink.scrollIntoViewIfNeeded()
  const box = await firstVisibleLink.boundingBox()
  expect(box).toBeTruthy()

  // Use page.click at the exact coordinates to verify no overlay blocks it
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
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
    await expect(navbar).toBeVisible()
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
    const videoElement = document.querySelector<HTMLVideoElement>(`#${id}`)
    return videoElement && !videoElement.paused && videoElement.readyState >= 3
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
  await video.evaluate((videoElement: HTMLVideoElement) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Video failed to reach playable state: readyState=${videoElement.readyState}, paused=${videoElement.paused}`,
          ),
        )
      }, 10000)

      const checkPlayable = () => {
        if (videoElement.readyState >= 3 && !videoElement.paused && videoElement.currentTime > 0) {
          clearTimeout(timeout)
          resolve()
        }
      }

      if (videoElement.readyState >= 3 && !videoElement.paused && videoElement.currentTime > 0) {
        clearTimeout(timeout)
        resolve()
      } else {
        videoElement.addEventListener("canplay", checkPlayable, { once: true })
        videoElement.addEventListener("playing", checkPlayable, { once: true })
        videoElement.addEventListener("timeupdate", checkPlayable, { once: true })
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
    const videoElement = document.querySelector<HTMLVideoElement>(`#${id}`)
    return videoElement && !videoElement.paused && videoElement.readyState >= 3
  }, pondVideoId)

  await page.evaluate(() => window.spaNavigate(new URL("/design", window.location.origin)))
  await page.waitForURL("**/design")

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
  test.skip(await isSafariBrowser(page), "Safari is flaky")

  const videoElements = getVideoElements(page)
  const timestampBeforeNavigation = await setupVideoForTimestampTest(videoElements)

  const initialUrl = page.url()
  const localLink = page.locator("a:not(.skip-to-content)").first()
  await localLink.click()
  await page.waitForURL((url) => url.pathname !== initialUrl)

  const timestampAfterNavigation = await getTimestampAfterNavigation(page)
  expect(timestampAfterNavigation).toBeCloseTo(timestampBeforeNavigation, 0)
})

test("Video timestamp is preserved during refresh", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")
  test.skip(await isSafariBrowser(page), "Safari is flaky")

  const videoElements = getVideoElements(page)
  const timestampBeforeRefresh = await setupVideoForTimestampTest(videoElements)

  await page.reload()

  const timestampAfterRefresh = await getTimestampAfterNavigation(page)
  test.fail(timestampAfterRefresh === null, "Timestamp after refresh is null")
  expect(timestampAfterRefresh).toBeCloseTo(timestampBeforeRefresh, 0)
})
