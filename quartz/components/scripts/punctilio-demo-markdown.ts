import type { Parents, Text } from "mdast"

import { diffChars } from "diff"
import { decodeString } from "micromark-util-decode-string"
import { type TransformOptions } from "punctilio"
import { remarkPunctilio } from "punctilio/remark"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visitParents } from "unist-util-visit-parents"

interface SourceEdit {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** A backslash escape or character reference starting exactly at `lastIndex`. */
const ESCAPE_OR_REFERENCE =
  /\\[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]|&(?:#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/iuy

/**
 * Blockquote markers and indentation that open a paragraph continuation line.
 * Paragraph text never begins with whitespace or with a `>` indented under
 * four spaces (that would open a blockquote), so this is never content.
 */
const CONTAINER_PREFIX = /(?:[ \t]{0,3}>[ \t]?)*[ \t]*/uy

/** The escape or valid character reference at `index`, with its decoded text. */
function matchReference(
  source: string,
  index: number,
): { readonly length: number; readonly decoded: string } | undefined {
  ESCAPE_OR_REFERENCE.lastIndex = index
  const token = ESCAPE_OR_REFERENCE.exec(source)?.[0]
  if (token === undefined) return undefined
  const decoded = decodeString(token)
  return decoded === token ? undefined : { length: token.length, decoded }
}

/**
 * Map each UTF-16 unit of a text node's decoded `value` to the source span
 * that produced it. Escapes (`\[`) and character references (`&quot;`) map
 * one or more value units to their whole source token; container syntax
 * stripped by the parser (blockquote `>` markers, list indentation) maps to
 * nothing and is skipped.
 */
export function alignValueToSource(
  source: string,
  value: string,
): { readonly starts: readonly number[]; readonly ends: readonly number[] } {
  const starts: number[] = []
  const ends: number[] = []
  let sourceIndex = 0
  while (sourceIndex < source.length && starts.length < value.length) {
    const reference = matchReference(source, sourceIndex)
    if (reference && value.startsWith(reference.decoded, starts.length)) {
      const unitCount = reference.decoded.length
      starts.push(...Array<number>(unitCount).fill(sourceIndex))
      ends.push(...Array<number>(unitCount).fill(sourceIndex + reference.length))
      sourceIndex += reference.length
      continue
    }
    if (source[sourceIndex] !== value[starts.length]) {
      sourceIndex++
      continue
    }
    starts.push(sourceIndex)
    ends.push(sourceIndex + 1)
    sourceIndex++
    if (value[starts.length - 1] === "\n") {
      CONTAINER_PREFIX.lastIndex = sourceIndex
      CONTAINER_PREFIX.test(source)
      sourceIndex = CONTAINER_PREFIX.lastIndex
    }
  }
  if (starts.length < value.length) {
    throw new Error(`Could not align Markdown text ${JSON.stringify(value)} to its source`)
  }
  return { starts, ends }
}

/** Source edits that turn a text node's original value into its transformed value. */
export function textNodeEdits(
  source: string,
  sourceOffset: number,
  original: string,
  transformed: string,
): SourceEdit[] {
  const { starts, ends } = alignValueToSource(source, original)
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
      edits.push({
        start: sourceOffset + position,
        end: sourceOffset + position,
        text: change.value,
      })
      continue
    }
    const next = changes[i + 1]
    const replacement = next?.added ? next.value : ""
    if (next?.added) i++
    const after = valueIndex + change.value.length
    // A removed line break takes the next line's container prefix with it.
    const end =
      change.value.endsWith("\n") && after < starts.length ? starts[after] : ends[after - 1]
    edits.push({
      start: sourceOffset + starts[valueIndex],
      end: sourceOffset + end,
      text: replacement,
    })
    valueIndex = after
  }
  return edits
}

/**
 * Whether a text node's characters double as syntax that must not change:
 * an autolink's text is its URL, and a shortcut or collapsed reference's
 * label is its definition identifier.
 */
function isLiteralText(source: string, ancestors: readonly Parents[]): boolean {
  return ancestors.some((ancestor) => {
    if (ancestor.type === "link") {
      const start = ancestor.position?.start.offset
      return start === undefined || source[start] !== "["
    }
    return ancestor.type === "linkReference" && ancestor.referenceType !== "full"
  })
}

interface TrackedText {
  readonly node: Text
  readonly original: string
  readonly start: number
  readonly end: number
}

/**
 * Apply punctilio to Markdown while leaving every byte outside the changed
 * prose untouched. Text nodes are transformed in the MDAST, then each changed
 * span is spliced back into the original source, so escapes, brackets, list
 * markers, and table formatting survive exactly as written.
 */
export function transformMarkdownSource(text: string, config: TransformOptions): string {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkPunctilio, config)
  const tree = processor.parse(text)
  const tracked: TrackedText[] = []
  visitParents(tree, "text", (node: Text, ancestors) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined || isLiteralText(text, ancestors)) {
      // remarkPunctilio treats inline code as opaque, so it neither rewrites
      // this text nor joins prose across it.
      Object.assign(node, { type: "inlineCode" })
      return
    }
    tracked.push({ node, original: node.value, start, end })
  })
  processor.runSync(tree)

  const edits = tracked
    .filter(({ node, original }) => node.value !== original)
    .flatMap(({ node, original, start, end }) =>
      textNodeEdits(text.slice(start, end), start, original, node.value),
    )

  // Text nodes are visited in source order and each node's edits ascend, so
  // the edits are already sorted and disjoint.
  let result = ""
  let cursor = 0
  for (const edit of edits) {
    result += text.slice(cursor, edit.start) + edit.text
    cursor = edit.end
  }
  return result + text.slice(cursor)
}
