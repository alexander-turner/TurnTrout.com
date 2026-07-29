import type { Element, ElementContent, Root, Text } from "hast"

import { h } from "hastscript"
import { visit } from "unist-util-visit"

import {
  EMOJI_CLASS,
  FAVICON_CLASS,
  INLINE_IMG_CLASS,
  KATEX_CLASS,
  NBSP,
  NOWRAP_SPAN_CLASS,
  RIGHT_DOUBLE_QUOTE,
  RIGHT_GUILLEMET,
  RIGHT_SINGLE_QUOTE,
} from "../../components/constants"
import { type QuartzTransformerPlugin } from "../types"
import { hasClass } from "./utils"

/**
 * @module InlineAtomGlue
 *
 * @description
 * A glyph-sized inline image is an atomic box, and UAX #14 puts a break
 * opportunity on both of its edges (LB20, `÷ CB` / `CB ÷`). A word joiner lives
 * inside a text run and so cannot close a break at a box edge; only a
 * `white-space: nowrap` box holding both sides can.
 *
 * Rule order decides which neighbors need that box. LB13 (`× CL`, `× CP`,
 * `× IS`) is evaluated before LB20, so `)`, `]`, `.` and `,` may never begin a
 * line no matter what precedes them. Quotation marks are class QU, protected
 * only by LB19, which is evaluated after LB20 and therefore loses: a closing
 * quote right after an atom is free to start the next line. Letters have no
 * protection at all, which is why a preceding word also needs gluing.
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

/** True for a span already carrying the shared nowrap class. */
export function isNowrapSpan(node: Text | Element | undefined): boolean {
  return node?.type === "element" && hasClass(node, NOWRAP_SPAN_CLASS)
}

/**
 * True for anything that can adopt a following quote. KaTeX renders inline math
 * as an inline-block with the same box-edge break, but its width is unbounded,
 * so it takes a trailing quote without ever adopting a preceding word.
 */
function acceptsTrailingGlue(node: Text | Element | undefined): boolean {
  if (node?.type !== "element") return false
  return isNowrapSpan(node) || isGlyphAtom(node) || hasClass(node, KATEX_CLASS)
}

// Quotes and guillemets are the whole set: every other closing mark is class
// CL/CP/IS and already barred from starting a line by LB13. Straight forms
// appear because Twemoji runs before HTMLFormattingImprovement curls them.
const trailingGlueChars: ReadonlySet<string> = new Set([
  '"',
  "'",
  RIGHT_DOUBLE_QUOTE,
  RIGHT_SINGLE_QUOTE,
  RIGHT_GUILLEMET,
])

/** Length of the leading run of `value` that may not begin a line. */
export function countLeadingGlue(value: string): number {
  let count = 0
  while (count < value.length && trailingGlueChars.has(value[count])) {
    count += 1
  }
  return count
}

/**
 * Returns the nowrap span holding `node`, promoting a bare atom into one and
 * replacing it at the tail of `siblings`. Returns undefined when `node` is not
 * something a trailing quote may join.
 */
function asNowrapSpan(
  node: Text | Element | undefined,
  siblings: (Text | Element)[],
): Element | undefined {
  if (isNowrapSpan(node)) return node as Element
  if (!acceptsTrailingGlue(node)) return undefined
  const span = h(`span.${NOWRAP_SPAN_CLASS}`, [node as Element])
  siblings[siblings.length - 1] = span
  return span
}

/**
 * Glues every inline atom in `nodes` to the neighbors that may not sit alone at
 * a line edge: the immediately-preceding glyph (a plain space becomes an NBSP)
 * and any run of closing quotes that follows. Each glued run shares one nowrap
 * span.
 *
 * An atom with no preceding glyph — the start of its run, or straight after
 * another atom — keeps its left break opportunity, so emoji sequences still
 * wrap. Idempotent: a re-run sees spans rather than bare atoms.
 *
 * @param nodes - A parent's inline children, in document order
 * @returns The children with glue spans spliced in
 */
export function glueNodeSequence(nodes: (Text | Element)[]): (Text | Element)[] {
  const glued: (Text | Element)[] = []
  for (const node of nodes) {
    const prev = glued[glued.length - 1]

    if (isGlyphAtom(node)) {
      const lastChar = prev?.type === "text" ? prev.value.slice(-1) : ""
      const remaining = prev?.type === "text" ? prev.value.slice(0, -1) : ""
      // A lone leading space means the atom follows another element, not a
      // word; leave it breakable. Glue only to real preceding text.
      if (lastChar && !(lastChar === " " && remaining === "")) {
        const glyph = lastChar === " " ? NBSP : lastChar
        ;(prev as Text).value = remaining
        if (remaining === "") glued.pop()
        glued.push(h(`span.${NOWRAP_SPAN_CLASS}`, [{ type: "text", value: glyph } as Text, node]))
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

/**
 * Applies `glueNodeSequence` to every element's children. A nowrap span's own
 * children are already a single unbreakable run, so it is left alone.
 */
export function glueInlineAtoms(tree: Root): void {
  visit(tree, "element", (node: Element) => {
    if (isNowrapSpan(node)) return
    node.children = glueNodeSequence(node.children as (Text | Element)[]) as ElementContent[]
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
