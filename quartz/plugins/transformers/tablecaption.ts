import type { Element, ElementContent } from "hast"
import type { Parent } from "unist"

import { h } from "hastscript"

import { createElementVisitorPlugin, isElementNode, isTextNode } from "./utils"

// Re-export type guards for use by tests and other modules
export { isElementNode, isTextNode }

/**
 * Checks if a text node starts with the table caption prefix "^Table: "
 */
export function isTableCaptionText(node: ElementContent): boolean {
  return isTextNode(node) && node.value.startsWith("^Table: ")
}

/**
 * Extracts the caption text by removing the "^Table: " prefix
 */
export function extractCaptionText(value: string): string {
  const stringToRemove = "^Table: "
  return value.slice(stringToRemove.length)
}

/**
 * Creates a figcaption element from the caption text.
 *
 * The caption arrives as already-decoded text, so it becomes a text node
 * verbatim: angle brackets and ampersands stay literal characters.
 */
export function createFigcaption(captionText: string): Element[] {
  const children: ElementContent[] = captionText ? [{ type: "text", value: captionText }] : []
  return [h("figcaption", children)]
}

/** True if `element` is a `<table>` element. */
export function isTableElement(element: ElementContent): boolean {
  return isElementNode(element) && element.tagName === "table"
}

/** Wraps a `<table>` and its caption nodes in a single `<figure>`. */
export function createTableFigure(tableElement: Element, captionElements: Element[]): Element {
  return h("figure", [tableElement, ...captionElements])
}

/**
 * Processes a paragraph node that contains a table caption marker.
 * Converts the paragraph to a figcaption and wraps the preceding table
 * in a figure element with the caption.
 */
function processTableCaptionNode(
  node: Element,
  parentChildrenIndex: number | undefined,
  parent: Element,
): void {
  // istanbul ignore if
  if (!parent || parentChildrenIndex === undefined) {
    return
  }

  const firstChild = node.children[0]
  if (!isTableCaptionText(firstChild) || !isTextNode(firstChild)) {
    return
  }

  const captionText = extractCaptionText(firstChild.value)
  const [figcaption] = createFigcaption(captionText)

  // Inline markup in the caption (e.g. `*emphasis*`, links) is already parsed
  // into sibling nodes at this rehype stage; createFigcaption only rebuilds the
  // leading text node, so carry the remaining siblings into the figcaption.
  figcaption.children.push(...node.children.slice(1))

  // Replace the paragraph with the figcaption
  parent.children.splice(parentChildrenIndex, 1, figcaption)

  // Find the preceding table and wrap it with a figure
  if (parentChildrenIndex > 0) {
    const prevElement = parent.children[parentChildrenIndex - 1]
    if (isTableElement(prevElement) && isElementNode(prevElement)) {
      const figure = createTableFigure(prevElement, [figcaption])
      parent.children.splice(parentChildrenIndex - 1, 2, figure)
    }
  }
}

/**
 * Main processing function for visiting nodes in the AST
 */
function processNode(node: Element, index: number | undefined, parent: Parent | undefined): void {
  // istanbul ignore if
  if (!parent || !("children" in parent)) {
    return
  }

  // Only process paragraph elements with children
  if (node.tagName === "p" && node.children.length > 0) {
    processTableCaptionNode(node, index, parent as Element)
  }
}

/**
 * TableCaption transformer plugin for Quartz.
 *
 * This plugin converts special paragraph markers into proper HTML table captions.
 * It looks for paragraphs that start with "^Table: " and converts them into
 * figcaption elements, wrapping the preceding table in a figure element.
 *
 * Example transformation:
 * ```html
 * <table>...</table>
 * <p>^Table: My table caption</p>
 * ```
 * becomes:
 * ```html
 * <figure>
 *   <table>...</table>
 *   <figcaption>My table caption</figcaption>
 * </figure>
 * ```
 */
export const TableCaption = createElementVisitorPlugin("TableCaption", processNode)
