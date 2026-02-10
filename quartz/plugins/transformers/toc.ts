import type { Node } from "hast"
import type { Root, Heading } from "mdast"

import { SKIP } from "unist-util-visit"
import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { normalizeNbsp } from "../../components/constants"
import { createWinstonLogger } from "../../util/log"
import { applyTextTransforms } from "./formatting_improvement_html"
import { slugify, resetSlugger } from "./gfm"
import { hasAncestor, type ElementMaybeWithParent } from "./utils"

/**
 * Configuration options for the Table of Contents transformer
 * @interface Options
 */
export interface Options {
  /** Maximum heading depth to include in TOC (h1-h6) */
  maxDepth: 1 | 2 | 3 | 4 | 5 | 6
  /** Minimum number of entries required to show TOC */
  minEntries: number
  /** Whether to show TOC by default when not specified in frontmatter */
  showByDefault: boolean
  /** Whether TOC should be collapsed by default */
  collapseByDefault: boolean
}

const defaultOptions: Options = {
  maxDepth: 2,
  minEntries: 1,
  showByDefault: true,
  collapseByDefault: false,
}

/**
 * Represents a single entry in the Table of Contents
 * @interface TocEntry
 */
export interface TocEntry {
  /** Heading level (0-based from highest level in document) */
  depth: number
  /** Plain text content of the heading */
  text: string
  /** HTML anchor ID for the heading */
  slug: string
}

const logger = createWinstonLogger("TableOfContents")

// skipcq: JS-D1001
function logTocEntry(entry: TocEntry) {
  logger.debug(`TOC Entry: depth=${entry.depth}, text="${entry.text}", slug="${entry.slug}"`)
}

/**
 * Converts a node's content to a string representation
 * @param node - The AST node to convert
 * @returns String representation of the node's content
 */
export function customToString(node: Node): string {
  if ((node.type === "inlineMath" || node.type === "math") && "value" in node) {
    return node.type === "inlineMath" ? `$${node.value}$` : `$$${node.value}$$`
  }

  if (["inlineCode", "code"].includes(node.type) && "value" in node) {
    return `\`${node.value}\``
  }

  if ("children" in node) {
    return (node.children as Node[]).map(customToString).join("")
  }
  return "value" in node ? String(node.value) : ""
}

// skipcq: JS-D1001
export function stripHtmlTagsFromString(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

/**
 * Quartz transformer plugin that generates a table of contents from document headings
 * @param userOpts - Optional configuration options
 * @returns Plugin configuration object
 */
export const TableOfContents: QuartzTransformerPlugin<Partial<Options> | undefined> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts }
  logger.debug(`TableOfContents plugin initialized with options: ${JSON.stringify(opts)}`)

  return {
    name: "TableOfContents",
    markdownPlugins() {
      return [
        () => {
          return (tree: Root, file) => {
            resetSlugger()
            const display = file.data.frontmatter?.enableToc ?? opts.showByDefault
            logger.debug(`Processing file: ${file.path}, TOC display: ${display}`)

            if (display) {
              const toc: TocEntry[] = []
              let highestDepth: number = opts.maxDepth
              let hasFootnotes = false

              visitParents(tree, (node: Node, ancestors) => {
                if (
                  hasAncestor(
                    node as ElementMaybeWithParent,
                    (anc: Node) => {
                      return anc.type === "blockquote"
                    },
                    ancestors,
                  )
                )
                  return SKIP

                if (node.type === "heading" && (node as Heading).depth <= opts.maxDepth) {
                  const heading = node as Heading
                  const text = applyTextTransforms(customToString(heading))
                  const plainText = stripHtmlTagsFromString(text)
                  highestDepth = Math.min(highestDepth, heading.depth)

                  const slug = slugify(normalizeNbsp(plainText))

                  toc.push({
                    depth: heading.depth,
                    text,
                    slug,
                  })
                  logger.debug(
                    `Added TOC entry: depth=${heading.depth}, text="${text}", slug="${slug}"`,
                  )
                } else if (node.type === "footnoteDefinition") {
                  hasFootnotes = true
                }
                return null
              })
              if (hasFootnotes) {
                toc.push({
                  depth: 1,
                  text: "Footnotes",
                  slug: "footnote-label",
                })
                logger.debug("Added Footnotes to TOC")
              }

              if (toc.length > 0 && toc.length >= opts.minEntries) {
                const adjustedToc = toc.map((entry) => ({
                  ...entry,
                  depth: entry.depth - highestDepth,
                }))
                file.data.toc = adjustedToc
                file.data.collapseToc = opts.collapseByDefault
                logger.debug(`Generated TOC for ${file.path} with ${adjustedToc.length} entries`)
                adjustedToc.forEach(logTocEntry)
              } else {
                logger.warn(`Skipped TOC generation for ${file.path}: not enough entries`)
              }
            } else {
              logger.warn(`TOC generation skipped for ${file.path}: display is false`)
            }
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    toc: TocEntry[]
    collapseToc: boolean
  }
}
