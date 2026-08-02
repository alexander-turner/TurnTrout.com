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
// What counts as a column carrying ink rather than bare background. The window
// inboard of an edge has to clear this, or these tests would pass just as
// happily on an empty box. Measured deltas run 17–30.
const MIN_INK_DELTA = 8
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

// A mask clips its element's paint to the border box on every side, not only
// the two the gradient fades. The box's top edge sits nearer the first line
// than the halo reaches, so that clip shears the block into a hard horizontal
// seam — the same defect as at the inline edges, one axis over. (The bottom
// edge is safe: half-leading and descender space put it further from the last
// line than the halo carries.)
//
// The invariant: ink survives in the rows just above a concealed spoiler's box.
// A clipped edge leaves them pixel-identical to the background further out.

// How far above the box the halo is looked for. It is spent within the blur
// radius; a couple of pixels past that costs nothing and tolerates rounding.
const HALO_PROBE_DEPTH = 3
// Where the background is sampled, in pixels above the box. Past the halo, and
// near enough that a neighbouring element's own paint rarely intrudes.
const HALO_REFERENCE_OFFSET = 6
// Fraction of the box width trimmed from each side before sampling. The inline
// gradient fades those columns toward transparent, so they carry no halo.
const HALO_SAMPLE_INSET = 0.2
// Ink carried by the strongest columns above the box, on the same 0–255
// luminance scale. A sheared edge measures at most 1 — the residue of a
// neighbour's paint, never the spoiler's own; an intact halo measures 3 or
// more.
const MIN_HALO_INK = 2
// Which column to read once the columns above the box are ranked by ink. A
// halo tracks the glyphs that cast it, so it lives in the strongest columns
// rather than the average one; the top decile keeps that signal while ignoring
// the single hottest column's noise.
const HALO_INK_PERCENTILE = 0.9

interface EdgeDeltas {
  /** How far the spoiler's outermost pixel column sits from the page background. */
  readonly edge: number
  /** How far the strongest column inboard of the edge sits from that background. */
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
function lineBandNearest(
  spoiler: Locator,
  edge: "left" | "right",
): Promise<{ y: number; height: number; reach: number }> {
  return spoiler.evaluate((el, which) => {
    // Ranging over each paragraph's *contents* yields one rect per line box.
    // Ranging over the block instead would hand back the block's own border
    // box, which spans every line and reaches the margin whatever the text does.
    const range = document.createRange()
    const lines: DOMRect[] = []
    for (const paragraph of el.querySelectorAll(".spoiler-content p")) {
      range.selectNodeContents(paragraph)
      lines.push(...Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1))
    }
    if (lines.length === 0) throw new Error("Spoiler rendered no line boxes")
    const best = lines.reduce((a, b) =>
      which === "right" ? (b.right > a.right ? b : a) : b.left < a.left ? b : a,
    )
    return { y: best.top, height: best.height, reach: which === "right" ? best.right : best.left }
  }, edge)
}

/** X coordinate of one inline edge of a laid-out box. */
function inlineEdgeX(box: { x: number; width: number }, edge: "left" | "right"): number {
  return edge === "left" ? box.x : box.x + box.width
}

/**
 * Whether the spoiler's text actually runs to the given inline edge.
 *
 * Only then is there a halo at that edge for a clip to shear. Which spoilers
 * touch the right margin is not fixed: text is ragged-right, and engines size
 * `fit-content` differently around the `<br>`s a multi-line spoiler carries.
 * @param spoiler - The `.spoiler-container` to check.
 * @param edge - Which inline edge to test.
 */
async function reachesMargin(spoiler: Locator, edge: "left" | "right"): Promise<boolean> {
  const box = await requireBoundingBox(spoiler)
  const band = await lineBandNearest(spoiler, edge)
  return Math.abs(band.reach - inlineEdgeX(box, edge)) <= EDGE_REACH_TOLERANCE
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

  const edgeX = inlineEdgeX(box, edge)
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
 * Ink the blur halo leaves in the rows immediately above a concealed spoiler.
 *
 * Each row is differenced against one {@link HALO_REFERENCE_OFFSET} px higher,
 * column by column, and the columns are ranked; the result is the
 * {@link HALO_INK_PERCENTILE} column of the strongest row. Differencing against
 * a nearby row rather than an absolute level keeps whatever the page paints
 * behind the spoiler out of the measurement.
 * @param page - Page the spoiler lives in.
 * @param spoiler - The `.spoiler-container` to measure.
 */
async function measureTopHaloInk(page: Page, spoiler: Locator): Promise<number> {
  const box = await requireBoundingBox(spoiler.locator(".spoiler-content"))
  const bandHeight = HALO_REFERENCE_OFFSET + 2
  if (box.y < bandHeight) {
    throw new Error(
      `Spoiler sits ${box.y.toFixed(1)}px from the top of the viewport, too high to probe`,
    )
  }

  const inset = box.width * HALO_SAMPLE_INSET
  const buffer = await page.screenshot({
    clip: {
      x: box.x + inset,
      y: box.y - bandHeight,
      width: box.width - 2 * inset,
      height: bandHeight,
    },
  })
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const scale = info.height / bandHeight
  // Pixel row holding the point `depth` CSS px above the box.
  const rowAt = (depth: number): number =>
    Math.min(info.height - 1, Math.max(0, Math.round((bandHeight - depth - 0.5) * scale)))
  const luminance = (x: number, y: number): number => {
    const i = (y * info.width + x) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  const referenceRow = rowAt(HALO_REFERENCE_OFFSET)
  let ink = 0
  for (let depth = 1; depth <= HALO_PROBE_DEPTH; depth++) {
    const row = rowAt(depth)
    const deltas: number[] = []
    for (let x = 0; x < info.width; x++) {
      deltas.push(Math.abs(luminance(x, row) - luminance(x, referenceRow)))
    }
    deltas.sort((a, b) => a - b)
    ink = Math.max(ink, deltas[Math.floor(HALO_INK_PERCENTILE * (deltas.length - 1))])
  }
  return ink
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
      MIN_INK_DELTA,
    )
    expect(deltas.edge, `${edge} edge: blur is sheared off instead of dissolving`).toBeLessThan(
      MAX_EDGE_DELTA,
    )
  }
}

const LEFT_EDGE = ["left"] as const

/**
 * The inline edges of a spoiler that its text actually runs to.
 *
 * Every line starts at the left margin, so that edge is always live; reaching
 * the right one depends on where the text happens to wrap.
 * @param spoiler - The `.spoiler-container` to inspect.
 */
async function liveEdges(spoiler: Locator): Promise<readonly ("left" | "right")[]> {
  const edges: ("left" | "right")[] = ["left"]
  if (await reachesMargin(spoiler, "right")) edges.push("right")
  return edges
}

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "http://localhost:8080/test-page")
})

for (const theme of ["light", "dark"] as const) {
  test(`Article spoilers dissolve at their inline edges in ${theme} mode`, async ({ page }) => {
    await setTheme(page, theme)
    const spoilers = page.locator("article .spoiler-container")
    const count = await spoilers.count()

    const checked: string[] = []
    for (let index = 0; index < count; index++) {
      const spoiler = spoilers.nth(index)
      await spoiler.scrollIntoViewIfNeeded()
      const edges = await liveEdges(spoiler)
      await expectEdgesDissolve(page, spoiler, edges)
      checked.push(...edges)

      const halo = await measureTopHaloInk(page, spoiler)
      expect(halo, "blur is sheared off at the top of the spoiler").toBeGreaterThan(MIN_HALO_INK)
    }
    // The test page carries a one-line spoiler precisely so that some spoiler is
    // always as wide as its own text; without one, the right fade goes untested.
    expect(
      checked.filter((edge) => edge === "right"),
      "no article spoiler reached the right margin",
    ).not.toHaveLength(0)
  })
}

test("Revealing a spoiler restores ink at the margin", async ({ page }) => {
  const spoiler = page.locator("article .spoiler-container").first()
  await spoiler.scrollIntoViewIfNeeded()
  await spoiler.click()
  await expect(spoiler).toHaveClass(/revealed/)

  // Revealed text must be legible right up to the margin, so the fade that
  // conceals the blur's seam has to lift along with the blur itself.
  const { edge } = await measureEdge(page, spoiler, "left")
  expect(edge, "revealed text is still faded at the margin").toBeGreaterThan(MIN_INK_DELTA)
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
