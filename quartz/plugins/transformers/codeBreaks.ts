import type { Element, ElementContent, Root, Text } from "hast"

import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { maxWholeCodeTokenLength, maxWholeCodeTokenLengthWide } from "../../components/constants"

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
 *
 * The line breaker takes the last opportunity that fits, so a `<wbr>` inside
 * the next token would win over the space before it. Each such token is
 * therefore an inline-block: it moves to the next row whole when it fits there,
 * and breaks at its seams only when wider than a row.
 */

/** Decides whether a line may break before `text[index]`. */
export type BreakRule = (text: string, index: number) => boolean

const SPACE = /\s/u
// Characters that continue an operator begun by `=` (`==`, `=>`).
const CONTINUES_EQUALS: ReadonlySet<string> = new Set(["=", ">"])

// Characters that make up a path segment; markup like `</tag>` has none
// before its slash.
const PATH_CHAR = /[\p{L}\p{N}_.~-]/u

const isPathChar = (char: string | undefined): boolean => char !== undefined && PATH_CHAR.test(char)

/**
 * After a slash joining two path segments: `owner/repo`, `src/utils.ts`. A
 * slash that opens the path, follows another (`https://`), or closes a tag
 * (`</analysis>`) keeps its segment.
 */
export const breaksAfterPathSlash: BreakRule = (text, index) =>
  text[index - 1] === "/" && isPathChar(text[index - 2]) && isPathChar(text[index])

// A member access: `self.latent_size`, `x).float()`, `.jsonc`, but not `1.5`.
const BEFORE_MEMBER = /[\p{L}\p{N}_)\]]/u
const MEMBER_START = /[\p{L}_]/u

// Between two words of an identifier: `Inner|Outer`, `HTML|Parser`,
// `Turner|2022|Against`, `max_|token`. Sticky, so its lookbehinds read the
// text before `lastIndex`.
const WORD_SEAM =
  /(?<=\p{Ll})(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})|(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})|(?<=[\p{L}\p{N}]_)(?=[\p{L}\p{N}])/uy
const IDENTIFIER_TAIL = /[\p{L}\p{N}_]*$/u
const IDENTIFIER_END = /[^\p{L}\p{N}_]|$/u

/**
 * Between two words of an identifier longer than `maxWholeCodeTokenLength`. A
 * shorter identifier stays whole.
 */
export const breaksInLongIdentifier: BreakRule = (text, index) => {
  WORD_SEAM.lastIndex = index
  if (!WORD_SEAM.test(text)) return false
  const before = text.slice(0, index)
  const length =
    before.length - before.search(IDENTIFIER_TAIL) + text.slice(index).search(IDENTIFIER_END)
  return length > maxWholeCodeTokenLength
}

/**
 * After a separator joining two segments (`/`, `=`, `,`, `(`), before a
 * member-access dot, or between the words of a long identifier.
 */
export const breaksInCodeBlock: BreakRule = (text, index) => {
  const [prev, next] = [text[index - 1], text[index]]
  if (next === undefined || SPACE.test(next)) return false
  if (prev === "/") return breaksAfterPathSlash(text, index)
  if (prev === "=") return !CONTINUES_EQUALS.has(next)
  if (prev === "(") return next !== ")"
  if (prev === ",") return true
  if (next === ".") return BEFORE_MEMBER.test(prev) && MEMBER_START.test(text[index + 1] ?? "")
  return breaksInLongIdentifier(text, index)
}

const wbr = (): Element => ({ type: "element", tagName: "wbr", properties: {}, children: [] })

/**
 * Insert a `<wbr>` at each boundary inside ``container`` where ``rule`` allows a
 * break. The rule reads the container's whole text, since syntax highlighting
 * puts each token in its own span; a break on a span boundary goes at the start
 * of the following text node.
 *
 * @returns The number of `<wbr>` elements inserted.
 */
export function insertCodeBreaks(container: Element, rule: BreakRule): number {
  const nodes = leavesOf(container).flatMap(({ node, chain }) =>
    node.type === "text" ? [{ parent: chain.at(-1) ?? container, text: node }] : [],
  )
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

interface Leaf {
  node: ElementContent
  // The elements between the line and this leaf, outermost first.
  chain: readonly Element[]
}

function leavesOf(node: Element, chain: readonly Element[] = []): Leaf[] {
  return node.children.flatMap((child) =>
    child.type === "element" && child.children.length > 0
      ? leavesOf(child, [...chain, child])
      : [{ node: child, chain }],
  )
}

/** Rebuilds leaves under copies of their elements, sharing a copy between neighbors. */
function rebuild(leaves: readonly Leaf[], depth = 0): ElementContent[] {
  const nodes: ElementContent[] = []
  let i = 0
  while (i < leaves.length) {
    const wrapper = leaves[i].chain.at(depth)
    if (wrapper === undefined) {
      nodes.push(leaves[i].node)
      i++
      continue
    }
    let end = i
    while (end < leaves.length && leaves[end].chain.at(depth) === wrapper) end++
    nodes.push({
      ...wrapper,
      properties: structuredClone(wrapper.properties),
      children: rebuild(leaves.slice(i, end), depth + 1),
    })
    i = end
  }
  return nodes
}

interface Run {
  space: boolean
  leaves: Leaf[]
}

/** Splits leaves into alternating whitespace and token runs. */
function runsOf(leaves: readonly Leaf[]): Run[] {
  const runs: Run[] = []
  for (const leaf of leaves) {
    const parts =
      leaf.node.type === "text"
        ? (leaf.node.value.match(/\s+|\S+/gu) ?? []).map((value) => ({
            node: { type: "text", value } as Text,
            space: SPACE.test(value),
          }))
        : [{ node: leaf.node, space: false }]
    for (const { node, space } of parts) {
      const last = runs.at(-1)
      if (last?.space === space) last.leaves.push({ node, chain: leaf.chain })
      else runs.push({ space, leaves: [{ node, chain: leaf.chain }] })
    }
  }
  return runs
}

const isWbr = (node: ElementContent): boolean => node.type === "element" && node.tagName === "wbr"

/**
 * Classes for a token run that should move to the next row whole, or null to
 * leave it inline. The line's first token stays inline, since moving it would
 * strand the line's indentation on a row of its own; so does a token too long
 * to fit a row.
 */
function tokenClasses(run: Run, isFirstToken: boolean): string[] | null {
  if (run.space || isFirstToken || !run.leaves.some(({ node }) => isWbr(node))) return null
  const length = run.leaves.reduce(
    (sum, { node }) => sum + (node.type === "text" ? node.value.length : 0),
    0,
  )
  if (length > maxWholeCodeTokenLengthWide) return null
  return length > maxWholeCodeTokenLength ? ["code-token", "code-token-wide"] : ["code-token"]
}

/** Wraps each of ``line``'s tokens that holds a `<wbr>` in a `code-token` span. */
export function wrapCodeTokens(line: Element): void {
  const runs = runsOf(leavesOf(line))
  const firstToken = runs.find((run) => !run.space)
  const classes = runs.map((run) => tokenClasses(run, run === firstToken))
  if (classes.every((className) => className === null)) return

  const children: ElementContent[] = []
  let pending: Leaf[] = []
  runs.forEach((run, i) => {
    const className = classes[i]
    if (className === null) {
      pending.push(...run.leaves)
      return
    }
    children.push(...rebuild(pending), {
      type: "element",
      tagName: "span",
      properties: { className },
      children: rebuild(run.leaves),
    })
    pending = []
  })
  children.push(...rebuild(pending))
  line.children = children
}

/** Rehype pass giving each code-block line its break opportunities. */
export function rehypeCodeBlockBreaks(tree: Root): void {
  visitParents(tree, "element", (node: Element, ancestors) => {
    if (node.properties?.dataLine === undefined) return
    const inPre = ancestors.some(
      (ancestor) => ancestor.type === "element" && (ancestor as Element).tagName === "pre",
    )
    if (inPre && insertCodeBreaks(node, breaksInCodeBlock) > 0) wrapCodeTokens(node)
  })
}

// istanbul ignore next
export const CodeBlockBreaks: QuartzTransformerPlugin = () => ({
  name: "CodeBlockBreaks",
  htmlPlugins() {
    return [() => rehypeCodeBlockBreaks]
  },
})
