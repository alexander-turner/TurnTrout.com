import type { Element as HastElement } from "hast"
import type { VFile } from "vfile"

import { improveFormatting } from "../plugins/transformers/formatting_improvement_html"
import { clone, type FullSlug, isRelativeURL, joinSegments, resolveRelative } from "./path"

/**
 * Rebases a HAST element's attribute to a new base slug
 *
 * @param el - HAST element to rebase
 * @param attr - Attribute to rebase
 * @param curBase - Current base slug where element originates
 * @param newBase - New base slug where element will be transcluded
 */
const _rebaseHastElement = (
  el: HastElement,
  attr: string,
  curBase: FullSlug,
  newBase: FullSlug,
): void => {
  if (el.properties?.[attr]) {
    const attrValue = String(el.properties[attr])

    // Handle anchor-only links (e.g., #section)
    if (attrValue.startsWith("#")) {
      const relativeToOriginal = resolveRelative(curBase, newBase)
      el.properties[attr] = relativeToOriginal + attrValue
      return
    }

    if (!isRelativeURL(attrValue)) {
      return
    }

    const rel = joinSegments(resolveRelative(curBase, newBase), "..", attrValue)
    el.properties[attr] = rel
  }
}

/**
 * Normalizes a HAST element for transclusion by:
 * 1. Cloning the element to avoid modifying original content
 * 2. Applying formatting improvements through the HTML transformer
 * 3. Rebasing relative links to work in the new context
 *
 * @param rawEl - Original HAST element to normalize
 * @param curBase - Current base slug where element originates
 * @param newBase - New base slug where element will be transcluded
 * @returns Normalized HAST element with proper formatting and rebased links
 */
export function normalizeHastElement(rawEl: HastElement, curBase: FullSlug, newBase: FullSlug) {
  const el = clone(rawEl) // clone so we dont modify the original page

  // Apply formatting improvements to the cloned element
  const transformer = improveFormatting()
  transformer(
    {
      type: "root",
      children: [el],
    },
    { data: {} } as VFile,
    () => {
      // empty because improveFormatting doesn't need a function passed
    },
  )

  // Continue with existing link rebasing
  _rebaseHastElement(el, "src", curBase, newBase)
  _rebaseHastElement(el, "href", curBase, newBase)
  if (el.children) {
    el.children = el.children.map((child) =>
      normalizeHastElement(child as HastElement, curBase, newBase),
    )
  }

  return el
}
