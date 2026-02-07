// NOTE: Docstrings generated via AI; take with a grain of salt

import { type Element, type ElementContent, type Root } from "hast"
import { render } from "preact-render-to-string"
// skipcq: JS-W1028
import React from "react"
import { visit } from "unist-util-visit"

import { type GlobalConfiguration } from "../cfg"
import { type QuartzPluginData } from "../plugins/vfile"
import {
  clone,
  type FullSlug,
  type RelativeURL,
  joinSegments,
  normalizeHastElement,
  simplifySlug,
} from "../util/path"
import { JSResourceToScriptElement, type StaticResources } from "../util/resources"
import BodyConstructor from "./Body"
import { locale } from "./constants"
import HeaderConstructor from "./Header"
import { createPageListHast } from "./PageList"
import { allDescription, allSlug, allTitle, allPostsListing } from "./pages/AllPosts"
import {
  allTagsSlug,
  allTagsTitle,
  allTagsDescription,
  allTagsListing,
  generateAllTagsHast,
} from "./pages/AllTagsContent"
import { type QuartzComponent, type QuartzComponentProps } from "./types"

interface RenderComponents {
  head: QuartzComponent
  header: QuartzComponent[]
  beforeBody: QuartzComponent[]
  pageBody: QuartzComponent
  left: QuartzComponent[]
  right: QuartzComponent[]
  footer: QuartzComponent
}

const headerRegex = new RegExp(/h[1-6]/)

/**
 * Finds a file by slug or alias, prioritizing slug matches over alias matches.
 * @param files - Array of files to search through.
 * @param target - The target slug to find.
 * @returns The matching file, or undefined if not found.
 */
function findFileBySlugOrAlias(
  files: QuartzPluginData[],
  target: FullSlug,
): QuartzPluginData | undefined {
  return (
    files.find((f) => f.slug === target) ||
    files.find((f) => (f.frontmatter?.aliases as FullSlug[])?.includes(target))
  )
}

/**
 * Creates the anchor element linking back to the transclusion source.
 * The anchor is appended after transcluded content.
 *
 * @param inner - The inner element of the transclusion span containing the href.
 * @returns A HAST anchor element with classes `internal` and `transclude-src`.
 */
export function createTranscludeSourceAnchor(href: string): Element {
  return {
    type: "element" as const,
    tagName: "a" as const,
    properties: {
      href,
      class: ["internal", "transclude-src"],
      ariaHidden: "true",
      tabIndex: -1,
    },
    children: [] as ElementContent[],
  }
}

/**
 * Replaces a transclude span's children with a normalized block node from the target page.
 *
 * @param node - The transclude span node to mutate.
 * @param page - The page being transcluded from.
 * @param slug - The current page slug where content is rendered.
 * @param transcludeTarget - The target page slug being referenced.
 * @param blockRef - The block identifier within the target page's `blocks` map.
 */
export function setBlockTransclusion(
  node: Element,
  page: QuartzPluginData,
  slug: FullSlug,
  transcludeTarget: FullSlug,
  blockRef: string,
): void {
  const blockNode = page.blocks?.[blockRef]
  if (blockNode) {
    node.children = [normalizeHastElement(blockNode, slug, transcludeTarget)]
  }
}

/**
 * Replaces a transclude span's children with the section under a header in the target page.
 * The section spans from the matching header until the next header of the same or higher depth.
 *
 * @param node - The transclude span node to mutate.
 * @param page - The page being transcluded from (requires `htmlAst`).
 * @param slug - The current page slug where content is rendered.
 * @param transcludeTarget - The target page slug being referenced.
 * @param inner - The inner element of the original transclusion span (for link back href).
 * @param headerId - The id of the header within the target page to transclude from.
 */
export function setHeaderTransclusion(
  node: Element,
  page: QuartzPluginData,
  slug: FullSlug,
  transcludeTarget: FullSlug,
  headerId: string,
): void {
  const htmlAst = page.htmlAst
  if (!htmlAst) return

  let startIdx: number | undefined
  let startDepth: number | undefined
  let endIdx: number | undefined

  for (const [i, el] of htmlAst.children.entries()) {
    if (!(el.type === "element" && el.tagName.match(headerRegex))) continue
    const depth = Number(el.tagName.substring(1))

    if (startIdx === undefined || startDepth === undefined) {
      if (el.properties?.id === headerId) {
        startIdx = i
        startDepth = depth
      }
    } else if (depth <= startDepth) {
      endIdx = i
      break
    }
  }

  if (startIdx === undefined) return

  const headerIdx = startIdx
  node.children = [
    ...(htmlAst.children.slice(headerIdx + 1, endIdx) as ElementContent[]).map((child) =>
      normalizeHastElement(child as Element, slug, transcludeTarget),
    ),
  ]
}

/**
 * Replaces a transclude span's children with content from the beginning up to the first heading.
 * Appends a source anchor to the end.
 *
 * @param node - The transclude span node to mutate.
 * @param page - The page being transcluded from (requires `htmlAst`).
 * @param slug - The current page slug where content is rendered.
 * @param transcludeTarget - The target page slug being referenced.
 */
export function setIntroTransclusion(
  node: Element,
  page: QuartzPluginData,
  slug: FullSlug,
  transcludeTarget: FullSlug,
): void {
  const htmlAst = page.htmlAst
  if (!htmlAst) return

  let endIdx: number | undefined

  for (const [i, el] of htmlAst.children.entries()) {
    if (el.type === "element" && el.tagName.match(headerRegex)) {
      endIdx = i
      break
    }
  }

  const href = simplifySlug(transcludeTarget)
  node.children = [
    ...(htmlAst.children.slice(0, endIdx) as ElementContent[]).map((child) =>
      normalizeHastElement(child as Element, slug, transcludeTarget),
    ),
    createTranscludeSourceAnchor(href),
  ]
}

/**
 * Replaces a transclude span's children with the entire `htmlAst` of the target page,
 * excluding the trout decoration and everything after it.
 * Appends a source anchor to the end.
 *
 * @param node - The transclude span node to mutate.
 * @param page - The page being transcluded from (requires `htmlAst`).
 * @param slug - The current page slug where content is rendered.
 * @param transcludeTarget - The target page slug being referenced.
 * @param inner - The inner element of the original transclusion span (for link back href).
 */
export function setPageTransclusion(
  node: Element,
  page: QuartzPluginData,
  slug: FullSlug,
  transcludeTarget: FullSlug,
): void {
  const htmlAst = page.htmlAst
  if (!htmlAst) return

  let endIdx: number | undefined

  // Find the trout decoration container to exclude it
  for (const [i, el] of htmlAst.children.entries()) {
    if (el.type === "element" && el.tagName === "div" && el.properties?.id === "trout-container") {
      endIdx = i
      break
    }
  }

  const href = simplifySlug(transcludeTarget)
  node.children = [
    ...(htmlAst.children.slice(0, endIdx) as ElementContent[]).map((child) =>
      normalizeHastElement(child as Element, slug, transcludeTarget),
    ),
    createTranscludeSourceAnchor(href),
  ]
}

/**
 * Generates static resources (CSS/JS) paths for a given page
 * @param baseDir - Base directory slug or relative URL
 * @param staticResources - Existing static resources configuration
 * @returns StaticResources object with CSS and JS paths
 */
export function pageResources(
  baseDir: FullSlug | RelativeURL,
  staticResources: StaticResources,
): StaticResources {
  const contentIndexPath = joinSegments(baseDir, "static/contentIndex.json")
  const contentIndexScript = `const fetchData = fetch("${contentIndexPath}").then(data => data.json())`

  return {
    css: [joinSegments("/", "index.css"), ...staticResources.css],
    js: [
      {
        src: joinSegments(baseDir, "prescript.js"),
        loadTime: "beforeDOMReady",
        contentType: "external",
      },
      {
        loadTime: "beforeDOMReady",
        contentType: "inline",
        spaPreserve: true,
        script: contentIndexScript,
      },
      ...staticResources.js,
      {
        src: joinSegments(baseDir, "postscript.js"),
        loadTime: "afterDOMReady",
        moduleType: "module",
        contentType: "external",
      },
    ],
  }
}

/**
 * Generates a virtual file containing recent posts data
 * @param componentData - Component props containing site configuration and file data
 * @returns QuartzPluginData for recent posts
 */
const generateRecentPostsFile = (componentData: QuartzComponentProps): QuartzPluginData => {
  const hast = createPageListHast(
    componentData.cfg,
    componentData.fileData,
    componentData.allFiles,
    10,
  ) // Up to 10 posts

  return {
    slug: allSlug,
    title: allTitle,
    description: allDescription,
    blocks: { [allPostsListing]: hast },
  } as QuartzPluginData
}

/**
 * Generates a virtual file containing all tags data
 * @param componentData - Component props containing site configuration and file data
 * @returns QuartzPluginData for all tags
 */
const generateAllTagsFile = (componentData: QuartzComponentProps): QuartzPluginData => {
  // Generate the HAST for the all tags listing
  const hast = generateAllTagsHast(componentData)

  return {
    slug: allTagsSlug,
    title: allTagsTitle,
    description: allTagsDescription,
    blocks: { [allTagsListing]: hast },
  } as QuartzPluginData
}

/**
 * Adds a virtual file to `componentData.allFiles` for special transclusion targets.
 * Currently supports recent posts (`allSlug`) and all tags (`allTagsSlug`).
 *
 * @param transcludeTarget - The target slug referenced by the transclude span.
 * @param componentData - The current component props, mutated to include virtual files when needed.
 */
export function addVirtualFileForSpecialTransclude(
  transcludeTarget: FullSlug,
  componentData: QuartzComponentProps,
): void {
  if (transcludeTarget === allSlug) {
    componentData.allFiles.push(generateRecentPostsFile(componentData))
  } else if (transcludeTarget === allTagsSlug) {
    componentData.allFiles.push(generateAllTagsFile(componentData))
  }
}

/**
 * Renders a complete HTML page with all components and transclusions
 *
 * Process:
 * 1. Clones the component tree to avoid modifying cached content
 * 2. Processes all transclusions (blocks, headers, full pages)
 * 3. Applies formatting improvements through normalizeHastElement
 * 4. Renders the full page structure with headers, sidebars, and content
 *
 * @param cfg - Global site configuration
 * @param slug - Current page slug
 * @param componentData - Props containing page data and configuration
 * @param components - Object containing all page component definitions
 * @param pageResources - Static resources (CSS/JS) for the page
 * @returns Rendered HTML string
 *
 * @see {@link normalizeHastElement} for transclusion formatting
 * @see {@link quartz/plugins/transformers/formatting_improvement_html.ts} for text formatting rules
 */
export function renderPage(
  cfg: GlobalConfiguration,
  slug: FullSlug,
  componentData: QuartzComponentProps,
  components: RenderComponents,
  pageResources: StaticResources,
): string {
  // make a deep copy of the tree so we don't remove the transclusion references
  // for the file cached in contentMap in build.ts
  const root = clone(componentData.tree) as Root

  // process transcludes in componentData
  visit(root, "element", (node) => {
    if (node.tagName === "span") {
      const classNames = (node.properties?.className ?? []) as string[]
      if (classNames.includes("transclude")) {
        const transcludeTarget = node.properties["dataUrl"] as FullSlug

        addVirtualFileForSpecialTransclude(transcludeTarget, componentData)

        const page = findFileBySlugOrAlias(componentData.allFiles, transcludeTarget)
        if (!page) {
          return
        }

        let blockRef = node.properties.dataBlock as string | undefined
        if (blockRef?.startsWith("#^")) {
          // Transclude block
          blockRef = blockRef.slice("#^".length)
          setBlockTransclusion(node, page, slug, transcludeTarget, blockRef)
        } else if (blockRef === "#" && page.htmlAst) {
          // intro transclude (from beginning to first heading) - ![[page#]]
          setIntroTransclusion(node, page, slug, transcludeTarget)
        } else if (blockRef?.startsWith("#") && page.htmlAst) {
          // header transclude - ![[page#section]]
          setHeaderTransclusion(node, page, slug, transcludeTarget, blockRef.slice(1))
        } else if (page.htmlAst) {
          // page transclude (whole article excluding trout decoration) - ![[page]]
          setPageTransclusion(node, page, slug, transcludeTarget)
        }
      }
    }
  })

  // set componentData.tree to the edited html that has transclusions rendered
  componentData.tree = root

  const {
    head: Head,
    header,
    beforeBody,
    pageBody: Content,
    left,
    right,
    footer: Footer,
  } = components
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  const LeftComponent = (
    <aside id="left-sidebar" className="sidebar" aria-label="Site navigation">
      {left.map((BodyComponent) => (
        <BodyComponent {...componentData} key={BodyComponent.name} />
      ))}
    </aside>
  )

  const RightComponent = (
    <aside id="right-sidebar" className="sidebar" aria-label="Table of contents">
      {right.map((BodyComponent) => (
        <BodyComponent {...componentData} key={BodyComponent.name} />
      ))}
    </aside>
  )

  const pageHeader = (
    <div className="page-header">
      <Header {...componentData}>
        {header.map((HeaderComponent) => (
          <HeaderComponent {...componentData} key={HeaderComponent.name} />
        ))}
      </Header>
      <div className="previewable">
        {beforeBody.map((BodyComponent) => (
          <BodyComponent {...componentData} key={BodyComponent.name} />
        ))}
      </div>
    </div>
  )

  const body = (
    <body data-slug={slug}>
      <div id="quartz-root" className="page">
        <Body {...componentData}>
          {LeftComponent}
          {RightComponent}
          <main id="center-content">
            {pageHeader}
            <Content {...componentData} />
          </main>
        </Body>
        <Footer {...componentData} />
      </div>
    </body>
  )

  const doc = (
    <html lang={locale}>
      <Head {...componentData} />
      {body}
      {pageResources.js
        .filter((resource) => resource.loadTime === "afterDOMReady")
        .map((res) => JSResourceToScriptElement(res))}
    </html>
  )

  return `<!DOCTYPE html>\n${render(doc)}`
}
