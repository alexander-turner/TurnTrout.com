import type { Element, Parent, Root, Text } from "hast"

// skipcq: JS-0257
import { h } from "hastscript"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

const SPOILER_REGEX = /^!\s*(?<spoilerText>.*)/

/**
 * Generate inline JavaScript code to toggle a CSS class on click.
 * @param className - The CSS class name to toggle
 * @returns JavaScript code as a string for the onclick handler
 */
function toggleSpoilerJs(className: string): string {
  return `if(this.classList.contains('${className}')) { this.classList.remove('${className}'); var e=this; e.style.pointerEvents='none'; setTimeout(function(){e.style.pointerEvents=''},10) } else { this.classList.add('${className}') }`
}

/**
 * Extract spoiler text from a string.
 */
export function matchSpoilerText(text: string): string | null {
  const match = SPOILER_REGEX.exec(text)
  return match?.groups ? match.groups.spoilerText : null
}

/**
 * Create a spoiler container element with overlay and content.
 * @param content - The content to hide behind the spoiler (string or array of elements)
 * @returns A div element with spoiler-container class and click handler
 */
export function createSpoilerNode(content: string | Element[]): Element {
  return h(
    "div",
    {
      className: ["spoiler-container"],
      onclick: toggleSpoilerJs("revealed"),
    },
    [
      h("span", { className: ["spoiler-overlay"] }),
      h("span", { className: ["spoiler-content"] }, content),
    ],
  )
}

/**
 * Check if a text node contains only the spoiler marker "!".
 * @param node - The text node to check
 * @returns True if the node contains only "!" (with optional whitespace)
 */
function isEmptySpoilerLine(node: Text): boolean {
  return node.value.trim() === "!"
}

/**
 * Transform blockquote elements into spoiler containers if they contain spoiler syntax.
 * This function is called by the AST visitor for each element node.
 * @param node - The element to potentially transform
 * @param index - The index of the node in its parent's children array
 * @param parent - The parent node containing this element
 */
export function modifyNode(node: Element, index: number | undefined, parent: Parent | undefined) {
  if (index === undefined || parent === undefined) return
  if (node?.tagName !== "blockquote") return

  const spoilerContent: Element[] = []

  for (const child of node.children) {
    if (child.type === "element" && child.tagName === "p") {
      const processedParagraph = processParagraph(child)
      if (!processedParagraph) {
        return
      }
      spoilerContent.push(processedParagraph)
      continue
    }

    if (child.type === "text" && isEmptySpoilerLine(child)) {
      spoilerContent.push(h("p", {}))
      continue
    }

    if (child.type === "text" && child.value.trim() === "") {
      continue
    }

    return
  }

  if (spoilerContent.length > 0) {
    parent.children[index] = createSpoilerNode(spoilerContent)
  }
}

export function processParagraph(paragraph: Element): Element | null {
  const newChildren: (Text | Element)[] = []
  let isSpoiler = false

  for (const child of paragraph.children) {
    if (child.type === "text") {
      const spoilerText = matchSpoilerText(child.value)
      if (spoilerText !== null) {
        isSpoiler = true
        newChildren.push({ type: "text", value: spoilerText })
        continue
      }

      if (!isSpoiler) {
        return null
      }

      newChildren.push(child)
      continue
    }

    if (child.type === "element") {
      newChildren.push(child)
    }
  }

  return isSpoiler ? { ...paragraph, children: newChildren } : null
}

/**
 * Quartz transformer plugin that converts blockquote-based spoiler syntax into
 * interactive spoiler elements. Spoilers are marked with "! " at the start of
 * blockquote paragraphs.
 */
export const rehypeCustomSpoiler: QuartzTransformerPlugin = () => ({
  name: "customSpoiler",
  htmlPlugins() {
    return [
      () => (tree: Root) => {
        visit(tree, "element", modifyNode)
      },
    ]
  },
})
