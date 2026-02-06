/**
 * Fixes clipboard content for small caps text.
 *
 * Small caps are rendered by lowercasing the text and applying CSS font-variant-caps.
 * When copied, this would result in lowercase text. This module intercepts copy/cut events
 * and uppercases text from .small-caps elements to match the visual appearance.
 */

/** Uppercases text content within small-caps elements in HTML string */
export function uppercaseSmallCapsInHtml(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const smallCapsElements = doc.querySelectorAll(".small-caps")
  for (const el of smallCapsElements) {
    // Uppercase all text nodes within the element
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let textNode: Text | null
    while ((textNode = walker.nextNode() as Text | null)) {
      // Text nodes always have non-null textContent
      textNode.textContent = textNode.textContent!.toUpperCase()
    }
  }

  return doc.body.innerHTML
}

/** Uppercases all text in an element */
function uppercaseAllText(element: Element): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let textNode: Text | null
  while ((textNode = walker.nextNode() as Text | null)) {
    textNode.textContent = textNode.textContent!.toUpperCase()
  }
}

/** Uppercases text from small-caps elements in plain text selection */
export function uppercaseSmallCapsInSelection(
  selection: Selection,
  isEntirelyInSmallCaps: boolean,
): string {
  if (selection.rangeCount === 0) return ""

  const range = selection.getRangeAt(0)
  const fragment = range.cloneContents()

  // Create a temporary container to work with the fragment
  const tempDiv = document.createElement("div")
  tempDiv.appendChild(fragment)

  if (isEntirelyInSmallCaps) {
    // Selection is entirely within small-caps, uppercase everything
    uppercaseAllText(tempDiv)
  } else {
    // Find all small-caps elements and uppercase their text
    const smallCapsElements = tempDiv.querySelectorAll(".small-caps")
    for (const el of smallCapsElements) {
      uppercaseAllText(el)
    }
  }

  // Elements always have non-null textContent (may be empty string)
  return tempDiv.textContent!
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
  const isEntirelyInSmallCaps = containerEl?.closest(".small-caps") !== null

  // Quick check: if no small-caps in the selection area, do nothing
  if (!containsSmallCaps && !isEntirelyInSmallCaps) return

  // Get the HTML content and fix it
  const tempDiv = document.createElement("div")
  tempDiv.appendChild(range.cloneContents())

  // Handle case where selection is entirely within small-caps (no .small-caps in cloned content)
  if (isEntirelyInSmallCaps) {
    uppercaseAllText(tempDiv)
  } else if (tempDiv.querySelector(".small-caps") === null) {
    // Not in small-caps and no small-caps elements found - nothing to do
    return
  }

  event.preventDefault()

  const fixedHtml = isEntirelyInSmallCaps
    ? tempDiv.innerHTML.toUpperCase()
    : uppercaseSmallCapsInHtml(tempDiv.innerHTML)
  const fixedText = uppercaseSmallCapsInSelection(selection, isEntirelyInSmallCaps)

  event.clipboardData?.setData("text/plain", fixedText)
  event.clipboardData?.setData("text/html", fixedHtml)
}

/** Initialize copy and cut event listeners */
export function initSmallCapsCopy(): void {
  document.addEventListener("copy", handleSmallCapsCopy)
  document.addEventListener("cut", handleSmallCapsCopy)
}
