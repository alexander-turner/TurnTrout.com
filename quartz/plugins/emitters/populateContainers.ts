import fs from "fs"
import { globby } from "globby"
import { type Element, type Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import { visit } from "unist-util-visit"

import { minFaviconCount } from "../../components/constants"
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

const TEST_PAGE_SLUG = "Test-page" as FullSlug
const DESIGN_PAGE_SLUG = "design" as FullSlug

/**
 * Finds an element in the HAST tree by its ID attribute.
 * @param root - The root HAST node to search
 * @param id - The ID to search for
 * @returns The element with the matching ID, or null if not found
 */
export const findElementById = (root: Root, id: string): Element | null => {
  let found: Element | null = null
  visit(root, "element", (node) => {
    if (node.properties?.id === id) {
      found = node
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
  visit(root, "element", (node) => {
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
 * Generates content showing the count of npm test files (.test.ts and .test.tsx).
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
 */
const checkCdnSvgs = async (pngPaths: string[]): Promise<void> => {
  await Promise.all(
    pngPaths.map(async (pngPath) => {
      const svgUrl = `https://assets.turntrout.com${pngPath.replace(".png", ".svg")}`
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
}

/**
 * Generates the site's own favicon element.
 */
export const generateSiteFaviconContent = (): ContentGenerator => {
  return async (): Promise<Element[]> => {
    return [createFaviconElement("/static/icon.png")]
  }
}

/**
 * Generates favicon elements based on favicon counts from the build process.
 */
export const generateFaviconContent = (): ContentGenerator => {
  return async (): Promise<Element[]> => {
    const faviconCounts = getFaviconCounts()

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
 */
export const populateElements = async (
  htmlPath: string,
  configs: ElementPopulatorConfig[],
): Promise<FilePath[]> => {
  if (!fs.existsSync(htmlPath)) {
    logger.debug(`HTML file not found at ${htmlPath}, skipping element population`)
    return []
  }

  const html = fs.readFileSync(htmlPath, "utf-8")
  const root = fromHtml(html)
  let modified = false

  for (const config of configs) {
    if (config.id) {
      const element = findElementById(root, config.id)
      if (!element) {
        logger.warn(`No element with id "${config.id}" found in ${htmlPath}`)
        continue
      }

      logger.info(`Populating element #${config.id}`)
      const content = await config.generator()
      element.children = content
      modified = true
      logger.info(`Added ${content.length} elements to #${config.id}`)
    } else if (config.className) {
      const elements = findElementsByClass(root, config.className)
      if (elements.length === 0) {
        logger.warn(`No elements with class "${config.className}" found in ${htmlPath}`)
        continue
      }

      logger.info(`Populating ${elements.length} element(s) with class .${config.className}`)
      const content = await config.generator()
      for (const element of elements) {
        element.children = content
      }
      modified = true
      logger.info(`Added ${content.length} elements to each .${config.className}`)
    } else {
      throw new Error(`Config missing both id and className`)
    }
  }

  if (modified) {
    fs.writeFileSync(htmlPath, toHtml(root), "utf-8")
    return [htmlPath as FilePath]
  }

  return []
}

/**
 * Emitter that populates the containers on the test page after all files have been processed.
 */
export const PopulateContainers: QuartzEmitterPlugin = () => {
  return {
    name: "PopulateContainers",
    getQuartzComponents() {
      return []
    },
    async getDependencyGraph() {
      const DepGraph = (await import("../../depgraph")).default
      return new DepGraph<FilePath>()
    },
    async emit(ctx) {
      const testPagePath = joinSegments(ctx.argv.output, `${TEST_PAGE_SLUG}.html`)

      const testPageFiles = await populateElements(testPagePath, [
        {
          id: "populate-favicon-container",
          generator: generateFaviconContent(),
        },
      ])

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

      return [...testPageFiles, ...designPageFiles]
    },
  }
}
