// Video speed controller plugin inserts the vsc controller as the first child of the video element's parent.
// If a video element is not already wrapped in a .video-container, the vsc controller will be the first child of <article>.
// This plugin wraps all video elements in a .video-container to prevent that.

import type { Element, Parent, Properties, Root, RootContent } from "hast"
import type { Plugin } from "unified"

import { h } from "hastscript"
import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { addClass, hasClass, removeClass } from "./utils"

/**
 * Wraps an element node with a wrapper element of the specified tag name and class name, unless skipped.
 *
 * @param node The element to wrap.
 * @param ancestors The list of ancestor Parent nodes, where the last element is the direct parent.
 * @param skipPredicate A predicate function to determine if wrapping should be skipped.
 * @param wrapperTagName The tag name of the wrapper element (e.g., "span", "figure").
 * @param wrapperClassName The class name to apply to the wrapper element (empty string for no class).
 * @param wrapperProperties Additional properties to set on the wrapper element.
 */
function wrapElement(
  node: Element,
  ancestors: Parent[],
  skipPredicate: (node: Element, ancestors: Parent[], wrapperClassName: string) => boolean,
  wrapperTagName: string,
  wrapperClassName: string,
  wrapperProperties: Properties = {},
): void {
  /* istanbul ignore next */
  if (ancestors.length === 0) {
    throw new Error("Element is expected to have an existing parent element in the AST.")
  }

  if (skipPredicate(node, ancestors, wrapperClassName)) {
    return
  }

  const index = ancestors[ancestors.length - 1].children.indexOf(node)
  const existsInParentChildren = index !== -1
  /* istanbul ignore else */
  if (existsInParentChildren) {
    const props: Properties = { ...wrapperProperties }
    if (wrapperClassName) {
      props.className = [wrapperClassName]
    }
    const wrapper: Element = h(wrapperTagName, props, [node])

    ancestors[ancestors.length - 1].children.splice(index, 1, wrapper)
  } else {
    /* istanbul ignore next */
    throw new Error("Element is not actually a child of its claimed parent.")
  }
}

/**
 * Extracts the source URL from a media element (video/audio).
 * Checks the element's `src` attribute first, then falls back to the first `<source>` child's `src`.
 */
function getMediaSrc(node: Element): string {
  const src = node.properties?.src
  if (typeof src === "string") return src

  const sourceChild = node.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "source",
  )
  const childSrc = sourceChild?.properties?.src
  return typeof childSrc === "string" ? childSrc : ""
}

function isElement(node: Parent): node is Element {
  return node.type === "element"
}

/**
 * Determines if a video node should be skipped based on its tag name and parent class.
 *
 * @param videoNode The video element to check.
 * @param ancestors The list of ancestor Parent nodes, where the last element is the direct parent.
 * @param wrapperClassName The class name of the wrapper span to check for.
 */
function skipNodeForVideo(
  videoNode: Element,
  ancestors: Parent[],
  wrapperClassName: string,
): boolean {
  const notVideo = videoNode.tagName !== "video"
  const directParent = ancestors[ancestors.length - 1]
  const inVideoContainer = isElement(directParent) && hasClass(directParent, wrapperClassName)
  return notVideo || inVideoContainer
}

/**
 * Wraps a video node in a <span class="video-container"> if it is not already in one.
 * Sets `data-src` on the wrapper so the print stylesheet can display the URL.
 */
function wrapVideo(videoNode: Element, ancestors: Parent[]): void {
  if (videoNode.tagName !== "video") return
  const dataSrc = getMediaSrc(videoNode)
  const props = dataSrc ? { "data-src": dataSrc } : {}
  wrapElement(videoNode, ancestors, skipNodeForVideo, "span", "video-container", props)
}

/**
 * Determines if an audio node should be skipped based on its tag name and parent class.
 */
function skipNodeForAudio(
  audioNode: Element,
  ancestors: Parent[],
  wrapperClassName: string,
): boolean {
  const notAudio = audioNode.tagName !== "audio"
  const directParent = ancestors[ancestors.length - 1]
  const inAudioContainer = isElement(directParent) && hasClass(directParent, wrapperClassName)
  return notAudio || inAudioContainer
}

/**
 * Wraps an audio node in a <span class="audio-container"> if it is not already in one.
 * Sets `data-src` on the wrapper so the print stylesheet can display the URL.
 */
function wrapAudio(audioNode: Element, ancestors: Parent[]): void {
  if (audioNode.tagName !== "audio") return
  const dataSrc = getMediaSrc(audioNode)
  const props = dataSrc ? { "data-src": dataSrc } : {}
  wrapElement(audioNode, ancestors, skipNodeForAudio, "span", "audio-container", props)
}

/**
 * Determines if an element with float-right should be skipped for wrapping.
 * Skips if parent is already a figure.
 *
 * @param element The element to check.
 * @param ancestors The list of ancestor Parent nodes.
 */
function skipNodeForFloatRight(element: Element, ancestors: Parent[]): boolean {
  const directParent = ancestors[ancestors.length - 1]
  return isElement(directParent) && directParent.tagName === "figure"
}

function hasAncestorFigure(ancestors: Parent[]): boolean {
  return ancestors.some((ancestor) => isElement(ancestor) && ancestor.tagName === "figure")
}

/**
 * Checks if an element should not be wrapped in a figure tag.
 * These are semantic containers that should remain unwrapped.
 */
function shouldNotWrapInFigure(element: Element, ancestors: Parent[]): boolean {
  if (hasAncestorFigure(ancestors) || element.tagName === "figure") {
    return true
  }
  const ignoreClasses = ["admonition-content", "admonition"]
  return ignoreClasses.some((className) => hasClass(element, className))
}

/**
 * Returns the direct child carrying the `float-right` class, looking through a
 * `<picture>` wrapper to its inner element (e.g. a dark-mode-inverted `<img>`).
 */
function findFloatRightChild(figure: Element): Element | undefined {
  for (const child of figure.children) {
    if (child.type !== "element") continue
    if (hasClass(child, "float-right")) return child
    if (child.tagName === "picture") {
      const inner = child.children.find(
        (c): c is Element => c.type === "element" && hasClass(c, "float-right"),
      )
      if (inner) return inner
    }
  }
  return undefined
}

/**
 * When a `<figure>` directly wraps a `float-right` element — as remark-captions
 * does for a captioned float-right image — only the inner element floats while
 * the figure (and its `<figcaption>`) stays in normal flow, stranding the
 * caption. Move the class up to the figure so the whole figure floats together,
 * matching the authored `<figure class="float-right">` pattern.
 */
function promoteFloatRightToFigure(element: Element): void {
  if (element.tagName !== "figure" || hasClass(element, "float-right")) return

  const floatChild = findFloatRightChild(element)
  if (!floatChild) return

  addClass(element, "float-right")
  removeClass(floatChild, "float-right")
}

/**
 * Wraps elements with float-right class in a <figure>.
 * If an element contains a direct child with float-right, wraps the parent instead,
 * unless the parent is a semantic container that should not be wrapped (like paragraphs).
 * For paragraphs containing ONLY a float-right element, converts the paragraph to a figure.
 */
function wrapFloatRight(element: Element, ancestors: Parent[]): void {
  if (shouldNotWrapInFigure(element, ancestors)) {
    return
  }

  const hasFloatRightChild = element.children.some(
    (child) => child.type === "element" && hasClass(child, "float-right"),
  )

  // For paragraphs containing ONLY a float-right child (no other content), convert the paragraph to a figure
  if (hasFloatRightChild && element.tagName === "p") {
    // Check if the paragraph contains only the float-right element (ignoring whitespace)
    const nonWhitespaceChildren = element.children.filter(
      (child) => !(child.type === "text" && (!child.value || child.value.trim() === "")),
    )

    // If there's only one non-whitespace child and it has float-right, convert paragraph to figure
    if (
      nonWhitespaceChildren.length === 1 &&
      nonWhitespaceChildren[0].type === "element" &&
      hasClass(nonWhitespaceChildren[0], "float-right")
    ) {
      element.tagName = "figure"
      return
    }

    // Otherwise, wrap the float-right child in a figure (keeping the paragraph)
    // This will be handled by the wrapping logic below
  }

  // Wrap parents that contain float-right children (e.g., span.video-container > video.float-right)
  // But skip if the parent is a paragraph - in that case, the float-right child will be wrapped directly
  if (hasFloatRightChild && element.tagName !== "p") {
    wrapElement(element, ancestors, () => false, "figure", "")
    return
  }

  // Wrap standalone float-right elements if:
  // 1. Their parent is root-level, OR
  // 2. Their parent is a paragraph (semantic container that shouldn't be wrapped)
  if (hasClass(element, "float-right")) {
    const directParent = ancestors[ancestors.length - 1]
    const parentIsRootLevel = directParent?.type === "root"
    const parentIsParagraph =
      directParent && "tagName" in directParent && directParent.tagName === "p"

    if (parentIsRootLevel || parentIsParagraph) {
      wrapElement(element, ancestors, skipNodeForFloatRight, "figure", "")
    }
  }
}

/**
 * A `.subfigure` holds an image plus its own `<figcaption>`, so it is itself a
 * figure. Authored as a `<div>`/`<span>`, that nests `<figcaption>` outside any
 * `<figure>`, which is invalid; retag it to `<figure>` (nested figures are
 * valid HTML5) so the caption sits in a legal parent.
 */
function normalizeSubfigure(element: Element): void {
  if (element.tagName !== "div" && element.tagName !== "span") return
  if (!hasClass(element, "subfigure")) return
  element.tagName = "figure"
}

function isWhitespaceText(node: RootContent): boolean {
  return node.type === "text" && (!node.value || node.value.trim() === "")
}

const MEDIA_TAG_NAMES: ReadonlySet<string> = new Set([
  "img",
  "picture",
  "video",
  "audio",
  "svg",
  "iframe",
])

/** True for media elements — and the container spans naked media gets wrapped in
 * — that a stranded `<figcaption>` can legitimately caption. */
function isMediaElement(node: Element): boolean {
  if (MEDIA_TAG_NAMES.has(node.tagName)) return true
  return (
    node.tagName === "span" &&
    (hasClass(node, "video-container") || hasClass(node, "audio-container"))
  )
}

/** Returns the media element a sibling carries — the node itself if it is media,
 * or the lone media child of a media-only `<p>` (the form an image takes once
 * rehype wraps it in a paragraph) — else undefined. The media is returned bare
 * so it can be hoisted directly into the `<figure>`, keeping `figure > img`
 * CSS selectors matching. */
function mediaWithin(node: RootContent): Element | undefined {
  if (node.type !== "element") return undefined
  if (isMediaElement(node)) return node
  if (node.tagName !== "p") return undefined
  const meaningful = node.children.filter((child) => !isWhitespaceText(child))
  const only = meaningful.length === 1 ? meaningful[0] : undefined
  return only && only.type === "element" && isMediaElement(only) ? only : undefined
}

/** Finds the nearest non-whitespace sibling in `direction` from `index`. */
function adjacentSibling(children: RootContent[], index: number, direction: 1 | -1): number {
  let cursor = index + direction
  while (cursor >= 0 && cursor < children.length && isWhitespaceText(children[cursor])) {
    cursor += direction
  }
  return cursor >= 0 && cursor < children.length ? cursor : -1
}

/**
 * `remark-captions` turns a `Figure:` paragraph into a `<figcaption>` but cannot
 * wrap raw-HTML media (e.g. an authored `<video>`) into a `<figure>`; authors
 * also hand-write `<figcaption>` above a `<video>`. Either way the caption is
 * stranded as a sibling of `<article>`/`<li>`/`<dd>` — invalid, since
 * `<figcaption>` must be a child of `<figure>`. Wrap the caption together with
 * its adjacent media sibling (preceding if present, else following, so a
 * caption-above-media layout is preserved) into a `<figure>`.
 */
function adoptOrphanedFigcaption(node: Element, ancestors: Parent[]): void {
  if (node.tagName !== "figcaption") return
  // Content is transformed at the document root — the wrapping <article> is
  // added later — so a root parent is the common case, not just element parents.
  const parent = ancestors[ancestors.length - 1]
  if (isElement(parent) && parent.tagName === "figure") return

  const index = parent.children.indexOf(node)
  const prevIndex = adjacentSibling(parent.children, index, -1)
  const prevMedia = prevIndex >= 0 ? mediaWithin(parent.children[prevIndex]) : undefined
  if (prevMedia) {
    const figure = h("figure", [prevMedia, node])
    parent.children.splice(prevIndex, index - prevIndex + 1, figure)
    return
  }

  const nextIndex = adjacentSibling(parent.children, index, 1)
  const nextMedia = nextIndex >= 0 ? mediaWithin(parent.children[nextIndex]) : undefined
  if (nextMedia) {
    const figure = h("figure", [node, nextMedia])
    parent.children.splice(index, nextIndex - index + 1, figure)
  }
}

/**
 * Rehype plugin that visits elements and wraps them appropriately.
 */
const rehypeWrapNakedElements: Plugin<[], Root> = () => {
  return (tree: Root) => {
    // Retag `.subfigure` containers to <figure> before figure-wrapping runs.
    visitParents(tree, "element", normalizeSubfigure)
    // Wrap naked videos and audio in containers with data-src for print
    visitParents(tree, "element", wrapVideo)
    visitParents(tree, "element", wrapAudio)
    // Promote float-right from a captioned figure's child up to the figure, so
    // the caption floats with the image rather than stranding in normal flow.
    visitParents(tree, "element", promoteFloatRightToFigure)
    // Then wrap .float-right elements (or their parents) in figure
    visitParents(tree, "element", wrapFloatRight)
    // Finally, give any caption stranded by raw-HTML media a <figure> parent.
    visitParents(tree, "element", adoptOrphanedFigcaption)
  }
}

/** Quartz transformer wrapping bare media/float-right elements in container `<figure>`/`<div>`s. */
export const WrapNakedElements: QuartzTransformerPlugin = () => {
  return {
    name: "WrapNakedElements",
    htmlPlugins() {
      return [rehypeWrapNakedElements]
    },
  }
}
