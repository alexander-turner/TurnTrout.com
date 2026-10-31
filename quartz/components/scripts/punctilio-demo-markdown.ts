import type { Text } from "mdast"

import { diffChars } from "diff"
import { decodeString } from "micromark-util-decode-string"
import { type TransformOptions } from "punctilio"
import { remarkPunctilio } from "punctilio/remark"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"

interface SourceEdit {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** A backslash escape or character reference starting exactly at `lastIndex`. */
const ESCAPE_OR_REFERENCE =
  /\\[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]|&(?:#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/iuy

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
    if (source[sourceIndex] === value[starts.length]) {
      starts.push(sourceIndex)
      ends.push(sourceIndex + 1)
    }
    sourceIndex++
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
    edits.push({
      start: sourceOffset + starts[valueIndex],
      end: sourceOffset + ends[valueIndex + change.value.length - 1],
      text: replacement,
    })
    valueIndex += change.value.length
  }
  return edits
}

/** Source edits for a transformed text node, located via its parse offsets. */
export function sourceEditsForNode(text: string, node: Text, original: string): SourceEdit[] {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined) {
    throw new Error("Markdown text node is missing source offsets")
  }
  return textNodeEdits(text.slice(start, end), start, original, node.value)
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
  const originals = new Map<Text, string>()
  visit(tree, "text", (node: Text) => {
    originals.set(node, node.value)
  })
  processor.runSync(tree)

  const edits: SourceEdit[] = []
  for (const [node, original] of originals) {
    if (node.value !== original) edits.push(...sourceEditsForNode(text, node, original))
  }

  let result = text
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
  }
  return result
}
