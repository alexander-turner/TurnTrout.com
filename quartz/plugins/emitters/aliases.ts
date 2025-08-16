import path from "path"

import { type GlobalConfiguration } from "../../cfg"
import DepGraph from "../../depgraph"
import { renderHead } from "../../util/head"
import { type FilePath, type FullSlug, joinSegments, resolveRelative } from "../../util/path"
import { type QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

export const defaultCardUrl = "https://assets.turntrout.com/static/images/fb_preview.png"

/**
 * Quartz emitter plugin that creates HTML redirect files for page aliases and permalinks.
 *
 * This plugin reads `aliases` and `permalink` fields from frontmatter and generates
 * redirect HTML files that automatically redirect to the canonical page. Each redirect
 * file includes proper metadata (Open Graph, Twitter Cards) for SEO and social sharing.
 *
 * Frontmatter fields used:
 * - `aliases`: Array of alternative URLs that should redirect to this page
 * - `permalink`: Alternative canonical URL for this page
 * - `title`, `description`, `card_image`, `authors`: Metadata copied to redirect pages
 *
 * @example
 * ```yaml
 * # In a markdown file's frontmatter:
 * aliases: ["old-url", "alternative-name"]
 * permalink: "custom-permalink"
 * title: "My Article"
 * description: "Article description"
 * ```
 */
export const AliasRedirects: QuartzEmitterPlugin = () => ({
  name: "AliasRedirects",
  getQuartzComponents() {
    return []
  },
  /**
   * Builds dependency graph showing which output files depend on which source files.
   * Each alias and permalink creates a dependency edge from source file to output HTML.
   */
  async getDependencyGraph(ctx, content) {
    const graph = new DepGraph<FilePath>()

    const { argv } = ctx
    for (const [, file] of content) {
      const dir = path.posix.relative(argv.directory, path.dirname(file.data.filePath || ""))
      const aliases = file.data.frontmatter?.aliases ?? []
      const slugs = aliases.map((alias) => path.posix.join(dir, alias) as FullSlug)
      const permalink = file.data.frontmatter?.permalink
      if (typeof permalink === "string") {
        slugs.push(permalink as FullSlug)
      }

      for (let slug of slugs) {
        // Normalize directory-style URLs to explicit index.html files
        if (slug.endsWith("/")) {
          slug = joinSegments(slug, "index") as FullSlug
        }

        graph.addEdge(
          file.data.filePath || ("" as FilePath),
          joinSegments(argv.output, `${slug}.html`) as FilePath,
        )
      }
    }

    return graph
  },

  /**
   * Generates HTML redirect files for all aliases and permalinks.
   * Each redirect file contains metadata and auto-redirects to the canonical page.
   */
  async emit(ctx, content): Promise<FilePath[]> {
    const { argv } = ctx
    const fps: FilePath[] = []

    for (const [, file] of content) {
      const dir = path.posix.relative(argv.directory, path.dirname(file.data.filePath || ""))
      const aliases = file.data.frontmatter?.aliases ?? []
      const slugs: FullSlug[] = aliases.map((alias) => path.posix.join(dir, alias) as FullSlug)
      const permalink = file.data.frontmatter?.permalink
      if (typeof permalink === "string") {
        // When permalink exists, current slug becomes an alias and permalink becomes canonical
        slugs.push(file.data.slug as FullSlug)
        file.data.slug = permalink as FullSlug
      }

      for (let slug of slugs) {
        if (slug.endsWith("/")) {
          slug = joinSegments(slug, "index") as FullSlug
        }

        const redirUrl = resolveRelative(slug, file.data.slug || ("" as FullSlug))

        // Generate redirect HTML with full metadata for SEO
        const redirectMetadata = renderHead({
          cfg: ctx.cfg as unknown as GlobalConfiguration,
          fileData: file,
          slug: file.data.slug as FullSlug,
          redirect: { slug, to: file.data.slug as FullSlug },
        })

        const fp = await write({
          ctx,
          content: `
            <!DOCTYPE html>
            <html lang="en-us">
            <head>
              <meta charset="utf-8">
              <link rel="canonical" href="${redirUrl}">

              ${redirectMetadata}

              <meta name="robots" content="noindex">
              <meta http-equiv="refresh" content="0; url=${redirUrl}">
              <meta name="viewport" content="width=device-width">
            </head>
            </html>
            `,
          slug,
          ext: ".html",
        })

        fps.push(fp)
      }
    }
    return fps
  },
})
