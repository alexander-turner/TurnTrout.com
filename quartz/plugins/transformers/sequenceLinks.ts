import type { Root, Element, RootContent } from "hast"

import { h } from "hastscript"
import { visit } from "unist-util-visit"

import type { QuartzPluginData } from "../vfile"

import { formatTitle } from "../../components/component_utils"

// Main components:
// 1. renderSequenceTitle: Generates sequence title element
// 2. renderPreviousPost: Creates previous post link element
// 3. renderNextPost: Creates next post link element
// 4. createSequenceLinksDiv: Assembles sequence navigation structure
// 5. insertAfterTroutOrnament: Inserts sequence links after specific element
// 6. SequenceLinksTransformer: Main plugin function

// Key functionality:
// - Extracts sequence information from frontmatter
// - Creates navigation elements for sequence posts
// - Inserts sequence navigation into the document structure
// - Uses hastscript (h) for element creation

// Usage:
// Import and use SequenceLinksTransformer in Quartz configuration

/**
 * Renders the sequence title element if sequence information is available.
 */
export const renderSequenceTitle = (fileData: QuartzPluginData) => {
  const sequence = fileData.frontmatter?.["lw-sequence-title"]
  if (!sequence) return null
  const sequenceLink: string = fileData.frontmatter?.["sequence-link"] as string

  return h("div.admonition-title-inner", [
    h("b", "Sequence:"),
    " ",
    h(
      "a",
      { href: sequenceLink, className: "internal can-trigger-popover", style: "cursor: pointer;" },
      sequence as unknown as RootContent,
    ),
  ])
}

/**
 * Creates the previous post link element if a previous post exists.
 */
export const renderPreviousPost = (fileData: QuartzPluginData) => {
  const prevPostSlug: string = (fileData.frontmatter?.["prev-post-slug"] as string) || ""
  const prevPostTitle: string = (fileData.frontmatter?.["prev-post-title"] as string) || ""
  const prevPostTitleFormatted = formatTitle(prevPostTitle)
  if (!prevPostSlug) return null

  const linkElement = h(
    "a",
    { href: `./${prevPostSlug}`, className: "internal can-trigger-popover" },
    prevPostTitleFormatted,
  )

  return h("p", [h("b", "Previous"), h("br"), linkElement])
}

/**
 * Creates the next post link element if a next post exists.
 */
export const renderNextPost = (fileData: QuartzPluginData) => {
  const nextPostSlug: string = (fileData.frontmatter?.["next-post-slug"] as string) || ""
  const nextPostTitle: string = (fileData.frontmatter?.["next-post-title"] as string) || ""
  const nextPostTitleFormatted = formatTitle(nextPostTitle)
  if (!nextPostSlug) return null

  const linkElement = h(
    "a",
    { href: `./${nextPostSlug}`, className: "internal can-trigger-popover" },
    nextPostTitleFormatted,
  )

  return h("p", [h("b", "Next"), h("br"), linkElement])
}

/**
 * Assembles the sequence links div containing title, previous, and next post links.
 */
export function createSequenceLinksDiv(
  sequenceTitle: Element | null,
  prevPost: Element | null,
  nextPost: Element | null,
): Element {
  const children = [
    prevPost &&
      h(
        "div",
        { className: "prev-post sequence-links-post-navigation", style: "text-align: right;" },
        prevPost,
      ),
    prevPost && nextPost && h("div", { className: "sequence-links-divider" }),
    nextPost &&
      h(
        "div",
        { className: "next-post sequence-links-post-navigation", style: "text-align: left;" },
        nextPost,
      ),
  ].filter(Boolean) as Element[]

  return h("div", { className: "sequence-links" }, [
    h(
      "div",
      { className: "sequence-title", style: "text-align: center;" },
      sequenceTitle ? [sequenceTitle as RootContent] : [],
    ),
    h(
      "div",
      { className: "sequence-nav", style: "display: flex; justify-content: center;" },
      children,
    ),
  ])
}

/**
 * Inserts the sequence links div after the trout ornament element in the document tree.
 */
export function insertAfterTroutOrnament(tree: Root, sequenceLinksDiv: Element): void {
  visit(tree, "element", (node: Element, index, parent: Element | null) => {
    if (
      index !== undefined &&
      node.tagName === "div" &&
      node.properties &&
      node.properties.id === "trout-ornament" &&
      parent
    ) {
      parent.children.splice(index + 1, 0, sequenceLinksDiv)
      return false // Stop traversing
    }
    return undefined
  })
}

// New function to create the sequence links component
export function createSequenceLinksComponent(fileData: QuartzPluginData): Element | null {
  const sequenceTitle = renderSequenceTitle(fileData)
  const prevPost = renderPreviousPost(fileData)
  const nextPost = renderNextPost(fileData)

  if (!sequenceTitle && !prevPost && !nextPost) {
    return null
  }

  return createSequenceLinksDiv(sequenceTitle, prevPost, nextPost)
}
