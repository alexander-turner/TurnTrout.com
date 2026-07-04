import type { Element, Node, Parent, Text } from "hast"
import type { Plugin } from "unified"

import escapeStringRegexp from "escape-string-regexp"
import { toString } from "hast-util-to-string"
import { h } from "hastscript"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { HEADING_TAGS, NBSP } from "../../components/constants"
import {
  addClass,
  gatherTextBeforeIndex,
  hasClass,
  INLINE_PASSTHROUGH_TAGS,
  isCode,
  looksLikeWorkTitle,
  replaceRegex,
  shouldCapitalizeNodeText,
} from "./utils"

/** Validates if string matches Roman numeral pattern with optional trailing punctuation */
export function isRomanNumeral(str: string): boolean {
  const romanNumeralRegex =
    /(?<= |^)(?:M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:I{1,2}X|I{1,2}V|V?I{0,3})(?<=[A-Z]{2})|I[CDM])(?=[\s.,!?;:]|$)/
  return romanNumeralRegex.test(str)
}

// Regex for acronyms and abbreviations
//  E.g. "IID" is technically a roman numeral
export const allowAcronyms: readonly string[] = [
  "IF",
  "CCC",
  "IL",
  "TL;DR",
  "LLM",
  "MP4",
  "mp4",
  "IID",
  // Creative Commons licenses
  "CC BY",
  "CC BY-SA",
  "CC BY-NC",
  "CC BY-NC-SA",
  "CC BY-ND",
  "CC BY-NC-ND",
  "CC0",
]
// Ignore these words if included in a potential acronym
export const ignoreList: readonly string[] = ["th", "hz", "st", "nd", "rd"]

// Escaped and joined allowAcronyms as an intermediate variable
const escapedAllowAcronyms = allowAcronyms.map((acronym) => escapeStringRegexp(acronym))

const boundaryAllowAcronyms = escapedAllowAcronyms
  .map((acronym) => `\\b${acronym}(?!-)\\b`)
  .join("|")

export const smallCapsSeparators = "-'’"
const upperCapsChars = "A-Z\\u00C0-\\u00DC" // A-Z and À-Ü
// Word boundary that prevents mixing upper- and lowercase neighbors
const beforeWordBoundary = "(?<![\\w\\u00C0-\\u00DC\\u00E0-\\u00FC])"
const afterWordBoundary = "(?![\\w\\u00C0-\\u00DC\\u00E0-\\u00FC])"

// Pattern for acronyms with at least 3 uppercase letters (with digits/separators allowed between them)
// Use explicit alternations to ensure we actually capture 3+ uppercase letters, not just look ahead for them
const sep = `[\\d${smallCapsSeparators}]`
const upper = `[${upperCapsChars}]`
const upperOrDigit = `[${upperCapsChars}\\d]`
// Optional continuation after the required 3 uppercase letters
const continuation = `(?:${sep}${upperOrDigit}+)*`

const allowedUppercasePatterns = [
  `${upper}{3,}${continuation}`, // ABC, ABCD, ABC-2, etc.
  `${upper}{2}${sep}${upper}${upperOrDigit}*${continuation}`, // AB-C, AB-C2, etc.
  `${upper}${sep}${upper}{2,}${continuation}`, // A-BC, A-BCD, etc.
  `${upper}${sep}${upper}${sep}${upper}${upperOrDigit}*${continuation}`, // A-B-C, A-B-C2, etc.
].join("|")

// Matches sequences of uppercase characters (allowing digits/separators)
export const REGEX_ACRONYM = new RegExp(
  `${beforeWordBoundary}(?<acronym>${boundaryAllowAcronyms}|${allowedUppercasePatterns})(?<suffix>[sx]?)${afterWordBoundary}`,
)

// Curated list of multi-character abbreviations that should be wrapped in
// smallcaps when directly preceded by a number. English-word collisions like
// "in" (preposition) are intentionally excluded: punctilio's nbspTransform
// converts "D.1 in" → "D.1\u00A0in" because it treats "in" as inches, and
// without this filtering the smallcaps pass would then wrap the preposition.
export const SMALLCAPS_UNITS: readonly string[] = [
  // Length
  "km",
  "cm",
  "mm",
  "nm",
  "pm",
  "yd",
  "mi",
  "ft",
  "KM",
  // Mass
  "kg",
  "mg",
  "oz",
  "lb",
  "lbs",
  // Volume
  "ml",
  "mL",
  "gal",
  // Time
  "ms",
  "hr",
  "hrs",
  "min",
  // Frequency / speed. Intentionally omit Hz / kHz / MHz / GHz / THz — they
  // render awkwardly in smallcaps and the project has historically left them
  // as plain text.
  "rpm",
  // Digital
  "KB",
  "MB",
  "GB",
  "TB",
  "PB",
  "ZB",
  "kB",
  "Mb",
  "Gb",
  "kbps",
  "Mbps",
  "Gbps",
  // Power / energy
  "kW",
  "MW",
  "GW",
  "kWh",
  "MWh",
  "Wh",
  "kJ",
  "MJ",
  // Electrical
  "kV",
  "mV",
  "mA",
  // Pressure
  "Pa",
  "kPa",
  "MPa",
  "psi",
  "bar",
  // Area
  "ha",
  // Typography / CSS
  "px",
  "pt",
  "em",
  "rem",
  "vw",
  "vh",
  "dpi",
  // Misc
  "dB",
  "cal",
  "kcal",
  "mol",
  "MM",
  // Currency / crypto tickers
  "BTC",
  "ETH",
  "SOL",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CNY",
  // Gaming
  "XP",
  "EXP",
]

// Sort longest-first so alternation prefers e.g. "kWh" over "kW" and "Mbps"
// over "MB". RegExp backtracking would also find the right match, but an
// explicit ordering avoids the extra work.
const escapedUnits = [...SMALLCAPS_UNITS]
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
  .join("|")

// Optional non-breaking space between number and unit is captured as part of
// the abbreviation so callers that reconstruct the text (replacedMatch /
// originalText below) preserve it. Regular spaces are intentionally not
// matched — "1000 km" stays a plain phrase.
export const REGEX_ABBREVIATION = new RegExp(
  `(?<number>\\d+(?:\\.\\d+)?|\\.\\d+)(?<abbreviation>${NBSP}?(?:${escapedUnits}|[KkMmBbTGgWw]))\\b`,
)

// Version labels like "V1", "v2", "V100", "v1.0", "v1.2.3". The digits get
// lining-nums via the .version-num class so they stay at cap height instead
// of inheriting body oldstyle figures. The V is rendered uppercase (not
// small-capped) so it matches the lining digits' cap height. Trailing
// decimals are part of the match so the full "1.0" stays cap-aligned rather
// than splitting into a lining "1" followed by an oldstyle "0".
export const REGEX_VERSION_NUMBER = /\b(?:V|v)\d+(?:\.\d+)*\b/

// Lookahead to see that there are at least 3 contiguous uppercase characters in the phrase
export const validSmallCapsPhrase = `(?=[${upperCapsChars}\\-'’\\s]*[${upperCapsChars}]{3})`
const decimalOrSeparator = `[${smallCapsSeparators}\\d\\s]|\\d\\.\\d`
export const allCapsContinuation = `(?:(?:${decimalOrSeparator})+[${upperCapsChars}]+)`

// Skip sentence-leading single capitals (e.g. "A") unless the pronoun "I".
// De Morgan of the original (?!lookbehind ∧ lookahead ∧ ¬exception):
// proceed if NOT at sentence start ∨ NOT single-cap+space ∨ IS "I".
export const noSentenceStartSingleCapital = `(?:(?<![.!?]\\s)(?<!^)|(?![${upperCapsChars}]\\s)|(?=I\\s))`
export const REGEX_ALL_CAPS_PHRASE = new RegExp(
  `${beforeWordBoundary}${noSentenceStartSingleCapital}${validSmallCapsPhrase}(?<phrase>[${upperCapsChars}]+${allCapsContinuation}+)${afterWordBoundary}`,
)

const combinedRegex = new RegExp(
  `${REGEX_ALL_CAPS_PHRASE.source}|${REGEX_ACRONYM.source}|${REGEX_ABBREVIATION.source}|${REGEX_VERSION_NUMBER.source}`,
  "g",
)

// Predicate if we should skip smallcaps for a given node
export const skipSmallcapsClasses: readonly string[] = [
  "no-smallcaps",
  "no-formatting",
  "bad-handwriting",
  "katex",
]

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
  `(?<prefix>^\\s*|\\n|[.!?](?<!e\\.g\\.|i\\.e\\.)\\s+)(?<letter>[${upperCapsChars}])$`,
  "iu",
)

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
    if (parent.type === "element" && INLINE_PASSTHROUGH_TAGS.has((parent as Element).tagName)) {
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
      matchText === acronym || matchText === `${acronym}s` || matchText === `${acronym}x`,
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

      const allowed = isInAllowList(matchText)
      // Return unchanged - no formatting
      if (!allowed && isRomanNumeral(matchText)) {
        return { before: matchText, replacedMatch: "", after: "" }
      }

      // Format the text based on match type
      const allCapsPhraseMatch = REGEX_ALL_CAPS_PHRASE.exec(matchText)
      const shouldCapitalize = shouldCapitalizeMatch(match, node, index, ancestors)
      if (allCapsPhraseMatch?.groups) {
        const { phrase } = allCapsPhraseMatch.groups
        return {
          before: "",
          replacedMatch: processMatchedText(phrase, shouldCapitalize),
          after: "",
          originalText: phrase,
        }
      }

      const acronymMatch = REGEX_ACRONYM.exec(matchText)
      if (acronymMatch?.groups) {
        const { acronym, suffix } = acronymMatch.groups
        return {
          before: "",
          replacedMatch: processMatchedText(acronym, shouldCapitalize),
          after: suffix || "",
          originalText: acronym,
        }
      }

      const versionMatch = REGEX_VERSION_NUMBER.exec(matchText)
      if (versionMatch) {
        // Render the V at full cap height so it aligns with the lining digit.
        // Small-caps would render the V ~70–80% of cap height, mismatching the
        // lining figure. Original casing is preserved in data-original-text.
        return {
          before: "",
          replacedMatch: h(
            "abbr.small-caps.version-num",
            { "data-original-text": matchText },
            matchText.toUpperCase(),
          ),
          after: "",
        }
      }

      const abbreviationMatch = REGEX_ABBREVIATION.exec(matchText)
      /* istanbul ignore next -- falls through to unreachable throw when regex doesn't match */
      if (abbreviationMatch?.groups) {
        const { number, abbreviation } = abbreviationMatch.groups
        return {
          before: "",
          replacedMatch: number + abbreviation.toLowerCase(),
          after: "",
          originalText: number + abbreviation,
        }
      }

      // istanbul ignore next -- shouldn't happen
      throw new Error(
        `Regular expression logic is broken; one of the regexes should match for ${matchText}`,
      )
    },
    (nd: Text) => shouldSkipNode(nd, ancestors),
    "abbr.small-caps",
  )
}

/** Inline tags whose text carries a cited work's title in Markdown output. */
const WORK_TITLE_TAGS: ReadonlySet<string> = new Set(["a", "em", "i", "cite"])

/**
 * Tags links/emphasis/cite elements whose text reads as a title-cased work
 * title with `no-smallcaps`, so their acronyms render as plain caps. Title
 * case is the marker: authors opt in by writing a work title in title case
 * and opt out by sentence-casing. Heading text must keep its small-caps, so
 * the anchor wrappers inside headings are exempt.
 */
export function markWorkTitles(tree: Node): void {
  visitParents(tree, "element", (node: Element, ancestors: Parent[]) => {
    if (!WORK_TITLE_TAGS.has(node.tagName)) return
    const inHeading = ancestors.some(
      (ancestor) => ancestor.type === "element" && HEADING_TAGS.has((ancestor as Element).tagName),
    )
    if (inHeading) return
    if (looksLikeWorkTitle(toString(node))) {
      addClass(node, "no-smallcaps")
    }
  })
}

/**
 * Rehype plugin that visits text nodes and replaces
 * detected all-caps or acronyms with smallcaps <abbr>.
 */
export const rehypeTagSmallcaps: Plugin = () => {
  return (tree: Node) => {
    markWorkTitles(tree)
    visitParents(tree, "text", (node: Text, ancestors: Parent[]) => {
      replaceSCInNode(node, ancestors)
    })
  }
}

/** Quartz transformer that wraps acronyms and tag-like spans in small-caps styling. */
// istanbul ignore next
export const TagSmallcaps: QuartzTransformerPlugin = () => {
  return {
    name: "TagSmallcaps",
    htmlPlugins() {
      return [rehypeTagSmallcaps]
    },
  }
}
