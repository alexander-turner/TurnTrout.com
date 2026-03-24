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
  await page.emulateMedia({ media: "print" })
  const darkScreenshot = await page.screenshot({
    animations: "disabled",
    scale: "css",
  })

  expect(darkScreenshot).toEqual(lightScreenshot)
})
