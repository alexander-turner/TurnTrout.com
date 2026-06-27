import { type Element, type ElementContent, type Root } from "hast"
import { render } from "preact-render-to-string"
// skipcq: JS-W1028
import React from "react"
import { visit } from "unist-util-visit"

import { type QuartzPluginData } from "../plugins/vfile"
import { type GlobalConfiguration } from "../util/config"
import {
  clone,
  type FullSlug,
  joinSegments,
  normalizeHastElement,
  type RelativeURL,
  simplifySlug,
} from "../util/path"
import { JSResourceToScriptElement, type StaticResources } from "../util/resources"
import { locale, PREVIEWABLE_CLASS, twemojiBaseUrl } from "./constants"
import { createPageListHast } from "./PageList"
import { allDescription, allPostsListing, allSlug, allTitle } from "./pages/AllPosts"
import {
  allTagsDescription,
  allTagsListing,
  allTagsSlug,
  allTagsTitle,
  generateAllTagsHast,
} from "./pages/AllTagsContent"
import PageShellConstructor from "./PageShell"
import { type QuartzComponent, type QuartzComponentProps } from "./types"

interface RenderComponents {
  head: QuartzComponent
  beforeBody: QuartzComponent[]
  pageBody: QuartzComponent
  left: QuartzComponent[]
  right: QuartzComponent[]
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
  // Lazy-load contentIndex.json only when search is initialized to avoid blocking initial page load
  const contentIndexScript = `const contentIndexPath = "${contentIndexPath}";
let fetchData = null;
function getContentIndex() {
  if (!fetchData) {
    fetchData = fetch(contentIndexPath).then(data => data.json()).catch(err => { console.error('[getContentIndex] Failed to load content index:', err); fetchData = null; return null; });
  }
  return fetchData;
}`

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
 * 3. Rebases links in transcluded content via normalizeHastElement
 * 4. Renders the full page structure with headers, sidebars, and content
 *
 * @param cfg - Global site configuration
 * @param slug - Current page slug
 * @param componentData - Props containing page data and configuration
 * @param components - Object containing all page component definitions
 * @param pageResources - Static resources (CSS/JS) for the page
 * @returns Rendered HTML string
 *
 * @see {@link normalizeHastElement} for transclusion link rebasing
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

  componentData.tree = root

  const { head: Head, beforeBody, pageBody: Content, left, right } = components
  const PageShell = PageShellConstructor()

  const LeftComponent = (
    <aside id="left-sidebar" className="sidebar" aria-label="Site navigation">
      {left.map((LayoutComponent) => (
        <LayoutComponent {...componentData} key={LayoutComponent.name} />
      ))}
    </aside>
  )

  const RightComponent = (
    <aside id="right-sidebar" className="sidebar" aria-label="Supplementary content">
      {right.map((LayoutComponent) => (
        <LayoutComponent {...componentData} key={LayoutComponent.name} />
      ))}
    </aside>
  )

  const pageHeader = (
    <div className="page-header">
      <div className={PREVIEWABLE_CLASS}>
        {beforeBody.map((LayoutComponent) => (
          <LayoutComponent {...componentData} key={LayoutComponent.name} />
        ))}
      </div>
    </div>
  )

  const body = (
    <body data-slug={slug}>
      <a
        href="#center-content"
        className="skip-to-content internal same-page-link"
        aria-label="Skip to main content"
      />
      <div id="site-root" className="page">
        <PageShell {...componentData}>
          {LeftComponent}
          {RightComponent}
          <main id="center-content">
            {pageHeader}
            <Content {...componentData} />
          </main>
        </PageShell>
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

  return optimizeLcpImage(`<!DOCTYPE html>\n${render(doc)}`)
}

/**
 * Returns the LCP-eligible content image `src` for an `<img>` tag, or `null`
 * when the tag is a favicon, a Twemoji glyph, or has no `src`.
 */
function lcpImageSrc(imgTag: string): string | null {
  if (/\bfavicon\b/.test(imgTag)) return null
  const src = imgTag.match(/\bsrc="(?<srcValue>[^"]*)"/)?.groups?.["srcValue"]
  if (src === undefined) return null
  // Twemoji glyphs are tiny inline characters, never the LCP element.
  if (src.startsWith(twemojiBaseUrl)) return null
  return src
}

/** Promotes an `<img>` tag string to `loading="eager"` and `fetchpriority="high"`. */
function promoteImgTag(imgTag: string): string {
  let newTag = imgTag

  if (/\bloading="/.test(newTag)) {
    newTag = newTag.replace(/\bloading="[^"]*"/, 'loading="eager"')
  } else {
    newTag = newTag.replace("<img ", '<img loading="eager" ')
  }

  if (/\bfetchpriority="/.test(newTag)) {
    newTag = newTag.replace(/\bfetchpriority="[^"]*"/, 'fetchpriority="high"')
  } else {
    newTag = newTag.replace("<img ", '<img fetchpriority="high" ')
  }

  return newTag
}

/**
 * If `imgIdx` falls inside an `<img-comparison-slider>` within the article,
 * returns the slider's inner `[start, end)` range; otherwise `null`.
 */
function enclosingSliderRange(
  html: string,
  articleIdx: number,
  imgIdx: number,
): { start: number; end: number } | null {
  const openIdx = html.lastIndexOf("<img-comparison-slider", imgIdx)
  if (openIdx < articleIdx) return null

  const start = html.indexOf(">", openIdx) + 1
  const end = html.indexOf("</img-comparison-slider>", start)
  // The image is enclosed only when the slider closes after it.
  if (end <= imgIdx) return null

  return { start, end }
}

/**
 * Post-processes rendered HTML to ensure the LCP image has `loading="eager"`,
 * `fetchpriority="high"`, and a matching `<link rel="preload">` in `<head>`.
 *
 * The LCP candidate is the first content image in the article. Inside an
 * `<img-comparison-slider>`, two equally sized images overlap and the browser
 * can pick the second (overlay) image as the LCP element, so every image in the
 * slider is promoted.
 *
 * Catches images from React components that bypass the CrawlLinks transformer
 * pipeline. Idempotent: pages already optimized by the transformer are
 * unchanged.
 */
export function optimizeLcpImage(html: string): string {
  const articleIdx = html.indexOf("<article")
  if (articleIdx === -1) return html

  const articleEndIdx = html.indexOf("</article>", articleIdx)
  if (articleEndIdx === -1) return html

  const imgRegex = /<img\s[^>]*>/g
  imgRegex.lastIndex = articleIdx

  const candidates: { index: number; tag: string; src: string }[] = []
  let match: RegExpExecArray | null
  while ((match = imgRegex.exec(html)) !== null) {
    if (match.index >= articleEndIdx) break
    const src = lcpImageSrc(match[0])
    if (src === null) continue
    candidates.push({ index: match.index, tag: match[0], src })
  }
  if (candidates.length === 0) return html

  const sliderRange = enclosingSliderRange(html, articleIdx, candidates[0].index)
  const targets = sliderRange
    ? candidates.filter((c) => c.index < sliderRange.end)
    : [candidates[0]]

  // Rewrite tags back-to-front so earlier indices stay valid as the string grows.
  for (let i = targets.length - 1; i >= 0; i--) {
    const { index, tag } = targets[i]
    const newTag = promoteImgTag(tag)
    if (newTag !== tag) {
      html = html.slice(0, index) + newTag + html.slice(index + tag.length)
    }
  }

  // `crossorigin` on the preload must match the <img>'s CORS mode. All content
  // images are CDN-sourced and carry `crossorigin="anonymous"`.
  for (const { src } of targets) {
    if (!html.includes(`<link rel="preload" href="${src}" as="image"`)) {
      html = html.replace(
        "</head>",
        `<link rel="preload" href="${src}" as="image" crossorigin="anonymous"/></head>`,
      )
    }
  }

  return html
}
