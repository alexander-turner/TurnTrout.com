import type { Root as MDRoot, Link, Parent as MDParent } from "mdast"

import fs from "fs"
import remarkParse from "remark-parse"
import { read } from "to-vfile"
import { unified } from "unified"
import { visit } from "unist-util-visit"

import type { BuildCtx } from "../../util/ctx"
import type { FilePath } from "../../util/path"

import { specialFaviconPaths } from "../../components/constants"
import {
  getQuartzPath,
  isAssetLink,
  FAVICON_COUNTS_FILE,
  normalizePathForCounting,
  normalizeUrl,
} from "./linkfavicons"
import { createWinstonLogger } from "./logger_utils"

const logger = createWinstonLogger("countlinks")

// Module-level counter to accumulate link counts across all files
const faviconCounter = new Map<string, number>()

/**
 * Gets favicon counts from memory, or reads from file if memory is empty.
 * This handles cases where counts are needed in a different process than where they were generated.
 * @returns A Map of favicon path to count
 */
export function getFaviconCounts(): Map<string, number> {
  // If in-memory map has data, use it (normal build-time usage)
  if (faviconCounter.size > 0) {
    return new Map(faviconCounter)
  }

  // Otherwise, read from persisted file (cross-process usage, e.g., during Playwright tests)
  if (!fs.existsSync(FAVICON_COUNTS_FILE)) {
    logger.warn(`Favicon counts file not found at ${FAVICON_COUNTS_FILE}`)
    return new Map<string, number>()
  }

  const data = fs.readFileSync(FAVICON_COUNTS_FILE, "utf8")
  const entries = JSON.parse(data) as Array<[string, number]>
  const countMap = new Map<string, number>(entries)
  logger.debug(`Read ${countMap.size} favicon counts from ${FAVICON_COUNTS_FILE}`)
  return countMap
}

/**
 * Determines what favicon path a link would get based on its URL.
 * Uses the same logic as linkfavicons.ts to predict favicon paths.
 * Returns format-agnostic path (without extension) for counting.
 */
function getFaviconPathForLink(url: string): string | null {
  if (url.includes("mailto:")) {
    return specialFaviconPaths.mail
  }

  if (url.startsWith("#")) {
    return specialFaviconPaths.anchor
  }

  if (url === "/rss.xml" || url.endsWith("/rss.xml")) {
    return specialFaviconPaths.rss
  }

  // Skip asset links (reuse centralized check from linkfavicons.ts)
  if (isAssetLink(url)) {
    return null
  }

  try {
    // Normalize relative URLs to absolute (reuse from linkfavicons.ts)
    const normalizedUrl = normalizeUrl(url)
    const urlObj = new URL(normalizedUrl)
    const hostname = urlObj.hostname
    const faviconPath = getQuartzPath(hostname)
    // Strip extension for counting (counts are format-agnostic)
    return normalizePathForCounting(faviconPath)
  } catch {
    // Invalid URL, skip
    return null
  }
}

/**
 * Checks if a markdown favicon should be skipped for counting.
 */
function shouldSkipMarkdownLink(url: string, parent: MDParent | undefined): boolean {
  // Skip same-page links that are footnotes or in headings
  if (url.startsWith("#")) {
    const isFootnote = url.startsWith("#user-content-fn")
    const isInHeading = parent?.type === "heading"
    return isFootnote || isInHeading
  }

  return false
}

/**
 * Writes favicon counts to the output file as JSON.
 * Note: This writes after all files are processed. The final write will contain
 * all accumulated counts across all files.
 */
function writeCountsToFile(): void {
  try {
    const entries = Array.from(faviconCounter.entries())
    const content = JSON.stringify(entries, null, 2)

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
 * Processes a single file's favicons and counts them from markdown AST.
 */
function countLinksInMarkdownTree(tree: MDRoot): void {
  visit(tree, "link", (node: Link, _index: number | undefined, parent: MDParent | undefined) => {
    if (!node.url) {
      return
    }

    // Skip favicons that wouldn't get favicons
    if (shouldSkipMarkdownLink(node.url, parent)) {
      return
    }

    const faviconPath = getFaviconPathForLink(node.url)
    if (faviconPath) {
      const currentCount = faviconCounter.get(faviconPath) || 0
      faviconCounter.set(faviconPath, currentCount + 1)
    }
  })
}

/**
 * Pre-processes all markdown files to count links before HTML conversion.
 * This must complete before AddFavicons processes any files.
 */
export async function countAllFavicons(ctx: BuildCtx, filePaths: FilePath[]): Promise<void> {
  logger.info(`Counting links across ${filePaths.length} files`)
  faviconCounter.clear()

  const processor = unified().use(remarkParse)

  for (const filePath of filePaths) {
    try {
      const file = await read(filePath)
      const tree = processor.parse(file) as MDRoot
      countLinksInMarkdownTree(tree)
    } catch (error) {
      logger.warn(`Failed to count links in ${filePath}: ${error}`)
    }
  }

  writeCountsToFile()
  logger.info(`Finished counting links: ${faviconCounter.size} unique link destinations`)
}
