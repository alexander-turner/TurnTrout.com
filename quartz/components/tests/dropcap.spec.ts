import { test, expect } from "@playwright/test"

import { colorDropcapProbability, DROPCAP_COLORS } from "../constants"

const DROPCAP_URL = "http://localhost:8080/test-page"

/** Mock Math.random so sequential calls return the given values (then 0.5).
 *  Must accept values as a parameter (not closure) because addInitScript serializes the function. */
const mockRandom = (vals: number[]) => {
  let i = 0
  Math.random = () => vals[i++] ?? 0.5
}

test.describe("Random dropcap color", () => {
  test(`no color applied when Math.random >= ${colorDropcapProbability}`, async ({ page }) => {
    await page.addInitScript(mockRandom, [0.5])
    await page.goto(DROPCAP_URL, { waitUntil: "load" })

    const color = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--random-dropcap-color"),
    )
    expect(color).toBe("")
  })

  for (const [i, color] of DROPCAP_COLORS.entries()) {
    test(`applies --dropcap-background-${color}`, async ({ page }) => {
      const colorFraction = (i + 0.5) / DROPCAP_COLORS.length
      await page.addInitScript(mockRandom, [0.01, colorFraction])
      await page.goto(DROPCAP_URL, { waitUntil: "load" })

      const value = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--random-dropcap-color"),
      )
      expect(value).toBe(`var(--dropcap-background-${color})`)
    })
  }

  test("colored dropcap looks different from default", async ({ page }) => {
    await page.addInitScript(mockRandom, [0.5])
    await page.goto(DROPCAP_URL, { waitUntil: "load" })

    const dropcap = page
      .locator('article[data-use-dropcap="true"] > p:not(.subtitle):first-of-type')
      .first()
    await dropcap.scrollIntoViewIfNeeded()
    const defaultShot = await dropcap.screenshot()

    // Reload with red forced
    await page.addInitScript(mockRandom, [0.01, 0.0])
    await page.goto(DROPCAP_URL, { waitUntil: "load" })
    await dropcap.scrollIntoViewIfNeeded()

    expect(await dropcap.screenshot()).not.toEqual(defaultShot)
  })

  test("color re-rolls on SPA navigation", async ({ page }) => {
    // IIFE roll: colored (0.01 < probability → pick red), SPA nav roll: no color (0.5 >= probability)
    await page.addInitScript(mockRandom, [0.01, 0.0, 0.5])
    await page.goto(DROPCAP_URL, { waitUntil: "load" })

    const getColor = () =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--random-dropcap-color"))

    expect(await getColor()).toBe("var(--dropcap-background-red)")

    // SPA-navigate away; nav event should re-roll and clear the color
    const link = page.locator("article a.internal:not(.same-page-link)").first()
    await link.scrollIntoViewIfNeeded()
    await link.click()
    await page.waitForURL(/localhost:8080/)
    expect(await getColor()).toBe("")
  })
})
