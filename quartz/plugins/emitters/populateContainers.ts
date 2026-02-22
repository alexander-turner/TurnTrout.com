import { execSync } from "child_process"
import fs from "fs"
import { globby } from "globby"
import { type Element, type Root } from "hast"
import { fromHtml } from "hast-util-from-html"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import { render } from "preact-render-to-string"
import { visit } from "unist-util-visit"

import { simpleConstants, specialFaviconPaths, cdnBaseUrl } from "../../components/constants"
import { renderPostStatistics } from "../../components/ContentMeta"
import { type QuartzComponentProps } from "../../components/types"
import { createWinstonLogger } from "../../util/log"
import { joinSegments, type FilePath } from "../../util/path"
import { getFaviconCounts } from "../transformers/countFavicons"
import {
  createFaviconElement,
  getFaviconUrl,
  transformUrl,
  urlCache,
  shouldIncludeFavicon,
} from "../transformers/favicons"
import { createNowrapSpan, hasClass } from "../transformers/utils"
import { type QuartzEmitterPlugin } from "../types"

const {
  minFaviconCount,
  defaultPath,
  maxCardImageSizeKb,
  playwrightConfigs,
  colorDropcapProbability,
} = simpleConstants

const logger = createWinstonLogger("populateContainers")

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

interface GitCountOptions {
  author?: string
  grep?: string
}

// skipcq: JS-D1001
export async function countGitCommits(options: GitCountOptions = {}): Promise<number> {
  let cmd = "git rev-list --all --count"
  if (options.author) cmd += ` --author="${options.author}"`
  if (options.grep) cmd += ` --grep="${options.grep}"`
  const output = execSync(cmd, { encoding: "utf-8" })
  return parseInt(output.trim(), 10)
}

// skipcq: JS-D1001
export async function countJsTests(): Promise<number> {
  const output = execSync("pnpm test 2>&1 | grep -E 'Tests:.*passed' | tail -1", {
    encoding: "utf-8",
  })
  const match = output.match(/(?<count>\d+)\s+passed/)
  if (!match?.groups) throw new Error("Failed to parse test count from output")
  return parseInt(match.groups.count, 10)
}

// skipcq: JS-D1001
export async function countPlaywrightTests(): Promise<number> {
  const output = execSync('grep -r "test(" quartz/components/tests/*.spec.ts | wc -l', {
    encoding: "utf-8",
  })
  return parseInt(output.trim(), 10)
}

// skipcq: JS-D1001
// Override addopts to avoid requiring plugins (--cov, -n) that may not be installed
export const PYTEST_COUNT_CMD =
  "bash -lc '.venv/bin/pytest --collect-only -q -o addopts=\"\"' 2>&1 | tail -20"

// skipcq: JS-D1001
export async function countPythonTests(): Promise<number> {
  const output = execSync(PYTEST_COUNT_CMD, { encoding: "utf-8" })

  const match = output.match(/(?<count>\d+)\s+tests?\s+collected/)
  if (!match?.groups) {
    throw new Error(`Failed to parse pytest test count from output: ${JSON.stringify(output)}`)
  }

  return parseInt(match.groups.count, 10)
}

// skipcq: JS-D1001
export async function countLinesOfCode(): Promise<number> {
  const output = execSync(
    'find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.css" -o -name "*.scss" \\) ! -path "*/node_modules/*" ! -path "*/.venv/*" ! -path "*/.pytest_cache/*" ! -path "*/.mypy_cache/*" ! -path "*/.ruff_cache/*" ! -path "*/htmlcov/*" ! -path "*/lost-pixel/*" ! -path "*/public/*" -exec wc -l {} + | tail -1 | awk \'{print $1}\'',
    { encoding: "utf-8" },
  )
  return parseInt(output.trim(), 10)
}

export interface RepoStats {
  commitCount: number
  aiCommitCount: number
  jsTestCount: number
  playwrightTestCount: number
  pytestCount: number
  linesOfCode: number
}

// skipcq: JS-D1001
export async function computeRepoStats(): Promise<RepoStats> {
  const [commitCount, aiCommitCount, jsTestCount, playwrightTestCount, pytestCount, linesOfCode] =
    await Promise.all([
      countGitCommits({ author: "Alex Turner" }),
      countGitCommits({ grep: "claude.ai/code/session" }),
      countJsTests(),
      countPlaywrightTests(),
      countPythonTests(),
      countLinesOfCode(),
    ])

  return { commitCount, aiCommitCount, jsTestCount, playwrightTestCount, pytestCount, linesOfCode }
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
      const svgUrl = `${cdnBaseUrl}${pngPath.replace(".png", ".svg")}`
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

// skipcq: JS-D1001
export const generateSpecialFaviconContent = (
  faviconPath: string,
  altText = "",
): ContentGenerator => {
  return async (): Promise<Element[]> => {
    const faviconElement = createFaviconElement(faviconPath, altText)
    return [createNowrapSpan("", faviconElement)]
  }
}

/**
 * Generates a metadata admonition ("About this post" box) with dummy data,
 * using the same component that renders real post metadata.
 */
export const generateMetadataAdmonition = (): ContentGenerator => {
  return async (): Promise<Element[]> => {
    const dummyProps = {
      cfg: {},
      fileData: {
        text: "word ".repeat(1600), // ~8 minutes reading time
        relativePath: "welcome-to-the-pond.md",
        frontmatter: {
          date_published: new Date("2024-10-30"),
          date_updated: "2024-11-12",
        },
      },
    } as unknown as QuartzComponentProps

    const jsx = renderPostStatistics(dummyProps)
    // istanbul ignore next
    if (!jsx) return []

    const html = render(jsx)
    const root = fromHtml(html, { fragment: true })

    // Strip the post-statistics ID to avoid duplicate IDs on the page
    visit(root, "element", (node) => {
      if (node.properties?.id === "post-statistics") {
        delete node.properties.id
      }
    })

    return root.children.filter((c): c is Element => c.type === "element")
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
      .filter((path) => path !== defaultPath && path.endsWith(".png"))
      .filter((path) => !urlCache.has(path) || urlCache.get(path) === defaultPath)

    await checkCdnSvgs(pngPathsToCheck)

    // Process and filter favicons
    const validFavicons = Array.from(faviconCounts.entries())
      .map(([pathWithoutExt, count]) => {
        const pathWithExt = addPngExtension(pathWithoutExt)
        const transformedPath = transformUrl(pathWithExt)
        if (transformedPath === defaultPath) return null

        const url = getFaviconUrl(transformedPath)
        // istanbul ignore if
        if (url === defaultPath) return null

        // Use helper from favicons.ts to check if favicon should be included
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
 * Converts an HTML file path to a slug by removing the .html extension.
 * @param htmlFile - The HTML file path (e.g., "design.html" or "posts/foo.html")
 * @returns The slug (e.g., "design" or "posts/foo")
 */
export function htmlFileToSlug(htmlFile: string): string {
  return htmlFile.replace(/\.html$/, "")
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
  const html = fs.readFileSync(htmlPath, "utf-8")
  const root = fromHtml(html)
  let modified = false

  for (const config of configs) {
    // Validate that config has exactly one of id or className
    if (config.id && config.className) {
      throw new Error("Config cannot have both id and className")
    }

    if (config.id) {
      const element = findElementById(root, config.id)
      if (!element) {
        logger.warn(`No element with id "${config.id}" found in ${htmlPath}`)
        continue
      }

      const content = await config.generator()
      element.children = content
      modified = true
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
      logger.debug(`Added ${content.length} elements to each .${config.className}`)
    } else {
      throw new Error("Config missing both id and className")
    }
  }

  if (modified) {
    fs.writeFileSync(htmlPath, toHtml(root), "utf-8")
    return [htmlPath as FilePath]
  }

  return []
}

/**
 * Creates a mapping of populate IDs/classes to their content generators.
 */
const createPopulatorMap = (
  stats: Awaited<ReturnType<typeof computeRepoStats>>,
): Map<string, ContentGenerator> => {
  return new Map([
    // IDs
    ["populate-metadata-admonition", generateMetadataAdmonition()],
    ["populate-favicon-container", generateFaviconContent()],
    ["populate-favicon-threshold", generateConstantContent(minFaviconCount)],
    ["populate-max-size-card", generateConstantContent(maxCardImageSizeKb)],
    [
      "populate-dropcap-probability",
      generateConstantContent(`${Math.round(colorDropcapProbability * 100)}%`),
    ],
    [
      "populate-turntrout-favicon",
      generateSpecialFaviconContent(specialFaviconPaths.turntrout, "A trout jumping to the left."),
    ],
    [
      "populate-anchor-favicon",
      generateSpecialFaviconContent(specialFaviconPaths.anchor, "A counterclockwise arrow."),
    ],
    // Classes
    ["populate-commit-count", generateConstantContent(stats.commitCount.toLocaleString())],
    [
      "populate-human-commit-count",
      generateConstantContent((stats.commitCount - stats.aiCommitCount).toLocaleString()),
    ],
    ["populate-js-test-count", generateConstantContent(stats.jsTestCount.toLocaleString())],
    [
      "populate-playwright-test-count",
      generateConstantContent(stats.playwrightTestCount.toLocaleString()),
    ],
    ["populate-playwright-configs", generateConstantContent(playwrightConfigs.toLocaleString())],
    [
      "populate-playwright-total-tests",
      generateConstantContent((stats.playwrightTestCount * playwrightConfigs).toLocaleString()),
    ],
    ["populate-pytest-count", generateConstantContent(stats.pytestCount.toLocaleString())],
    ["populate-lines-of-code", generateConstantContent(stats.linesOfCode.toLocaleString())],
  ])
}

/**
 * Scans an HTML file to find all populate-* IDs and classes.
 * Returns separate sets for IDs and classes.
 */
const findPopulateTargets = (htmlPath: string): { ids: Set<string>; classes: Set<string> } => {
  const ids = new Set<string>()
  const classes = new Set<string>()

  if (!fs.existsSync(htmlPath)) {
    return { ids, classes }
  }

  const html = fs.readFileSync(htmlPath, "utf-8")
  const root = fromHtml(html, { fragment: true })

  // Find all elements with populate-* IDs and classes
  visit(root, "element", (node) => {
    const id = node.properties?.id
    if (typeof id === "string" && id.startsWith("populate-")) {
      ids.add(id)
    }

    // Find all elements with populate-* classes
    const classNames = node.properties?.className
    if (Array.isArray(classNames)) {
      for (const cls of classNames) {
        if (typeof cls === "string" && cls.startsWith("populate-")) {
          classes.add(cls)
        }
      }
    }
  })

  return { ids, classes }
}

/**
 * Emitter that populates containers across all HTML files after all files have been processed.
 */
export const PopulateContainers: QuartzEmitterPlugin = () => {
  return {
    name: "PopulateContainers",
    // istanbul ignore next
    getQuartzComponents() {
      return []
    },
    async emit(ctx) {
      const stats = await computeRepoStats()
      const populatorMap = createPopulatorMap(stats)

      const htmlFiles = await globby("**/*.html", {
        cwd: ctx.argv.output,
        absolute: false,
      })

      logger.info(`Scanning ${htmlFiles.length} HTML files for populate-* targets`)

      const modifiedFiles: FilePath[] = []
      for (const htmlFile of htmlFiles) {
        const htmlPath = joinSegments(ctx.argv.output, htmlFile as FilePath)
        const { ids, classes } = findPopulateTargets(htmlPath)

        if (ids.size === 0 && classes.size === 0) {
          continue
        }

        logger.debug(
          `Found ${ids.size} populate IDs and ${classes.size} populate classes in ${htmlFile}`,
        )

        const configs: ElementPopulatorConfig[] = []
        for (const id of ids) {
          const generator = populatorMap.get(id)
          if (!generator) {
            logger.warn(`No generator found for populate ID: ${id}`)
            continue
          }
          configs.push({ id, generator })
        }

        for (const className of classes) {
          const generator = populatorMap.get(className)
          if (!generator) {
            logger.warn(`No generator found for populate class: ${className}`)
            continue
          }
          configs.push({ className, generator })
        }

        if (configs.length > 0) {
          const files = await populateElements(htmlPath, configs)
          modifiedFiles.push(...files)
        }
      }

      logger.info(`Populated ${modifiedFiles.length} HTML files`)
      return modifiedFiles
    },
  }
}
