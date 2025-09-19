import { test, expect, type Page, type Locator } from "@playwright/test"

import { pondVideoId } from "../component_utils"
import { type Theme } from "../scripts/darkmode"
import { takeRegressionScreenshot, isDesktopViewport, setTheme } from "./visual_utils"

// Video test helpers
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

  // Check if video is already playing
  const isCurrentlyPaused = await isPaused(video)

  // If video is paused, click toggle to enable autoplay
  if (isCurrentlyPaused) {
    await videoElements.autoplayToggle.click()
    await video
      .page()
      .waitForFunction(
        (id: string) => !document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
        pondVideoId,
      )
  }
}

const fixedTimestamp = 2.5
const timestampTolerance = 0.1
async function setupVideoForTimestampTest(videoElements: VideoElements): Promise<number> {
  const { video } = videoElements

  await ensureVideoPlaying(videoElements)

  // Set a fixed timestamp instead of waiting
  await video.evaluate((v: HTMLVideoElement, timestamp: number) => {
    v.currentTime = timestamp
  }, fixedTimestamp)

  const timestamp = await getCurrentTime(video)
  expect(timestamp).toBeCloseTo(fixedTimestamp, 1)

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
  await expect(pauseIcon).toBeVisible()
  await expect(playIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Disable video autoplay")
})

test("Video toggle changes autoplay behavior", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const { video, autoplayToggle, playIcon, pauseIcon } = getVideoElements(page)

  await expect(video).toBeVisible()
  expect(await isPaused(video)).toBe(false)
  await expect(pauseIcon).toBeVisible()
  await expect(playIcon).toBeHidden()

  await autoplayToggle.click()

  // Video should pause and icons should switch
  await page.waitForFunction(
    (id) => document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )
  await expect(playIcon).toBeVisible()
  await expect(pauseIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Enable video autoplay")

  await autoplayToggle.click()

  await page.waitForFunction(
    (id) => !document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )
  await expect(pauseIcon).toBeVisible()
  await expect(playIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Disable video autoplay")
})

test("Video autoplay preference persists across page reloads", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const { video, autoplayToggle, playIcon, pauseIcon } = getVideoElements(page)

  await autoplayToggle.click()
  await expect(playIcon).toBeVisible()
  await expect(pauseIcon).toBeHidden()

  await page.reload({ waitUntil: "load" })

  await expect(playIcon).toBeVisible()
  await expect(pauseIcon).toBeHidden()
  await expect(autoplayToggle).toHaveAttribute("aria-label", "Enable video autoplay")
  expect(await isPaused(video)).toBe(true)
})

test("Video autoplay works correctly after SPA navigation", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const { video, autoplayToggle } = getVideoElements(page)

  await autoplayToggle.click()
  await page.waitForFunction(
    (id) => document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )

  const initialUrl = page.url()
  // TODO might not be local
  const localLink = page.locator("a").first()
  await localLink.click()
  await page.waitForURL((url) => url.pathname !== initialUrl)

  // Setting should persist and video should still be paused
  expect(await isPaused(video)).toBe(true)

  await autoplayToggle.click()
  await page.waitForFunction(
    (id) => !document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )
})

test("Video timestamp is preserved during SPA navigation", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const videoElements = getVideoElements(page)
  const { video } = videoElements

  const timestampBeforeNavigation = await setupVideoForTimestampTest(videoElements)

  const initialUrl = page.url()
  const localLink = page.locator("a").first()
  await localLink.click()
  await page.waitForURL((url) => url.pathname !== initialUrl)

  const timestampAfterNavigation = await getCurrentTime(video)
  expect(timestampAfterNavigation).toBeGreaterThan(timestampBeforeNavigation - timestampTolerance)
})

test("Video timestamp is preserved during refresh", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const videoElements = getVideoElements(page)
  const { video } = videoElements
  const targetTimestamp = await setupVideoForTimestampTest(videoElements)

  // Wait for timestamp to be saved to sessionStorage
  await page.waitForFunction(
    (args) => {
      const saved = sessionStorage.getItem(args.key)
      return saved && Math.abs(parseFloat(saved) - args.timestamp) < 0.1
    },
    { key: "pond-video-timestamp", timestamp: targetTimestamp },
  )

  await page.reload()

  const timestampAfterRefresh = await getCurrentTime(video)
  expect(timestampAfterRefresh).toBeGreaterThan(targetTimestamp - timestampTolerance)
})
