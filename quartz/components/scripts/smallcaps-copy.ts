/**
 * Fixes clipboard content for small caps text.
 *
 * Small caps are rendered by lowercasing the text and applying CSS font-variant-caps.
 * When copied, this would result in lowercase text. This module intercepts copy events
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

/** Uppercases text from small-caps elements in plain text selection */
export function uppercaseSmallCapsInSelection(selection: Selection): string {
  if (selection.rangeCount === 0) return ""

  const range = selection.getRangeAt(0)
  const fragment = range.cloneContents()

  // Create a temporary container to work with the fragment
  const tempDiv = document.createElement("div")
  tempDiv.appendChild(fragment)

  // Find all small-caps elements and uppercase their text
  const smallCapsElements = tempDiv.querySelectorAll(".small-caps")
  for (const el of smallCapsElements) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let textNode: Text | null
    while ((textNode = walker.nextNode() as Text | null)) {
      // Text nodes always have non-null textContent
      textNode.textContent = textNode.textContent!.toUpperCase()
    }
  }

  // Elements always have non-null textContent (may be empty string)
  return tempDiv.textContent!
}

/** Handles copy events to fix small caps text */
export function handleSmallCapsCopy(event: ClipboardEvent): void {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return

  // Check if selection contains any small-caps elements
  const range = selection.getRangeAt(0)
  const container = range.commonAncestorContainer
  const containerEl =
    container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement

  // Quick check: if no small-caps in the selection area, do nothing
  const hasSmallCaps =
    containerEl?.querySelector(".small-caps") !== null ||
    containerEl?.closest(".small-caps") !== null

  if (!hasSmallCaps) return

  // Get the HTML content and fix it
  const tempDiv = document.createElement("div")
  tempDiv.appendChild(range.cloneContents())

  // Check if the cloned content actually has small-caps
  if (tempDiv.querySelector(".small-caps") === null) return

  event.preventDefault()

  const fixedHtml = uppercaseSmallCapsInHtml(tempDiv.innerHTML)
  const fixedText = uppercaseSmallCapsInSelection(selection)

  event.clipboardData?.setData("text/plain", fixedText)
  event.clipboardData?.setData("text/html", fixedHtml)
}

/** Initialize copy event listener */
export function initSmallCapsCopy(): void {
  document.addEventListener("copy", handleSmallCapsCopy)
}
