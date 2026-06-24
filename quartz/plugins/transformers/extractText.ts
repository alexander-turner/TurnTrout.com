import type { Root } from "mdast"

import { CONTINUE, EXIT, SKIP, visit } from "unist-util-visit"

import { escapeHTML } from "../../util/escape"
import { admonitionCollapseState } from "./ofm"
import { urlRegex } from "./utils"

const textNodeTypes: ReadonlySet<string> = new Set([
  "text",
  "inlineCode",
  "code",
  "math",
  "inlineMath",
])

/** Minimal structural view of the mdast nodes inspected while gathering text. */
type MdastLike = {
  type: string
  value?: unknown
  depth?: number
  children?: readonly MdastLike[]
}

/** A node's own string value when it is a gatherable text node, else null. */
function nodeText(node: MdastLike): string | null {
  if (!textNodeTypes.has(node.type)) return null
  return typeof node.value === "string" ? node.value : null
}

/** First text child's string value, or null when the first child isn't a text node. */
function firstTextValue(node: MdastLike): string | null {
  const firstChild = node.children?.[0]
  if (firstChild?.type !== "text") return null
  return typeof firstChild.value === "string" ? firstChild.value : null
}

/**
 * Detects a blockquote whose admonition directive defaults to collapsed (`[!type]-`).
 * The reading-time estimate skips these because their content is hidden by default.
 *
 * Runs before remark-gfm and the OFM transform, so the admonition is still a raw
 * blockquote whose first text line carries the directive.
 */
function isCollapsedAdmonition(node: MdastLike): boolean {
  if (node.type !== "blockquote") return false
  const firstChild = node.children?.[0]
  if (firstChild?.type !== "paragraph") return false
  const value = firstTextValue(firstChild)
  if (value === null) return false
  const [firstLine] = value.split("\n")
  return admonitionCollapseState(firstLine) === "collapsed"
}

/**
 * Detects an `# Appendix…`/`## Appendix…` heading that opens the appendix region.
 * Everything from this heading onward is excluded from the reading-time estimate.
 */
function isAppendixHeading(node: MdastLike): boolean {
  if (node.type !== "heading" || (node.depth !== 1 && node.depth !== 2)) return false
  const value = firstTextValue(node)
  return value !== null && value.toLowerCase().startsWith("appendix")
}

/**
 * Detects a footnote definition (`[^id]: …`). Before remark-gfm runs, these
 * parse as ordinary paragraphs whose text begins with the footnote marker.
 */
const footnoteDefinitionRegex = /^\[\^[^\]]+\]:/
function isFootnoteDefinition(node: MdastLike): boolean {
  if (node.type !== "paragraph") return false
  const value = firstTextValue(node)
  return value !== null && footnoteDefinitionRegex.test(value)
}

/**
 * Gathers the value of every text/code/math node in document order. When
 * `excludeHidden` is set, content a reader does not see by default is skipped:
 * collapsed admonitions, footnote definitions, and the appendix region
 * (everything from the first top-level `Appendix` heading onward).
 */
function gatherText(tree: Root, excludeHidden: boolean): string {
  let allText = ""
  visit(tree, (node, _index, parent) => {
    const mdastNode = node as unknown as MdastLike
    if (excludeHidden) {
      if (parent === tree && isAppendixHeading(mdastNode)) {
        return EXIT
      }
      if (isCollapsedAdmonition(mdastNode) || isFootnoteDefinition(mdastNode)) {
        return SKIP
      }
    }
    const value = nodeText(mdastNode)
    if (value !== null) {
      allText += `${value} `
    }
    return CONTINUE
  })
  return allText
}

/** Full document text, for search indexing. */
export const gatherAllText = (tree: Root): string => gatherText(tree, false)

/** Text counted toward the displayed reading time; excludes hidden content. */
export const gatherReadingTimeText = (tree: Root): string => gatherText(tree, true)

/** Normalizes gathered text for storage: escape HTML and collapse URLs. */
export function processGatheredText(raw: string): string {
  return escapeHTML(raw).replace(urlRegex, "$<domain>$<path>")
}
