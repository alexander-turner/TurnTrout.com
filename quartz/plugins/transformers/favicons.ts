import type { Element, Parent, Root, Text } from "hast"

import fs from "fs"
import mime from "mime-types"
import pRetry from "p-retry"
import { visit } from "unist-util-visit"
import { visitParents } from "unist-util-visit-parents"

import type { BuildCtx } from "../../util/ctx"

import {
  cdnBaseUrl,
  defaultPath,
  HEADING_TAGS,
  simpleConstants,
  specialFaviconPaths,
} from "../../components/constants"
import { faviconCountsFile } from "../../components/constants.server"
import {
  faviconCountAllowlistComputed,
  faviconSubstringBlocklistComputed,
  normalizeHostname,
} from "../../util/favicon-config"
import { createWinstonLogger } from "../../util/log"
import { addClass, createNowrapSpan, hasClass, ITALIC_TAGS, spliceAndWrapLastChars } from "./utils"

const { minFaviconCount, faviconFolder } = simpleConstants

const logger = createWinstonLogger("linkFavicons")

/**
 * In-memory record of which SVG favicon paths have been verified to exist on
 * the CDN during this build. Values are the in-flight Promise itself, so
 * concurrent lookups for the same domain share a single fetch.
 */
export const faviconExistsCache = new Map<string, Promise<boolean>>()

/** Maps a hostname to its favicon storage path (e.g. "example.com" → "/static/images/external-favicons/example_com.png"). */
export function getQuartzPath(hostname: string): string {
  hostname = hostname === "localhost" ? "turntrout.com" : hostname.replace(/^www\./, "")
  hostname = normalizeHostname(hostname)
  const sanitizedHostname = hostname.replace(/\./g, "_")
  return sanitizedHostname.includes("turntrout_com")
    ? specialFaviconPaths.turntrout
    : `/${faviconFolder}/${sanitizedHostname}.svg`
}

/**
 * Normalizes a favicon path for counting by stripping the .svg extension so
 * counts are keyed by domain rather than by file format. Full URLs and .ico
 * paths are preserved as-is.
 */
export function normalizePathForCounting(faviconPath: string): string {
  if (faviconPath.startsWith("http")) return faviconPath
  if (faviconPath.endsWith(".ico")) return faviconPath
  return faviconPath.replace(/\.svg$/, "")
}

/**
 * Reads favicon counts from the faviconCountsFile and returns them as a ReadonlyMap.
 *
 * A missing file (ENOENT) is a normal, expected state and yields an empty Map.
 * A malformed/corrupt file throws so the corruption fails loudly rather than
 * silently degrading to an empty count map.
 *
 * @returns A ReadonlyMap of favicon path to count, or empty Map if the file doesn't exist.
 */
export async function readFaviconCounts(): Promise<ReadonlyMap<string, number>> {
  let data: string
  try {
    data = await fs.promises.readFile(faviconCountsFile, "utf8")
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT") {
      logger.warn(`Favicon counts file not found at ${faviconCountsFile}`)
      return new Map<string, number>()
    }
    throw error
  }

  const countMap = new Map<string, number>()
  const countsArray = JSON.parse(data) as Array<[string, number]>
  for (const [faviconPath, count] of countsArray) {
    if (faviconPath && typeof count === "number" && !isNaN(count)) {
      countMap.set(faviconPath, count)
    }
  }

  return countMap
}

/**
 * Constructs a CDN URL from an SVG favicon path. Full URLs pass through unchanged.
 */
export function getFaviconUrl(faviconPath: string): string {
  if (faviconPath.startsWith("http")) return faviconPath
  return `${cdnBaseUrl}${faviconPath}`
}

/**
 * Returns `defaultPath` for blocklisted paths, otherwise the original path.
 */
export function transformUrl(faviconPath: string): string {
  const isBlocklisted = faviconSubstringBlocklistComputed.some((entry: string) =>
    faviconPath.includes(entry),
  )
  return isBlocklisted ? defaultPath : faviconPath
}

/**
 * Checks whether an SVG exists on the CDN via HTTP fetch.
 */
async function checkCdnSvg(svgPath: string): Promise<boolean> {
  const url = svgPath.startsWith("http") ? svgPath : `${cdnBaseUrl}${svgPath}`
  return await pRetry(
    async () => {
      const response = await fetch(url)
      if (response.ok) return true
      // A 4xx is a definitive "absent" answer: findFaviconPath probes the
      // normalized path first and falls back to the unnormalized one on a
      // miss, so report the favicon missing without retrying.
      if (response.status >= 400 && response.status < 500) return false
      // A 5xx (or a rejected `fetch`, i.e. a network failure) is a transient
      // real failure. Silently dropping the favicon would shift glyph layout
      // on every page linking this domain, so throw after retries and let the
      // build fail loudly rather than encode a degraded layout into the site.
      throw new Error(`Favicon existence check failed for ${url}: HTTP ${response.status}`)
    },
    { retries: 2, minTimeout: 1000 },
  )
}

/**
 * Resolves whether a single SVG exists on the CDN, using the in-memory cache.
 * Concurrent callers share the same in-flight Promise, so each path is
 * checked at most once per build.
 */
function resolveSvgPath(svgPath: string): Promise<boolean> {
  const cached = faviconExistsCache.get(svgPath)
  if (cached !== undefined) return cached

  const pending = checkCdnSvg(svgPath)
  faviconExistsCache.set(svgPath, pending)
  return pending
}

/**
 * Locates an SVG favicon for the given hostname on the CDN.
 *
 * Tries the PSL-normalized path first (e.g. `spotify_com.svg`), then falls
 * back to the unnormalized subdomain path (e.g. `open_spotify_com.svg`) so
 * that subdomain-specific icons still resolve. Results are cached for the
 * rest of the build.
 *
 * @returns the resolved SVG path if the CDN has it, or null if it's missing
 *          or the hostname is blocklisted.
 */
export async function findFaviconPath(hostname: string): Promise<string | null> {
  const normalizedPath = transformUrl(getQuartzPath(hostname))
  if (normalizedPath === defaultPath) return null

  if (await resolveSvgPath(normalizedPath)) return normalizedPath

  const unnormalized = hostname.replace(/^www\./, "").replace(/\./g, "_")
  const unnormalizedPath = `/${faviconFolder}/${unnormalized}.svg`
  if (unnormalizedPath === normalizedPath) return null

  return (await resolveSvgPath(unnormalizedPath)) ? unnormalizedPath : null
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
    focusable?: "true" | "false"
    role?: "img"
    "aria-label"?: string
  }
}

/**
 * Creates a favicon element. SVG paths render via CSS mask; other paths fall
 * back to an `<img>` tag (used only for `.ico` favicons such as the local
 * trout favicon).
 */
export function createFaviconElement(urlString: string, description = ""): FaviconNode {
  if (urlString.endsWith(".svg")) {
    // istanbul ignore next
    const domain = urlString.match(/\/(?<domain>[^/]+)\.svg$/)?.groups?.domain || ""

    const accessibilityProps = description
      ? ({ role: "img", "aria-label": description } as const)
      : ({ "aria-hidden": "true", focusable: "false" } as const)

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

// Font context of the glyph a favicon lands after. Nudges are audited against
// the serif body face, so other faces pick different memberships (or none).
export interface GlyphContext {
  readonly italic: boolean
  readonly smallCaps: boolean
  readonly code: boolean
}

export const EMPTY_GLYPH_CONTEXT: GlyphContext = {
  italic: false,
  smallCaps: false,
  code: false,
}

/**
 * Inserts a favicon image into a node's children.
 */
export function insertFavicon(
  imgPath: string | null,
  node: Element,
  context: GlyphContext = EMPTY_GLYPH_CONTEXT,
): void {
  if (imgPath === null) return

  const toAppend: FaviconNode = createFaviconElement(imgPath)
  const result = maybeSpliceText(node, toAppend, context)
  if (result) {
    node.children.push(result)
  }
}

// Glyphs whose ink reaches (or overhangs) the right edge of their advance
// width, crowding the favicon without a nudge. Membership comes from
// scripts/notebooks/favicon_kerning_audit, which renders every real
// (glyph, favicon) pair on the built site and reports each glyph's ink
// clearance; glyphs land here when their median clearance falls more than
// ~1px short of a round letter's.
export const charsToSpace: readonly string[] = [
  "T",
  "R",
  "V",
  "Y",
  "q",
  "w",
  "v",
  "y",
  "x",
  "N",
  "F",
  "J",
  "K",
  "E",
  "U",
  "(",
  "[",
  "\\",
  "®",
]
// Glyphs that overhang so far right (per the same audit) that they need a
// larger nudge than charsToSpace provides.
export const charsToSpaceMost: readonly string[] = ["f", "Q", "/"]
// The serif sets above come from the perceptual audit and stay its property.
// Italic glyphs lean rightward, so the overhang set differs; with no audit for
// the italic face, membership derives from measured ink clearance within the
// favicon's vertical band (0.2em-0.7em above the baseline): glyphs whose
// in-band ink reaches their advance edge get a nudge, and glyphs whose ink
// overhangs by more than 0.1em get the larger one.
export const charsToSpaceItalic: readonly string[] = [
  "T",
  "Y",
  "N",
  "F",
  "J",
  "K",
  "U",
  "(",
  "x",
  "e",
  "t",
  "d",
  "r",
  "l",
  "g",
]
export const charsToSpaceMostItalic: readonly string[] = ["V", "f", "/"]

/** Widens `context` with whatever face `element` switches its text into. */
export function broadenContext(element: Element, context: GlyphContext): GlyphContext {
  return {
    italic: context.italic || ITALIC_TAGS.has(element.tagName),
    smallCaps: context.smallCaps || hasClass(element, "small-caps"),
    code: context.code || element.tagName === "code",
  }
}

/** Folds every element ancestor into a glyph context (outermost first). */
export function contextFromAncestors(ancestors: readonly Parent[]): GlyphContext {
  let context = EMPTY_GLYPH_CONTEXT
  for (const ancestor of ancestors) {
    if (ancestor.type === "element") {
      context = broadenContext(ancestor as Element, context)
    }
  }
  return context
}

/**
 * The nudge class for a favicon that lands after `lastChar` rendered in
 * `context`:
 *   - monospace advances carry their own right side bearing, handled uniformly
 *     in CSS (`code .favicon`), so no per-glyph class applies;
 *   - small-cap forms of lowercase letters keep their in-band ink clear of the
 *     icon (even ``q``'s tail is a descender, below the icon), so none applies;
 *   - italic uses the ink-derived sets, the serif body face its audited ones.
 */
export function nudgeClassFor(
  lastChar: string,
  context: GlyphContext,
): "close-text" | "closer-text" | null {
  if (context.code) return null
  if (context.smallCaps && /[a-z]/.test(lastChar)) return null
  const [most, close] = context.italic
    ? [charsToSpaceMostItalic, charsToSpaceItalic]
    : [charsToSpaceMost, charsToSpace]
  if (most.includes(lastChar)) return "closer-text"
  return close.includes(lastChar) ? "close-text" : null
}

// Distinct from the shared INLINE_PASSTHROUGH_TAGS (utils.ts) on purpose:
// favicon placement descends into `<code>` and excludes `<a>` (links handled
// separately), so its membership differs from the generic inline-wrapper set.
export const tagsToZoomInto = ["code", "em", "strong", "i", "b", "del", "s", "ins", "abbr"]

/**
 * Splices the last few characters from a text node and wraps them
 * with the favicon in a nowrap span, preventing line-break orphaning.
 */
export function maybeSpliceText(
  node: Element,
  imgNodeToAppend: FaviconNode,
  context: GlyphContext = EMPTY_GLYPH_CONTEXT,
): Element | null {
  const isEmpty = (child: Element | Text) => child.type === "text" && child.value?.trim() === ""
  const lastChild = node.children.findLast(
    (child) => child.type === "element" || !isEmpty(child as Element | Text),
  )

  if (!lastChild) {
    return createNowrapSpan("", imgNodeToAppend)
  }

  if (
    lastChild.type === "element" &&
    lastChild.tagName === "span" &&
    hasClass(lastChild, "favicon-span")
  ) {
    lastChild.children.push(imgNodeToAppend)
    return null
  }

  if (lastChild.type === "element" && tagsToZoomInto.includes(lastChild.tagName)) {
    const result = maybeSpliceText(
      lastChild as Element,
      imgNodeToAppend,
      broadenContext(lastChild as Element, context),
    )
    /* istanbul ignore next -- recursive case where nested element has no text to splice */
    if (result) {
      lastChild.children.push(result)
    }
    return null
  }

  if (lastChild.type !== "text" || !lastChild.value) {
    return createNowrapSpan("", imgNodeToAppend)
  }

  const lastChildText = lastChild as Text
  const lastChar = lastChildText.value.slice(-1)
  const nudgeClass = nudgeClassFor(lastChar, context)
  if (nudgeClass) {
    imgNodeToAppend.properties.class = `favicon ${nudgeClass}`
  }

  return spliceAndWrapLastChars(lastChildText, node, imgNodeToAppend)
}

function handleMailtoLink(node: Element, context: GlyphContext): void {
  insertFavicon(specialFaviconPaths.mail, node, context)
}

/** True when the element is an `h1`–`h6` heading. */
export function isHeading(node: Element): boolean {
  return HEADING_TAGS.has(node.tagName)
}

function handleSamePageLink(
  node: Element,
  href: string,
  parent: Parent,
  context: GlyphContext,
): boolean {
  if (href.startsWith("#user-content-fn") || isHeading(parent as Element)) {
    return false
  }

  addClass(node, "same-page-link")
  insertFavicon(specialFaviconPaths.anchor, node, context)
  return true
}

export function isAssetLink(href: string): boolean {
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

  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/mp4"
  )
}

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

function linkHasClass(node: Element, className: string): boolean {
  const classes = node.properties.className
  if (typeof classes === "string") return classes.split(/\s+/).includes(className)
  return Array.isArray(classes) && classes.includes(className)
}

function shouldSkipFavicon(node: Element, href: string): boolean {
  // `no-favicon` lets a component opt a link out of the site-wide favicon pass
  // (e.g. the tweet card, which would otherwise stamp an X icon on every link).
  return (
    linkHasClass(node, "same-page-link") || linkHasClass(node, "no-favicon") || isAssetLink(href)
  )
}

/**
 * Checks if a favicon should be included based on count threshold, allowlist, and blocklist.
 *
 * A favicon is included if:
 * - It is NOT blocklisted, AND
 * - (It is allowlisted (always included regardless of count), OR its count is >= minFaviconCount)
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

  const normalizedCountKey = normalizePathForCounting(countKey)
  const count = faviconCounts.get(normalizedCountKey) || 0
  const isAllowlisted = faviconCountAllowlistComputed.some((entry) => imgPath.includes(entry))
  return isAllowlisted || count >= minFaviconCount
}

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
  faviconCounts: ReadonlyMap<string, number>,
  context: GlyphContext,
): Promise<void> {
  let finalURL: URL
  try {
    finalURL = new URL(href)
  } catch (error) {
    logger.error(`Error processing URL ${href}: ${error}`)
    return
  }

  const faviconPath = getQuartzPath(finalURL.hostname)
  const countKey = normalizePathForCounting(faviconPath)

  if (!shouldIncludeFavicon(faviconPath, countKey, faviconCounts)) {
    return
  }

  // When no SVG exists yet (locally or on the CDN), render the link without a
  // favicon rather than failing the build. The built-site checks
  // (`check_external_links_have_favicons` in scripts/built_site_checks.py)
  // flag any included domain still missing its favicon.
  const found = await findFaviconPath(finalURL.hostname)
  if (found === null) {
    return
  }

  // Always emit the full CDN URL so downstream consumers (asset dimension
  // resolution, browsers) treat it as a remote asset rather than a local file.
  insertFavicon(getFaviconUrl(found), node, context)
}

/**
 * Main node processing function for adding favicons to links.
 */
export async function ModifyNode(
  node: Element,
  parent: Parent,
  faviconCounts: ReadonlyMap<string, number>,
  context: GlyphContext = EMPTY_GLYPH_CONTEXT,
): Promise<void> {
  if (node.tagName !== "a" || !node.properties.href) return

  const href = node.properties.href
  if (typeof href !== "string") return

  if (hasFavicon(node)) return

  if (href.startsWith("mailto:")) {
    handleMailtoLink(node, context)
    return
  }

  if (href.startsWith("#")) {
    handleSamePageLink(node, href, parent, context)
    return
  }

  if (href.endsWith("/rss.xml")) {
    insertFavicon(specialFaviconPaths.rss, node, context)
    return
  }

  if (shouldSkipFavicon(node, href)) return

  const normalized = normalizeUrl(href)
  await handleLink(normalized, node, faviconCounts, context)
}

/** True when `node` is a footnote-reference superscript (`<sup><a data-footnote-ref>…</a></sup>`). */
export function isFootnoteRefSup(node: Element | Text | undefined): node is Element {
  if (!node || node.type !== "element" || node.tagName !== "sup") return false
  return node.children.some((child) => {
    if (child.type !== "element" || child.tagName !== "a") return false
    const id = child.properties?.id
    return (
      child.properties?.dataFootnoteRef !== undefined ||
      (typeof id === "string" && id.startsWith("user-content-fnref"))
    )
  })
}

/** True when the deepest trailing descendant of `node` is a favicon element. */
export function endsWithFavicon(node: Element): boolean {
  const last = node.children.findLast(
    (child) => !(child.type === "text" && child.value.trim() === ""),
  )
  if (!last || last.type !== "element") return false
  return hasClass(last, "favicon") || endsWithFavicon(last)
}

/**
 * A favicon is a replaced inline element, so browsers allow a line break on its
 * trailing edge. When a footnote reference immediately follows a favicon-ending
 * link, that break can orphan the tiny reference number onto its own line. Wrap
 * the link and the `<sup>` in a `.favicon-footnote-span`, which suppresses the
 * break between them (see favicon.scss).
 */
export function glueFootnoteRefsToFavicons(tree: Root): void {
  const wraps: Array<{ parent: Parent; start: number; end: number }> = []
  visit(tree, "element", (node: Element, index: number | undefined, parent: Parent | undefined) => {
    // istanbul ignore next -- root node has no parent/index
    if (!parent || index === undefined) return
    if (!isFootnoteRefSup(node)) return
    // Skip empty text nodes the whitespace-stripping pass leaves behind when a
    // source-level space separated the link from the ref. A non-empty space is
    // its own break opportunity, so only truly empty nodes are transparent here.
    let prevIndex = index - 1
    while (
      prevIndex >= 0 &&
      parent.children[prevIndex].type === "text" &&
      (parent.children[prevIndex] as Text).value === ""
    ) {
      prevIndex -= 1
    }
    const prev = parent.children[prevIndex]
    if (prev?.type === "element" && endsWithFavicon(prev)) {
      wraps.push({ parent, start: prevIndex, end: index })
    }
  })
  // Wrap later ranges first so earlier indices stay valid as we splice.
  wraps.sort((a, b) => b.start - a.start)
  for (const { parent, start, end } of wraps) {
    const span: Element = {
      type: "element",
      tagName: "span",
      properties: { className: "favicon-footnote-span" },
      children: parent.children.slice(start, end + 1) as Element["children"],
    }
    parent.children.splice(start, end - start + 1, span)
  }
}

/**
 * Plugin factory that processes HTML tree to add favicons to links.
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

            const nodesToProcess: [Element, Parent, GlyphContext][] = []
            visitParents(tree, "element", (node: Element, ancestors: Parent[]) => {
              // istanbul ignore next
              if (ancestors.length === 0) return
              if (node.tagName === "a" && node.properties.href) {
                nodesToProcess.push([
                  node,
                  ancestors[ancestors.length - 1],
                  contextFromAncestors(ancestors),
                ])
              }
            })

            await Promise.all(
              nodesToProcess.map(([node, parent, context]) =>
                ModifyNode(node, parent, faviconCounts, context),
              ),
            )

            glueFootnoteRefsToFavicons(tree)
          }
        },
      ]
    },
  }
}
