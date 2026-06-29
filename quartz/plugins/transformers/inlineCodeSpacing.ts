import type { Element, ElementContent, Node, Parent, RootContent, Text } from "hast"
import type { Plugin } from "unified"

import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { maxAtomicInlineCodeLength } from "../../components/constants"
import { addClass, INLINE_PASSTHROUGH_TAGS } from "./utils"

// A short inline code reads as one token, so it wraps to the next line whole
// rather than breaking at an internal hyphen (e.g. `conic-gradient`). Longer
// codes stay breakable so they can't overflow a narrow container.
const ATOMIC_CODE_MAX_LENGTH = maxAtomicInlineCodeLength

// Total rendered text length of a node (recursing into inline children).
export function textLength(node: RootContent): number {
  if (node.type === "text") return (node as Text).value.length
  if (node.type === "element") {
    return (node as Element).children.reduce((sum, child) => sum + textLength(child), 0)
  }
  return 0
}

// Inline code's monospace glyph can crowd the word before it, so that word gets
// a hair of trailing space: a `margin-right` on a span wrapping the word (class
// `inline-code-gap`). A trailing margin collapses at a line end, so when the
// code wraps to the start of a line it sits flush there with no indent.
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

interface GapOp {
  parent: Parent
  index: number
  prevText: Text
}

/**
 * Rehype plugin for inline `<code>` (block code inside `<pre>` is untouched):
 *   - marks a short code `inline-code-atomic` so it wraps whole instead of
 *     breaking at an internal hyphen;
 *   - gives the word preceding a code a small right-margin gap (class
 *     `inline-code-gap`) so the monospace glyph doesn't crowd it. Adds no gap
 *     when the code follows a hugging delimiter (see `NO_GAP_PREDECESSORS`), a
 *     bare separator with no word to crowd, or starts its block.
 */
export const rehypeInlineCodeSpacing: Plugin = () => {
  return (tree: Node) => {
    const ops: GapOp[] = []
    visitParents(tree, "element", (node: Element, ancestors: Parent[]) => {
      if (node.tagName !== "code" || isInPre(ancestors)) return
      if (textLength(node) <= ATOMIC_CODE_MAX_LENGTH) addClass(node, "inline-code-atomic")
      const boundary = precedingBoundary(node, ancestors)
      if (!boundary || NO_GAP_PREDECESSORS.has(boundary.char)) return
      // `index` is always >= 1 here (the boundary char was found at a lower
      // sibling), so the preceding text node exists.
      const prev = boundary.parent.children[boundary.index - 1] as RootContent
      if (prev.type !== "text" || !/\S/u.test(prev.value)) return
      ops.push({ parent: boundary.parent, index: boundary.index, prevText: prev })
    })
    // Splice from the highest index down so earlier rewrites don't shift the
    // positions recorded for later ones.
    ops.sort((a, b) => b.index - a.index)
    for (const { parent, index, prevText } of ops) {
      const match = /(\S+)(\s*)$/u.exec(prevText.value)
      // istanbul ignore next -- the \S guard above guarantees a match
      if (!match) continue
      const [, word, trailingSpace] = match
      // A bare separator between two inline units — the ", " in `a`, `b`, `c`,
      // a lone dash, or closing punctuation like "); " — has no word for the
      // code to crowd, so add no gap.
      if (!/[\p{L}\p{N}]/u.test(word)) continue
      const head = prevText.value.slice(
        0,
        prevText.value.length - word.length - trailingSpace.length,
      )
      // Only the word carries the gap; the space between it and the code stays
      // text so the code can still wrap to the next line on its own.
      const replacement: ElementContent[] = []
      if (head) replacement.push({ type: "text", value: head })
      replacement.push({
        type: "element",
        tagName: "span",
        properties: { className: ["inline-code-gap"] },
        children: [{ type: "text", value: word }],
      })
      if (trailingSpace) replacement.push({ type: "text", value: trailingSpace })
      parent.children.splice(index - 1, 1, ...replacement)
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
