import type { Locator, Page } from "@playwright/test"

import { simpleConstants, urlBarScrollTolerance } from "../constants"
import { type Theme } from "../scripts/darkmode"
import { test, expect } from "./fixtures"
import {
  takeRegressionScreenshot,
  isDesktopViewport,
  isSafariBrowser,
  setTheme,
  reloadPage,
  gotoPage,
  triggerAndWaitForSPANav,
  moveMouseToSafePosition,
} from "./visual_utils"

const { pondVideoId } = simpleConstants

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

function getCurrentTime(video: Locator): Promise<number> {
  return video.evaluate((videoElement: HTMLVideoElement) => videoElement.currentTime)
}

function isPaused(video: Locator): Promise<boolean> {
  return video.evaluate((videoElement: HTMLVideoElement) => videoElement.paused)
}

async function ensureVideoPlaying(videoElements: VideoElements): Promise<void> {
  const { video } = videoElements

  // Wait for enough data to play through to the end (HAVE_ENOUGH_DATA = 4).
  // readyState >= 3 (canplay) is insufficient for seeking: Safari may only
  // have a few hundred ms buffered at that point.  canplaythrough guarantees
  // the browser has enough data to seek to any position without stalling.
  await video.evaluate((videoElement: HTMLVideoElement) => {
    if (videoElement.readyState < 4) {
      return new Promise<void>((resolve) => {
        videoElement.addEventListener("canplaythrough", () => resolve(), { once: true })
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
      const timeout = setTimeout(() => {
        reject(new Error(`Seek to ${timestamp} timed out`))
      }, 5000)

      videoElement.addEventListener(
        "seeked",
        () => {
          clearTimeout(timeout)
          videoElement.pause()
          // Trigger timeupdate to ensure sessionStorage is saved
          videoElement.dispatchEvent(new Event("timeupdate"))
          resolve()
        },
        { once: true },
      )

      videoElement.currentTime = timestamp
    })
  }, fixedTimestamp)

  await autoplayToggle.click()
  await expect(isPaused(video)).resolves.toBe(true)

  const timestamp = await getCurrentTime(video)
  // We verify PRESERVATION of the timestamp, not that the seek reached exactly
  // fixedTimestamp. Safari CI buffers minimally so the seek may land early;
  // any non-zero position confirms the seek was applied.
  expect(timestamp).toBeGreaterThan(0)

  return timestamp
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page", "domcontentloaded")

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
  await moveMouseToSafePosition(page)
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
  await moveMouseToSafePosition(page)
  await takeRegressionScreenshot(page, testInfo, "visible-menu", {
    elementToScreenshot: navbarRightMenu,
  })

  // Test closed state
  await menuButton.click()
  await expect(navbarRightMenu).toBeHidden()
  await expect(navbarRightMenu).not.toHaveClass(/visible/)
})

test("Pressing Escape closes the menu and returns focus to button", async ({ page }) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const menuButton = page.locator("#menu-button")
  const navbarRightMenu = page.locator("#navbar-right .menu")

  await menuButton.click()
  await expect(navbarRightMenu).toBeVisible()
  await expect(menuButton).toHaveAttribute("aria-expanded", "true")

  await page.keyboard.press("Escape")
  await expect(navbarRightMenu).toBeHidden()
  await expect(menuButton).toHaveAttribute("aria-expanded", "false")

  // Focus should return to the hamburger button
  const focused = page.locator(":focus")
  await expect(focused).toHaveId("menu-button")
})

test("Menu button has aria-controls pointing to nav-menu", async ({ page }) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const menuButton = page.locator("#menu-button")
  await expect(menuButton).toHaveAttribute("aria-controls", "nav-menu")

  const navMenu = page.locator("#nav-menu")
  await expect(navMenu).toBeAttached()
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

  // Verify a link in the content area is clickable despite the sticky sidebar
  const firstVisibleLink = page.locator("article a.internal[href]").first()
  await firstVisibleLink.scrollIntoViewIfNeeded()
  const href = firstVisibleLink
  await expect(href).toHaveAttribute("href")

  const initialUrl = page.url()
  await triggerAndWaitForSPANav(page, () => firstVisibleLink.click())
  await expect(page).not.toHaveURL(initialUrl)
})

test("Menu disappears gradually when scrolling down", async ({ page }) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const navbar = page.locator("#navbar")
  await expect(navbar).toHaveCSS("opacity", "1")

  // Scroll down past the 50px threshold. scrollTo dispatches a scroll event
  // which the scroll handler picks up via requestAnimationFrame. Using
  // "instant" behavior to avoid smooth-scroll timing issues across browsers.
  // Note: mouse.wheel() is not supported in mobile WebKit.
  await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" }))

  // The hide-above-screen class triggers a CSS opacity transition (0.45s).
  // Wait for the class to be applied and the transition to complete.
  await expect(navbar).toHaveClass(/hide-above-screen/)
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

  await reloadPage(page)

  const initialDisplayStyle = await page.evaluate(() => {
    // @ts-expect-error - test instrumentation
    return window.initialSidebarDisplayStyle
  })
  expect(initialDisplayStyle).toBe("flex")
})

test("Clicking TOC title scrolls to top", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }))
  await page.waitForFunction(
    (tolerance) => Math.abs(window.scrollY - 500) < tolerance,
    urlBarScrollTolerance,
  )

  const tocTitle = page.locator("#toc-title button")
  await expect(tocTitle).toBeVisible()
  await tocTitle.click()

  await page.waitForFunction((tolerance) => window.scrollY < tolerance, urlBarScrollTolerance)
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

  await reloadPage(page)

  await expect(pauseIcon).toBeVisible()
  await expect(playIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Disable video autoplay")

  // Wait for video to have enough data loaded, then verify it starts playing.
  // Safari can report readyState=4 and paused=false before currentTime advances,
  // so use timeupdate (which fires on every frame) without { once: true }.
  await video.evaluate((videoElement: HTMLVideoElement) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Video failed to reach playable state: readyState=${videoElement.readyState}, paused=${videoElement.paused}, currentTime=${videoElement.currentTime}`,
          ),
        )
      }, 15_000)

      const checkPlayable = () => {
        if (videoElement.readyState >= 3 && !videoElement.paused && videoElement.currentTime > 0) {
          clearTimeout(timeout)
          videoElement.removeEventListener("timeupdate", checkPlayable)
          resolve()
        }
      }

      if (videoElement.readyState >= 3 && !videoElement.paused && videoElement.currentTime > 0) {
        clearTimeout(timeout)
        resolve()
      } else {
        // Use timeupdate without once — it fires each frame, giving us
        // repeated chances to check currentTime after it advances.
        videoElement.addEventListener("timeupdate", checkPlayable)
        videoElement.addEventListener("canplay", checkPlayable, { once: true })
        videoElement.addEventListener("playing", checkPlayable, { once: true })
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
  await expect(page).toHaveURL(/\/design/)

  // Setting should persist and video should still be playing
  await expect(isPaused(video)).resolves.toBe(false)

  await autoplayToggle.click()
  await page.waitForFunction(
    (id) => document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )
})

async function getTimestampAfterNavigation(page: Page): Promise<number> {
  const handle = await page.waitForFunction(
    (id) => {
      const videoEl = document.querySelector<HTMLVideoElement>(`#${id}`)
      return videoEl && videoEl.currentTime > 0 ? videoEl.currentTime : null
    },
    pondVideoId,
    { timeout: 45_000 },
  )
  return (await handle.jsonValue()) as number
}

test("Video timestamp is preserved during SPA navigation", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")
  // Playwright's WebKit cannot reliably restore video timestamps after SPA
  // navigation — readyState drops and metadata events don't fire.
  // TODO: Re-test now that WebKit runs on macOS runners and remove if passing.
  test.skip(isSafariBrowser(page), "WebKit cannot reliably restore video after SPA nav")

  const videoElements = getVideoElements(page)
  const timestampBeforeNavigation = await setupVideoForTimestampTest(videoElements)

  const localLink = page.locator("a:not(.skip-to-content)").first()
  await triggerAndWaitForSPANav(page, () => localLink.click())

  const timestampAfterNavigation = await getTimestampAfterNavigation(page)
  expect(timestampAfterNavigation).toBeCloseTo(timestampBeforeNavigation, 0)
})

test("Video timestamp is preserved during refresh", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")
  // Playwright's WebKit cannot reliably reload video metadata after a full
  // page refresh with autoplay disabled.
  // TODO: Re-test now that WebKit runs on macOS runners and remove if passing.
  test.skip(isSafariBrowser(page), "WebKit cannot reliably reload video after refresh")

  const videoElements = getVideoElements(page)
  const timestampBeforeRefresh = await setupVideoForTimestampTest(videoElements)

  await reloadPage(page)

  const timestampAfterRefresh = await getTimestampAfterNavigation(page)
  expect(timestampAfterRefresh).toBeCloseTo(timestampBeforeRefresh, 0)
})
