import { defaultListPageLayout, sharedPageComponents } from "../../../config/quartz/quartz.layout"
import BodyConstructor from "../../components/Body"
import HeaderConstructor from "../../components/Header"
import AllPosts, { allDescription, allSlug, allTitle } from "../../components/pages/AllPosts"
import { pageResources, renderPage } from "../../components/renderPage"
import { type QuartzComponentProps } from "../../components/types"
import DepGraph from "../../depgraph"
import { type FilePath, pathToRoot } from "../../util/path"
import { type StaticResources } from "../../util/resources"
import { type QuartzEmitterPlugin } from "../types"
import { type ProcessedContent, defaultProcessedContent } from "../vfile"
import { write } from "./helpers"

export const AllPostsPage: QuartzEmitterPlugin = () => {
  const opts = {
    ...defaultListPageLayout,
    ...sharedPageComponents,
    pageBody: AllPosts,
  }

  const { head: Head, header, beforeBody, pageBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "AllPostsPage",
    getQuartzComponents() {
      return [Head, Header, Body, ...header, ...beforeBody, pageBody, ...left, ...right, Footer]
    },
    // skipcq: JS-0116 have to return async for type signature
    async getDependencyGraph() {
      const graph = new DepGraph<FilePath>()
      return graph
    },
    async emit(ctx, content: ProcessedContent[], resources: StaticResources): Promise<FilePath[]> {
      const slug = allSlug
      const externalResources = pageResources(pathToRoot(slug), resources)
      const [tree, file] = defaultProcessedContent({
        slug,
        frontmatter: {
          title: allTitle,
          tags: ["website"],
          aliases: ["recent-posts", "recent", "all"],
        },
        description: allDescription,
        text: allDescription,
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
