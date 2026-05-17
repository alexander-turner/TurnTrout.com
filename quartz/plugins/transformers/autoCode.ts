import type { Element, Node, Parent, Text } from "hast"
import type { Plugin } from "unified"

import escapeStringRegexp from "escape-string-regexp"
// skipcq: JS-0257
import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { isCode, replaceRegex } from "./utils"

// Library / tool names that should auto-format as inline <code> in prose.
// Lowercase-only so sentence-initial proper-noun uses ("Punctilio handles…")
// keep their capital-letter signal instead of being rewrapped.
export const codeTerms: readonly string[] = [
  "punctilio",
  "subfont",
  "smartypants",
  "retext-smartypants",
  "tipograph",
  "smartquotes",
  "typograf",
  "retext",
  "pylint",
  "eslint",
  "mypy",
  "linkchecker",
  "docformatter",
  "micromorph",
  "lint-staged",
  "playwright",
  "stylelint",
  "markdownlint",
  "prettier",
  "pnpm",
  "vale",
]

// Sort by length DESC so "retext-smartypants" matches before "retext"
// (regex alternation is left-to-right; without this, "retext" would win
// and leave "-smartypants" dangling).
const sortedTerms = [...codeTerms].sort((a, b) => b.length - a.length)
const termsPattern = sortedTerms.map(escapeStringRegexp).join("|")

// Treat hyphen as a word character on both sides so "subfont" doesn't fire
// inside "subfontextra" and "retext-smartypants" doesn't run into an
// adjacent hyphenated word.
export const CODE_TERM_REGEX = new RegExp(`(?<![\\w-])(?:${termsPattern})(?![\\w-])`, "g")

export function isInsideCode(ancestors: readonly Parent[]): boolean {
  return ancestors.some((anc) => anc.type === "element" && isCode(anc as Element))
}

/**
 * Rehype plugin that wraps the curated `codeTerms` in `<code>` whenever they
 * appear bare in prose. Skips matches inside an existing `<code>` ancestor.
 */
export const rehypeAutoCode: Plugin = () => {
  return (tree: Node) => {
    visitParents(tree, "text", (node: Text, ancestors: Parent[]) => {
      if (isInsideCode(ancestors)) return
      const parent = ancestors[ancestors.length - 1]
      const index = parent.children.indexOf(node)
      // istanbul ignore if -- visitParents always passes a real parent/child
      if (index === -1) return
      replaceRegex(
        node,
        index,
        parent,
        CODE_TERM_REGEX,
        (match) => ({
          before: "",
          replacedMatch: match[0],
          after: "",
        }),
        undefined,
        "code",
      )
    })
  }
}

// istanbul ignore next
export const AutoCode: QuartzTransformerPlugin = () => ({
  name: "AutoCode",
  htmlPlugins() {
    return [rehypeAutoCode]
  },
})
