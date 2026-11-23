/**
 * Keeps the drop cap in copied text.
 *
 * The drop cap is the paragraph's real first letter, floated by `::first-letter`.
 * A line's start position therefore sits just after the floated letter, so a drag
 * that begins above the paragraph or in its left margin starts the selection one
 * letter in, and the copy drops that letter. On copy or cut, a selection that
 * starts at the end of the drop cap is widened to include it.
 */

export const DROPCAP_PARAGRAPH_SELECTOR = 'article[data-use-dropcap="true"] > p:first-of-type'

// `::first-letter` covers leading punctuation together with the first letter.
const DROPCAP_PATTERN = /^\P{L}*\p{L}/u

function firstTextNode(element: Element): Text | null {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if ((node as Text).data.trim()) return node as Text
  }
  return null
}

/** Widens a selection that starts just after the drop cap so it includes the drop cap. */
export function includeDropcapInSelection(selection: Selection | null): void {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
  const paragraph = document.querySelector(DROPCAP_PARAGRAPH_SELECTOR)
  if (!paragraph) return
  const textNode = firstTextNode(paragraph)
  const dropcap = textNode?.data.match(DROPCAP_PATTERN)
  if (!textNode || !dropcap) return

  // A space after a one-letter first word ("I use") collapses at the line
  // start, so the selection may also begin after that space.
  const range = selection.getRangeAt(0)
  const gap = textNode.data.slice(dropcap[0].length, range.startOffset)
  const startsAfterDropcap = range.startOffset >= dropcap[0].length && !gap.trim()
  if (range.startContainer !== textNode || !startsAfterDropcap) return

  const widened = range.cloneRange()
  widened.setStart(textNode, 0)
  selection.removeAllRanges()
  selection.addRange(widened)
}

function handleDropcapCopy(): void {
  includeDropcapInSelection(window.getSelection())
}

/** Registers capture-phase copy and cut listeners, so they run before other copy handlers. */
export function initDropcapCopy(): void {
  document.addEventListener("copy", handleDropcapCopy, true)
  document.addEventListener("cut", handleDropcapCopy, true)
}
