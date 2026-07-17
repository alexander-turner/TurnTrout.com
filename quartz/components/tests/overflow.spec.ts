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

// Number of consecutive timer polls the settled predicate must hold before we
// measure, giving layout a couple of passes to apply the client-side
// table/KaTeX wrapping.
const SETTLE_POLLS = 3

// How often `page.waitForFunction` re-evaluates the settle predicate. Polling
// must stay paint-independent: headless WebKit can leave a page unpainted, and
// a page that composites no frames never fires `requestAnimationFrame`. Timer
// polls run regardless of paint activity, so the predicate (and the font
// deadline inside it) always gets evaluated.
const SETTLE_POLL_INTERVAL_MS = 100

// Deadline for the font-readiness portion of the settle predicate. WebKit's
// `document.fonts.status` can stay pending indefinitely when a `@font-face`
// request never settles, so once the deadline elapses we proceed and measure
// against the painted font. Must sit several seconds under the 10s
// `waitForFunction` timeout so the required consecutive polls still fit after
// it elapses, even when the browser clamps background timers to ~1s.
const FONTS_READY_TIMEOUT_MS = 6_000

// Elements the client-side pass wraps into scroll containers, and the wrapper
// it puts them in. Passed into the serialized page functions below, which
// cannot reference module constants at runtime.
const SCROLLABLE_SELECTOR = ".table-container, .katex-display"
const SCROLL_WRAPPER_SELECTOR = ".scroll-indicator"

// Poll bookkeeping the settle predicate stores on `window` so consecutive
// evaluations can see each other's state.
interface OverflowSettleState {
  __overflowSettledPolls?: number
  __overflowFontStart?: number
}

// Polled inside `page.waitForFunction`, so the whole settle survives the SPA's
// initial `nav` — WebKit can destroy the execution context right after load, and
// `waitForFunction` just re-injects and re-polls in the fresh context (the poll
// counter resets, which is correct: a recreated context is a fresh page to
// settle). Font readiness is folded into this same polled predicate rather than
// awaited via `page.evaluate`, which has no such resilience and loses that race.
// The predicate is self-contained (serialized into the page, so it can reference
// only DOM globals): true once webfonts have settled and the client-side pass has
// wrapped wide tables/KaTeX into scroll containers — measuring before that lands
// reports them as overflow. The poll count is tracked on `window` so consecutive
// evaluations can require the predicate to hold stably rather than for a single
// lucky poll.
/* istanbul ignore next -- executed in the browser, not under Jest */
function settledForPolls([
  requiredPolls,
  fontDeadlineMs,
  scrollableSelector,
  wrapperSelector,
]: readonly [number, number, string, string]): boolean {
  const state = window as unknown as OverflowSettleState
  if (state.__overflowFontStart === undefined) {
    state.__overflowFontStart = performance.now()
  }
  const fontsReady =
    !document.fonts ||
    document.fonts.status === "loaded" ||
    performance.now() - state.__overflowFontStart >= fontDeadlineMs

  const scrollables = Array.from(document.querySelectorAll(scrollableSelector))
  const settled =
    fontsReady &&
    (scrollables.length === 0 || scrollables.every((el) => el.closest(wrapperSelector) !== null))

  if (!settled) {
    state.__overflowSettledPolls = 0
    return false
  }
  state.__overflowSettledPolls = (state.__overflowSettledPolls ?? 0) + 1
  return state.__overflowSettledPolls >= requiredPolls
}

// Snapshot of everything the settle predicate depends on, sampled when settle
// times out so the failure names the condition that never held instead of a
// bare TimeoutError. `settledPolls=never evaluated` means the polling transport
// itself is dead (the predicate ran zero times).
/* istanbul ignore next -- executed in the browser, not under Jest */
function describeSettleState([scrollableSelector, wrapperSelector]: readonly [
  string,
  string,
]): string {
  const state = window as unknown as OverflowSettleState
  const scrollables = Array.from(document.querySelectorAll(scrollableSelector))
  const unwrapped = scrollables.filter((el) => el.closest(wrapperSelector) === null).length
  const fonts = document.fonts ? document.fonts.status : "unsupported"
  const polls = state.__overflowSettledPolls?.toString() ?? "never evaluated"
  return `fonts=${fonts}, scrollables=${scrollables.length} (${unwrapped} unwrapped), settledPolls=${polls}`
}

function describeOffenders(offenders: readonly Offender[]): string {
  return offenders
    .map((o) => `<${o.tag} class="${o.className}"> clips a descendant by ${o.overflowBy}px`)
    .join("\n  ")
}

async function settle(page: Page, url: string) {
  await gotoPage(page, url)
  try {
    await page.waitForFunction(
      settledForPolls,
      [SETTLE_POLLS, FONTS_READY_TIMEOUT_MS, SCROLLABLE_SELECTOR, SCROLL_WRAPPER_SELECTOR] as const,
      {
        timeout: 10_000,
        polling: SETTLE_POLL_INTERVAL_MS,
      },
    )
  } catch (error) {
    // Sampling the page can itself fail when the execution context is gone;
    // the enriched error below still carries the original timeout as `cause`.
    const settleState = await page
      .evaluate(describeSettleState, [SCROLLABLE_SELECTOR, SCROLL_WRAPPER_SELECTOR] as const)
      .catch(() => "settle state unavailable (execution context gone)")
    throw new Error(`settle() did not stabilize on ${url}: ${settleState}`, { cause: error })
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
