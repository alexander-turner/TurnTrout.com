import { type Element, type Parent, type Root, type Text } from "hast"
import { h } from "hastscript"
import { renderToString } from "katex"
import { titleCase } from "title-case"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import { applyTextTransforms } from "../plugins/transformers/formatting_improvement_html"
import { replaceSCInNode } from "../plugins/transformers/tagSmallcaps"
import { processTree as processTwemojiTree } from "../plugins/transformers/twemoji"
import { locale } from "./constants"

export function formatTitle(title: string): string {
  // Replace single quotes with double quotes for consistency
  title = title.replace(/(?<prefix> |^)'/g, '$<prefix>"')
  title = title.replace(/'(?<suffix>[ ?!.]|$)/g, '"$<suffix>')
  title = applyTextTransforms(title, { useNbsp: false })

  title = titleCase(title, { locale })
  return title
}

export interface InlineFormattingOptions {
  /**
   * The text names a work (a page or sequence title), so acronyms in it render
   * as plain caps rather than small-caps.
   */
  workTitle?: boolean
}

/**
 * Single source of truth for the site's node-producing inline transforms:
 * emoji → Twemoji `<img>` and acronym small-caps, applied in pipeline order
 * (Twemoji before TagSmallcaps) over an existing hast subtree in place.
 *
 * Content injected after those two passes have run (the "Similar posts" block,
 * sequence links, backlinks) must re-apply them here. Smart-quote / arrow /
 * nbsp transforms are string-level and belong upstream in the caller
 * (`formatTitle` for titles, `applyTextTransforms` for descriptions).
 */
export function applyInlineFormattingTransforms(
  tree: Root | Element,
  options?: InlineFormattingOptions,
): void {
  processTwemojiTree(tree as unknown as Root)
  if (options?.workTitle) return
  visitParents(tree, "text", (node: Text, ancestors: Parent[]) => {
    replaceSCInNode(node, ancestors)
  })
}

/**
 * Renders a plain (already string-transformed) title or description string into
 * hast inline nodes with {@link applyInlineFormattingTransforms} applied. For
 * callers whose source may contain HTML markup, parse it first and call
 * {@link applyInlineFormattingTransforms} on the resulting tree instead.
 */
export function renderInlineFormatting(
  text: string,
  options?: InlineFormattingOptions,
): (Text | Element)[] {
  const container = h("span", [{ type: "text", value: text } as Text])
  applyInlineFormattingTransforms(container, options)
  return container.children as (Text | Element)[]
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
  const katexNode: Element = {
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
