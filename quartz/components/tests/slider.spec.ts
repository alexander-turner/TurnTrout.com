import { test, expect } from "./fixtures"
import { gotoPage } from "./visual_utils"

test.describe("img-comparison-slider", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/design", "domcontentloaded")
  })

  test("slider height does not exceed 80vh", async ({ page }) => {
    const slider = page.locator("img-comparison-slider").first()
    await expect(slider).toBeVisible()

    const { sliderHeight, viewportHeight } = await page.evaluate(() => {
      const el = document.querySelector("img-comparison-slider")
      if (!el) throw new Error("Slider not found")
      return {
        sliderHeight: el.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
      }
    })

    const maxAllowed = viewportHeight * 0.8
    expect(sliderHeight).toBeLessThanOrEqual(maxAllowed + 1) // +1 for rounding
  })

  test("slider clips tall images rather than expanding to full image height", async ({ page }) => {
    const slider = page.locator("img-comparison-slider").first()
    await expect(slider).toBeVisible()

    // The second (after) image is a full-page screenshot (1920x6581).
    // At any reasonable container width, its natural height far exceeds 80vh.
    // Verify the slider clips it rather than expanding to the full image height.
    const { sliderHeight, secondImageRenderedHeight } = await page.evaluate(() => {
      const el = document.querySelector("img-comparison-slider")
      if (!el) throw new Error("Slider not found")

      const secondImg = el.querySelector<HTMLImageElement>('[slot="second"]')
      if (!secondImg) throw new Error("Second image not found")

      return {
        sliderHeight: el.getBoundingClientRect().height,
        // The image's rendered height (height: auto) exceeds the slider due to overflow clipping
        secondImageRenderedHeight: secondImg.getBoundingClientRect().height,
      }
    })

    // The image's rendered height should exceed the slider's visible height,
    // proving the slider is clipping the overflow
    expect(sliderHeight).toBeLessThan(secondImageRenderedHeight)
  })
})
