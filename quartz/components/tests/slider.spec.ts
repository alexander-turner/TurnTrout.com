import { test, expect } from "./fixtures"
import { gotoPage } from "./visual_utils"

test.describe("img-comparison-slider", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, "http://localhost:8080/design", "domcontentloaded")
  })

  test("slider height matches the shorter image", async ({ page }) => {
    const slider = page.locator("img-comparison-slider").first()
    await expect(slider).toBeVisible()

    const { sliderHeight, minImageHeight } = await page.evaluate(() => {
      const el = document.querySelector("img-comparison-slider")
      if (!el) throw new Error("Slider not found")

      const first = el.querySelector<HTMLImageElement>('[slot="first"]')
      const second = el.querySelector<HTMLImageElement>('[slot="second"]')
      if (!first || !second) throw new Error("Images not found")

      // Both images have aspect-ratio set via assetDimensions, so their
      // rendered heights reflect their aspect ratios at width: 100%.
      const h1 = first.getBoundingClientRect().height
      const h2 = second.getBoundingClientRect().height

      return {
        sliderHeight: el.getBoundingClientRect().height,
        minImageHeight: Math.min(h1, h2),
      }
    })

    // The slider should be constrained to the shorter image's height (±1px rounding)
    expect(sliderHeight).toBeGreaterThan(0)
    expect(sliderHeight).toBeLessThanOrEqual(minImageHeight + 1)
    expect(sliderHeight).toBeGreaterThanOrEqual(minImageHeight - 1)
  })

  test("slider clips the taller image rather than expanding", async ({ page }) => {
    const slider = page.locator("img-comparison-slider").first()
    await expect(slider).toBeVisible()

    // The design page slider compares images with different aspect ratios.
    // The taller image's rendered height should exceed the slider's visible height.
    const { sliderHeight, maxImageHeight } = await page.evaluate(() => {
      const el = document.querySelector("img-comparison-slider")
      if (!el) throw new Error("Slider not found")

      const first = el.querySelector<HTMLImageElement>('[slot="first"]')
      const second = el.querySelector<HTMLImageElement>('[slot="second"]')
      if (!first || !second) throw new Error("Images not found")

      return {
        sliderHeight: el.getBoundingClientRect().height,
        maxImageHeight: Math.max(
          first.getBoundingClientRect().height,
          second.getBoundingClientRect().height,
        ),
      }
    })

    // The taller image is clipped — slider height is less than its rendered height
    expect(sliderHeight).toBeLessThan(maxImageHeight)
  })
})
