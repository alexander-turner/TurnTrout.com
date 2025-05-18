/**
 * This module provides text formatting improvements for Quartz.
 * It includes various functions to enhance the formatting of markdown content.
 */

import type { QuartzTransformerPlugin } from "../types"

import { mdLinkRegex } from "./utils"

// Regular expression for footnotes not followed by a colon (definition) or opening parenthesis (md URL)
const footnoteSpacingRegex = /(\S) (\[\^[^\]]+?\])(?![:(]) ?/g
const footnoteSpacingReplacement = "$1$2 "

// New regex for moving footnotes after punctuation
const footnotePunctuationRegex = /(\S)(\[\^[^\]]*?\])([.,;!?]+)/g
const footnotePunctuationReplacement = "$1$3$2"

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
  /^\s*(?<emph1>[*_]*)(edit|eta|note),?\s*\(?(?<date>\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\)?(?<emph2>[*_]*:[*_]*) (?<text>.*)[*_]*/gim
const editAdmonitionPattern = "\n> [!info] Edited on $<date>\n>\n> $<text>"

const editPatternNoDate = /^\s*(?<emph1>[*_]*)(edit|eta)(?<emph2>[*_]*:[*_]*) (?<text>.*)[*_]*/gim
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

const CALLOUT_REGEX_NO_SPACE = new RegExp(/^( *(?:> )+)(\[!.*$)(?!(?:> *)+\n)/gm)
const TARGET_REGEX_WITH_SPACE = "$1$2\n$1"
export function spaceAdmonitions(text: string): string {
  return text.replaceAll(CALLOUT_REGEX_NO_SPACE, TARGET_REGEX_WITH_SPACE)
}

// Wrap e.g. header "# 10" in lining nums
export function wrapLeadingNumbers(text: string): string {
  return text.replace(/(?<=# )(\d+)/g, '<span style="font-variant-numeric: lining-nums;">$1</span>')
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

const subtitlePattern = /^(Subtitle:[\S ]+\n)(?=[^\n])/gm

const massTransforms: [RegExp | string, string][] = [
  [/(?<!\$):=/g, "≝"], // mathematical definition symbol, not preceded by the start of a katex block
  [/^\$\$(?= *\S)/gm, "$$$$\n"], // Display mode math should be on a new line
  [/^(?! *>| +\S)(.*?\S.*?)\$\$ *$/gm, "$1\n$$$$"], // Two per $, since it has special meaning in JS regex; ignore blockquotes and captions
  [/(?<= |^):\)(?= |$)/gm, "🙂"], // Smiling face
  [/(?<= |^):\((?= |$)/gm, "🙁"], // Frowning face
  [subtitlePattern, "$1\n"],
  [/(?<=\| *$)\nTable: /gm, "\n\nTable: "],
  [/(<\/[^>]*>|<[^>]*\/>)\s*$\n\s*(?!=\n|[<>])/gm, "$1\n\n"], // Ensure there is a newline after an HTML tag
  [/MIRIx(?=\s|$)/g, 'MIRI<sub class="mirix-subscript">x</sub>'],
]

export function massTransformText(text: string): string {
  for (const [pattern, replacement] of massTransforms) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "g")
    text = text.replace(regex, replacement)
  }
  return text
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

// TODO newline before Figure:

/**
 * Applies various formatting improvements to the input text.
 * @param text - The input text to process.
 * @returns The text with all formatting improvements applied.
 */
export const formattingImprovement = (text: string) => {
  const yamlHeaderMatch = text.match(/^\s*---\n(.*?)\n---\n/s)
  let yamlHeader = ""
  let content = text

  if (yamlHeaderMatch) {
    yamlHeader = yamlHeaderMatch[0]
    content = text.substring(yamlHeader.length)
  }

  // Format the content (non-YAML part)
  let newContent = content.replaceAll(/(\u00A0|&nbsp;)/gu, " ") // Remove NBSP

  newContent = improveFootnoteFormatting(newContent)
  newContent = newContent.replace(/ *,/g, ",") // Remove space before commas
  newContent = editAdmonition(newContent)
  newContent = noteAdmonition(newContent)
  newContent = spaceAdmonitions(newContent)
  newContent = concentrateEmphasisAroundLinks(newContent)
  newContent = wrapLeadingNumbers(newContent)
  newContent = massTransformText(newContent)

  // Ensure that bulleted lists display properly
  newContent = newContent.replaceAll("\\-", "-")

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
      const content = typeof src === "string" ? src : src.toString()
      return formattingImprovement(content)
    },
  }
}
