import GithubSlugger from "github-slugger"
import { headingRank } from "hast-util-heading-rank"
import { toString } from "hast-util-to-string"
import { visit } from "unist-util-visit"

import remarkGfm from "remark-gfm"
import smartypants from "remark-smartypants"
import { QuartzTransformerPlugin } from "../types"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import { Root, Element } from "hast"
import rehypeSlug from "rehype-slug"

export interface Options {
  enableSmartyPants: boolean
  linkHeadings: boolean
}

const defaultOptions: Options = {
  enableSmartyPants: true,
  linkHeadings: true,
}

export const GitHubFlavoredMarkdown: QuartzTransformerPlugin<Partial<Options> | undefined> = (
  userOpts,
) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "GitHubFlavoredMarkdown",
    markdownPlugins() {
      return opts.enableSmartyPants ? [remarkGfm, smartypants] : [remarkGfm]
    },
    htmlPlugins() {
      if (opts.linkHeadings) {
        return [
          slugFunction,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "wrap",
              properties: {
                "data-no-popover": "true",
                ariaHidden: true,
                tabIndex: -1,
              },
            },
          ],
        ]
      } else {
        return []
      }
    },
  }
}

const slugger = new GithubSlugger()

export function preprocessSlug(headerText: string): string {
  const charsToConvert = ["'", "’", "/", "&", "—", "‘"]

  let protoSlug = headerText
  for (const char of charsToConvert) {
    protoSlug = protoSlug.replaceAll(new RegExp(char, "g"), "-")
  }

  // Remove consecutive hyphens
  protoSlug = protoSlug.replaceAll(/-+/g, '-')

  return protoSlug
}

export function slugify(headerText: string): string {
  const protoSlug = preprocessSlug(headerText)
  const slug = slugger.slug(protoSlug)
  return slug.replaceAll(/-+/g, '-')
}

export function resetSlugger() {
  slugger.reset()
}

/**
 * Add `id`s to headings.
 *
 * @returns
 *   Transform.
 */
export function slugFunction() {
  return function (tree: Root) {
    slugger.reset()

    visit(tree, "element", function (node: Element) {
      if (headingRank(node) && !node.properties.id) {
        node.properties.id = slugify(toString(node))
      }
    })

    rehypeSlug()(tree)
  }
}
