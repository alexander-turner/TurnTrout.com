import type { Element, ElementContent, Node, Parent, RootContent, Text } from "hast"
import type { Plugin } from "unified"

import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import {
  INLINE_CODE_BREAKABLE_CLASS,
  maxHeldInlineCodeSegmentLength,
  minInlineCodeFragment,
} from "../../components/constants"
import { type BreakRule, breaksInCodeBlock, insertCodeBreaks } from "./codeBreaks"
import { addClass, INLINE_PASSTHROUGH_TAGS, ITALIC_TAGS, wrapCharsInSpan } from "./utils"

// Inline code's monospace glyph can crowd the word before it, so that word's
// last glyph gets a right margin. The gap is CSS rather than a space character so the text a
// reader searches for, selects, or copies holds a single space between the word
// and the code.
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

const SPACE = /\s/u

// A code seam (see `breaksInCodeBlock`), except before a member-access dot:
// inline code is mostly file names and domains, whose `.md` or `.com` reads
// badly alone. A dotfile after a slash (`lint/.markdownlint`) still breaks.
const isInlineSeam = (text: string, index: number): boolean =>
  (text[index] !== "." || text[index - 1] === "/") && breaksInCodeBlock(text, index)

// A fragment of inline code runs between seams and spaces.
const startsFragment = (text: string, index: number): boolean =>
  SPACE.test(text[index - 1]) || isInlineSeam(text, index)

/**
 * At an inline seam, unless either fragment it would leave at a line edge is
 * shorter than `minInlineCodeFragment`: `r/` and `f(` stay with what follows
 * them, and `a` with what precedes it.
 */
export const breaksInInlineCode: BreakRule = (text, index) => {
  if (!isInlineSeam(text, index)) return false
  let start = index - 1
  while (start > 0 && !startsFragment(text, start)) start--
  let end = index + 1
  while (end < text.length && !SPACE.test(text[end]) && !startsFragment(text, end)) end++
  return Math.min(index - start, end - index) >= minInlineCodeFragment
}

const heldSpan = (value: string): Element => ({
  type: "element",
  tagName: "span",
  properties: { className: ["code-segment"] },
  children: [{ type: "text", value }],
})

// A hyphen offers a line break, so a code would break inside a segment like
// `alexander-turner` rather than at its seam. A segment short enough to fit a
// line is held whole; a longer one keeps its hyphen breaks so it can't overflow.
function holdHyphenatedSegments(code: Element): void {
  code.children = code.children.map((child) =>
    child.type === "text" &&
    child.value.includes("-") &&
    child.value.length <= maxHeldInlineCodeSegmentLength
      ? heldSpan(child.value)
      : child,
  )
}

/**
 * Ranges of ``value`` to hold whole so no hyphen break leaves a fragment shorter
 * than `minInlineCodeFragment` at a line edge (`--` | `sandbox`, `a-` | `b`).
 * A fragment runs between hyphen breaks and spaces.
 */
export function shortHyphenFragmentRanges(value: string): [number, number][] {
  const breaks = [...value.matchAll(/-+(?=[^\s-])/gu)].map((m) => m.index + m[0].length)
  const bounds = new Set([0, value.length, ...breaks])
  for (const m of value.matchAll(/\s+/gu)) {
    bounds.add(m.index)
    bounds.add(m.index + m[0].length)
  }
  const sorted = [...bounds].sort((a, b) => a - b)
  const ranges: [number, number][] = []
  for (const at of breaks) {
    const i = sorted.indexOf(at)
    const [start, end] = [sorted[i - 1], sorted[i + 1]]
    if (Math.min(at - start, end - at) >= minInlineCodeFragment) continue
    const last = ranges.at(-1)
    // Two holds sharing a fragment merge; holds that only touch keep the break between them.
    if (last && last[1] > start) last[1] = end
    else ranges.push([start, end])
  }
  return ranges.filter(([start, end]) => end - start <= maxHeldInlineCodeSegmentLength)
}

function holdShortHyphenFragments(code: Element): void {
  code.children = code.children.flatMap((child): ElementContent[] => {
    if (child.type !== "text") return [child]
    const ranges = shortHyphenFragmentRanges(child.value)
    if (ranges.length === 0) return [child]
    const pieces: ElementContent[] = []
    let cursor = 0
    for (const [start, end] of ranges) {
      if (start > cursor) pieces.push({ type: "text", value: child.value.slice(cursor, start) })
      pieces.push(heldSpan(child.value.slice(start, end)))
      cursor = end
    }
    if (cursor < child.value.length) pieces.push({ type: "text", value: child.value.slice(cursor) })
    return pieces
  })
}

function isInPre(ancestors: readonly Parent[]): boolean {
  return ancestors.some(
    (ancestor) => ancestor.type === "element" && (ancestor as Element).tagName === "pre",
  )
}

// Italic monospace glyphs lean rightward, opening visual space on the code's
// left edge on their own — an added gap there overshoots.
function isItalicized(ancestors: readonly Parent[]): boolean {
  return ancestors.some(
    (ancestor) => ancestor.type === "element" && ITALIC_TAGS.has((ancestor as Element).tagName),
  )
}

/**
 * Rehype plugin for inline `<code>` (block code inside `<pre>` is untouched):
 *   - lets the code break in place at its seams (see `breaksInInlineCode`),
 *     holds each short hyphenated segment between them whole, and marks it
 *     `inline-code-breakable`; holds any hyphen break that would leave a
 *     short fragment (see `shortHyphenFragmentRanges`);
 *   - wraps the last character of the word a code's monospace glyph would crowd
 *     in a `code-gap-after` span, which carries the gap in CSS. Adds no gap when
 *     the code is italicized (its leaning glyphs open the space themselves),
 *     follows a hugging delimiter (see `NO_GAP_PREDECESSORS`), follows a bare
 *     separator with no word to crowd, or starts its block.
 */
export const rehypeInlineCodeSpacing: Plugin = () => {
  return (tree: Node) => {
    const gaps: { parent: Parent; node: Text; offset: number }[] = []

    visitParents(tree, "element", (node: Element, ancestors: Parent[]) => {
      if (node.tagName !== "code" || isInPre(ancestors)) return
      if (insertCodeBreaks(node, breaksInInlineCode) > 0) {
        addClass(node, INLINE_CODE_BREAKABLE_CLASS)
        holdHyphenatedSegments(node)
      }
      holdShortHyphenFragments(node)
      if (isItalicized(ancestors)) return
      const boundary = precedingBoundary(node, ancestors)
      if (!boundary || NO_GAP_PREDECESSORS.has(boundary.char)) return
      // `index` is always >= 1 here (the boundary char was found at a lower
      // sibling), so the preceding text node exists.
      const prev = boundary.parent.children[boundary.index - 1] as RootContent
      if (prev.type !== "text" || !/\S/u.test(prev.value)) return
      const match = /(\S+)(\s*)$/u.exec(prev.value)
      // istanbul ignore next -- the \S guard above guarantees a match
      if (!match) return
      const [, word, trailing] = match
      // A bare separator between two inline units — the ", " in `a`, `b`, `c`,
      // a lone dash, or closing punctuation like "); " — has no word for the
      // code to crowd, so add no gap.
      if (!/[\p{L}\p{N}]/u.test(word)) return
      // The gap rides the word's last glyph rather than the code's leading edge,
      // so a line breaking at the space between them leaves the code flush with
      // the line start.
      const offset = prev.value.length - trailing.length - 1
      gaps.push({ parent: boundary.parent, node: prev, offset })
    })

    // Applied after the walk, so splicing siblings can't disturb the traversal.
    for (const { parent, node, offset } of gaps) {
      wrapCharsInSpan(parent, node, [{ offset, className: "code-gap-after" }])
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
