import fs from "fs"
import { globby } from "globby"
import { type Element, type Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import { visit } from "unist-util-visit"

import {
  minFaviconCount,
  faviconCountWhitelist,
  specialFaviconPaths,
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
  ...Object.values(specialFaviconPaths),
  ...faviconCountWhitelist,
  ...googleSubdomainWhitelist.map((subdomain) => `${subdomain.replaceAll(".", "_")}_google_com`),
]

const logger = createWinstonLogger("populateContainers")

const TEST_PAGE_SLUG = "Test-page" as FullSlug

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
 * Generates favicon elements based on favicon counts from the build process.
 */
export const generateFaviconContent = (): ContentGenerator => {
  return async (): Promise<Element[]> => {
    const faviconCounts = getFaviconCounts()

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
    const validFavicons = Array.from(faviconCounts.entries())
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

    // Create a three-column table: Lowercase | Punctuation | Right-skewed
    const tableRows: Element[] = [
      h("tr", [h("th", "Lowercase"), h("th", "Punctuation"), h("th", "Right-skewed")]),
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

    return [h("table", tableRows)]
  }
}

/**
 * Configuration for populating an element by ID with generated content.
 */
export interface ElementPopulatorConfig {
  /** The ID of the element to populate */
  id: string
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

      return await populateElements(testPagePath, [
        {
          id: "favicon-container",
          generator: generateFaviconContent(),
        },
      ])
    },
  }
}
