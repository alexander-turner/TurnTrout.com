import gitRoot from "find-git-root"
import fs from "fs/promises"
import { type Element, type Root } from "hast"
import { h } from "hastscript"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"
import { VFile } from "vfile"

import { formatTitle } from "../../components/component_utils"
import { footnoteHeadingId, similarPostsHeadingId } from "../../components/constants"
import { type QuartzTransformerPlugin } from "../types"
import { type TocEntry } from "../vfile"
import { insertAfterOrnamentNode } from "./afterArticle"
import { applyTextTransforms } from "./formatting_improvement_html"

const projectRoot = path.dirname(gitRoot(fileURLToPath(import.meta.url)))

export const relatedPostsPath = path.join(
  projectRoot,
  "quartz",
  "plugins",
  "transformers",
  "related_posts.json",
)

/** One rendered "Similar links" entry, as stored in `related_posts.json`. */
export interface RelatedPost {
  permalink: string
  title: string
  excerpt: string
}

export type RelatedPostsMap = ReadonlyMap<string, readonly RelatedPost[]>

function isRelatedPost(value: unknown): value is RelatedPost {
  if (value === null || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    typeof record.permalink === "string" &&
    typeof record.title === "string" &&
    typeof record.excerpt === "string"
  )
}

export function parseRelatedPosts(raw: string, source: string): RelatedPostsMap {
  const parsed: unknown = JSON.parse(raw)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} must contain a JSON object`)
  }
  const map = new Map<string, readonly RelatedPost[]>()
  for (const [slug, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!Array.isArray(value) || !value.every(isRelatedPost)) {
      throw new Error(`${source} entry for ${slug} must be an array of related posts`)
    }
    map.set(slug, value)
  }
  return map
}

/** Missing file → empty map; other I/O errors propagate. */
export async function loadRelatedPosts(
  filePath: string = relatedPostsPath,
): Promise<RelatedPostsMap> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, "utf-8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map()
    throw error
  }
  return parseRelatedPosts(raw, filePath)
}

/**
 * Inserts `blocks` immediately after the `.after-article-components` wrapper
 * (which contains the newsletter/email box). Falls back to after the ornament
 * when that wrapper is absent (e.g. pages with subscription links suppressed).
 */
function insertAfterSubscriptionBlock(tree: Root, blocks: Element[]) {
  let inserted = false
  visit(tree, "element", (node: Element, index, parent: Element | null) => {
    const cls = node.properties?.className
    if (
      index !== undefined &&
      parent &&
      Array.isArray(cls) &&
      (cls as string[]).includes("after-article-components")
    ) {
      parent.children.splice(index + 1, 0, ...blocks)
      inserted = true
      return false
    }
    return true
  })
  if (!inserted) {
    insertAfterOrnamentNode(tree, blocks)
  }
}

const SIMILAR_POSTS_HEADING = "Similar posts"
const SIMILAR_POSTS_SLUG = similarPostsHeadingId

export const similarPostsTocEntry: TocEntry = {
  depth: 0,
  text: SIMILAR_POSTS_HEADING,
  slug: SIMILAR_POSTS_SLUG,
}

/**
 * Returns a copy of `toc` with the "Similar posts" entry placed before the
 * first appendix heading or the Footnotes entry, whichever comes first. The
 * TOC is built from the markdown headings before this HTML-stage block exists,
 * so the entry is inserted by hand — at the position where the block is
 * actually rendered (the ornament places it ahead of those closing sections).
 * Absent both, the block and the entry land at the end.
 */
export function insertSimilarPostsTocEntry(toc: readonly TocEntry[]): TocEntry[] {
  const closingIndex = toc.findIndex(
    (entry) => entry.text.toLowerCase().startsWith("appendix") || entry.slug === footnoteHeadingId,
  )
  if (closingIndex === -1) {
    return [...toc, similarPostsTocEntry]
  }
  return [...toc.slice(0, closingIndex), similarPostsTocEntry, ...toc.slice(closingIndex)]
}

/**
 * Builds the "Similar posts" section: a top-level `<h1>` heading followed by
 * the list block. Emitting the heading as a direct article child (rather than
 * nesting it in the list wrapper) makes it a real section heading — it gets a
 * ToC anchor and ends the previous heading's section like any other `<h1>`.
 */
export function buildRelatedPostsBlock(posts: readonly RelatedPost[]): Element[] {
  return [
    h("h1", { id: SIMILAR_POSTS_SLUG, className: "related-posts-title" }, SIMILAR_POSTS_HEADING),
    h("div", { className: "related-posts" }, [
      h(
        "ul",
        posts.map((post) =>
          h("li", { className: "related-post" }, [
            h(
              "a",
              {
                href: `/${post.permalink.replace(/^\/+/, "")}`,
                className: "internal can-trigger-popover",
              },
              formatTitle(post.title),
            ),
            h(
              "span",
              { className: "related-post-excerpt" },
              applyTextTransforms(post.excerpt, { useNbsp: false }),
            ),
          ]),
        ),
      ),
    ]),
  ]
}

/**
 * Injects a gwern-style "Similar posts" block after the email/newsletter box,
 * listing the precomputed top-N semantically-similar posts for the current article.
 *
 * Neighbors are read once per plugin instance from the committed
 * `related_posts.json` and shared across every page in the build. Articles
 * absent from that map (e.g. not yet embedded) render no block.
 */
export const RelatedPosts: QuartzTransformerPlugin<{ filePath?: string } | undefined> = (opts) => {
  let relatedPromise: Promise<RelatedPostsMap> | null = null
  const related = () => (relatedPromise ??= loadRelatedPosts(opts?.filePath))
  return {
    name: "RelatedPosts",
    htmlPlugins: () => [
      () => async (tree: Root, file: VFile) => {
        const permalink = file.data.frontmatter?.permalink as string | undefined
        if (!permalink) return
        // The neighbor map is keyed by permalink with leading/trailing slashes
        // stripped (mirrors the generator's `str(permalink).strip("/")`).
        const key = permalink.replace(/^\/+/, "").replace(/\/+$/, "")
        const posts = (await related()).get(key)
        if (!posts || posts.length === 0) return
        insertAfterSubscriptionBlock(tree, buildRelatedPostsBlock(posts))
        if (file.data.toc) {
          file.data.toc = insertSimilarPostsTocEntry(file.data.toc)
        }
      },
    ],
  }
}
