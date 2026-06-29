import type { Page } from "@playwright/test"

import { expect, test } from "./fixtures"
import { gotoPage } from "./visual_utils"

// Invariant: no page may overflow horizontally. Two failure modes hide from our
// other checks, so each gets its own probe:
//
//  1. Document-level horizontal scroll — a box wider than the viewport pushes a
//     horizontal scrollbar onto the whole page. Checked at every width,
//     including the 320px floor.
//  2. Content overflowing a *clipping* container (overflow-x: hidden/clip) —
//     this produces no scrollbar, so the content is silently cut off and both
//     the document-scroll probe and pixel-diff screenshots miss it. (This is
//     how the agent-input-sanitizer transclude clipped long inline code inside
//     its admonition.)
//
// Assertion-based, so unlike visual regression it is baseline-independent: it
// catches pre-existing overflow, not just regressions.

// High-overflow-risk pages: long inline code, transcluded external README
// content, wide tables, and the visual kitchen-sink test page.
const PAGES_TO_CHECK: readonly string[] = [
  "/",
  "/test-page",
  "/open-source",
  "/design",
  "/research",
  "/posts",
]

// 375px (iPhone-class) is the narrowest width the layout supports — the
// narrowest device in the Playwright matrix is the iPhone 12 at 390px. The
// strict clipped-content check runs from there up.
const CLIP_WIDTHS: readonly number[] = [375, 768, 1280]

// The page must never grow a horizontal scrollbar, even one notch below the
// supported floor.
const SCROLL_WIDTHS: readonly number[] = [320, ...CLIP_WIDTHS]

// Subpixel rounding can report a 1px phantom overflow; require a real one.
const TOLERANCE_PX = 2

interface Offender {
  readonly tag: string
  readonly className: string
  readonly scrollWidth: number
  readonly clientWidth: number
}

// Runs in the page. An element is a real offender only when it clips its own
// overflow; auto/scroll containers (<pre>, .katex, .table-container, tables)
// scroll on purpose, and visually-hidden a11y text (skip links, sr-only spans)
// is clipped offscreen via clip-path/clip and legitimately overflows its box.
/* istanbul ignore next -- executed in the browser, not under Jest */
function collectClipped(tolerance: number): Offender[] {
  const clipped: Offender[] = []
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    const style = getComputedStyle(el)
    if (style.display === "none" || style.visibility === "hidden") continue
    if (style.clipPath !== "none" || style.clip !== "auto") continue
    const clips = style.overflowX === "hidden" || style.overflowX === "clip"
    if (clips && el.scrollWidth - el.clientWidth > tolerance) {
      clipped.push({
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className : "",
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      })
    }
  }
  return clipped
}

/* istanbul ignore next -- executed in the browser, not under Jest */
function documentOverflow(): number {
  const root = document.documentElement
  return root.scrollWidth - root.clientWidth
}

function describeOffenders(offenders: readonly Offender[]): string {
  return offenders
    .map(
      (o) =>
        `<${o.tag} class="${o.className}"> ${o.scrollWidth}px content in ${o.clientWidth}px box`,
    )
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
  // Let webfonts swap, then wait two frames so the resulting reflow lands
  // before measuring.
  await page.evaluate(() => document.fonts.ready)
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
      const clipped = await page.evaluate(collectClipped, TOLERANCE_PX)
      expect(
        clipped,
        `Content overflows clipping container(s) at ${width}px:\n  ${describeOffenders(clipped)}`,
      ).toEqual([])
    })
  }
}
