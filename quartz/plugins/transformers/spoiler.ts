import type { Root, Element, Parent, Text } from "hast"

// skipcq: JS-0257
import { h } from "hastscript"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

// Regex to match spoiler syntax
const SPOILER_REGEX = /^!\s*(.*)/

/**
 * Extracts spoiler text from a string.
 * @param text Input string
 * @returns Spoiler text or null if not a spoiler
 */
export function matchSpoilerText(text: string): string | null {
  const match = SPOILER_REGEX.exec(text)
  return match ? match[1] : null
}

export function createSpoilerNode(content: string | Element[]): Element {
  return h(
    "div",
    {
      className: ["spoiler-container"],
      onclick:
        "if(this.classList.contains('revealed')) { this.classList.remove('revealed') } else { this.classList.add('revealed') }",
    },
    [
      h("span", { className: ["spoiler-overlay"] }),
      h("span", { className: ["spoiler-content"] }, content),
    ],
  )
}

/**
 * Modifies a node to convert it to a spoiler if applicable.
 * @param node Element to modify
 * @param index Index of the node in its parent
 * @param parent Parent of the node
 */
export function modifyNode(node: Element, index: number | undefined, parent: Parent | undefined) {
  if (index === undefined || parent === undefined) return
  if (node?.tagName === "blockquote") {
    const spoilerContent: Element[] = []
    let isSpoiler = true

    for (const child of node.children) {
      if (child.type === "element" && child.tagName === "p") {
        const processedParagraph = processParagraph(child)
        if (processedParagraph) {
          spoilerContent.push(processedParagraph)
        } else {
          isSpoiler = false
          break
        }
      } else if (child.type === "text" && child.value.trim() === "!") {
        // Handle empty spoiler lines
        spoilerContent.push(h("p", {}))
      } else if (child.type === "text" && child.value.trim() === "") {
        // Ignore empty text nodes
        continue
      } else {
        isSpoiler = false
        break
      }
    }

    if (isSpoiler && spoilerContent.length > 0) {
      parent.children[index] = createSpoilerNode(spoilerContent)
    }
  }
}

/**
 * Processes a paragraph to convert it to a spoiler if applicable.
 * @param paragraph Paragraph element
 * @returns Processed paragraph or null if not a spoiler
 */
export function processParagraph(paragraph: Element): Element | null {
  const newChildren: (Text | Element)[] = []
  let isSpoiler = false

  for (const child of paragraph.children) {
    if (child.type === "text") {
      const spoilerText = matchSpoilerText(child.value)
      if (spoilerText !== null) {
        isSpoiler = true
        newChildren.push({ type: "text", value: spoilerText })
      } else if (isSpoiler) {
        newChildren.push(child)
      } else {
        return null
      }
    } else if (child.type === "element") {
      newChildren.push(child)
    }
  }

  return isSpoiler ? { ...paragraph, children: newChildren } : null
}

/**
 * Transforms the AST by converting spoilers.
 * @param tree AST to transform
 */
export function transformAST(tree: Root): void {
  visit(tree, "element", modifyNode)
}

/**
 * Quartz plugin for custom spoiler syntax.
 */
export const rehypeCustomSpoiler: QuartzTransformerPlugin = () => {
  return {
    name: "customSpoiler",
    htmlPlugins() {
      return [() => transformAST]
    },
  }
}
