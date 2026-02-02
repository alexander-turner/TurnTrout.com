/**
 * Transformer plugin that populates external markdown content at build time.
 * Supports fetching README files from GitHub repositories.
 */

import { execSync } from "child_process"

import type { QuartzTransformerPlugin } from "../types"

import { createWinstonLogger } from "../../util/log"

const logger = createWinstonLogger("populateExternalMarkdown")

/**
 * Configuration for external markdown sources.
 * Maps placeholder names to their GitHub repository URLs.
 */
export interface ExternalMarkdownSource {
  owner: string
  repo: string
  /** Optional branch/ref to fetch from. Defaults to "main". */
  ref?: string
  /** Optional path to the file. Defaults to "README.md". */
  path?: string
  /** Optional function to transform the fetched content before injection. */
  transform?: (content: string) => string
}

export interface PopulateExternalMarkdownOptions {
  /** Map of placeholder names to their sources. */
  sources: Record<string, ExternalMarkdownSource>
}

// Cache for fetched content to avoid refetching for each file
const contentCache = new Map<string, string>()

/**
 * Type for the fetch function used to retrieve content.
 * Can be overridden for testing.
 */
export type FetchFunction = (url: string) => string

/**
 * Default fetch implementation using curl.
 */
// istanbul ignore next - Integration functionality tested via dependency injection
export const defaultFetchFunction: FetchFunction = (url: string): string => {
  const output = execSync(`curl -sf "${url}"`, {
    encoding: "utf-8",
    timeout: 30000, // 30 second timeout
  })
  return output
}

// Fetch function used by the module - can be replaced for testing
let fetchFunction: FetchFunction = defaultFetchFunction

/**
 * Sets the fetch function used by the module. Useful for testing.
 */
export function setFetchFunction(fn: FetchFunction): void {
  fetchFunction = fn
}

/**
 * Resets the fetch function to the default implementation.
 */
export function resetFetchFunction(): void {
  fetchFunction = defaultFetchFunction
}

/**
 * Fetches raw content from a GitHub repository synchronously.
 */
export function fetchGitHubContentSync(source: ExternalMarkdownSource): string {
  const ref = source.ref ?? "main"
  const filePath = source.path ?? "README.md"
  const url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${ref}/${filePath}`

  logger.debug(`Fetching ${url}`)

  try {
    return fetchFunction(url)
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${(error as Error).message}`)
  }
}

/**
 * Strips GitHub badge images from markdown content.
 * Badges are typically in the format: [![Alt](image-url)](link-url)
 */
export function stripBadges(content: string): string {
  // Match badge patterns: [![...](...)(...) or [![...](image)]
  // These are typically at the start of README files
  return content.replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)\s*/g, "")
}

/**
 * Converts height-style prime marks (e.g., 5'10") to proper Unicode primes.
 * Only converts patterns that look like measurements (number + quote + number + double-quote).
 * Does not convert content inside backticks (code spans).
 */
export function convertPrimeMarks(content: string): string {
  // Split by backticks to preserve code spans
  const parts = content.split(/(`[^`]+`)/g)

  return parts
    .map((part, index) => {
      // Odd indices are code spans, skip them
      if (index % 2 === 1) {
        return part
      }
      // Convert measurement patterns like 5'10" to 5′10″
      // Using Unicode: ′ (U+2032) for feet, ″ (U+2033) for inches
      return part.replace(/(\d+)'(\d+)"/g, "$1\u2032$2\u2033")
    })
    .join("")
}

/**
 * Creates a composed transform function for punctilio README content.
 * Applies: stripBadges and prime mark conversion.
 */
export function createPunctilioTransform(): (content: string) => string {
  return (content: string): string => {
    let result = stripBadges(content)
    result = convertPrimeMarks(result)
    return result
  }
}

/**
 * Gets or fetches content for a given source, using cache when available.
 */
function getContent(name: string, source: ExternalMarkdownSource): string {
  const cacheKey = `${source.owner}/${source.repo}/${source.ref ?? "main"}/${source.path ?? "README.md"}`

  if (contentCache.has(cacheKey)) {
    return contentCache.get(cacheKey)!
  }

  let content = fetchGitHubContentSync(source)

  // Apply transformation if provided
  if (source.transform) {
    content = source.transform(content)
  }

  contentCache.set(cacheKey, content)
  logger.info(`Fetched and cached content for "${name}" from ${source.owner}/${source.repo}`)

  return content
}

/**
 * Regular expression to match populate-readme placeholders.
 * Format: <span class="populate-NAME-readme"></span>
 * Matches self-closing spans and spans with empty content.
 */
const placeholderRegex = /<span\s+class="populate-(?<name>[\w-]+)-readme"\s*>(?:<\/span>)?/g

/**
 * Populates external markdown content into the source.
 * Throws errors if placeholders are missing sources or if fetching fails.
 */
export function populateExternalContent(
  content: string,
  sources: Record<string, ExternalMarkdownSource>,
): string {
  return content.replace(placeholderRegex, (_match, name: string) => {
    const source = sources[name]
    if (!source) {
      throw new Error(`No source configured for placeholder "${name}"`)
    }
    return getContent(name, source)
  })
}

/**
 * Clears the content cache. Useful for testing.
 */
export function clearContentCache(): void {
  contentCache.clear()
}

/**
 * Quartz transformer plugin for populating external markdown content.
 */
export const PopulateExternalMarkdown: QuartzTransformerPlugin<PopulateExternalMarkdownOptions> = (
  opts,
) => {
  const sources = opts?.sources ?? {}

  return {
    name: "populateExternalMarkdown",
    textTransform(_ctx, src: string | Buffer) {
      const content = typeof src === "string" ? src : src.toString()

      // Quick check: if no placeholders, skip processing
      if (!content.includes("-readme")) {
        return content
      }

      return populateExternalContent(content, sources)
    },
  }
}
