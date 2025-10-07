import type { Element, Parent, Root, Text } from "hast"

import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

export const troutContainerId = "trout-ornament-container"

import { h } from "hastscript"

export const ornamentNode: Element = h("div", { id: troutContainerId }, [
  h("span", { class: "no-select", "aria-hidden": "true" }, "☙"),
  h("img", {
    src: "https://assets.turntrout.com/static/trout-bw.svg",
    alt: "",
    class: "no-select",
    "aria-hidden": "true",
  }),
  h("span", { class: "no-select", "aria-hidden": "true" }, "❧"),
])

/**
 * Attempts to insert an ornament node before a heading that starts with "Appendix" or before footnotes.
 *
 * @param node - The current node being processed.
 * @param index - The index of the current node in its parent's children array.
 * @param parent - The parent node of the current node.
 * @returns True if the ornament was inserted, false otherwise.
 */
export function maybeInsertOrnament(
  node: Element,
  index: number | undefined,
  parent: Parent | undefined,
): boolean {
  if (!parent || index === undefined) return false

  // Check for "Appendix" headings
  if (node.tagName === "h1" || node.tagName === "h2") {
    // skipcq: JS-D1001
    const startsWithAppendix = (text: string) => text.toLowerCase().startsWith("appendix")

    // Check direct text children
    if (node.children[0]?.type === "text" && startsWithAppendix(node.children[0].value)) {
      parent.children.splice(index, 0, ornamentNode)
      return true
    }

    // Check link element
    const firstChild = node.children[0]
    const firstChildIsLink = firstChild?.type === "element" && firstChild.tagName === "a"
    if (firstChildIsLink) {
      const anchorText = firstChild.children[0]
      const anchorStartsWithAppendix =
        anchorText?.type === "text" && startsWithAppendix(anchorText.value)
      if (anchorStartsWithAppendix) {
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
 */
type TreeTransformer = (tree: Root) => void
type PluginReturn = {
  name: string
  htmlPlugins: () => TreeTransformer[]
}

// skipcq: JS-D1001
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
