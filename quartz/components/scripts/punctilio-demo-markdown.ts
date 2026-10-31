import type { Parents, Root, RootContent, Text } from "mdast"
import type { Node } from "unist"

import { diffChars } from "diff"
import { parse, postprocess, preprocess } from "micromark"
import { gfm } from "micromark-extension-gfm"
import { decodeString } from "micromark-util-decode-string"
import { type TransformOptions } from "punctilio"
import { remarkPunctilio } from "punctilio/remark"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visitParents } from "unist-util-visit-parents"

interface SourceRange {
  readonly start: number
  readonly end: number
}

/** A token that contributes `text` to a text node's value. */
export interface SourcePiece extends SourceRange {
  readonly text: string
  /** Whether `text` is the source slice itself, one character per character. */
  readonly literal: boolean
}

interface SourceEdit extends SourceRange {
  readonly text: string
}

/** Where each UTF-16 unit of a text node's value came from in the source. */
export interface ValueSourceMap {
  readonly starts: readonly number[]
  readonly ends: readonly number[]
}

/**
 * Tokenize with micromark, the tokenizer underneath remark-parse, and keep the
 * tokens that mdast-util-from-markdown concatenates into text node values:
 * literal data, line endings, character escapes, and character references.
 * Container syntax (blockquote markers, indentation, hard-break markers) gets
 * its own tokens and so never appears among the pieces.
 */
export function tokenizeSource(source: string): {
  readonly pieces: readonly SourcePiece[]
  readonly autolinks: readonly SourceRange[]
} {
  const chunks = preprocess()(source, undefined, true)
  const events = postprocess(
    parse({ extensions: [gfm()] })
      .document()
      .write(chunks),
  )
  const pieces: SourcePiece[] = []
  const autolinks: SourceRange[] = []
  for (const [kind, token, context] of events) {
    if (kind !== "exit") continue
    const range = { start: token.start.offset, end: token.end.offset }
    const raw = context.sliceSerialize(token)
    // GFM token names are not in micromark's typed token map.
    switch (token.type as string) {
      case "data":
      case "lineEnding":
        pieces.push({ ...range, text: raw, literal: true })
        break
      case "characterEscape":
        pieces.push({ ...range, text: raw.slice(1), literal: false })
        break
      case "characterReference":
        pieces.push({ ...range, text: decodeString(raw), literal: false })
        break
      case "autolink":
      case "literalAutolink":
        autolinks.push(range)
        break
    }
  }
  return { pieces, autolinks }
}

/** Expand a text node's pieces into a per-unit source map, checking them against its value. */
export function mapValueToSource(value: string, pieces: readonly SourcePiece[]): ValueSourceMap {
  const tokenized = pieces.map((piece) => piece.text).join("")
  if (tokenized !== value) {
    throw new Error(
      `Tokens ${JSON.stringify(tokenized)} do not match Markdown text ${JSON.stringify(value)}`,
    )
  }
  const starts: number[] = []
  const ends: number[] = []
  for (const piece of pieces) {
    for (let unit = 0; unit < piece.text.length; unit++) {
      starts.push(piece.literal ? piece.start + unit : piece.start)
      ends.push(piece.literal ? piece.start + unit + 1 : piece.end)
    }
  }
  return { starts, ends }
}

/**
 * Restrict a literal piece to a text node's range. mdast-util-from-markdown
 * trims some data at node edges (the space after a GFM task-list checkbox)
 * by moving the node's start offset into the token.
 */
export function clipPiece(piece: SourcePiece, range: SourceRange): SourcePiece {
  if (!piece.literal) return piece
  const start = Math.max(piece.start, range.start)
  const end = Math.min(piece.end, range.end)
  return {
    start,
    end,
    text: piece.text.slice(start - piece.start, end - piece.start),
    literal: true,
  }
}

/** Source edits that turn a text node's original value into its transformed value. */
export function textNodeEdits(
  { starts, ends }: ValueSourceMap,
  original: string,
  transformed: string,
): SourceEdit[] {
  const edits: SourceEdit[] = []
  const changes = diffChars(original, transformed)
  let valueIndex = 0
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    if (!change.added && !change.removed) {
      valueIndex += change.value.length
      continue
    }
    if (change.added) {
      const position = valueIndex < starts.length ? starts[valueIndex] : ends[ends.length - 1]
      edits.push({ start: position, end: position, text: change.value })
      continue
    }
    const next = changes[i + 1]
    const replacement = next?.added ? next.value : ""
    if (next?.added) i++
    const after = valueIndex + change.value.length
    // A removed line break takes the next line's container prefix with it.
    const end =
      change.value.endsWith("\n") && after < starts.length ? starts[after] : ends[after - 1]
    edits.push({ start: starts[valueIndex], end, text: replacement })
    valueIndex = after
  }
  return edits
}

/** Pieces overlapping `range`, clipped to it. */
function piecesIn(pieces: readonly SourcePiece[], range: SourceRange): SourcePiece[] {
  return pieces
    .filter((piece) => piece.end > range.start && piece.start < range.end)
    .map((piece) => clipPiece(piece, range))
}

interface LocatedText {
  readonly node: Text
  readonly range: SourceRange
  readonly ancestors: readonly Parents[]
}

/**
 * Locate a run of sibling nodes that have no source offsets. GFM's
 * autolink-literal transform splits a parsed text node into text and link
 * nodes without positions, so the run occupies exactly the gap between its
 * positioned neighbors, and the pieces in that gap spell its text in order.
 */
function locateRun(
  run: readonly RootContent[],
  gap: SourceRange,
  pieces: readonly SourcePiece[],
  ancestors: readonly Parents[],
): LocatedText[] {
  const texts: { node: Text; ancestors: readonly Parents[] }[] = []
  for (const member of run) {
    visitParents(member, "text", (node: Text, inner) => {
      texts.push({ node, ancestors: [...ancestors, ...inner] })
    })
  }
  const value = texts.map(({ node }) => node.value).join("")
  const { starts, ends } = mapValueToSource(value, piecesIn(pieces, gap))
  let offset = 0
  return texts.map(({ node, ancestors: nodeAncestors }) => {
    const range = { start: starts[offset], end: ends[offset + node.value.length - 1] }
    offset += node.value.length
    return { node, range, ancestors: nodeAncestors }
  })
}

/** A node's source offsets, if the parser recorded them. */
export function sourceRange(node: Node | undefined): SourceRange | undefined {
  const start = node?.position?.start.offset
  const end = node?.position?.end.offset
  return start === undefined || end === undefined ? undefined : { start, end }
}

/** Every text node with its source range, in source order. */
function locateTextNodes(tree: Root, pieces: readonly SourcePiece[]): LocatedText[] {
  const located: LocatedText[] = []
  visitParents(tree, (node, ancestors) => {
    const range = sourceRange(node)
    if (!range) return
    if (node.type === "text") located.push({ node, range, ancestors })
    if (!("children" in node)) return
    const children: readonly RootContent[] = node.children
    for (let i = 0; i < children.length; i++) {
      if (sourceRange(children[i])) continue
      const runStart = i
      while (i < children.length && !sourceRange(children[i])) i++
      const previous = sourceRange(children[runStart - 1])
      const next = sourceRange(children[i])
      const gap = { start: previous?.end ?? range.start, end: next?.start ?? range.end }
      located.push(...locateRun(children.slice(runStart, i), gap, pieces, [...ancestors, node]))
    }
  })
  return located.sort((a, b) => a.range.start - b.range.start)
}

/**
 * Whether a text node's characters double as syntax that must not change: an
 * autolink's text is its URL (micromark tokenizes most autolinks; GFM's
 * transform creates the rest without positions), and a shortcut or collapsed
 * reference's label is also its definition identifier.
 */
function isLiteralText(
  { range, ancestors }: LocatedText,
  autolinks: readonly SourceRange[],
): boolean {
  return (
    autolinks.some((link) => range.start >= link.start && range.end <= link.end) ||
    ancestors.some(
      (ancestor) =>
        (ancestor.type === "link" && !sourceRange(ancestor)) ||
        (ancestor.type === "linkReference" && ancestor.referenceType !== "full"),
    )
  )
}

/**
 * Apply punctilio to Markdown while leaving every byte outside the changed
 * prose untouched. Text nodes are transformed in the MDAST, then each changed
 * span is spliced back into the original source at the offsets micromark
 * reports, so escapes, brackets, list markers, and table formatting survive
 * exactly as written.
 */
export function transformMarkdownSource(text: string, config: TransformOptions): string {
  const { pieces, autolinks } = tokenizeSource(text)
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkPunctilio, config)
  const tree = processor.parse(text)
  // Literal text stays visible to punctilio as context for its neighbors
  // (quote pairing, dash spacing), but edits inside it are never spliced.
  const tracked = locateTextNodes(tree, pieces)
    .filter((located) => !isLiteralText(located, autolinks))
    .map(({ node, range }) => ({ node, range, original: node.value }))
  processor.runSync(tree)

  // Tracked nodes and pieces are both in source order, so one sweep pairs them.
  const edits: SourceEdit[] = []
  let pieceIndex = 0
  for (const { node, original, range } of tracked) {
    while (pieces[pieceIndex].end <= range.start) pieceIndex++
    const nodePieces: SourcePiece[] = []
    for (let i = pieceIndex; i < pieces.length && pieces[i].start < range.end; i++) {
      nodePieces.push(clipPiece(pieces[i], range))
    }
    if (node.value !== original) {
      edits.push(...textNodeEdits(mapValueToSource(original, nodePieces), original, node.value))
    }
  }

  // Edits ascend and never overlap, so the result is built in one pass.
  let result = ""
  let cursor = 0
  for (const edit of edits) {
    result += text.slice(cursor, edit.start) + edit.text
    cursor = edit.end
  }
  return result + text.slice(cursor)
}
