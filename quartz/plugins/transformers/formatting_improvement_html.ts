import type { Element, Text, Root, Parent, ElementContent } from "hast"

import { h } from "hastscript"
import { niceQuotes, hyphenReplace, symbolTransform, primeMarks, nbspTransform } from "punctilio"
import {
  getTextContent,
  transformElement,
  collectTransformableElements,
  type TextNodeSkipPredicate,
} from "punctilio/rehype"
import { type Transformer } from "unified"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import type { ElementMaybeWithParent } from "./utils"

import {
  charsToMoveIntoLinkFromRight,
  markerChar,
  hatTipPlaceholder,
  NBSP,
  LEFT_SINGLE_QUOTE,
  RIGHT_SINGLE_QUOTE,
  HEADING_TAGS,
  STRIP_BOUNDARY_TAGS,
} from "../../components/constants"
import { type QuartzTransformerPlugin } from "../types"
import { replaceRegex, fractionRegex, hasClass, hasAncestor, urlRegex, isCode } from "./utils"

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
    const isFootnoteRef = elementNode.properties?.["dataFootnoteRef"] !== undefined

    return skipTag || skipClass || isFootnoteRef
  }
  return false
}

/**
 * Skip typography transforms on anchor text that equals its href, so URL-like
 * link text (e.g. `<a href="https://x/y">https://x/y</a>`) is not mangled by
 * slash spacing, hyphen rewrites, etc.
 */
export const shouldSkipLinkUrlText: TextNodeSkipPredicate = (textNode, ancestors) => {
  const parent = ancestors[ancestors.length - 1]
  if (parent?.tagName !== "a") return false
  const href = parent.properties?.href
  return typeof href === "string" && href === textNode.value
}

/**
 * @module HTMLFormattingImprovement
 * A plugin that improves text formatting in HTML content by applying various typographic enhancements
 */

/**
 * Marker-aware word boundary patterns.
 * Regular \b matches at word/non-word transitions, but markers (non-word chars)
 * can create false boundaries between text that should be connected.
 *
 * Example: "xReLU" has no word boundary before 'R', but "x\uF000ReLU" (with marker)
 * would have a false boundary. These patterns reject boundaries caused by markers.
 *
 * A "false" start boundary: word_char + marker(s) + word_char (markers between word chars)
 * A "false" end boundary: word_char + marker(s) + word_char (same pattern)
 *
 * wb: word boundary, reject if preceded by (word char + markers)
 * wbe: word boundary, reject if followed by (markers + word char)
 */
// Start of word: word boundary, not preceded by word+marker(s) pattern
const wb = `(?<!\\w${markerChar}*)\\b`
// End of word: word boundary, not followed by marker(s)+word pattern
const wbe = `\\b(?!${markerChar}*\\w)`

// Rejects digit-before-slash to leave fractions alone. Lookahead skips
// markers and treats NBSP as real content so it anchors past an NBSP that
// earlier transforms (e.g. nbspBeforeLastWord) inserted at a paragraph edge.
const slashRegex = new RegExp(
  `(?<![\\d/<])(?<=[\\S])(?<spaceBefore> ?)(?<markerBefore>${markerChar})?/(?<markerAfter>${markerChar})?(?<spaceAfter> ?)(?=${markerChar}*[^ \\t\\n\\r\\f\\v${markerChar}])(?!/)`,
  "gu",
)

const htPlaceholderRegex = new RegExp(hatTipPlaceholder, "g")

/**
 * Space out slashes in text
 * @returns The text with slashes spaced out
 */
export function spacesAroundSlashes(text: string): string {
  // First replace h/t with the placeholder character (hatTipPlaceholder imported from constants)
  text = text.replace(/\b(?:h\/t)\b/g, hatTipPlaceholder)

  text = text.replace(slashRegex, (...args) => {
    const groups = args.at(-1) as {
      spaceBefore: string
      markerBefore: string | undefined
      markerAfter: string | undefined
      spaceAfter: string
    }
    const { spaceBefore: leftSpace, spaceAfter: rightSpace } = groups
    const leftMarker = groups.markerBefore ?? ""
    const rightMarker = groups.markerAfter ?? ""
    // Decide each side independently. A captured space sitting OUTSIDE a
    // marker (e.g. " <SEP>/" or "/<SEP> ") lives in a sibling text node, not
    // the slash's own node — keep it outside and glue an NBSP to "/" instead.
    // With no marker on a side, the space is in the same text node as the
    // slash, so absorb it (preserves marker invariance with empty inline
    // elements there).
    const outerLeft = leftMarker ? leftSpace : ""
    const padLeft = leftMarker ? NBSP : leftSpace || NBSP
    const outerRight = rightMarker ? rightSpace : ""
    const padRight = rightMarker ? NBSP : rightSpace || NBSP
    return `${outerLeft}${leftMarker}${padLeft}/${padRight}${rightMarker}${outerRight}`
  })

  const numberSlashThenNonNumber = /(?<=\d)\/(?=\D)/g
  text = text.replace(numberSlashThenNonNumber, `${NBSP}/${NBSP}`)

  // Restore the h/t occurrences
  return text.replace(htPlaceholderRegex, "h/t")
}

/**
 * Strip whitespace adjacent to the inside boundary of an inline element.
 *
 * Covers two visual categories — text styling (`<em>`, `<strong>`, `<i>`,
 * `<b>`) and visually-bound rendering where an underline / strikethrough /
 * background extends across the whole element (`<a>`, `<u>`, `<ins>`,
 * `<mark>`, `<del>`, `<s>`). Both get both sides stripped: markdown won't
 * normally produce trailing whitespace inside emphasis (the closing delimiter
 * rejects it), so any trailing whitespace we see is either raw HTML or a
 * transformer accident and is safe to clean.
 *
 * The tag list is shared with the built-site check via
 * `config/constants.json:stripBoundaryWhitespaceTags`.
 */
export function stripInlineBoundaryWhitespace(tree: Root): void {
  visitParents(tree, "element", (node) => {
    if (!STRIP_BOUNDARY_TAGS.has(node.tagName)) return
    trimTextChild(node, "leading")
    trimTextChild(node, "trailing")
  })
}

function trimTextChild(node: Element, side: "leading" | "trailing"): void {
  const idx = side === "leading" ? 0 : node.children.length - 1
  const child = node.children[idx]
  if (child?.type !== "text") return
  const trimmed =
    side === "leading" ? child.value.replace(/^\s+/, "") : child.value.replace(/\s+$/, "")
  if (trimmed === child.value) return
  if (trimmed === "") {
    node.children.splice(idx, 1)
    return
  }
  child.value = trimmed
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

// Named wrapper for nbsp transform so it can be explicitly filtered when needed
const nbspTransformWrapper = (text: string) => nbspTransform(text, { separator: markerChar })

// These lists are automatically added to both applyTextTransforms and the main HTML transforms
// Don't check for invariance: these transforms accept a `separator` and intentionally
// use it to respect element boundaries (e.g., niceQuotes won't pair quotes across elements).
// Because they behave differently with vs. without markers, the invariance property
// transform(text_with_markers) == transform(text_without_markers) does not hold.
const uncheckedTextTransformers = [
  (text: string) => hyphenReplace(text, { separator: markerChar }),
  // Prime marks must run before niceQuotes to convert 5'10" → 5′10″ before quote processing
  (text: string) => primeMarks(text, { separator: markerChar }),
  (text: string) => niceQuotes(text, { separator: markerChar }),
  // Ellipsis, multiplication, math, legal symbols (arrows disabled - site uses custom formatArrows)
  (text: string) => symbolTransform(text, { separator: markerChar, includeArrows: false }),
  // Non-breaking spaces: prevents orphans, keeps numbers with units, etc.
  nbspTransformWrapper,
]

// Check for invariance: these are simple find-and-replace transforms that never interact
// with the marker character, so we verify they produce identical results with or without markers.
const checkedTextTransformers = [massTransformText, plusToAmpersand, timeTransform]

/**
 * Applies multiple text transformations
 *
 * @param text - The text to transform
 * @param options - Configuration options
 * @param options.useNbsp - Whether to apply nbsp transformations (default: true)
 * @returns The transformed text
 */
export function applyTextTransforms(text: string, options: { useNbsp?: boolean } = {}): string {
  const { useNbsp = true } = options

  // Filter out nbspTransform if useNbsp is false
  const textTransformers = useNbsp
    ? uncheckedTextTransformers
    : uncheckedTextTransformers.filter((t) => t !== nbspTransformWrapper)

  for (const transformer of [
    ...checkedTextTransformers,
    ...textTransformers,
    spacesAroundSlashes,
  ]) {
    text = transformer(text)
  }

  return text
}

export const l_pRegex = /(?<prefix>\s|^)L(?<number>\d+)\b(?!\.)/g
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
        newNodes.push({
          type: "text",
          value: node.value.slice(lastIndex, match.index),
        })
      }

      // The regex guarantees these named groups always exist
      const { prefix, number } = match.groups as {
        prefix: string
        number: string
      }

      // Add the space/start of line
      newNodes.push({ type: "text", value: prefix })

      // Add "L" text
      newNodes.push({ type: "text", value: "L" })

      // Add subscript number
      newNodes.push({
        type: "element",
        tagName: "sub",
        properties: { style: "font-variant-numeric: lining-nums;" },
        children: [{ type: "text", value: number }],
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
      // Consume optional surrounding spaces so they can be replaced with NBSP
      /(?:(?:^|(?<= )|(?<=\w)) ?)[-]{1,2}> ?(?=[\w ]|$)/g,
      (match: RegExpMatchArray) => {
        const fullMatch = match[0] ?? /* istanbul ignore next */ ""
        const matchIndex = match.index ?? /* istanbul ignore next */ 0

        const consumedLeadingSpace = fullMatch.startsWith(" ")
        const consumedTrailingSpace = fullMatch.endsWith(" ")

        const beforeChar =
          matchIndex > 0
            ? (match.input?.charAt(matchIndex - 1) ?? /* istanbul ignore next */ "")
            : ""
        const afterIndex = matchIndex + fullMatch.length
        const afterChar = match.input?.charAt(afterIndex) ?? /* istanbul ignore next */ ""

        const needsNbspBefore = consumedLeadingSpace || /\w/.test(beforeChar)
        const needsNbspAfter = consumedTrailingSpace || /\w/.test(afterChar)

        return {
          before: needsNbspBefore ? NBSP : "",
          replacedMatch: "⭢",
          after: needsNbspAfter ? NBSP : "",
        }
      },
      () => false,
      "span.right-arrow",
    )
  })
}

function isHeading(node: Element): boolean {
  return HEADING_TAGS.has(node.tagName)
}

// Display-heading elements: text that's styled like a heading and wraps
// in a tight, balanced way. NBSP widow-prevention here creates brittle
// titles (especially paper titles in subtitles, which often contain
// short conjunctions like "by"/"an"/"of").
function isDisplayHeading(node: Element): boolean {
  return (
    isHeading(node) ||
    (node.tagName === "p" && hasClass(node, "subtitle")) ||
    hasClass(node, "admonition-title")
  )
}

// skipcq: JS-0098
function isKatex(node: Element): boolean {
  return hasClass(node, "katex")
}

export const arrowsToWrap = ["←", "→", "↑", "↓", "↗", "↘", "↖", "↙"]
const arrowRegex = new RegExp(` ?(?<arrow>${arrowsToWrap.join("|")}) ?`, "g")

/**
 * Wraps Unicode arrows with monospace styling, but only outside of KaTeX math blocks
 */
export function wrapUnicodeArrowsWithMonospaceStyle(tree: Root): void {
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
      const fullMatch = match[0] ?? /* istanbul ignore next */ ""
      const matchIndex = match.index ?? /* istanbul ignore next */ 0
      const arrow = match.groups?.arrow ?? /* istanbul ignore next */ fullMatch.trim()

      const consumedLeadingSpace = fullMatch.startsWith(" ")
      const consumedTrailingSpace = fullMatch.endsWith(" ")

      const beforeChar =
        matchIndex > 0 ? (match.input?.charAt(matchIndex - 1) ?? /* istanbul ignore next */ "") : ""
      const afterIndex = matchIndex + fullMatch.length
      const afterChar = match.input?.charAt(afterIndex) ?? /* istanbul ignore next */ ""

      const needsNbspBefore = consumedLeadingSpace || /\w/.test(beforeChar)
      const needsNbspAfter = consumedTrailingSpace || /\w/.test(afterChar)

      return {
        before: needsNbspBefore ? NBSP : "",
        replacedMatch: h("span.monospace-arrow", arrow),
        after: needsNbspAfter ? NBSP : "",
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
    const lastChild = node.children[node.children.length - 1]
    if (lastChild.type === "element") {
      return identifyLinkNode(lastChild)
    }
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

const afterAbbrevPattern = `\\.?(?<abbrevMarker>${markerChar})?(?:,(?<commaMarker>${markerChar})?)?(?=${wbe}|\\s|${markerChar}|$)`
const egRegex = new RegExp(`${wb}e\\.?g${afterAbbrevPattern}`, "gi")
const ieRegex = new RegExp(`${wb}i\\.?e${afterAbbrevPattern}`, "gi")

/**
 * Normalizes "e.g." and "i.e." abbreviations to standard format.
 * Captures any markers after the abbreviation and trailing comma, preserving them in the output.
 */
export function normalizeAbbreviations(text: string): string {
  text = text.replace(egRegex, "e.g.$<abbrevMarker>$<commaMarker>")
  text = text.replace(ieRegex, "i.e.$<abbrevMarker>$<commaMarker>")

  return text
}

const plusToAmpersandRegex = new RegExp(
  "(?<!\\b(?:ctrl|alt|option|cmd|command|fn))(?<=\\p{L})\\+(?=[A-Za-z])",
  "giu",
)

export function plusToAmpersand(text: string): string {
  return text.replace(plusToAmpersandRegex, `${NBSP}&${NBSP}`)
}

// The time regex is used to convert 12:30 PM to 12:30 p.m.
// At the end, watch out for double periods
// Marker-aware: allow optional marker between digit and space, e.g., "15<marker> Am"
const amPmRegex = new RegExp(
  `(?<=\\d(?:${markerChar})? ?)(?<time>[AP])(?:\\.M\\.|M)\\.?(?!\\p{L})`,
  "giu",
)
export function timeTransform(text: string): string {
  const matchFunction = (_: string, ...args: unknown[]) => {
    const groups = args[args.length - 1] as { time: string }
    return `${groups.time.toLowerCase()}.m.`
  }
  return text.replace(amPmRegex, matchFunction)
}

// Site-specific transforms (punctilio handles: !=, multiplication, ellipsis, math symbols, etc.)
// Use marker-aware word boundaries (wb/wbe) to prevent markers from creating false word boundaries
const massTransforms: [RegExp, string][] = [
  [new RegExp(`${wb}(?:i\\.i\\.d\\.|iid)`, "gi"), "IID"],
  [new RegExp(`${wb}(?<letter>[Ff])rappe${wbe}`, "g"), "$<letter>rappé"],
  [new RegExp(`${wb}(?<letter>[Ll])atte${wbe}`, "g"), "$<letter>atté"],
  [new RegExp(`${wb}(?<letter>[Cc])liche${wbe}`, "g"), "$<letter>liché"],
  [new RegExp(`(?<=[Aa]n |[Tt]he )${wb}(?<letter>[Ee])xpose${wbe}`, "g"), "$<letter>xposé"],
  [/wi-?fi/gi, "Wi-Fi"],
  [new RegExp(`${wb}(?<letter>[Dd])eja vu${wbe}`, "g"), "$<letter>éjà vu"],
  [new RegExp(`${wb}github${wbe}`, "gi"), "GitHub"],
  [new RegExp(`(?<=${wb}| )(?<letter>[Vv])oila(?=${wbe}|$)`, "g"), "$<letter>oilà"],
  [new RegExp(`${wb}(?<letter>[Nn])aive`, "g"), "$<letter>aïve"],
  [new RegExp(`${wb}(?<letter>[Cc])hateau${wbe}`, "g"), "$<letter>hâteau"],
  [new RegExp(`${wb}(?<letter>[Dd])ojo`, "g"), "$<letter>ōjō"],
  [new RegExp(`${wb}regex(?<plural>e?s)?${wbe}`, "gi"), "RegEx$<plural>"],
  [new RegExp(`${wb}relu${wbe}`, "gi"), "RELU"],
  [new RegExp(`${wb}(?<letter>[Oo])pen-source${wbe}`, "g"), "$<letter>pen source"],
  [new RegExp(`${wb}markdown${wbe}`, "g"), "Markdown"],
  [/macos/gi, "macOS"],
  [/team shard/gi, "Team Shard"],
  [/Gemini (?<model>\w+) (?<version>\d(?:\.\d)?)(?!-)/g, "Gemini $<version> $<model>"],
  // Model naming standardization
  [new RegExp(`${wb}LLAMA(?=-\\d)`, "g"), "Llama"], // LLAMA-2 → Llama-2
  [new RegExp(`${wb}GPT-4-o${wbe}`, "gi"), "GPT-4o"], // GPT-4-o → GPT-4o
  [new RegExp(`${wb}bibtex${wbe}`, "gi"), "BibTeX"], // Normalize BibTeX capitalization
]

export function massTransformText(text: string): string {
  for (const [regex, replacement] of massTransforms) {
    text = text.replace(regex, replacement)
  }
  text = normalizeAbbreviations(text)
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

  const firstTextNode = firstParagraph.children.find(
    (child): child is Text => child.type === "text",
  )
  if (!firstTextNode) return

  // Replace nbsp after first letter — nbspTransform adds it after single-letter
  // words like "I", but it creates a visible extra space with dropcap float
  if (firstTextNode.value.charAt(1) === NBSP) {
    firstTextNode.value = `${firstTextNode.value.charAt(0)} ${firstTextNode.value.slice(2)}`
  }

  // If the second letter is an apostrophe, add a space before it
  const secondLetter = paragraphText.charAt(1)
  if (["’", LEFT_SINGLE_QUOTE, RIGHT_SINGLE_QUOTE].includes(secondLetter)) {
    firstTextNode.value = `${firstLetter} ${firstTextNode.value.slice(1)}`
  }
}

function fractionToSkip(node: Text, _idx: number, parent: Parent, ancestors: Parent[]): boolean {
  return (
    hasAncestor(
      parent as Element,
      (ancestor) =>
        (FRACTION_SKIP_TAGS as readonly string[]).includes(ancestor.tagName) ||
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
      const groups = match.groups as {
        numerator: string
        denominator: string
        ordinal?: string
      }

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
interface ImproveFormattingOptions {
  skipFirstLetter?: boolean // Debug flag
}

/**
 * Main transformer plugin for HTML formatting improvements
 * @param options - Configuration options
 * @returns Unified transformer function
 */
export const improveFormatting = (
  options: ImproveFormattingOptions = {},
): Transformer<Root, Root> => {
  const resolvedOptions: ImproveFormattingOptions = {
    skipFirstLetter: false,
    ...options,
  }

  return (tree: Root) => {
    visitParents(tree, (node, ancestors: Parent[]) => {
      const parent = ancestors[ancestors.length - 1]
      if (!parent) return

      const skipFormatting = [node, ...ancestors].some((ancestor) =>
        toSkip(ancestor as Element),
      )
      if (skipFormatting) {
        return // NOTE replaceRegex visits children so this won't check that children are not marked
      }

      const nodeIndexAmongChildren = parent.children.indexOf(node as ElementContent)
      if (node.type === "text" && "value" in node) {
        replaceFractions(node, nodeIndexAmongChildren as number, parent as Parent, ancestors)
      }

      rearrangeLinkPunctuation(node as Element, nodeIndexAmongChildren, parent as Element)

      // NOTE: Will be called multiple times on some elements, like <p> children of a <blockquote>
      if (node.type !== "element") {
        return
      }

      // Skip nbsp in headings, subtitles, and admonition titles — it prevents
      // natural line-breaking and looks bad
      const inDisplayHeading =
        isDisplayHeading(node as Element) ||
        hasAncestor(node as Element, isDisplayHeading, ancestors)
      const activeUncheckedTransformers = inDisplayHeading
        ? uncheckedTextTransformers.filter((t) => t !== nbspTransformWrapper)
        : uncheckedTextTransformers

      const eltsToTransform = collectTransformableElements(node as Element, toSkip)
      eltsToTransform.forEach((elt) => {
        for (const transform of checkedTextTransformers) {
          transformElement(elt, transform, toSkip, markerChar, true)
        }

        for (const transform of activeUncheckedTransformers) {
          transformElement(elt, transform, toSkip, markerChar, false)
        }

        // Don't replace slashes in fractions, but give breathing room
        // to others
        const isNotFractionOrLink = (n: Element) => {
          return !hasClass(n, "fraction") && n?.tagName !== "a"
        }
        if (isNotFractionOrLink(elt)) {
          // checkInvariance=false: spacesAroundSlashes is intentionally
          // marker-aware. When "/" is alone in its own text node between two
          // markers (e.g. <code>A</code>/<code>B</code>), it preserves the
          // surrounding text nodes' boundary spaces and glues NBSPs to "/",
          // rather than absorbing the spaces into the slash's node. The
          // stripped-vs-marked invariance does not hold in that case by design.
          transformElement(elt, spacesAroundSlashes, toSkip, markerChar, false, {
            shouldSkipText: shouldSkipLinkUrlText,
          })
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

/**
 * Quartz plugin running ``stripInlineBoundaryWhitespace`` as a late pass.
 *
 * Separated from ``HTMLFormattingImprovement`` so it can run *after*
 * downstream plugins (``AddFavicons`` in particular) that rewrite link
 * content and can reintroduce leading whitespace inside an ``<a>``.
 */
export const StripInlineBoundaryWhitespace: QuartzTransformerPlugin = () => {
  return {
    name: "stripInlineBoundaryWhitespace",
    htmlPlugins() {
      return [() => stripInlineBoundaryWhitespace]
    },
  }
}
