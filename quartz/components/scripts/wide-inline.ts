// Inline math and inline code paths are inline-blocks capped at their line's
// width, so each moves to the next line whole when it fits there. A box wider
// than its line fills the whole line, pushing its trailing punctuation and the
// text after it onto the next line. Such a box is marked with
// `WIDE_INLINE_CLASS`, which displays it inline so it wraps like text. Whether a
// box fits depends on the live line width, so it is measured at runtime.
import { WIDE_INLINE_CLASS } from "../constants"

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

/** Marks the boxes in `container` that are wider than their line. */
export function markWideInlines(container: ParentNode): void {
  const boxes = Array.from(container.querySelectorAll(BOX_SELECTOR))
  // Measure every box as an inline-block. Reads follow all writes, so the
  // whole pass costs one layout.
  for (const box of boxes) {
    if (box.classList.contains(WIDE_INLINE_CLASS)) box.classList.remove(WIDE_INLINE_CLASS)
  }
  const wide = boxes.filter(wrapsInside)
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
