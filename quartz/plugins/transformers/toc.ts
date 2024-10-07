import { QuartzTransformerPlugin } from "../types"
import { createLogger } from "./logger_utils"
import { Root, Heading } from "mdast"
import { visit, SKIP } from "unist-util-visit"
import { slugify, resetSlugger } from "./gfm"
import { applyTextTransforms, hasAncestor } from "./formatting_improvement_html"
import { Node } from "hast"

export interface Options {
  maxDepth: 1 | 2 | 3 | 4 | 5 | 6
  minEntries: number
  showByDefault: boolean
  collapseByDefault: boolean
}

const defaultOptions: Options = {
  maxDepth: 2,
  minEntries: 1,
  showByDefault: true,
  collapseByDefault: false,
}

export interface TocEntry {
  depth: number
  text: string
  slug: string // this is just the anchor (#some-slug), not the canonical slug
}

const logger = createLogger("TableOfContents")

function logTocEntry(entry: TocEntry) {
  logger.debug(`TOC Entry: depth=${entry.depth}, text="${entry.text}", slug="${entry.slug}"`)
}

function customToString(node: Node): string {
  if ((node.type === "inlineMath" || node.type === "math") && "value" in node) {
    return node.type === "inlineMath" ? `$${node.value}$` : `$$${node.value}$$`
  }
  if ("children" in node) {
    return (node.children as Node[]).map(customToString).join("")
  }
  return "value" in node ? String(node.value) : ""
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

export const TableOfContents: QuartzTransformerPlugin<Partial<Options> | undefined> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts }
  logger.info(`TableOfContents plugin initialized with options: ${JSON.stringify(opts)}`)

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

              visit(tree, (node: any) => {
                if (
                  hasAncestor(node, (anc: any) => {
                    return anc.type === "blockquote"
                  })
                )
                  return SKIP

                if (node.type === "heading" && node.depth <= opts.maxDepth) {
                  const heading = node as Heading
                  let text = applyTextTransforms(customToString(heading))
                  text = stripHtml(text)
                  highestDepth = Math.min(highestDepth, heading.depth)

                  const slug = slugify(text)

                  toc.push({
                    depth: heading.depth,
                    text,
                    slug,
                  })
                  logger.info(
                    `Added TOC entry: depth=${heading.depth}, text="${text}", slug="${slug}"`,
                  )
                } else if (node.type === "footnoteDefinition") {
                  hasFootnotes = true
                }
              })
              if (hasFootnotes) {
                toc.push({
                  depth: 1,
                  text: "Footnotes",
                  slug: "footnote-label",
                })
                logger.info(`Added Footnotes to TOC`)
              }

              if (toc.length > 0 && toc.length > opts.minEntries) {
                const adjustedToc = toc.map((entry) => ({
                  ...entry,
                  depth: entry.depth - highestDepth,
                }))
                file.data.toc = adjustedToc
                file.data.collapseToc = opts.collapseByDefault
                logger.info(`Generated TOC for ${file.path} with ${adjustedToc.length} entries`)
                adjustedToc.forEach(logTocEntry)
              } else {
                logger.info(`Skipped TOC generation for ${file.path}: not enough entries`)
              }
            } else {
              logger.info(`TOC generation skipped for ${file.path}: display is false`)
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
