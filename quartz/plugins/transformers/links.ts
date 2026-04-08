import type { Element, Root } from "hast"
import type { VFile } from "vfile"

import isAbsoluteUrl from "is-absolute-url"
import path from "path"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

import { EXTERNAL_LINK_REL, CAN_TRIGGER_POPOVER_CLASS } from "../../components/constants"
import {
  type FullSlug,
  type RelativeURL,
  type SimpleSlug,
  type TransformOptions,
  stripSlashes,
  simplifySlug,
  splitAnchor,
  transformLink,
} from "../../util/path"

interface Options {
  /** How to resolve Markdown paths */
  markdownLinkResolution: TransformOptions["strategy"]
  /** Strips folders from a link so that it looks nice */
  prettyLinks: boolean
  openLinksInNewTab: boolean
  lazyLoad: boolean
}

const defaultOptions: Options = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: true,
  lazyLoad: true,
}

const HEADER_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])
const MEDIA_TAGS: ReadonlySet<string> = new Set(["img", "video", "audio", "iframe"])

/**
 * Whether a URL should be left as-is (not rewritten by `transformLink`).
 * True for scheme-based URLs (`https:`, `data:`) and anchors (`#`).
 */
export function isNonRewritableUrl(url: string): boolean {
  return isAbsoluteUrl(url) || url.startsWith("#")
}

/** A link is external if it doesn't start with #, ., or / */
export function isExternalLink(href: string): boolean {
  return !/^[#./]/.test(href)
}

/** Whether a link points to a resolvable internal page (not external, not non-rewritable) */
function isResolvableInternalLink(href: string, isExternal: boolean): boolean {
  return !isExternal && !isNonRewritableUrl(href)
}

/** Resolve an internal link's destination and track it as an outgoing link. */
function resolveInternalLink(
  dest: RelativeURL,
  node: Element,
  file: VFile,
  curSlug: SimpleSlug,
  transformOptions: TransformOptions,
  outgoing: Set<SimpleSlug>,
): RelativeURL {
  dest = node.properties.href = transformLink(file.data.slug as FullSlug, dest, transformOptions)

  // Dummy hostname required by WHATWG URL constructor; only the pathname is used
  const url = new URL(dest, `https://base.com/${stripSlashes(curSlug, true)}`)
  let canonicalPath = splitAnchor(url.pathname)[0]
  if (canonicalPath.endsWith("/")) {
    canonicalPath += "index"
  }

  // decodeURIComponent needed because WHATWG URL percent-encodes everything
  const full = decodeURIComponent(stripSlashes(canonicalPath, true)) as FullSlug
  outgoing.add(simplifySlug(full))
  node.properties["data-slug"] = full

  return dest
}

/**
 * Classify and rewrite an `<a>` element:
 *  1. Tag it as "external" or "internal" (+ popover class for non-header internals).
 *  2. Normalize bare external domains to https:// and set target/rel attributes.
 *  3. Resolve internal links via `transformLink` and record them as outgoing.
 *  4. Apply prettyLinks (strip folder prefix from display text).
 */
function processAnchor(
  node: Element,
  parent: Element | null,
  opts: Options,
  file: VFile,
  curSlug: SimpleSlug,
  transformOptions: TransformOptions,
  outgoing: Set<SimpleSlug>,
): void {
  if (typeof node.properties.href !== "string") return

  let dest = node.properties.href as RelativeURL
  const classes = (node.properties.className ?? []) as string[]
  const isExternal = isExternalLink(dest)

  if (dest.startsWith("#")) {
    classes.push("same-page-link")
  }

  if (isExternal) {
    classes.push("external")

    // Ensure bare domains like "example.com" get a protocol
    if (!dest.startsWith("http") && !dest.startsWith("mailto:")) {
      dest = `https://${dest}` as RelativeURL
      node.properties.href = dest
    }
    if (opts.openLinksInNewTab) {
      node.properties.target = "_blank"
    }
    node.properties.rel = EXTERNAL_LINK_REL
  } else {
    classes.push("internal")

    // Header links (e.g. clickable section titles) shouldn't trigger popovers
    const isLinkInsideHeader = parent?.type === "element" && HEADER_TAGS.has(parent.tagName)
    if (!isLinkInsideHeader) {
      classes.push(CAN_TRIGGER_POPOVER_CLASS)
    }
  }

  node.properties.className = classes

  // "Resolvable internal" excludes anchors (#foo) and absolute URLs that happen to be internal
  const isInternal = isResolvableInternalLink(dest, isExternal)
  if (isInternal) {
    dest = resolveInternalLink(dest, node, file, curSlug, transformOptions, outgoing)
  }

  if (
    opts.prettyLinks &&
    isInternal &&
    node.children.length === 1 &&
    node.children[0].type === "text" &&
    !node.children[0].value.startsWith("#")
  ) {
    node.children[0].value = path.basename(node.children[0].value)
  }
}

/**
 * Set loading strategy and resolve src for media elements (img, video, audio, iframe).
 *
 * The first `<img>` is marked eager (likely LCP element) and its URL stored
 * for `<link rel="preload">` in `<head>`. All other media get `loading="lazy"`.
 * Relative `src` URLs are resolved via `transformLink`.
 *
 * @returns Updated `seenFirstContentImage` flag.
 */
function processMedia(
  node: Element,
  opts: Options,
  file: VFile,
  seenFirstContentImage: boolean,
  transformOptions: TransformOptions,
): boolean {
  if (typeof node.properties.src !== "string") return seenFirstContentImage

  if (opts.lazyLoad) {
    if (node.tagName === "img" && !seenFirstContentImage) {
      seenFirstContentImage = true
      node.properties.loading = "eager"
      node.properties.fetchpriority = "high"
      file.data.firstImageUrl = node.properties.src
    } else {
      node.properties.loading = "lazy"
    }
  }

  const src = node.properties.src as string
  if (!isNonRewritableUrl(src) && !src.startsWith("/")) {
    node.properties.src = transformLink(
      file.data.slug as FullSlug,
      node.properties.src as RelativeURL,
      transformOptions,
    )
  }

  return seenFirstContentImage
}

export const CrawlLinks: QuartzTransformerPlugin<Partial<Options> | undefined> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "LinkProcessing",
    htmlPlugins(ctx) {
      return [
        () => {
          return (tree: Root, file) => {
            const curSlug = simplifySlug(file.data.slug as FullSlug)
            const outgoing: Set<SimpleSlug> = new Set()
            let seenFirstContentImage = false

            const transformOptions: TransformOptions = {
              strategy: opts.markdownLinkResolution,
              allSlugs: ctx.allSlugs,
            }

            visit(tree, "element", (node, _index, parent) => {
              if (node.tagName === "a") {
                processAnchor(
                  node,
                  parent?.type === "element" ? parent : null,
                  opts,
                  file,
                  curSlug,
                  transformOptions,
                  outgoing,
                )
              } else if (MEDIA_TAGS.has(node.tagName)) {
                seenFirstContentImage = processMedia(
                  node,
                  opts,
                  file,
                  seenFirstContentImage,
                  transformOptions,
                )
              }
            })

            file.data.links = [...outgoing]
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    links: SimpleSlug[]
  }
}
