import type { FullPageLayout } from "../../cfg"
import type { QuartzComponentProps } from "../../components/types"
import type { QuartzEmitterPlugin } from "../types"

import { defaultListPageLayout, sharedPageComponents } from "../../../config/quartz/quartz.layout"
import { TagContent } from "../../components"
import BodyConstructor from "../../components/Body"
import { uiStrings } from "../../components/constants"
import HeaderConstructor from "../../components/Header"
import { pageResources, renderPage } from "../../components/renderPage"
import DepGraph from "../../depgraph"
import {
  type FilePath,
  type FullSlug,
  getAllSegmentPrefixes,
  joinSegments,
  pathToRoot,
} from "../../util/path"
import { type ProcessedContent, defaultProcessedContent } from "../vfile"
import { write } from "./helpers"

/**
 * TagPage plugin for Quartz
 * Generates pages for each tag and a tag index page
 */
export const TagPage: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
  // Merge user options with default options
  const opts: FullPageLayout = {
    ...defaultListPageLayout,
    ...sharedPageComponents,
    pageBody: TagContent(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "TagPage",
    getQuartzComponents() {
      return [Head, Header, Body, ...header, ...beforeBody, pageBody, ...left, ...right, Footer]
    },
    async getDependencyGraph(ctx, content) {
      const graph = new DepGraph<FilePath>()

      // Build dependency graph for tag pages
      for (const [, file] of content) {
        const sourcePath = file.data.filePath || ("" as FilePath)
        const tags = (file.data.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes)
        // If the file has at least one tag, it is used in the tag index page
        if (tags.length > 0) {
          tags.push("index")
        }

        for (const tag of tags) {
          graph.addEdge(
            sourcePath,
            joinSegments(ctx.argv.output, "tags", `${tag}.html`) as FilePath,
          )
        }
      }

      return graph
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      const fps: FilePath[] = []
      const allFiles = content.map((c) => c[1].data)
      const cfg = ctx.cfg.configuration

      // Collect all unique tags
      const tags: Set<string> = new Set(
        allFiles.flatMap((data) => data.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes),
      )

      // Add base tag for index page
      tags.add("index")

      // Create tag descriptions
      const tagDescriptions: Record<string, ProcessedContent> = Object.fromEntries(
        [...tags].map((tag) => {
          const title =
            tag === "index"
              ? uiStrings.pages.tagContent.tagIndex
              : `${uiStrings.pages.tagContent.tag}: ${tag}`
          return [
            tag,
            defaultProcessedContent({
              slug: joinSegments("tags", tag) as FullSlug,
              frontmatter: { title, tags: [] },
              description: "",
              text: "",
            }),
          ]
        }),
      )

      // Override tag descriptions with user-defined content
      for (const [tree, file] of content) {
        const slug = file.data.slug || ("" as FullSlug)
        if (slug.startsWith("tags/")) {
          const tag = slug.slice("tags/".length)
          if (tags.has(tag)) {
            tagDescriptions[tag] = [tree, file]
          }
        }
      }

      // Generate pages for each tag
      for (const tag of tags) {
        const slug = joinSegments("tags", tag) as FullSlug
        const externalResources = pageResources(pathToRoot(slug), resources)
        const [tree, file] = tagDescriptions[tag]
        const componentData: QuartzComponentProps = {
          ctx,
          fileData: file.data,
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
        }

        const content = renderPage(cfg, slug, componentData, opts, externalResources)
        const fp = await write({
          ctx,
          content,
          slug: file.data.slug || ("" as FullSlug),
          ext: ".html",
        })

        fps.push(fp)
      }
      return fps
    },
  }
}
