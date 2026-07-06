import path from "path"

import { locale } from "../../components/constants"
import DepGraph from "../../depgraph"
import { renderHead } from "../../util/head"
import { type FilePath, type FullSlug, joinSegments, resolveRelative } from "../../util/path"
import { isDraftPath } from "../filters/draft"
import { type QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

/**
 * Directory that a page's aliases and permalink redirects should be emitted into,
 * relative to the content root.
 *
 * Drafts are previewed in dev from a `drafts/` subdirectory but are served at the
 * site root (where they will live once published), so their aliases must be rooted
 * too—otherwise `/leaving-gdm` 404s while the redirect sits at `/drafts/leaving-gdm`.
 */
function aliasDir(filePath: FilePath | undefined, directory: string): string {
  if (!filePath) {
    return ""
  }
  if (isDraftPath(filePath)) {
    return ""
  }
  return path.posix.relative(directory, path.dirname(filePath))
}

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
  getDependencyGraph(ctx, content) {
    const graph = new DepGraph<FilePath>()

    const { argv } = ctx
    for (const [, file] of content) {
      const dir = aliasDir(file.data.filePath, argv.directory)
      const aliases = file.data.frontmatter?.aliases ?? []
      const slugs = aliases.map((alias) => path.posix.join(dir, alias) as FullSlug)
      const permalink = file.data.frontmatter?.permalink
      if (typeof permalink === "string") {
        // The canonical page is emitted at the permalink; the original slug is
        // where the redirect file lands, so that is the output edge to declare.
        slugs.push(file.data.slug as FullSlug)
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
      const dir = aliasDir(file.data.filePath, argv.directory)
      const aliases = file.data.frontmatter?.aliases ?? []
      const slugs: FullSlug[] = aliases.map((alias) => path.posix.join(dir, alias) as FullSlug)
      const permalink = file.data.frontmatter?.permalink
      // When a permalink exists it is the canonical URL and the original slug
      // redirects to it. Derive the target locally rather than mutating
      // file.data.slug, which is shared state other emitters read.
      let canonicalSlug = (file.data.slug || "") as FullSlug
      if (typeof permalink === "string") {
        slugs.push(canonicalSlug)
        canonicalSlug = permalink as FullSlug
      }

      for (let slug of slugs) {
        if (slug.endsWith("/")) {
          slug = joinSegments(slug, "index") as FullSlug
        }

        const redirUrl = resolveRelative(slug, canonicalSlug)

        // Generate redirect HTML with full metadata for SEO
        const redirectMetadata = renderHead({
          cfg: ctx.cfg.configuration,
          fileData: file.data,
          slug: canonicalSlug,
          redirect: { slug, to: canonicalSlug },
        })

        const fp = await write({
          ctx,
          content: `
            <!DOCTYPE html>
            <html lang="${locale}">
            <head>
              <meta charset="utf-8">
              <link rel="canonical" href="${redirUrl}">

              ${redirectMetadata}

              <meta name="robots" content="noindex">
              <meta http-equiv="refresh" content="0; url=${redirUrl}">
              <meta name="viewport" content="width=device-width, initial-scale=1">
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
