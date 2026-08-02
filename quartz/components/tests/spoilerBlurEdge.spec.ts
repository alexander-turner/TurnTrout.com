import type { Locator, Page } from "@playwright/test"

import sharp from "sharp"

import { expect, test } from "./fixtures"
import { gotoPage, isDesktopViewport, requireBoundingBox, search, setTheme } from "./visual_utils"

// A concealed spoiler is blurred text, and a Gaussian blur's halo spreads past
// the glyphs that cast it. Every container a spoiler renders in — the article
// column, a link popover, the search preview — clips along its inline axis, and
// a spoiler runs edge to edge inside all three, so that halo has nowhere to
// spill: the clip shears it into a hard vertical wall of half-blurred text.
//
// The invariant: at either inline edge of a concealed spoiler, the page's own
// background is all that is left, so the block dissolves into the page instead
// of ending on a seam. Only pixels can show this — the geometry is identical
// whether the halo fades out or is sheared off.

// Luminance runs 0–255, so these are absolute levels rather than fractions.
// A sheared edge measures 8–12 at the seam; a dissolved one stays under 1.5
// across every viewport, theme, and container, so the gap is wide enough that
// the threshold is never a judgement call.
const MAX_EDGE_DELTA = 3
// The window inboard of the edge has to actually hold blurred text, or these
// tests would pass just as happily on an empty box. Measured deltas run 14–22.
const MIN_INTERIOR_DELTA = 8
// Where the page background is sampled, measured outboard from the spoiler's
// edge. Far enough out to clear the fade, near enough to stay inside the
// narrowest gutter the site has (18px, on a phone).
const BACKGROUND_OFFSET = 14
// How far inboard of the edge the blurred text is looked for. Wide enough to
// clear the fade (3× the 4px blur radius; see $spoiler-edge-fade) and then to
// reach ink even when the sampled line stops a word short of the margin.
const INTERIOR_OFFSET = 48
// How near the edge the longest line must come for a probe of that edge to be
// measuring anything. Subpixel line-box rounding is the only slack allowed.
const EDGE_REACH_TOLERANCE = 2

interface EdgeDeltas {
  /** How far the spoiler's outermost pixel column sits from the page background. */
  readonly edge: number
  /** How far a column well inside the spoiler sits from the page background. */
  readonly interior: number
}

/**
 * Mean luminance of one vertical pixel column of a decoded screenshot.
 * @param raw - RGBA pixels of the captured band.
 * @param width - Band width, in device pixels.
 * @param height - Band height, in device pixels.
 * @param x - Column to sample, in device pixels.
 */
function columnLuminance(raw: Buffer, width: number, height: number, x: number): number {
  let sum = 0
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * 4
    sum += 0.299 * raw[i] + 0.587 * raw[i + 1] + 0.114 * raw[i + 2]
  }
  return sum / height
}

/**
 * Vertical extent of the spoiler line that reaches furthest toward one edge.
 *
 * Sampling a single line — rather than the whole block — keeps every averaged
 * row on text. Which line matters depends on the edge: every line starts at the
 * left margin, but text is ragged-right, so only the longest one approaches the
 * right margin.
 * @param spoiler - The `.spoiler-container` to measure.
 * @param edge - Which inline edge the band should favour.
 */
async function lineBandNearest(
  spoiler: Locator,
  edge: "left" | "right",
): Promise<{ y: number; height: number; reach: number }> {
  return spoiler.evaluate((el, which) => {
    const paragraph = el.querySelector(".spoiler-content p")
    if (!paragraph) throw new Error("Spoiler has no paragraph to measure")
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const lines = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1)
    if (lines.length === 0) throw new Error("Spoiler paragraph rendered no line boxes")
    const best = lines.reduce((a, b) =>
      which === "right" ? (b.right > a.right ? b : a) : b.left < a.left ? b : a,
    )
    return { y: best.top, height: best.height, reach: which === "right" ? best.right : best.left }
  }, edge)
}

/**
 * Measure how a spoiler meets the page at one of its inline edges.
 *
 * Captures a band straddling the edge and compares the spoiler's outermost
 * column — and the strongest column within {@link INTERIOR_OFFSET} inboard of
 * it — against the background {@link BACKGROUND_OFFSET} outboard. Columns are
 * averaged down the line's height: a seam runs that whole height, so it
 * registers, while per-glyph blur variation largely cancels.
 * @param page - Page the spoiler lives in.
 * @param spoiler - The `.spoiler-container` to measure.
 * @param edge - Which inline edge to probe.
 */
async function measureEdge(
  page: Page,
  spoiler: Locator,
  edge: "left" | "right",
): Promise<EdgeDeltas> {
  const box = await requireBoundingBox(spoiler)
  const band = await lineBandNearest(spoiler, edge)
  const viewport = page.viewportSize()
  if (!viewport) throw new Error("Expected an emulated viewport")

  const edgeX = edge === "left" ? box.x : box.x + box.width
  const outward = edge === "left" ? -1 : 1
  // A probe only means something if text actually reaches the edge it targets;
  // otherwise there is no halo there for a clip to shear, and the measurement
  // would pass on a blank margin. Fail rather than quietly measure nothing.
  if (Math.abs(band.reach - edgeX) > EDGE_REACH_TOLERANCE) {
    throw new Error(
      `Spoiler text stops ${Math.abs(band.reach - edgeX).toFixed(1)}px short of its ${edge} edge`,
    )
  }
  const bandStart = edgeX + outward * BACKGROUND_OFFSET
  const bandEnd = edgeX - outward * INTERIOR_OFFSET
  const [clipLeft, clipRight] = bandStart < bandEnd ? [bandStart, bandEnd] : [bandEnd, bandStart]
  if (clipLeft < 0 || clipRight > viewport.width) {
    throw new Error(
      `Probe band [${clipLeft}, ${clipRight}] for the ${edge} edge falls outside the ${viewport.width}px viewport`,
    )
  }

  const buffer = await page.screenshot({
    clip: { x: clipLeft, y: band.y, width: clipRight - clipLeft, height: band.height },
  })
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // The clip was in CSS pixels; the capture is in device pixels. Sample points
  // sit half a pixel inside the band, so clamping only ever absorbs rounding.
  const scale = info.width / (clipRight - clipLeft)
  const at = (cssX: number): number => {
    const column = Math.round((cssX - clipLeft) * scale)
    return columnLuminance(
      data,
      info.width,
      info.height,
      Math.min(info.width - 1, Math.max(0, column)),
    )
  }
  // Half a pixel inboard of a boundary lands on that column itself rather than
  // straddling it.
  const background = at(bandStart - outward * 0.5)

  let interior = 0
  for (let step = 1; step <= INTERIOR_OFFSET; step++) {
    interior = Math.max(interior, Math.abs(at(edgeX - outward * step) - background))
  }
  return { edge: Math.abs(at(edgeX - outward * 0.5) - background), interior }
}

/**
 * Assert that a concealed spoiler dissolves into the page at the given edges.
 * @param page - Page the spoiler lives in.
 * @param spoiler - The `.spoiler-container` to check.
 * @param edges - Inline edges whose text reaches the margin.
 */
async function expectEdgesDissolve(
  page: Page,
  spoiler: Locator,
  edges: readonly ("left" | "right")[],
): Promise<void> {
  await expect(spoiler).toBeVisible()
  await expect(spoiler).not.toHaveClass(/revealed/)

  for (const edge of edges) {
    const deltas = await measureEdge(page, spoiler, edge)
    expect(deltas.interior, `${edge} edge: no blurred text inboard of the edge`).toBeGreaterThan(
      MIN_INTERIOR_DELTA,
    )
    expect(deltas.edge, `${edge} edge: blur is sheared off instead of dissolving`).toBeLessThan(
      MAX_EDGE_DELTA,
    )
  }
}

// A spoiler sized by its own longest line ends exactly where that line ends, so
// both margins carry ink. One long enough to wrap is stretched to the column
// instead, and ragged-right wrapping leaves its right margin bare — the left is
// all there is to check.
const BOTH_EDGES = ["left", "right"] as const
const LEFT_EDGE = ["left"] as const

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page")
})

for (const theme of ["light", "dark"] as const) {
  test(`Article spoilers dissolve at both inline edges in ${theme} mode`, async ({ page }) => {
    await setTheme(page, theme)
    const spoilers = page.locator("article .spoiler-container")
    // The test page carries a short spoiler and one long enough to wrap and
    // fill the column; the wrapping one is what puts text against both edges.
    await expect(spoilers).toHaveCount(2)

    for (const [index, edges] of [
      [0, BOTH_EDGES],
      [1, LEFT_EDGE],
    ] as const) {
      const spoiler = spoilers.nth(index)
      await spoiler.scrollIntoViewIfNeeded()
      await expectEdgesDissolve(page, spoiler, edges)
    }
  })
}

test("Revealing a spoiler restores ink at its inline edges", async ({ page }) => {
  const spoiler = page.locator("article .spoiler-container").first()
  await spoiler.scrollIntoViewIfNeeded()
  await spoiler.click()
  await expect(spoiler).toHaveClass(/revealed/)

  // Revealed text must be legible right up to the margin, so the fade that
  // conceals the blur's seam has to lift along with the blur itself.
  const { edge } = await measureEdge(page, spoiler, "left")
  expect(edge, "revealed text is still faded at the margin").toBeGreaterThan(MIN_INTERIOR_DELTA)
})

test("Search-preview spoilers dissolve at the column edge", async ({ page }) => {
  test.skip(
    !isDesktopViewport(page),
    "The search preview pane is hidden below the tablet breakpoint",
  )

  await search(page, "hidden until you click")

  const spoiler = page.locator("#preview-container .spoiler-container").first()
  await spoiler.scrollIntoViewIfNeeded()
  await expectEdgesDissolve(page, spoiler, LEFT_EDGE)
})

test("Popover spoilers dissolve at the column edge", async ({ page }) => {
  test.skip(!isDesktopViewport(page), "Popovers are desktop-only")

  // The nav handler suppresses hover until the pointer has moved once.
  await page.mouse.move(1, 1)
  const link = page.locator("a#first-link-test-page")
  await link.evaluate((el) => el.setAttribute("href", "./test-page#spoilers"))
  await link.scrollIntoViewIfNeeded()
  await link.hover()

  const popover = page.locator(".popover")
  await expect(popover).toHaveClass(/popover-visible/, { timeout: 10_000 })

  const spoiler = popover.locator(".spoiler-container").first()
  await spoiler.scrollIntoViewIfNeeded()
  await expectEdgesDissolve(page, spoiler, LEFT_EDGE)
})
