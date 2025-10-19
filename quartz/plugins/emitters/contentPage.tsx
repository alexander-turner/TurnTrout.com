import chalk from "chalk"
import { type Root } from "hast"
import path from "path"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { type FullPageLayout } from "../../cfg"
import { Content } from "../../components"
import BodyConstructor from "../../components/Body"
import HeaderConstructor from "../../components/Header"
import { pageResources, renderPage } from "../../components/renderPage"
import { type QuartzComponentProps } from "../../components/types"
import DepGraph from "../../depgraph"
import { type Argv } from "../../util/ctx"
import {
  type FilePath,
  type FullSlug,
  isRelativeURL,
  joinSegments,
  pathToRoot,
} from "../../util/path"
import { type QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

// get all the dependencies for the markdown file
// eg. images, scripts, stylesheets, transclusions
const parseDependencies = (argv: Argv, hast: Root, file: VFile): string[] => {
  const dependencies: FilePath[] = []

  visit(hast, "element", (elem): void => {
    let ref: string | null = null

    if (
      ["script", "img", "audio", "video", "source", "iframe"].includes(elem.tagName) &&
      elem?.properties?.src
    ) {
      ref = elem.properties.src.toString()
    } else if (["a", "link"].includes(elem.tagName) && elem?.properties?.href) {
      // transclusions will create a tags with relative hrefs
      ref = elem.properties.href.toString()
    }

    // if it is a relative url, its a local file and we need to add
    // it to the dependency graph. otherwise, ignore
    if (ref === null || !isRelativeURL(ref)) {
      return
    }

    // istanbul ignore next
    let fp = path
      .join(file.data.filePath ?? "", path.relative(argv.directory, ref))
      .replace(/\\/g, "/")
    // markdown files have the .md extension stripped in hrefs, add it back here
    if (!fp.split("/").pop()?.includes(".")) {
      fp += ".md"
    }
    dependencies.push(fp as FilePath)
  })

  return dependencies
}

function getSlug(file: VFile): FullSlug {
  const permalink = file.data.frontmatter?.permalink
  return (
    typeof permalink === "string" && permalink !== "" ? permalink : file.data.slug
  ) as FullSlug
}

export const ContentPage: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "ContentPage",

    // istanbul ignore next
    getQuartzComponents() {
      return [Head, Header, Body, ...header, ...beforeBody, pageBody, ...left, ...right, Footer]
    },

    async getDependencyGraph(ctx, content) {
      const graph = new DepGraph<FilePath>()

      for (const [tree, file] of content) {
        // istanbul ignore next
        if (!file.data.filePath) continue
        const sourcePath = file.data.filePath
        const slug = getSlug(file)
        graph.addEdge(sourcePath, joinSegments(ctx.argv.output, `${slug}.html`) as FilePath)

        parseDependencies(ctx.argv, tree as Root, file).forEach((dep) => {
          graph.addEdge(dep as FilePath, sourcePath)
        })
      }

      return graph
    },

    async emit(ctx, content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration
      const fps: FilePath[] = []
      const allFiles = content.map((c) => c[1].data)

      let containsIndex = false
      for (const [tree, file] of content) {
        const slug = getSlug(file)
        const aliases = (file.data.frontmatter?.aliases as FullSlug[]) ?? []
        if ([slug, ...aliases].includes("index" as FullSlug)) {
          containsIndex = true
        }

        const externalResources = pageResources(pathToRoot(slug), resources)
        // istanbul ignore next
        const componentData: QuartzComponentProps = {
          ctx,
          fileData: file.data ?? {},
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
        }

        const content = renderPage(cfg, slug as FullSlug, componentData, opts, externalResources)
        const fp = await write({
          ctx,
          content,
          slug,
          ext: ".html",
        })

        fps.push(fp)
      }

      if (!containsIndex && !ctx.argv.fastRebuild) {
        console.log(
          chalk.yellow(
            `\nWarning: you seem to be missing an \`index.md\` home page file at the root of your \`${ctx.argv.directory}\` folder. This may cause errors when deploying.`,
          ),
        )
      }

      return fps
    },
  }
}
