import { Root, Element, Parent } from "hast"
import { visit } from "unist-util-visit"

import { QuartzTransformerPlugin } from "../types"

export const SUBTITLE_REGEX = /^Subtitle:\s*(.*)/

// skipcq: JS-D1001
export function createSubtitleWithChildren(children: Element["children"]): Element {
  return {
    type: "element",
    tagName: "p",
    properties: { className: ["subtitle"] },
    children,
  }
}

/**
 * Modifies a node in the AST if it's a paragraph that should be converted to a subtitle.
 * This function is called by the AST visitor for each element node.
 *
 * @param node - The element node to potentially modify
 * @param index - The index of the node within its parent's children array
 * @param parent - The parent node containing this element
 */
export function modifyNode(
  node: Element,
  index: number | undefined,
  parent: Parent | null | undefined,
): void {
  if (index && parent?.children[index] !== node) {
    throw new Error("Index does not match node")
  }

  if (node.tagName === "p" && processParagraph(node)) {
    const newNode = createSubtitleWithChildren(node.children)
    if (parent && index !== undefined) {
      parent.children[index] = newNode
    }
  }
}

/**
 * Processes a paragraph to convert it to a subtitle if applicable.
 * @param paragraph Paragraph element
 * @returns True if the paragraph is a subtitle, false otherwise
 */
export function processParagraph(paragraph: Element): boolean {
  if (paragraph.children.length > 0) {
    const firstChild = paragraph.children[0]
    if (firstChild.type === "text") {
      const match = SUBTITLE_REGEX.exec(firstChild.value)
      if (match) {
        firstChild.value = match[1].trimStart()
        return true
      }
    }
  }
  return false
}

// skipcq: JS-D1001
export function transformAST(tree: Root): void {
  visit(tree, "element", modifyNode)
}

/**
 * Quartz plugin for custom subtitle syntax.
 */
export const rehypeCustomSubtitle: QuartzTransformerPlugin = () => {
  return {
    name: "customSubtitle",
    htmlPlugins() {
      return [() => transformAST]
    },
  }
}
