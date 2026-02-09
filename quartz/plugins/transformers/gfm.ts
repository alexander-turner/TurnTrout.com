import type { Root, Element, Text } from "hast"
import type { Plugin as UnifiedPlugin, PluggableList } from "unified"

import GithubSlugger from "github-slugger"
import { headingRank } from "hast-util-heading-rank"
import { toString } from "hast-util-to-string"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import smartypants from "remark-smartypants"
import { visit } from "unist-util-visit"

import { QuartzTransformerPlugin } from "../types"
import { createWordJoinerSpan } from "./utils"

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

/** Adds `tabindex="0"` to <pre> and their <code> children for keyboard scrollability. */
function makePreElementsKeyboardAccessible(tree: Root): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "pre") return
    node.properties = node.properties || {}
    node.properties.tabIndex = 0
    // Also make <code> children focusable since they may be the actual
    // scrollable element (e.g. Shiki code blocks with display:grid)
    for (const child of node.children) {
      if (child.type === "element" && child.tagName === "code") {
        child.properties = child.properties || {}
        child.properties.tabIndex = 0
      }
    }
  })
}

/** Adds keyboard accessibility to mermaid-rendered inline SVGs. */
function makeMermaidSvgsAccessible(tree: Root): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "svg") return
    if (!node.properties?.id?.toString().startsWith("mermaid")) return

    node.properties.tabIndex = 0
    node.properties.role = "img"
    node.properties.ariaLabel = "Mermaid diagram"
  })
}

/** Adds `<track kind="captions">` to <video> elements that lack one. */
function ensureVideoCaptionTracks(tree: Root): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "video") return
    const hasTrack = node.children.some(
      (child) => child.type === "element" && child.tagName === "track",
    )
    if (!hasTrack) {
      node.children.push({
        type: "element",
        tagName: "track",
        properties: { kind: "captions", src: "data:text/vtt,WEBVTT" },
        children: [],
      })
    }
  })
}

const VALID_DL_CHILD_TAGS = new Set(["dt", "dd", "div", "script", "template"])

/**
 * Validates that a <dl> element's structure complies with the axe definition-list rule:
 * - All direct element children must be <dt>, <dd>, <div>, <script>, or <template>
 * - Every <dt> group must be followed by at least one <dd> (no trailing/interrupted groups)
 * - Every <dd> must be preceded by at least one <dt> (no orphaned <dd>)
 */
export function isValidDlStructure(children: Element["children"]): boolean {
  let state: "none" | "dt" | "dd" = "none"
  let hasPairs = false

  for (const child of children) {
    if (child.type !== "element") continue

    if (!VALID_DL_CHILD_TAGS.has(child.tagName)) return false

    if (child.tagName === "dt") {
      state = "dt"
    } else if (child.tagName === "dd") {
      if (state !== "dt" && state !== "dd") return false
      state = "dd"
      hasPairs = true
    } else {
      // div/script/template: dt before this without dd is orphaned
      if (state === "dt") return false
      state = "none"
    }
  }

  // Trailing <dt> without <dd> is invalid
  if (state === "dt") return false

  return hasPairs
}

/**
 * When a <dl> has only orphaned <dd> children (no <dt>), tries to adopt the
 * immediately preceding <p> sibling as a <dt>, producing a valid definition
 * list. This fixes the common pattern where a blank line between term and
 * `: ` syntax breaks the remark-definition-list association:
 *
 *   Markdown:           HTML before fix:              HTML after fix:
 *   Term                <p>Term</p>                   <dl>
 *                       <dl><dd>Def</dd></dl>           <dt>Term</dt>
 *   : Def                                               <dd>Def</dd>
 *                                                     </dl>
 *
 * Mutates parentChildren in place (splices out the adopted <p>).
 * @returns true if a <p> was successfully adopted as <dt>
 */
export function adoptPrecedingSiblingAsDt(
  dl: Element,
  dlIndex: number,
  parentChildren: Element["children"],
): boolean {
  // Walk backwards past whitespace text nodes to find preceding element
  let prevIdx = dlIndex - 1
  while (prevIdx >= 0 && parentChildren[prevIdx].type !== "element") {
    prevIdx--
  }

  if (prevIdx < 0) return false

  const prev = parentChildren[prevIdx] as Element
  if (prev.tagName !== "p") return false

  // Convert <p> contents to <dt> and prepend to <dl>
  const dt: Element = {
    type: "element",
    tagName: "dt",
    properties: {},
    children: prev.children,
  }

  // Remove <p> and any whitespace between it and <dl>
  parentChildren.splice(prevIdx, dlIndex - prevIdx)
  dl.children.unshift(dt)

  return true
}

/**
 * Fixes <dl> elements that have only orphaned <dd> (no <dt>) by either:
 * 1. Adopting a preceding <p> sibling as a <dt> (preserves definition list semantics)
 * 2. Falling back to <dl> → <div> and <dd> → <p> when no <p> is available
 *
 * Also converts stray <dd>/<dt> elements found outside any <dl> to <p>.
 */
function fixOrphanedDefinitionLists(tree: Root): void {
  const dlNodes: Array<{ node: Element; index: number; parentChildren: Element["children"] }> = []

  visit(tree, "element", (node: Element, index: number | undefined, parent) => {
    if (node.tagName === "dl" && index !== undefined && parent) {
      dlNodes.push({ node, index, parentChildren: parent.children as Element["children"] })
    }
  })

  // Process in reverse so parent splices don't invalidate earlier indices
  for (const { node: dl, index: dlIndex, parentChildren } of dlNodes.reverse()) {
    const hasDt = dl.children.some((c) => c.type === "element" && c.tagName === "dt")
    if (hasDt) continue

    if (adoptPrecedingSiblingAsDt(dl, dlIndex, parentChildren)) continue

    // Fallback: degrade to <div> with <p> children
    dl.tagName = "div"
    for (const child of dl.children) {
      if (child.type === "element" && child.tagName === "dd") {
        child.tagName = "p"
      }
    }
  }

  // Convert stray <dd>/<dt> outside any <dl> to <p>
  visit(tree, "element", (node: Element) => {
    if (!node.children) return
    for (const child of node.children) {
      if (child.type !== "element") continue
      if ((child.tagName === "dd" || child.tagName === "dt") && node.tagName !== "dl") {
        child.tagName = "p"
      }
    }
  })
}

export function htmlAccessibilityPlugin() {
  return (tree: Root) => {
    // istanbul ignore next --- defensive
    if (!tree) return

    fixOrphanedDefinitionLists(tree)

    // Validate remaining <dl> elements and demote invalid ones
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "dl") return
      if (!isValidDlStructure(node.children)) {
        node.tagName = "div"
      }
    })

    makePreElementsKeyboardAccessible(tree)
    makeMermaidSvgsAccessible(tree)
    ensureVideoCaptionTracks(tree)
    deduplicateSvgIds(tree)
  }
}

/** Replaces `url(#oldId)` references using an ID mapping. */
function remapUrlIdReferences(text: string, idMap: Map<string, string>): string {
  return text.replace(/url\(#(?<urlId>[^)]+)\)/g, (match, _urlId, _offset, _str, { urlId }) => {
    return idMap.has(urlId) ? `url(#${idMap.get(urlId)})` : match
  })
}

/** Collects all element IDs within an SVG and renames them with a prefix. */
function collectAndPrefixIds(svg: Element, prefix: string): Map<string, string> {
  const idMap = new Map<string, string>()
  visit(svg, "element", (child: Element) => {
    if (child.properties?.id) {
      const oldId = String(child.properties.id)
      idMap.set(oldId, `${prefix}${oldId}`)
      child.properties.id = `${prefix}${oldId}`
    }
  })
  return idMap
}

/** Updates href, xlinkHref, and url(#id) attribute references. */
function updatePropertyReferences(svg: Element, idMap: Map<string, string>): void {
  visit(svg, "element", (child: Element) => {
    if (!child.properties) return

    for (const [key, value] of Object.entries(child.properties)) {
      if (typeof value !== "string") continue

      if ((key === "href" || key === "xlinkHref") && value.startsWith("#")) {
        const refId = value.slice(1)
        if (idMap.has(refId)) {
          child.properties[key] = `#${idMap.get(refId)}`
        }
      }

      if (value.includes("url(#")) {
        child.properties[key] = remapUrlIdReferences(value, idMap)
      }
    }
  })
}

/** Updates ID references inside inline `<style>` elements. */
function updateStyleReferences(svg: Element, idMap: Map<string, string>): void {
  visit(svg, "element", (child: Element) => {
    if (child.tagName !== "style") return
    for (const textChild of child.children) {
      if (textChild.type !== "text") continue

      if (textChild.value.includes("url(#")) {
        textChild.value = remapUrlIdReferences(textChild.value, idMap)
      }

      for (const [oldId, newId] of idMap) {
        textChild.value = textChild.value.replaceAll(`#${oldId}`, `#${newId}`)
      }
    }
  })
}

/**
 * Makes SVG internal IDs unique by adding a per-SVG prefix.
 * When multiple SVGs are inlined (e.g., Mermaid diagrams), their internal IDs
 * (markers, clipPaths, etc.) can collide. This function prefixes each SVG's IDs
 * with a unique identifier based on its position in the document.
 */
export function deduplicateSvgIds(tree: Root): void {
  let svgIndex = 0
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "svg") return

    const idMap = collectAndPrefixIds(node, `svg-${svgIndex++}-`)
    if (idMap.size === 0) return

    updatePropertyReferences(node, idMap)
    updateStyleReferences(node, idMap)
  })
}

/** Adds `aria-label` to heading links that have no direct text content (e.g. KaTeX-only headings). */
export function ensureHeadingLinksHaveAccessibleNames() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (!headingRank(node)) return

      const link = node.children.find(
        (child) => child.type === "element" && child.tagName === "a",
      ) as Element | undefined
      if (!link) return

      const hasDirectText = link.children.some(
        (child) => child.type === "text" && child.value.trim().length > 0,
      )
      if (hasDirectText) return

      // Extract label from KaTeX <annotation> elements (original LaTeX source)
      const annotations: string[] = []
      visit(link, "element", (child: Element) => {
        if (child.tagName === "annotation") {
          const text = toString(child).trim()
          if (text) annotations.push(text)
        }
      })

      const label =
        annotations.join(" ") ||
        String(node.properties?.id || "heading")
          .replaceAll(/-+/g, " ")
          .trim()

      link.properties = link.properties || {}
      link.properties.ariaLabel = label
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
      // Pass as attacher references (not called) so unified calls them correctly
      const plugins: PluggableList = [footnoteBacklinkPlugin, htmlAccessibilityPlugin]

      if (opts.linkHeadings) {
        plugins.push(
          returnAddIdsToHeadingsFn,
          [
            rehypeAutolinkHeadings as unknown as UnifiedPlugin,
            {
              behavior: "wrap",
              properties: {
                "data-no-popover": "true",
                tabIndex: -1,
              },
            },
          ],
          ensureHeadingLinksHaveAccessibleNames,
        )
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

  // Append word joiner + back arrow to prevent line-break orphaning
  lastParagraph.children.push(createWordJoinerSpan(), backArrow)
}
