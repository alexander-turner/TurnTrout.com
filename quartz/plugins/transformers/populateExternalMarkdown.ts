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

  if (!source.jsonPath) return content

  let json: unknown
  try {
    json = JSON.parse(content)
  } catch (err) {
    throw new Error(`Failed to parse JSON from ${source.filePath}: content is not valid JSON`, {
      cause: err,
    })
  }

  let value: unknown = json
  for (const key of source.jsonPath.split(".")) {
    value = (value as Record<string, unknown>)[key]
    if (value === undefined) {
      throw new Error(`JSON path "${source.jsonPath}" not found in ${source.filePath}`)
    }
  }

  // Format as "key": value (without outer braces) for inline display
  const serialized = JSON.stringify(value, null, 2)
  return `"${source.jsonPath}": ${serialized}`
}

/** Removes badge images (e.g. CI/version shields) from the head of a README. */
export function stripBadges(content: string): string {
  return content.replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)\s*/g, "")
}

/**
 * Removes a leading top-level `# Heading` so an embedded README nests under the
 * surrounding page's own section heading instead of introducing a duplicate H1.
 */
export function stripLeadingH1(content: string): string {
  return content.replace(/^\s*#\s+(?:\S.*)?(?:\r?\n)+/, "")
}

/**
 * Replaces relative markdown links with their link text.
 * Relative links (no scheme, no leading # or /) get misclassified as external
 * by CrawlLinks and receive an https:// prefix, producing invalid hrefs.
 */
export function stripRelativeLinks(content: string): string {
  return content.replace(/\[([^\]]+)\]\((?!https?:\/\/|mailto:|#|\/)[^)]+\)/g, "$1")
}

const RELATIVE_LINK_RE = /\[([^\]]+)\]\(((?!https?:\/\/|mailto:|#|\/)[^)]+)\)/g

/**
 * Returns a transform that rewrites relative markdown links to absolute
 * GitHub blob URLs so CrawlLinks doesn't mangle them.
 */
export function rewriteRelativeLinksToGitHub(
  owner: string,
  repo: string,
  ref = "main",
): (content: string) => string {
  const base = `https://github.com/${owner}/${repo}/blob/${ref}`
  return (content) =>
    content.replace(RELATIVE_LINK_RE, (_match, text, href) => `[${text}](${base}/${href})`)
}

/** Class marking a wrapper around embedded external README content. */
export const EXTERNAL_README_CLASS = "external-readme"
/** Attribute holding the source slug used to namespace the README's heading ids. */
export const EXTERNAL_README_SLUG_ATTR = "data-readme-slug"

/**
 * Wraps embedded README markdown in a `div.external-readme` carrying the source
 * slug. rehype-raw re-nests the markdown under the div, so its headings can be
 * id-namespaced (see PrefixExternalReadmeIds) and its prose exempted from the
 * site's content-quality checks, which target first-party authoring. The TOC
 * builder (which runs on the pre-nesting mdast) skips the README's headings by
 * tracking the wrapper's `<div>`/`</div>` boundaries.
 */
export function wrapExternalReadme(content: string, slug: string): string {
  return `<div class="${EXTERNAL_README_CLASS}" ${EXTERNAL_README_SLUG_ATTR}="${slug}">\n\n${content}\n\n</div>`
}

/**
 * Builds a GitHub README source: strips badges, rewrites relative links to
 * absolute blob URLs, optionally drops a leading H1 that would duplicate the
 * embedding page's own section heading, and wraps the result so its heading ids
 * stay unique on the host page.
 */
export function githubReadmeSource(
  owner: string,
  repo: string,
  opts: { stripLeadingH1?: boolean } = {},
): GitHubMarkdownSource {
  const rewriteLinks = rewriteRelativeLinksToGitHub(owner, repo)
  return {
    owner,
    repo,
    transform: (content) => {
      const stripped = opts.stripLeadingH1
        ? stripLeadingH1(stripBadges(content))
        : stripBadges(content)
      return wrapExternalReadme(rewriteLinks(stripped), repo)
    },
  }
}

function getContent(name: string, source: MarkdownSource): string {
  const local = isLocalSource(source)
  const cacheKey = local
    ? `local:${source.filePath}:${source.jsonPath}`
    : `${source.owner}/${source.repo}/${source.ref ?? "main"}/${source.path ?? "README.md"}`

  const cached = contentCache.get(cacheKey)
  if (cached !== undefined) return cached

  const label = local ? source.filePath : `${source.owner}/${source.repo}`

  const content = (() => {
    try {
      return local ? fetchLocalContentSync(source) : fetchGitHubContentSync(source)
    } catch (error) {
      throw new Error(`Failed to fetch content for placeholder "${name}" from ${label}`, {
        cause: error,
      })
    }
  })()

  const transformed = source.transform ? source.transform(content) : content

  contentCache.set(cacheKey, transformed)
  logger.info(`Cached content for "${name}" from ${label}`)

  return transformed
}

/** Builds a regex matching `<span class="populate-markdown-NAME"></span>` placeholders for the given names. */
export function buildPlaceholderRegex(sourceNames: string[]): RegExp | null {
  if (sourceNames.length === 0) return null
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
  if (!regex) return content
  return content.replace(regex, (_match, name: string) => {
    // regex is built from Object.keys(sources), so `name` is always present
    const source = sources[name] as MarkdownSource
    return getContent(name, source)
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
