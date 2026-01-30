import type { Element, Text, Root, Parent, ElementContent } from "hast"

import { h } from "hastscript"
import { niceQuotes, hyphenReplace, symbolTransform } from "punctilio"
import { type Transformer } from "unified"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import { charsToMoveIntoLinkFromRight } from "../../components/constants"
import { type QuartzTransformerPlugin } from "../types"
import {
  replaceRegex,
  fractionRegex,
  hasClass,
  hasAncestor,
  type ElementMaybeWithParent,
  urlRegex,
} from "./utils"

/**
 * @module HTMLFormattingImprovement
 * A plugin that improves text formatting in HTML content by applying various typographic enhancements
 */

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

  const quoteMap: Record<string, string> = { "”": "“", "“": "”" }
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

export const markerChar = "\uE000"
/* Sometimes I want to transform the text content of a paragraph (e.g.
by adding smart quotes). But that paragraph might contain multiple child
elements. If I transform each of the child elements individually, the
transformation might fail or be mangled. For example, consider the
literal string "<em>foo</em>" The transformers will see '"', 'foo', and
'"'. It's then impossible to know how to transform the quotes.

This function allows applying transformations to the text content of a
paragraph, while preserving the structure of the paragraph. 
  1. Append a private-use unicode char to end of each child's text content.  
  2. Take text content of the whole paragraph and apply
    transform to it
  3. Split the transformed text content by the unicode char, putting
    each fragment back into the corresponding child node. 
  4. Assert that stripChar(transform(textContentWithChar)) =
    transform(stripChar(textContent)) as a sanity check, ensuring
    transform is invariant to our choice of character. 
  
  NOTE/TODO this function is, in practice, called multiple times on the same
  node via its parent paragraphs. Beware non-idempotent transforms.
  */
/**
 * Applies a transformation to element text content while preserving structure
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

/**
 * Space out slashes in text
 * @returns The text with slashes spaced out
 */
export function spacesAroundSlashes(text: string): string {
  // Use a private-use Unicode character as placeholder
  const h_t_placeholder_char = "\uE010"

  // First replace h/t with the placeholder character
  text = text.replace(/\b(h\/t)\b/g, h_t_placeholder_char)

  // Apply the normal slash spacing rule
  // Can't allow num on both sides, because it'll mess up fractions
  // Use function replacement to preserve markers while avoiding double spaces
  // Markers go OUTSIDE the spaces so content stays in correct HTML elements
  const slashRegex = /(?<![\d/<])(?<=[\S])( ?)(\uE000)?\/(\uE000)?( ?)(?=\S)(?!\/)/g
  text = text.replace(
    slashRegex,
    (_match, spaceBefore, markerBefore, markerAfter, spaceAfter) => {
      // Add space only if not already present
      // Place markers outside spaces: marker-space-slash-space-marker
      const pre = spaceBefore || " "
      const post = spaceAfter || " "
      return `${markerBefore || ""}${pre}/${post}${markerAfter || ""}`
    },
  )

  const numberSlashThenNonNumber = /(?<=\d)\/(?=\D)/g
  text = text.replace(numberSlashThenNonNumber, " / ")

  // Restore the h/t occurrences
  return text.replace(new RegExp(h_t_placeholder_char, "g"), "h/t")
}

export function removeSpaceBeforeFootnotes(tree: Root): void {
  visitParents(tree, "element", (node, ancestors) => {
    const parent = ancestors[ancestors.length - 1] as Parent
    // istanbul ignore next
    if (!parent) return

    const index = parent.children.indexOf(node as ElementContent)
    if (node.tagName === "sup" && index > 0 && parent.children[index - 1]?.type === "text") {
      const prevNode = parent.children[index - 1] as Text
      prevNode.value = prevNode.value.replace(/\s+$/, "")
    }
  })
}

// These lists are automatically added to both applyTextTransforms and the main HTML transforms
// Don't check for invariance
const uncheckedTextTransformers = [
  (text: string) => hyphenReplace(text, { separator: markerChar }),
  (text: string) => niceQuotes(text, { separator: markerChar }),
  // Ellipsis, multiplication, math, legal symbols (arrows disabled - site uses custom formatArrows)
  (text: string) => symbolTransform(text, { separator: markerChar, includeArrows: false }),
]

// Check for invariance
const checkedTextTransformers = [massTransformText, plusToAmpersand, timeTransform]

/**
 * Applies multiple text transformations
 *
 * Not used in this module, but useful elsewhere
 *
 * @returns The transformed text
 */
export function applyTextTransforms(text: string): string {
  for (const transformer of [
    ...checkedTextTransformers,
    ...uncheckedTextTransformers,
    spacesAroundSlashes,
  ]) {
    text = transformer(text)
  }

  return text
}

export function isCode(node: Element): boolean {
  return node.tagName === "code"
}

export const l_pRegex = /(\s|^)L(\d+)\b(?!\.)/g
/**
 * Converts L-numbers (like "L1", "L42") to use subscript numbers with lining numerals
 * @param tree - The HTML AST to process
 */
export function formatLNumbers(tree: Root): void {
  visitParents(tree, "text", (node, ancestors) => {
    const parent = ancestors[ancestors.length - 1] as Parent
    if (!parent || hasAncestor(parent as Element, isCode, ancestors)) {
      return
    }

    const index = parent.children.indexOf(node as ElementContent)
    let match
    let lastIndex = 0
    const newNodes: (Text | Element)[] = []

    while ((match = l_pRegex.exec(node.value)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        newNodes.push({ type: "text", value: node.value.slice(lastIndex, match.index) })
      }

      // Add the space/start of line
      newNodes.push({ type: "text", value: match[1] })

      // Add "L" text
      newNodes.push({ type: "text", value: "L" })

      // Add subscript number
      newNodes.push({
        type: "element",
        tagName: "sub",
        properties: { style: "font-variant-numeric: lining-nums;" },
        children: [{ type: "text", value: match[2] }],
      })

      lastIndex = l_pRegex.lastIndex
    }

    // Add remaining text
    if (lastIndex < node.value.length) {
      newNodes.push({ type: "text", value: node.value.slice(lastIndex) })
    }

    if (newNodes.length > 0) {
      parent.children.splice(index, 1, ...newNodes)
    }
  })
}

export function formatArrows(tree: Root): void {
  visitParents(tree, "text", (node, ancestors) => {
    const parent = ancestors[ancestors.length - 1] as Parent
    if (!parent || hasAncestor(parent as Element, toSkip, ancestors)) return

    const index = parent.children.indexOf(node as ElementContent)
    replaceRegex(
      node,
      index,
      parent,
      /(?:^|(?<= )|(?<=\w))[-]{1,2}>(?=\w| |$)/g,
      (match: RegExpMatchArray) => {
        const matchIndex = match.index ?? /* istanbul ignore next */ 0
        const beforeChar = match.input?.slice(Math.max(0, matchIndex - 1), matchIndex)

        const matchLength = match[0]?.length ?? /* istanbul ignore next */ 0
        const afterChar = match.input?.slice(matchIndex + matchLength, matchIndex + matchLength + 1)

        const needsSpaceBefore = /\w/.test(beforeChar ?? /* istanbul ignore next */ "")
        const needsSpaceAfter = /\w/.test(afterChar ?? /* istanbul ignore next */ "")

        return {
          before: needsSpaceBefore ? " " : "",
          replacedMatch: "⭢",
          after: needsSpaceAfter ? " " : "",
        }
      },
      () => false,
      "span.right-arrow",
    )
  })
}

// skipcq: JS-0098
function isKatex(node: Element): boolean {
  return hasClass(node, "katex")
}

export const arrowsToWrap = ["←", "→", "↑", "↓", "↗", "↘", "↖", "↙"]

/**
 * Wraps Unicode arrows with monospace styling, but only outside of KaTeX math blocks
 */
export function wrapUnicodeArrowsWithMonospaceStyle(tree: Root): void {
  const arrowRegex = new RegExp(`(${arrowsToWrap.join("|")})`, "g")

  visitParents(tree, "text", (node, ancestors) => {
    const parent = ancestors[ancestors.length - 1] as Parent

    // istanbul ignore next
    if (!parent) return

    const index = parent.children.indexOf(node as ElementContent)

    // Check if any ancestor should be skipped (code, pre, script, style, no-formatting classes)
    if (hasAncestor(parent as Element, toSkip, ancestors)) return

    // Check if any ancestor is a KaTeX block
    if (hasAncestor(parent as Element, isKatex, ancestors)) return

    // Check if any ancestor is already a monospace-arrow span (prevents double wrapping)
    if (hasAncestor(parent as Element, (n) => hasClass(n, "monospace-arrow"), ancestors)) return

    replaceRegex(node as Text, index, parent, arrowRegex, (match: RegExpMatchArray) => {
      return {
        before: "",
        replacedMatch: h("span.monospace-arrow", match[0]),
        after: "",
      }
    })
  })
}

const ordinalSuffixRegex = /(?<![-−])(?<number>[\d,]+)(?<suffix>st|nd|rd|th)/gu
export function formatOrdinalSuffixes(tree: Root): void {
  visitParents(tree, "text", (node, ancestors) => {
    const parent = ancestors[ancestors.length - 1] as Parent
    if (!parent || hasAncestor(parent as Element, toSkip, ancestors)) return

    const index = parent.children.indexOf(node as ElementContent)
    replaceRegex(node, index, parent, ordinalSuffixRegex, (match: RegExpMatchArray) => {
      const numSpan = h("span.ordinal-num", match.groups?.number ?? /* istanbul ignore next */ "")
      const suffixSpan = h(
        "sup.ordinal-suffix",
        match.groups?.suffix ?? /* istanbul ignore next */ "",
      )

      return {
        before: "",
        replacedMatch: [numSpan, suffixSpan],
        after: "",
      }
    })
  })
}

const TEXT_LIKE_TAGS = ["p", "em", "strong", "b"]
const LEFT_QUOTES = ['"', "“", "'", "‘"]

/**
 * Recursively finds the first text node in a tree of HTML elements
 *
 * @param node - The root node to search from
 * @returns The first text node found, or null if no text nodes exist
 *
 * @example
 * // Returns text node with value "Hello"
 * getFirstTextNode(h('div', {}, [h('span', {}, 'Hello')]))
 *
 * // Returns null
 * getFirstTextNode(h('div', {}, []))
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

/**
 * Recursively searches for and identifies the last anchor ('a') element in a node tree.
 *
 * @param node - The element node to search within
 * @returns The last found anchor element, or null if no anchor element is found
 *
 * @example
 * // Returns the <a> element
 * identifyLinkNode(<div><em><a href="#">Link</a></em></div>)
 *
 * // Returns null
 * identifyLinkNode(<div><span>Text</span></div>)
 *
 * // Returns the second <a> element
 * identifyLinkNode(<div><a>First</a><a>Second</a></div>)
 */
export function identifyLinkNode(node: Element): Element | null {
  if (node.tagName === "a") {
    return node
  } else if (node.children && node.children.length > 0) {
    return identifyLinkNode(node.children[node.children.length - 1] as Element)
  }
  return null
}

/**
 * Handles quotation marks that appear before a link by moving them inside the link.
 *
 * @param prevNode - The node before the link
 * @param linkNode - The link node to potentially move quotes into
 * @returns boolean - Whether any quotes were moved
 *
 * @example
 * // Before: '"<a href="#">Link</a>'
 * // After:  '<a href="#">"Link</a>'
 * moveQuotesBeforeLink(prevTextNode, linkNode)
 */
export function moveQuotesBeforeLink(
  prevNode: ElementContent | undefined,
  linkNode: Element,
): boolean {
  // Only process text nodes
  if (!prevNode || prevNode.type !== "text") {
    return false
  }

  const lastChar = prevNode.value.slice(-1)

  // Ensure that last character is a left quote
  if (!LEFT_QUOTES.includes(lastChar)) {
    return false
  }

  // Remove quote from previous node
  prevNode.value = prevNode.value.slice(0, -1)

  // Find or create first text node in link
  const firstChild = linkNode.children[0]
  if (firstChild && firstChild.type === "text") {
    firstChild.value = lastChar + firstChild.value
  } else {
    const newTextNode = { type: "text", value: lastChar }
    linkNode.children.unshift(newTextNode as ElementContent)
  }

  return true
}

/**
 * Moves punctuation inside links and handles quotation marks before links.
 *
 * @param node - The current node being processed
 * @param index - The index of the current node in its parent's children array
 * @param parent - The parent node of the current node
 *
 * This function performs the following steps:
 * 1. Validates input parameters
 * 2. Identifies the link node
 * 3. Handles quotation marks before the link
 * 4. Identifies the text node after the link
 * 5. Moves acceptable punctuation from after the link to inside it
 */
export const rearrangeLinkPunctuation = (
  node: Element,
  index: number | undefined,
  parent: Element,
) => {
  if (index === undefined || !parent) {
    return
  }

  // Identify the link node
  const linkNode = identifyLinkNode(node)
  if (!linkNode) {
    return
  }

  // Skip footnote links
  const href = linkNode.properties?.href
  if (typeof href === "string" && href.startsWith("#user-content-fn-")) {
    return
  }

  moveQuotesBeforeLink(parent.children[index - 1], linkNode)

  // Identify the text node after the link
  const sibling = parent.children[index + 1]
  let textNode

  if (sibling && "type" in sibling) {
    const hasAttrs = "tagName" in sibling && "children" in sibling
    if (sibling.type === "text") {
      textNode = sibling
    } else if (
      hasAttrs &&
      TEXT_LIKE_TAGS.includes(sibling.tagName) &&
      sibling.children.length > 0
    ) {
      textNode = sibling.children[0]
    }
  }

  if (!textNode || !("value" in textNode) || !textNode.value) {
    return
  }

  // Move acceptable punctuation from after the link to inside it
  let firstChar = textNode.value.charAt(0)
  if (linkNode.children[linkNode.children.length - 1]?.type !== "text") {
    linkNode.children.push({ type: "text", value: "" })
  }
  const lastChild = linkNode.children[linkNode.children.length - 1]
  /* istanbul ignore next */
  if (!("value" in lastChild)) {
    return
  }
  while (charsToMoveIntoLinkFromRight.includes(firstChar) && textNode.value.length > 0) {
    lastChild.value = lastChild.value + firstChar
    textNode.value = textNode.value.slice(1) // Remove the first char
    firstChar = textNode.value.charAt(0) // Get the next char
  }
}

export function plusToAmpersand(text: string): string {
  const sourcePattern = "(?<=[a-zA-Z])\\+(?=[a-zA-Z])"
  const result = text.replace(new RegExp(sourcePattern, "g"), " \u0026 ")
  return result
}

// The time regex is used to convert 12:30 PM to 12:30 p.m.
// At the end, watch out for double periods
// Marker-aware: allow optional marker between digit and space, e.g., "15<marker> Am"
const amPmRegex = new RegExp(
  `(?<=\\d(?:${markerChar})? ?)(?<time>[AP])(?:\\.M\\.|M)\\.?`,
  "gi",
)
export function timeTransform(text: string): string {
  const matchFunction = (_: string, ...args: unknown[]) => {
    const groups = args[args.length - 1] as { time: string }
    return `${groups.time.toLowerCase()}.m.`
  }
  return text.replace(amPmRegex, matchFunction)
}

// Site-specific transforms (punctilio handles: !=, multiplication, ellipsis, math symbols, etc.)
const massTransforms: [RegExp | string, string][] = [
  [/\u00A0/gu, " "], // Replace non-breaking spaces
  [/\b(?:i\.i\.d\.|iid)/gi, "IID"],
  [/\b([Ff])rappe\b/g, "$1rappé"],
  [/\b([Ll])atte\b/g, "$1atté"],
  [/\b([Cc])liche\b/g, "$1liché"],
  [/(?<=[Aa]n |[Tt]he )\b([Ee])xpose\b/g, "$1xposé"],
  [/wi-?fi/gi, "Wi-Fi"],
  [/\b([Dd])eja vu\b/g, "$1éjà vu"],
  [/\bgithub\b/gi, "GitHub"],
  [/(?<=\b| )([Vv])oila(?=\b|$)/g, "$1oilà"],
  [/\b([Nn])aive/g, "$1aïve"],
  [/\b([Cc])hateau\b/g, "$1hâteau"],
  [/\b([Dd])ojo/g, "$1ōjō"],
  [/\bregex\b/gi, "RegEx"],
  [/\brelu\b/gi, "RELU"],
  [/\b([Oo])pen-source\b/g, "$1pen source"],
  [/\bmarkdown\b/g, "Markdown"],
  [/e\.g\.,/g, "e.g."],
  [/i\.e\.,/g, "i.e."],
  [/macos/gi, "macOS"],
  [/team shard/gi, "Team Shard"],
  [/Gemini (\w+) (\d(?:\.\d)?)(?!-)/g, "Gemini $2 $1"],
]

export function massTransformText(text: string): string {
  for (const [pattern, replacement] of massTransforms) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "g")
    text = text.replace(regex, replacement)
  }
  return text
}

/**
 * Sets a data-first-letter attribute on the first non-empty paragraph element in the tree.
 *
 * The function:
 * 1. Finds the first non-empty <p> element that is a direct child of the root
 * 2. Sets the data-first-letter attribute to the first character of the paragraph's text content
 * 3. If the second character is an apostrophe, adds a space before it in the text node
 *
 * @param tree - The HAST root node to process
 *
 * @example
 * Input:  <p>First paragraph</p>
 * Output: <p data-first-letter="F">First paragraph</p>
 *
 * @example
 * Input:  <p></p><p>'Twas the night</p>
 * Output: <p></p><p data-first-letter="'">' Twas the night</p>
 *
 * Note: Only processes non-empty paragraphs that are direct children of the root.
 * Empty paragraphs or nested paragraphs are ignored.
 */
export function setFirstLetterAttribute(tree: Root): void {
  // Find the first non-empty paragraph which is a direct child of the tree
  const firstParagraph = tree.children.find(
    (child): child is Element =>
      child.type === "element" && child.tagName === "p" && getTextContent(child).trim().length > 0,
  )

  if (!firstParagraph) {
    return
  }

  const paragraphText = getTextContent(firstParagraph)
  const firstLetter = paragraphText.charAt(0)

  firstParagraph.properties = firstParagraph.properties || /* istanbul ignore next */ {}
  firstParagraph.properties["data-first-letter"] = firstLetter

  // If the second letter is an apostrophe, add a space before it
  const secondLetter = paragraphText.charAt(1)
  if (["'", "’", "‘"].includes(secondLetter)) {
    const firstTextNode = firstParagraph.children.find(
      (child): child is Text => child.type === "text",
    )
    if (firstTextNode) {
      firstTextNode.value = `${firstLetter} ${firstTextNode.value.slice(1)}`
    }
  }
}

export function toSkip(node: Element): boolean {
  if (node.type === "element") {
    const elementNode = node as ElementMaybeWithParent
    const skipTag = ["code", "script", "style", "pre"].includes(elementNode.tagName)
    const skipClass = ["no-formatting", "elvish", "bad-handwriting"].some((cls) =>
      hasClass(elementNode, cls),
    )
    // Skip footnote references - their number text shouldn't be transformed
    const isFootnoteRef = elementNode.properties?.["dataFootnoteRef"] !== undefined

    return skipTag || skipClass || isFootnoteRef
  }
  return false
}

function fractionToSkip(node: Text, _idx: number, parent: Parent, ancestors: Parent[]): boolean {
  return (
    hasAncestor(
      parent as Element,
      (ancestor) =>
        ["code", "pre", "a", "script", "style"].includes(ancestor.tagName) ||
        hasClass(ancestor, "fraction"),
      ancestors,
    ) ||
    (node.value?.includes("/") && urlRegex.test(node.value))
  )
}

export function replaceFractions(
  node: Text,
  index: number | undefined,
  parent: Parent,
  ancestors: Parent[],
): void {
  replaceRegex(
    node,
    index ?? /* istanbul ignore next */ 0,
    parent,
    fractionRegex,
    (match: RegExpMatchArray) => {
      const groups = match.groups as { numerator: string; denominator: string; ordinal?: string }

      const fractionStr = `${groups.numerator}/${groups.denominator}`
      const fractionEl = h("span.fraction", fractionStr)

      if (groups.ordinal) {
        const ordinalEl = h("sup.ordinal-suffix", groups.ordinal)
        return {
          before: "",
          replacedMatch: [fractionEl, ordinalEl],
          after: "",
        }
      } else {
        return {
          before: "",
          replacedMatch: fractionEl,
          after: "",
        }
      }
    },
    (node, idx, parent) => fractionToSkip(node, idx, parent, ancestors),
  )
}
interface Options {
  skipFirstLetter?: boolean // Debug flag
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
 * Main transformer plugin for HTML formatting improvements
 * @param options - Configuration options
 * @returns Unified transformer function
 */
export const improveFormatting = (options: Options = {}): Transformer<Root, Root> => {
  const resolvedOptions: Options = {
    skipFirstLetter: false,
    ...options,
  }

  return (tree: Root) => {
    visitParents(tree, (node, ancestors: Parent[]) => {
      const parent = ancestors[ancestors.length - 1]
      if (!parent) return
      const index = parent.children.indexOf(node as ElementContent)

      const skipFormatting = [node, ...ancestors].some((anc) => toSkip(anc as Element))
      if (skipFormatting) {
        return // NOTE replaceRegex visits children so this won't check that children are not marked
      }

      if (node.type === "text" && "value" in node) {
        replaceFractions(node, index as number, parent as Parent, ancestors)
      }

      rearrangeLinkPunctuation(node as Element, index, parent as Element)

      // NOTE: Will be called multiple times on some elements, like <p> children of a <blockquote>
      const eltsToTransform = collectTransformableElements(node as Element)
      eltsToTransform.forEach((elt) => {
        for (const transform of uncheckedTextTransformers) {
          transformElement(elt, transform, toSkip, false)
        }

        for (const transform of checkedTextTransformers) {
          transformElement(elt, transform, toSkip, true)
        }

        // Don't replace slashes in fractions, but give breathing room
        // to others
        const slashPredicate = (n: Element) => {
          return !hasClass(n, "fraction") && n?.tagName !== "a"
        }
        if (slashPredicate(elt)) {
          transformElement(elt, spacesAroundSlashes, toSkip, true)
        }
      })
    })

    if (!resolvedOptions.skipFirstLetter) {
      setFirstLetterAttribute(tree)
    }

    formatLNumbers(tree) // L_p-norm formatting
    formatArrows(tree)
    wrapUnicodeArrowsWithMonospaceStyle(tree)
    formatOrdinalSuffixes(tree)
    removeSpaceBeforeFootnotes(tree)
  }
}

/**
 * Quartz plugin for HTML formatting improvements
 * Applies typographic enhancements to HTML content
 */
export const HTMLFormattingImprovement: QuartzTransformerPlugin = () => {
  return {
    name: "htmlFormattingImprovement",
    htmlPlugins() {
      return [improveFormatting]
    },
  }
}
