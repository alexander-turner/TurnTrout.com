import type { Element, Root, Text, ElementContent } from "hast"
import type { Parent } from "unist"

import { fromHtml } from "hast-util-from-html"
import { h } from "hastscript"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

/**
 * Type guard to check if a node is a Text node
 */
export function isTextNode(node: ElementContent): node is Text {
  return node.type === "text"
}

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
 * Creates a figcaption element from the caption text
 */
export function createFigcaption(captionText: string): Element[] {
  const captionHtml = fromHtml(`<figcaption>${captionText}</figcaption>`, {
    fragment: true,
  })
  return captionHtml.children as Element[]
}

/**
 * Type guard to check if an element is an Element node
 */
export function isElementNode(element: ElementContent): element is Element {
  return element.type === "element"
}

// skipcq: JS-D1001
export function isTableElement(element: ElementContent): boolean {
  return isElementNode(element) && element.tagName === "table"
}

// skipcq: JS-D1001
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
  const captionElements = createFigcaption(captionText)

  // Replace the paragraph with the figcaption elements
  parent.children.splice(parentChildrenIndex, 1, ...captionElements)

  // Find the preceding table and wrap it with a figure
  if (parentChildrenIndex > 0) {
    const prevElement = parent.children[parentChildrenIndex - 1]
    if (isTableElement(prevElement) && isElementNode(prevElement)) {
      const figure = createTableFigure(prevElement, captionElements)
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
export const TableCaption: QuartzTransformerPlugin = () => {
  return {
    name: "TableCaption",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root) => {
            visit(tree, "element", processNode)
          }
        },
      ]
    },
  }
}
