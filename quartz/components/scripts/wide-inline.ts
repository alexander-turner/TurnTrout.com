// Inline math and inline code paths are inline-blocks capped at their line's
// width, so each moves to the next line whole when it fits there. A box wider
// than its line fills the whole line, pushing its trailing punctuation and the
// text after it onto the next line. A box that fits its line while the
// punctuation and favicon glued to it do not leaves them nowhere to go: they
// overflow the column or break away onto a row of their own. Either box is
// marked with `WIDE_INLINE_CLASS`, which displays it inline so it wraps like
// text. Whether a box fits depends on the live line width, so it is measured at
// runtime.
import { NOWRAP_SPAN_CLASS, WIDE_INLINE_CLASS } from "../constants"

const BOX_SELECTOR = ":not(.katex-display) > .katex > .katex-html, .inline-code-path"

/**
 * One rect per segment of the box's content in reading order: a math box's
 * `.base` spans, or the line fragments of a code box's text.
 */
function segmentRects(box: Element): readonly DOMRect[] {
  const bases = box.querySelectorAll(":scope > .base")
  if (bases.length > 0) return Array.from(bases, (base) => base.getBoundingClientRect())
  const range = document.createRange()
  range.selectNodeContents(box)
  return Array.from(range.getClientRects())
}

/** Whether the box wraps onto more than one row. */
function wrapsInside(box: Element): boolean {
  const rects = segmentRects(box)
  if (rects.length < 2) return false
  // Segments differ in height, so rows compare by vertical midpoint.
  const middleOf = (rect: DOMRect) => (rect.top + rect.bottom) / 2
  const halfFont = parseFloat(getComputedStyle(box).fontSize) / 2
  return Math.abs(middleOf(rects[rects.length - 1]) - middleOf(rects[0])) > halfFont
}

// Displays whose box sits on its parent's line rather than holding lines of its own.
const INLINE_DISPLAYS: ReadonlySet<string> = new Set(["contents", "inline"])
// Rects land on subpixel offsets, so an edge flush with the column may read a
// hair past it.
const EDGE_TOLERANCE_PX = 0.5

/** The right edge of the content of the block whose line holds `element`. */
function lineEnd(element: Element): number {
  let block = element
  while (block.parentElement && INLINE_DISPLAYS.has(getComputedStyle(block).display)) {
    block = block.parentElement
  }
  const style = getComputedStyle(block)
  return (
    block.getBoundingClientRect().right -
    parseFloat(style.paddingRight) -
    parseFloat(style.borderRightWidth)
  )
}

/** Whether the box and the text glued to it fail to fit on one row of the column. */
function overrunsWithGlue(box: Element): boolean {
  const glued = box.closest(`.${NOWRAP_SPAN_CLASS}`)
  if (!glued) return false
  // A row can open with an empty fragment of the glue's span before the box.
  const rows = Array.from(glued.getClientRects()).filter((row) => row.width > 0)
  return rows.length > 1 || rows.some((row) => row.right > lineEnd(glued) + EDGE_TOLERANCE_PX)
}

/** Marks the boxes in `container` that cannot sit whole on their line. */
export function markWideInlines(container: ParentNode): void {
  const boxes = Array.from(container.querySelectorAll(BOX_SELECTOR))
  // Measure every box as an inline-block. Reads follow all writes, so the
  // whole pass costs one layout.
  for (const box of boxes) box.classList.remove(WIDE_INLINE_CLASS)
  const wide = boxes.filter((box) => wrapsInside(box) || overrunsWithGlue(box))
  for (const box of wide) box.classList.add(WIDE_INLINE_CLASS)
}

/**
 * Marks the boxes in `container`, then re-marks them whenever the viewport's
 * width changes.
 *
 * @returns A function that stops the re-marking.
 */
export function markWideInlinesOnResize(container: ParentNode): () => void {
  let width = window.innerWidth
  const onResize = () => {
    if (window.innerWidth === width) return
    width = window.innerWidth
    markWideInlines(container)
  }
  markWideInlines(container)
  window.addEventListener("resize", onResize)
  return () => window.removeEventListener("resize", onResize)
}
