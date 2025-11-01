import type { Element, Root, Parent } from "hast"

import gitRoot from "find-git-root"
import fs from "fs"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

import { type QuartzTransformerPlugin } from "../types"
import {
  ANCHOR_PATH,
  getQuartzPath,
  isAssetLink,
  isHeading,
  MAIL_PATH,
  normalizeUrl,
} from "./linkfavicons"
import { createWinstonLogger } from "./logger_utils"

const logger = createWinstonLogger("countfavicons")

const __filepath = fileURLToPath(import.meta.url)
const __dirname = path.dirname(gitRoot(__filepath))
const FAVICON_COUNTS_FILE = path.join(
  __dirname,
  "quartz",
  "plugins",
  "transformers",
  ".faviconCounts.txt",
)

// Module-level counter to accumulate counts across all files
const faviconCounter = new Map<string, number>()

/**
 * Determines what favicon path a link would get based on its href.
 * Uses the same logic as linkfavicons.ts to predict favicon paths.
 */
function getFaviconPathForLink(href: string): string | null {
  if (href.includes("mailto:")) {
    return MAIL_PATH
  }

  if (href.startsWith("#")) {
    return ANCHOR_PATH
  }

  // Skip asset links (reuse centralized check from linkfavicons.ts)
  if (isAssetLink(href)) {
    return null
  }

  try {
    // Normalize relative URLs to absolute (reuse from linkfavicons.ts)
    const normalizedHref = normalizeUrl(href)
    const url = new URL(normalizedHref)
    const hostname = url.hostname
    const faviconPath = getQuartzPath(hostname)
    return faviconPath
  } catch {
    // Invalid URL, skip
    return null
  }
}

/**
 * Checks if a link should be skipped for favicon counting.
 */
function shouldSkipLink(node: Element, href: string, parent: Parent): boolean {
  // Skip same-page links that are footnotes or in headings
  if (href.startsWith("#")) {
    const isFootnote = href.startsWith("#user-content-fn")
    return isFootnote || isHeading(parent as Element)
  }

  return false
}

/**
 * Writes favicon counts to the output file.
 * Note: This writes after each file is processed. The final write will contain
 * all accumulated counts across all files.
 */
function writeCountsToFile(): void {
  const sortedCounts = Array.from(faviconCounter.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )

  const lines = sortedCounts.map(([favicon, count]) => `${count}\t${favicon}`)
  const content = lines.join("\n")

  try {
    // Write atomically using a temporary file then rename
    const tempFile = `${FAVICON_COUNTS_FILE}.tmp`
    fs.writeFileSync(tempFile, content, { flag: "w" })
    fs.renameSync(tempFile, FAVICON_COUNTS_FILE)
    logger.debug(`Wrote ${faviconCounter.size} favicon counts to ${FAVICON_COUNTS_FILE}`)
  } catch (error) {
    logger.error(`Failed to write favicon counts file: ${error}`)
  }
}

/**
 * Processes a single file's links and counts favicon usage.
 */
function countFaviconsInTree(tree: Root): void {
  visit(
    tree,
    "element",
    (node: Element, _index: number | undefined, parent: Parent | undefined) => {
      if (!parent) return
      if (node.tagName !== "a" || !node.properties.href) {
        return
      }

      const href = node.properties.href
      if (typeof href !== "string") {
        return
      }

      // Skip links that wouldn't get favicons
      if (shouldSkipLink(node, href, parent)) {
        return
      }

      const faviconPath = getFaviconPathForLink(href)
      if (faviconPath) {
        const currentCount = faviconCounter.get(faviconPath) || 0
        faviconCounter.set(faviconPath, currentCount + 1)
      }
    },
  )
}

/**
 * Transformer plugin that counts favicon usage across all files.
 * Should run before AddFavicons transformer.
 */
export const CountFavicons: QuartzTransformerPlugin = () => {
  return {
    name: "CountFavicons",
    htmlPlugins() {
      return [
        () => {
          return (tree: Root) => {
            countFaviconsInTree(tree)
            writeCountsToFile()
          }
        },
      ]
    },
  }
}
