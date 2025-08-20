import { type Parent, type Text, type Element } from "hast"
import { renderToString } from "katex"
import { titleCase } from "title-case"

import { applyTextTransforms } from "../plugins/transformers/formatting_improvement_html"
import { replaceSCInNode } from "../plugins/transformers/tagSmallcaps"
import { locale } from "./constants"

export const sessionStoragePondVideoKey = "pond-video-timestamp"
export const pondVideoId = "pond-video"

export function formatTitle(title: string): string {
  // Replace single quotes with double quotes for consistency
  title = title.replace(/( |^)'/g, '$1"').replace(/'([ ?!.]|$)/g, '"$1')
  title = applyTextTransforms(title)

  // Convert title to title case
  title = titleCase(title, { locale })
  return title
}

/**
 * Processes small caps in the given text and adds it to the parent node.
 * @param text - The text to process.
 * @param parent - The parent node to add the processed text to.
 */
export function processSmallCaps(text: string, parent: Parent): void {
  const textNode = { type: "text", value: text } as Text
  parent.children.push(textNode)
  replaceSCInNode(textNode, [parent])
}

/**
 * Renders inline code as a code block.
 * @param text - The text to process.
 * @param parent - The parent node to add the processed text to.
 */
export function processInlineCode(text: string, parent: Parent): void {
  const codeBlock = {
    type: "element",
    tagName: "code",
    properties: { className: ["inline-code"] },
    children: [{ type: "text", value: text }],
  } as Element
  parent.children.push(codeBlock)
}

/**
 * Processes LaTeX content and adds it to the parent node as a KaTeX-rendered span.
 * @param latex - The LaTeX content to process.
 * @param parent - The parent node to add the processed LaTeX to.
 */
export function processKatex(latex: string, parent: Parent): void {
  const html = renderToString(latex, { throwOnError: false })
  const katexNode = {
    type: "element",
    tagName: "span",
    properties: { className: ["katex-toc"] },
    children: [{ type: "raw", value: html }],
  } as Element
  parent.children.push(katexNode)
}

/**
 * Wraps text in a span for arrows.
 * @param text The text to process (assumed to be an arrow).
 * @param parent The parent node to add the processed text to.
 */
export function processTextWithArrows(text: string, parent: Parent): void {
  const arrowSpan: Element = {
    type: "element",
    tagName: "span",
    properties: { className: ["monospace-arrow"] },
    children: [{ type: "text", value: text }],
  }
  parent.children.push(arrowSpan)
}
