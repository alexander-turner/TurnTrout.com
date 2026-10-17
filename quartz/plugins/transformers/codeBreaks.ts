import type { Element, ElementContent, Root, Text } from "hast"

import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

/**
 * @module CodeBreaks
 *
 * @description
 * A long code token wraps only where the line breaker sees an opportunity, and
 * code's punctuation offers almost none: no break follows `/`, `=`, `(`, or `,`,
 * nor precedes a member-access `.`. Lacking one, the token wraps at an
 * arbitrary character through `overflow-wrap`, stranding a fragment like `)` or
 * `onc` on its own row. A `<wbr>` at the token's seams gives the line breaker a
 * readable place to break first, and adds nothing to the text a reader selects,
 * copies, or searches.
 */

/** Decides whether a line may break before `text[index]`. */
export type BreakRule = (text: string, index: number) => boolean

const SPACE = /\s/u
// Characters that continue an operator begun by `=` (`==`, `=>`).
const CONTINUES_EQUALS: ReadonlySet<string> = new Set(["=", ">"])

const isSegmentChar = (char: string | undefined): boolean =>
  char !== undefined && char !== "/" && !SPACE.test(char)

/**
 * After a slash joining two path segments: `owner/repo`, `src/utils.ts`. A
 * slash that opens the path or follows another (`https://`) keeps its segment.
 */
export const breaksAfterPathSlash: BreakRule = (text, index) =>
  text[index - 1] === "/" && isSegmentChar(text[index - 2]) && isSegmentChar(text[index])

// A member access: `self.latent_size`, `x).float()`, `.jsonc`, but not `1.5`.
const BEFORE_MEMBER = /[\p{L}\p{N}_)\]]/u
const MEMBER_START = /[\p{L}_]/u

/**
 * After a separator joining two segments (`/`, `=`, `,`, `(`), or before a
 * member-access dot.
 */
export const breaksInCodeBlock: BreakRule = (text, index) => {
  const [prev, next] = [text[index - 1], text[index]]
  if (next === undefined || SPACE.test(next)) return false
  if (prev === "/") return breaksAfterPathSlash(text, index)
  if (prev === "=") return !CONTINUES_EQUALS.has(next)
  if (prev === "(") return next !== ")"
  if (prev === ",") return true
  return next === "." && BEFORE_MEMBER.test(prev) && MEMBER_START.test(text[index + 1] ?? "")
}

const wbr = (): Element => ({ type: "element", tagName: "wbr", properties: {}, children: [] })

/** Text nodes under ``node`` in document order, with their parents. */
function textNodesOf(node: Element): { parent: Element; text: Text }[] {
  const found: { parent: Element; text: Text }[] = []
  for (const child of node.children) {
    if (child.type === "text") found.push({ parent: node, text: child })
    else if (child.type === "element") found.push(...textNodesOf(child))
  }
  return found
}

/**
 * Insert a `<wbr>` at each boundary inside ``container`` where ``rule`` allows a
 * break. The rule reads the container's whole text, since syntax highlighting
 * puts each token in its own span; a break on a span boundary goes at the start
 * of the following text node.
 *
 * @returns The number of `<wbr>` elements inserted.
 */
export function insertCodeBreaks(container: Element, rule: BreakRule): number {
  const nodes = textNodesOf(container)
  const text = nodes.map(({ text }) => text.value).join("")
  let inserted = 0
  let start = 0
  for (const { parent, text: node } of nodes) {
    const { value } = node
    const cuts: number[] = []
    for (let i = 0; i < value.length; i++) {
      if (start + i > 0 && rule(text, start + i)) cuts.push(i)
    }
    start += value.length
    if (cuts.length === 0) continue

    const pieces: ElementContent[] = []
    let from = 0
    for (const cut of cuts) {
      if (cut > from) pieces.push({ type: "text", value: value.slice(from, cut) })
      pieces.push(wbr())
      from = cut
    }
    pieces.push({ type: "text", value: value.slice(from) })
    parent.children.splice(parent.children.indexOf(node), 1, ...pieces)
    inserted += cuts.length
  }
  return inserted
}

/** Rehype pass giving each code-block line its break opportunities. */
export function rehypeCodeBlockBreaks(tree: Root): void {
  visitParents(tree, "element", (node: Element, ancestors) => {
    if (node.properties?.dataLine === undefined) return
    const inPre = ancestors.some(
      (ancestor) => ancestor.type === "element" && (ancestor as Element).tagName === "pre",
    )
    if (inPre) insertCodeBreaks(node, breaksInCodeBlock)
  })
}

// istanbul ignore next
export const CodeBlockBreaks: QuartzTransformerPlugin = () => ({
  name: "CodeBlockBreaks",
  htmlPlugins() {
    return [() => rehypeCodeBlockBreaks]
  },
})
