import fs from "fs"
import path from "path"

import { defaultListPageLayout, sharedPageComponents } from "../../../config/quartz/quartz.layout"
import BodyConstructor from "../../components/Body"
import HeaderConstructor from "../../components/Header"
import { pageResources, renderPage } from "../../components/renderPage"
import { type QuartzComponent, type QuartzComponentProps } from "../../components/types"
import DepGraph from "../../depgraph"
import { type BuildCtx } from "../../util/ctx"
import { type FilePath, type FullSlug, joinSegments, pathToRoot } from "../../util/path"
import { type StaticResources } from "../../util/resources"
import { type QuartzEmitterPlugin } from "../types"
import { type ProcessedContent, defaultProcessedContent } from "../vfile"

type WriteOptions = {
  ctx: BuildCtx
  slug: FullSlug
  ext: `.${string}` | ""
  content: string
}

export const write = async ({ ctx, slug, ext, content }: WriteOptions): Promise<FilePath> => {
  const pathToPage = joinSegments(ctx.argv.output, slug + ext) as FilePath
  const dir = path.dirname(pathToPage)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(pathToPage, content)
  return pathToPage
}

/**
 * Configuration options for creating a list page emitter plugin.
 */
export interface ListPageEmitterConfig {
  /** Name of the plugin (e.g., "AllPostsPage") */
  name: string
  /** The page body component to render */
  pageBody: QuartzComponent
  /** The slug for the page (e.g., "all-posts") */
  slug: FullSlug
  /** The page title */
  title: string
  /** The page description */
  description: string
  /** Additional frontmatter fields */
  frontmatter?: Record<string, unknown>
  /** Text content for the page (defaults to description) */
  text?: string
}

/**
 * Factory function to create list page emitter plugins (e.g., AllPostsPage, AllTagsPage).
 * Reduces boilerplate for creating pages that list content with similar structure.
 *
 * @param config - Configuration object defining the page parameters
 * @returns A QuartzEmitterPlugin that generates the list page
 *
 * @example
 * export const AllPostsPage = createListPageEmitter({
 *   name: "AllPostsPage",
 *   pageBody: AllPosts,
 *   slug: allSlug,
 *   title: allTitle,
 *   description: allDescription,
 *   frontmatter: { tags: ["website"], aliases: ["recent-posts", "recent", "all"] },
 * })
 */
export function createListPageEmitter(config: ListPageEmitterConfig): QuartzEmitterPlugin {
  return () => {
    const opts = {
      ...defaultListPageLayout,
      ...sharedPageComponents,
      pageBody: config.pageBody,
    }

    const { head: Head, header, beforeBody, pageBody, left, right, footer: Footer } = opts
    const Header = HeaderConstructor()
    const Body = BodyConstructor()

    return {
      name: config.name,
      getQuartzComponents() {
        return [Head, Header, Body, ...header, ...beforeBody, pageBody, ...left, ...right, Footer]
      },
      // skipcq: JS-0116 have to return async for type signature
      async getDependencyGraph() {
        const graph = new DepGraph<FilePath>()
        return graph
      },
      async emit(
        ctx,
        content: ProcessedContent[],
        resources: StaticResources,
      ): Promise<FilePath[]> {
        const slug = config.slug
        const externalResources = pageResources(pathToRoot(slug), resources)
        const [tree, file] = defaultProcessedContent({
          slug,
          frontmatter: {
            title: config.title,
            ...config.frontmatter,
          },
          description: config.description,
          text: config.text ?? config.description,
        })

        const componentData: QuartzComponentProps = {
          ctx,
          fileData: file.data,
          externalResources,
          cfg: ctx.cfg.configuration,
          children: [],
          tree,
          allFiles: content.map((c) => c[1].data),
        }

        const renderedContent = renderPage(
          ctx.cfg.configuration,
          slug,
          componentData,
          opts,
          externalResources,
        )

        const fp = await write({
          ctx,
          content: renderedContent,
          slug,
          ext: ".html",
        })

        return [fp]
      },
    }
  }
}
