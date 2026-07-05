import type { Element, Root } from "hast"

import gitRoot from "find-git-root"
import fs from "fs"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

import type { QuartzTransformerPlugin } from "../types"

import { CAN_TRIGGER_POPOVER_CLASS, linkAnnotationBlocklist } from "../../components/constants"
import {
  ANNOTATED_LINK_CLASS,
  type LinkAnnotations,
  validateLinkAnnotations,
} from "../../util/annotations"
import { canonicalizeUrl } from "../../util/urls"
import { isExternalLink } from "./links"

const projectRoot = path.dirname(gitRoot(fileURLToPath(import.meta.url)))

/** Committed source of truth for external-link annotations (keyed by canonical URL). */
export const annotationsPath = path.join(projectRoot, "config", "link_annotations.json")

/** Missing manifest → empty map; malformed content or other I/O errors propagate. */
export function loadLinkAnnotations(filePath: string = annotationsPath): LinkAnnotations {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, "utf-8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map()
    throw error
  }
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
  try {
    return canonicalizeUrl(href)
  } catch {
    // A malformed href can't be in the manifest; leave the link untouched
    // rather than crashing the build.
    return null
  }
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

  const classes = (node.properties.className ?? []) as string[]
  for (const cls of [CAN_TRIGGER_POPOVER_CLASS, ANNOTATED_LINK_CLASS]) {
    if (!classes.includes(cls)) {
      classes.push(cls)
    }
  }
  node.properties.className = classes
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
