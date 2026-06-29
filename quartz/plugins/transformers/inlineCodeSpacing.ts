import type { Element, ElementContent, Node, Parent, RootContent, Text } from "hast"
import type { Plugin } from "unified"

import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import {
  ELLIPSIS,
  RIGHT_DOUBLE_QUOTE,
  RIGHT_GUILLEMET,
  RIGHT_SINGLE_QUOTE,
} from "../../components/constants"
import { addClass, INLINE_PASSTHROUGH_TAGS } from "./utils"

// Inline code gets a hair of leading space so its monospace glyph doesn't crowd
// the preceding word. The space is a `margin-left` on the code, but the code
// (and its preceding word) are wrapped in a `white-space: nowrap` span so the
// code can never fall to the start of a line — where the margin would indent
// it. A left margin alone is not enough: at a soft wrap some engines keep it
// and some drop it, so the only cross-engine guarantee is to keep the code off
// the line start entirely.
//
// These characters should instead hug the code that immediately follows them,
// so no gap is added: opening delimiters and the binding operators
// slash/hyphen/equals. A leading space would shadow them, so seeing one as the
// immediately-preceding character means it is glued to the code.
export const NO_GAP_PREDECESSORS: ReadonlySet<string> = new Set([
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

// A code's would-be preceding "word" that is only closing punctuation (e.g.
// `");"` between two adjacent code spans) belongs to the earlier content, not
// this code. Pulling it into the code's nowrap unit opens a break right before
// it, so the punctuation can orphan onto the code's line; leaving the code
// unwrapped keeps the punctuation attached to what it closes. Smart characters
// come from the typography SSOT in `config/constants.json`.
const CLOSING_PUNCTUATION_ONLY = new RegExp(
  `^[)\\]};:,.!?"'${RIGHT_SINGLE_QUOTE}${RIGHT_DOUBLE_QUOTE}${RIGHT_GUILLEMET}${ELLIPSIS}]+\\s*$`,
  "u",
)

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

interface Boundary {
  parent: Parent
  index: number
  char: string
}

// The character immediately before `node` in document order, with the index of
// the code's inline unit inside its parent. Ascends out of inline wrappers but
// never crosses a block boundary; returns null at the start of a block.
export function precedingBoundary(node: Element, ancestors: readonly Parent[]): Boundary | null {
  let child: Parent | Element = node
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const parent = ancestors[i]
    const index = parent.children.indexOf(child as ElementContent)
    for (let j = index - 1; j >= 0; j--) {
      const char = lastTextChar(parent.children[j])
      if (char !== null) return { parent, index, char }
    }
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

interface JoinOp {
  parent: Parent
  index: number
  prevText: Text
  unit: Element
}

/**
 * Rehype plugin that keeps inline `<code>` on its preceding word's line and
 * gives it a small left-margin gap. The preceding word and the code's inline
 * unit are moved into a `white-space: nowrap` span; the code (or its wrapping
 * link) carries `inline-code-gap`. No gap is added when the code is glued to a
 * hugging delimiter (see `NO_GAP_PREDECESSORS`) or starts its block, and block
 * code (inside `<pre>`) is untouched.
 */
export const rehypeInlineCodeSpacing: Plugin = () => {
  return (tree: Node) => {
    const ops: JoinOp[] = []
    visitParents(tree, "element", (node: Element, ancestors: Parent[]) => {
      if (node.tagName !== "code" || isInPre(ancestors)) return
      const boundary = precedingBoundary(node, ancestors)
      if (!boundary || NO_GAP_PREDECESSORS.has(boundary.char)) return
      // `index` is always >= 1 here (the boundary char was found at a lower
      // sibling), so both neighbours exist; the unit is the element we ascended
      // through (or the code itself).
      const prev = boundary.parent.children[boundary.index - 1] as RootContent
      const unit = boundary.parent.children[boundary.index] as Element
      if (prev.type !== "text" || !/\S/u.test(prev.value)) return
      ops.push({ parent: boundary.parent, index: boundary.index, prevText: prev, unit })
    })
    // Splice from the highest index down so earlier rewrites don't shift the
    // positions recorded for later ones.
    ops.sort((a, b) => b.index - a.index)
    for (const { parent, index, prevText, unit } of ops) {
      // The trailing word (plus any space separating it from the code) joins the
      // code; earlier text stays put so a break can still occur before the word.
      const match = /(\S+\s*)$/u.exec(prevText.value)
      // istanbul ignore next -- the \S guard above guarantees a match
      if (!match) continue
      const tail = match[1]
      if (CLOSING_PUNCTUATION_ONLY.test(tail)) continue
      const head = prevText.value.slice(0, prevText.value.length - tail.length)
      addClass(unit, "inline-code-gap")
      const span: Element = {
        type: "element",
        tagName: "span",
        properties: { className: ["inline-code-nowrap"] },
        children: [{ type: "text", value: tail }, unit],
      }
      const replacement: ElementContent[] = head ? [{ type: "text", value: head }, span] : [span]
      parent.children.splice(index - 1, 2, ...replacement)
    }
  }
}

// istanbul ignore next
export const InlineCodeSpacing: QuartzTransformerPlugin = () => ({
  name: "InlineCodeSpacing",
  htmlPlugins() {
    return [rehypeInlineCodeSpacing]
  },
})
