import type { Locator, Page } from "@playwright/test"

import { minDesktopWidth } from "../../styles/variables"
import { expect, routeCdnAssetStubs, test } from "./fixtures"
import { gotoPage, isDesktopViewport, moveMouseToSafePosition } from "./visual_utils"

const testPageUrl = "http://localhost:8080/test-page"

/** Read the resolved `scrollbar-color` of an element. */
function getScrollbarColor(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).scrollbarColor)
}

/** Custom scrollbar colours are reserved for scrollbars the engine keeps on
 *  screen. A touch device's overlay scrollbar fades out after a scroll and
 *  leaves its custom colours painted behind, so those devices keep `auto`. */
function usesClassicScrollbars(page: Page): Promise<boolean> {
  return page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)
}

/** Whether the browser resolves `scrollbar-color` in computed style. Older
 *  WebKit reports `auto` regardless, so colour assertions are gated on this. */
function supportsScrollbarColor(page: Page): Promise<boolean> {
  return page.evaluate(() => CSS.supports("scrollbar-color", "red transparent"))
}

/** Split a resolved `scrollbar-color` pair into its thumb and track colours.
 *  Engines serialize colours as `rgb()`/`rgba()`, `color(srgb …)` (Chromium
 *  for `color-mix()` results), or the `transparent` keyword. */
function parseColorPair(value: string): readonly string[] {
  return value.toLowerCase().match(/[a-z-]+\([^)]*\)|transparent/g) ?? []
}

/** Engines only include an alpha component when it is below 1, either as a
 *  fourth `rgba()` argument or after a slash in modern syntax. */
function isOpaqueColor(color: string): boolean {
  return color !== "transparent" && !/rgba\(/.test(color) && !/\/\s*[\d.]+%?\s*\)/.test(color)
}

/** The resting state hides the thumb by matching it to the track, with both
 *  colours fully opaque — Chromium can paint transparent scrollbar colours as
 *  black, so transparency must never be part of the resting state. */
function isHiddenOpaquePair(value: string): boolean {
  const [thumb, track] = parseColorPair(value)
  if (!thumb || !track) return false
  return thumb === track && isOpaqueColor(thumb) && isOpaqueColor(track)
}

/** The revealed state paints the thumb a different colour than the track. */
function isRevealedPair(value: string): boolean {
  const [thumb, track] = parseColorPair(value)
  return Boolean(thumb && track) && thumb !== track
}

/** Register the shared setup for groups that assert on the fixture page. */
function useTestPage(): void {
  test.beforeEach(async ({ page }) => {
    await gotoPage(page, testPageUrl, "domcontentloaded")
    await moveMouseToSafePosition(page)
  })
}

/** Read the resolved `scrollbar-color`/`scrollbar-width` of `document.body`. */
function getBodyScrollbarStyle(page: Page): Promise<{ color: string; width: string }> {
  return page.evaluate(() => {
    const style = getComputedStyle(document.body)
    return { color: style.scrollbarColor, width: style.scrollbarWidth }
  })
}

test.describe("Page scrollbar", () => {
  useTestPage()

  test("classic-scrollbar devices get the restyled thin scrollbar", async ({ page }) => {
    test.skip(
      !(await supportsScrollbarColor(page)),
      "Browser does not resolve scrollbar-color in computed style",
    )
    test.skip(!(await usesClassicScrollbars(page)), "Only relevant for hover+fine-pointer devices")

    const { color, width } = await getBodyScrollbarStyle(page)
    expect(isRevealedPair(color)).toBe(true)
    expect(width).toBe("thin")
  })

  test("touch devices keep the native scrollbar", async ({ page }) => {
    test.skip(
      !(await supportsScrollbarColor(page)),
      "Browser does not resolve scrollbar-color in computed style",
    )
    test.skip(await usesClassicScrollbars(page), "Only relevant for coarse-pointer devices")

    const { color, width } = await getBodyScrollbarStyle(page)
    expect(color).toBe("auto")
    // Engines pick their own un-styled width for an overlay scrollbar —
    // Firefox resolves "none" under touch emulation where Chromium says
    // "auto" — so accept either, as long as our "thin" rule stayed out.
    expect(["auto", "none"]).toContain(width)
  })
})

test.describe("Sidebar scrollbar appears only on hover (desktop)", () => {
  useTestPage()

  // The hover-reveal rule targets `.sidebar`, so both sidebars get the behavior.
  for (const selector of ["#left-sidebar", "#right-sidebar"] as const) {
    test(`${selector} thumb is hidden until the sidebar is hovered`, async ({ page }) => {
      test.skip(!isDesktopViewport(page), "Hover-reveal scrollbar is a desktop-only behavior")
      test.skip(
        !(await supportsScrollbarColor(page)),
        "Browser does not resolve scrollbar-color in computed style",
      )

      const sidebar = page.locator(selector)
      await expect(sidebar).toBeVisible()

      expect(isHiddenOpaquePair(await getScrollbarColor(sidebar))).toBe(true)

      await sidebar.hover()
      await expect(async () => {
        expect(isRevealedPair(await getScrollbarColor(sidebar))).toBe(true)
      }).toPass()

      await moveMouseToSafePosition(page)
      await expect(async () => {
        expect(isHiddenOpaquePair(await getScrollbarColor(sidebar))).toBe(true)
      }).toPass()
    })
  }
})

test.describe("Sidebar scrollbar (mobile)", () => {
  useTestPage()

  test("hover does not reveal a scrollbar", async ({ page }) => {
    test.skip(isDesktopViewport(page), "Mobile-only assertion")
    test.skip(
      !(await supportsScrollbarColor(page)),
      "Browser does not resolve scrollbar-color in computed style",
    )

    const sidebar = page.locator("#left-sidebar")

    // The hover-reveal rule lives inside a desktop media query, so on mobile the
    // sidebar never adopts the hidden-thumb resting state.
    expect(isHiddenOpaquePair(await getScrollbarColor(sidebar))).toBe(false)
  })
})

test.describe("Sidebar scrollbar (touch device at desktop width)", () => {
  // A large tablet is wide enough for the desktop layout while still painting
  // fading overlay scrollbars, so its sidebars keep the native scrollbar.
  test("sidebars keep the native scrollbar", async ({ browser, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "Only Chromium emulates a coarse pointer")
    test.skip(
      !testInfo.project.name.startsWith("Desktop"),
      "Emulation is set up in-test, so one project is enough",
    )

    const context = await browser.newContext({
      viewport: { width: minDesktopWidth, height: 900 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    })
    try {
      await routeCdnAssetStubs(context)
      const page = await context.newPage()
      await gotoPage(page, testPageUrl, "domcontentloaded")
      expect(await usesClassicScrollbars(page)).toBe(false)

      for (const selector of ["#left-sidebar", "#right-sidebar"] as const) {
        const sidebar = page.locator(selector)
        await expect(sidebar).toBeVisible()
        expect(await getScrollbarColor(sidebar)).toBe("auto")
        expect(await sidebar.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe("auto")
      }
    } finally {
      await context.close()
    }
  })
})
