/**
 * Transformer plugin that populates external markdown content at build time.
 * Supports fetching README files from GitHub repositories and reading local files.
 */

import { execFileSync } from "child_process"
import { readFileSync } from "fs"

import type { QuartzTransformerPlugin } from "../types"

import { createWinstonLogger } from "../../util/log"

const logger = createWinstonLogger("populateExternalMarkdown")

/**
 * Configuration for GitHub markdown sources.
 */
export interface GitHubMarkdownSource {
  owner: string
  repo: string
  /** Optional branch/ref to fetch from. Defaults to "main". */
  ref?: string
  /** Optional path to the file. Defaults to "README.md". */
  path?: string
  /** Optional function to transform the fetched content before injection. */
  transform?: (content: string) => string
}

/**
 * Configuration for local file markdown sources.
 */
export interface LocalMarkdownSource {
  /** Path to the local file (relative to project root or absolute). */
  filePath: string
  /** Dot-separated path to extract a subsection from a JSON file. */
  jsonPath?: string
  /** Optional function to transform the content before injection. */
  transform?: (content: string) => string
}

export type MarkdownSource = GitHubMarkdownSource | LocalMarkdownSource

export interface PopulateExternalMarkdownOptions {
  /** Map of placeholder names to their sources. */
  sources: Record<string, MarkdownSource>
}

// Cache for fetched content to avoid refetching for each file
const contentCache = new Map<string, string>()

/**
 * Type for the fetch function used to retrieve content.
 * Can be overridden for testing.
 */
export type FetchFunction = (url: string) => string
export type ReadFileFunction = (filePath: string) => string

/**
 * Default fetch implementation using curl.
 */
// istanbul ignore next - Integration functionality tested via dependency injection
export const defaultFetchFunction: FetchFunction = (url: string): string => {
  const output = execFileSync("curl", ["-sf", url], {
    encoding: "utf-8",
    timeout: 30000, // 30 second timeout
  })
  return output
}

// istanbul ignore next - Integration functionality tested via dependency injection
export const defaultReadFileFunction: ReadFileFunction = (filePath: string): string => {
  return readFileSync(filePath, "utf-8")
}

// Functions used by the module - can be replaced for testing
let fetchFunction: FetchFunction = defaultFetchFunction
let readFileFunction: ReadFileFunction = defaultReadFileFunction

/**
 * Sets the fetch function used by the module. Useful for testing.
 */
export function setFetchFunction(fn: FetchFunction): void {
  fetchFunction = fn
}

/**
 * Sets the read file function used by the module. Useful for testing.
 */
export function setReadFileFunction(fn: ReadFileFunction): void {
  readFileFunction = fn
}

/**
 * Resets the fetch function to the default implementation.
 */
export function resetFetchFunction(): void {
  fetchFunction = defaultFetchFunction
}

/**
 * Resets the read file function to the default implementation.
 */
export function resetReadFileFunction(): void {
  readFileFunction = defaultReadFileFunction
}

// skipcq: JS-D1001
export function isLocalSource(source: MarkdownSource): source is LocalMarkdownSource {
  return "filePath" in source
}

// skipcq: JS-D1001
export function fetchGitHubContentSync(source: GitHubMarkdownSource): string {
  const ref = source.ref ?? "main"
  const filePath = source.path ?? "README.md"
  const url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${ref}/${filePath}`

  logger.debug(`Fetching ${url}`)
  return fetchFunction(url)
}

// skipcq: JS-D1001
export function fetchLocalContentSync(source: LocalMarkdownSource): string {
  const content = readFileFunction(source.filePath)

  if (source.jsonPath) {
    const json = JSON.parse(content) as Record<string, unknown>
    const keys = source.jsonPath.split(".")
    let value: unknown = json
    for (const key of keys) {
      value = (value as Record<string, unknown>)[key]
      if (value === undefined) {
        throw new Error(`JSON path "${source.jsonPath}" not found in ${source.filePath}`)
      }
    }
    // Format as "key": value (without outer braces) for inline display
    const serialized = JSON.stringify(value, null, 2)
    return `"${source.jsonPath}": ${serialized}`
  }

  return content
}

// skipcq: JS-D1001
export function stripBadges(content: string): string {
  return content.replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)\s*/g, "")
}

function getContent(name: string, source: MarkdownSource): string {
  const local = isLocalSource(source)
  const cacheKey = local
    ? `local:${source.filePath}:${source.jsonPath ?? ""}`
    : `${source.owner}/${source.repo}/${source.ref ?? "main"}/${source.path ?? "README.md"}`
  const cached = contentCache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  let content = local ? fetchLocalContentSync(source) : fetchGitHubContentSync(source)
  if (source.transform) {
    content = source.transform(content)
  }

  contentCache.set(cacheKey, content)
  const label = local ? source.filePath : `${source.owner}/${source.repo}`
  logger.info(`Cached content for "${name}" from ${label}`)

  return content
}

// skipcq: JS-D1001
export function buildPlaceholderRegex(sourceNames: string[]): RegExp {
  if (sourceNames.length === 0) return /(?!)/g // never matches
  const escaped = sourceNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  return new RegExp(
    `<span\\s+class="populate-markdown-(${escaped.join("|")})"\\s*>(?:<\\/span>)?`,
    "g",
  )
}

// skipcq: JS-D1001
export function populateExternalContent(
  content: string,
  sources: Record<string, MarkdownSource>,
): string {
  const regex = buildPlaceholderRegex(Object.keys(sources))
  return content.replace(regex, (_match, name: string) => {
    return getContent(name, sources[name])
  })
}

// skipcq: JS-D1001
export function clearContentCache(): void {
  contentCache.clear()
}

// skipcq: JS-D1001
export const PopulateExternalMarkdown: QuartzTransformerPlugin<PopulateExternalMarkdownOptions> = (
  opts,
) => {
  const sources = opts?.sources ?? {}

  return {
    name: "populateExternalMarkdown",
    textTransform(_ctx, src: string | Buffer) {
      const content = typeof src === "string" ? src : src.toString()

      // Quick check: if no placeholders, skip processing
      if (!content.includes("populate-markdown-")) {
        return content
      }

      return populateExternalContent(content, sources)
    },
  }
}
