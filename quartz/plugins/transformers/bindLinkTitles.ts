import type { Element, Root } from "hast"
import type { VFile } from "vfile"

import fs from "fs"
import { visit } from "unist-util-visit"

import type { TitleIndex } from "../../processors/buildTitleIndex"
import type { QuartzTransformerPlugin } from "../types"

import { LINK_TITLE_LOWER_SENTINEL, LINK_TITLE_SENTINEL } from "../../components/constants"
import { titleIndexFile } from "../../components/constants.server"
import { type FullSlug, splitAnchor } from "../../util/path"

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

/**
 * Replace the text of every `@title` anchor with the up-to-date title of its
 * target page, or the live text of the target section heading when the link
 * carries an `#anchor`. Runs after CrawlLinks (so `data-slug`/`href` are
 * resolved) and before AddFavicons (so the favicon is woven into the real
 * title, not the sentinel). Throws when a bound link targets a missing page or
 * heading—this surfaces drift when a page or heading is renamed.
 */
export function bindTitlesInTree(
  tree: Root,
  index: TitleIndex,
  curSlug: FullSlug | undefined,
  source: string,
): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") return

    const onlyChild = node.children.length === 1 ? node.children[0] : undefined
    if (onlyChild?.type !== "text") return
    const sentinel = onlyChild.value.trim()
    const lower = sentinel === LINK_TITLE_LOWER_SENTINEL
    if (sentinel !== LINK_TITLE_SENTINEL && !lower) return

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
    onlyChild.value = lower ? resolved.toLowerCase() : resolved
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
