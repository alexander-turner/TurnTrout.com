// Video speed controller plugin inserts the vsc controller as the first child of the video element's parent.
// If a video element is not already wrapped in a .video-container, the vsc controller will be the first child of <article>.
// This plugin wraps all video elements in a .video-container to prevent that.

import type { Element, Parent, Root } from "hast"
import type { Plugin } from "unified"

import { h } from "hastscript"
import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { hasClass } from "./utils"

/**
 * Wraps an element node with a wrapper element of the specified tag name and class name, unless skipped.
 *
 * @param node The element to wrap.
 * @param ancestors The list of ancestor Parent nodes, where the last element is the direct parent.
 * @param skipPredicate A predicate function to determine if wrapping should be skipped.
 * @param wrapperTagName The tag name of the wrapper element (e.g., "span", "figure").
 * @param wrapperClassName The class name to apply to the wrapper element (empty string for no class).
 */
function wrapElement(
  node: Element,
  ancestors: Parent[],
  skipPredicate: (node: Element, ancestors: Parent[], wrapperClassName: string) => boolean,
  wrapperTagName: string,
  wrapperClassName: string,
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
    const wrapper: Element = wrapperClassName
      ? h(wrapperTagName, { className: [wrapperClassName] }, [node])
      : h(wrapperTagName, [node])

    ancestors[ancestors.length - 1].children.splice(index, 1, wrapper)
  } else {
    /* istanbul ignore next */
    throw new Error("Element is not actually a child of its claimed parent.")
  }
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
  const inVideoContainer = hasClass(directParent as Element, wrapperClassName)
  return notVideo || inVideoContainer
}

/**
 * Wraps a video node in a <span class="video-container"> if it is not already in one.
 */
function wrapVideo(videoNode: Element, ancestors: Parent[]): void {
  wrapElement(videoNode, ancestors, skipNodeForVideo, "span", "video-container")
}

/**
 * Determines if an element with float-right should be skipped for wrapping.
 * Skips if parent is already a figure.
 *
 * @param element The element to check.
 * @param ancestors The list of ancestor Parent nodes.
 */
function skipNodeForFloatRight(element: Element, ancestors: Parent[]): boolean {
  const directParent = ancestors[ancestors.length - 1] as Element

  // Skip if already wrapped in figure
  return directParent?.tagName === "figure"
}

function hasAncestorFigure(ancestors: Parent[]): boolean {
  return ancestors.some((ancestor) => (ancestor as Element).tagName === "figure")
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
 * Rehype plugin that visits elements and wraps them appropriately.
 */
const rehypeWrapNakedElements: Plugin<[], Root> = () => {
  return (tree: Root) => {
    // First wrap naked videos in video-container
    visitParents(tree, "element", wrapVideo)
    // Then wrap .float-right elements (or their parents) in figure
    visitParents(tree, "element", wrapFloatRight)
  }
}

// skipcq: JS-D1001
export const WrapNakedElements: QuartzTransformerPlugin = () => {
  return {
    name: "WrapNakedElements",
    htmlPlugins() {
      return [rehypeWrapNakedElements]
    },
  }
}
