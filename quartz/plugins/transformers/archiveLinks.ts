import type { Element, Root } from "hast"

import gitRoot from "find-git-root"
import fs from "fs"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

import type { QuartzTransformerPlugin } from "../types"

import { cdnBaseUrl } from "../../components/constants"
import { isExternalLink } from "./links"

const projectRoot = path.dirname(gitRoot(fileURLToPath(import.meta.url)))

/** Committed source of truth for archived external links (keyed by canonical URL). */
export const manifestPath = path.join(projectRoot, "config", "link_archive_manifest.json")

/** Class added to an `<a>` whose `href` was swapped for its archived copy. */
export const ARCHIVED_LINK_CLASS = "archived"

/**
 * Every snapshot the writer publishes lives under this prefix. `href` is
 * rewritten to whatever the manifest says, so the manifest must never be able
 * to point a link anywhere else.
 */
export const ARCHIVE_URL_PREFIX = `${cdnBaseUrl}/static/link-archive/`

export interface ArchiveManifestEntry {
  archive_url: string
  dead: boolean
}

export type ArchiveManifest = ReadonlyMap<string, ArchiveManifestEntry>

/**
 * Canonical URL form that the manifest key must match. Uses the WHATWG `new URL`
 * parser, then forces `https`, drops a single trailing `/`, and drops the
 * `#fragment` while keeping the query. The writer
 * (`scripts/archive_links.py`) mirrors this with the `ada-url` binding — the
 * same `ada` C++ parser Node uses — so the key it emits and the key looked up
 * here are byte-identical.
 *
 * @throws if `href` is not a parseable absolute URL.
 */
export function canonicalizeUrl(href: string): string {
  const url = new URL(href)
  let pathname = url.pathname
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1)
  }
  return `https://${url.host}${pathname}${url.search}`
}

function parseManifest(raw: string, source: string): ArchiveManifest {
  const parsed: unknown = JSON.parse(raw)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${source} must contain a JSON object`)
  }

  const manifest = new Map<string, ArchiveManifestEntry>()
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === null || typeof value !== "object") {
      throw new Error(`${source} entry for ${key} must be an object`)
    }
    const entry = value as Record<string, unknown>
    if (typeof entry.archive_url !== "string" || typeof entry.dead !== "boolean") {
      throw new Error(`${source} entry for ${key} must have a string archive_url and boolean dead`)
    }
    if (entry.archive_url !== "" && !entry.archive_url.startsWith(ARCHIVE_URL_PREFIX)) {
      // Empty means "not yet archived" (never rewritten); anything else must be
      // one of our own snapshots — fail the build rather than ship an href
      // pointing wherever a bad manifest says.
      throw new Error(
        `${source} entry for ${key} has archive_url outside ${ARCHIVE_URL_PREFIX}: ${entry.archive_url}`,
      )
    }
    manifest.set(key, {
      archive_url: entry.archive_url,
      dead: entry.dead,
    })
  }
  return manifest
}

/** Missing manifest → empty map; other I/O errors propagate. */
export function loadArchiveManifest(filePath: string = manifestPath): ArchiveManifest {
  let raw: string
  try {
    raw = fs.readFileSync(filePath, "utf-8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map()
    throw error
  }
  return parseManifest(raw, filePath)
}

/**
 * Swap a dead external link's `href` for its archived copy. Live links, unknown
 * links, and non-external links are left untouched. `data-original-href` always
 * records the original URL so the live destination stays recoverable.
 */
export function rewriteArchivedLink(node: Element, manifest: ArchiveManifest): boolean {
  const href = node.properties?.href
  if (typeof href !== "string" || !href.startsWith("http") || !isExternalLink(href)) {
    return false
  }

  let canonical: string
  try {
    canonical = canonicalizeUrl(href)
  } catch {
    // A malformed href can't be in the manifest; leave the link untouched
    // rather than crashing the build.
    return false
  }

  const entry = manifest.get(canonical)
  if (!entry || !entry.dead || !entry.archive_url) {
    // A dead entry with an empty archive_url has no snapshot to point at;
    // rewriting would set href="". Leave the (broken) live link in place.
    return false
  }

  // The snapshot is the same document with the same element ids, so carrying
  // the fragment over keeps deep links (e.g. #section) working.
  const { hash } = new URL(href)
  node.properties.href = `${entry.archive_url}${hash}`
  node.properties["data-original-href"] = href
  if (node.properties.title === undefined) {
    // The CSS "archived" marker is visual-only; the title explains the swap to
    // screen readers and on hover. An author-set title is left alone.
    node.properties.title = `Dead link; serving an archived copy. Original: ${href}`
  }
  const classes = (node.properties.className ?? []) as string[]
  if (!classes.includes(ARCHIVED_LINK_CLASS)) {
    classes.push(ARCHIVED_LINK_CLASS)
  }
  node.properties.className = classes
  return true
}

export interface ArchiveLinksOptions {
  manifestPath: string
}

/**
 * Build-time fallback for rotted outbound links. Must run after `CrawlLinks`,
 * which normalizes external hrefs to absolute `https://` and adds the
 * `external` class this transformer relies on. The manifest is read once per
 * build.
 */
export const ArchiveLinks: QuartzTransformerPlugin<Partial<ArchiveLinksOptions> | undefined> = (
  userOpts,
) => {
  const filePath = userOpts?.manifestPath ?? manifestPath

  return {
    name: "ArchiveLinks",
    htmlPlugins() {
      const manifest = loadArchiveManifest(filePath)
      return [
        () => {
          return (tree: Root) => {
            visit(tree, "element", (node) => {
              if (node.tagName === "a") {
                rewriteArchivedLink(node, manifest)
              }
            })
          }
        },
      ]
    },
  }
}
