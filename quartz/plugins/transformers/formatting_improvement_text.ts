/**
 * This module provides text formatting improvements for Quartz.
 * It includes various functions to enhance the formatting of markdown content.
 *
 * The rules run in two tiers. A rule that creates or repairs block structure —
 * an admonition, a display-math break, a link destination the parser would
 * otherwise reject — must rewrite the source before it is parsed. A rule that
 * substitutes characters within prose runs on the mdast instead, where an
 * `inlineCode` span is a node it cannot reach.
 */

import type { Root as HastRoot } from "hast"
import type { Root } from "mdast"

import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

import { NBSP } from "../../components/constants"
import { transformOutsideCode } from "./markdownSource"
import { mdLinkRegex } from "./utils"

// A literal NBSP is a paste artifact wherever it lands, and inside a code
// sample it silently breaks copy-paste (Python rejects it as indentation), so
// the source pass normalizes it everywhere — fenced blocks included. The same
// pattern runs again on the mdast, where it catches the NBSP a `&nbsp;` entity
// decodes to.
const nbspCharRegex = new RegExp(NBSP, "gu")

/**
 * Character substitutions applied to prose text nodes.
 *
 * Each rule rewrites characters of running prose, so none of them has any
 * business inside a code sample: `n := f()`, `f(a , b)`, `GPT-4o` and `:)` are
 * source the author typed and must render verbatim. On the mdast that
 * guarantee is structural — a text-node pass cannot see into `inlineCode` or
 * `code` — whereas the source tier can only skip whole code *blocks*, since a
 * mid-line cut would let these rules' `^`/`$` anchors read a chunk edge as a
 * line boundary.
 *
 * An `&nbsp;` reaches this tier already decoded to a literal NBSP, and inside
 * a code sample it stays the entity it was written as — real markup in an HTML
 * example.
 */
const proseSubstitutions: [RegExp, string][] = [
  [nbspCharRegex, " "],
  [/ +,/g, ","], // Remove space before commas
  [/(?<!\$):=/g, "≝"], // mathematical definition symbol, not preceded by the start of a katex block
  [/(?<= |^):\)(?= |$)/gm, "🙂"], // Smiling face
  [/(?<= |^);\)(?= |$)/gm, "😉"], // Winking face
  [/(?<= |^):\((?= |$)/gm, "🙁"], // Frowning face
  [/GPT-4o\b/g, "GPT-4-o"],
]

/** Applies every substitution to a bare string. */
function substituteInString(value: string): string {
  return proseSubstitutions.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  )
}

/**
 * Substitutes within a math node's TeX, which the author writes as prose too:
 * `\rho := \prod` should typeset as `≝`.
 *
 * Two of the rules read the characters flanking a match, and the delimiters
 * that supplied them are gone by the time math is a node — so they are handed
 * back for the substitution. That is what keeps `$:=$` a literal `:=`.
 */
function substituteInMath(value: string): string {
  return substituteInString(`$${value}$`).slice(1, -1)
}

/**
 * Applies {@link proseSubstitutions} to the prose of the tree: text nodes, the
 * alt text and titles a reader sees on hover, and math.
 *
 * `inlineCode` and `code` are the point of running here rather than on the
 * source — they hold what the author typed, so they are skipped. Every rule
 * rewrites a node's value in place, leaving the node layout the later inline
 * passes read (which atoms neighbor which words) exactly as the prose has it.
 */
export function substituteProseCharacters(tree: Root): void {
  visit(tree, (node) => {
    if (node.type === "text") {
      node.value = substituteInString(node.value)
    } else if (node.type === "inlineMath" || node.type === "math") {
      node.value = substituteInMath(node.value)
      // remark-math attaches the hast it wants rendered while parsing, and that
      // copy — a `code` element for inline math, wrapped in a `pre` for display
      // — is what reaches the page.
      const hChildren = node.data?.hChildren
      /* istanbul ignore next -- remark-math always attaches the rendered hast */
      if (hChildren) {
        const value = node.value
        visit({ type: "root", children: hChildren } as HastRoot, "text", (texNode) => {
          texNode.value = value
        })
      }
    } else if (node.type === "image" || node.type === "link") {
      if (node.type === "image") node.alt = node.alt && substituteInString(node.alt)
      node.title = node.title && substituteInString(node.title)
    }
  })
}

// Regular expression for footnotes not followed by a colon (definition) or opening parenthesis (md URL)
const footnoteSpacingRegex = /(?<content>\S) (?<footnote>\[\^[^\]]+\])(?![:(]) ?/g
const footnoteSpacingReplacement = "$<content>$<footnote> "

// New regex for moving footnotes after punctuation
const footnotePunctuationRegex = /(?<content>\S)(?<footnote>\[\^[^\]]*\])(?<punct>[.,;!?]+)/g
const footnotePunctuationReplacement = "$<content>$<punct>$<footnote>"

/**
 * Adjusts the spacing around footnotes and moves them after punctuation.
 * @param text - The input text to process.
 * @returns The text with improved footnote formatting.
 */
const improveFootnoteFormatting = (text: string) => {
  let improvedText = text.replace(footnoteSpacingRegex, footnoteSpacingReplacement)
  improvedText = improvedText.replace(footnotePunctuationRegex, footnotePunctuationReplacement)
  return improvedText
}

// Regular expression for edit/note patterns
const editPattern =
  /^\s*[*_]*(?:edit|eta|note),?\s*\(?(?<date>\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\)?[*_]*:[*_]* (?<text>.*)/gim
const editAdmonitionPattern = "\n> [!info] Edited on $<date>\n>\n> $<text>"

const editPatternNoDate = /^\s*[*_]*(?:edit|eta)[*_]*:[*_]* (?<text>.*)/gim
const editAdmonitionPatternNoDate = "\n> [!info] Edited after posting\n>\n> $<text>"

/**
 * Converts edit/note patterns to admonition blocks.
 * @param text - The input text to process.
 * @returns The text with edit/note patterns converted to admonitions.
 */
export function editAdmonition(text: string): string {
  text = text.replaceAll(editPattern, editAdmonitionPattern)
  text = text.replaceAll(editPatternNoDate, editAdmonitionPatternNoDate)
  return text
}

const CALLOUT_REGEX_NO_SPACE = /^(?<prefix> *(?:> )+)(?<callout>\[!.*$)/gm
const TARGET_REGEX_WITH_SPACE = "$<prefix>$<callout>\n$<prefix>"

/**
 * Adds a newline after admonitions without an empty second line (sans >).
 */
export function spaceAdmonitions(text: string): string {
  return text.replaceAll(CALLOUT_REGEX_NO_SPACE, TARGET_REGEX_WITH_SPACE)
}

// Wrap e.g. header "# 10" in lining nums
export function wrapLeadingNumbers(text: string): string {
  return text.replace(
    /(?<=# )(?<num>\d+)/g,
    '<span style="font-variant-numeric: lining-nums;">$<num></span>',
  )
}

export function wrapNumbersBeforeColon(text: string): string {
  return text.replace(
    /(?<heading>#[\p{L}\d_ ]*)(?<!\d)(?<digit>\d):/gu,
    '$<heading><span style="font-variant-numeric: lining-nums;">$<digit></span>:',
  )
}

const notePattern = /^\s*[*_]*note[*_]*:[*_]* (?<text>.*)(?<![*_])[*_]*/gim

/**
 * Converts note patterns to admonition blocks.
 * @param text - The input text to process.
 * @returns The text with note patterns converted to admonitions.
 */
export function noteAdmonition(text: string): string {
  text = text.replaceAll(notePattern, "\n> [!note]\n>\n> $<text>")
  return text
}

const subtitlePattern = /^(?<quote>(?:> *)*)(?<subtitle>Subtitle:[\S ]+\n)(?!\k<quote>\n)/gm
const subtitleReplacement = "$<quote>$<subtitle>$<quote>\n"

// Replace x.com and twitter.com links with xcancel.com. The `(?![\w.-])`
// guard keeps `.com` from matching inside a longer host label such as
// `x.company.com` or `x.com.au`.
const xcancelHostReplacementRegex = /https?:\/\/(?:www\.)?(?:x|twitter)\.com(?![\w.-])\/?/gi

const massTransforms: [RegExp | string, string][] = [
  [/^\$\$(?= *\S)/gm, "$$$$\n"], // Display mode math should be on a new line
  [/^(?! *>| +\S)(?<content>\S.*?)\$\$ *$/gm, "$<content>\n$$$$"],
  [subtitlePattern, subtitleReplacement],
  [xcancelHostReplacementRegex, "https://xcancel.com/"],
  [/(?<=\| *)\nTable: /g, "\n\nTable: "],
  // Insert a blank line after a block-level HTML tag so the markdown parser
  // doesn't swallow following prose into the same HTML block. Avoid inside of code blocks.
  [/(?<closingTag><\/[^>]*>|<[^>]*\/>)[ \t]*\n(?=[ \t]*[^ \t\n<>/`=])/g, "$<closingTag>\n\n"],
  [/MIRIx(?=\s|$)/g, 'MIRI<sub class="mirix-subscript">x</sub>'],
]

/** Sequentially applies a list of `[pattern, replacement]` regex substitutions to `text`. */
export function applyTextTransforms(text: string, transforms: [RegExp | string, string][]): string {
  for (const [pattern, replacement] of transforms) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "g")
    text = text.replace(regex, replacement)
  }
  return text
}

// A markdown link/image destination can't hold raw spaces unless it's wrapped
// in angle brackets, so a path like `.../Why I left ....mp4` silently fails to
// parse as a link and renders as literal text. Match only "plain" destinations
// — no title, parens, quotes, or existing angle brackets — to avoid disturbing
// link titles (`url "title"`) or balanced-paren URLs.
const linkDestSpaceRegex = /(?<=\]\()[^()<>"'\s]*(?: [^()<>"'\s]*)+(?=\))/g

/**
 * Percent-encodes spaces inside plain markdown link/image destinations so links
 * to space-containing asset paths still parse.
 * @param text - The input text to process.
 * @returns The text with spaces in link destinations encoded as `%20`.
 */
export function encodeLinkDestinationSpaces(text: string): string {
  return text.replace(linkDestSpaceRegex, (dest) => dest.replaceAll(" ", "%20"))
}

/**
 * Concentrates emphasis around links by moving asterisks or underscores inside the link brackets.
 * @param text - The input text to process.
 * @returns The text with emphasis concentrated around links.
 */
const concentrateEmphasisAroundLinks = (text: string): string => {
  const emphRegex = new RegExp(
    `(?<emph>[*_]+)(?<whitespace1>\\s*)(?<url>${mdLinkRegex.source})(?<whitespace2>\\s*)(\\k<emph>)`,
    "gm",
  )
  return text.replace(emphRegex, "$<whitespace1>$<emph>$<url>$<emph>$<whitespace2>")
}

/** Applies every prose rule to one run of markdown lines outside fenced code. */
function improveProse(chunk: string): string {
  let text = improveFootnoteFormatting(chunk)
  text = editAdmonition(text)
  text = noteAdmonition(text)
  text = spaceAdmonitions(text)
  text = concentrateEmphasisAroundLinks(text)
  text = encodeLinkDestinationSpaces(text)
  text = wrapLeadingNumbers(text)
  text = wrapNumbersBeforeColon(text)
  text = applyTextTransforms(text, massTransforms)

  // Ensure that bulleted lists display properly
  return text.replaceAll("\\-", "-")
}

/**
 * Applies formatting improvements to the input text.
 * @param text - The input text to process.
 * @returns The text with all formatting improvements applied.
 */
export const formattingImprovement = (text: string) => {
  const yamlHeaderMatch = text.match(/^\s*---\n.*?\n---\n/s)
  let yamlHeader = ""
  let content = text

  if (yamlHeaderMatch) {
    yamlHeader = yamlHeaderMatch[0]
    content = text.substring(yamlHeader.length)
  }

  // Every rule below rewrites prose, so none may reach inside a fenced code
  // block: a sample showing `<!-- -->` or `> [!note]` must render as the author
  // typed it.
  const newContent = transformOutsideCode(content.replaceAll(nbspCharRegex, " "), improveProse)

  return yamlHeader + newContent // Concatenate YAML header and formatted content
}

/**
 * Quartz transformer plugin for text formatting improvements.
 * @returns An object with the plugin name and text transform function.
 */
export const TextFormattingImprovement: QuartzTransformerPlugin = () => {
  return {
    name: "textFormattingImprovement",
    textTransform(_ctx, src: string | Buffer) {
      // Convert Buffer to string if needed
      // Stryker disable next-line ConditionalExpression,EqualityOperator: String#toString() is the identity, so forcing the toString branch is behaviorally equivalent
      const content = typeof src === "string" ? src : src.toString()
      return formattingImprovement(content)
    },
  }
}

/**
 * Quartz transformer plugin for the mdast tier of {@link proseSubstitutions}.
 *
 * Separate from {@link TextFormattingImprovement} because the two tiers belong
 * at different points of the pipeline: every `textTransform` runs before any
 * parse, but a markdown plugin runs where its transformer sits, and this one
 * has to land before the search index is gathered from the tree.
 *
 * @returns An object with the plugin name and its mdast pass.
 */
export const ProseCharacterSubstitutions: QuartzTransformerPlugin = () => {
  return {
    name: "proseCharacterSubstitutions",
    markdownPlugins() {
      return [() => substituteProseCharacters]
    },
  }
}
