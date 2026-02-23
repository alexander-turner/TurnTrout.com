/**
 * Fixes clipboard content for small caps text.
 *
 * Small caps are rendered by lowercasing the text and applying CSS font-variant-caps.
 * When copied, this would result in lowercase text. This module intercepts copy/cut events
 * and restores text from .small-caps elements using data-original-text attributes (set by
 * the smallcaps transform) for accurate casing, falling back to uppercasing when unavailable.
 */

/**
 * Restores original text in a small-caps element using data-original-text if available,
 * otherwise falls back to uppercasing all text.
 */
function restoreOriginalText(el: Element): void {
  const originalText = el.getAttribute("data-original-text")
  if (originalText) {
    el.textContent = originalText
  } else {
    uppercaseAllText(el)
  }
}

/** Restores original text within small-caps elements in an HTML string */
export function restoreSmallCapsInHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const smallCapsElements = doc.querySelectorAll(".small-caps")
  for (const el of smallCapsElements) {
    restoreOriginalText(el)
  }

  return doc.body.innerHTML
}

function uppercaseAllText(element: Element): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let textNode = walker.nextNode() as Text | null
  while (textNode) {
    textNode.textContent = (textNode.textContent as string).toUpperCase()
    textNode = walker.nextNode() as Text | null
  }
}

export function restoreSmallCapsInSelection(selection: Selection): string {
  if (selection.rangeCount === 0) return ""

  const range = selection.getRangeAt(0)
  const fragment = range.cloneContents()

  const tempDiv = document.createElement("div")
  tempDiv.appendChild(fragment)

  const smallCapsElements = tempDiv.querySelectorAll(".small-caps")
  for (const el of smallCapsElements) {
    restoreOriginalText(el)
  }

  return tempDiv.textContent as string
}

/** Handles copy/cut events to fix small caps text */
export function handleSmallCapsCopy(event: ClipboardEvent): void {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return

  // Check if selection contains any small-caps elements
  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer
  const containerEl =
    container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement

  const containsSmallCaps = containerEl?.querySelector(".small-caps") !== null
  const smallCapsAncestor = containerEl?.closest(".small-caps")
  const isEntirelyInSmallCaps = smallCapsAncestor !== null

  // Quick check: if no small-caps in the selection area, do nothing
  if (!containsSmallCaps && !isEntirelyInSmallCaps) return

  // Get the HTML content and fix it
  const tempDiv = document.createElement("div")
  tempDiv.appendChild(range.cloneContents())

  // Handle case where selection is entirely within small-caps (no .small-caps in cloned content)
  if (isEntirelyInSmallCaps && smallCapsAncestor) {
    const originalText = smallCapsAncestor.getAttribute("data-original-text")
    if (originalText) {
      // Map partial selections through the original text using character positions.
      // Elements always have non-null textContent; indexOf always succeeds since
      // selectedText was cloned from within the element.
      const fullText = smallCapsAncestor.textContent!
      const selectedText = tempDiv.textContent!
      const startIdx = fullText.indexOf(selectedText)
      tempDiv.textContent = originalText.slice(startIdx, startIdx + selectedText.length)
    } else {
      uppercaseAllText(tempDiv)
    }
  } else if (tempDiv.querySelector(".small-caps") === null) {
    // Not in small-caps and no small-caps elements found - nothing to do
    return
  }

  event.preventDefault()

  // Elements always have non-null textContent (may be empty string)
  const fixedHtml = isEntirelyInSmallCaps
    ? tempDiv.innerHTML
    : restoreSmallCapsInHtml(tempDiv.innerHTML)
  const fixedText = isEntirelyInSmallCaps
    ? String(tempDiv.textContent)
    : restoreSmallCapsInSelection(selection)

  event.clipboardData?.setData("text/plain", fixedText)
  event.clipboardData?.setData("text/html", fixedHtml)
}

/** Initialize copy and cut event listeners */
export function initSmallCapsCopy(): void {
  document.addEventListener("copy", handleSmallCapsCopy)
  document.addEventListener("cut", handleSmallCapsCopy)
}
