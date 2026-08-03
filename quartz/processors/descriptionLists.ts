import type { Root } from "mdast"
import type { VFile } from "vfile"

import { visit } from "unist-util-visit"

/**
 * `remark-definition-list` identifies a term purely by position: the paragraph
 * immediately above a `: ` line. Prose which merely neighbours a definition is
 * therefore promoted to a term, and a term which merely touches a definition is
 * swallowed by it. Both corrupt the list silently, so the parsed list is checked
 * against the source lines it came from and the build fails on a mismatch.
 */

interface DefinitionNode {
  type: string
  value?: string
  children?: DefinitionNode[]
  position: { start: { line: number }; end: { line: number } }
}

/** A term or description; both always hold children. */
interface DefinitionEntry extends DefinitionNode {
  children: DefinitionNode[]
}

// A term is a label. Prose carries a sentence break; a label does not.
const SENTENCE_BREAK_REGEX = /[.!?][)\]"'”’]*\s/

// Nodes which leave a term label-like: the site's terms are wholly emphasized,
// optionally with a footnote marker.
const LABEL_NODE_TYPES = new Set(["strong", "emphasis", "footnoteReference"])

function nodeText(node: DefinitionNode): string {
  return node.value ?? (node.children ?? []).map(nodeText).join("")
}

function isLabel(term: DefinitionEntry): boolean {
  return term.children.every(
    (child) =>
      LABEL_NODE_TYPES.has(child.type) || (child.type === "text" && !nodeText(child).trim()),
  )
}

/**
 * The last source line the description's own content occupies.
 *
 * A description's `position` runs to the start of whatever follows it, so its
 * children delimit the text that actually belongs to the `<dd>`.
 */
function contentEndLine(description: DefinitionEntry): number {
  return Math.max(...description.children.map((child) => child.position.end.line))
}

/**
 * A term the definition above it swallowed as a lazy continuation.
 *
 * Such a line sits inside the description's own text even though the line below
 * it opens a new definition—so it was written as a term but renders as part of
 * the `<dd>` above, orphaning the definitions meant for it.
 */
function swallowedTermLine(description: DefinitionEntry, lines: readonly string[]): number | null {
  for (
    let line = description.position.start.line + 1;
    line <= contentEndLine(description);
    line++
  ) {
    const isTerm = lines[line - 1].trim() && !/^[\s:]/.test(lines[line - 1])
    if (isTerm && (lines[line] ?? "").startsWith(": ")) {
      return line
    }
  }
  return null
}

/**
 * A term which is prose stranded between two definitions.
 *
 * Blank lines on both sides mark it as its own paragraph rather than a label
 * attached to the definition below, and a sentence break marks it as prose.
 * Prefixing it with `: ` returns it to the `<dd>` it belongs to.
 */
function isStrandedProse(term: DefinitionEntry, lines: readonly string[]): boolean {
  const line = term.position.start.line
  const standsAlone = !lines[line - 2].trim() && !lines[line].trim()
  return standsAlone && !isLabel(term) && SENTENCE_BREAK_REGEX.test(nodeText(term).trim())
}

function collectErrors(entries: readonly DefinitionEntry[], lines: readonly string[]): string[] {
  const errors: string[] = []

  entries.forEach((entry, index) => {
    const previous = entries[index - 1]
    const line = entry.position.start.line

    if (entry.type === "defListTerm" && previous?.type === "defListTerm") {
      errors.push(
        `Line ${line}: this term shares a paragraph with the line above it, so both render as ` +
          "terms and collide on one line. Separate them with a blank line.",
      )
    }

    if (
      entry.type === "defListTerm" &&
      previous?.type === "defListDescription" &&
      isStrandedProse(entry, lines)
    ) {
      errors.push(
        `Line ${line}: this prose sits between two definitions, so it renders as a term and ` +
          "steals the definition below it. Prefix it with `: `.",
      )
    }

    if (entry.type === "defListDescription") {
      const swallowed = swallowedTermLine(entry, lines)
      if (swallowed !== null) {
        errors.push(
          `Line ${swallowed}: this term touches the definition above it, so it is absorbed into ` +
            "that definition and its own definitions reparent. Separate them with a blank line.",
        )
      }
    }
  })

  return errors
}

/**
 * Fail the build when a description list's terms disagree with the source.
 *
 * Runs directly after `remark-definition-list`, while the `defList` nodes still
 * carry the source positions the errors point at.
 */
export function validateDescriptionLists() {
  return (tree: Root, file: VFile): void => {
    const lines = String(file.value).split("\n")
    const errors: string[] = []

    visit(tree, "defList", (list) => {
      const entries = (list as unknown as DefinitionEntry).children as DefinitionEntry[]
      errors.push(...collectErrors(entries, lines))
    })

    if (errors.length > 0) {
      throw new Error(`Malformed description list:\n${errors.join("\n")}`)
    }
  }
}
