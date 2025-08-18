import type { Root, Element, Text } from "hast"
import type { Plugin as UnifiedPlugin, PluggableList } from "unified"

import GithubSlugger from "github-slugger"
import { headingRank } from "hast-util-heading-rank"
import { toString } from "hast-util-to-string"
import { h } from "hastscript"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import smartypants from "remark-smartypants"
import { visit } from "unist-util-visit"

import { QuartzTransformerPlugin } from "../types"

export interface Options {
  enableSmartyPants: boolean
  linkHeadings: boolean
}

const defaultOptions: Options = {
  enableSmartyPants: true,
  linkHeadings: true,
}

/**
 * Checks if an element is a footnote list item.
 *
 * Footnotes are rendered as `<li>` elements with IDs that start with "user-content-fn".
 */
function isFootnoteListItem(node: Element): boolean {
  return (
    node.tagName === "li" && Boolean(node.properties?.id?.toString().startsWith("user-content-fn"))
  )
}

/**
 * Finds the back arrow link in a footnote's last paragraph.
 *
 * Back arrows are anchor elements with "data-footnote-backref" in their className,
 * typically located at the end of the footnote's last paragraph.
 *
 * @param footnoteNode - The footnote list item element.
 * @returns The back arrow element if found, null otherwise.
 */
function findFootnoteBackArrow(footnoteNode: Element): Element | null {
  // Find the last paragraph in the footnote
  const lastParagraph = footnoteNode.children.find(
    (child) => child.type === "element" && child.tagName === "p",
  ) as Element | undefined

  if (!lastParagraph || !("children" in lastParagraph)) {
    return null
  }

  // Get the last child element (where the back arrow should be)
  const lastChild = lastParagraph.children.at(-1)

  // Check if it's a back arrow link
  if (
    lastChild?.type === "element" &&
    lastChild.tagName === "a" &&
    lastChild.properties?.className?.toString().includes("data-footnote-backref")
  ) {
    return lastChild
  }

  return null
}

/**
 * Plugin to enhance footnote back arrows by preventing awkward line wrapping.
 *
 * Problem: GitHub's footnote back arrows (↩) often wrap to the next line by themselves,
 * creating visually awkward single-character lines that look disconnected from the text.
 *
 * Solution: Take the last 4 characters of the footnote text and wrap them together
 * with the back arrow in a <span> element. This ensures the back arrow stays visually
 * connected to some preceding text, preventing orphaned arrows on their own lines.
 *
 * Example transformation:
 * Before: "This is footnote text ↩" (where ↩ might wrap alone)
 * After:  "This is footnote <span>text ↩</span>" (keeping them together)
 */
function footnoteBacklinkPlugin() {
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      // Only process footnote list items
      if (!isFootnoteListItem(node)) {
        return
      }

      // Find the back arrow in this footnote
      const backArrow = findFootnoteBackArrow(node)
      if (!backArrow) {
        return
      }

      // Enhance the footnote by repositioning the back arrow
      maybeSpliceAndAppendBackArrow(node, backArrow)
    })
  }
}

/**
 * A plugin that transforms GitHub-flavored Markdown into HTML.
 *
 * @param userOpts - The user options for the plugin.
 */
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
      const plugins: PluggableList = [footnoteBacklinkPlugin()]

      if (opts.linkHeadings) {
        plugins.push(returnAddIdsToHeadingsFn, [
          rehypeAutolinkHeadings as unknown as UnifiedPlugin,
          {
            behavior: "wrap",
            properties: {
              "data-no-popover": "true",
              ariaHidden: true,
              tabIndex: -1,
            },
          },
        ])
      }

      return plugins
    },
  }
}

const slugger = new GithubSlugger()

// skipcq: JS-D1001
export function preprocessSlug(headerText: string): string {
  const charsToConvert = ["'", "’", "/", "&", "—", "‘"]

  let protoSlug = headerText
  for (const char of charsToConvert) {
    protoSlug = protoSlug.replaceAll(new RegExp(char, "g"), "-")
  }

  // Remove consecutive hyphens
  protoSlug = protoSlug.replaceAll(/-+/g, "-")

  return protoSlug
}

/**
 * Converts header text into a URL-friendly slug.
 */
export function slugify(headerText: string): string {
  const protoSlug = preprocessSlug(headerText)
  const slug = slugger.slug(protoSlug)
  return slug.replaceAll(/-+/g, "-")
}

// skipcq: JS-D1001
export function resetSlugger() {
  slugger.reset()
}

// skipcq: JS-D1001
export function returnAddIdsToHeadingsFn() {
  return (tree: Root) => {
    slugger.reset()

    visit(tree, "element", (node: Element) => {
      if (headingRank(node) && !node.properties.id) {
        node.properties.id = slugify(toString(node))
      }
    })

    rehypeSlug()(tree)
  }
}

// skipcq: JS-D1001
export function removeBackArrow(footnoteParent: Element): void {
  footnoteParent.children = footnoteParent.children.filter((child) => {
    return !(
      child.type === "element" &&
      child.tagName === "a" &&
      child.properties?.className?.toString().includes("data-footnote-backref")
    )
  })
}

/**
 * Add a back arrow to the footnote. Modifies the footnote node in place, appending the back arrow to the footnote.
 *
 * @returns
 *   The back arrow element.
 */
export function maybeSpliceAndAppendBackArrow(node: Element, backArrow: Element): void {
  const lastParagraph = node.children[node.children.length - 1] as Element
  if (lastParagraph.tagName !== "p") return

  removeBackArrow(lastParagraph)

  // Handle empty paragraph case
  if (lastParagraph.children.length === 0) {
    lastParagraph.children = [backArrow]
    return
  }

  // Get the last text node without modifying the original array
  const children2 = [...lastParagraph.children]
  const lastTextNode = children2.reverse().find((child) => child.type === "text") as Text

  // Handle whitespace-only case
  if (!lastTextNode || lastTextNode.value.trim() === "") {
    lastParagraph.children = [lastTextNode, backArrow].filter(Boolean)
    return
  }

  const text = lastTextNode.value
  const textIndex = Math.max(0, text.length - 4) // ensures splitIndex is never negative

  // Update the original text node if there's text before the split
  if (textIndex > 0) {
    lastTextNode.value = text.slice(0, textIndex)
  } else {
    // Remove the original text node if we're wrapping all text
    lastParagraph.children = []
  }

  // Add the favicon span with remaining text and back arrow
  lastParagraph.children.push(
    h("span", { className: "favicon-span" }, [
      { type: "text", value: text.slice(textIndex) },
      backArrow,
    ]),
  )
}
