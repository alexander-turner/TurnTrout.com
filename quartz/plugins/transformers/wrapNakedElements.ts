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
 * Wraps an element node with a span wrapper of the specified class name, unless skipped.
 *
 * @param node The element to wrap.
 * @param ancestors The list of ancestor Parent nodes, where the last element is the direct parent.
 * @param skipPredicate A predicate function to determine if wrapping should be skipped.
 * @param wrapperClassName The class name to apply to the wrapper span.
 */
function wrapElement(
  node: Element,
  ancestors: Parent[],
  skipPredicate: (node: Element, ancestors: Parent[], wrapperClassName: string) => boolean,
  wrapperClassName: string,
): void {
  /* istanbul ignore next */
  if (ancestors.length === 0) {
    throw new Error("Video element is expected to have an existing parent element in the AST.")
  }

  if (skipPredicate(node, ancestors, wrapperClassName)) {
    return
  }

  const index = ancestors[ancestors.length - 1].children.indexOf(node)
  const existsInParentChildren = index !== -1
  /* istanbul ignore else */
  if (existsInParentChildren) {
    const wrapperSpan: Element = h("span", { className: [wrapperClassName] }, [node])

    ancestors[ancestors.length - 1].children.splice(index, 1, wrapperSpan)
  } else {
    /* istanbul ignore next */
    throw new Error("Video element is not actually a child of its claimed parent.")
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
  wrapElement(videoNode, ancestors, skipNodeForVideo, "video-container")
}

/**
 * Rehype plugin that visits video elements and wraps them in a
 * <span class="video-container"> if they are not already in one.
 */
const rehypeWrapNakedElements: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visitParents(tree, "element", wrapVideo)
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
