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
 * Redirect slugs for a file: its aliases, plus its original slug when a
 * permalink relocates the canonical page.
 *
 * Trailing-slash slugs normalize to explicit `index` files. Any slug that
 * case-insensitively equals the canonical slug is dropped: it would emit a
 * stub that redirects to itself, fighting the real page for one output path.
 * Exact matches collide on every filesystem (only emitter order decides
 * whether the stub or the page survives); case variants collide once the
 * output lands on a case-insensitive filesystem (macOS/Windows checkouts,
 * CI caches), where the stub can clobber the page and browsers that follow
 * same-URL meta refreshes (WebKit) reload forever.
 */
function redirectSlugs(
  file: {
    data: { filePath?: FilePath; slug?: FullSlug; frontmatter?: { aliases?: readonly string[] } }
  },
  directory: string,
  canonicalSlug: FullSlug,
): FullSlug[] {
  const dir = aliasDir(file.data.filePath, directory)
  const aliases = file.data.frontmatter?.aliases ?? []
  const slugs = aliases.map((alias) => path.posix.join(dir, alias) as FullSlug)
  if (file.data.slug !== undefined && canonicalSlug !== file.data.slug) {
    slugs.push(file.data.slug)
  }

  return slugs
    .map((slug) => (slug.endsWith("/") ? (joinSegments(slug, "index") as FullSlug) : slug))
    .filter((slug) => slug.toLowerCase() !== canonicalSlug.toLowerCase())
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
      const permalink = file.data.frontmatter?.permalink
      const canonicalSlug = (
        typeof permalink === "string" ? permalink : (file.data.slug ?? "")
      ) as FullSlug

      for (const slug of redirectSlugs(file, argv.directory, canonicalSlug)) {
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
      const permalink = file.data.frontmatter?.permalink
      const canonicalSlug = (
        typeof permalink === "string" ? permalink : (file.data.slug ?? "")
      ) as FullSlug

      const slugs = redirectSlugs(file, argv.directory, canonicalSlug)
      // Emitters that run after this one (e.g. ContentIndex) read
      // file.data.slug directly rather than re-deriving it from frontmatter,
      // so the canonical slug must be committed here for them to index the
      // page at its canonical URL.
      file.data.slug = canonicalSlug

      for (const slug of slugs) {
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
