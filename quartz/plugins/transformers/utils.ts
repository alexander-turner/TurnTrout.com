import type { Parent, RootContent, Text, Element, Root, ElementContent } from "hast"

import { toString } from "hast-util-to-string"
import { h } from "hastscript"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

export const urlRegex = new RegExp(
  /(?<protocol>https?:\/\/)(?<domain>(?:[\da-z.-]+\.)+)(?<path>[/?=\w.-]+(?:\([\w.\-,() ]*\))?)(?=\))/g,
)

const linkText = /\[(?<linkText>[^\]]+)\]/
const linkURL = /\((?<linkURL>[^#].*?)\)/ // Ignore internal links, capture as little as possible
export const mdLinkRegex = new RegExp(linkText.source + linkURL.source, "g")

export const integerRegex = /\d{1,3}(?:,?\d{3})*/u
export const numberRegex = new RegExp(`[-−]?${integerRegex.source}(?:\\.\\d+)?`, "u")

// A fraction is a digit followed by a slash and another digit
const ordinalSuffixes = /(?:st|nd|rd|th)/
export const fractionRegex = new RegExp(
  `(?<![\\w/\\.]|${numberRegex.source})(?!9/11)(?<numerator>${integerRegex.source})\\/(?<denominator>${integerRegex.source})(?<ordinal>${ordinalSuffixes.source})?(?!${numberRegex.source}|\\d)(?![\\w/])`,
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
  const matchIndexes: number[] = []
  let lastMatchEnd = 0
  let match: RegExpExecArray | null = null

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

  const fragment: RootContent[] = []
  lastIndex = 0

  for (const index of matchIndexes) {
    // Add any text before the match to the fragment
    if (index > lastIndex) {
      fragment.push({
        type: "text",
        value: node.value.substring(lastIndex, index),
      })
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

/**
 * Check if a node or any of its ancestors satisfies the given predicate.
 *
 * @param node - The node to check
 * @param ancestorPredicate - Function to test each node/ancestor
 * @param ancestors - Array of ancestor nodes from visitParents
 * @returns true if the node or any ancestor satisfies the predicate
 */
export function hasAncestor(
  node: Element,
  ancestorPredicate: (anc: Element) => boolean,
  ancestors: Parent[],
): boolean {
  // Check the node itself first
  if (ancestorPredicate(node)) return true

  // Check all ancestors
  return ancestors.some((anc) => ancestorPredicate(anc as Element))
}

/**
 * Maximum characters to splice from the end of a text node when wrapping
 * an inline icon (favicon, back arrow, etc.) in a nowrap span.
 */
export const maxCharsToRead = 4

/**
 * Creates a nowrap span element that wraps the given text and child element
 * to prevent line-break orphaning via white-space: nowrap.
 */
export function createNowrapSpan(text: string, child: Element): Element {
  return {
    type: "element",
    tagName: "span",
    properties: { className: "favicon-span" },
    children: [{ type: "text" as const, value: text }, child],
  } as Element
}

/**
 * Splices the last few characters from a text node and wraps them with
 * the given element in a nowrap span, preventing line-break orphaning.
 *
 * Mutates `lastTextNode.value` in place. If all text is consumed, removes
 * the text node from `parent.children`.
 *
 * @returns The nowrap span containing [spliced text, elementToWrap].
 */
export function spliceAndWrapLastChars(
  lastTextNode: Text,
  parent: Element,
  elementToWrap: Element,
): Element {
  const text = lastTextNode.value
  const charsToRead = Math.min(maxCharsToRead, text.length)
  const lastChars = text.slice(-charsToRead)
  lastTextNode.value = text.slice(0, -charsToRead)

  // Remove the text node entirely if all text was moved into the span
  if (lastChars === text) {
    const idx = parent.children.indexOf(lastTextNode as unknown as ElementContent)
    if (idx !== -1) {
      parent.children.splice(idx, 1)
    }
  }

  return createNowrapSpan(lastChars, elementToWrap)
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

/**
 * Type guard to check if a node is a Text node.
 * @param node - The node to check
 * @returns True if the node is a Text node
 */
export function isTextNode(node: ElementContent): node is Text {
  return node.type === "text"
}

/**
 * Type guard to check if a node is an Element node.
 * @param node - The node to check
 * @returns True if the node is an Element node
 */
export function isElementNode(node: ElementContent): node is Element {
  return node.type === "element"
}

/**
 * Check if an element is a code element.
 * @param node - The element to check
 * @returns True if the element's tagName is "code"
 */
export function isCode(node: Element): boolean {
  return node.tagName === "code"
}

/**
 * Factory function to create a Quartz transformer plugin that visits all elements in the HTML AST.
 * Reduces boilerplate for simple transformer plugins that just need to visit and modify elements.
 *
 * @param name - The name of the plugin (e.g., "customSpoiler")
 * @param visitor - A function that processes each element node in the tree
 * @returns A QuartzTransformerPlugin that applies the visitor to all elements
 *
 * @example
 * export const MyPlugin = createElementVisitorPlugin("MyPlugin", (node, index, parent) => {
 *   if (node.tagName === "p") {
 *     // Modify paragraph elements
 *   }
 * })
 */
export function createElementVisitorPlugin(
  name: string,
  visitor: (node: Element, index: number | undefined, parent: Parent | undefined) => void,
): QuartzTransformerPlugin {
  return () => ({
    name,
    htmlPlugins() {
      return [
        () => (tree: Root) => {
          visit(tree, "element", visitor)
        },
      ]
    },
  })
}
