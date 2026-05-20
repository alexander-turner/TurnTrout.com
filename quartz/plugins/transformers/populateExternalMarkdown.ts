/**
 * Transformer plugin that populates external markdown content at build time.
 * Supports fetching README files from GitHub repositories and reading local files.
 */

import childProcess from "child_process"
import escapeStringRegexp from "escape-string-regexp"
import fs from "fs"

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

const contentCache = new Map<string, string>()

/** Type guard: true if the source is a local-file source rather than a GitHub source. */
export function isLocalSource(source: MarkdownSource): source is LocalMarkdownSource {
  return "filePath" in source
}

/** Fetches the raw contents of a file from GitHub via curl. */
export function fetchGitHubContentSync(source: GitHubMarkdownSource): string {
  const ref = source.ref ?? "main"
  const filePath = source.path ?? "README.md"
  const url = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${ref}/${filePath}`

  logger.debug(`Fetching ${url}`)
  return childProcess.execFileSync("curl", ["-sf", url], {
    encoding: "utf-8",
    timeout: 30000,
  })
}

/** Reads a local file; if `jsonPath` is set, extracts a nested JSON value as a `"key": value` snippet. */
export function fetchLocalContentSync(source: LocalMarkdownSource): string {
  const content = fs.readFileSync(source.filePath, "utf-8")

  if (source.jsonPath) {
    let json: Record<string, unknown>
    try {
      json = JSON.parse(content) as Record<string, unknown>
    } catch (err) {
      throw new Error(`Failed to parse JSON from ${source.filePath}: content is not valid JSON`, {
        cause: err,
      })
    }
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

/** Removes badge images (e.g. CI/version shields) from the head of a README. */
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

  let content: string
  const label = local ? source.filePath : `${source.owner}/${source.repo}`
  try {
    content = local ? fetchLocalContentSync(source) : fetchGitHubContentSync(source)
  } catch (error) {
    throw new Error(`Failed to fetch content for placeholder "${name}" from ${label}`, {
      cause: error,
    })
  }
  if (source.transform) {
    content = source.transform(content)
  }

  contentCache.set(cacheKey, content)
  logger.info(`Cached content for "${name}" from ${label}`)

  return content
}

/** Builds a regex matching `<span class="populate-markdown-NAME"></span>` placeholders for the given names. */
export function buildPlaceholderRegex(sourceNames: string[]): RegExp {
  if (sourceNames.length === 0) return /(?!)/g // never matches
  const escaped = sourceNames.map(escapeStringRegexp)
  return new RegExp(
    `<span\\s+class="populate-markdown-(${escaped.join("|")})"\\s*>(?:<\\/span>)?`,
    "g",
  )
}

/** Replaces placeholder spans in `content` with fetched markdown from the matching source. */
export function populateExternalContent(
  content: string,
  sources: Record<string, MarkdownSource>,
): string {
  const regex = buildPlaceholderRegex(Object.keys(sources))
  return content.replace(regex, (_match, name: string) => {
    return getContent(name, sources[name])
  })
}

/** Clears the in-memory content cache. Tests call this between runs to avoid leakage. */
export function clearContentCache(): void {
  contentCache.clear()
}

/** Quartz transformer that substitutes `populate-markdown-*` placeholder spans with fetched content. */
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
