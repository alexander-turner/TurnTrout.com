import type { Parent, RootContent, Text, Element, Root } from "hast"

import { toString } from "hast-util-to-string"
import { h } from "hastscript"

export const urlRegex = new RegExp(
  /(https?:\/\/)(?<domain>([\da-z.-]+\.)+)(?<path>[/?=\w.-]+(\([\w.\-,() ]*\))?)(?=\))/g,
)

const linkText = /\[(?<linkText>[^\]]+)\]/
const linkURL = /\((?<linkURL>[^#].*?)\)/ // Ignore internal links, capture as little as possible
export const mdLinkRegex = new RegExp(linkText.source + linkURL.source, "g")

export const integerRegex = /\d{1,3}(,?\d{3})*/u
export const numberRegex = new RegExp(`[-−]?${integerRegex.source}(\\.\\d+)?`, "u")

// A fraction is a digit followed by a slash and another digit
const ordinalSuffixes = /(st|nd|rd|th)/
export const fractionRegex = new RegExp(
  `(?<![\\w/\\.]|${numberRegex.source})` + // not preceded by word char, '/', '.', or a number
    "(?!9/11)" +
    `(?<numerator>${integerRegex.source})` +
    "\\/" +
    `(?<denominator>${integerRegex.source})` +
    `(?<ordinal>${ordinalSuffixes.source})?` +
    `(?!${numberRegex.source}|\\d)` + // not followed by a number or another digit
    "(?![\\w/])", // not followed by a word char or slash (ensures boundary)
  "gm",
)

export interface ReplaceFnResult {
  before: string
  replacedMatch: string | Element | Element[]
  after: string
}

/**
 * Replaces text in a node based on a regex pattern and a replacement function.
 *
 * @param node - The text node to process.
 * @param index - The index of the node in its parent's children array.
 * @param parent - The parent node containing the text node.
 * @param regex - The regular expression to match against the node's text.
 * @param replaceFn - A function that takes a regex match and returns an object with before, replacedMatch, and after properties.
 * @param ignorePredicate - An optional function that determines whether to ignore a node. Default is to never ignore.
 * @param newNodeStyle - The HTML tag name for the new node created for replacedMatch. Default is "span". "abbr.small-caps" yields e.g. <abbr class="small-caps">{content}</abbr>.
 */
export const replaceRegex = (
  node: Text,
  index: number,
  parent: Parent,
  regex: RegExp,
  replaceFn: (match: RegExpMatchArray) => ReplaceFnResult,
  // istanbul ignore next
  ignorePredicate: (node: Text, index: number, parent: Parent) => boolean = () => false,
  newNodeStyle = "span",
): void => {
  // If the node should be ignored or has no value, return early
  // skipcq: JS-W1038
  if (ignorePredicate(node, index, parent) || !node?.value) {
    return
  }

  let lastIndex = 0
  const matchIndexes = []
  let lastMatchEnd = 0
  let match

  // Find all non-overlapping matches in the node's text
  regex.lastIndex = 0 // Reset regex state before first pass with exec()
  while ((match = regex.exec(node.value)) !== null) {
    if (match.index >= lastMatchEnd) {
      matchIndexes.push(match.index)
      lastMatchEnd = match.index + match[0]?.length
    }
  }

  // If no matches found or node has no value, return early
  if (!matchIndexes?.length || !node.value) return

  const fragment = []
  lastIndex = 0

  for (const index of matchIndexes) {
    // Add any text before the match to the fragment
    if (index > lastIndex) {
      fragment.push({ type: "text", value: node.value.substring(lastIndex, index) })
    }

    // Use exec() instead of match() to get capture groups
    regex.lastIndex = index
    const match = regex.exec(node.value)
    // istanbul ignore if
    if (!match) continue

    const { before, replacedMatch, after } = replaceFn(match)
    if (before) {
      fragment.push({ type: "text", value: before })
    }
    if (replacedMatch) {
      if (Array.isArray(replacedMatch)) {
        // For each element in the array, ensure it has text content
        fragment.push(...replacedMatch)
      } else if (typeof replacedMatch === "string") {
        fragment.push(h(newNodeStyle, replacedMatch))
      } else {
        fragment.push(replacedMatch)
      }
    }
    if (after) {
      fragment.push({ type: "text", value: after })
    }

    // Update lastIndex to the end of the match
    if (match) {
      lastIndex = index + match[0].length
    }
  }

  // Add any remaining text after the last match
  if (lastIndex < node.value?.length) {
    fragment.push({ type: "text", value: node.value.substring(lastIndex) })
  }

  // Replace the original text node with the new nodes in the parent's children array
  if (parent.children && typeof index === "number") {
    parent.children.splice(index, 1, ...(fragment as RootContent[]))
  }
}

/**
 * Checks if node has no previous sibling or previous sibling ends with period + with optional whitespace.
 */
export function shouldCapitalizeNodeText(index: number, parent: Parent): boolean {
  if (index <= 0) return true

  const prev = parent?.children[index - 1]
  // istanbul ignore if
  if (!prev) return true

  if (prev.type === "text") {
    return /\.\s*$/.test(prev.value ?? "")
  }
  return false
}

/**
 * Gathers any text (including nested inline-element text) before a certain
 * index in the parent's children array, with proper handling of <br> elements.
 */
export function gatherTextBeforeIndex(parent: Parent, upToIndex: number): string {
  // Create a temporary parent with just the nodes up to our index
  const tempParent = {
    ...parent,
    children: parent.children.slice(0, upToIndex).map((node) => {
      // Convert <br> elements to newline text nodes
      if (node.type === "element" && (node as Element).tagName === "br") {
        return { type: "text", value: "\n" }
      }
      return node
    }),
  }

  return toString(tempParent as Root)
}

/**
 * Interface for elements that may have a parent reference
 */
export interface ElementMaybeWithParent extends Element {
  parent: ElementMaybeWithParent | null
}

// Does node have an ancestor that satisfies the predicate?
export function hasAncestor(
  node: ElementMaybeWithParent,
  ancestorPredicate: (anc: Element) => boolean,
): boolean {
  let ancestor: ElementMaybeWithParent | null = node

  while (ancestor) {
    if (ancestorPredicate(ancestor)) {
      return true
    }
    ancestor = ancestor.parent
  }

  return false
}

// Does node have a class that includes the given className?
export function hasClass(node: Element, className: string): boolean {
  // Check both className and class properties (hastscript uses class)
  const classProp = node.properties?.className || node.properties?.class
  if (typeof classProp === "string" || Array.isArray(classProp)) {
    return classProp.includes(className)
  }
  return false
}
