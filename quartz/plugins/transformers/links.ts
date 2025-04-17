import type { Root } from "hast"

import isAbsoluteUrl from "is-absolute-url"
import path from "path"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

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
  externalLinkIcon: boolean
}

const defaultOptions: Options = {
  markdownLinkResolution: "absolute",
  prettyLinks: true,
  openLinksInNewTab: true,
  lazyLoad: true,
  externalLinkIcon: false,
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

            const transformOptions: TransformOptions = {
              strategy: opts.markdownLinkResolution,
              allSlugs: ctx.allSlugs,
            }

            // skipcq: JS-R1005
            visit(tree, "element", (node, index, parent) => {
              // rewrite all links
              if (
                node.tagName === "a" &&
                node.properties &&
                typeof node.properties.href === "string"
              ) {
                let dest = node.properties.href as RelativeURL
                const classes = (node.properties.className ?? []) as string[]

                if (dest.startsWith("#")) {
                  classes.push("same-page-link")
                }

                const internalMarkers = ["#", ".", "/"]
                const isExternal = !internalMarkers.some((prefix) => dest.startsWith(prefix))

                if (isExternal) {
                  classes.push("external")
                } else {
                  classes.push("internal")

                  const headers = ["h1", "h2", "h3", "h4", "h5", "h6"]
                  const isLinkOfHeader =
                    parent?.type === "element" &&
                    headers.some((header) => header === parent.tagName)
                  if (!isLinkOfHeader) {
                    classes.push("can-trigger-popover")
                  }
                }

                // If the link is external and not a mailto link, make sure it starts with http
                if (isExternal && !dest.startsWith("http") && !dest.startsWith("mailto:")) {
                  dest = `https://${String(dest)}` as RelativeURL
                  node.properties.href = String(dest)
                }
                if (isExternal && opts.externalLinkIcon) {
                  node.children.push({
                    type: "element",
                    tagName: "svg",
                    properties: {
                      class: "external-icon",
                      viewBox: "0 0 512 512",
                    },
                    children: [
                      {
                        type: "element",
                        tagName: "path",
                        properties: {
                          d: "M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z",
                        },
                        children: [],
                      },
                    ],
                  })
                }

                // Check if the link has alias text
                if (
                  node.children.length === 1 &&
                  node.children[0].type === "text" &&
                  node.children[0].value !== dest
                ) {
                  // Add the 'alias' class if the text content is not the same as the href
                  classes.push("alias")
                }
                node.properties.className = classes

                if (opts.openLinksInNewTab && isExternal) {
                  node.properties.target = "_blank"
                }
                if (isExternal) {
                  node.properties.rel = "noopener noreferrer"
                }

                // don't process external links or intra-document anchors
                const isInternal = !(isAbsoluteUrl(dest) || dest.startsWith("#") || isExternal)

                if (isInternal) {
                  dest = node.properties.href = transformLink(
                    file.data.slug as FullSlug,
                    dest,
                    transformOptions,
                  )

                  // url.resolve is considered legacy
                  // WHATWG equivalent https://nodejs.dev/en/api/v18/url/#urlresolvefrom-to
                  const url = new URL(dest, `https://base.com/${stripSlashes(curSlug, true)}`)
                  const canonicalDest = url.pathname
                  let destCanonical = splitAnchor(canonicalDest)[0]
                  if (destCanonical.endsWith("/")) {
                    destCanonical += "index"
                  }

                  // need to decodeURIComponent here as WHATWG URL percent-encodes everything
                  const full = decodeURIComponent(stripSlashes(destCanonical, true)) as FullSlug
                  const simple = simplifySlug(full)
                  outgoing.add(simple)
                  node.properties["data-slug"] = full
                }

                // rewrite link internals if prettylinks is on
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

              // transform all other resources that may use links
              if (
                ["img", "video", "audio", "iframe"].includes(node.tagName) &&
                node.properties &&
                typeof node.properties.src === "string"
              ) {
                if (opts.lazyLoad) {
                  node.properties.loading = "lazy"
                }

                // TODO leaving this be, but might need to be updated along with isExternal
                if (!isAbsoluteUrl(node.properties.src)) {
                  let dest = node.properties.src as RelativeURL
                  dest = node.properties.src = transformLink(
                    file.data.slug as FullSlug,
                    dest,
                    transformOptions,
                  )
                  node.properties.src = dest
                }
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
