import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Invariant: no page may overflow horizontally. Two failure modes hide from our
// other checks, so each gets its own probe:
//
//  1. Document-level horizontal scroll — a box wider than the viewport pushes a
//     horizontal scrollbar onto the whole page.
//  2. Content clipped by an `overflow: hidden`/`clip` container — no scrollbar
//     appears, so the content is silently cut off and both the document-scroll
//     probe and pixel-diff screenshots miss it. (This is how the
//     agent-input-sanitizer transclude clipped long inline code in its
//     admonition.)
//
// Assertion-based, so unlike visual regression it is baseline-independent: it
// catches pre-existing overflow, not just regressions. Each test runs once per
// browser/device project at that project's viewport — the same device list the
// rest of the suite uses (config/playwright/playwright.config.ts: iPhone 12 =
// 390, iPad Pro 11 = 834, Desktop = 1920), so the audit asserts at exactly the
// widths we support, with no hardcoded sizes of its own.

// High-overflow-risk pages: long inline code, transcluded external README
// content, wide tables, and the visual kitchen-sink test page.
const PAGES_TO_CHECK: readonly string[] = ["/", "/test-page", "/design", "/research", "/posts"]

// The clipped-content probe runs at tablet/desktop viewports only. The mobile
// viewport still has known pre-existing clips (long inline code / unbreakable
// tokens inside list items and definition terms), tracked separately, so
// asserting clip-freedom there would assert something not yet true.
const CLIP_MIN_WIDTH = 700

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
    while (stack.length > 0 && clipped === null) {
      const descendant = stack.pop()
      if (!descendant) break
      if (descendant.namespaceURI === svgNamespace || isScrollable(descendant)) continue
      const descendantRect = descendant.getBoundingClientRect()
      if (descendantRect.width > 0 && descendantRect.right > contentRight + tolerance) {
        clipped = descendant
      } else {
        stack.push(...Array.from(descendant.children))
      }
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

// Polled inside `page.waitForFunction`, so it survives the SPA's initial `nav`
// (a bare `page.evaluate` here can hit a destroyed execution context). True once
// webfonts have swapped and the client-side pass has wrapped wide tables/KaTeX
// into scroll containers — measuring before that lands reports them as overflow.
/* istanbul ignore next -- executed in the browser, not under Jest */
function pageSettled(): boolean {
  if (document.fonts && document.fonts.status !== "loaded") return false
  const scrollables = Array.from(document.querySelectorAll(".table-container, .katex-display"))
  return (
    scrollables.length === 0 || scrollables.every((el) => el.closest(".scroll-indicator") !== null)
  )
}

function describeOffenders(offenders: readonly Offender[]): string {
  return offenders
    .map((o) => `<${o.tag} class="${o.className}"> clips a descendant by ${o.overflowBy}px`)
    .join("\n  ")
}

async function waitSettled(page: Page): Promise<void> {
  await page.waitForFunction(pageSettled, undefined, { timeout: 10_000 })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

async function settle(page: Page, url: string) {
  await gotoPage(page, url)
  try {
    await waitSettled(page)
  } catch (error: unknown) {
    // WebKit/Safari can destroy the execution context briefly after load,
    // failing an in-flight waitForFunction/evaluate with no real navigation
    // underway. Retry once against the already-loaded page.
    if (error instanceof Error && error.message.includes("Execution context was destroyed")) {
      await waitSettled(page)
    } else {
      throw error
    }
  }
}

for (const url of PAGES_TO_CHECK) {
  test(`no horizontal page scroll on ${url}`, async ({ page }) => {
    await settle(page, url)
    const width = page.viewportSize()?.width
    const overflow = await page.evaluate(documentOverflow)
    expect(
      overflow,
      `Page scrolls horizontally by ${overflow}px at ${width}px.`,
    ).toBeLessThanOrEqual(TOLERANCE_PX)
  })

  test(`no clipped overflow on ${url}`, async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0
    test.skip(
      width < CLIP_MIN_WIDTH,
      "mobile viewport has known pre-existing clips, tracked separately",
    )
    await settle(page, url)
    const clipped = await page.evaluate(collectClipped, [TOLERANCE_PX, SVG_NAMESPACE] as const)
    expect(
      clipped,
      `Content overflows clipping container(s) at ${width}px:\n  ${describeOffenders(clipped)}`,
    ).toEqual([])
  })
}
