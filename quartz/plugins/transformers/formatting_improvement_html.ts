import type { Element, Text, Root, Parent, ElementContent } from "hast"

import { h } from "hastscript"
import { niceQuotes, hyphenReplace, symbolTransform, primeMarks, nbspTransform } from "punctilio"
import { getTextContent, transformElement, collectTransformableElements } from "punctilio/rehype"
import { type Transformer } from "unified"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import type { ElementMaybeWithParent } from "./utils"

import {
  charsToMoveIntoLinkFromRight,
  markerChar,
  hatTipPlaceholder,
} from "../../components/constants"
import { type QuartzTransformerPlugin } from "../types"
import { replaceRegex, fractionRegex, hasClass, hasAncestor, urlRegex } from "./utils"

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

/**
 * Space out slashes in text
 * @returns The text with slashes spaced out
 */
export function spacesAroundSlashes(text: string): string {
  // First replace h/t with the placeholder character (hatTipPlaceholder imported from constants)
  text = text.replace(/\b(?:h\/t)\b/g, hatTipPlaceholder)

  // Apply the normal slash spacing rule
  // Can't allow num on both sides, because it'll mess up fractions
  // Use function replacement to preserve markers while avoiding double spaces
  // Markers go OUTSIDE the spaces so content stays in correct HTML elements
  const slashRegex = new RegExp(
    `(?<![\\d/<])(?<=[\\S])(?<spaceBefore> ?)(?<markerBefore>${markerChar})?/(?<markerAfter>${markerChar})?(?<spaceAfter> ?)(?=\\S)(?!/)`,
    "gu",
  )
  text = text.replace(slashRegex, (...args) => {
    const groups = args.at(-1) as {
      spaceBefore: string
      markerBefore: string | undefined
      markerAfter: string | undefined
      spaceAfter: string
    }
    const { spaceBefore, markerBefore, markerAfter, spaceAfter } = groups
    // Add space only if not already present
    // Place markers outside spaces: marker-space-slash-space-marker
    const pre = spaceBefore || " "
    const post = spaceAfter || " "
    return `${markerBefore || ""}${pre}/${post}${markerAfter || ""}`
  })

  const numberSlashThenNonNumber = /(?<=\d)\/(?=\D)/g
  text = text.replace(numberSlashThenNonNumber, " / ")

  // Restore the h/t occurrences
  return text.replace(new RegExp(hatTipPlaceholder, "g"), "h/t")
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
  // Prime marks must run before niceQuotes to convert 5'10" → 5′10″ before quote processing
  (text: string) => primeMarks(text, { separator: markerChar }),
  (text: string) => niceQuotes(text, { separator: markerChar }),
  // Ellipsis, multiplication, math, legal symbols (arrows disabled - site uses custom formatArrows)
  (text: string) => symbolTransform(text, { separator: markerChar, includeArrows: false }),
  // Non-breaking spaces: prevents orphans, keeps numbers with units, etc.
  (text: string) => nbspTransform(text, { separator: markerChar }),
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
        newNodes.push({ type: "text", value: node.value.slice(lastIndex, match.index) })
      }

      // The regex guarantees these named groups always exist
      const { prefix, number } = match.groups as { prefix: string; number: string }

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
  const arrowRegex = new RegExp(`(?<arrow>${arrowsToWrap.join("|")})`, "g")

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

/**
 * Normalizes "e.g." and "i.e." abbreviations to standard format.
 * Captures any markers after the abbreviation and trailing comma, preserving them in the output.
 */
export function normalizeAbbreviations(text: string): string {
  // Pattern: word-start + "e" + optional "." + "g" + optional trailing "." +
  // optional marker (captured) + optional comma with optional marker (captured)
  // Must be followed by word boundary, space, marker, or end of string
  const afterAbbrevPattern = `\\.?(?<abbrevMarker>${markerChar})?(?:,(?<commaMarker>${markerChar})?)?(?=${wbe}|\\s|${markerChar}|$)`
  const egPattern = `${wb}e\\.?g${afterAbbrevPattern}`
  const iePattern = `${wb}i\\.?e${afterAbbrevPattern}`

  text = text.replace(new RegExp(egPattern, "gi"), "e.g.$<abbrevMarker>$<commaMarker>")
  text = text.replace(new RegExp(iePattern, "gi"), "i.e.$<abbrevMarker>$<commaMarker>")

  return text
}

export function plusToAmpersand(text: string): string {
  const sourcePattern = "(?<=[a-zA-Z])\\+(?=[a-zA-Z])"
  const result = text.replace(new RegExp(sourcePattern, "g"), " \u0026 ")
  return result
}

// The time regex is used to convert 12:30 PM to 12:30 p.m.
// At the end, watch out for double periods
// Marker-aware: allow optional marker between digit and space, e.g., "15<marker> Am"
const amPmRegex = new RegExp(`(?<=\\d(?:${markerChar})? ?)(?<time>[AP])(?:\\.M\\.|M)\\.?`, "gi")
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
      if (node.type === "element") {
        const eltsToTransform = collectTransformableElements(node as Element, toSkip)
        eltsToTransform.forEach((elt) => {
          for (const transform of checkedTextTransformers) {
            transformElement(elt, transform, toSkip, markerChar, true)
          }

          for (const transform of uncheckedTextTransformers) {
            transformElement(elt, transform, toSkip, markerChar, false)
          }

          // Don't replace slashes in fractions, but give breathing room
          // to others
          const slashPredicate = (n: Element) => {
            return !hasClass(n, "fraction") && n?.tagName !== "a"
          }
          if (slashPredicate(elt)) {
            transformElement(elt, spacesAroundSlashes, toSkip, markerChar, true)
          }
        })
      }
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
