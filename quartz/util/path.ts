import type { Element as HastElement } from "hast"

import { slug as slugAnchor } from "github-slugger"
import rfdc from "rfdc"

import { specialFaviconPaths } from "../components/constants"

export const clone = rfdc()

// this file must be isomorphic so it can't use node libs (e.g. path)

export const QUARTZ = "quartz"

const HEADING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

/// Utility type to simulate nominal types in TypeScript
type SlugLike<T> = string & { __brand: T }

/** A string that is a valid filepath. It cannot be relative and must have a file extension. */
export type FilePath = SlugLike<"filepath">
/** Type guard for {@link FilePath}: not relative and has a file extension. */
export function isFilePath(s: string): s is FilePath {
  const validStart = !s.startsWith(".")
  return validStart && _hasFileExtension(s)
}

/** Cannot be relative and may not have leading or trailing slashes. It can have `index` as it's last segment. Use this wherever possible is it's the most 'general' interpretation of a slug. */
export type FullSlug = SlugLike<"full">
/** Type guard for {@link FullSlug}: not relative/absolute, no trailing slash, no forbidden chars. */
export function isFullSlug(s: string): s is FullSlug {
  const validStart = !(s.startsWith(".") || s.startsWith("/"))
  const validEnding = !s.endsWith("/")
  return validStart && validEnding && !containsForbiddenCharacters(s)
}

/** Shouldn't be a relative path and shouldn't have `/index` as an ending or a file extension. It _can_ however have a trailing slash to indicate a folder path. */
export type SimpleSlug = SlugLike<"simple">
/** Type guard for {@link SimpleSlug}: no trailing `index`, no file extension, no forbidden chars. */
export function isSimpleSlug(s: string): s is SimpleSlug {
  const validStart = !(s.startsWith(".") || (s.length > 1 && s.startsWith("/")))
  const validEnding = !endsWith(s, "index")
  return validStart && !containsForbiddenCharacters(s) && validEnding && !_hasFileExtension(s)
}

/** Can be found on `href`s but can also be constructed for client-side navigation (e.g. search and graph) */
export type RelativeURL = SlugLike<"relative">
/** Type guard for {@link RelativeURL}: starts with `.` or `..`, no `index`/`.md`/`.html` ending. */
export function isRelativeURL(s: string): s is RelativeURL {
  const validStart = /^\.{1,2}/.test(s)
  const validEnding = !endsWith(s, "index")
  return validStart && validEnding && ![".html", ".md"].includes(_getFileExtension(s) ?? "")
}

/**
 * Gets the FullSlug from the data-slug attribute of the page's body.
 * @param window The global window object.
 * @returns The FullSlug of the current page.
 */
export function getFullSlug(window: Window): FullSlug {
  const res = window.document.body.dataset.slug as FullSlug
  return res
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * This function replaces spaces with hyphens, removes special characters,
 * and ensures the slug is properly formatted for URLs.
 */
function slugify(s: string): string {
  return s
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/") // always use / as sep
    .replace(/\/$/, "")
}

/**
 * Sluggifies a file path to create a clean URL slug.
 *
 * @param fp The file path to slugify.
 * @param excludeExt Whether to exclude the file extension from the slug.
 * @returns The sluggified file path as a FullSlug.
 */
export function slugifyFilePath(fp: FilePath, excludeExt?: boolean): FullSlug {
  fp = stripSlashes(fp) as FilePath
  let ext = _getFileExtension(fp)
  const withoutFileExt = ext ? fp.slice(0, -ext.length) : fp
  if (excludeExt || [".html", ".md", undefined].includes(ext)) {
    ext = ""
  }

  let slug = slugify(withoutFileExt)

  // treat _index as index
  if (endsWith(slug, "_index")) {
    slug = slug.replace(/_index$/, "index")
  }

  return (slug + ext) as FullSlug
}

/**
 * Simplifies a FullSlug into a SimpleSlug.
 *
 * This involves removing any trailing 'index' and slashes.
 * @param fp The FullSlug to simplify.
 * @returns The simplified slug as a SimpleSlug.
 */
export function simplifySlug(fp: FullSlug): SimpleSlug {
  const res = stripSlashes(maybeTrimSuffix(fp, "index"), true)
  return (res.length === 0 ? "/" : res) as SimpleSlug
}

/**
 * Transforms an internal link to a relative URL.
 *
 * This function decodes the link, handles folder paths and relative segments,
 * and ensures the resulting URL is properly formatted.
 * @param link The internal link to transform.
 * @returns The transformed link as a RelativeURL.
 */
export function transformInternalLink(link: string): RelativeURL {
  const [fplike, anchor] = splitAnchor(decodeURI(link))

  const folderPath = isFolderPath(fplike)
  const segments = fplike.split("/").filter((x) => x.length > 0)
  const prefix = segments.filter(isRelativeSegment).join("/")
  const fp = segments.filter((seg) => !isRelativeSegment(seg) && seg !== "").join("/")

  // manually add ext here as we want to not strip 'index' if it has an extension
  const simpleSlug = simplifySlug(slugifyFilePath(fp as FilePath))
  const joined = joinSegments(stripSlashes(prefix), stripSlashes(simpleSlug))
  const trail = folderPath ? "/" : ""
  const res = (_addRelativeToStart(joined) + trail + anchor) as RelativeURL
  return res
}

// from micromorph/src/utils.ts
// https://github.com/natemoo-re/micromorph/blob/main/src/utils.ts#L5
/**
 * Rebases the URL of an element's attribute to a new base.
 * @param el The element to modify.
 * @param attr The attribute containing the URL to rebase.
 * @param newBase The new base URL.
 */
const _rebaseHtmlElement = (el: Element, attr: string, newBase: string | URL) => {
  const rebased = new URL(el.getAttribute(attr) ?? "", newBase)
  el.setAttribute(attr, rebased.pathname + rebased.hash)
}

/**
 * Normalizes relative URLs in an element or document to a specified destination.
 *
 * This function finds all `href` and `src` attributes with relative paths
 * and rebases them to the given destination.
 * @param el The element or document to process.
 * @param destination The destination URL to resolve relative paths against.
 */
export function normalizeRelativeURLs(el: Element | Document, destination: string | URL) {
  el.querySelectorAll('[href^="./"], [href^="../"]').forEach((item) =>
    _rebaseHtmlElement(item, "href", destination),
  )
  el.querySelectorAll('[src^="./"], [src^="../"]').forEach((item) =>
    _rebaseHtmlElement(item, "src", destination),
  )
}

/** Rewrites an anchor (same-page) favicon descendant in place to the internal turntrout favicon. */
function retargetAnchorFaviconToInternal(el: HastElement): void {
  if (el.tagName === "svg" && el.properties?.["data-domain"] === "anchor") {
    el.properties["data-domain"] = "turntrout_com"
    el.properties.style = `--mask-url: url(${specialFaviconPaths.turntrout});`
  }
  for (const child of el.children) {
    if ((child as HastElement).type === "element") {
      retargetAnchorFaviconToInternal(child as HastElement)
    }
  }
}

/**
 * An author-written `[text](#section)` link is decorated as a same-page link at
 * its source page's transform stage. Once transcluded, it is rebased to a
 * cross-page link back to the source, so demote it to a normal internal link:
 * drop the `same-page-link` class (which otherwise suppresses navigation) and
 * swap its anchor favicon for the internal turntrout favicon.
 */
function demoteRebasedAnchorLink(el: HastElement): void {
  if (el.tagName !== "a") return
  // Same-page links carry their classes as an array (markdown links) or a
  // space-separated string (footnote backrefs from rehype-gfm); handle both.
  const classes = el.properties?.className
  if (Array.isArray(classes)) {
    el.properties.className = classes.filter((c) => String(c) !== "same-page-link")
  } else if (typeof classes === "string") {
    el.properties.className = classes
      .split(/\s+/)
      .filter((c) => c && c !== "same-page-link")
      .join(" ")
  }
  retargetAnchorFaviconToInternal(el)
}

/**
 * Rebases a HAST element's attribute to a new base slug
 *
 * @param el - HAST element to rebase
 * @param attr - Attribute to rebase
 * @param curBase - Current base slug where element originates
 * @param newBase - New base slug where element will be transcluded
 */
const _rebaseHastElement = (
  el: HastElement,
  attr: string,
  curBase: FullSlug,
  newBase: FullSlug,
): void => {
  if (el.properties?.[attr]) {
    const attrValue = String(el.properties[attr])

    // Handle anchor-only links (e.g., #section)
    if (attrValue.startsWith("#")) {
      const relativeToOriginal = resolveRelative(curBase, newBase)
      el.properties[attr] = relativeToOriginal + attrValue
      demoteRebasedAnchorLink(el)
      return
    }

    if (!isRelativeURL(attrValue)) {
      return
    }

    const rel = joinSegments(resolveRelative(curBase, newBase), "..", attrValue)
    el.properties[attr] = rel
  }
}

/**
 * Rebases all links in a HAST element tree (mutates in place).
 * skipHref suppresses href rebasing for the element itself (used for heading
 * autolink anchors whose href has already been updated to the prefixed id).
 */
function _rebaseTree(
  el: HastElement,
  curBase: FullSlug,
  newBase: FullSlug,
  skipHref = false,
): void {
  _rebaseHastElement(el, "src", curBase, newBase)
  if (!skipHref) {
    _rebaseHastElement(el, "href", curBase, newBase)
  }
  const isHeading = HEADING_TAGS.has(el.tagName)
  const oldId = isHeading && el.properties?.id ? String(el.properties.id) : ""

  if (oldId) {
    // Prefix the id with the source-page slug (slashes → hyphens) so it stays
    // unique on the host page even if the same slug exists there.
    const prefix = newBase.replaceAll("/", "-")
    el.properties.id = `${prefix}-${oldId}`
  }

  const newId = isHeading && el.properties?.id ? String(el.properties.id) : ""

  if (el.children) {
    for (const child of el.children) {
      if ((child as HastElement).type === "element") {
        const childEl = child as HastElement
        // The rehype-autolink-headings wrapper matches href="#oldId". Point it
        // at the prefixed id so it scrolls to the heading on the host page.
        const isAutolinkWrapper =
          isHeading &&
          childEl.tagName === "a" &&
          String(childEl.properties?.href ?? "") === `#${oldId}`
        if (isAutolinkWrapper) {
          childEl.properties.href = `#${newId}`
        }
        _rebaseTree(childEl, curBase, newBase, isAutolinkWrapper)
      }
    }
  }
}

/**
 * Normalizes a HAST element for transclusion by:
 * 1. Deep-cloning the element to avoid modifying original content
 * 2. Rebasing relative links to work in the new context
 *
 * @param rawEl - Original HAST element to normalize
 * @param curBase - Current base slug where element originates
 * @param newBase - New base slug where element will be transcluded
 * @returns Normalized HAST element with rebased links
 */
export function normalizeHastElement(rawEl: HastElement, curBase: FullSlug, newBase: FullSlug) {
  const el = clone(rawEl) // clone so we dont modify the original page
  _rebaseTree(el, curBase, newBase)
  return el
}

/**
 * Calculates the relative path from a slug to the root of the site.
 * @param slug The slug to calculate the path from.
 * @returns The relative path to the root as a RelativeURL.
 * @example
 * pathToRoot("/a/b/c") // "../.."
 */
export function pathToRoot(slug: FullSlug): RelativeURL {
  let rootPath = slug
    .split("/")
    .filter((x) => x !== "")
    .slice(0, -1)
    .map(() => "..")
    .join("/")

  if (rootPath.length === 0) {
    rootPath = "."
  }

  return rootPath as RelativeURL
}

// Resolves a relative path between two slugs
export function resolveRelative(current: FullSlug, target: FullSlug | SimpleSlug): RelativeURL {
  const res = joinSegments(pathToRoot(current), simplifySlug(target as FullSlug)) as RelativeURL
  return res
}

/**
 * Splits a link into its main path and anchor component.
 * @param link The link to split.
 * @returns A tuple containing the path and the anchor
 * @example
 * splitAnchor("/a/b/c#anchor") // ["/a/b/c", "#anchor"]
 */
export function splitAnchor(link: string): [string, string] {
  const fp = link.split("#", 2)[0]
  let anchor = link.split("#", 2)[1]
  if (fp.endsWith(".pdf")) {
    return [fp, anchor === undefined ? "" : `#${anchor}`]
  }
  anchor = anchor === undefined ? "" : `#${slugAnchor(anchor)}`
  return [fp, anchor]
}

/**
 * Sluggifies each component of a string, delimited by `/`.
 */
export function slugTag(tag: string) {
  return tag
    .split("/")
    .map((tagSegment) => slugify(tagSegment))
    .join("/")
}

/**
 * Joins multiple path segments into a single, normalized path string.
 * @param args An array of path segments to join.
 * @returns The combined path string.
 * @example
 * joinSegments("a", "b", "c") // "a/b/c"
 */
export function joinSegments(...args: string[]): string {
  return args
    .filter((segment) => segment !== "")
    .join("/")
    .replace(/\/{2,}/g, "/")
}

/**
 * Returns all sequential prefix segments from a slash-delimited tag string.
 * @param tags The slash-delimited string to process.
 * @returns Array of prefix strings representing each segment path.
 *
 * @example
 * getAllSegmentPrefixes("a/b/c") // ["a", "a/b", "a/b/c"]
 */
export function getAllSegmentPrefixes(tags: string): string[] {
  const segments = tags.split("/")
  const results: string[] = []
  for (let i = 0; i < segments.length; i++) {
    results.push(segments.slice(0, i + 1).join("/"))
  }
  return results
}

export interface TransformOptions {
  strategy: "absolute" | "relative" | "shortest"
  allSlugs: FullSlug[]
}

/**
 * Transforms a link based on the provided strategy and context.
 * @param src The source slug where the link originates.
 * @param target The target link to transform.
 * @param opts The transformation options, including strategy and all available slugs.
 * @returns The transformed link as a RelativeURL.
 */
export function transformLink(src: FullSlug, target: string, opts: TransformOptions): RelativeURL {
  const targetSlug = transformInternalLink(target)

  if (opts.strategy === "relative") {
    return targetSlug as RelativeURL
  } else {
    const folderTail = isFolderPath(targetSlug) ? "/" : ""
    const canonicalSlug = stripSlashes(targetSlug.slice(".".length))
    const [targetCanonical, targetAnchor] = splitAnchor(canonicalSlug)

    if (opts.strategy === "shortest") {
      // if the file name is unique, then it's just the filename
      const matchingFileNames = opts.allSlugs.filter((slug) => {
        const parts = slug.split("/")
        const fileName = parts.at(-1)
        return targetCanonical === fileName
      })

      // only match, just use it
      if (matchingFileNames.length === 1) {
        const targetSlug = matchingFileNames[0]
        return (resolveRelative(src, targetSlug) + targetAnchor) as RelativeURL
      }
    }

    // if it's not unique, then it's the absolute path from the vault root
    return (joinSegments(pathToRoot(src), canonicalSlug) + folderTail) as RelativeURL
  }
}

/** True for paths that point at a directory (trailing slash or `index` page). */
function isFolderPath(fplike: string): boolean {
  return (
    fplike.endsWith("/") ||
    endsWith(fplike, "index") ||
    endsWith(fplike, "index.md") ||
    endsWith(fplike, "index.html")
  )
}

/** True if `s` equals `suffix` or ends in `/${suffix}` (segment-aware suffix match). */
export function endsWith(s: string, suffix: string): boolean {
  return s === suffix || s.endsWith(`/${suffix}`)
}

/** Removes a trailing `suffix` (segment-aware) from `s` if present. */
function maybeTrimSuffix(s: string, suffix: string): string {
  if (endsWith(s, suffix)) {
    s = s.slice(0, -suffix.length)
  }
  return s
}

/** True if `s` contains any of the URL-hostile characters: space, `#`, `?`, `&`. */
function containsForbiddenCharacters(s: string): boolean {
  return s.includes(" ") || s.includes("#") || s.includes("?") || s.includes("&")
}

/** True if `s` has a recognized file extension (see {@link _getFileExtension}). */
function _hasFileExtension(s: string): boolean {
  return _getFileExtension(s) !== undefined
}

/**
 * Retrieves the file extension from a string.
 * @param s The string to parse.
 * @returns The file extension (including the "."), or undefined if not found.
 */
function _getFileExtension(s: string): string | undefined {
  const match = /\.[A-Z0-9]+$/i.exec(s)
  return match?.[0]
}

/**
 * Checks if a path segment is a relative segment (e.g., ".", "..").
 * @param s The path segment to check.
 * @returns True if the segment is relative, otherwise false.
 */
function isRelativeSegment(s: string): boolean {
  return /^\.{0,2}$/.test(s)
}

/**
 * Removes leading and optionally trailing slashes from a string.
 * @param s The string to strip slashes from.
 * @param onlyStripPrefix If true, only leading slashes are removed.
 * @returns The string with slashes removed.
 */
export function stripSlashes(s: string, onlyStripPrefix?: boolean): string {
  if (s.startsWith("/")) {
    s = s.substring(1)
  }

  if (!onlyStripPrefix && s.endsWith("/")) {
    s = s.slice(0, -1)
  }

  return s
}

/**
 * Ensures a path starts with a relative segment ("./").
 * @param s The path string.
 * @returns The path with a relative prefix.
 */
function _addRelativeToStart(s: string): string {
  if (s === "") {
    s = "."
  }

  if (!s.startsWith(".")) {
    s = joinSegments(".", s)
  }

  return s
}
