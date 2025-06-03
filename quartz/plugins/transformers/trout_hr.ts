import type { Element, Parent, Root, Text } from "hast"

import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

/**
 * The ornamental node with a trout image and decorative text.
 */
export const ornamentNode: Element = {
  type: "element",
  tagName: "div",
  properties: {
    id: "trout-ornament-container",
  },
  children: [
    {
      type: "element",
      tagName: "span",
      properties: {
        class: "no-select",
      },
      children: [{ type: "text", value: "☙" }],
    },
    {
      type: "element",
      tagName: "img",
      children: [],
      properties: {
        src: "https://assets.turntrout.com/static/trout-bw.svg",
        alt: "Black and white trout",
        class: "no-select",
      },
    },
    {
      type: "element",
      tagName: "span",
      properties: {
        class: "no-select",
      },
      children: [{ type: "text", value: "❧" }],
    },
  ],
}

/**
 * Attempts to insert an ornament node before a heading that starts with "Appendix" or before footnotes.
 *
 * @param {Element} node - The current node being processed.
 * @param {number | undefined} index - The index of the current node in its parent's children array.
 * @param {Parent | undefined} parent - The parent node of the current node.
 * @returns {boolean} True if the ornament was inserted, false otherwise.
 */
export function maybeInsertOrnament(
  node: Element,
  index: number | undefined,
  parent: Parent | undefined,
): boolean {
  if (!parent || index === undefined) return false

  // Check for "Appendix" headings
  if (node.tagName === "h1" || node.tagName === "h2") {
    const startsWithAppendix = (text: string) => text.toLowerCase().startsWith("appendix")

    // Check direct text children
    if (node.children[0]?.type === "text" && startsWithAppendix(node.children[0].value)) {
      parent.children.splice(index, 0, ornamentNode)
      return true
    }

    // Check link element
    if (node.children[0]?.type === "element" && node.children[0].tagName === "a") {
      const anchorText = node.children[0].children[0]
      if (anchorText?.type === "text" && startsWithAppendix(anchorText.value)) {
        parent.children.splice(index, 0, ornamentNode)
        return true
      }
    }
  }

  // Check if the current node is a footnotes section
  if (
    node.tagName === "section" &&
    node.properties?.["dataFootnotes"] !== undefined &&
    (node.properties?.className as Array<string>)?.includes("footnotes")
  ) {
    // <hr/> looks weird right before the trout hr, so remove it.
    // Check if there's a newline and then an HR preceding
    const prevElement = parent.children[index - 1] as Element | Text
    if (
      index > 1 &&
      prevElement.type === "text" &&
      prevElement.value === "\n" &&
      (parent.children[index - 2] as Element).tagName === "hr"
    ) {
      parent.children.splice(index - 2, 1)
      index--

      // Check if there's an HR right before the footnotes section
    } else if (index > 0 && (prevElement as Element).tagName === "hr") {
      // Remove the HR element
      parent.children.splice(index - 1, 1)
      index-- // Adjust index after removal
    }

    // If it is, insert the ornament node before the footnotes section
    parent.children.splice(index, 0, ornamentNode)
    return true // Indicate that the ornament was inserted
  }
  return false // Indicate that no ornament was inserted
}

/**
 * Inserts the ornament node into the tree.
 * @param {Root} tree - The AST to modify.
 */
export function insertOrnamentNode(tree: Root): void {
  let ornamentInserted = false

  visit(tree, "element", (node: Element, index: number | undefined, parent: Parent | undefined) => {
    if (!ornamentInserted) {
      ornamentInserted = maybeInsertOrnament(node, index, parent)
    }
  })

  if (!ornamentInserted) {
    // Check if the last child is an <hr> element
    const lastChild = tree.children[tree.children.length - 1] as Element
    if (lastChild && lastChild.type === "element" && lastChild.tagName === "hr") {
      // Remove the last <hr> element
      tree.children.pop()
    }
    // Add the ornament node
    tree.children.push(ornamentNode)
  }
}

/**
 * Quartz transformer plugin for adding a trout ornament HR.
 * @returns {QuartzTransformerPlugin} The plugin object.
 */
type TreeTransformer = (tree: Root) => void
type PluginReturn = {
  name: string
  htmlPlugins: () => TreeTransformer[]
}

export const TroutOrnamentHr: QuartzTransformerPlugin = (): PluginReturn => {
  return {
    name: "TroutOrnamentHr",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root) => {
            insertOrnamentNode(tree)
          }
        },
      ]
    },
  }
}
