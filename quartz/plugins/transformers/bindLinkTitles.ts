import type { Element, Root, Text } from "hast"
import type { VFile } from "vfile"

import fs from "fs"
import { visit } from "unist-util-visit"

import type { TitleIndex } from "../../processors/buildTitleIndex"
import type { QuartzTransformerPlugin } from "../types"

import { LINK_TITLE_LOWER_SENTINEL, LINK_TITLE_SENTINEL } from "../../components/constants"
import { titleIndexFile } from "../../components/constants.server"
import { type FullSlug, splitAnchor } from "../../util/path"
import { addClass } from "./utils"

interface SerializedTarget {
  title: string
  headings: Array<[string, string]>
}

let cachedIndex: TitleIndex | null = null

/** Drop the in-process cache so the next read reflects a freshly written index
 * (used between dev-server rebuilds). */
export function resetTitleIndexCache(): void {
  cachedIndex = null
}

/**
 * Read the title index written by the build pre-pass. A missing file yields an
 * empty index (so a misbuild fails loudly at the binding site rather than here).
 * Cached per process since each worker resolves many files.
 */
export async function readTitleIndex(): Promise<TitleIndex> {
  if (cachedIndex) return cachedIndex

  let raw: string
  try {
    raw = await fs.promises.readFile(titleIndexFile, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      cachedIndex = new Map()
      return cachedIndex
    }
    throw error
  }

  const entries = JSON.parse(raw) as Array<[FullSlug, SerializedTarget]>
  cachedIndex = new Map(
    entries.map(([slug, target]) => [
      slug,
      { title: target.title, headings: new Map(target.headings) },
    ]),
  )
  return cachedIndex
}

const escapeRegExp = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// HTMLFormattingImprovement runs before this plugin and migrates punctuation
// into anchors (trailing periods/commas after the link, opening quotes before
// it), so the sentinel may arrive flanked by punctuation, symbols, or
// whitespace—possibly split across several text children. Any letter or digit
// around the sentinel means the anchor text is ordinary prose, not a binding.
// Longest sentinel first so "@title-lower" is not matched as "@title" + trail.
const sentinelAlternation = [LINK_TITLE_LOWER_SENTINEL, LINK_TITLE_SENTINEL]
  .map(escapeRegExp)
  .join("|")
const sentinelTextRegex = new RegExp(
  `^(?<lead>[\\p{P}\\p{S}\\s]*?)(?<sentinel>${sentinelAlternation})(?<trail>[\\p{P}\\p{S}\\s]*)$`,
  "u",
)

/**
 * Replace the text of every `@title` anchor with the up-to-date title of its
 * target page, or the live text of the target section heading when the link
 * carries an `#anchor`. Runs after CrawlLinks (so `data-slug`/`href` are
 * resolved) and before AddFavicons (so the favicon is woven into the real
 * title, not the sentinel). Punctuation surrounding the sentinel inside the
 * anchor is preserved around the resolved title. Throws when a bound link
 * targets a missing page or heading—this surfaces drift when a page or
 * heading is renamed.
 */
export function bindTitlesInTree(
  tree: Root,
  index: TitleIndex,
  curSlug: FullSlug | undefined,
  source: string,
): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") return

    if (!node.children.every((child): child is Text => child.type === "text")) return
    const text = node.children.map((child) => child.value).join("")
    const match = sentinelTextRegex.exec(text)
    if (!match?.groups) return
    const lower = match.groups.sentinel === LINK_TITLE_LOWER_SENTINEL

    const href = node.properties.href
    if (typeof href !== "string") return

    const dataSlug = node.properties["data-slug"]
    let targetSlug: FullSlug | undefined
    if (typeof dataSlug === "string") {
      targetSlug = dataSlug as FullSlug
    } else if (href.startsWith("#")) {
      targetSlug = curSlug
    } else {
      // Sentinel on an external or unresolvable link: leave it as literal text.
      return
    }

    const target = targetSlug ? index.get(targetSlug) : undefined
    if (!target) {
      throw new Error(`Title-bound link in ${source} points at missing page "${targetSlug}".`)
    }

    const anchor = splitAnchor(href)[1]
    let resolved: string
    if (anchor) {
      const id = anchor.slice(1)
      const headingText = target.headings.get(id)
      if (headingText === undefined) {
        throw new Error(
          `Title-bound link in ${source} points at missing heading "#${id}" on page "${targetSlug}".`,
        )
      }
      resolved = headingText
    } else {
      resolved = target.title
    }
    const bound = lower ? resolved.toLowerCase() : resolved
    // Punctuation around the sentinel survives; stray whitespace does not.
    const lead = match.groups.lead.trim()
    const trail = match.groups.trail.trim()
    node.children = [{ type: "text", value: `${lead}${bound}${trail}` }]
    // A resolved title is the name of a work, not prose, so acronyms in it
    // (AGI, GPT, …) should not render as small-caps.
    addClass(node, "no-smallcaps")
  })
}

export const BindLinkTitles: QuartzTransformerPlugin = () => {
  return {
    name: "BindLinkTitles",
    htmlPlugins() {
      return [
        () => {
          return async (tree: Root, file: VFile) => {
            const index = await readTitleIndex()
            const slug = file.data.slug as FullSlug | undefined
            const source = (file.data.filePath ?? slug ?? "<unknown file>") as string
            bindTitlesInTree(tree, index, slug, source)
          }
        },
      ]
    },
  }
}
