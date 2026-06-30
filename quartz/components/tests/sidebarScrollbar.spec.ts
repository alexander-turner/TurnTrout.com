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

/** A single colour token that resolves to fully transparent. Engines serialize
 *  `transparent` as the keyword, `rgba(0, 0, 0, 0)`, or `rgb(0 0 0 / 0)`. */
function isTransparentColor(color: string): boolean {
  return color === "transparent" || /[,/]\s*0\s*\)$/.test(color)
}

/** `transparent transparent` resolves to a pair of fully-transparent colours. */
function isTransparentPair(value: string): boolean {
  const colors = value.toLowerCase().match(/transparent|rgba?\([^)]*\)/g) ?? []
  return colors.length === 2 && colors.every(isTransparentColor)
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

      expect(isTransparentPair(await getScrollbarColor(sidebar))).toBe(true)

      await sidebar.hover()
      await expect(async () => {
        expect(isTransparentPair(await getScrollbarColor(sidebar))).toBe(false)
      }).toPass()

      await moveMouseToSafePosition(page)
      await expect(async () => {
        expect(isTransparentPair(await getScrollbarColor(sidebar))).toBe(true)
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
    // sidebar never adopts the transparent-then-coloured scrollbar behavior.
    expect(isTransparentPair(await getScrollbarColor(sidebar))).toBe(false)
  })
})
