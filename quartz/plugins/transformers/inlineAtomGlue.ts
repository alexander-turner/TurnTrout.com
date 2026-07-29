import type { Element, ElementContent, Root, Text } from "hast"

import { SKIP, visit } from "unist-util-visit"

import {
  ELLIPSIS,
  EMOJI_CLASS,
  FAVICON_CLASS,
  INLINE_IMG_CLASS,
  KATEX_CLASS,
  locale,
  NBSP,
  NOWRAP_SPAN_CLASS,
  RIGHT_DOUBLE_QUOTE,
  RIGHT_GUILLEMET,
  RIGHT_SINGLE_QUOTE,
} from "../../components/constants"
import { type QuartzTransformerPlugin } from "../types"
import { createNowrapSpan, hasClass } from "./utils"

/**
 * @module InlineAtomGlue
 *
 * @description
 * Browsers place a soft-wrap opportunity at each edge of an atomic inline box,
 * so an `<img>` or inline-block can shed its neighbors to the next line — any
 * following character, whatever its line-breaking class, as measured in
 * `inlineAtomQuoteWrap.spec.ts`. A word joiner lives inside a text run and so
 * cannot reach a box edge; only a `white-space: nowrap` box holding both sides
 * can close the opportunity.
 */

// Atoms whose left neighbor is glued too: each renders about one glyph wide, so
// binding it to the previous word costs no measurable line length. Membership is
// by class rather than tag because block figures are `<img>` as well.
const glyphAtomClasses: readonly string[] = [EMOJI_CLASS, FAVICON_CLASS, INLINE_IMG_CLASS]
const glyphAtomTags: ReadonlySet<string> = new Set(["img", "svg"])

/** True for a glyph-sized inline image: an emoji, a favicon, or an authored sprite. */
export function isGlyphAtom(node: Text | Element | undefined): boolean {
  if (node?.type !== "element" || !glyphAtomTags.has(node.tagName)) return false
  return glyphAtomClasses.some((className) => hasClass(node, className))
}

/** True for a span carrying the shared nowrap class. */
export function isNowrapSpan(node: ElementContent | undefined): boolean {
  return node?.type === "element" && node.tagName === "span" && hasClass(node, NOWRAP_SPAN_CLASS)
}

/**
 * True for anything that can adopt following punctuation. KaTeX renders inline
 * math as an inline-block with the same box-edge break, but its width is
 * unbounded, so it takes a trailing mark without ever adopting a preceding word.
 */
function acceptsTrailingGlue(node: Text | Element | undefined): boolean {
  if (node?.type !== "element") return false
  return isNowrapSpan(node) || isGlyphAtom(node) || hasClass(node, KATEX_CLASS)
}

// Closing punctuation: marks that belong to the word before them and so must
// never open a line. Straight quote forms appear because Twemoji glues before
// HTMLFormattingImprovement curls them. A run is glued as a unit, which is what
// carries the `,”` that punctilio produces by swapping a comma inside a quote.
const trailingGlueChars: ReadonlySet<string> = new Set([
  '"',
  "'",
  RIGHT_DOUBLE_QUOTE,
  RIGHT_SINGLE_QUOTE,
  RIGHT_GUILLEMET,
  ",",
  ".",
  ";",
  ":",
  "!",
  "?",
  ELLIPSIS,
  ")",
  "]",
  "}",
])

/** Length of the leading run of `value` that may not begin a line. */
function countLeadingGlue(value: string): number {
  let count = 0
  while (count < value.length && trailingGlueChars.has(value[count])) {
    count += 1
  }
  return count
}

// Gluing splits on graphemes, not code units: `slice(-1)` would cut an astral
// pair in half or tear a combining mark off its base letter, leaving both sides
// to render as their own broken glyph.
const graphemeSegmenter = new Intl.Segmenter(locale, { granularity: "grapheme" })

/** Splits `value` into everything before its final grapheme and that grapheme. */
export function splitLastGrapheme(value: string): { head: string; last: string } {
  let lastIndex = value.length
  for (const { index } of graphemeSegmenter.segment(value)) {
    lastIndex = index
  }
  return { head: value.slice(0, lastIndex), last: value.slice(lastIndex) }
}

/**
 * Returns the nowrap span holding `node`, promoting a bare atom into one and
 * replacing it at the tail of `siblings`. Returns undefined when `node` is not
 * something a trailing mark may join.
 */
function asNowrapSpan(
  node: Text | Element | undefined,
  siblings: (Text | Element)[],
): Element | undefined {
  if (isNowrapSpan(node)) return node as Element
  if (!acceptsTrailingGlue(node)) return undefined
  const span = createNowrapSpan([node as Element])
  siblings[siblings.length - 1] = span
  return span
}

/**
 * Glues every inline atom in `nodes` to the neighbors that may not sit alone at
 * a line edge: the immediately-preceding grapheme (whitespace becomes an NBSP)
 * and any run of closing punctuation that follows. Each glued run shares one
 * nowrap span.
 *
 * An atom preceded only by whitespace — the start of its run, or straight after
 * another element — keeps its left break opportunity, so emoji sequences still
 * wrap. Idempotent: a re-run sees spans rather than bare atoms.
 *
 * Gluing reaches siblings only. A span cannot span an element boundary, so an
 * atom ending an inline wrapper (`<em>word 🐟</em>”`) leaves the mark outside;
 * for links, `rearrangeLinkPunctuation` has already moved trailing quotes in.
 *
 * @param nodes - A parent's inline children, in document order
 * @returns The children with glue spans spliced in
 */
export function glueNodeSequence(nodes: (Text | Element)[]): (Text | Element)[] {
  const glued: (Text | Element)[] = []
  for (const node of nodes) {
    const prev = glued[glued.length - 1]

    if (isGlyphAtom(node)) {
      const value = prev?.type === "text" ? prev.value : ""
      // Whitespace-only text means the atom follows another element, not a
      // word; leave it breakable. Glue only to real preceding text.
      if (value.trim() !== "") {
        const { head, last } = splitLastGrapheme(value)
        ;(prev as Text).value = head
        if (head === "") glued.pop()
        const glyph = /^\s+$/u.test(last) ? NBSP : last
        glued.push(createNowrapSpan([{ type: "text", value: glyph }, node]))
        continue
      }
    }

    if (node.type === "text") {
      const glueLength = countLeadingGlue(node.value)
      const span = glueLength > 0 ? asNowrapSpan(prev, glued) : undefined
      if (span) {
        span.children.push({ type: "text", value: node.value.slice(0, glueLength) } as Text)
        node.value = node.value.slice(glueLength)
        if (node.value === "") continue
      }
    }

    glued.push(node)
  }
  return glued
}

// Whitespace is content inside these, so folding a newline into an NBSP would
// weld two source lines together. Nothing in them wraps on a quote either.
const preformattedTags: ReadonlySet<string> = new Set(["pre", "code"])

/**
 * Applies `glueNodeSequence` to every element's children. A nowrap span's own
 * children are already one unbreakable run, so it is skipped entirely.
 */
export function glueInlineAtoms(tree: Root): void {
  tree.children = glueNodeSequence(tree.children as (Text | Element)[]) as ElementContent[]
  visit(tree, "element", (node: Element) => {
    if (isNowrapSpan(node) || preformattedTags.has(node.tagName)) return SKIP
    node.children = glueNodeSequence(node.children as (Text | Element)[]) as ElementContent[]
    return undefined
  })
}

/**
 * Runs late so every producer of inline atoms — Twemoji, AddFavicons, KaTeX,
 * and authored `inline-img` markup — has already emitted its elements.
 */
export const InlineAtomGlue: QuartzTransformerPlugin = () => ({
  name: "InlineAtomGlue",
  htmlPlugins() {
    return [() => glueInlineAtoms]
  },
})
