import fs from "fs"
import { globby } from "globby"
import { type Element, type Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import { visit } from "unist-util-visit"

import { minFaviconCount, specialFaviconPaths } from "../../components/constants"
import { joinSegments, type FilePath, type FullSlug } from "../../util/path"
import { getFaviconCounts } from "../transformers/countFavicons"
import {
  createFaviconElement,
  getFaviconUrl,
  transformUrl,
  DEFAULT_PATH,
  urlCache,
  shouldIncludeFavicon,
} from "../transformers/linkfavicons"
import { createWinstonLogger } from "../transformers/logger_utils"
import { hasClass } from "../transformers/utils"
import { type QuartzEmitterPlugin } from "../types"

const logger = createWinstonLogger("populateContainers")

const TEST_PAGE_SLUG = "test-page" as FullSlug
const DESIGN_PAGE_SLUG = "design" as FullSlug

/**
 * Finds an element in the HAST tree by its ID attribute.
 * @param root - The root HAST node to search
 * @param id - The ID to search for
 * @returns The element with the matching ID, or null if not found
 */
export const findElementById = (root: Root, id: string): Element | null => {
  let found: Element | null = null
  visit(root, "element", (node: Element) => {
    if (node.properties?.id === id) {
      found = node
      return false // Stop traversal once found
    }
  })
  return found
}

/**
 * Finds all elements in the HAST tree by class name.
 * @param root - The root HAST node to search
 * @param className - The class name to search for
 * @returns Array of elements with the matching class name
 */
export const findElementsByClass = (root: Root, className: string): Element[] => {
  const found: Element[] = []
  visit(root, "element", (node: Element) => {
    if (hasClass(node, className)) {
      found.push(node)
    }
  })
  return found
}

/**
 * Type for content generators that produce HAST elements to populate containers.
 */
export type ContentGenerator = () => Promise<Element[]>

/**
 * Generates content from a constant value (string or number).
 */
export const generateConstantContent = (value: string | number): ContentGenerator => {
  return async (): Promise<Element[]> => {
    return [h("span", String(value))]
  }
}

/**
 * Generates content showing the count of test files (.test.ts and .test.tsx).
 */
export const generateTestCountContent = (): ContentGenerator => {
  return async (): Promise<Element[]> => {
    const testFiles = await globby("**/*.test.{ts,tsx}", {
      ignore: ["node_modules/**", "coverage/**", "public/**"],
    })
    const count = testFiles.length
    return [h("span", `${count} test files`)]
  }
}

/**
 * Adds .png extension to path if it doesn't already have an extension.
 */
const addPngExtension = (path: string): string => {
  if (path.startsWith("http") || path.includes(".svg") || path.includes(".ico")) {
    return path
  }
  return `${path}.png`
}

/**
 * Checks CDN for SVG version of PNG paths and caches results.
 * @param pngPaths - Array of PNG paths to check for SVG alternatives
 */
const checkCdnSvgs = async (pngPaths: string[]): Promise<void> => {
  if (pngPaths.length === 0) return

  await Promise.all(
    pngPaths.map(async (pngPath) => {
      const svgUrl = `https://assets.turntrout.com${pngPath.replace(".png", ".svg")}`
      try {
        const response = await fetch(svgUrl, { method: "HEAD" })
        if (response.ok) {
          urlCache.set(pngPath, svgUrl)
          logger.debug(`Found SVG alternative for ${pngPath}`)
        }
      } catch {
        // SVG doesn't exist on CDN, that's fine
        logger.debug(`No SVG alternative for ${pngPath}`)
      }
    }),
  )
}

/**
 * Generates the site's own favicon element.
 */
export const generateSiteFaviconContent = (): ContentGenerator => {
  return async (): Promise<Element[]> => {
    const faviconElement = createFaviconElement(specialFaviconPaths.turntrout)
    return [h("span", { className: "favicon-span" }, [faviconElement])]
  }
}

/**
 * Generates favicon elements based on favicon counts from the build process.
 */
export const generateFaviconContent = (): ContentGenerator => {
  return async (): Promise<Element[]> => {
    const faviconCounts = getFaviconCounts()
    logger.info(`Got ${faviconCounts.size} favicon counts for table generation`)

    // Find PNG paths that need SVG CDN checking
    const pngPathsToCheck = Array.from(faviconCounts.keys())
      .map(addPngExtension)
      .map(transformUrl)
      .filter((path) => path !== DEFAULT_PATH && path.endsWith(".png"))
      .filter((path) => !urlCache.has(path) || urlCache.get(path) === DEFAULT_PATH)

    await checkCdnSvgs(pngPathsToCheck)

    // Process and filter favicons
    const validFavicons = Array.from(faviconCounts.entries())
      .map(([pathWithoutExt, count]) => {
        const pathWithExt = addPngExtension(pathWithoutExt)
        const transformedPath = transformUrl(pathWithExt)
        if (transformedPath === DEFAULT_PATH) return null

        const url = getFaviconUrl(transformedPath)
        // istanbul ignore if
        if (url === DEFAULT_PATH) return null

        // Use helper from linkfavicons.ts to check if favicon should be included
        if (!shouldIncludeFavicon(url, pathWithoutExt, faviconCounts)) return null

        return { url, count } as const
      })
      .filter((item): item is { url: string; count: number } => item !== null)
      .sort((a, b) => b.count - a.count)

    logger.info(`After filtering, ${validFavicons.length} valid favicons for table`)

    // Create table
    const tableRows: Element[] = [
      h("tr", [h("th", "Lowercase"), h("th", "Punctuation"), h("th", "Exclamation")]),
    ]

    for (const { url } of validFavicons) {
      const faviconElement = createFaviconElement(url)
      tableRows.push(
        h("tr", [
          h("td", [h("span", ["test", faviconElement])]),
          h("td", [h("span", ["test.", faviconElement])]),
          h("td", [h("span", ["test!", faviconElement])]),
        ]),
      )
    }

    return [h("table", { class: "center-table-headings" }, tableRows)]
  }
}

/**
 * Configuration for populating an element by ID or class with generated content.
 */
export interface ElementPopulatorConfig {
  /** The ID of the element to populate (mutually exclusive with className) */
  id?: string
  /** The class name of elements to populate (mutually exclusive with id) */
  className?: string
  /** The content generator function */
  generator: ContentGenerator
}

/**
 * Populates elements in an HTML file based on a list of configurations.
 * @param htmlPath - Path to the HTML file
 * @param configs - Array of element populator configurations
 * @returns Array of file paths that were modified
 * @throws Error if file cannot be read or written, or if config is invalid
 */
export const populateElements = async (
  htmlPath: string,
  configs: ElementPopulatorConfig[],
): Promise<FilePath[]> => {
  // Validate configs before processing
  for (const config of configs) {
    if (!config.id && !config.className) {
      throw new Error("Config missing both id and className")
    }
    if (config.id && config.className) {
      throw new Error("Config cannot have both id and className")
    }
  }

  // Read and parse HTML
  let html: string
  try {
    html = fs.readFileSync(htmlPath, "utf-8")
  } catch (error) {
    logger.error(`Failed to read file ${htmlPath}: ${error}`)
    throw error
  }

  const root = fromHtml(html)
  let modified = false

  // Process each configuration
  for (const config of configs) {
    if (config.id) {
      const element = findElementById(root, config.id)
      if (!element) {
        logger.warn(`No element with id "${config.id}" found in ${htmlPath}`)
        continue
      }

      const content = await config.generator()
      element.children = content
      modified = true
      logger.debug(`Populated element #${config.id} with ${content.length} child(ren)`)
    } else if (config.className) {
      const elements = findElementsByClass(root, config.className)
      if (elements.length === 0) {
        logger.warn(`No elements with class "${config.className}" found in ${htmlPath}`)
        continue
      }

      logger.debug(`Populating ${elements.length} element(s) with class .${config.className}`)
      const content = await config.generator()
      for (const element of elements) {
        element.children = content
      }
      modified = true
      logger.debug(`Added ${content.length} child(ren) to each .${config.className}`)
    }
  }

  // Write modified HTML back to file
  if (modified) {
    try {
      fs.writeFileSync(htmlPath, toHtml(root), "utf-8")
      logger.info(`Successfully updated ${htmlPath}`)
      return [htmlPath as FilePath]
    } catch (error) {
      logger.error(`Failed to write file ${htmlPath}: ${error}`)
      throw error
    }
  }

  return []
}

/**
 * Emitter that populates the containers on the test page and design page after all files have been processed.
 * This plugin:
 * - Populates the favicon container on the test page with a table of all favicons
 * - Populates the site favicon on the design page
 * - Populates the favicon threshold value on the design page
 */
export const PopulateContainers: QuartzEmitterPlugin = () => {
  return {
    name: "PopulateContainers",
    // istanbul ignore next
    getQuartzComponents() {
      return []
    },
    async emit(ctx) {
      logger.info("Starting container population")
      const modifiedFiles: FilePath[] = []

      // Populate test page
      try {
        const testPagePath = joinSegments(ctx.argv.output, `${TEST_PAGE_SLUG}.html`)
        const testPageFiles = await populateElements(testPagePath, [
          {
            id: "populate-favicon-container",
            generator: generateFaviconContent(),
          },
        ])
        modifiedFiles.push(...testPageFiles)
      } catch (error) {
        logger.error(`Failed to populate test page: ${error}`)
      }

      // Populate design page
      try {
        const designPagePath = joinSegments(ctx.argv.output, `${DESIGN_PAGE_SLUG}.html`)
        const designPageFiles = await populateElements(designPagePath, [
          {
            className: "populate-site-favicon",
            generator: generateSiteFaviconContent(),
          },
          {
            id: "populate-favicon-threshold",
            generator: generateConstantContent(minFaviconCount),
          },
        ])
        modifiedFiles.push(...designPageFiles)
      } catch (error) {
        logger.error(`Failed to populate design page: ${error}`)
      }

      logger.info(`Container population complete. Modified ${modifiedFiles.length} file(s)`)
      return modifiedFiles
    },
  }
}
