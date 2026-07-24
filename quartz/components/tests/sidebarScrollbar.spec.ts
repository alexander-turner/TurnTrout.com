import type { Locator, Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { gotoPage, isDesktopViewport, moveMouseToSafePosition } from "./visual_utils"

/** Read the resolved `scrollbar-color` of an element. */
function getScrollbarColor(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).scrollbarColor)
}

/** Whether the browser resolves `scrollbar-color` in computed style. Older
 *  WebKit reports `auto` regardless, so colour assertions are gated on this. */
function supportsScrollbarColor(page: Page): Promise<boolean> {
  return page.evaluate(() => CSS.supports("scrollbar-color", "red transparent"))
}

/** Split a resolved `scrollbar-color` pair into its thumb and track colours. */
function parseColorPair(value: string): readonly string[] {
  return value.toLowerCase().match(/transparent|rgba?\([^)]*\)/g) ?? []
}

/** The resting state hides the thumb by matching it to the track, with both
 *  colours fully opaque — Chromium can paint transparent scrollbar colours as
 *  black, so transparency must never be part of the resting state. */
function isHiddenOpaquePair(value: string): boolean {
  const [thumb, track] = parseColorPair(value)
  if (!thumb || !track) return false
  const opaque = /^rgb\(/.test(thumb) && /^rgb\(/.test(track)
  return thumb === track && opaque
}

/** The revealed state paints the thumb a different colour than the track. */
function isRevealedPair(value: string): boolean {
  const [thumb, track] = parseColorPair(value)
  return Boolean(thumb && track) && thumb !== track
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page", "domcontentloaded")
  await moveMouseToSafePosition(page)
})

test.describe("Sidebar scrollbar appears only on hover (desktop)", () => {
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
