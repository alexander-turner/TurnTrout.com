import type { Element, ElementContent, Node, Parent, RootContent, Text } from "hast"
import type { Plugin } from "unified"

import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { INLINE_PASSTHROUGH_TAGS } from "./utils"

// Inline code gets a hair of leading space so its monospace glyph doesn't crowd
// the preceding word. The space is carried by a zero-width marker placed
// *before* the code rather than a left margin on the code itself: a trailing
// margin is discarded at a soft wrap, so when the code falls to the start of a
// line it sits flush with the text column instead of being indented.
//
// These characters should instead hug the code that immediately follows them,
// so no marker is inserted: opening delimiters and the binding operators
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

// Where to insert the leading-gap marker: immediately before the inline unit
// containing the code, at the level where the preceding character lives.
// Ascends out of inline wrappers but never crosses a block boundary; returns
// null at the start of a block (nothing is glued before the code).
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

function createGapMarker(): Element {
  return {
    type: "element",
    tagName: "span",
    properties: { className: ["inline-code-gap"], "aria-hidden": "true" },
    children: [],
  }
}

/**
 * Rehype plugin that gives inline `<code>` a small leading gap via a zero-width
 * marker inserted before it, so the code stays flush at a line/block start while
 * keeping breathing room mid-line. No marker is inserted when the code is glued
 * to a hugging delimiter (see `NO_GAP_PREDECESSORS`) or starts its block. Block
 * code (inside `<pre>`) is left untouched.
 */
export const rehypeInlineCodeSpacing: Plugin = () => {
  return (tree: Node) => {
    const insertions: Boundary[] = []
    visitParents(tree, "element", (node: Element, ancestors: Parent[]) => {
      if (node.tagName !== "code" || isInPre(ancestors)) return
      const boundary = precedingBoundary(node, ancestors)
      if (boundary && !NO_GAP_PREDECESSORS.has(boundary.char)) {
        insertions.push(boundary)
      }
    })
    // Splice from the highest index down so earlier insertions don't shift the
    // positions recorded for later ones.
    insertions.sort((a, b) => b.index - a.index)
    for (const { parent, index } of insertions) {
      parent.children.splice(index, 0, createGapMarker())
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
