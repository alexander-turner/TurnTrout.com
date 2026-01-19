import type { Element, Parent, Root, Text } from "hast"

import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

export const SUBTITLE_REGEX = /^Subtitle:\s*(.*)/

/**
 * Create a subtitle paragraph element with the given children.
 * @param children - The child nodes to include in the subtitle
 * @returns A paragraph element with the "subtitle" class
 */
export function createSubtitleWithChildren(children: Element["children"]): Element {
  return {
    type: "element",
    tagName: "p",
    properties: { className: ["subtitle"] },
    children,
  }
}

/**
 * Strip the "Subtitle: " prefix from a text node if present.
 * Modifies the text node in place.
 * @param firstChild - The text node to process
 * @returns True if the subtitle prefix was found and stripped, false otherwise
 */
function stripSubtitlePrefix(firstChild: Text): boolean {
  const match = SUBTITLE_REGEX.exec(firstChild.value)
  if (!match) {
    return false
  }

  firstChild.value = match[1].trimStart()
  return true
}

/**
 * Check if a paragraph element starts with subtitle syntax and process it.
 * @param paragraph - The paragraph element to check
 * @returns True if the paragraph contains subtitle syntax, false otherwise
 */
export function processParagraph(paragraph: Element): boolean {
  const firstChild = paragraph.children[0]
  return Boolean(firstChild?.type === "text" && stripSubtitlePrefix(firstChild))
}

/**
 * Transform paragraph elements with subtitle syntax into subtitle elements.
 * This function is called by the AST visitor for each element node.
 * @param node - The element to potentially transform
 * @param index - The index of the node in its parent's children array
 * @param parent - The parent node containing this element
 * @throws Error if the index doesn't match the node's position in parent
 */
export function modifyNode(
  node: Element,
  index: number | undefined,
  parent: Parent | null | undefined,
): void {
  if (index && parent?.children[index] !== node) {
    throw new Error("Index does not match node")
  }

  if (node.tagName !== "p" || !processParagraph(node)) {
    return
  }

  const newNode = createSubtitleWithChildren(node.children)
  if (parent && index !== undefined) {
    parent.children[index] = newNode
  }
}

/**
 * Quartz transformer plugin that converts "Subtitle: " prefixed paragraphs
 * into styled subtitle elements with the "subtitle" class.
 */
export const rehypeCustomSubtitle: QuartzTransformerPlugin = () => ({
  name: "customSubtitle",
  htmlPlugins() {
    return [
      () => (tree: Root) => {
        // istanbul ignore next
        visit(tree, "element", modifyNode)
      },
    ]
  },
})
