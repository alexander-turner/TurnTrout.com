import { diffChars, diffLines, type Change } from "diff"

import { escapeHtml } from "./component_script_utils"

// Per-changed-line-pair cap for Myers char-diff. Beyond this combined length,
// we fall back to a linear prefix+suffix diff — which highlights the divergent
// middle as a single block. Myers diffChars is ~O((N+M)·D) and scales badly:
// ~5ms at 1.6K chars, ~55ms at 6.6K, ~850ms at 25K on punctilio-style edits.
// 4K keeps the worst case around 25ms per line pair.
export const MAX_CHAR_DIFF_LENGTH = 4_000

export function escapeForOutput(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>")
}

/** Render char-level Myers changes, keeping only additions (green) and unchanged text. */
export function renderCharDiff(changes: readonly Change[]): string {
  let html = ""
  for (const change of changes) {
    if (change.removed) continue
    const escaped = escapeForOutput(change.value)
    html += change.added ? `<span class="diff-insert">${escaped}</span>` : escaped
  }
  return html
}

/**
 * Linear O(N) fallback for long changed line pairs. Finds the common prefix
 * and suffix, then highlights everything between them as one span. Less
 * precise than Myers when a line has multiple disjoint changes (they merge
 * into one span) but avoids the quadratic-ish blowup diffChars hits on long
 * inputs with many edits.
 */
export function renderPrefixSuffixDiff(oldText: string, newText: string): string {
  const shorter = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < shorter && oldText[prefix] === newText[prefix]) prefix++
  let suffix = 0
  const suffixLimit = shorter - prefix
  while (
    suffix < suffixLimit &&
    oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
  ) {
    suffix++
  }
  const before = newText.slice(0, prefix)
  const middle = newText.slice(prefix, newText.length - suffix)
  const after = newText.slice(newText.length - suffix)
  let html = escapeForOutput(before)
  if (middle) html += `<span class="diff-insert">${escapeForOutput(middle)}</span>`
  html += escapeForOutput(after)
  return html
}

export function renderChangedLinePair(oldText: string, newText: string): string {
  if (oldText.length + newText.length <= MAX_CHAR_DIFF_LENGTH) {
    return renderCharDiff(diffChars(oldText, newText))
  }
  return renderPrefixSuffixDiff(oldText, newText)
}

/**
 * Two-level diff: line-level first, then per-line-pair refinement. Line pairs
 * under MAX_CHAR_DIFF_LENGTH combined use Myers char-diff; longer ones fall
 * back to a linear prefix/suffix diff. Worst case is linear in the input.
 */
export function renderDiffHtml(sourceText: string, resultText: string): string {
  const lineChanges = diffLines(sourceText, resultText)
  let html = ""
  for (let i = 0; i < lineChanges.length; i++) {
    const change = lineChanges[i]
    if (!change.added && !change.removed) {
      html += escapeForOutput(change.value)
      continue
    }
    const next = lineChanges[i + 1]
    if (change.removed && next?.added) {
      html += renderChangedLinePair(change.value, next.value)
      i++
      continue
    }
    if (change.added) {
      html += `<span class="diff-insert">${escapeForOutput(change.value)}</span>`
    }
    // A pure removal with no paired addition contributes nothing to the output.
  }
  return html
}
