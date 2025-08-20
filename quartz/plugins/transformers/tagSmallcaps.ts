import type { Element, Node, Parent, Text } from "hast"
import type { Plugin } from "unified"

// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { isCode } from "./formatting_improvement_html"
import { shouldCapitalizeNodeText, replaceRegex, gatherTextBeforeIndex, hasClass } from "./utils"

/** Validates if string matches Roman numeral pattern with optional trailing punctuation */
export function isRomanNumeral(str: string): boolean {
  const romanNumeralRegex =
    /(?<= |^)(?:(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(I{1,2}X|I{1,2}V|V?I{0,3})(?<=[A-Z]{3})|I{1,2}[XVCDM])(?=[\s.,!?;:]|$)/
  return romanNumeralRegex.test(str)
}

// Regex for acronyms and abbreviations
//  E.g. "IID" is technically a roman numeral
export const allowAcronyms = ["IF", "CCC", "IL", "TL;DR", "LLM", "MP4", "mp4", "IID"]
// Ignore these words if included in a potential acronym
export const ignoreList = ["th", "hz", "st", "nd", "rd"]

// Escaped and joined allowAcronyms as an intermediate variable
const escapedAllowAcronyms = allowAcronyms
  .map((acronym) => acronym.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
  .join("|")

export const smallCapsSeparators = "-'’"
const upperCapsChars = "A-Z\\u00C0-\\u00DC" // A-Z and À-Ü
const lowerCapsChars = "a-z\\u00E0-\\u00FC" // a-z and à-ü
const allCapsChars = `${upperCapsChars}${lowerCapsChars}`

// Update boundary conditions to prevent mixing upper and lower
const beforeWordBoundary = `(?<![${allCapsChars}\\w])`
const afterWordBoundary = `(?![${allCapsChars}\\w])`

// Update REGEX_ACRONYM to only match sequences of uppercase characters
export const REGEX_ACRONYM = new RegExp(
  `${beforeWordBoundary}(?<acronym>${escapedAllowAcronyms}|[${upperCapsChars}]{3,}(?:[${smallCapsSeparators}]?[${upperCapsChars}\\d]+)*)(?<suffix>[sx]?)${afterWordBoundary}`,
)

export const REGEX_ABBREVIATION =
  /(?<number>\d+(\.\d+)?|\.\d+)(?<abbreviation>[A-Za-z]{2,}|[KkMmBbTGgWw])\b/

// Lookahead to see that there are at least 3 contiguous uppercase characters in the phrase
export const validSmallCapsPhrase = `(?=[${upperCapsChars}\\-'’\\s]*[${upperCapsChars}]{3,})`
export const allCapsContinuation = `(?:[${smallCapsSeparators}\\d\\s]+[${upperCapsChars}]+)`

// Restricting to at least 2 words to avoid interfering with REGEX_ACRONYM
// Added negative lookbehind to prevent matching if preceded by a single capital letter and space
export const noSentenceStartSingleCapital = `(?!(?<=(?:^|[.!?]\\s))(?=[${upperCapsChars}]\\s)(?!I\\s))`
export const REGEX_ALL_CAPS_PHRASE = new RegExp(
  `${beforeWordBoundary}${noSentenceStartSingleCapital}${validSmallCapsPhrase}(?<phrase>[${upperCapsChars}]+${allCapsContinuation}+)${afterWordBoundary}`,
)

const combinedRegex = new RegExp(
  `${REGEX_ALL_CAPS_PHRASE.source}|${REGEX_ACRONYM.source}|${REGEX_ABBREVIATION.source}`,
  "g",
)

// Predicate if we should skip smallcaps for a given node
export const skipSmallcapsClasses = ["no-smallcaps", "no-formatting", "bad-handwriting", "katex"]

// skipcq: JS-0257
export function skipSmallcaps(node: Node): boolean {
  if (node.type === "element") {
    const elementNode = node as Element
    return (
      skipSmallcapsClasses.some((className: string) => hasClass(elementNode, className)) ||
      elementNode.tagName === "style"
    )
  }
  return false
}

/**
 * Determines if text node should skip acronym formatting
 */
export function shouldSkipNode(node: Text, ancestors: Parent[]): boolean {
  if (
    ancestors?.some(
      (ancestor) =>
        ancestor.type === "element" && (skipSmallcaps(ancestor) || isCode(ancestor as Element)),
    )
  ) {
    return true
  }

  const parent = ancestors[ancestors.length - 1] as Element
  return hasClass(parent, "elvish") || parent.tagName === "abbr"
}

// If text comes after sentence ending, capitalize the first letter
export const capitalizeAfterEnding = new RegExp(
  `(^\\s*|\\n|[.!?](?<![eE]\\.[gG]\\.|[iI]\\.[eE]\\.)\\s+)([${upperCapsChars}${lowerCapsChars}])$`,
)

export const INLINE_ELEMENTS = new Set([
  "b",
  "strong",
  "em",
  "i",
  "sup",
  "sub",
  "strike",
  "del",
  "s",
  "a",
])

export const PUNCTUATION_BEFORE_MATCH = /[([{"“‘`]/gu
/**
 * Determines if a matched text should be capitalized based on its position in the document
 * @param match - The regex match containing the text to potentially capitalize
 * @param node - The text node containing the match
 * @param index - The index of the node within its parent's children
 * @param ancestors - Array of parent nodes, from root to immediate parent
 * @returns True if the matched text should be capitalized, false otherwise
 * @throws Error if parent relationship is invalid
 */
export function shouldCapitalizeMatch(
  match: RegExpMatchArray,
  node: Text,
  index: number,
  ancestors: Parent[],
): boolean {
  // Check if this is the first node and match is at start (ignoring punctuation)
  const shouldBeginWithCapital = shouldCapitalizeNodeText(index, ancestors[ancestors.length - 1])
  // Remove any punctuation before the match
  const textBeforeMatch = node.value.substring(0, match.index).replace(PUNCTUATION_BEFORE_MATCH, "")
  const isStartOfNode = textBeforeMatch.trim().length === 0

  // If it should begin with capital and match starts at beginning, check parent context
  if (shouldBeginWithCapital && isStartOfNode) {
    if (ancestors.length === 1) {
      return true
    }

    // If parent is an inline element, check its context
    const parent = ancestors[ancestors.length - 1]
    if (parent.type === "element" && INLINE_ELEMENTS.has((parent as Element).tagName)) {
      const grandParent = ancestors[ancestors.length - 2]
      const parentIndex = grandParent.children.indexOf(parent as Element)
      // istanbul ignore if
      if (parentIndex === -1) {
        throw new Error("capitalizeMatch: parent is not the child of its grandparent")
      }

      return shouldCapitalizeMatch(match, node, parentIndex, ancestors.slice(0, -1))
    }
    return true
  }

  // If there's text before the match, check for sentence endings
  if (match.index !== undefined) {
    const textBefore =
      gatherTextBeforeIndex(ancestors[ancestors.length - 1], index) +
      node.value.substring(0, match.index + 1)
    const cleanedTextBefore = textBefore.replace(PUNCTUATION_BEFORE_MATCH, "")
    return capitalizeAfterEnding.test(cleanedTextBefore)
  }

  return false
}

// Process matched text with capitalization rules
export function processMatchedText(text: string, shouldCapitalize: boolean): string {
  return shouldCapitalize
    ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    : text.toLowerCase()
}

// Check if the matched text is in the allowlist
export function isInAllowList(matchText: string): boolean {
  return allowAcronyms.some(
    (acronym) =>
      matchText === acronym ||
      matchText.startsWith(`${acronym}s`) ||
      matchText.startsWith(`${acronym}x`),
  )
}

// Check if matched text should be ignored based on numeric abbreviations
export function shouldIgnoreNumericAbbreviation(matchText: string): boolean {
  const lowerCaseValue = matchText.toLowerCase()
  return /^\d/.test(lowerCaseValue) && ignoreList.some((item) => lowerCaseValue.includes(item))
}

/**
 * Replaces text with smallcaps version in HTML node
 * @param node - Text node to process
 * @param ancestors - Array of parent nodes
 * @throws Error if node is not child of parent
 */
export function replaceSCInNode(node: Text, ancestors: Parent[]): void {
  const parent = ancestors[ancestors.length - 1]
  const index = parent?.children.indexOf(node)
  if (index === -1) {
    throw new Error("replaceSCInNode: node is not the child of its parent")
  }

  replaceRegex(
    node,
    index,
    parent,
    combinedRegex,
    (match: RegExpMatchArray) => {
      const matchText = match[0]
      const shouldCapitalize = shouldCapitalizeMatch(match, node, index, ancestors)

      const whitelisted = isInAllowList(matchText)

      if (!whitelisted && isRomanNumeral(matchText)) {
        // Return unchanged - no formatting
        return { before: matchText, replacedMatch: "", after: "" }
      }

      // 3. Check ignore list for numeric abbreviations (if not whitelisted)
      if (!whitelisted && shouldIgnoreNumericAbbreviation(matchText)) {
        return { before: matchText, replacedMatch: "", after: "" }
      }

      // Format the text based on match type
      const allCapsPhraseMatch = REGEX_ALL_CAPS_PHRASE.exec(matchText)
      if (allCapsPhraseMatch?.groups) {
        const { phrase } = allCapsPhraseMatch.groups
        return {
          before: "",
          replacedMatch: processMatchedText(phrase, shouldCapitalize),
          after: "",
        }
      }

      const acronymMatch = REGEX_ACRONYM.exec(matchText)
      if (acronymMatch?.groups) {
        const { acronym, suffix } = acronymMatch.groups
        return {
          before: "",
          replacedMatch: processMatchedText(acronym, shouldCapitalize),
          after: suffix || "",
        }
      }

      const abbreviationMatch = REGEX_ABBREVIATION.exec(matchText)
      if (abbreviationMatch?.groups) {
        const { number, abbreviation } = abbreviationMatch.groups
        return {
          before: "",
          replacedMatch: number + abbreviation.toLowerCase(),
          after: "",
        }
      }

      // istanbul ignore next -- hard-to-trigger edge case
      throw new Error(
        `Regular expression logic is broken; one of the regexes should match for ${matchText}`,
      )
    },
    (nd: Text) => shouldSkipNode(nd, ancestors),
    "abbr.small-caps",
  )
}

/**
 * Rehype plugin that visits text nodes and replaces
 * detected all-caps or acronyms with smallcaps <abbr>.
 */
export const rehypeTagSmallcaps: Plugin = () => {
  return (tree: Node) => {
    visitParents(tree, "text", (node: Text, ancestors: Parent[]) => {
      replaceSCInNode(node, ancestors)
    })
  }
}

// skipcq: JS-D1001
// istanbul ignore next
export const TagSmallcaps: QuartzTransformerPlugin = () => {
  return {
    name: "TagSmallcaps",
    htmlPlugins() {
      return [rehypeTagSmallcaps]
    },
  }
}
