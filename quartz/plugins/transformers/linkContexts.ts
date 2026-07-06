import type { Element, ElementContent, Parent, Root } from "hast"
import type { VFile } from "vfile"

import { toHtml } from "hast-util-to-html"
import { visit } from "unist-util-visit"
import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import {
  BACKLINK_HIGHLIGHT_CLASS,
  EMOJI_CLASS,
  FAVICON_CLASS,
  FAVICON_SPAN_CLASS,
  HEADING_TAGS,
  KATEX_CLASS,
} from "../../components/constants"
import { type FullSlug, type SimpleSlug, simplifySlug } from "../../util/path"
import { hasClass } from "./utils"

/**
 * One cited-paragraph excerpt recorded on the *citing* page, tagged with the
 * page it points at. A page may record several with the same `target` — one per
 * distinct citing location — each carrying its own deep-link `anchor`.
 */
export interface LinkContext {
  /** Simplified slug of the page the citing link resolves to. */
  target: SimpleSlug
  /** Sanitized, truncated inline HTML of the paragraph containing the citing link. */
  excerptHtml: string
  /** `id` stamped on the citing link so a backlink can deep-link to the citing location. */
  anchor: string
}

/** Longest excerpt we keep, in visible characters, before truncating around the citing link. */
export const BACKLINK_EXCERPT_MAX_CHARS = 330

/**
 * Elision markers flagging where prose was trimmed. The space keeps the marker
 * off the adjacent word: a left cut opens `[...] word`, a right cut ends
 * `word [...]`. The literal `...` is why excerpts are exempt from the
 * consecutive-periods site check (see `should_skip` in `built_site_checks.py`).
 */
const ELLIPSIS_LEADING = "[...] "
const ELLIPSIS_TRAILING = " [...]"

/**
 * Deterministic, page-namespaced anchor id for the citing link. Namespacing by
 * the source page's slug keeps ids unique even when a page's content (with its
 * ids already baked in) is transcluded into another page, where a bare
 * per-page counter would collide and trip `check_duplicate_ids`.
 */
export function anchorId(sourceSlug: string, index: number): string {
  const slugPart = sourceSlug.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")
  return `backlink-cite-${slugPart || "page"}-${index}`
}

/** Block-level containers whose inline content forms a backlink excerpt. */
const BLOCK_TAGS: ReadonlySet<string> = new Set(["p", "li", "dd", "dt", "td", "th", "figcaption"])

/** Media/embedded elements dropped wholesale from an excerpt. */
const DROP_TAGS: ReadonlySet<string> = new Set([
  "img",
  "video",
  "iframe",
  "svg",
  "picture",
  "audio",
])

/** Recursively collects the visible text of a hast node. */
export function textOf(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type === "element") return node.children.map(textOf).join("")
  return ""
}

/**
 * Placeholder standing in for one inline atom (twemoji/KaTeX) in the visible-text
 * coordinate model. Non-whitespace so word-boundary trimming treats an atom as
 * part of its adjacent word rather than a break.
 */
const ATOM_PLACEHOLDER = "￼"

/**
 * Visible-text string in the same coordinate model as {@link measureFragment}
 * and {@link sliceNodes}: each inline atom counts as a single placeholder glyph
 * so character offsets stay aligned across measuring, window-trimming, and
 * slicing (descending into KaTeX's duplicated MathML text would desync them).
 */
function fragmentText(nodes: readonly ElementContent[]): string {
  let out = ""
  const walk = (children: readonly ElementContent[]): void => {
    for (const node of children) {
      if (node.type === "text") {
        out += node.value
      } else if (node.type === "element") {
        if (isInlineAtom(node)) out += ATOM_PLACEHOLDER
        else walk(node.children)
      }
    }
  }
  walk(nodes)
  return out
}

/** A citing link is a resolved internal link (not a same-page anchor) with a recorded target. */
function isCitingLink(node: Element): boolean {
  if (node.tagName !== "a") return false
  if (!hasClass(node, "internal")) return false
  if (hasClass(node, "same-page-link")) return false
  // A transclude placeholder link (`![[…]]`) is swapped for the embedded page's
  // content at emit time, so any id stamped on it disappears from the built
  // HTML—deep-linking to it would dangle. The real citing links inside the
  // embedded content keep the ids stamped during the source page's own pass.
  if (hasClass(node, "transclude-inner")) return false
  const dataSlug = node.properties?.["data-slug"]
  return typeof dataSlug === "string" && dataSlug.length > 0
}

/** Nearest block-level ancestor of a link, or null if the link sits outside any excerpt-able block. */
function findEnclosingBlock(ancestors: readonly Parent[]): Element | null {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i] as Element
    if (ancestor.type === "element" && BLOCK_TAGS.has(ancestor.tagName)) return ancestor
  }
  return null
}

/** True when any ancestor is a heading or a spoiler container (excerpts must skip both). */
function isInSkippedContext(ancestors: readonly Parent[]): boolean {
  return ancestors.some((rawAncestor) => {
    const ancestor = rawAncestor as Element
    return (
      ancestor.type === "element" &&
      (HEADING_TAGS.has(ancestor.tagName) || hasClass(ancestor, "spoiler-container"))
    )
  })
}

/** Deep-clones an element and removes every `id` so the excerpt can't duplicate page ids. */
function stripIdsDeep(node: Element): Element {
  const clone = structuredClone(node)
  visit(clone, "element", (child: Element) => {
    delete child.properties.id
  })
  return clone
}

/**
 * Inline atoms preserved verbatim from the rendered pipeline output — a twemoji
 * image or a KaTeX span. They render as a single glyph, so measurement and
 * slicing treat each as one visible character and never descend into or split
 * them (KaTeX's duplicated MathML/HTML text would otherwise wreck both).
 */
function isInlineAtom(node: Element): boolean {
  return hasClass(node, KATEX_CLASS) || (node.tagName === "img" && hasClass(node, EMOJI_CLASS))
}

/** True when a `<sup>` wraps a footnote reference link (`#user-content-fn…`). */
function isFootnoteRef(node: Element): boolean {
  if (node.tagName !== "sup") return false
  let found = false
  visit(node, "element", (child: Element) => {
    const href = child.properties?.href
    if (child.tagName === "a" && typeof href === "string" && href.startsWith("#user-content-fn")) {
      found = true
    }
  })
  return found
}

/**
 * Rewrites a cloned block's children into an excerpt-safe inline fragment that
 * reuses the pipeline's rendered output as the single source of truth: twemoji
 * images, KaTeX, and small-caps are preserved verbatim (never re-rendered).
 * Favicons, media, footnote refs, and footnote back-arrows are dropped, the
 * citing link becomes a highlight span, non-citing links are unwrapped, and
 * every `id` is removed so the excerpt can't collide with page anchors.
 */
function sanitizeChildren(
  children: readonly ElementContent[],
  highlightId: string,
): ElementContent[] {
  return children.flatMap((child) => sanitizeNode(child, highlightId))
}

function sanitizeNode(node: ElementContent, highlightId: string): ElementContent[] {
  if (node.type === "text") return [{ type: "text", value: node.value }]
  if (node.type !== "element") return []

  if (node.tagName === "a" && node.properties?.id === highlightId) {
    return [
      {
        type: "element",
        tagName: "span",
        properties: { className: [BACKLINK_HIGHLIGHT_CLASS] },
        children: sanitizeChildren(node.children, highlightId),
      },
    ]
  }

  // Footnote back-reference arrow (↩): links out of a footnote body, useless
  // in an excerpt. Matched by class so the check is robust to hast's
  // camel-cased `data-*` property names.
  if (node.tagName === "a" && hasClass(node, "data-footnote-backref")) return []

  if (hasClass(node, FAVICON_CLASS)) return []
  if (hasClass(node, FAVICON_SPAN_CLASS)) return sanitizeChildren(node.children, highlightId)

  // Preserve the pipeline's rendered inline atoms verbatim rather than
  // reconstructing them downstream.
  if (isInlineAtom(node)) return [stripIdsDeep(node)]

  if (isFootnoteRef(node)) return []
  if (DROP_TAGS.has(node.tagName)) return []
  if (node.tagName === "a") return sanitizeChildren(node.children, highlightId)

  const properties = { ...node.properties }
  delete properties.id
  return [{ ...node, properties, children: sanitizeChildren(node.children, highlightId) }]
}

interface Measurement {
  total: number
  hlStart: number
  hlLen: number
  found: boolean
}

/** Locates the highlight span's character offset/length within a fragment. */
function measureFragment(nodes: readonly ElementContent[]): Measurement {
  let cursor = 0
  let hlStart = 0
  let hlLen = 0
  let found = false
  const walk = (children: readonly ElementContent[]): void => {
    for (const node of children) {
      if (node.type === "text") {
        cursor += node.value.length
      } else if (node.type === "element") {
        if (isInlineAtom(node)) {
          cursor += 1
          continue
        }
        const before = cursor
        walk(node.children)
        if (hasClass(node, BACKLINK_HIGHLIGHT_CLASS)) {
          hlStart = before
          hlLen = cursor - before
          found = true
        }
      }
    }
  }
  walk(nodes)
  return { total: cursor, hlStart, hlLen, found }
}

/** Keeps only text within `[start, end)` (visible-char space), preserving inline structure. */
function sliceNodes(
  nodes: readonly ElementContent[],
  start: number,
  end: number,
  cursor: { i: number },
): ElementContent[] {
  const out: ElementContent[] = []
  for (const node of nodes) {
    if (node.type === "text") {
      const nodeStart = cursor.i
      cursor.i += node.value.length
      const from = Math.max(start, nodeStart)
      const to = Math.min(end, cursor.i)
      if (to > from)
        out.push({ type: "text", value: node.value.slice(from - nodeStart, to - nodeStart) })
    } else if (node.type === "element") {
      if (isInlineAtom(node)) {
        const nodeStart = cursor.i
        cursor.i += 1
        // An atom is indivisible: keep it whole when its position lies inside
        // the window, otherwise drop it.
        if (nodeStart >= start && nodeStart < end) out.push(node)
        continue
      }
      const kids = sliceNodes(node.children, start, end, cursor)
      if (kids.length > 0) out.push({ ...node, children: kids })
    }
  }
  return out
}

/** Advances a window edge to a word boundary so truncation never cuts mid-word. */
export function trimWindow(
  full: string,
  hlStart: number,
  hlEnd: number,
  total: number,
  left: number,
  right: number,
): {
  winStart: number
  winEnd: number
} {
  let winStart = hlStart - left
  let winEnd = hlEnd + right

  while (winStart > 0 && winStart < hlStart && !/\s/.test(full[winStart - 1])) winStart++
  while (winStart < hlStart && /\s/.test(full[winStart])) winStart++

  while (winEnd < total && winEnd > hlEnd && !/\s/.test(full[winEnd])) winEnd--
  while (winEnd > hlEnd && /\s/.test(full[winEnd - 1])) winEnd--

  return { winStart, winEnd }
}

/** Truncates a sanitized fragment to ~{@link BACKLINK_EXCERPT_MAX_CHARS} around the highlight. */
export function truncateFragment(nodes: readonly ElementContent[]): ElementContent[] {
  const { total, hlStart: rawStart, hlLen: rawLen, found } = measureFragment(nodes)
  // The highlight span is stamped on the citing link before sanitization; if it
  // is gone the excerpt would center on offset 0 with no visible highlight, so
  // fail loudly rather than ship a silently-degraded snippet.
  if (!found) throw new Error("backlink excerpt lost its highlight span during sanitization")
  if (total <= BACKLINK_EXCERPT_MAX_CHARS) return [...nodes]

  const hlStart = Math.max(0, rawStart)
  const hlLen = Math.max(0, rawLen)
  const hlEnd = hlStart + hlLen
  const avail = Math.max(0, BACKLINK_EXCERPT_MAX_CHARS - hlLen)
  const half = Math.floor(avail / 2)

  let left = Math.min(hlStart, half)
  let right = Math.min(total - hlEnd, half)
  let leftover = avail - left - right
  if (leftover > 0) {
    const addLeft = Math.min(leftover, hlStart - left)
    left += addLeft
    leftover -= addLeft
    right += Math.min(leftover, total - hlEnd - right)
  }

  const full = fragmentText(nodes)
  const { winStart, winEnd } = trimWindow(full, hlStart, hlEnd, total, left, right)

  const sliced = sliceNodes(nodes, winStart, winEnd, { i: 0 })
  if (winStart > 0) sliced.unshift({ type: "text", value: ELLIPSIS_LEADING })
  if (winEnd < total) sliced.push({ type: "text", value: ELLIPSIS_TRAILING })
  return sliced
}

/**
 * Builds the sanitized, truncated excerpt HTML for a block containing an anchored
 * citing link, or `""` when the block sanitizes down to no visible text (e.g. a
 * citing link wrapping only dropped media) so no empty excerpt is rendered.
 */
export function buildExcerpt(block: Element, highlightId: string): string {
  const clone = structuredClone(block)
  const fragment = truncateFragment(sanitizeChildren(clone.children, highlightId))
  if (fragmentText(fragment).trim() === "") return ""
  return toHtml({ type: "root", children: fragment })
}

/**
 * Records, for each page, a sanitized excerpt of every paragraph citing another
 * page it links to — one excerpt per citing location, so a page that references
 * a target several times contributes several excerpts. Consumed by the Backlinks
 * component to show cited context and to deep-link back to each citing location.
 *
 * Must run after the favicon, smallcaps, spoiler, and inline-code passes so
 * excerpts reflect the final rendered prose.
 */
export const LinkContexts: QuartzTransformerPlugin = () => ({
  name: "LinkContexts",
  htmlPlugins() {
    return [
      () => (tree: Root, file: VFile) => {
        const currentSlug = simplifySlug(file.data.slug as FullSlug)
        const contexts: LinkContext[] = []
        let counter = 0

        visitParents(tree, "element", (node: Element, ancestors: Parent[]) => {
          if (!isCitingLink(node)) return
          if (isInSkippedContext(ancestors)) return

          const dataSlug = node.properties["data-slug"] as string
          const target = simplifySlug(dataSlug as FullSlug)
          if (target === currentSlug) return

          const block = findEnclosingBlock(ancestors)
          if (!block) return

          const existingId = node.properties.id
          const anchor =
            typeof existingId === "string" && existingId
              ? existingId
              : anchorId(file.data.slug as string, counter++)
          node.properties.id = anchor

          const excerptHtml = buildExcerpt(block, anchor)
          // A citation whose block sanitizes to no visible text has nothing to
          // render as a clickable reference, so don't record it.
          if (excerptHtml === "") return

          contexts.push({ target, excerptHtml, anchor })
        })

        if (contexts.length > 0) file.data.linkContexts = contexts
      },
    ]
  },
})

declare module "vfile" {
  interface DataMap {
    linkContexts: readonly LinkContext[]
  }
}
