import fs from "fs"
import { type Element, type Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import { visit } from "unist-util-visit"

import {
  minFaviconCount,
  faviconCountWhitelist,
  mailIconPath,
  anchorIconPath,
  rssIconPath,
  turntroutFaviconPath,
  googleSubdomainWhitelist,
} from "../../components/constants"
import { joinSegments, type FilePath, type FullSlug } from "../../util/path"
import { getFaviconCounts } from "../transformers/countfavicons"
import {
  createFaviconElement,
  getFaviconUrl,
  transformUrl,
  DEFAULT_PATH,
  urlCache,
} from "../transformers/linkfavicons"
import { createWinstonLogger } from "../transformers/logger_utils"
import { type QuartzEmitterPlugin } from "../types"

// istanbul ignore next
const FAVICON_COUNT_WHITELIST = [
  mailIconPath,
  anchorIconPath,
  rssIconPath,
  turntroutFaviconPath,
  ...faviconCountWhitelist,
  ...googleSubdomainWhitelist.map((subdomain) => `${subdomain.replaceAll(".", "_")}_google_com`),
]

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

const getValidFavicons = async (faviconCounts: Map<string, number>): Promise<Element[]> => {
  // Check CDN for SVGs for PNG paths that aren't cached yet
  const pngPathsToCheck = Array.from(faviconCounts.keys())
    .map((pathWithoutExt) => {
      if (
        pathWithoutExt.startsWith("http") ||
        pathWithoutExt.includes(".svg") ||
        pathWithoutExt.includes(".ico")
      ) {
        return null
      }
      const pathWithExt = `${pathWithoutExt}.png`
      const transformedPath = transformUrl(pathWithExt)
      return transformedPath !== DEFAULT_PATH && transformedPath.endsWith(".png")
        ? transformedPath
        : null
    })
    .filter((path): path is string => path !== null)
    .filter((path) => !urlCache.has(path) || urlCache.get(path) === DEFAULT_PATH)

  // Check CDN for SVGs in parallel (only for paths not already cached)
  await Promise.all(
    pngPathsToCheck.map(async (pngPath) => {
      const svgPath = pngPath.replace(".png", ".svg")
      const svgUrl = `https://assets.turntrout.com${svgPath}`
      try {
        const response = await fetch(svgUrl)
        if (response.ok) {
          urlCache.set(pngPath, svgUrl)
        }
      } catch {
        // SVG doesn't exist on CDN, that's fine
      }
    }),
  )

  // Now get favicon URLs (which will use cached SVGs if found)
  return Array.from(faviconCounts.entries())
    .map(([pathWithoutExt, count]: [string, number]) => {
      // Counts are stored without extensions (format-agnostic), but transformUrl expects .png paths
      // Special paths (mail, anchor, turntrout) are full URLs/paths, others need .png added
      const pathWithExt =
        pathWithoutExt.startsWith("http") ||
        pathWithoutExt.includes(".svg") ||
        pathWithoutExt.includes(".ico")
          ? pathWithoutExt
          : `${pathWithoutExt}.png`

      // Transform path (checks blacklist/whitelist)
      // Note: Paths are already normalized at hostname level in getQuartzPath
      const transformedPath = transformUrl(pathWithExt)

      // Skip if blacklisted
      if (transformedPath === DEFAULT_PATH) {
        return null
      }

      // Get favicon URL (getFaviconUrl checks cache, which now includes SVGs from CDN check above)
      const url = getFaviconUrl(transformedPath)
      if (url === DEFAULT_PATH) {
        return null
      }

      const isWhitelisted = FAVICON_COUNT_WHITELIST.some((entry: string) =>
        transformedPath.includes(entry),
      )

      if (isWhitelisted || count >= minFaviconCount) {
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

      const validFavicons = await getValidFavicons(faviconCounts)
      logger.info(`Adding ${validFavicons.length} favicons to container`)

      container.children = validFavicons

      fs.writeFileSync(testPagePath, toHtml(root), "utf-8")

      return [testPagePath as FilePath]
    },
  }
}
