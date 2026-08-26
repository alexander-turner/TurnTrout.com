/**
 * Helpers for the few source-level (pre-parse) transforms that cannot run on
 * the mdast.
 *
 * A transform belongs here only when it repairs the *input to the parser* —
 * markdown that would otherwise parse into the wrong nodes (a link destination
 * holding raw spaces, display math sharing a line with prose, an HTML block
 * swallowing the prose beneath it). Everything that merely rewrites prose runs
 * on the mdast instead, where node types make code, math, and HTML untouchable.
 *
 * Source-level transforms still must not reach inside fenced code, so they run
 * through {@link transformOutsideCode}.
 */

/** The maximum indent CommonMark allows before a fence still counts as one. */
const maxFenceIndent = 3

/** The shortest run of fence characters that opens a block. */
const minFenceLength = 3

interface Fence {
  marker: string
  length: number
  info: string
}

/**
 * Reads the fence a line carries, or `null` when the line is not a fence.
 * Scanned by hand rather than by regex: a fence run and its info string are
 * both unbounded, and any regex splitting them backtracks super-linearly.
 */
function readFence(line: string): Fence | null {
  let index = 0
  while (index < line.length && line[index] === " ") index++
  if (index > maxFenceIndent) return null

  const marker = line[index]
  if (marker !== "`" && marker !== "~") return null

  const start = index
  while (index < line.length && line[index] === marker) index++
  const length = index - start
  if (length < minFenceLength) return null

  return { marker, length, info: line.slice(index) }
}

/** Reports whether `line` closes `open`: same marker, at least as long, no info string. */
function closesFence(line: string, open: Fence): boolean {
  const fence = readFence(line)
  if (!fence) return false
  return fence.marker === open.marker && fence.length >= open.length && fence.info.trim() === ""
}

/**
 * Applies `transform` to every run of lines outside fenced code blocks, leaving
 * fenced blocks (and their delimiters) byte-for-byte intact.
 *
 * Indented code blocks are not recognized: four leading spaces are a list
 * continuation as often as they are code, and telling the two apart is the job
 * of the parser, not of this scanner. Content that needs that guarantee should
 * use a fence.
 */
export function transformOutsideCode(src: string, transform: (chunk: string) => string): string {
  const lines = src.split("\n")
  const out: string[] = []
  let prose: string[] = []
  let open: Fence | null = null

  const flushProse = (): void => {
    if (prose.length === 0) return
    out.push(transform(prose.join("\n")))
    prose = []
  }

  for (const line of lines) {
    if (open) {
      out.push(line)
      if (closesFence(line, open)) open = null
      continue
    }
    const fence = readFence(line)
    if (fence) {
      flushProse()
      out.push(line)
      open = fence
      continue
    }
    prose.push(line)
  }
  flushProse()

  return out.join("\n")
}
