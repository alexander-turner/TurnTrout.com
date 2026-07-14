/**
 * Namespaces heading ids inside embedded external READMEs so they stay unique on
 * the host page, mirroring the transclusion id-rebasing in `util/path.ts`.
 *
 * Each `div.external-readme` (produced by `wrapExternalReadme`) carries a source
 * slug. Every heading id within it is rewritten to `${slug}-${id}`, and any
 * same-page anchor (`href="#id"`) within the wrapper — including the
 * rehype-autolink-headings wrappers — is repointed to the namespaced id.
 */
import type { Element, Root } from "hast"
import type { PluggableList } from "unified"

import { visit } from "unist-util-visit"

import { QuartzTransformerPlugin } from "../types"
import { EXTERNAL_README_CLASS } from "./populateExternalMarkdown"

const HEADING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

/** True if `node` is the wrapper div emitted by `wrapExternalReadme`. */
function isExternalReadme(node: Element): boolean {
  const classes = node.properties?.className
  return Array.isArray(classes) && classes.includes(EXTERNAL_README_CLASS)
}

/** Reads the source slug stored on the wrapper, if present and non-empty. */
function readmeSlug(node: Element): string | undefined {
  const slug = node.properties?.dataReadmeSlug
  return typeof slug === "string" && slug.length > 0 ? slug : undefined
}

/** Prefixes heading ids within each external-README wrapper and fixes its anchors. */
export function prefixExternalReadmeIds(tree: Root): void {
  visit(tree, "element", (node: Element) => {
    if (!isExternalReadme(node)) return
    const slug = readmeSlug(node)
    if (!slug) return

    const idMap = new Map<string, string>()
    visit(node, "element", (el: Element) => {
      if (!HEADING_TAGS.has(el.tagName)) return
      const oldId = el.properties?.id
      if (typeof oldId !== "string") return
      const newId = `${slug}-${oldId}`
      el.properties.id = newId
      idMap.set(oldId, newId)
    })

    visit(node, "element", (el: Element) => {
      if (el.tagName !== "a") return
      const href = el.properties?.href
      if (typeof href !== "string" || !href.startsWith("#")) return
      const newId = idMap.get(href.slice(1))
      if (newId) el.properties.href = `#${newId}`
    })
  })
}

/** Quartz transformer that namespaces embedded-README heading ids. Must run
 * after `GitHubFlavoredMarkdown` assigns heading ids and autolink anchors. */
export const PrefixExternalReadmeIds: QuartzTransformerPlugin = () => ({
  name: "PrefixExternalReadmeIds",
  htmlPlugins(): PluggableList {
    return [() => prefixExternalReadmeIds]
  },
})
