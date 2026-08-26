/**
 * Helpers for the few source-level (pre-parse) transforms that cannot run on
 * the mdast.
 *
 * A transform belongs here only when it repairs the *input to the parser* —
 * markdown that would otherwise parse into the wrong nodes. Comments are the
 * clearest case: left in the source, an HTML comment opens an HTML block, which
 * ends the enclosing list or footnote and re-parses the remainder as indented
 * code. Once an mdast exists that damage is already done, and undoing it means
 * guessing which sibling blocks were meant to be one.
 *
 * Deciding *where* such a transform may write is still the parser's job:
 * {@link transformOutsideCode} parses the source and skips the span every
 * `code` node occupies.
 */

import type { Root } from "mdast"

import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"

/**
 * Parses markdown for span discovery only; this tree is never emitted.
 *
 * It must carry the same block-level grammar the real pipeline registers, or it
 * reads a different language: without GFM a footnote definition is an ordinary
 * paragraph, so its indented body looks like an indented code block and the
 * transforms are steered away from prose they are supposed to reach.
 */
const sourceParser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml", "toml"])

/** Half-open `[start, end)` source offsets of a block the transforms must not touch. */
interface CodeSpan {
  start: number
  end: number
}

/**
 * Source offsets of every code *block* in `src`, in document order.
 *
 * Only the parser knows these: four leading spaces are code or a list
 * continuation depending on what encloses them, and a fence ends at the first
 * line of the same marker that is at least as long.
 *
 * Inline code is deliberately not included. A `code` node always spans whole
 * lines, so skipping one leaves the surrounding prose line-aligned and the
 * `^`/`$` anchors these transforms rely on keep their meaning. An `inlineCode`
 * node sits mid-line, and cutting there would turn one line into two chunks
 * whose edges those anchors would read as line boundaries. Protecting inline
 * code is the job of the mdast passes, where it is a node rather than a range.
 */
function findCodeSpans(src: string): CodeSpan[] {
  const tree = sourceParser.parse(src) as Root
  const spans: CodeSpan[] = []

  visit(tree, "code", (node) => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    /* istanbul ignore next -- remark-parse records offsets for every node when parsing a string */
    if (start === undefined || end === undefined) return
    spans.push({ start, end })
  })

  // Code blocks never nest and a visit is document-ordered, so the spans come
  // out ascending and disjoint.
  return spans
}

/**
 * Applies `transform` to every run of source outside a code block, leaving
 * fenced and indented code byte-for-byte intact.
 */
export function transformOutsideCode(src: string, transform: (chunk: string) => string): string {
  const out: string[] = []
  let cursor = 0

  for (const span of findCodeSpans(src)) {
    if (span.start > cursor) out.push(transform(src.slice(cursor, span.start)))
    out.push(src.slice(span.start, span.end))
    cursor = span.end
  }
  if (cursor < src.length) out.push(transform(src.slice(cursor)))

  return out.join("")
}
