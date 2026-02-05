import type { Root, Element, ElementContent, Parent } from "hast"

import { h } from "hastscript"
import { visit, SKIP } from "unist-util-visit"

import { QuartzTransformerPlugin } from "../types"

export interface FootnoteLocation {
  node: Element
  parent: Parent
  index: number
}

/**
 * Checks if an element is a footnote list item.
 * Footnote list items have IDs starting with "user-content-fn-".
 */
export function isFootnoteListItem(child: ElementContent): boolean {
  if (child.type !== "element") {
    return false
  }
  const id = child.properties?.id?.toString()
  return child.tagName === "li" && Boolean(id?.startsWith("user-content-fn-"))
}

// skipcq: JS-D1001
export function findFootnoteList(tree: Root): FootnoteLocation | null {
  let footnoteLocation: FootnoteLocation | null = null

  visit(tree, "element", (node, index, parent) => {
    if (
      node.tagName === "ol" &&
      node.children.some(isFootnoteListItem) &&
      parent !== undefined &&
      index !== undefined
    ) {
      footnoteLocation = { node, parent, index }
      return SKIP
    }
    return null
  })

  return footnoteLocation
}

// skipcq: JS-D1001
export function hasFootnoteHeading(sectionElement: Element): boolean {
  return sectionElement.children.some((child: ElementContent) => {
    if (child.type !== "element" || child.tagName !== "h2") {
      return false
    }
    const id = child.properties?.id
    return id?.toString() === "footnote-label" || id === "footnote-label"
  })
}

// skipcq: JS-D1001
export function createFootnoteHeading(): Element {
  return h("h2", { id: "footnote-label", className: ["sr-only"] }, ["Footnotes"])
}

/**
 * Adds the footnote heading to a section if it doesn't already have one.
 */
export function addHeadingToSection(sectionElement: Element): void {
  if (!hasFootnoteHeading(sectionElement)) {
    sectionElement.children.unshift(createFootnoteHeading() as ElementContent)
  }
}

/**
 * Checks if the parent is already a properly wrapped footnote section.
 */
export function isAlreadyWrapped(parent: Parent): parent is Element {
  if (parent.type !== "element") {
    return false
  }
  const element = parent as Element
  if (element.tagName !== "section") {
    return false
  }
  const dataFootnotes = element.properties?.dataFootnotes ?? element.properties?.["data-footnotes"]
  return dataFootnotes === true || dataFootnotes === ""
}

/**
 * Creates a properly wrapped footnote section with heading.
 */
export function createFootnoteSection(footnoteList: Element): Element {
  return h("section", { dataFootnotes: true, className: ["footnotes"] }, [
    createFootnoteHeading(),
    footnoteList,
  ])
}

/**
 * Removes "Footnotes" text from iframe children.
 */
export function cleanupIframeFootnoteText(tree: Root): void {
  visit(tree, "element", (node) => {
    if (node.tagName !== "iframe") {
      return
    }
    node.children = node.children.filter((child) => {
      if (child.type === "text") {
        const trimmed = child.value.trim()
        return trimmed !== "Footnotes" && trimmed !== ""
      }
      // istanbul ignore next
      return true
    })
  })
}

/**
 * Fixes malformed footnotes sections that can occur when raw HTML (like iframes)
 * appears at the end of a document. The issue manifests as:
 * 1. Missing <section data-footnotes> wrapper
 * 2. Missing <h2 id="footnote-label"> heading
 * 3. Footnotes text content appearing inside iframe tags
 *
 * This plugin:
 * 1. Finds footnote lists (ol elements with li children that have user-content-fn- ids)
 * 2. Ensures they're wrapped in a proper section with data-footnotes attribute
 * 3. Adds the footnote-label heading if missing
 * 4. Cleans up any text nodes that were placed incorrectly in iframes
 */
export const FixFootnotes: QuartzTransformerPlugin = () => {
  return {
    name: "FixFootnotes",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root) => {
            const location = findFootnoteList(tree)

            if (!location) {
              return
            }

            // Check if the list is already properly wrapped in a section with data-footnotes
            if (isAlreadyWrapped(location.parent)) {
              addHeadingToSection(location.parent)
              return
            }

            // Clean up any text nodes that contain "Footnotes" from preceding iframes
            cleanupIframeFootnoteText(tree)

            // Create the proper section wrapper and replace the ol
            const footnoteSection = createFootnoteSection(location.node)
            location.parent.children[location.index] = footnoteSection as ElementContent
          }
        },
      ]
    },
  }
}
