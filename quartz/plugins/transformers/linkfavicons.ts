import type { Element, Root, Text, Parent } from "hast"
import type { ReadableStream } from "stream/web"

import gitRoot from "find-git-root"
import fs from "fs"
import mime from "mime-types"
import path from "path"
import * as psl from "psl"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

import {
  specialFaviconPaths,
  minFaviconCount,
  googleSubdomainWhitelist,
  faviconCountWhitelist,
  faviconSubstringBlacklist,
} from "../../components/constants"
import { createWinstonLogger } from "./logger_utils"
import { hasClass } from "./utils"

const logger = createWinstonLogger("linkfavicons")

const QUARTZ_FOLDER = "quartz"
const FAVICON_FOLDER = "static/images/external-favicons"
export const DEFAULT_PATH = ""

const __filepath = fileURLToPath(import.meta.url)
const __dirname = path.dirname(gitRoot(__filepath))
export const FAVICON_URLS_FILE = path.join(
  __dirname,
  "quartz",
  "plugins",
  "transformers",
  ".faviconUrls.txt",
)
export const FAVICON_COUNTS_FILE = path.join(
  __dirname,
  "quartz",
  "plugins",
  "transformers",
  ".faviconCounts.txt",
)

/**
 * Whitelist of favicon paths that should always be included regardless of count. Often widely recognizable.
 * These favicons will be added even if they appear fewer than minFaviconCount times.
 * Entries can be full paths or substrings (e.g., "apple_com" will match any path containing "apple_com").
 */
const FAVICON_COUNT_WHITELIST = [
  ...Object.values(specialFaviconPaths),
  ...faviconCountWhitelist,
  ...googleSubdomainWhitelist.map((subdomain) => `${subdomain.replaceAll(".", "_")}_google_com`),
]

// istanbul ignore if
if (!fs.existsSync(FAVICON_URLS_FILE)) {
  try {
    fs.writeFileSync(FAVICON_URLS_FILE, "")
  } catch {
    throw new Error(
      `Favicon URL cache file not found at path ${FAVICON_URLS_FILE}; create it with \`touch\` if that's the right path.`,
    )
  }
}

// skipcq: JS-D1001
export class DownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DownloadError"
  }
}

/**
 * Downloads an image from a given URL and saves it to the specified local path.
 *
 * Performs several validations:
 * 1. Checks if the HTTP response is successful
 * 2. Verifies the content type is an image
 * 3. Ensures the file is not empty
 * 4. Creates the target directory if needed
 * 5. Validates the downloaded file size
 *
 * @throws DownloadError if any validation fails or download/save errors occur
 * @param url - The URL of the image to download
 * @param imagePath - The local file path where the image should be saved
 * @returns Promise<boolean> - True if download and save successful
 */
export async function downloadImage(url: string, imagePath: string): Promise<boolean> {
  logger.info(`Attempting to download image from ${url} to ${imagePath}`)
  const response = await fetch(url)

  if (!response.ok) {
    throw new DownloadError(`Failed to fetch image: ${url}. Status: ${response.status}`)
  }

  const contentType = response.headers.get("content-type")
  // Accept image/* (including image/svg+xml)
  if (!contentType || !contentType.startsWith("image/")) {
    throw new DownloadError(`URL does not point to an image: ${url}. Content-Type: ${contentType}`)
  }

  const contentLength = response.headers.get("content-length")
  if (contentLength && parseInt(contentLength, 10) === 0) {
    throw new DownloadError(`Empty image file: ${url}`)
  }

  if (!response.body) {
    throw new DownloadError(`No response body: ${url}`)
  }

  const body = Readable.fromWeb(response.body as ReadableStream)

  try {
    // Create the directory if it doesn't exist
    await fs.promises.mkdir(path.dirname(imagePath), { recursive: true })
    await pipeline(body, fs.createWriteStream(imagePath))
  } catch (err) {
    throw new DownloadError(`Failed to write image to ${imagePath}: ${err}`)
  }

  const stats = await fs.promises.stat(imagePath)

  if (stats.size === 0) {
    await fs.promises.unlink(imagePath)
    throw new DownloadError(`Downloaded file is empty: ${imagePath}`)
  }

  logger.info(`Successfully downloaded image to ${imagePath}`)
  return true
}

/**
 * Special hostname mappings that deviate from simple subdomain removal.
 * These map one domain to a different canonical domain, or preserve specific subdomains.
 */
const SPECIAL_DOMAIN_MAPPINGS: Array<{ pattern: RegExp; to: string }> = [
  // Preserve whitelisted Google subdomains (map to themselves)
  ...googleSubdomainWhitelist.map((subdomain) => ({
    pattern: new RegExp(`^${subdomain.replace(".", "\\.")}\\.google\\.com$`),
    to: `${subdomain}.google.com`,
  })),
  // Cross-domain mappings
  { pattern: /^.*transformer-circuits\.pub/, to: "anthropic.com" },
  { pattern: /^.*protonvpn\.com/, to: "proton.me" },
  { pattern: /^.*nbc.*\.com$/, to: "msnbc.com" },
  { pattern: /^.*nips\.cc$/, to: "neurips.cc" },
]

/**
 * Normalizes a hostname by removing subdomains and extracting the root domain.
 * Converts subdomains like "blog.openai.com" to their root domain "openai.com".
 * Properly handles multi-part TLDs like "co.uk" (e.g., "blog.example.co.uk" -> "example.co.uk").
 *
 * Special cases:
 * - Applies cross-domain mappings (e.g., transformer-circuits.pub -> anthropic.com)
 * - Preserves whitelisted Google subdomains (scholar.google.com, play.google.com, etc.)
 * - Preserves all StackExchange subdomains (math.stackexchange.com, gaming.stackexchange.com, etc.)
 *
 * @param hostname - The hostname to normalize
 * @returns The root domain or mapped domain, or the original hostname if parsing fails
 */
function normalizeHostname(hostname: string): string {
  // Preserve StackExchange subdomains
  if (/^[^.]+\.stackexchange\.com$/.test(hostname)) {
    return hostname
  }

  for (const mapping of SPECIAL_DOMAIN_MAPPINGS) {
    if (mapping.pattern.test(hostname)) {
      return mapping.to
    }
  }

  // Use psl library to extract root domain (handles multi-part TLDs correctly)
  const parsed = psl.parse(hostname)
  // Return the registered domain if valid, otherwise return original hostname
  if ("error" in parsed || !parsed.domain) {
    return hostname
  }
  return parsed.domain
}

/**
 * Normalizes a favicon path for counting by removing format-specific extensions.
 * Counts are format-agnostic (domain-based), so we store paths without extensions.
 *
 * @param faviconPath - Path with extension (e.g., "/static/images/external-favicons/example_com.png")
 * @returns Path without extension (e.g., "/static/images/external-favicons/example_com")
 */
export function normalizePathForCounting(faviconPath: string): string {
  // Special paths (mail, anchor, turntrout) are full URLs, return as-is
  if (faviconPath.startsWith("http")) {
    return faviconPath
  }
  // Special paths like mail.svg and anchor.svg should be preserved as-is
  if (faviconPath.match(/\.(svg|ico)$/)) {
    return faviconPath
  }
  // Remove .png, .svg, .avif extensions for counting (domain-based paths)
  return faviconPath.replace(/\.(png|svg|avif)$/, "")
}

/**
 * Generates a standardized path for storing favicons in the Quartz system.
 *
 * Handles special cases:
 * - Converts localhost to turntrout.com
 * - Removes www. prefix from domains
 * - Normalizes subdomains (e.g., blog.openai.com -> openai.com)
 * - Uses special path for turntrout.com domain
 * - Converts dots to underscores for filesystem compatibility
 *
 * @param hostname - Domain name to generate path for (e.g. "example.com")
 * @returns Formatted path string (e.g. "/static/images/external-favicons/example_com.png")
 */
export function getQuartzPath(hostname: string): string {
  logger.debug(`Generating Quartz path for hostname: ${hostname}`)
  hostname = hostname === "localhost" ? "turntrout.com" : hostname.replace(/^www\./, "")
  hostname = normalizeHostname(hostname)
  const sanitizedHostname = hostname.replace(/\./g, "_")
  const path = sanitizedHostname.includes("turntrout_com")
    ? specialFaviconPaths.turntrout
    : `/${FAVICON_FOLDER}/${sanitizedHostname}.png`
  logger.debug(`Generated Quartz path: ${path}`)
  return path
}

const defaultCache = new Map<string, string>([
  [specialFaviconPaths.turntrout, specialFaviconPaths.turntrout],
])
// skipcq: JS-D1001
export function createUrlCache(): Map<string, string> {
  return new Map(defaultCache)
}
export const urlCache = createUrlCache()
const faviconUrls = await readFaviconUrls()
// istanbul ignore next
for (const [basename, url] of faviconUrls) {
  if (!urlCache.has(basename)) {
    urlCache.set(basename, url)
  }
}

/**
 * Writes the favicon cache to the FAVICON_URLS_FILE.
 */
export function writeCacheToFile(): void {
  const data = Array.from(urlCache.entries())
    .map(([key, value]) => `${key},${value}`)
    .join("\n")

  fs.writeFileSync(FAVICON_URLS_FILE, data, { flag: "w+" })
}

/**
 * Reads favicon counts from the FAVICON_COUNTS_FILE and returns them as a Map.
 *
 * @returns A Map of favicon path to count, or empty Map if file doesn't exist or can't be read.
 */
export function readFaviconCounts(): Map<string, number> {
  if (!fs.existsSync(FAVICON_COUNTS_FILE)) {
    logger.warn(`Favicon counts file not found at ${FAVICON_COUNTS_FILE}`)
    return new Map<string, number>()
  }

  const data = fs.readFileSync(FAVICON_COUNTS_FILE, "utf8")
  const lines = data.split("\n")
  const countMap = new Map<string, number>()

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split("\t")
    if (parts.length >= 2) {
      const count = parseInt(parts[0], 10)
      const faviconPath = parts[1]
      if (!isNaN(count) && faviconPath) {
        countMap.set(faviconPath, count)
      }
    }
  }

  return countMap
}

/**
 * Reads favicon URLs from the FAVICON_URLS_FILE and returns them as a Map.
 *
 * @returns A Promise that resolves to a Map of basename to URL strings.
 */
export async function readFaviconUrls(): Promise<Map<string, string>> {
  try {
    const data = await fs.promises.readFile(FAVICON_URLS_FILE, "utf8")
    const lines = data.split("\n")
    const urlMap = new Map<string, string>()
    for (const line of lines) {
      const [basename, url] = line.split(",")
      if (basename && url) {
        urlMap.set(basename, url)
      }
    }
    return urlMap
  } catch (error) {
    logger.warn(`Error reading favicon URLs file: ${error}`)
    console.warn(error)
    return new Map<string, string>()
  }
}

/**
 * Constructs a CDN URL from a favicon path.
 * For PNG files, checks for SVG version first (preferred), then converts to AVIF format.
 * For SVG files, returns as-is.
 *
 * @param faviconPath - Path to favicon (e.g., "/static/images/external-favicons/example_com.png" or ".svg")
 * @returns Full CDN URL (e.g., "https://assets.turntrout.com/static/images/external-favicons/example_com.svg" or ".avif")
 */
export function getFaviconUrl(faviconPath: string): string {
  if (faviconPath.startsWith("http")) {
    return faviconPath
  }
  // SVG files don't need conversion, serve directly
  if (faviconPath.endsWith(".svg")) {
    return `https://assets.turntrout.com${faviconPath}`
  }

  // Normalize path to .png for cache lookup (cache keys are always .png paths)
  const pngPath = faviconPath.replace(/\.(avif|png)$/, ".png")

  // Check cache first (may contain SVG URL from populateFaviconContainer CDN check)
  const cached = urlCache.get(pngPath)
  if (cached && cached !== DEFAULT_PATH) {
    if (cached.startsWith("http")) {
      return cached
    }
    // Cache contains SVG path, construct CDN URL
    if (cached.endsWith(".svg")) {
      return `https://assets.turntrout.com${cached}`
    }
  }

  // Check if SVG version exists locally
  const svgPath = pngPath.replace(".png", ".svg")
  const localSvgPath = path.join(QUARTZ_FOLDER, svgPath)
  try {
    fs.accessSync(localSvgPath, fs.constants.F_OK)
    // SVG exists locally, return SVG CDN URL
    return `https://assets.turntrout.com${svgPath}`
  } catch {
    // SVG doesn't exist, fall back to AVIF
  }

  // Fallback to AVIF
  const avifPath = pngPath.replace(".png", ".avif")
  return `https://assets.turntrout.com${avifPath}`
}

/**
 * Transforms a favicon URL by checking whitelist and blacklist.
 *
 * Processing order:
 * 1. Returns path if whitelisted (always included)
 * 2. Returns DEFAULT_PATH if blacklisted (never included)
 * 3. Otherwise returns path for further count checking
 *
 * Note: Path replacements are handled at the hostname level in getQuartzPath,
 * so paths passed here are already normalized.
 *
 * @param faviconPath - The favicon path to transform (can be local path, CDN URL, or special path)
 * @returns The favicon path, or DEFAULT_PATH if blacklisted
 */
export function transformUrl(faviconPath: string): string {
  const isBlacklisted = faviconSubstringBlacklist.some((entry) => faviconPath.includes(entry))
  if (isBlacklisted) {
    return DEFAULT_PATH
  }

  const isWhitelisted = FAVICON_COUNT_WHITELIST.some((entry) => faviconPath.includes(entry))
  if (isWhitelisted) {
    return faviconPath
  }

  return faviconPath
}

/**
 * Checks if a favicon path is cached and returns the cached value if found.
 *
 * @param faviconPath - The favicon path to check in cache
 * @param hostname - Domain name for logging
 * @returns Cached favicon path/URL, or null if not cached
 */
function checkCachedFavicon(faviconPath: string, hostname: string): string | null {
  if (urlCache.has(faviconPath)) {
    const cachedValue = urlCache.get(faviconPath)
    if (cachedValue === DEFAULT_PATH) {
      logger.info(`Skipping previously failed favicon for ${hostname}`)
      return DEFAULT_PATH
    }
    logger.info(`Returning cached favicon for ${hostname}`)
    return cachedValue as string
  }
  return null
}

/**
 * Checks if a local SVG file exists for the given favicon path.
 *
 * @param svgPath - The SVG path to check (e.g., "/static/images/external-favicons/example_com.svg")
 * @param faviconPath - The original favicon path for caching
 * @param hostname - Domain name for logging
 * @returns SVG path if found, null otherwise
 */
async function checkLocalSvg(
  svgPath: string,
  faviconPath: string,
  hostname: string,
): Promise<string | null> {
  const localSvgPath = path.join(QUARTZ_FOLDER, svgPath)
  try {
    await fs.promises.stat(localSvgPath)
    logger.info(`Local SVG found for ${hostname}: ${svgPath}`)
    urlCache.set(faviconPath, svgPath)
    return svgPath
  } catch {
    return null
  }
}

/**
 * Checks if an SVG file exists on the CDN.
 *
 * @param svgPath - The SVG path to check
 * @param faviconPath - The original favicon path for caching
 * @param hostname - Domain name for logging
 * @returns CDN URL if found, null otherwise
 */
async function checkCdnSvg(
  svgPath: string,
  faviconPath: string,
  hostname: string,
): Promise<string | null> {
  const svgUrl = getFaviconUrl(svgPath)
  try {
    const svgResponse = await fetch(svgUrl)
    if (svgResponse.ok) {
      logger.info(`SVG found on CDN for ${hostname}: ${svgUrl}`)
      urlCache.set(faviconPath, svgUrl)
      return svgUrl
    }
  } catch {
    logger.debug(`SVG not found on CDN for ${hostname}`)
  }
  return null
}

/**
 * Checks if a local PNG file exists for the given favicon path.
 *
 * @param faviconPath - The PNG path to check
 * @param hostname - Domain name for logging
 * @returns PNG path if found, null otherwise
 */
async function checkLocalPng(faviconPath: string, hostname: string): Promise<string | null> {
  const localPngPath = path.join(QUARTZ_FOLDER, faviconPath)
  try {
    await fs.promises.stat(localPngPath)
    logger.info(`Local PNG found for ${hostname}: ${faviconPath}`)
    return faviconPath
  } catch {
    return null
  }
}

/**
 * Checks if an AVIF file exists on the CDN.
 *
 * @param faviconPath - The PNG path (will be converted to AVIF)
 * @param hostname - Domain name for logging
 * @returns CDN AVIF URL if found, null otherwise
 */
async function checkCdnAvif(faviconPath: string, hostname: string): Promise<string | null> {
  const avifUrl = getFaviconUrl(faviconPath)
  try {
    const avifResponse = await fetch(avifUrl)
    if (avifResponse.ok) {
      logger.info(`AVIF found for ${hostname}: ${avifUrl}`)
      urlCache.set(faviconPath, avifUrl)
      return avifUrl
    }
  } catch {
    logger.debug(`AVIF not found on CDN for ${hostname}`)
  }
  return null
}

/**
 * Attempts to download a favicon from Google's favicon service.
 *
 * @param hostname - Domain to download favicon for
 * @param localPngPath - Local path to save the downloaded PNG
 * @param faviconPath - The favicon path for caching
 * @returns PNG path if download successful, null otherwise
 */
async function downloadFromGoogle(
  hostname: string,
  localPngPath: string,
  faviconPath: string,
): Promise<string | null> {
  const googleFaviconURL = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`
  logger.info(`Attempting to download favicon from Google: ${googleFaviconURL}`)
  try {
    if (await downloadImage(googleFaviconURL, localPngPath)) {
      logger.info(`Successfully downloaded favicon for ${hostname}`)
      return faviconPath
    }
  } catch (downloadErr) {
    logger.error(`Failed to download favicon for ${hostname}: ${downloadErr}`)
    urlCache.set(faviconPath, DEFAULT_PATH) // Cache the failure
  }
  return null
}

/**
 * Attempts to locate or download a favicon for a given hostname.
 *
 * Search order:
 * 1. Check URL cache for previous results
 * 2. Check for local SVG file (preferred)
 * 3. Check for SVG on CDN
 * 4. Check for local PNG file
 * 5. Look for AVIF version on CDN
 * 6. Try downloading from Google's favicon service
 * 7. Fall back to default if all attempts fail
 *
 * Caches results (including failures) to avoid repeated lookups
 *
 * @param hostname - Domain to find favicon for
 * @returns Path to favicon (local, CDN, or default)
 */
export async function MaybeSaveFavicon(hostname: string): Promise<string> {
  logger.info(`Attempting to find or save favicon for ${hostname}`)

  const faviconPath = getQuartzPath(hostname)
  const updatedPath = transformUrl(faviconPath)

  // If blacklisted, return early
  if (updatedPath === DEFAULT_PATH) {
    return DEFAULT_PATH
  }

  // Check cache first
  const cached = checkCachedFavicon(updatedPath, hostname)
  if (cached !== null) {
    return cached
  }

  // Check for local SVG first (preferred format)
  const svgPath = updatedPath.replace(".png", ".svg")
  const localSvg = await checkLocalSvg(svgPath, updatedPath, hostname)
  if (localSvg !== null) {
    return localSvg
  }

  // Check for SVG on CDN
  const cdnSvg = await checkCdnSvg(svgPath, updatedPath, hostname)
  if (cdnSvg !== null) {
    return cdnSvg
  }

  // Check for local PNG
  const localPng = await checkLocalPng(updatedPath, hostname)
  if (localPng !== null) {
    return localPng
  }

  // Check for AVIF version on CDN
  const cdnAvif = await checkCdnAvif(updatedPath, hostname)
  if (cdnAvif !== null) {
    return cdnAvif
  }

  // Try to download from Google (as PNG)
  const localPngPath = path.join(QUARTZ_FOLDER, updatedPath)
  const downloaded = await downloadFromGoogle(hostname, localPngPath, updatedPath)
  if (downloaded !== null) {
    return downloaded
  }

  // If all else fails, use default and cache the failure
  logger.debug(`Failed to find or download favicon for ${hostname}, using default`)
  urlCache.set(updatedPath, DEFAULT_PATH)
  return DEFAULT_PATH
}

export interface FaviconNode extends Element {
  type: "element"
  tagName: "img" | "svg"
  children: Element[]
  properties: {
    src?: string
    class: string
    alt: string
    style?: string
    loading?: "lazy" | "eager"
    "data-domain"?: string
  }
}

/**
 * Creates a favicon element (img tag) with the given URL and description.
 *
 * @param urlString - The URL of the favicon image.
 * @param description - The alt text for the favicon (default: "", so that favicons are treated as decoration by screen readers).
 * @returns An object representing the favicon element.
 */
export function createFaviconElement(urlString: string, description = ""): FaviconNode {
  logger.debug(`Creating favicon element with URL: ${urlString}`)

  // Use mask-based rendering for SVG favicons
  if (urlString.endsWith(".svg")) {
    // istanbul ignore next
    const domain = urlString.match(/\/([^/]+)\.svg$/)?.[1] || ""
    return {
      type: "element",
      tagName: "svg",
      children: [],
      properties: {
        class: "favicon",
        "data-domain": domain,
        style: `--mask-url: url(${urlString});`,
        alt: description,
      },
    }
  }

  // Standard img element for non-SVG favicons
  return {
    type: "element",
    tagName: "img",
    children: [],
    properties: {
      src: urlString,
      class: "favicon",
      alt: description,
      loading: "lazy",
    },
  }
}

/**
 * Inserts a favicon image into a node's children.
 *
 * @param imgPath - The path to the favicon image.
 * @param node - The node to insert the favicon into.
 */
export function insertFavicon(imgPath: string | null, node: Element): void {
  logger.debug(`Inserting favicon: ${imgPath}`)
  if (imgPath === null) {
    logger.debug("No favicon to insert")
    return
  }

  const toAppend: FaviconNode = createFaviconElement(imgPath)

  const maybeSpliceTextResult = maybeSpliceText(node, toAppend)
  if (maybeSpliceTextResult) {
    node.children.push(maybeSpliceTextResult)
  } else {
    // If maybeSpliceText returns null (e.g., when zooming into nested elements),
    // the favicon was already added to the nested element, so we don't need to do anything
    logger.debug("Favicon was added to nested element, skipping direct append")
  }
}

// Glyphs where top-right corner occupied
export const charsToSpace = ["!", "?", "|", "]", '"', "”", "’", "'"]
export const tagsToZoomInto = ["code", "em", "strong", "i", "b", "del", "s", "ins", "abbr"]
export const maxCharsToRead = 4

/**
 * Attempts to splice text content with a favicon element.
 *
 * This function handles text nodes by:
 * 1. Taking the last few characters (up to maxCharsToRead)
 * 2. Creating a span containing those characters and the favicon
 * 3. Adjusting spacing if the last character needs extra margin
 *
 * @param node - The Element node to process
 * @param imgNodeToAppend - The favicon node to append
 * @returns A modified Element containing the spliced text and favicon, or just the favicon if no text was spliced. Returns null if the node is not a text node or has no text value.
 */
export function maybeSpliceText(node: Element, imgNodeToAppend: FaviconNode): Element | null {
  // Find the last non-empty child
  const isEmpty = (child: Element | Text) => child.type === "text" && child.value?.trim() === ""
  const lastChild = [...node.children]
    .reverse()
    .find((child) => child.type === "element" || !isEmpty(child as Element | Text))

  // If no valid last child found, just append the favicon
  if (!lastChild) {
    logger.debug("No valid last child found, appending favicon directly")
    return imgNodeToAppend
  }

  // If the last child is a tag that should be zoomed into, recurse
  if (lastChild.type === "element" && tagsToZoomInto.includes(lastChild.tagName)) {
    logger.debug(`Zooming into nested element ${lastChild.tagName}`)
    const maybeSpliceTextResult = maybeSpliceText(lastChild as Element, imgNodeToAppend)
    if (maybeSpliceTextResult) {
      lastChild.children.push(maybeSpliceTextResult)
    }
    return null
  }

  // If last child is not a text node or has no value, there's nothing to splice
  if (lastChild.type !== "text" || !lastChild.value) {
    logger.debug("Appending favicon directly to node")
    return imgNodeToAppend
  }

  const lastChildText = lastChild as Text
  const textContent = lastChildText.value
  // Some characters render particularly close to the favicon, so we add a small margin
  const lastChar = textContent.at(-1)
  if (lastChar && charsToSpace.includes(lastChar)) {
    // Adjust the style of the appended element
    logger.debug("Adding margin-left to appended element")
    // istanbul ignore next
    imgNodeToAppend.properties = imgNodeToAppend.properties || {}
    imgNodeToAppend.properties.class = "favicon close-text"
  }

  // Take the last few characters (up to maxCharsToRead)
  const charsToRead = Math.min(maxCharsToRead, textContent.length)
  const lastChars = textContent.slice(-charsToRead)
  lastChildText.value = textContent.slice(0, -charsToRead)

  const span: Element = {
    type: "element",
    tagName: "span",
    properties: {
      className: "favicon-span",
    },
    children: [{ type: "text", value: lastChars } as Text, imgNodeToAppend],
  }
  const spanWithFavicon = span as FaviconNode

  // Replace entire text with span if all text was moved
  if (lastChars === textContent) {
    node.children.pop()
    logger.debug(`Replacing all ${charsToRead} chars with span`)
  }

  return spanWithFavicon
}

/**
 * Handles mailto links by inserting a mail icon.
 */
function handleMailtoLink(node: Element): void {
  logger.info("Inserting mail icon for mailto link")
  insertFavicon(specialFaviconPaths.mail, node)
}

// skipcq: JS-D1001
export function isHeading(node: Element): boolean {
  return Boolean(node.tagName?.match(/^h[1-6]$/))
}

/**
 * Handles same-page links (e.g. #section-1) by adding appropriate classes and icons.
 */
function handleSamePageLink(node: Element, href: string, parent: Parent): boolean {
  if (
    href.startsWith("#user-content-fn") || // Footnote links
    isHeading(parent as Element) // Links inside headings
  ) {
    return false
  }

  if (typeof node.properties.className === "string") {
    node.properties.className += " same-page-link"
  } else if (Array.isArray(node.properties.className)) {
    node.properties.className.push("same-page-link")
  } else {
    node.properties.className = ["same-page-link"]
  }

  insertFavicon(specialFaviconPaths.anchor, node)
  return true
}

/**
 * Checks if a URL points to an asset file that shouldn't get a favicon.
 */
export function isAssetLink(href: string): boolean {
  // Remove query parameters and fragments before extracting extension
  const urlWithoutParams = href.split("?")[0].split("#")[0]
  const extension = urlWithoutParams.split(".").pop()?.toLowerCase()

  if (!extension) {
    return false
  }

  const mimeType = mime.lookup(extension)
  if (!mimeType) {
    return false
  }

  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/mp4"
  )
}

/**
 * Checks if a link already has a favicon element.
 */
function hasFavicon(node: Element): boolean {
  for (const child of node.children) {
    if (child.type !== "element") {
      continue
    }

    if (hasClass(child, "favicon")) {
      return true
    }
    if (hasFavicon(child)) {
      return true
    }
  }
  return false
}

/**
 * Checks if a link should be skipped for favicon processing.
 */
function shouldSkipFavicon(node: Element, href: string): boolean {
  const samePage =
    (typeof node.properties.className === "string" &&
      node.properties.className.includes("same-page-link")) ||
    (Array.isArray(node.properties.className) &&
      node.properties.className.includes("same-page-link"))

  return samePage || isAssetLink(href)
}

/**
 * Checks if a favicon should be included based on count threshold, whitelist, and blacklist.
 *
 * A favicon is included if:
 * - It is NOT blacklisted, AND
 * - (It is whitelisted (always included regardless of count), OR its count is >= minFaviconCount)
 *
 * @param imgPath - The favicon image path/URL
 * @param countKey - The lookup key for the favicon count (typically from getQuartzPath, will be normalized)
 * @param faviconCounts - Map of favicon paths to their counts across the site (paths without extensions)
 * @returns True if the favicon should be included, false otherwise
 */
export function shouldIncludeFavicon(
  imgPath: string,
  countKey: string,
  faviconCounts: Map<string, number>,
): boolean {
  const isBlacklisted = faviconSubstringBlacklist.some((entry) => imgPath.includes(entry))
  if (isBlacklisted) return false

  // Normalize countKey (remove extension) to match format-agnostic counts
  const normalizedCountKey = normalizePathForCounting(countKey)
  const count = faviconCounts.get(normalizedCountKey) || 0
  const isWhitelisted = FAVICON_COUNT_WHITELIST.some((entry) => imgPath.includes(entry))
  return isWhitelisted || count >= minFaviconCount
}

/**
 * Normalizes relative URLs to absolute URLs.
 */
export function normalizeUrl(href: string): string {
  if (!href.startsWith("http")) {
    if (href.startsWith("./")) {
      href = href.slice(2)
    } else if (href.startsWith("../")) {
      href = href.slice(3)
    }
    href = `https://www.turntrout.com/${href}`
  }
  return href
}

async function handleLink(
  href: string,
  node: Element,
  faviconCounts: Map<string, number>,
): Promise<void> {
  try {
    const finalURL = new URL(href)
    logger.info(`Final URL: ${finalURL.href}`)

    const imgPath = await MaybeSaveFavicon(finalURL.hostname)

    if (imgPath === DEFAULT_PATH) {
      logger.info(`No favicon found for ${finalURL.hostname}; skipping`)
      return
    }

    // transformUrl already handles whitelist/blacklist, so we only need to check count
    // Use getQuartzPath as the lookup key, but normalize it (remove extension) to match countfavicons.ts
    const countKey = normalizePathForCounting(getQuartzPath(finalURL.hostname))
    const count = faviconCounts.get(countKey) || 0

    // If not whitelisted (already handled by transformUrl), check count threshold
    const isWhitelisted = FAVICON_COUNT_WHITELIST.some((entry) => imgPath.includes(entry))
    if (!isWhitelisted && count < minFaviconCount) {
      logger.debug(
        `Favicon ${imgPath} (count key: ${countKey}) appears ${count} times (minimum ${minFaviconCount}), skipping`,
      )
      return
    }

    logger.info(`Inserting favicon for ${finalURL.hostname}: ${imgPath}`)
    insertFavicon(imgPath, node)
  } catch (error) {
    logger.error(`Error processing URL ${href}: ${error}`)
  }
}

/**
 * Main node processing function for adding favicons to links.
 *
 * Link processing logic:
 * 1. Handles mailto: links with mail icon (always added, not subject to count threshold)
 * 2. Processes same-page (#) links with anchor icon (always added, not subject to count threshold)
 * 3. Skips image/asset links and already processed links
 * 4. Normalizes relative URLs to absolute
 * 5. Downloads and inserts appropriate favicon (only if appears >= minFaviconCount times)
 *
 * @param node - Link element to process
 * @param parent - Parent element of the link
 * @param faviconCounts - Map of favicon paths to their counts across the site
 */
export async function ModifyNode(
  node: Element,
  parent: Parent,
  faviconCounts: Map<string, number>,
): Promise<void> {
  logger.info(`Modifying node: ${node.tagName}`)
  if (node.tagName !== "a" || !node.properties.href) {
    logger.debug("Node is not an anchor or has no href, skipping")
    return
  }

  let href = node.properties.href
  logger.debug(`Processing href: ${href}`)
  if (typeof href !== "string") {
    logger.debug("Href is not a string, skipping")
    return
  }

  // Skip if link already has a favicon
  if (hasFavicon(node)) {
    logger.debug(`Skipping favicon insertion for link that already has a favicon: ${href}`)
    return
  }

  if (href.includes("mailto:")) {
    handleMailtoLink(node)
    return
  }

  const isSamePageLink = href.startsWith("#")
  if (isSamePageLink) {
    handleSamePageLink(node, href, parent)
    return
  }

  if (href.endsWith("/rss.xml")) {
    insertFavicon(specialFaviconPaths.rss, node)
    return
  }

  // Skip certain types of links
  if (shouldSkipFavicon(node, href)) {
    logger.debug(`Skipping favicon insertion for same-page link or asset: ${href}`)
    return
  }

  // Process external links
  href = normalizeUrl(href)
  await handleLink(href, node, faviconCounts)
}

/**
 * Plugin factory that processes HTML tree to add favicons to links.
 *
 * Processing steps:
 * 1. Collects all link nodes from the document
 * 2. Processes each link in parallel
 * 3. Updates favicon cache file after completion
 *
 * @returns Plugin configuration object for Quartz
 */
export const AddFavicons = () => {
  return {
    name: "AddFavicons",
    htmlPlugins() {
      return [
        () => {
          return async (tree: Root) => {
            logger.info("Starting favicon processing")
            const faviconCounts = readFaviconCounts()
            logger.info(`Loaded ${faviconCounts.size} favicon counts`)

            const nodesToProcess: [Element, Parent][] = []

            visit(
              tree,
              "element",
              (node: Element, _index: number | undefined, parent: Parent | undefined) => {
                // istanbul ignore next
                if (!parent) return
                if (node.tagName === "a" && node.properties.href) {
                  logger.debug(`Found anchor node: ${node.properties.href}`)
                  nodesToProcess.push([node, parent])
                }
              },
            )

            logger.info(`Processing ${nodesToProcess.length} nodes`)
            await Promise.all(
              nodesToProcess.map(([node, parent]) => ModifyNode(node, parent, faviconCounts)),
            )
            logger.info("Finished processing favicons")

            writeCacheToFile()
          }
        },
      ]
    },
  }
}
