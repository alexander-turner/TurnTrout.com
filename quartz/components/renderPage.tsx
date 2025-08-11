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
} from "../util/path"
import { JSResourceToScriptElement, type StaticResources } from "../util/resources"
import BodyConstructor from "./Body"
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

        if (transcludeTarget === allSlug) {
          componentData.allFiles.push(generateRecentPostsFile(componentData))
        } else if (transcludeTarget === allTagsSlug) {
          componentData.allFiles.push(generateAllTagsFile(componentData))
        }

        const page = componentData.allFiles.find((f) => f.slug === transcludeTarget)
        if (!page) {
          return
        }

        const inner = node.children[0] as Element
        let blockRef = node.properties.dataBlock as string | undefined
        if (blockRef?.startsWith("#^")) {
          // Transclude block
          blockRef = blockRef.slice("#^".length)
          const blockNode = page.blocks?.[blockRef]
          if (blockNode) {
            node.children = [normalizeHastElement(blockNode, slug, transcludeTarget)]
          }
        } else if (blockRef?.startsWith("#") && page.htmlAst) {
          // header transclude
          blockRef = blockRef.slice(1)
          let startIdx: number | undefined
          let startDepth: number | undefined
          let endIdx: number | undefined
          for (const [i, el] of page.htmlAst.children.entries()) {
            // skip non-headers
            if (!(el.type === "element" && el.tagName.match(headerRegex))) continue
            const depth = Number(el.tagName.substring(1))

            // lookin for our blockref
            if (startIdx === undefined || startDepth === undefined) {
              // skip until we find the blockref that matches
              if (el.properties?.id === blockRef) {
                startIdx = i
                startDepth = depth
              }
            } else if (depth <= startDepth) {
              // looking for new header that is same level or higher
              endIdx = i
              break
            }
          }

          if (startIdx === undefined) {
            return
          }

          // Skip the header that we found the blockref in
          const headerIdx = startIdx
          node.children = [
            ...(page.htmlAst.children.slice(headerIdx + 1, endIdx) as ElementContent[]).map(
              (child) => normalizeHastElement(child as Element, slug, transcludeTarget),
            ),
            {
              type: "element",
              tagName: "a",
              properties: {
                href: inner.properties?.href,
                class: ["internal", "transclude-src"],
              },
              children: [],
            },
          ]
        } else if (page.htmlAst) {
          // page transclude
          node.children = [
            ...(page.htmlAst.children as ElementContent[]).map((child) =>
              normalizeHastElement(child as Element, slug, transcludeTarget),
            ),
            {
              type: "element",
              tagName: "a",
              properties: { href: inner.properties?.href, class: ["internal", "transclude-src"] },
              children: [],
            },
          ]
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
    <div id="left-sidebar" className="sidebar">
      {left.map((BodyComponent) => (
        <BodyComponent {...componentData} key={BodyComponent.name} />
      ))}
    </div>
  )

  const RightComponent = (
    <div id="right-sidebar" className="sidebar">
      {right.map((BodyComponent) => (
        <BodyComponent {...componentData} key={BodyComponent.name} />
      ))}
    </div>
  )

  const pageHeader = (
    <div className="page-header">
      <Header {...componentData}>
        {header.map((HeaderComponent) => (
          <HeaderComponent {...componentData} key={HeaderComponent.name} />
        ))}
      </Header>
      <div className="popover-hint">
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
          <div id="center-content">
            {pageHeader}
            <Content {...componentData} />
          </div>
          {RightComponent}
        </Body>
        <Footer {...componentData} />
      </div>
    </body>
  )

  const lang = componentData.fileData.frontmatter?.lang ?? cfg.locale?.split("-")[0] ?? "en"
  const doc = (
    <html lang={lang}>
      <Head {...componentData} />
      {body}
      {pageResources.js
        .filter((resource) => resource.loadTime === "afterDOMReady")
        .map((res) => JSResourceToScriptElement(res))}
    </html>
  )

  return `<!DOCTYPE html>\n${render(doc)}`
}
