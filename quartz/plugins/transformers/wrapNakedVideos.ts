// Video speed controller plugin inserts the vsc controller as the first child of the video element's parent.
// If a video element is not already wrapped in a .video-container, the vsc controller will be the first child of <article>.
// This plugin wraps all video elements in a .video-container to prevent that.

import type { Element, Parent, Root } from "hast"
import type { Plugin } from "unified"

import { visitParents } from "unist-util-visit-parents"

import type { QuartzTransformerPlugin } from "../types"

import { hasClass } from "./utils"

/**
 * Visitor function to process video elements.
 * If a video element is not already wrapped in a .video-container, this function wraps it.
 */
function visitVideoElement(videoNode: Element, ancestors: Parent[]): void {
  if (videoNode.tagName !== "video") {
    return
  }

  const directParent = ancestors[ancestors.length - 1]
  if (
    directParent &&
    directParent.type === "element" &&
    hasClass(directParent as Element, "video-container")
  ) {
    return
  }

  // Replace the original video node with the new wrapper in its parent's children list
  if (directParent && directParent.children) {
    const index = directParent.children.indexOf(videoNode)
    if (index !== -1) {
      const wrapperSpan: Element = {
        type: "element",
        tagName: "span",
        properties: { className: ["video-container"] },
        children: [videoNode],
      }

      directParent.children.splice(index, 1, wrapperSpan)
    }
  } else {
    throw new Error("Video element is expected to have an existing parent element in the AST.")
  }
}

/**
 * Rehype plugin that visits video elements and wraps them in a
 * <span class="video-container"> if they are not already in one.
 */
const rehypeWrapNakedVideos: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visitParents(tree, "element", visitVideoElement)
  }
}

export const WrapNakedVideos: QuartzTransformerPlugin = () => {
  return {
    name: "WrapNakedVideos",
    htmlPlugins() {
      return [rehypeWrapNakedVideos]
    },
  }
}
