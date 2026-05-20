import { invertInDarkModeClass } from "../constants"
import { test, expect } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Page picked because it has 13 invert-tagged images — historically the
// slowest theme-switch on the site and the regression case that motivated
// the closed-form HSL inversion in `accurate-invert.ts`. The page id is
// hard-coded so a future content change that drops images doesn't silently
// turn this test into a no-op.
const TARGET_URL = "http://localhost:8080/avoiding-side-effects-in-complex-environments"
const EXPECTED_IMAGE_COUNT = 13

// 1.0s gives ~6x headroom over the post-fix runtime (~150ms on a CI runner
// with software-rendered canvas) while still flagging a regression to the
// d3-color object-allocating path, which took ~1.5s on the same page.
const BUDGET_MS = 1000

test("theme switch processes inverted images within budget", async ({ page }) => {
  await gotoPage(page, TARGET_URL, "load")

  // Pre-flight: confirm the page actually has the expected invert-tagged
  // images so the perf assertion isn't measuring an empty queue.
  await page.waitForFunction(
    ({ selector, expected }) => {
      const imgs = document.querySelectorAll<HTMLImageElement>(selector)
      if (imgs.length < expected) return false
      return Array.from(imgs).every((img) => img.complete && img.naturalWidth > 0)
    },
    { selector: `img.${invertInDarkModeClass}`, expected: EXPECTED_IMAGE_COUNT },
    { timeout: 30_000 },
  )

  const durationMs = await page.evaluate(
    async ({ selector }) => {
      // Force light mode first so the dark-mode flip below has work to do.
      document.documentElement.setAttribute("data-theme", "light")
      // Wait one frame so any revert work from the flip to light settles
      // before we start the clock.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(selector))
      const start = performance.now()
      document.documentElement.setAttribute("data-theme", "dark")

      // Poll for the marker the inversion script sets on each processed img.
      // Bracketing in-page with performance.now() avoids visual/timing noise
      // from Playwright IPC.
      await new Promise<void>((resolve, reject) => {
        const deadline = start + 10_000
        const tick = () => {
          if (imgs.every((img) => img.dataset["invertProcessed"] === "1")) {
            resolve()
            return
          }
          if (performance.now() > deadline) {
            reject(new Error("timed out waiting for invert-processed marker"))
            return
          }
          requestAnimationFrame(tick)
        }
        tick()
      })
      return performance.now() - start
    },
    { selector: `img.${invertInDarkModeClass}` },
  )

  expect(durationMs).toBeLessThan(BUDGET_MS)
})
