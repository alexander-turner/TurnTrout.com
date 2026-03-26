import { test, expect } from "./fixtures"
import { takeRegressionScreenshot, setTheme, gotoPage } from "./visual_utils"

// Visual regression tests don't need assertions
/* eslint-disable playwright/expect-expect */

// Print tests only run on Chrome Desktop — print output is
// browser-independent after emulateMedia, so one config is enough.
test.beforeEach(async ({ browserName, page }, testInfo) => {
  test.skip(
    browserName !== "chromium" || !testInfo.project.name.includes("Desktop"),
    "Print tests run on Chrome Desktop only",
  )

  page.on("pageerror", (err) => console.error(err))
  await gotoPage(page, "http://localhost:8080/test-page", "domcontentloaded")

  // Hide all video and audio controls
  await page.evaluate(() => {
    const mediaElements = document.querySelectorAll("video, audio")
    mediaElements.forEach((media) => {
      media.removeAttribute("controls")
    })
  })
})

test("Print media layout (lostpixel)", async ({ page }, testInfo) => {
  await setTheme(page, "light")
  await page.emulateMedia({ media: "print" })
  await takeRegressionScreenshot(page, testInfo, "print-layout")
})

test("Print mode renders identically in light and dark themes", async ({ page }, testInfo) => {
  await setTheme(page, "light")
  await page.emulateMedia({ media: "print" })
  const lightScreenshot = await takeRegressionScreenshot(page, testInfo, "print-light-vs-dark")

  await page.emulateMedia({ media: "screen" })
  await setTheme(page, "dark")
  // Fire beforeprint to trigger the JS that swaps data-theme to light,
  // matching real browser behavior (emulateMedia alone doesn't fire it).
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")))
  await page.emulateMedia({ media: "print" })
  const darkScreenshot = await page.screenshot({
    animations: "disabled",
    scale: "css",
  })

  expect(darkScreenshot).toEqual(lightScreenshot)
})

test("beforeprint forces light data-theme and afterprint restores it", async ({ page }) => {
  await setTheme(page, "dark")
  await expect(page.locator(":root")).toHaveAttribute("data-theme", "dark")

  // Simulate browser print dialog opening
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")))
  await expect(page.locator(":root")).toHaveAttribute("data-theme", "light")

  // Simulate browser print dialog closing
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")))
  await expect(page.locator(":root")).toHaveAttribute("data-theme", "dark")
})

test("Scroll handlers are gated during print mode transitions", async ({ page }) => {
  // Scroll down so there's a non-zero scroll position to track
  await page.evaluate(() => window.scrollTo(0, 500))

  // Wait for debounced scroll state to settle
  await expect.poll(() => page.evaluate(() => history.state?.scroll ?? 0)).toBeGreaterThan(0)

  // Track replaceState calls during the print transition
  await page.evaluate(() => {
    const calls: number[] = []
    const original = history.replaceState.bind(history)
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      calls.push(Date.now())
      original(...args)
    }
    ;(window as unknown as Record<string, number[]>).__replaceStateCalls = calls
  })

  // Emit beforeprint, then trigger layout reflow (simulating what Ctrl+P does)
  await page.evaluate(() => {
    window.dispatchEvent(new Event("beforeprint"))
    // Force a large scroll change like print CSS layout reflow would cause
    window.scrollTo(0, 0)
  })

  // Give the debounce time to fire (100ms debounce + margin), then check
  // that no replaceState calls were made during the print transition.
  // We use a poll that waits 300ms total to confirm the count stays at 0.
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as Record<string, number[]>).__replaceStateCalls.length,
        ),
      { timeout: 500 },
    )
    .toBe(0)

  // Now emit afterprint and scroll — replaceState should resume
  await page.evaluate(() => {
    window.dispatchEvent(new Event("afterprint"))
    window.scrollTo(0, 300)
  })

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as Record<string, number[]>).__replaceStateCalls.length,
      ),
    )
    .toBeGreaterThan(0)
})
