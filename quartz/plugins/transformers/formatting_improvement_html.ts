import type { Element, ElementContent, Parent, Root, Text } from "hast"

import { h } from "hastscript"
import {
  definePass,
  hyphenReplace,
  nbspTransform,
  niceQuotes,
  type ProsePass,
  type ProseView,
  symbolTransform,
  withProseView,
} from "punctilio"
import {
  applyPasses,
  collectProseBlocks,
  getTextContent,
  type PassEntry,
  type TextNodeSkipPredicate,
} from "punctilio/rehype"
import { type Transformer } from "unified"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import type { ElementMaybeWithParent } from "./utils"

import {
  charsToMoveIntoLinkFromRight,
  LEFT_SINGLE_QUOTE,
  NBSP,
  RIGHT_SINGLE_QUOTE,
  STRIP_BOUNDARY_TAGS,
  WORD_JOINER,
} from "../../components/constants"
import { type QuartzTransformerPlugin } from "../types"
import { isHeading } from "./favicons"
import {
  fractionRegex,
  hasAncestor,
  hasClass,
  isCode,
  replaceRegex,
  urlRegexNonGlobal,
} from "./utils"

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

/**
 * Elements whose text is a literal value rather than prose (form-control
 * labels, document metadata). Their text gets no typography transforms.
 */
export const NON_PROSE_TAGS: ReadonlySet<string> = new Set(["title", "button", "option", "output"])

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

// Spacing characters around a slash that the slash rules may absorb or pad.
// NBSP is deliberately absent: an NBSP next to a slash is real content, so it
// anchors the lookahead (and blocks re-padding an already-padded slash).
const SLASH_PLAIN_SPACES = new Set([" ", "\t", "\n", "\r", "\f", "\v"])

function isPlainDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9"
}

/**
 * The slash must be preceded by visible content: a non-space character that
 * is not a digit (leave fractions alone), "/", or "<". An element boundary
 * immediately before `start` counts as content, whatever sits on its far side.
 */
function passesLeftSlashGuard(view: ProseView, start: number): boolean {
  if (view.hasBoundary(start)) {
    return true
  }
  if (start === 0) {
    return false
  }
  const prev = view.text[start - 1]
  return /\S/.test(prev) && !/[\d/<]/.test(prev)
}

/**
 * "h/t" is kept verbatim. The h and t must sit in the same text node as the
 * slash; a boundary on either flank of "h/t" acts as a word boundary.
 */
function isHatTipSlash(view: ProseView, slashIdx: number): boolean {
  const text = view.text
  if (text[slashIdx - 1] !== "h" || text[slashIdx + 1] !== "t") {
    return false
  }
  if (view.hasBoundary(slashIdx) || view.hasBoundary(slashIdx + 1)) {
    return false
  }
  const hIdx = slashIdx - 1
  const afterTIdx = slashIdx + 2
  const wordBeforeH = hIdx > 0 && !view.hasBoundary(hIdx) && /\w/.test(text[hIdx - 1])
  const wordAfterT =
    afterTIdx < text.length && !view.hasBoundary(afterTIdx) && /\w/.test(text[afterTIdx])
  return !wordBeforeH && !wordAfterT
}

/**
 * Pad one slash with NBSPs so it gets breathing room without allowing a line
 * break at it. Each side is decided independently:
 *
 * - a plain space already next to the slash is kept as-is;
 * - at an element boundary, the neighboring node's text (including any space
 *   it carries) is left untouched and an NBSP is glued onto the slash's side
 *   of the boundary instead — empty inline elements must never swallow the
 *   slash or its padding;
 * - otherwise an NBSP is inserted directly against the slash.
 *
 * Returns true when the slash matched (even if both sides kept their spaces),
 * so the digit-slash rule doesn't double-process it.
 */
function applyMainSlashRule(
  view: ProseView,
  slashIdx: number,
  insertNbsp: (offset: number, bind?: "left" | "right") => void,
): boolean {
  const text = view.text
  const leftBoundary = view.hasBoundary(slashIdx)
  const spaceBefore = !leftBoundary && text[slashIdx - 1] === " "
  const guardOk =
    leftBoundary ||
    (spaceBefore ? passesLeftSlashGuard(view, slashIdx - 1) : passesLeftSlashGuard(view, slashIdx))
  if (!guardOk) {
    return false
  }

  const afterIdx = slashIdx + 1
  const rightBoundary = view.hasBoundary(afterIdx)
  const spaceAfter = text[afterIdx] === " "
  const lookIdx = afterIdx + (spaceAfter ? 1 : 0)
  const lookChar = text[lookIdx]
  // The slash needs following content (at most one plain space away), and
  // must not start a "//" run unless a boundary separates the two slashes.
  if (lookChar === undefined || SLASH_PLAIN_SPACES.has(lookChar)) {
    return false
  }
  if (lookChar === "/" && !view.hasBoundary(lookIdx)) {
    return false
  }

  if (leftBoundary) {
    insertNbsp(slashIdx, "right")
  } else if (!spaceBefore) {
    insertNbsp(slashIdx)
  }
  if (rightBoundary) {
    insertNbsp(afterIdx, "left")
  } else if (!spaceAfter) {
    insertNbsp(afterIdx)
  }
  return true
}

/**
 * A digit directly before a slash (same text node) followed by a non-digit
 * gets NBSP padding: "3/month" → "3 / month". End-of-prose and an element
 * boundary after the slash both count as non-digit context.
 */
function applyNumberSlashRule(view: ProseView, slashIdx: number): void {
  if (view.hasBoundary(slashIdx) || !isPlainDigit(view.text[slashIdx - 1])) {
    return
  }
  const afterIdx = slashIdx + 1
  const nonNumberAfter =
    afterIdx === view.text.length ||
    view.hasBoundary(afterIdx) ||
    !isPlainDigit(view.text[afterIdx])
  if (!nonNumberAfter) {
    return
  }
  view.replace(slashIdx, afterIdx, `${NBSP}/${NBSP}`)
}

function applySlashSpacing(view: ProseView): void {
  const text = view.text
  // Two adjacent slashes separated only by an inline-element boundary make the
  // first slash's trailing NBSP and the second slash's leading NBSP target the
  // same offset. A single NBSP there is the intended spacing, and punctilio
  // rejects two pure insertions at one offset — so collapse the duplicate.
  const insertedAt = new Set<number>()
  const insertNbsp = (offset: number, bind?: "left" | "right"): void => {
    if (insertedAt.has(offset)) {
      return
    }
    insertedAt.add(offset)
    view.replace(offset, offset, NBSP, bind ? { bind } : undefined)
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "/" || isHatTipSlash(view, i)) {
      continue
    }
    if (!applyMainSlashRule(view, i, insertNbsp)) {
      applyNumberSlashRule(view, i)
    }
  }
}

/**
 * Space out slashes so "dog/cat" reads "dog / cat" (with non-breaking
 * spaces). Dual-input pass: string in → string out; ProseView in → edits
 * committed in place.
 */
export function spacesAroundSlashes(input: string): string
export function spacesAroundSlashes(input: ProseView): void
export function spacesAroundSlashes(input: string | ProseView): string | void {
  if (typeof input === "string") {
    return withProseView(input, applySlashSpacing)
  }
  applySlashSpacing(input)
  input.commit()
  return undefined
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

// Ellipsis, multiplication, math, legal symbols (arrows disabled - site uses custom formatArrows)
function symbolTransformNoArrows(input: string): string
function symbolTransformNoArrows(input: ProseView): void
function symbolTransformNoArrows(input: string | ProseView): string | void {
  if (typeof input === "string") {
    return symbolTransform(input, { includeArrows: false })
  }
  symbolTransform(input, { includeArrows: false })
  return undefined
}

// These lists are automatically added to both applyTextTransforms and the main HTML transforms.
// Each entry is a boundary-aware ProsePass: string in → string out, ProseView in → edits
// committed in place (e.g., niceQuotes won't pair quotes across element boundaries).
const uncheckedTextTransformers: readonly ProsePass[] = [
  hyphenReplace,
  // niceQuotes converts primes first (5'10" → 5′10″) before quote processing
  niceQuotes,
  symbolTransformNoArrows,
  // Non-breaking spaces: prevents orphans, keeps numbers with units, etc.
  nbspTransform,
]

// Glue a word joiner before em/en dashes so they can never be the first glyph
// on a wrapped line. Boundary decision: an element boundary immediately
// before the dash counts as preceding content, so a dash that opens a text
// node (after e.g. a skipped <code>) is still glued — punctilio's
// dashWordJoiner only inspects the neighboring character, which may sit in a
// sibling node across the boundary.
const dashWordJoinerPass = definePass(/[–—]/gu, (match, view) => {
  if (!view.hasBoundary(match.index)) {
    const prev = match.index > 0 ? view.text[match.index - 1] : undefined
    if (prev === undefined || /\s/u.test(prev) || prev === WORD_JOINER) {
      return null
    }
  }
  return `${WORD_JOINER}${match[0]}`
})

// Simple find-and-replace transforms local to this site (punctilio handles the rest)
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
    : uncheckedTextTransformers.filter((t) => t !== nbspTransform)

  for (const transformer of [
    ...checkedTextTransformers,
    ...textTransformers,
    spacesAroundSlashes,
  ]) {
    text = transformer(text)
  }

  return text
}

export const lPRegex = /(?<prefix>\s|^)L(?<number>\d+)\b(?!\.)/g
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

    while ((match = lPRegex.exec(node.value)) !== null) {
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

      lastIndex = lPRegex.lastIndex
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
      /(?:^|(?<= )|\b) ?-{1,2}> ?(?=[\w ]|$)/g,
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
const arrowRegex = new RegExp(` ?(?<arrow>[${arrowsToWrap.join("")}]) ?`, "g")

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

// A day adjacent to a year (e.g. "26th, 2026") is a calendar date: tag its
// number .date-ordinal-num so it renders in oldstyle figures matching the year.
// Every other ordinal keeps lining figures so it stays full cap height.
const trailingYearRegex = /^,?\s+\d{4}\b/

export function formatOrdinalSuffixes(tree: Root): void {
  visitParents(tree, "text", (node, ancestors) => {
    const parent = ancestors[ancestors.length - 1] as Parent
    if (!parent || hasAncestor(parent as Element, toSkip, ancestors)) return

    const index = parent.children.indexOf(node as ElementContent)
    replaceRegex(node, index, parent, ordinalSuffixRegex, (match: RegExpMatchArray) => {
      const matchEnd = (match.index ?? /* istanbul ignore next */ 0) + match[0].length
      const followedByYear = trailingYearRegex.test(
        match.input?.slice(matchEnd) ?? /* istanbul ignore next */ "",
      )
      const numSelector = followedByYear ? "span.date-ordinal-num" : "span.ordinal-num"
      const numSpan = h(numSelector, match.groups?.number ?? /* istanbul ignore next */ "")
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
    // A favicon-span wraps trailing text + an icon/back-arrow (created for
    // footnote back-arrows before this pass runs). Its leading punctuation
    // should move into the link just like a bare text sibling's would.
    const looksTextLike =
      hasAttrs && (TEXT_LIKE_TAGS.includes(sibling.tagName) || hasClass(sibling, "favicon-span"))
    if (sibling.type === "text") {
      textNode = sibling
    } else if (looksTextLike && sibling.children.length > 0) {
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

// The optional comma after the abbreviation is consumed and normalized away.
// (?!\.) keeps the rewrite idempotent: without it "i.e.." lets \.? backtrack
// to ε, the lookahead fires at the first ".", and every pass appends a period.
// The lookahead requires a word-end boundary, whitespace, or end of prose.
const afterAbbrevPattern = "\\.?(?!\\.),?(?=(?<=\\w)(?!\\w)|\\s|$)"

// Boundary decision: the comma being normalized away may live in a sibling
// text node (e.g. "<em>e.g.</em>, test"), so a boundary directly before that
// trailing comma is allowed; a boundary anywhere else in the match (inside
// the abbreviation itself) rejects it.
function allowBoundaryBeforeTrailingComma(match: RegExpExecArray, view: ProseView): boolean {
  if (!match[0].endsWith(",")) {
    return false
  }
  const commaIdx = match.index + match[0].length - 1
  return view.boundaries.every(
    (boundary) =>
      boundary <= match.index || boundary >= match.index + match[0].length || boundary === commaIdx,
  )
}

// The word-end assertion `(?<=\w)(?!\w)` is not interchangeable with `\b`
// here: after an optional "." or "," the position sits between non-word
// characters, where `\b` would accept but a word-end must reject.
// eslint-disable-next-line regexp/prefer-predefined-assertion
const egPass = definePass(new RegExp(`\\be\\.?g${afterAbbrevPattern}`, "gi"), "e.g.", {
  boundaries: allowBoundaryBeforeTrailingComma,
})
// eslint-disable-next-line regexp/prefer-predefined-assertion
const iePass = definePass(new RegExp(`\\bi\\.?e${afterAbbrevPattern}`, "gi"), "i.e.", {
  boundaries: allowBoundaryBeforeTrailingComma,
})

/**
 * Normalizes "e.g." and "i.e." abbreviations to standard format.
 */
export function normalizeAbbreviations(text: string): string {
  return iePass(egPass(text))
}

const plusToAmpersandRegex = /(?<!\b(?:ctrl|alt|option|cmd|command|fn))(?<=\p{L})\+(?=[A-Z])/giu
const plusToAmpersandPass = definePass(plusToAmpersandRegex, `${NBSP}&${NBSP}`)

export function plusToAmpersand(text: string): string {
  return plusToAmpersandPass(text)
}

// The time regex is used to convert 12:30 PM to 12:30 p.m.
// At the end, watch out for double periods
const amPmRegex = /(?<=\d ?)(?<time>[AP])(?:\.M\.|M)\.?(?!\p{L})/giu
const amPmPass = definePass(amPmRegex, (match) => {
  const groups = match.groups as { time: string }
  return `${groups.time.toLowerCase()}.m.`
})

export function timeTransform(input: string): string
export function timeTransform(input: ProseView): void
export function timeTransform(input: string | ProseView): string | void {
  if (typeof input === "string") {
    return amPmPass(input)
  }
  amPmPass(input)
  return undefined
}

// Site-specific transforms (punctilio handles: !=, multiplication, ellipsis, math symbols, etc.)
const massTransforms: [RegExp, string][] = [
  [/\b(?:i\.i\.d\.|iid)/gi, "IID"],
  [/\b(?<letter>[Ff])rappe\b/g, "$<letter>rappé"],
  [/\b(?<letter>[Ll])atte\b/g, "$<letter>atté"],
  [/\b(?<letter>[Cc])liche\b/g, "$<letter>liché"],
  [/(?<=[Aa]n |[Tt]he )(?<letter>[Ee])xpose\b/g, "$<letter>xposé"],
  [/wi-?fi/gi, "Wi-Fi"],
  [/\b(?<letter>[Dd])eja vu\b/g, "$<letter>éjà vu"],
  [/\bgithub\b/gi, "GitHub"],
  [/(?<=\b| )(?<letter>[Vv])oila(?=\b|$)/g, "$<letter>oilà"],
  [/\b(?<letter>[Nn])aive/g, "$<letter>aïve"],
  [/\b(?<letter>[Cc])hateau\b/g, "$<letter>hâteau"],
  [/\b(?<letter>[Dd])ojo/g, "$<letter>ōjō"],
  [/\bregex(?<plural>e?s)?\b/gi, "RegEx$<plural>"],
  [/\brelu\b/gi, "RELU"],
  [/\b(?<letter>[Oo])pen-source\b/g, "$<letter>pen source"],
  [/\bmarkdown\b/g, "Markdown"],
  [/macos/gi, "macOS"],
  [/team shard/gi, "Team Shard"],
  [/Gemini (?<model>\w+) (?<version>\d(?:\.\d)?)(?!-)/g, "Gemini $<version> $<model>"],
  // Model naming standardization
  [/\bLLAMA(?=-\d)/g, "Llama"], // LLAMA-2 → Llama-2
  [/\bGPT-4-o\b/gi, "GPT-4o"], // GPT-4-o → GPT-4o
  [/\bbibtex\b/gi, "BibTeX"], // Normalize BibTeX capitalization
]

// Boundary decision: all site regexes keep definePass's default
// `boundaries: "skip"` — a candidate split across an element boundary (e.g. a
// word broken by <em>) is left untouched rather than rewritten across nodes.
const massTransformPasses: readonly ProsePass[] = massTransforms.map(([regex, replacement]) =>
  definePass(regex, replacement),
)

export function massTransformText(input: string): string
export function massTransformText(input: ProseView): void
export function massTransformText(input: string | ProseView): string | void {
  if (typeof input === "string") {
    for (const pass of massTransformPasses) {
      input = pass(input)
    }
    return normalizeAbbreviations(input)
  }
  for (const pass of [...massTransformPasses, egPass, iePass]) {
    pass(input)
  }
  return undefined
}

// Per-element pipeline order mirrors checkedTextTransformers: the mass
// transforms (with abbreviation normalization), then plus-to-ampersand, then
// the a.m./p.m. rewrite.
const checkedTextPasses: readonly ProsePass[] = [
  ...massTransformPasses,
  egPass,
  iePass,
  plusToAmpersandPass,
  amPmPass,
]

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

  // The in-place rewrites below assume the first text node holds the first
  // letter. When the paragraph opens with an inline element carrying text
  // (e.g. <em>First</em>), the first text node is later prose, so rewriting it
  // would corrupt visible text. Only rewrite when this node starts the letter.
  if (firstTextNode.value.charAt(0) !== firstLetter) return

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
    (node.value?.includes("/") && urlRegexNonGlobal.test(node.value))
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

      const skipFormatting = [node, ...ancestors].some((ancestor) => toSkip(ancestor as Element))
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
        ? uncheckedTextTransformers.filter((t) => t !== nbspTransform)
        : uncheckedTextTransformers

      // skipTags is empty because toSkip already covers the site's skip list;
      // punctilio's default skip tags (kbd, var, samp, ...) must not apply.
      // Form-control and metadata text (option labels, button captions) is a
      // literal value, not prose — drop those blocks from the collection.
      const eltsToTransform = collectProseBlocks(node as Element, {
        skipTags: [],
        shouldSkip: toSkip,
      }).filter((elt) => !NON_PROSE_TAGS.has(elt.tagName))
      eltsToTransform.forEach((elt) => {
        const passes: PassEntry[] = [
          ...checkedTextPasses,
          ...activeUncheckedTransformers,
          // Runs after dash conversion so freshly created dashes get glued.
          dashWordJoinerPass,
        ]

        // Don't replace slashes in fractions, but give breathing room
        // to others
        const isNotFractionOrLink = (n: Element) => {
          return !hasClass(n, "fraction") && n?.tagName !== "a"
        }
        if (isNotFractionOrLink(elt)) {
          // Slash spacing alone also skips URL-text links, so its entry
          // carries the extra text-node predicate.
          passes.push({ pass: spacesAroundSlashes, shouldSkipText: shouldSkipLinkUrlText })
        }

        applyPasses(elt, passes, { shouldSkip: toSkip })
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
