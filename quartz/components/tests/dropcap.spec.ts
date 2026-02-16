import { test, expect } from "@playwright/test"

const POND_COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink"]
const DROPCAP_URL = "http://localhost:8080/test-page"

test.describe("Random dropcap color", () => {
  test("dropcap uses default color when --random-dropcap-color is not set", async ({ page }) => {
    // Seed Math.random to always return >= 0.05 (no color applied)
    await page.addInitScript(() => {
      Math.random = () => 0.5
    })

    await page.goto(DROPCAP_URL, { waitUntil: "load" })

    const dropcapColor = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--random-dropcap-color"),
    )
    expect(dropcapColor).toBe("")
  })

  test("dropcap gets a random pond color when Math.random < 0.05", async ({ page }) => {
    // Seed Math.random: first call returns < 0.05 (triggers color),
    // second call picks color index
    await page.addInitScript(() => {
      const values = [0.01, 0.3] // 0.01 triggers color; 0.3 * 7 = 2.1 → index 2 → "yellow"
      let i = 0
      Math.random = () => values[i++] ?? 0.5
    })

    await page.goto(DROPCAP_URL, { waitUntil: "load" })

    const dropcapColor = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--random-dropcap-color"),
    )
    expect(dropcapColor).toBe("var(--dropcap-background-yellow)")
  })

  test.describe("each pond color is a valid dropcap color", () => {
    for (let colorIndex = 0; colorIndex < POND_COLORS.length; colorIndex++) {
      const color = POND_COLORS[colorIndex]
      test(`applies --dropcap-background-${color}`, async ({ page }) => {
        // First random() < 0.05 triggers color; second picks the color index
        const indexFraction = (colorIndex + 0.5) / POND_COLORS.length
        await page.addInitScript(
          ({ frac }) => {
            const values = [0.01, frac]
            let i = 0
            Math.random = () => values[i++] ?? 0.5
          },
          { frac: indexFraction },
        )

        await page.goto(DROPCAP_URL, { waitUntil: "load" })

        const dropcapColor = await page.evaluate(() =>
          document.documentElement.style.getPropertyValue("--random-dropcap-color"),
        )
        expect(dropcapColor).toBe(`var(--dropcap-background-${color})`)
      })
    }
  })

  test("colored dropcap looks different from default dropcap", async ({ page }) => {
    // First: load page without color (default)
    await page.addInitScript(() => {
      Math.random = () => 0.5 // No color
    })
    await page.goto(DROPCAP_URL, { waitUntil: "load" })

    const dropcapParagraph = page
      .locator('article[data-use-dropcap="true"] > p:not(.subtitle):first-of-type')
      .first()

    // Skip if no dropcap paragraph exists on this page
    const dropcapCount = await dropcapParagraph.count()
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (dropcapCount === 0) return

    await dropcapParagraph.scrollIntoViewIfNeeded()
    const defaultScreenshot = await dropcapParagraph.screenshot()

    // Now reload with a color forced
    await page.addInitScript(() => {
      const values = [0.01, 0.0] // index 0 → "red"
      let i = 0
      Math.random = () => values[i++] ?? 0.5
    })
    await page.goto(DROPCAP_URL, { waitUntil: "load" })

    await dropcapParagraph.scrollIntoViewIfNeeded()
    const coloredScreenshot = await dropcapParagraph.screenshot()

    expect(coloredScreenshot).not.toEqual(defaultScreenshot)
  })

  test("colored dropcap persists through SPA navigation and back", async ({ page }) => {
    await page.addInitScript(() => {
      const values = [0.01, 0.0] // "red"
      let i = 0
      Math.random = () => values[i++] ?? 0.5
    })
    await page.goto(DROPCAP_URL, { waitUntil: "load" })

    const initialColor = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--random-dropcap-color"),
    )
    expect(initialColor).toBe("var(--dropcap-background-red)")

    // Navigate to another page via SPA (click an internal link)
    const internalLink = page.locator("article a.internal").first()
    // eslint-disable-next-line playwright/no-conditional-in-test
    if ((await internalLink.count()) > 0) {
      await internalLink.click()
      await page.waitForURL(/localhost:8080/)

      // The CSS custom property is set on <html> so it persists across SPA navigations
      const colorAfterNav = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--random-dropcap-color"),
      )
      expect(colorAfterNav).toBe("var(--dropcap-background-red)")
    }
  })
})
