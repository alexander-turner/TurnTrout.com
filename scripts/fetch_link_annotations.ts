/**
 * Fetches external-link annotations (title + plain-text abstract) for
 * en.wikipedia.org links in website_content/ and writes them to
 * config/link_annotations.json, keyed by canonical URL. The site build never
 * fetches — this runs locally on demand and the manifest is committed.
 *
 * Abstracts come from the Wikipedia REST `/page/summary` endpoint's `extract`
 * field (plain text, never `extract_html`) and are converted to HTML via hast
 * text nodes, so the emitted `abstract_html` is escaped by construction.
 *
 * Usage: npx tsx scripts/fetch_link_annotations.ts [--check] [--force] [--max-age-days=N]
 *   --check           exit non-zero listing URLs missing an annotation; no writes
 *   --force           refetch every URL, overwriting existing entries
 *   --max-age-days=N  also refetch entries retrieved more than N days ago
 */
import { toHtml } from "hast-util-to-html"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import pRetry from "p-retry"

import { type LinkAnnotation, validateLinkAnnotations } from "../quartz/util/annotations"
import { canonicalizeUrl } from "../quartz/util/urls"

const CONTENT_DIR = "website_content"
const OUTPUT_PATH = "config/link_annotations.json"
const MAX_ABSTRACT_CHARS = 1200
const REQUEST_DELAY_MS = 1000
const USER_AGENT =
  "TurnTrout.com link-annotations fetcher (https://turntrout.com; single low-rate batch run)"

export const WIKIPEDIA_ATTRIBUTION = {
  text: "Wikipedia",
  license: "CC BY-SA 4.0",
  license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
} as const

// Square brackets, quotes, and angle brackets end a URL in Markdown; parens
// are allowed because wiki titles contain them ("Foo_(bar)") — unbalanced
// trailing ")" is stripped afterwards.
const WIKI_URL_REGEX = /https?:\/\/en\.wikipedia\.org\/wiki\/[^\s<>"'[\]{}]+/g
const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", "`", "*"])

function countChar(text: string, char: string): number {
  return text.split(char).length - 1
}

/** Strips Markdown context (closing parens, trailing punctuation) off a URL match. */
export function trimUrlMatch(raw: string): string {
  let url = raw
  for (;;) {
    const last = url[url.length - 1]
    if (TRAILING_PUNCTUATION.has(last)) {
      url = url.slice(0, -1)
    } else if (last === ")" && countChar(url, ")") > countChar(url, "(")) {
      url = url.slice(0, -1)
    } else {
      return url
    }
  }
}

export function extractWikipediaUrls(markdown: string): string[] {
  return [...markdown.matchAll(WIKI_URL_REGEX)].map((match) => trimUrlMatch(match[0]))
}

/** All canonical en.wikipedia.org/wiki/ URLs in the content directory, sorted. */
export function collectCanonicalUrls(contentDir: string): string[] {
  const canonical = new Set<string>()
  const files = readdirSync(contentDir, { recursive: true, encoding: "utf-8" })
  for (const file of files) {
    if (!file.endsWith(".md")) continue
    const markdown = readFileSync(join(contentDir, file), "utf-8")
    for (const url of extractWikipediaUrls(markdown)) {
      // The regex fixes the host, so every match parses; a throw here is a bug.
      canonical.add(canonicalizeUrl(url))
    }
  }
  return [...canonical].sort()
}

/**
 * Truncates to `maxChars`, preferring a sentence boundary (kept verbatim) and
 * falling back to a word boundary plus a single-character ellipsis.
 */
export function truncateAtSentence(text: string, maxChars: number = MAX_ABSTRACT_CHARS): string {
  if (text.length <= maxChars) return text
  const head = text.slice(0, maxChars)
  const sentenceEnd = Math.max(
    head.lastIndexOf(". "),
    head.lastIndexOf("! "),
    head.lastIndexOf("? "),
  )
  if (sentenceEnd > 0) return head.slice(0, sentenceEnd + 1)
  const lastSpace = head.lastIndexOf(" ")
  return `${lastSpace > 0 ? head.slice(0, lastSpace) : head}…`
}

/** Escape-by-construction: plain text becomes a hast text node inside `<p>`. */
export function abstractHtmlFromText(text: string): string {
  return toHtml({
    type: "element",
    tagName: "p",
    properties: {},
    children: [{ type: "text", value: text }],
  })
}

export function wikipediaSummaryUrl(canonicalUrl: string): string {
  // Slashes in a title (e.g. /wiki/AC/DC) would read as extra path segments;
  // the REST API expects them encoded as %2F.
  const title = new URL(canonicalUrl).pathname.slice("/wiki/".length).replaceAll("/", "%2F")
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`
}

export interface FetchDeps {
  fetchImpl: typeof fetch
  sleep(ms: number): Promise<void>
  log(message: string): void
  /** ISO date (YYYY-MM-DD) stamped into `retrieved`. */
  today(): string
  contentDir: string
  outputPath: string
  retries: number
  retryMinTimeoutMs: number
}

/* istanbul ignore next -- real network/clock/log deps are exercised only via the CLI */
export const defaultDeps: FetchDeps = {
  fetchImpl: fetch,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log: console.log,
  today: () => new Date().toISOString().slice(0, 10),
  contentDir: CONTENT_DIR,
  outputPath: OUTPUT_PATH,
  retries: 3,
  retryMinTimeoutMs: 1000,
}

/**
 * Fetches one annotation. Returns null when Wikipedia has no summary for the
 * page (404 or empty extract); throws on persistent transport/server errors.
 */
export async function fetchAnnotation(
  canonicalUrl: string,
  deps: FetchDeps,
): Promise<LinkAnnotation | null> {
  const summaryUrl = wikipediaSummaryUrl(canonicalUrl)
  const response = await pRetry(
    async () => {
      const res = await deps.fetchImpl(summaryUrl, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      })
      // 404 = no such page/summary: a permanent answer, not a retryable failure
      if (res.status === 404) return res
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${summaryUrl}`)
      return res
    },
    { retries: deps.retries, minTimeout: deps.retryMinTimeoutMs },
  )
  if (response.status === 404) {
    deps.log(`No Wikipedia summary for ${canonicalUrl}; skipping`)
    return null
  }

  const summary = (await response.json()) as { title?: string; extract?: string }
  if (!summary.title || !summary.extract) {
    deps.log(`Empty Wikipedia extract for ${canonicalUrl}; skipping`)
    return null
  }
  return {
    source: "wikipedia",
    title: summary.title,
    abstract_html: abstractHtmlFromText(truncateAtSentence(summary.extract)),
    attribution: { ...WIKIPEDIA_ATTRIBUTION },
    retrieved: deps.today(),
  }
}

export interface CliOptions {
  check: boolean
  force: boolean
  maxAgeDays: number | null
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = { check: false, force: false, maxAgeDays: null }
  for (const arg of argv) {
    if (arg === "--check") {
      options.check = true
    } else if (arg === "--force") {
      options.force = true
    } else if (arg.startsWith("--max-age-days=")) {
      const days = Number(arg.slice("--max-age-days=".length))
      if (!Number.isFinite(days) || days < 0) {
        throw new Error(`Invalid --max-age-days value: ${arg}`)
      }
      options.maxAgeDays = days
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

export function isStale(retrieved: string, maxAgeDays: number | null, todayIso: string): boolean {
  if (maxAgeDays === null) return false
  const ageMs = new Date(todayIso).getTime() - new Date(retrieved).getTime()
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000
}

function loadExisting(outputPath: string): Map<string, LinkAnnotation> {
  if (!existsSync(outputPath)) return new Map()
  return validateLinkAnnotations(JSON.parse(readFileSync(outputPath, "utf-8")), outputPath)
}

export async function main(argv: readonly string[], deps: FetchDeps): Promise<number> {
  const options = parseArgs(argv)
  const urls = collectCanonicalUrls(deps.contentDir)
  const existing = loadExisting(deps.outputPath)

  const needed = urls.filter((url) => {
    if (options.force) return true
    const entry = existing.get(url)
    if (!entry) return true
    return isStale(entry.retrieved, options.maxAgeDays, deps.today())
  })

  if (options.check) {
    for (const url of needed) {
      deps.log(`Missing or stale annotation: ${url}`)
    }
    deps.log(`${needed.length} of ${urls.length} URLs need annotations`)
    return needed.length === 0 ? 0 : 1
  }

  const merged = new Map(existing)
  for (const [index, url] of needed.entries()) {
    if (index > 0) {
      await deps.sleep(REQUEST_DELAY_MS)
    }
    deps.log(`[${index + 1}/${needed.length}] ${url}`)
    const annotation = await fetchAnnotation(url, deps)
    if (annotation) {
      merged.set(url, annotation)
    }
  }

  const sorted = Object.fromEntries([...merged.entries()].sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(deps.outputPath, `${JSON.stringify(sorted, null, 2)}\n`)
  deps.log(`Wrote ${Object.keys(sorted).length} annotations to ${deps.outputPath}`)
  return 0
}

// istanbul ignore next - CLI entrypoint
if (process.argv[1]?.endsWith("fetch_link_annotations.ts")) {
  main(process.argv.slice(2), defaultDeps)
    .then((code) => {
      process.exitCode = code
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
}
