import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"
import { Root, Element, Parent, Text } from "hast"

/**
 * The ornamental node with a trout image and decorative text.
 */
export const ornamentNode: Element = {
  type: "element",
  tagName: "div",
  properties: {
    style: "align-items:center;display:flex;justify-content:center;",
  },
  children: [
    {
      type: "element",
      tagName: "span",
      properties: {
        class: "text-ornament no-select",
        style: "vertical-align:2.6rem;margin-right:0.3rem;",
      },
      children: [{ type: "text", value: "☙" }],
    },
    {
      type: "element",
      tagName: "img",
      children: [],
      properties: {
        src: "https://assets.turntrout.com/static/trout-bw.svg",
        style: "height:var(--ornament-size);",
        alt: "Black and white trout",
        class: "no-select trout-ornament",
      },
    },
    {
      type: "element",
      tagName: "span",
      properties: {
        class: "text-ornament no-select",
        style: "vertical-align:2.6rem;margin-left:0.5rem;",
      },
      children: [{ type: "text", value: "❧" }],
    },
  ],
}

/**
 * Attempts to insert an ornament node before a footnotes section.
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
  // Check if the current node is a footnotes section
  if (
    parent &&
    index !== undefined &&
    node.tagName === "section" &&
    node.properties?.["dataFootnotes"] !== undefined &&
    (node.properties?.className as Array<String>)?.includes("footnotes")
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
 * @param {Root} tree - The AST tree to modify.
 */
export function insertOrnamentNode(tree: Root): void {
  let footnotesFound = false

  visit(tree, "element", (node: Element, index: number | undefined, parent: Parent | undefined) => {
    if (!footnotesFound) {
      footnotesFound = maybeInsertOrnament(node, index, parent)
    }
  })

  if (!footnotesFound) {
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
