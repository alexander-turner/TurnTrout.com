import fs from "fs"
import { type Element, type Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import { visit } from "unist-util-visit"

import { joinSegments, type FilePath, type FullSlug } from "../../util/path"
import { getFaviconCounts } from "../transformers/countfavicons"
import {
  createFaviconElement,
  getFaviconUrl,
  transformUrl,
  FAVICON_COUNT_WHITELIST,
  MIN_FAVICON_COUNT,
  DEFAULT_PATH,
} from "../transformers/linkfavicons"
import { createWinstonLogger } from "../transformers/logger_utils"
import { type QuartzEmitterPlugin } from "../types"

const logger = createWinstonLogger("populateFaviconContainer")

const TEST_PAGE_SLUG = "Test-page" as FullSlug

const findFaviconContainer = (root: Root): Element | null => {
  let container: Element | null = null
  visit(root, "element", (node) => {
    if (node.tagName === "div" && node.properties?.id === "favicon-container") {
      container = node
    }
  })
  return container
}

const getValidFavicons = (faviconCounts: Map<string, number>): Element[] => {
  return Array.from(faviconCounts.entries())
    .map(([path, count]: [string, number]) => {
      // Transform path (checks blacklist/whitelist)
      // Note: Paths are already normalized at hostname level in getQuartzPath
      const transformedPath = transformUrl(path)

      // Skip if blacklisted
      if (transformedPath === DEFAULT_PATH) {
        return null
      }

      const url = getFaviconUrl(transformedPath)
      if (url === DEFAULT_PATH) {
        return null
      }

      const isWhitelisted = FAVICON_COUNT_WHITELIST.some((entry) => transformedPath.includes(entry))

      if (isWhitelisted || count >= MIN_FAVICON_COUNT) {
        return { path: transformedPath, url, count } as const
      }

      return null
    })
    .filter((item): item is { path: string; url: string; count: number } => item !== null)
    .sort((a, b) => b.count - a.count)
    .map(({ url }) => createFaviconElement(url))
}

/**
 * Emitter that populates the #favicon-container on the test page after all files have been processed.
 * This runs after all transformers, so it has access to the final favicon counts.
 */
export const PopulateFaviconContainer: QuartzEmitterPlugin = () => {
  return {
    name: "PopulateFaviconContainer",
    getQuartzComponents() {
      return []
    },
    async getDependencyGraph() {
      const DepGraph = (await import("../../depgraph")).default
      return new DepGraph<FilePath>()
    },
    async emit(ctx) {
      const testPagePath = joinSegments(ctx.argv.output, `${TEST_PAGE_SLUG}.html`)

      // Check if test page exists
      if (!fs.existsSync(testPagePath)) {
        logger.debug("Test page not found, skipping favicon container population")
        return []
      }

      logger.info("Populating favicon container on test page")

      // Get final counts from in-memory counter (all files have been processed by now)
      const faviconCounts = getFaviconCounts()
      logger.info(`Using ${faviconCounts.size} favicon counts for container`)

      const html = fs.readFileSync(testPagePath, "utf-8")
      const root = fromHtml(html)
      const container = findFaviconContainer(root)

      if (!container) {
        logger.warn("No #favicon-container found on test page")
        return []
      }

      const validFavicons = getValidFavicons(faviconCounts)
      logger.info(`Adding ${validFavicons.length} favicons to container`)

      container.children = validFavicons

      fs.writeFileSync(testPagePath, toHtml(root), "utf-8")

      return [testPagePath as FilePath]
    },
  }
}
