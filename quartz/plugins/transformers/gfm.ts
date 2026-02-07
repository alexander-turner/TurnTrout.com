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
export function isFootnoteListItem(node: Element): boolean {
  return (
    node?.tagName === "li" && Boolean(node.properties?.id?.toString().startsWith("user-content-fn"))
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
export function findFootnoteBackArrow(footnoteNode: Element): Element | null {
  // Find the last paragraph in the footnote
  if (!footnoteNode.children) {
    return null
  }

  const lastParagraph = footnoteNode.children.find(
    (child) => child.type === "element" && child.tagName === "p",
  ) as Element | undefined

  if (!lastParagraph || !lastParagraph.children) {
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

// See footnoteBacklinkPlugin for usage
export function appendArrowToFootnoteListItemVisitor(node: Element) {
  if (isFootnoteListItem(node)) {
    const backArrow = findFootnoteBackArrow(node)
    if (backArrow) {
      maybeSpliceAndAppendBackArrow(node, backArrow)
    }
  }
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
// istanbul ignore next -- this is a plugin
function footnoteBacklinkPlugin() {
  return (tree: Root) => {
    if (!tree) return
    visit(tree, "element", appendArrowToFootnoteListItemVisitor)
  }
}

/**
 * Converts a <dd> element to a <p> element, preserving its children.
 * Used when a <dd> is orphaned (not preceded by a <dt>).
 *
 * @param ddElement - The <dd> element to convert
 * @returns A new <p> element with the same children
 */
export function convertDdToParagraph(ddElement: Element): Element {
  return {
    type: "element",
    tagName: "p",
    properties: {},
    children: ddElement.children,
  }
}

/**
 * Processes a single child element within a definition list, determining whether
 * to keep it as-is, convert it, or update state tracking.
 *
 * @param child - The child element to process
 * @param lastWasDt - Whether the previous element was a <dt>
 * @returns An object containing the processed element and the new state
 */
export function processDefinitionListChild(
  child: Element["children"][number],
  lastWasDt: boolean,
): { element: Element["children"][number]; newLastWasDt: boolean } {
  // Handle non-element nodes (text, comments, etc.) — preserve state so
  // whitespace between <dt> and <dd> doesn't break valid groups
  if (child.type !== "element") {
    return { element: child, newLastWasDt: lastWasDt }
  }

  // Handle <dt> elements - set state for next <dd>
  if (child.tagName === "dt") {
    return { element: child, newLastWasDt: true }
  }

  // Handle <dd> elements - check if valid or orphaned
  if (child.tagName === "dd") {
    if (lastWasDt) {
      // Valid <dd> following a <dt> - preserve it. Keep lastWasDt true so
      // multiple <dd> elements after one <dt> are all preserved (valid HTML).
      return { element: child, newLastWasDt: true }
    } else {
      // Orphaned <dd> without preceding <dt> - convert to paragraph
      return { element: convertDdToParagraph(child), newLastWasDt: false }
    }
  }

  // Handle other elements (div, script, template are allowed in <dl>)
  return { element: child, newLastWasDt: false }
}

/**
 * Fixes a definition list by converting orphaned <dd> elements to <p> elements.
 *
 * @param dlElement - The <dl> element to fix
 * @returns The fixed <dl> element with updated children
 */
export function fixDefinitionList(dlElement: Element): Element {
  if (!dlElement.children || dlElement.children.length === 0) {
    return dlElement
  }

  const fixedChildren: Element["children"] = []
  let lastWasDt = false

  for (const child of dlElement.children) {
    const result = processDefinitionListChild(child, lastWasDt)
    fixedChildren.push(result.element)
    lastWasDt = result.newLastWasDt
  }

  return {
    ...dlElement,
    children: fixedChildren,
  }
}

/**
 * Fixes malformed definition lists to comply with WCAG accessibility standards.
 *
 * PROBLEM:
 * The remark-gfm plugin converts Markdown lines starting with ": " into HTML <dd> elements,
 * which is intended for creating definition lists. However, when this syntax is used in
 * contexts like blockquotes without a preceding term definition, it creates invalid HTML
 * structure that violates accessibility standards.
 *
 * Example problematic Markdown:
 * ```markdown
 * > User
 * >
 * > : Develop a social media bot...
 * ```
 *
 * Gets converted by remark-gfm to invalid HTML:
 * ```html
 * <blockquote>
 *   <p>User</p>
 *   <dl><dd>Develop a social media bot...</dd></dl>
 * </blockquote>
 * ```
 *
 * This violates WCAG 1.3.1 (Info and Relationships) because <dd> (description) elements
 * must be preceded by <dt> (term) elements within <dl> containers. Pa11y accessibility
 * checker flags these as errors:
 * "<dl> elements must only directly contain properly-ordered <dt> and <dd> groups"
 *
 * SOLUTION:
 * This plugin scans all <dl> elements and converts orphaned <dd> elements (those without
 * a preceding <dt>) into <p> elements. This maintains semantic correctness while preserving
 * the visual presentation and content structure.
 *
 * The plugin uses a state machine approach:
 * - Tracks whether we're in a valid dt/dd group using the `lastWasDt` flag
 * - When encountering a <dd>:
 *   - If lastWasDt is true: Keep as <dd> (valid group) and maintain state
 *   - If lastWasDt is false: Convert to <p> (orphaned)
 * - Non-element nodes (whitespace) preserve state; other elements reset it
 *
 * Valid structure (preserved):
 * ```html
 * <dl>
 *   <dt>Term</dt>
 *   <dd>Description</dd>
 * </dl>
 * ```
 *
 * Invalid structure (fixed):
 * ```html
 * <!-- Before -->
 * <dl><dd>Orphaned description</dd></dl>
 *
 * <!-- After -->
 * <dl><p>Orphaned description</p></dl>
 * ```
 *
 * @returns A rehype plugin function that transforms the HTML tree
 */
export function fixDefinitionListsPlugin() {
  return (tree: Root) => {
    // istanbul ignore next --- defensive
    if (!tree) return

    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "dl") return

      const fixed = fixDefinitionList(node)
      node.children = fixed.children
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
      const plugins: PluggableList = [footnoteBacklinkPlugin(), fixDefinitionListsPlugin()]

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
export function removeBackArrowFromChildren(footnoteParent: Element): void {
  footnoteParent.children = footnoteParent.children.filter((child) => {
    return !(
      child.type === "element" &&
      child.tagName === "a" &&
      child.properties?.className?.toString().includes("data-footnote-backref")
    )
  })
}

/**
 * Add a back arrow to the footnote. Modifies the footnote node in place.
 */
export function maybeSpliceAndAppendBackArrow(node: Element, backArrow: Element): void {
  const lastParagraph = node.children[node.children.length - 1] as Element | undefined
  if (!lastParagraph || lastParagraph.tagName !== "p") {
    return
  }

  removeBackArrowFromChildren(lastParagraph)

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
