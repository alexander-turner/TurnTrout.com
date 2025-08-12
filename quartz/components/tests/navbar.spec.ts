import { test, expect } from "@playwright/test"

import { pondVideoId } from "../component_utils"
import { type Theme } from "../scripts/darkmode"
import { takeRegressionScreenshot, isDesktopViewport, setTheme } from "./visual_utils"

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

  // Initial state check
  await expect(navbar).toBeVisible()
  await expect(navbar).not.toHaveClass(/hide-above-screen/)

  // Scroll down
  await page.evaluate(() => {
    window.scrollTo({
      top: 250,
      behavior: "instant",
    })
  })

  // Wait for scroll animation and navbar to hide
  await expect(navbar).toHaveClass(/hide-above-screen/)
  await expect(navbar).toHaveCSS("opacity", "0")

  // Scroll back up
  await page.evaluate(() => {
    window.scrollTo({
      top: 0,
      behavior: "instant",
    })
  })

  // Wait for scroll animation and navbar to show
  await expect(navbar).not.toHaveClass(/hide-above-screen/)
  await expect(navbar).toBeVisible()
})

test("Menu disappears gradually when scrolling down", async ({ page }) => {
  test.skip(isDesktopViewport(page), "Mobile-only test")

  const navbar = page.locator("#navbar")

  // Initial state check
  await expect(navbar).toHaveCSS("opacity", "1")

  // Scroll down
  await page.evaluate(() => window.scrollBy(0, 100))

  // Sample opacity values during the transition
  const getNavbarOpacity = () => navbar.evaluate((el) => getComputedStyle(el).opacity)
  const opacityValues: number[] = [Number(await getNavbarOpacity())]
  for (let i = 0; i < 10; i++) {
    const opacity = await getNavbarOpacity()
    opacityValues.push(Number(opacity))
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(80) // Wait a bit between samples
  }
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(500)
  const finalOpacity = await navbar.evaluate((el) => getComputedStyle(el).opacity)
  opacityValues.push(Number(finalOpacity))

  // Verify we saw some intermediate values between 1 and 0
  expect(opacityValues).toContain(1) // Should start at 1
  expect(opacityValues).toContain(0) // Should end at 0
  expect(opacityValues.some((v) => v > 0 && v < 1)).toBeTruthy() // Should have intermediate values
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

  // Initial state - no shadow
  await expect(navbar).not.toHaveClass(/shadow/)
  await takeNavbarScreenshot("navbar-no-shadow")

  // Scroll down slightly to trigger shadow
  await page.evaluate(() => {
    window.scrollTo({
      top: 50,
      behavior: "instant",
    })
  })

  // Verify shadow class is added
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

test("Video plays on hover and pauses on mouse leave", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const video = page.locator(`video#${pondVideoId}`)

  const isPaused = async () => video.evaluate((v: HTMLVideoElement) => v.paused)

  // 1. Initial state: Paused
  await expect(video).toBeVisible()
  expect(await isPaused()).toBe(true)

  // 2. Hover over: Plays
  await video.dispatchEvent("mouseenter")
  await page.waitForFunction(
    (id) => !document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )

  // 3. Hover away: Pauses
  await video.dispatchEvent("mouseleave")
  await page.waitForFunction(
    (id) => document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )
})

test("Video plays on hover and pauses on mouse leave (SPA)", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Desktop-only test")

  const video = page.locator(`video#${pondVideoId}`)

  const isPaused = async () => video.evaluate((v: HTMLVideoElement) => v.paused)

  // 1. Initial state: Paused
  await expect(video).toBeVisible()
  expect(await isPaused()).toBe(true)

  // Navigate to a new page
  const initialUrl = page.url()
  const localLink = page.locator("a").first()
  await localLink.click()
  await page.waitForURL((url) => url.pathname !== initialUrl)

  // 2. Hover over: Plays
  await video.dispatchEvent("mouseenter")
  await page.waitForFunction(
    (id) => !document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )

  // 3. Hover away: Pauses
  await video.dispatchEvent("mouseleave")
  await page.waitForFunction(
    (id) => document.querySelector<HTMLVideoElement>(`#${id}`)?.paused,
    pondVideoId,
  )
})
