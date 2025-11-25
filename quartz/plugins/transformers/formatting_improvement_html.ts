import type { Element, Text, Root, Parent, ElementContent } from "hast"

import { h } from "hastscript"
import { type Transformer } from "unified"
import { visit } from "unist-util-visit"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import { type QuartzTransformerPlugin } from "../types"
import {
  replaceRegex,
  fractionRegex,
  numberRegex,
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
const chr = markerChar
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
    throw new Error("Transformation altered the number of text nodes")
  }

  textNodes.forEach((n, index) => {
    n.value = transformedFragments[index]
  })

  if (checkTransformInvariance) {
    const strippedContent = markedContent.replace(markerChar, "")
    const strippedTransformed = transformedContent.replace(markerChar, "")
    const expected = transform(strippedContent)
    if (expected !== strippedTransformed) {
      throw new Error(
        `Transform invariance check failed: expected "${expected}" but got "${strippedTransformed}"`,
      )
    }
  }
}

/**
 * Converts standard quotes to typographic smart quotes
 */
export function niceQuotes(text: string): string {
  // Single quotes //
  // Ending comes first so as to not mess with the open quote
  const afterEndingSinglePatterns = '\\s\\.!?;,\\)—\\-\\]"'
  const afterEndingSingle = `(?=${chr}?(?:s${chr}?)?(?:[${afterEndingSinglePatterns}]|$))`
  const endingSingle = `(?<=[^\\s“'])[']${afterEndingSingle}`
  text = text.replace(new RegExp(endingSingle, "gm"), "’")

  // Contractions are sandwiched between two letters
  const contraction = `(?<=[A-Za-z])['’](?=${chr}?[a-zA-Z])`
  text = text.replace(new RegExp(contraction, "gm"), "’")

  // Apostrophes always point down
  //  Whitelist for eg rock 'n' roll
  const apostropheWhitelist = "(?=n’ )"
  const endQuoteNotContraction = `(?!${contraction})’${afterEndingSingle}`
  //  Convert to apostrophe if not followed by an end quote
  const apostropheRegex = new RegExp(
    `(?<=^|[^\\w])'(${apostropheWhitelist}|(?![^‘'\\n]*${endQuoteNotContraction}))`,
    "gm",
  )
  text = text.replace(apostropheRegex, "’")

  // Beginning single quotes
  const beginningSingle = `((?:^|[\\s“"\\-\\(])${chr}?)['](?=${chr}?\\S)`
  text = text.replace(new RegExp(beginningSingle, "gm"), "$1‘")

  // Double quotes //
  const beginningDouble = new RegExp(
    `(?<=^|[\\s\\(\\/\\[\\{\\-—${chr}])(?<beforeChr>${chr}?)["](?<afterChr>(${chr}[ .,])|(?=${chr}?\\.{3}|${chr}?[^\\s\\)\\—,!?${chr};:.\\}]))`,
    "gm",
  )
  text = text.replace(beginningDouble, "$<beforeChr>“$<afterChr>")

  // Open quote after brace (generally in math mode)
  text = text.replace(new RegExp(`(?<=\\{)(${chr}? )?["]`, "g"), "$1“")

  // note: Allowing 2 chrs in a row
  const endingDouble = `([^\\s\\(])["](${chr}?)(?=${chr}|[\\s/\\).,;—:\\-\\}!?s]|$)`
  text = text.replace(new RegExp(endingDouble, "g"), "$1”$2")

  // If end of line, replace with right double quote
  text = text.replace(new RegExp(`["](${chr}?)$`, "g"), "”$1")
  // If single quote has a right double quote after it, replace with right single and then double
  text = text.replace(/'(?=”)/gu, "’")

  // Punctuation //
  // Periods inside quotes
  const periodRegex = new RegExp(`(?<![!?:\\.…])(${chr}?)([’”])(${chr}?)(?!\\.\\.\\.)\\.`, "g")
  text = text.replace(periodRegex, "$1.$2$3")

  // Commas outside of quotes
  const commaRegex = new RegExp(`(?<![!?]),(${chr}?[”’])`, "g")
  text = text.replace(commaRegex, "$1,")

  return text
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
  const slashRegex = /(?<![\d/<])(?<=[\S]) ?\/ ?(?=\S)(?!\/)/g
  text = text.replace(slashRegex, " / ")

  const numberSlashThenNonNumber = /(?<=\d)\/(?=\D)/g
  text = text.replace(numberSlashThenNonNumber, " / ")

  // Restore the h/t occurrences
  return text.replace(new RegExp(h_t_placeholder_char, "g"), "h/t")
}

/**
 * Replaces hyphens with en dashes in number ranges
 *  Number ranges should use en dashes, not hyphens.
 *  Allows for page numbers in the form "p.206-207" or "$100-$200"
 */
export function enDashNumberRange(text: string): string {
  return text.replace(
    new RegExp(
      `\\b(?<![a-zA-Z.])((?:p\\.?|\\$)?\\d[\\d.,]*${chr}?)-(${chr}?\\$?\\d[\\d.,]*)(?!\\.\\d)\\b`,
      "g",
    ),
    "$1–$2",
  )
}

export function removeSpaceBeforeFootnotes(tree: Root): void {
  visit(tree, "element", (node, index, parent) => {
    if (node.tagName === "sup" && index && parent?.children?.[index - 1]?.type === "text") {
      const prevNode = parent.children[index - 1] as Text
      prevNode.value = prevNode.value.replace(/\s+$/, "")
    }
  })
}

/**
 * Replaces various dash types with appropriate alternatives
 * @returns The text with improved dash usage
 */
export function hyphenReplace(text: string) {
  text = minusReplace(text)

  // Handle dashes with potential spaces and optional marker character
  //  Being right after chr is a sufficient condition for being an em
  //  dash, as it indicates the start of a new line
  const preDash = new RegExp(`((?<markerBeforeTwo>${chr}?)[ ]+|(?<markerBeforeThree>${chr}))`)
  // Want eg " - " to be replaced with "—"
  const surroundedDash = new RegExp(
    `(?<=[^\\s>]|^)${preDash.source}[~–—-]+[ ]*(?<markerAfter>${chr}?)([ ]+|$)`,
    "g",
  )

  // Replace surrounded dashes with em dash
  text = text.replace(surroundedDash, "$<markerBeforeTwo>$<markerBeforeThree>—$<markerAfter>")

  // "Since--as you know" should be "Since—as you know"
  const multipleDashInWords = new RegExp(
    `(?<=[A-Za-z\\d])(?<markerBefore>${chr}?)[~–—-]{2,}(?<markerAfter>${chr}?)(?=[A-Za-z\\d ])`,
    "g",
  )
  text = text.replace(multipleDashInWords, "$<markerBefore>—$<markerAfter>")

  // Handle dashes at the start of a line
  text = text.replace(new RegExp(`^(${chr})?[-]+ `, "gm"), "$1— ")

  // Create a regex for spaces around em dashes, allowing for optional spaces around the em dash
  const spacesAroundEM = new RegExp(
    `(?<markerBefore>${chr}?)[ ]*—[ ]*(?<markerAfter>${chr}?)[ ]*`,
    "g",
  )
  // Remove spaces around em dashes
  text = text.replace(spacesAroundEM, "$<markerBefore>—$<markerAfter>")

  // Handle special case after quotation marks
  const postQuote = new RegExp(`(?<quote>[.!?]${chr}?['"’”]${chr}?|…)${spacesAroundEM.source}`, "g")
  text = text.replace(postQuote, "$<quote> $<markerBefore>—$<markerAfter> ")

  // Handle em dashes at the start of a line
  const startOfLine = new RegExp(`^${spacesAroundEM.source}(?<after>[A-Z0-9])`, "gm")
  text = text.replace(startOfLine, "$<markerBefore>—$<markerAfter> $<after>")

  text = enDashNumberRange(text)
  text = enDashDateRange(text)

  return text
}

const minusRegex = new RegExp(`(^|[\\s\\(${chr}"“])-(\\s?\\d*\\.?\\d+)`, "gm")
/**
 * Replaces hyphens with minus signs in numerical contexts
 */
export function minusReplace(text: string): string {
  return text.replaceAll(minusRegex, "$1−$2")
}

export const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
].join("|")

/**
 * Replaces hyphens with en dashes in month ranges
 * Handles abbreviated and full month names. Included in hyphenReplace()
 * @returns The text with en dashes in month ranges
 */
export function enDashDateRange(text: string): string {
  return text.replace(new RegExp(`\\b(${months}${chr}?)-(${chr}?(?:${months}))\\b`, "g"), "$1–$2")
}

// These lists are automatically added to both applyTextTransforms and the main HTML transforms
// Don't check for invariance
const uncheckedTextTransformers = [hyphenReplace, niceQuotes]

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
  visit(tree, "text", (node, index, parent) => {
    if (!parent || hasAncestor(parent as ElementMaybeWithParent, isCode)) {
      return
    }

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

    if (newNodes.length > 0 && parent && typeof index === "number") {
      parent.children.splice(index, 1, ...newNodes)
    }
  })
}

export function formatArrows(tree: Root): void {
  visit(tree, "text", (node, index, parent) => {
    if (!parent || hasAncestor(parent as ElementMaybeWithParent, toSkip)) return

    replaceRegex(
      node,
      index ?? /* istanbul ignore next */ 0,
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

const ordinalSuffixRegex = /(?<![-−])(?<number>[\d,]+)(?<suffix>st|nd|rd|th)/gu
export function formatOrdinalSuffixes(tree: Root): void {
  visit(tree, "text", (node, index, parent) => {
    if (!parent || hasAncestor(parent as ElementMaybeWithParent, toSkip)) return

    replaceRegex(
      node,
      index ?? /* istanbul ignore next */ 0,
      parent,
      ordinalSuffixRegex,
      (match: RegExpMatchArray) => {
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
      },
    )
  })
}

export const CHARS_TO_MOVE_INTO_LINK_FROM_RIGHT = [
  ".",
  ",",
  "!",
  "?",
  ";",
  ":",
  "`",
  "”",
  '"',
  "'",
  "’",
  "s",
]
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
  while (CHARS_TO_MOVE_INTO_LINK_FROM_RIGHT.includes(firstChar) && textNode.value.length > 0) {
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
//  At the end, watch out for double periods
const amPmRegex = /(?<=\d ?)(?<time>[AP])(?:\.M\.|M)\.?/gi
export function timeTransform(text: string): string {
  const matchFunction = (_: string, ...args: unknown[]) => {
    const groups = args[args.length - 1] as { time: string }
    return `${groups.time.toLowerCase()}.m.`
  }
  return text.replace(amPmRegex, matchFunction)
}

const massTransforms: [RegExp | string, string][] = [
  [/\u00A0/gu, " "], // Replace non-breaking spaces
  [/!=/g, "≠"],
  [/\b(?:i\.i\.d\.|iid)/gi, "IID"],
  [/\b([Ff])rappe\b/g, "$1rappé"],
  [/\b([Ll])atte\b/g, "$1atté"],
  [/\b([Cc])liche\b/g, "$1liché"],
  [/(?<=[Aa]n |[Tt]he )\b([Ee])xpose\b/g, "$1xposé"],
  [/wi-?fi/gi, "Wi-Fi"], // "wi-fi" to "Wi-Fi"
  [/\b([Dd])eja vu\b/g, "$1éjà vu"],
  [/\bgithub\b/gi, "GitHub"],
  [/(?<=\b| )([Vv])oila(?=\b|$)/g, "$1oilà"],
  [/\b([Nn])aive/g, "$1aïve"],
  [/\b([Cc])hateau\b/g, "$1hâteau"],
  [/\b([Dd])ojo/g, "$1ōjō"],
  [/\bregex\b/gi, "RegEx"],
  [/\brelu\b/gi, "RELU"],
  [`(${numberRegex.source})[x\\*]\\b`, "$1×"], // Pretty multiplier
  [/\b(\d+ ?)x( ?\d+)\b/g, "$1×$2"], // Multiplication sign
  [/\.{3}/g, "…"], // Ellipsis
  [/…(?=\w)/gu, "… "], // Space after ellipsis
  [/\b([Oo])pen-source\b/g, "$1pen source"],
  [/\bmarkdown\b/g, "Markdown"],
]

export function massTransformText(text: string): string {
  for (const [pattern, replacement] of massTransforms) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "g")
    text = text.replace(regex, replacement)
  }
  return text
}

/**
 * Plugin options for formatting improvements
 */
export function setFirstLetterAttribute(tree: Root): void {
  // Find the first paragraph in the article
  const firstParagraph = tree.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "p",
  )

  if (!firstParagraph) {
    return
  }

  const firstLetter = getTextContent(firstParagraph).charAt(0)
  firstParagraph.properties = firstParagraph.properties || /* istanbul ignore next */ {}
  firstParagraph.properties["data-first-letter"] = firstLetter

  // If the second letter is an apostrophe, add a space before it
  const secondLetter = getTextContent(firstParagraph).charAt(1)
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

    return skipTag || skipClass
  }
  return false
}

function fractionToSkip(node: Text, _idx: number, parent: Parent): boolean {
  return (
    hasAncestor(
      parent as ElementMaybeWithParent,
      (ancestor) =>
        ["code", "pre", "a", "script", "style"].includes(ancestor.tagName) ||
        hasClass(ancestor, "fraction"),
    ) ||
    (node.value?.includes("/") && urlRegex.test(node.value))
  )
}

export function replaceFractions(node: Text, index: number | undefined, parent: Parent): void {
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
    fractionToSkip,
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
        replaceFractions(node, index as number, parent as Parent)
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

    // If skipFirstLetter is not set, or it's set but false, set the attribute
    if (!("skipFirstLetter" in options) || !options.skipFirstLetter) {
      setFirstLetterAttribute(tree)
    }

    formatLNumbers(tree) // L_p-norm formatting
    formatArrows(tree)
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
