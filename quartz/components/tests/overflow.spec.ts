import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Invariant: no page may overflow horizontally. Two failure modes hide from our
// other checks, so each gets its own probe:
//
//  1. Document-level horizontal scroll — a box wider than the viewport pushes a
//     horizontal scrollbar onto the whole page. Checked down to a 320px floor.
//  2. Content clipped by an `overflow: hidden`/`clip` container — no scrollbar
//     appears, so the content is silently cut off and both the document-scroll
//     probe and pixel-diff screenshots miss it. (This is how the
//     agent-input-sanitizer transclude clipped long inline code in its
//     admonition.)
//
// Assertion-based, so unlike visual regression it is baseline-independent: it
// catches pre-existing overflow, not just regressions.

// High-overflow-risk pages: long inline code, transcluded external README
// content, wide tables, and the visual kitchen-sink test page.
const PAGES_TO_CHECK: readonly string[] = ["/", "/test-page", "/design", "/research", "/posts"]

// The clipped-content probe runs at tablet/desktop widths. Below ~375px the
// site still has known narrow-width clips (long inline code / unbreakable
// tokens inside list items and definition terms); those are tracked separately,
// so widening this floor would assert something not yet true.
const CLIP_WIDTHS: readonly number[] = [768, 1280]

// The page must never grow a horizontal scrollbar, even one notch below the
// narrowest supported device (iPhone 12, 390px).
const SCROLL_WIDTHS: readonly number[] = [320, 375, ...CLIP_WIDTHS]

// Subpixel rounding can report a 1px phantom overflow; require a real one.
const TOLERANCE_PX = 2

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

interface Offender {
  readonly tag: string
  readonly className: string
  readonly overflowBy: number
}

// Runs in the page. Flags a clipping element only when a descendant's right edge
// actually extends past the element's content box — `scrollWidth > clientWidth`
// alone reports phantom overflow from box-model quirks. Descends through the
// tree but skips two subtrees whose geometry is not a real clip:
//   - scroll containers (overflow-x auto/scroll), whose content is reachable;
//   - SVG, whose path/geometry rects are not layout boxes.
/* istanbul ignore next -- executed in the browser, not under Jest */
function collectClipped([tolerance, svgNamespace]: readonly [number, string]): Offender[] {
  const isScrollable = (el: Element): boolean => {
    const overflowX = getComputedStyle(el).overflowX
    return overflowX === "auto" || overflowX === "scroll"
  }

  const offenders: Offender[] = []
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    if (el.namespaceURI === svgNamespace) continue
    const style = getComputedStyle(el)
    if (style.display === "none" || style.visibility === "hidden") continue
    // Visually-hidden a11y text (skip links, sr-only) is clipped offscreen on
    // purpose via clip-path/clip and legitimately overflows its box.
    if (style.clipPath !== "none" || style.clip !== "auto") continue
    if (style.overflowX !== "hidden" && style.overflowX !== "clip") continue

    const rect = el.getBoundingClientRect()
    const contentRight = rect.left + el.clientLeft + el.clientWidth

    let clipped: Element | null = null
    const stack: Element[] = Array.from(el.children)
    while (stack.length > 0) {
      const descendant = stack.pop() as Element
      if (descendant.namespaceURI === svgNamespace || isScrollable(descendant)) continue
      const descendantRect = descendant.getBoundingClientRect()
      if (descendantRect.width > 0 && descendantRect.right > contentRight + tolerance) {
        clipped = descendant
        break
      }
      stack.push(...Array.from(descendant.children))
    }

    if (clipped) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className : "",
        overflowBy: Math.round(clipped.getBoundingClientRect().right - contentRight),
      })
    }
  }
  return offenders
}

/* istanbul ignore next -- executed in the browser, not under Jest */
function documentOverflow(): number {
  const root = document.documentElement
  return root.scrollWidth - root.clientWidth
}

/* istanbul ignore next -- executed in the browser, not under Jest */
function scrollablesAreWrapped(): boolean {
  const scrollables = Array.from(document.querySelectorAll(".table-container, .katex-display"))
  return scrollables.length === 0 || scrollables.every((el) => el.closest(".scroll-indicator"))
}

function describeOffenders(offenders: readonly Offender[]): string {
  return offenders
    .map((o) => `<${o.tag} class="${o.className}"> clips a descendant by ${o.overflowBy}px`)
    .join("\n  ")
}

// One run per browser engine is enough; the audit drives its own viewport
// widths, so re-running across the mobile/tablet device projects would only
// repeat identical measurements.
test.beforeEach(({}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("Desktop"),
    "overflow audit drives its own viewport widths",
  )
})

async function settle(page: Page, url: string, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await gotoPage(page, url)
  await page.evaluate(() => document.fonts.ready)
  // Wide tables/KaTeX get wrapped into scroll containers by a client-side `nav`
  // pass; measuring before it lands reports that content as overflow.
  await page.waitForFunction(scrollablesAreWrapped, undefined, { timeout: 5000 })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

for (const url of PAGES_TO_CHECK) {
  for (const width of SCROLL_WIDTHS) {
    test(`no horizontal page scroll on ${url} at ${width}px`, async ({ page }) => {
      await settle(page, url, width)
      const overflow = await page.evaluate(documentOverflow)
      expect(
        overflow,
        `Page scrolls horizontally by ${overflow}px at ${width}px.`,
      ).toBeLessThanOrEqual(TOLERANCE_PX)
    })
  }

  for (const width of CLIP_WIDTHS) {
    test(`no clipped overflow on ${url} at ${width}px`, async ({ page }) => {
      await settle(page, url, width)
      const clipped = await page.evaluate(collectClipped, [TOLERANCE_PX, SVG_NAMESPACE] as const)
      expect(
        clipped,
        `Content overflows clipping container(s) at ${width}px:\n  ${describeOffenders(clipped)}`,
      ).toEqual([])
    })
  }
}
