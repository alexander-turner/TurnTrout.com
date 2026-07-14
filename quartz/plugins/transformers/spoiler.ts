import type { Element, Parent, Text } from "hast"

// skipcq: JS-0257
import { h } from "hastscript"

import { createElementVisitorPlugin } from "./utils"

type InlineNode = Text | Element

const SPOILER_REGEX = /^!\s*(?<spoilerText>.*)/

/**
 * Extract spoiler text from a string.
 */
export function matchSpoilerText(text: string): string | null {
  const match = SPOILER_REGEX.exec(text)
  return match?.groups ? match.groups.spoilerText : null
}

/**
 * Create a spoiler container element with overlay and content.
 * Toggling is handled by the delegated listeners in `spoiler.inline.ts`,
 * which react to clicks anywhere in the container and to Enter/Space on the
 * overlay; no inline event handlers are emitted.
 * @param content - The content to hide behind the spoiler (string or array of elements)
 * @returns A div element with spoiler-container class
 */
export function createSpoilerNode(content: string | Element[]): Element {
  return h(
    "div",
    {
      className: ["spoiler-container"],
    },
    [
      h("span", {
        className: ["spoiler-overlay"],
        role: "button",
        tabindex: 0,
        ariaExpanded: "false",
        ariaLabel: "Spoiler (click or press Enter to reveal)",
      }),
      h("span", { className: ["spoiler-content"], ariaHidden: "true" }, content),
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

  /* istanbul ignore next -- spoilerContent is always non-empty when all children pass spoiler checks */
  if (spoilerContent.length > 0) {
    parent.children[index] = createSpoilerNode(spoilerContent)
  }
}

/**
 * Split a text node's value on newlines into an alternating sequence of text
 * nodes and <br> elements. A value with no newlines yields a single text node.
 */
function splitTextOnNewlines(value: string): InlineNode[] {
  const lines = value.split("\n")
  const result: InlineNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) result.push(h("br"))
    result.push({ type: "text", value: line })
  })
  return result
}

/**
 * Flatten a paragraph's children so each logical line is a contiguous run of
 * nodes separated by <br> elements. Markdown soft-wraps multiple `>` lines into
 * a single paragraph whose text nodes contain embedded "\n" characters; this
 * helper makes those line boundaries explicit.
 */
function flattenParagraphChildren(paragraph: Element): InlineNode[] {
  const result: InlineNode[] = []
  for (const child of paragraph.children) {
    if (child.type === "text") {
      result.push(...splitTextOnNewlines(child.value))
      continue
    }
    /* istanbul ignore next -- paragraph children are always text or element nodes */
    if (child.type === "element") {
      result.push(child)
    }
  }
  return result
}

function isLineBreak(node: InlineNode): boolean {
  return node.type === "element" && node.tagName === "br"
}

export function processParagraph(paragraph: Element): Element | null {
  const newChildren: InlineNode[] = []
  let isSpoiler = false
  let atLineStart = true

  for (const node of flattenParagraphChildren(paragraph)) {
    if (isLineBreak(node)) {
      newChildren.push(node)
      atLineStart = true
      continue
    }

    if (atLineStart && node.type === "text") {
      const spoilerText = matchSpoilerText(node.value)
      if (spoilerText !== null) {
        isSpoiler = true
        newChildren.push({ type: "text", value: spoilerText })
        atLineStart = false
        continue
      }
      if (!isSpoiler) return null
    }

    newChildren.push(node)
    atLineStart = false
  }

  return isSpoiler ? { ...paragraph, children: newChildren } : null
}

/**
 * Quartz transformer plugin that converts blockquote-based spoiler syntax into
 * interactive spoiler elements. Spoilers are marked with "! " at the start of
 * blockquote paragraphs.
 */
export const rehypeCustomSpoiler = createElementVisitorPlugin("customSpoiler", modifyNode)
