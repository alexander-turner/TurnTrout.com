import type { Element, ElementContent, Node, Parent, RootContent, Text } from "hast"
import type { Plugin } from "unified"

import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { addClass } from "./utils"

// Inline code carries a small default left margin (see `fonts.scss`) so its
// monospace leading glyph doesn't crowd the preceding word. That margin is
// wrong when one of these characters is glued directly before the code: opening
// delimiters should hug their contents, and slash/hyphen/equals bind their
// operands tightly. A leading space would shadow the character here, so seeing
// one of these as the immediately-preceding character means it is glued.
export const FLUSH_LEFT_PREDECESSORS: ReadonlySet<string> = new Set([
  "(",
  "[",
  "{",
  "“",
  "‘",
  '"',
  "'",
  "«",
  "¿",
  "¡",
  "/",
  "-",
  "=",
])

// Inline wrappers we ascend through when looking backwards for the preceding
// character: the code may sit inside a link/emphasis whose own start coincides
// with the start of the code (e.g. `of [`code`](…)`).
const INLINE_PASSTHROUGH_TAGS: ReadonlySet<string> = new Set([
  "a",
  "em",
  "strong",
  "i",
  "b",
  "del",
  "s",
  "ins",
  "abbr",
  "sub",
  "sup",
  "mark",
  "small",
  "span",
  "u",
])

// Last rendered character of a node (recursing into inline children), or null
// when it contributes no text.
export function lastTextChar(node: RootContent): string | null {
  if (node.type === "text") {
    const value = (node as Text).value
    return value.length ? value[value.length - 1] : null
  }
  if (node.type === "element") {
    const { children } = node as Element
    for (let i = children.length - 1; i >= 0; i--) {
      const char = lastTextChar(children[i])
      if (char !== null) return char
    }
  }
  return null
}

// The character immediately before `node` in document order, ascending out of
// inline wrappers but never crossing a block boundary. Returns null at the
// start of a block (no glued predecessor).
export function precedingChar(node: Element, ancestors: readonly Parent[]): string | null {
  let child: Parent | Element = node
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const parent = ancestors[i]
    const index = parent.children.indexOf(child as ElementContent)
    for (let j = index - 1; j >= 0; j--) {
      const char = lastTextChar(parent.children[j])
      if (char !== null) return char
    }
    // Stop at the first non-inline container: its earlier siblings live in a
    // different block and never sit glued against this code.
    if (parent.type !== "element" || !INLINE_PASSTHROUGH_TAGS.has((parent as Element).tagName)) {
      return null
    }
    child = parent
  }
  return null
}

function isInPre(ancestors: readonly Parent[]): boolean {
  return ancestors.some(
    (ancestor) => ancestor.type === "element" && (ancestor as Element).tagName === "pre",
  )
}

/**
 * Rehype plugin that flags inline `<code>` glued directly behind a delimiter
 * that should hug its contents (opening bracket/quote, slash, hyphen, equals)
 * so its default left margin can be removed. Block code (inside `<pre>`) is
 * left untouched.
 */
export const rehypeInlineCodeSpacing: Plugin = () => {
  return (tree: Node) => {
    visitParents(tree, "element", (node: Element, ancestors: Parent[]) => {
      if (node.tagName !== "code" || isInPre(ancestors)) return
      const prev = precedingChar(node, ancestors)
      if (prev !== null && FLUSH_LEFT_PREDECESSORS.has(prev)) {
        addClass(node, "flush-left")
      }
    })
  }
}

// istanbul ignore next
export const InlineCodeSpacing: QuartzTransformerPlugin = () => ({
  name: "InlineCodeSpacing",
  htmlPlugins() {
    return [rehypeInlineCodeSpacing]
  },
})
