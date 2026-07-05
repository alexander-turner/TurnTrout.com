import type { Element, Root } from "hast"

import path from "path"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

import { CAN_TRIGGER_POPOVER_CLASS, linkAnnotationBlocklist } from "../../components/constants"
import {
  ANNOTATED_LINK_CLASS,
  type LinkAnnotations,
  validateLinkAnnotations,
} from "../../util/annotations"
import { addClassesOnce } from "../../util/hast"
import { projectRoot, readManifestFile } from "../../util/manifests"
import { tryCanonicalizeUrl } from "../../util/urls"
import { isExternalLink } from "./links"

/** Committed source of truth for external-link annotations (keyed by canonical URL). */
export const annotationsPath = path.join(projectRoot, "config", "link_annotations.json")

/** Missing manifest → empty map; malformed content or other I/O errors propagate. */
export function loadLinkAnnotations(filePath: string = annotationsPath): LinkAnnotations {
  const raw = readManifestFile(filePath)
  if (raw === null) return new Map()
  return validateLinkAnnotations(JSON.parse(raw), filePath)
}

/**
 * The canonical annotation key for an external `<a>`. Archived links keep
 * their live URL in `data-original-href`, so that takes precedence over the
 * (rewritten) `href`. Returns null for non-external or unparseable hrefs.
 */
export function annotationKeyForNode(node: Element): string | null {
  const originalHref = node.properties?.["data-original-href"]
  const href = typeof originalHref === "string" ? originalHref : node.properties?.href
  if (typeof href !== "string" || !href.startsWith("http") || !isExternalLink(href)) {
    return null
  }
  return tryCanonicalizeUrl(href)
}

/**
 * Mark an external link that has a committed annotation so the popover client
 * can render it. Only manifest hits get `can-trigger-popover`, so the client
 * never attaches popover listeners to links whose lookups would miss.
 */
export function annotateLink(
  node: Element,
  annotations: LinkAnnotations,
  blocklist: readonly string[] = linkAnnotationBlocklist,
): boolean {
  const key = annotationKeyForNode(node)
  if (key === null || blocklist.includes(key) || !annotations.has(key)) {
    return false
  }

  addClassesOnce(node, [CAN_TRIGGER_POPOVER_CLASS, ANNOTATED_LINK_CLASS])
  node.properties["data-annotated"] = "true"
  return true
}

export interface AnnotateLinksOptions {
  annotationsPath: string
}

/**
 * Marks external links that have committed annotations. Must run after
 * `CrawlLinks` (normalizes external hrefs to absolute `https://`) and after
 * `ArchiveLinks` (records the live URL in `data-original-href` when it swaps
 * in an archived copy). The manifest is read once per build.
 */
export const AnnotateLinks: QuartzTransformerPlugin<Partial<AnnotateLinksOptions> | undefined> = (
  userOpts,
) => {
  const filePath = userOpts?.annotationsPath ?? annotationsPath

  return {
    name: "AnnotateLinks",
    htmlPlugins() {
      const annotations = loadLinkAnnotations(filePath)
      return [
        () => {
          return (tree: Root) => {
            visit(tree, "element", (node) => {
              if (node.tagName === "a") {
                annotateLink(node, annotations)
              }
            })
          }
        },
      ]
    },
  }
}
