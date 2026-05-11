import type { Element, Root, Text, Parent } from "hast"
import type { ReadableStream } from "stream/web"

import fs from "fs"
import mime from "mime-types"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { visit } from "unist-util-visit"

import type { BuildCtx } from "../../util/ctx"

import {
  simpleConstants,
  specialFaviconPaths,
  defaultPath,
  cdnBaseUrl,
} from "../../components/constants"
import { faviconUrlsFile, faviconCountsFile } from "../../components/constants.server"
import {
  normalizeHostname,
  faviconCountAllowlistComputed,
  faviconSubstringBlocklistComputed,
} from "../../util/favicon-config"
import { createWinstonLogger } from "../../util/log"
import { createNowrapSpan, hasClass, spliceAndWrapLastChars } from "./utils"

const { minFaviconCount, quartzFolder, faviconFolder, faviconExtensions } = simpleConstants

// Anchored regex matching any of the configured favicon extensions, e.g.
// /\.(?:png|svg|avif)$/. Built from `faviconExtensions` so adding a new
// format (e.g. .webp) only requires a constants.json edit.
const FAVICON_EXTENSION_RE = new RegExp(
  `\\.(?:${faviconExtensions.map((e) => e.replace(/^\./, "")).join("|")})$`,
)

const logger = createWinstonLogger("linkFavicons")

/**
 * Allowlist of favicon paths that should always be included regardless of count. Often widely recognizable.
 * These favicons will be added even if they appear fewer than minFaviconCount times.
 * Entries can be full paths or substrings (e.g., "apple_com" will match any path containing "apple_com").
 */
// Atomically create the file if it doesn't exist; harmless if it already does.
// istanbul ignore next -- module-level init; EEXIST race is impractical to unit test
try {
  fs.writeFileSync(faviconUrlsFile, "", { flag: "wx" })
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
    throw error
  }
}

// skipcq: JS-D1001
export class DownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DownloadError"
  }
}

/** @throws DownloadError if download fails or result is not a valid image */
export async function downloadImage(url: string, imagePath: string): Promise<boolean> {
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

  return true
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
  if (/\.(?:svg|ico)$/.test(faviconPath)) {
    return faviconPath
  }
  // Remove .png, .svg, .avif extensions for counting (domain-based paths)
  return faviconPath.replace(FAVICON_EXTENSION_RE, "")
}

/** Maps a hostname to its favicon storage path (e.g. "example.com" → "/static/images/external-favicons/example_com.png"). */
export function getQuartzPath(hostname: string): string {
  hostname = hostname === "localhost" ? "turntrout.com" : hostname.replace(/^www\./, "")
  hostname = normalizeHostname(hostname)
  const sanitizedHostname = hostname.replace(/\./g, "_")
  return sanitizedHostname.includes("turntrout_com")
    ? specialFaviconPaths.turntrout
    : `/${faviconFolder}/${sanitizedHostname}.png`
}

const defaultCache: ReadonlyMap<string, string> = new Map<string, string>([
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
 * Writes the favicon cache to the faviconUrlsFile.
 */
export function writeCacheToFile(): void {
  const data = Array.from(urlCache.entries())
    .map(([key, value]) => `${key},${value}`)
    .join("\n")

  fs.writeFileSync(faviconUrlsFile, data, { flag: "w+" })
}

/**
 * Reads favicon counts from the faviconCountsFile and returns them as a ReadonlyMap.
 *
 * @returns A ReadonlyMap of favicon path to count, or empty Map if file doesn't exist or can't be read.
 */
export async function readFaviconCounts(): Promise<ReadonlyMap<string, number>> {
  try {
    await fs.promises.access(faviconCountsFile, fs.constants.F_OK)
  } catch {
    return new Map<string, number>()
  }

  const countMap = new Map<string, number>()

  try {
    const data = await fs.promises.readFile(faviconCountsFile, "utf8")
    // Parse JSON array of [path, count] pairs
    const countsArray = JSON.parse(data) as Array<[string, number]>
    for (const [faviconPath, count] of countsArray) {
      if (faviconPath && typeof count === "number" && !isNaN(count)) {
        countMap.set(faviconPath, count)
      }
    }
  } catch (error) {
    logger.error(`Error reading or parsing favicon counts file: ${error}`)
    return new Map<string, number>()
  }

  return countMap
}

/**
 * Reads favicon URLs from the faviconUrlsFile and returns them as a ReadonlyMap.
 *
 * @returns A Promise that resolves to a ReadonlyMap of basename to URL strings.
 */
export async function readFaviconUrls(): Promise<ReadonlyMap<string, string>> {
  try {
    const data = await fs.promises.readFile(faviconUrlsFile, "utf8")
    const lines = data.split("\n")
    const urlMap = new Map<string, string>()
    for (const line of lines) {
      const commaIndex = line.indexOf(",")
      if (commaIndex === -1) continue
      const basename = line.slice(0, commaIndex)
      const url = line.slice(commaIndex + 1)
      if (basename && url) {
        urlMap.set(basename, url)
      }
    }
    return urlMap
  } catch {
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
/**
 * Remembers paths for which a local SVG is known not to exist, so that
 * subsequent calls for the same path skip the synchronous filesystem check.
 * Positive results go into `urlCache` (keyed by pngPath with the svgPath value).
 */
export const missingLocalSvg = new Set<string>()

export function getFaviconUrl(faviconPath: string): string {
  if (faviconPath.startsWith("http")) {
    return faviconPath
  }

  // SVG files don't need conversion, serve directly via CDN
  if (faviconPath.endsWith(".svg")) {
    return `${cdnBaseUrl}${faviconPath}`
  }

  // Normalize path to .png for cache lookup (cache keys are always .png paths)
  const pngPath = faviconPath.replace(/\.(?:avif|png)$/, ".png")

  // Check cache first (may contain SVG URL from populateFaviconContainer CDN check)
  const cached = urlCache.get(pngPath)
  if (cached && cached !== defaultPath) {
    if (cached.startsWith("http")) {
      return cached
    }
    // Cache contains SVG path, construct CDN URL
    /* istanbul ignore next -- cache may store SVG path from populateFaviconContainer */
    if (cached.endsWith(".svg")) {
      return `${cdnBaseUrl}${cached}`
    }
  }

  const avifPath = pngPath.replace(".png", ".avif")

  // Check if we already know the local SVG is missing (negative cache)
  if (missingLocalSvg.has(pngPath)) {
    return `${cdnBaseUrl}${avifPath}`
  }

  // Check if SVG version exists locally
  const svgPath = pngPath.replace(".png", ".svg")
  const localSvgPath = path.join(quartzFolder, svgPath)
  try {
    fs.accessSync(localSvgPath, fs.constants.F_OK)
    // SVG exists locally, cache and return SVG CDN URL
    urlCache.set(pngPath, svgPath)
    return `${cdnBaseUrl}${svgPath}`
  } catch {
    // SVG doesn't exist; remember this so we skip the I/O next time
    missingLocalSvg.add(pngPath)
  }

  return `${cdnBaseUrl}${avifPath}`
}

/**
 * Transforms a favicon URL by checking the blocklist.
 * Returns defaultPath if blocklisted, otherwise returns the path unchanged.
 *
 * @param faviconPath - The favicon path to transform (can be local path, CDN URL, or special path)
 * @returns The favicon path, or defaultPath if blocklisted
 */
export function transformUrl(faviconPath: string): string {
  const isBlocklisted = faviconSubstringBlocklistComputed.some((entry: string) =>
    faviconPath.includes(entry),
  )
  if (isBlocklisted) {
    return defaultPath
  }

  return faviconPath
}

/**
 * Checks if a favicon path is cached and returns the cached value if found.
 *
 * @param faviconPath - The favicon path to check in cache
 * @returns Cached favicon path/URL, or null if not cached
 */
function checkCachedFavicon(faviconPath: string): string | null {
  const cachedValue = urlCache.get(faviconPath)
  if (cachedValue === undefined) {
    return null
  }
  return cachedValue
}

/**
 * Checks if a local SVG file exists for the given favicon path.
 *
 * @param svgPath - The SVG path to check (e.g., "/static/images/external-favicons/example_com.svg")
 * @param faviconPath - The original favicon path for caching
 * @returns SVG path if found, null otherwise
 */
async function checkLocalSvg(svgPath: string, faviconPath: string): Promise<string | null> {
  const localSvgPath = path.join(quartzFolder, svgPath)
  try {
    await fs.promises.stat(localSvgPath)
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
 * @returns CDN URL if found, null otherwise
 */
async function checkCdnSvg(svgPath: string, faviconPath: string): Promise<string | null> {
  const svgUrl = getFaviconUrl(svgPath)
  try {
    const svgResponse = await fetch(svgUrl)
    if (svgResponse.ok) {
      urlCache.set(faviconPath, svgUrl)
      return svgUrl
    }
  } catch {
    // SVG not available on CDN
  }
  return null
}

/**
 * Checks if a local PNG file exists for the given favicon path.
 *
 * @param faviconPath - The PNG path to check
 * @returns PNG path if found, null otherwise
 */
async function checkLocalPng(faviconPath: string): Promise<string | null> {
  const localPngPath = path.join(quartzFolder, faviconPath)
  try {
    await fs.promises.stat(localPngPath)
    return faviconPath
  } catch {
    return null
  }
}

/**
 * Checks if an AVIF file exists on the CDN.
 *
 * @param faviconPath - The PNG path (will be converted to AVIF)
 * @returns CDN AVIF URL if found, null otherwise
 */
async function checkCdnAvif(faviconPath: string): Promise<string | null> {
  const avifUrl = getFaviconUrl(faviconPath)
  try {
    const avifResponse = await fetch(avifUrl)
    if (avifResponse.ok) {
      urlCache.set(faviconPath, avifUrl)
      return avifUrl
    }
  } catch {
    // AVIF not available on CDN
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
  try {
    /* istanbul ignore next -- requires real network download in test */
    if (await downloadImage(googleFaviconURL, localPngPath)) {
      return faviconPath
    }
  } catch (err) {
    logger.warn(`Failed to download favicon for ${hostname}: ${err}`)
    urlCache.set(faviconPath, defaultPath)
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
  const faviconPath = getQuartzPath(hostname)
  const updatedPath = transformUrl(faviconPath)
  if (updatedPath === defaultPath) {
    return defaultPath
  }

  // Check cache first and defer if it's SVG (preferred)
  const cached = checkCachedFavicon(updatedPath)
  if (cached !== null && cached.endsWith(".svg")) {
    return cached
  }

  // For AVIF cache (or no cache), check for SVG
  const svgPath = updatedPath.replace(".png", ".svg")
  const localSvg = await checkLocalSvg(svgPath, updatedPath)
  if (localSvg !== null) return localSvg

  const cdnSvg = await checkCdnSvg(svgPath, updatedPath)
  if (cdnSvg !== null) return cdnSvg

  // Check un-normalized hostname for SVG (e.g., open_spotify_com.svg when normalized is spotify_com.svg)
  const unnormalizedHostname = hostname.replace(/^www\./, "").replace(/\./g, "_")
  const unnormalizedSvgPath = `/${faviconFolder}/${unnormalizedHostname}.svg`
  if (unnormalizedSvgPath !== svgPath) {
    const unnormalizedLocalSvg = await checkLocalSvg(unnormalizedSvgPath, updatedPath)
    if (unnormalizedLocalSvg !== null) return unnormalizedLocalSvg

    const unnormalizedCdnSvg = await checkCdnSvg(unnormalizedSvgPath, updatedPath)
    if (unnormalizedCdnSvg !== null) return unnormalizedCdnSvg
  }

  // Return cached AVIF if we have it and no SVG was found
  if (cached !== null) return cached

  const localPng = await checkLocalPng(updatedPath)
  if (localPng !== null) return localPng

  const cdnAvif = await checkCdnAvif(updatedPath)
  if (cdnAvif !== null) return cdnAvif

  // Try to download from Google (as PNG)
  const localPngPath = path.join(quartzFolder, updatedPath)
  const downloaded = await downloadFromGoogle(hostname, localPngPath, updatedPath)
  if (downloaded !== null) {
    return downloaded
  }

  urlCache.set(updatedPath, defaultPath)
  return defaultPath
}

export interface FaviconNode extends Element {
  type: "element"
  tagName: "img" | "svg"
  children: Element[]
  properties: {
    src?: string
    class: string
    style?: string
    loading?: "lazy" | "eager"
    alt?: string
    "data-domain"?: string
    "aria-hidden"?: "true" | "false"
    "aria-focusable"?: "true" | "false"
    role?: "img"
    "aria-label"?: string
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
  // Use mask-based rendering for SVG favicons
  if (urlString.endsWith(".svg")) {
    // istanbul ignore next
    const domain = urlString.match(/\/(?<domain>[^/]+)\.svg$/)?.groups?.domain || ""

    // When description is provided, make SVG accessible; otherwise hide it
    const accessibilityProps = description
      ? ({ role: "img", "aria-label": description } as const)
      : ({ "aria-hidden": "true", "aria-focusable": "false" } as const)

    return {
      type: "element",
      tagName: "svg",
      children: [],
      properties: {
        class: "favicon",
        "data-domain": domain,
        style: `--mask-url: url(${urlString});`,
        ...accessibilityProps,
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
  if (imgPath === null) {
    return
  }

  const toAppend: FaviconNode = createFaviconElement(imgPath)
  const result = maybeSpliceText(node, toAppend)
  if (result) {
    node.children.push(result)
  }
}

// Glyphs where top-right corner is occupied (ascenders with rightward
// hooks/crossbars, tall punctuation) and which therefore visually crowd the
// favicon without extra spacing.
export const charsToSpace = ["!", "?", "|", "]", '"', "”", "’", "'", "f", "q", ":", ";", "/"]
export const tagsToZoomInto = ["code", "em", "strong", "i", "b", "del", "s", "ins", "abbr"]

/**
 * Splices the last few characters from a text node and wraps them
 * with the favicon in a nowrap span, preventing line-break orphaning.
 *
 * This function:
 * 1. Finds the last meaningful child node
 * 2. Recurses into inline elements (code, em, strong, etc.)
 * 3. If an existing favicon-span exists, appends to it
 * 4. Splices the last 4 characters and wraps them + favicon in a nowrap span
 * 5. Adds close-text class if the last character needs extra margin
 *
 * @returns The nowrap span to append to the parent, or null if already handled
 */
export function maybeSpliceText(node: Element, imgNodeToAppend: FaviconNode): Element | null {
  // Find the last non-empty child
  const isEmpty = (child: Element | Text) => child.type === "text" && child.value?.trim() === ""
  const lastChild = [...node.children]
    .reverse()
    .find((child) => child.type === "element" || !isEmpty(child as Element | Text))

  // If no valid last child found, wrap favicon in a favicon-span
  if (!lastChild) {
    return createNowrapSpan("", imgNodeToAppend)
  }

  // If the last child is a span.favicon-span, append the favicon directly to it
  if (
    lastChild.type === "element" &&
    lastChild.tagName === "span" &&
    hasClass(lastChild, "favicon-span")
  ) {
    lastChild.children.push(imgNodeToAppend)
    return null
  }

  // If the last child is a tag that should be zoomed into, recurse
  if (lastChild.type === "element" && tagsToZoomInto.includes(lastChild.tagName)) {
    const result = maybeSpliceText(lastChild as Element, imgNodeToAppend)
    /* istanbul ignore next -- recursive case where nested element has no text to splice */
    if (result) {
      lastChild.children.push(result)
    }
    return null
  }

  // If last child is not a text node or has no value, wrap favicon in a favicon-span
  if (lastChild.type !== "text" || !lastChild.value) {
    return createNowrapSpan("", imgNodeToAppend)
  }

  const lastChildText = lastChild as Text

  // Some characters render particularly close to the favicon, so we add a small margin
  const lastChar = lastChildText.value.at(-1)
  if (lastChar && charsToSpace.includes(lastChar)) {
    // istanbul ignore next
    imgNodeToAppend.properties = imgNodeToAppend.properties || {}
    imgNodeToAppend.properties.class = "favicon close-text"
  }

  return spliceAndWrapLastChars(lastChildText, node, imgNodeToAppend)
}

/**
 * Handles mailto links by inserting a mail icon.
 */
function handleMailtoLink(node: Element): void {
  insertFavicon(specialFaviconPaths.mail, node)
}

const HEADING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

// skipcq: JS-D1001
export function isHeading(node: Element): boolean {
  return HEADING_TAGS.has(node.tagName)
}

/**
 * Handles same-page links (e.g. #section-1) by adding appropriate classes and icons.
 */
function handleSamePageLink(node: Element, href: string, parent: Parent): void {
  if (
    href.startsWith("#user-content-fn") || // Footnote links
    isHeading(parent as Element) // Links inside headings
  ) {
    return
  }

  if (typeof node.properties.className === "string") {
    node.properties.className += " same-page-link"
  } else if (Array.isArray(node.properties.className)) {
    node.properties.className.push("same-page-link")
  } else {
    node.properties.className = ["same-page-link"]
  }

  insertFavicon(specialFaviconPaths.anchor, node)
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

  // .ts/.mts are TypeScript, not MPEG transport stream (video/mp2t)
  if (extension === "ts" || extension === "mts") {
    return false
  }

  const mimeType = mime.lookup(extension)
  if (!mimeType) {
    return false
  }

  const isAsset =
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/mp4"

  // Debugging aid: log why a link is treated as an asset.
  // This is specifically useful for cases like GitHub links that may end in ".png" (e.g. raw links).
  if (isAsset) {
    logger.debug(
      `Skipping favicon for asset link: ${href} (extension=${extension}, mime=${mimeType})`,
    )
  }

  return isAsset
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
 * Checks if a favicon should be included based on count threshold, allowlist, and blocklist.
 *
 * A favicon is included if:
 * - It is NOT blocklisted, AND
 * - (It is allowlisted (always included regardless of count), OR its count is >= minFaviconCount)
 *
 * @param imgPath - The favicon image path/URL
 * @param countKey - The lookup key for the favicon count (typically from getQuartzPath, will be normalized)
 * @param faviconCounts - Map of favicon paths to their counts across the site (paths without extensions)
 * @returns True if the favicon should be included, false otherwise
 */
export function shouldIncludeFavicon(
  imgPath: string,
  countKey: string,
  faviconCounts: ReadonlyMap<string, number>,
): boolean {
  const isBlocklisted = faviconSubstringBlocklistComputed.some((entry: string) =>
    imgPath.includes(entry),
  )
  if (isBlocklisted) return false

  // Normalize countKey (remove extension) to match format-agnostic counts
  const normalizedCountKey = normalizePathForCounting(countKey)
  const count = faviconCounts.get(normalizedCountKey) || 0
  const isAllowlisted = faviconCountAllowlistComputed.some((entry) => imgPath.includes(entry))
  return isAllowlisted || count >= minFaviconCount
}

/**
 * Normalizes relative URLs to absolute URLs.
 */
export function normalizeUrl(href: string): string {
  if (!href.startsWith("http")) {
    href = href.replace(/^(?:\.\.?\/)+/, "")
    href = `https://www.turntrout.com/${href}`
  }
  return href
}

async function handleLink(
  href: string,
  node: Element,
  faviconCounts: ReadonlyMap<string, number>,
): Promise<void> {
  try {
    const finalURL = new URL(href)
    const imgPath = await MaybeSaveFavicon(finalURL.hostname)

    if (imgPath === defaultPath) {
      return
    }

    const countKey = getQuartzPath(finalURL.hostname)
    if (!shouldIncludeFavicon(imgPath, countKey, faviconCounts)) {
      return
    }

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
  faviconCounts: ReadonlyMap<string, number>,
): Promise<void> {
  if (node.tagName !== "a" || !node.properties.href) {
    return
  }

  const href = node.properties.href
  if (typeof href !== "string") {
    return
  }

  if (hasFavicon(node)) {
    return
  }

  if (href.startsWith("mailto:")) {
    handleMailtoLink(node)
    return
  }

  if (href.startsWith("#")) {
    handleSamePageLink(node, href, parent)
    return
  }

  if (href.endsWith("/rss.xml")) {
    insertFavicon(specialFaviconPaths.rss, node)
    return
  }

  if (shouldSkipFavicon(node, href)) {
    return
  }

  const normalized = normalizeUrl(href)
  await handleLink(normalized, node, faviconCounts)
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
    htmlPlugins(ctx: BuildCtx) {
      const offline = ctx.argv.offline ?? false
      if (offline) return []

      return [
        () => {
          return async (tree: Root) => {
            const faviconCounts = await readFaviconCounts()
            const nodesToProcess: [Element, Parent][] = []

            visit(
              tree,
              "element",
              (node: Element, _index: number | undefined, parent: Parent | undefined) => {
                // istanbul ignore next
                if (!parent) return
                if (node.tagName === "a" && node.properties.href) {
                  nodesToProcess.push([node, parent])
                }
              },
            )

            await Promise.all(
              nodesToProcess.map(([node, parent]) => ModifyNode(node, parent, faviconCounts)),
            )

            writeCacheToFile()
          }
        },
      ]
    },
  }
}
