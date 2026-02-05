import type { Element, Text, Parent, ElementContent } from "hast"

import { markerChar } from "../../components/constants"
import { hasClass, type ElementMaybeWithParent } from "./utils"

/**
 * @module punctilio-rehype
 * Generic rehype infrastructure for applying text transformations to HAST trees.
 * Provides the DOM management layer between punctilio's text transforms and HTML AST processing.
 */

/**
 * Tags that should be skipped during text transformation.
 * Content inside these elements won't have formatting improvements applied.
 */
export const SKIP_TAGS = ["code", "script", "style", "pre"] as const

/**
 * Tags that should be skipped during fraction replacement.
 * Includes SKIP_TAGS plus "a" (links) to avoid breaking URLs.
 */
export const FRACTION_SKIP_TAGS = ["code", "pre", "a", "script", "style"] as const

/**
 * CSS classes that indicate content should skip formatting.
 */
export const SKIP_CLASSES = ["no-formatting", "elvish", "bad-handwriting"] as const

export function toSkip(node: Element): boolean {
  if (node.type === "element") {
    const elementNode = node as ElementMaybeWithParent
    const skipTag = (SKIP_TAGS as readonly string[]).includes(elementNode.tagName)
    const skipClass = SKIP_CLASSES.some((cls) => hasClass(elementNode, cls))
    // Skip footnote references - their number text shouldn't be transformed
    const isFootnoteRef = elementNode.properties?.["dataFootnoteRef"] !== undefined

    return skipTag || skipClass || isFootnoteRef
  }
  return false
}

/**
 * Flattens text nodes in an element tree into a single array
 * @param node - The element or element content to process
 * @param ignoreNode - Function to determine which nodes to skip
 * @returns Array of Text nodes
 */
export function flattenTextNodes(
  node: Element | ElementContent,
  ignoreNode: (n: Element) => boolean,
): Text[] {
  if (ignoreNode(node as Element)) {
    return []
  }

  if (node.type === "text") {
    return [node as Text]
  }

  if (node.type === "element" && "children" in node) {
    return node.children.flatMap((child) => flattenTextNodes(child, ignoreNode))
  }

  // For other node types (like comments), return an empty array
  return []
}

/**
 * Extracts concatenated text content from an element
 * @param node - The element to process
 * @param ignoreNodeFn - Optional function to determine which nodes to skip
 * @returns The combined text content
 */
export function getTextContent(
  node: Element,
  ignoreNodeFn: (n: Element) => boolean = () => false,
): string {
  return flattenTextNodes(node, ignoreNodeFn)
    .map((n) => n.value)
    .join("")
}

/**
 * Validates that smart quotes in a text string are properly matched
 * @param input - The text to validate
 * @throws Error if quotes are mismatched
 */
export function assertSmartQuotesMatch(input: string): void {
  if (!input) return

  const quoteMap: Record<string, string> = { "\u201C": "\u201D", "\u201D": "\u201C" }
  const stack: string[] = []

  for (const char of input) {
    if (char in quoteMap) {
      if (stack.length > 0 && quoteMap[stack[stack.length - 1]] === char) {
        stack.pop()
      } else {
        stack.push(char)
      }
    }
  }

  if (stack.length > 0) {
    throw new Error(`Mismatched quotes in ${input}`)
  }
}

/**
 * Applies a transformation to element text content while preserving structure.
 *
 * Sometimes we want to transform the text content of a paragraph (e.g.
 * by adding smart quotes). But that paragraph might contain multiple child
 * elements. If we transform each of the child elements individually, the
 * transformation might fail or be mangled.
 *
 * This function:
 *   1. Appends a private-use unicode char to end of each child's text content.
 *   2. Takes text content of the whole paragraph and applies transform to it.
 *   3. Splits the transformed text content by the unicode char, putting
 *      each fragment back into the corresponding child node.
 *   4. Asserts that stripChar(transform(textContentWithChar)) =
 *      transform(stripChar(textContent)) as a sanity check.
 *
 * @param node - The element to transform
 * @param transform - The transformation function to apply
 * @param ignoreNodeFn - Optional function to determine which nodes to skip
 * @param checkTransformInvariance - Whether to verify transform consistency
 * @throws Error if node has no children or transformation alters node count
 */
export function transformElement(
  node: Element,
  transform: (input: string) => string,
  ignoreNodeFn: (input: Element) => boolean = () => false,
  checkTransformInvariance = true,
): void {
  if (!node?.children) {
    throw new Error("Node has no children")
  }

  // Append markerChar and concatenate all text nodes
  const textNodes = flattenTextNodes(node, ignoreNodeFn)
  const markedContent = textNodes.map((n) => n.value + markerChar).join("")

  const transformedContent: string = transform(markedContent)

  // Split and overwrite. Last fragment is always empty because strings end with markerChar
  const transformedFragments = transformedContent.split(markerChar).slice(0, -1)

  if (transformedFragments.length !== textNodes.length) {
    console.error("Text node count mismatch debug info:")
    console.error("  Before:", JSON.stringify(markedContent))
    console.error("  After:", JSON.stringify(transformedContent))
    console.error("  Expected fragments:", textNodes.length)
    console.error("  Actual fragments:", transformedFragments.length)
    throw new Error("Transformation altered the number of text nodes")
  }

  textNodes.forEach((n, index) => {
    n.value = transformedFragments[index]
  })

  if (checkTransformInvariance) {
    const strippedContent = markedContent.replaceAll(markerChar, "")
    const strippedTransformed = transformedContent.replaceAll(markerChar, "")
    const expected = transform(strippedContent)

    // istanbul ignore next
    if (expected !== strippedTransformed) {
      console.error("Transform invariance check failed!")
      console.error("=== Original (with markers) ===")
      console.error(JSON.stringify(markedContent))
      console.error("=== Expected (transform on stripped) ===")
      console.error(JSON.stringify(expected))
      console.error("=== Actual (stripped after transform) ===")
      console.error(JSON.stringify(strippedTransformed))
      console.error("=== END ===")
      throw new Error(
        `Transform invariance check failed: expected "${expected}" but got "${strippedTransformed}"`,
      )
    }
  }
}

const collectNodes = [
  "p",
  "em",
  "strong",
  "i",
  "b",
  "sub",
  "sup",
  "small",
  "del",
  "center",
  "td",
  "dt",
  "dd",
  "dl",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ol",
  "ul",
  "li",
  "tr",
  "td",
  "th",
  "a",
  "span",
  "div",
  "figcaption",
  "blockquote",
]

export function collectTransformableElements(node: Element): Element[] {
  const eltsToTransform: Element[] = []

  if (toSkip(node)) {
    return []
  }

  // If this node matches our collection criteria,
  // add it and do NOT recurse separately for its children.
  if (collectNodes.includes(node.tagName) && node.children.some((child) => child.type === "text")) {
    eltsToTransform.push(node)
  } else {
    // Otherwise, keep looking through children.
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child.type === "element") {
          eltsToTransform.push(...collectTransformableElements(child))
        }
      }
    }
  }

  return eltsToTransform
}

/**
 * Recursively finds the first text node in a tree of HTML elements
 *
 * @param node - The root node to search from
 * @returns The first text node found, or null if no text nodes exist
 */
export function getFirstTextNode(node: Parent): Text | null {
  if (!node) return null

  // Handle direct text nodes
  if (node.type === "text" && "value" in node) {
    return node as Text
  }

  // Recursively search through children
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const textNode = getFirstTextNode(child as Parent)
      if (textNode) {
        return textNode
      }
    }
  }

  return null
}
