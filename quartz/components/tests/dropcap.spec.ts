import type { Locator } from "@playwright/test"

import { colorDropcapProbability, DROPCAP_COLORS } from "../constants"
import { expect, test } from "./fixtures"
import {
  gotoPage,
  isDesktopViewport,
  moveMouseToSafePosition,
  search,
  triggerAndWaitForSPANav,
  WAIT_POLL_INTERVAL_MS,
} from "./visual_utils"

const DROPCAP_URL = "http://localhost:8080/test-page"
// A solemn post that opts out of the random color via `no_dropcap_color`.
const OPTED_OUT_URL = "http://localhost:8080/bruce-wayne-and-the-cost-of-inaction"

/** Mock Math.random so sequential calls return the given values (then 0.5).
 *  Must accept values as a parameter (not closure) because addInitScript serializes the function. */
const mockRandom = (vals: number[]) => {
  let i = 0
  Math.random = () => vals[i++] ?? 0.5
}

/** Resolved color of the dropcap embellishment (the `::before` pseudo-element). */
const embellishmentColor = (paragraph: Locator) =>
  paragraph.evaluate((el) => getComputedStyle(el, "::before").color)

/** Resolve --midground-faint to an rgb() string via a throwaway probe element. */
const midgroundFaintColor = (paragraph: Locator) =>
  paragraph.evaluate((el) => {
    const probe = document.createElement("span")
    probe.style.color = "var(--midground-faint)"
    el.appendChild(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    return resolved
  })

const firstDropcapParagraph = (root: Locator) =>
  root.locator("> p:not(.subtitle):first-of-type").first()

test.describe("Random dropcap color", () => {
  test(`no color applied when Math.random >= ${colorDropcapProbability}`, async ({ page }) => {
    await page.addInitScript(mockRandom, [0.5])
    await gotoPage(page, DROPCAP_URL)

    // Retry: WebKit/Safari can destroy the execution context briefly after load
    await expect(async () => {
      const color = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--random-dropcap-color"),
      )
      expect(color).toBe("")
    }).toPass({ timeout: 10_000 })
  })

  for (const [i, color] of DROPCAP_COLORS.entries()) {
    test(`applies --dropcap-background-${color}`, async ({ page }) => {
      const colorFraction = (i + 0.5) / DROPCAP_COLORS.length
      await page.addInitScript(mockRandom, [0.01, colorFraction])
      await gotoPage(page, DROPCAP_URL)

      // Retry: WebKit/Safari can destroy the execution context briefly after load
      await expect(async () => {
        const value = await page.evaluate(() =>
          document.documentElement.style.getPropertyValue("--random-dropcap-color"),
        )
        expect(value).toBe(`var(--dropcap-background-${color})`)
      }).toPass({ timeout: 10_000 })
    })
  }

  test("colored dropcap looks different from default", async ({ page, context }) => {
    await page.addInitScript(mockRandom, [0.5])
    await gotoPage(page, DROPCAP_URL)

    const dropcap = page
      .locator('article[data-use-dropcap="true"] > p:not(.subtitle):first-of-type')
      .first()
    await dropcap.scrollIntoViewIfNeeded()
    const defaultShot = await dropcap.screenshot()

    // Use a fresh page to avoid WebKit crashing on a second navigation to the same URL
    const page2 = await context.newPage()
    await page2.addInitScript(mockRandom, [0.01, 0.0])
    await gotoPage(page2, DROPCAP_URL)
    const dropcap2 = page2
      .locator('article[data-use-dropcap="true"] > p:not(.subtitle):first-of-type')
      .first()
    await dropcap2.scrollIntoViewIfNeeded()

    expect(await dropcap2.screenshot()).not.toEqual(defaultShot)
    await page2.close()
  })

  test('data-no-dropcap-color="true" suppresses the rolled color', async ({ page }) => {
    // Force a colored roll (red) so the opt-out has something to suppress.
    await page.addInitScript(mockRandom, [0.01, 0.0])
    await gotoPage(page, DROPCAP_URL)

    const dropcapParagraph = firstDropcapParagraph(
      page.locator('article[data-use-dropcap="true"]').first(),
    )
    await dropcapParagraph.scrollIntoViewIfNeeded()

    const coloredEmbellishment = await embellishmentColor(dropcapParagraph)

    // Opting out reverts the embellishment to the monochrome --midground-faint.
    await dropcapParagraph.evaluate((el) =>
      el.closest("article")?.setAttribute("data-no-dropcap-color", "true"),
    )
    const monochromeEmbellishment = await embellishmentColor(dropcapParagraph)

    expect(monochromeEmbellishment).not.toBe(coloredEmbellishment)
    expect(monochromeEmbellishment).toBe(await midgroundFaintColor(dropcapParagraph))
  })

  test("opted-out page renders monochrome end-to-end even when a color rolls", async ({ page }) => {
    // Force a colored roll; the frontmatter→attribute→CSS chain must still win.
    await page.addInitScript(mockRandom, [0.01, 0.0])
    await gotoPage(page, OPTED_OUT_URL)

    const article = page.locator('article[data-use-dropcap="true"]').first()
    await expect(article).toHaveAttribute("data-no-dropcap-color", "true")

    const dropcapParagraph = firstDropcapParagraph(article)
    await dropcapParagraph.scrollIntoViewIfNeeded()
    expect(await embellishmentColor(dropcapParagraph)).toBe(
      await midgroundFaintColor(dropcapParagraph),
    )
  })

  // Popovers and search previews mirror another page's article, so the host
  // page's rolled --random-dropcap-color (set on the root element) would bleed
  // in and tint their dropcaps. Both must stay monochrome regardless.
  const forceRedRoll = async (page: Parameters<typeof gotoPage>[0]) => {
    await page.addInitScript(mockRandom, [0.01, 0.0])
    await gotoPage(page, DROPCAP_URL)
    await expect(async () => {
      const color = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--random-dropcap-color"),
      )
      expect(color).toBe("var(--dropcap-background-red)")
    }).toPass({ timeout: 10_000 })
  }

  test("search preview dropcap stays monochrome even when a color rolls", async ({ page }) => {
    test.skip(!isDesktopViewport(page), "Search preview dropcap is desktop-only")
    await forceRedRoll(page)

    await search(page, "test")
    const previewArticle = page.locator("#preview-container > article.search-preview")
    await expect(previewArticle).toHaveAttribute("data-use-dropcap", "true")

    // The preview wraps the fetched page's own <article>, and that inner
    // article is where the dropcap paragraph actually lives.
    const innerArticle = previewArticle.locator('article[data-use-dropcap="true"]').first()
    const dropcapParagraph = firstDropcapParagraph(innerArticle)
    await expect(dropcapParagraph).toBeAttached({ timeout: 15_000 })
    expect(await embellishmentColor(dropcapParagraph)).toBe(
      await midgroundFaintColor(dropcapParagraph),
    )
  })

  test("popover dropcap stays monochrome even when a color rolls", async ({ page }) => {
    test.skip(!isDesktopViewport(page), "Popovers are desktop-only")
    await forceRedRoll(page)
    // Clear the post-nav flag that suppresses Safari's spurious mouseenter events.
    await page.mouse.move(1, 1)

    // Point a link at a dropcap-using page so the popover fetches its article.
    const link = page.locator("a#first-link-test-page")
    await expect(link).toBeVisible()
    await link.evaluate((el) => (el as HTMLAnchorElement).setAttribute("href", "./test-page"))

    await link.hover()
    const popoverArticle = page.locator('.popover-inner article[data-use-dropcap="true"]').first()
    await expect(popoverArticle).toBeVisible({ timeout: 10_000 })

    const dropcapParagraph = firstDropcapParagraph(popoverArticle)
    await expect(dropcapParagraph).toBeAttached({ timeout: 10_000 })
    expect(await embellishmentColor(dropcapParagraph)).toBe(
      await midgroundFaintColor(dropcapParagraph),
    )

    await moveMouseToSafePosition(page)
  })

  test("color re-rolls on SPA navigation", async ({ page }) => {
    // IIFE roll: colored (0.01 < probability → pick red), SPA nav roll: no color (0.5 >= probability)
    await page.addInitScript(mockRandom, [0.01, 0.0, 0.5])
    await gotoPage(page, DROPCAP_URL)

    const getColor = () =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--random-dropcap-color"))

    expect(await getColor()).toBe("var(--dropcap-background-red)")

    // SPA-navigate away; nav event should re-roll and clear the color
    const link = page.locator("article a.internal:not(.same-page-link)").first()
    await link.scrollIntoViewIfNeeded()
    await triggerAndWaitForSPANav(page, () => link.click())
    // Wait for the nav event to fire and rollDropcapColor() to clear the property
    await page.waitForFunction(
      () => document.documentElement.style.getPropertyValue("--random-dropcap-color") === "",
      null,
      { timeout: 5_000, polling: WAIT_POLL_INTERVAL_MS },
    )
    expect(await getColor()).toBe("")
  })
})
