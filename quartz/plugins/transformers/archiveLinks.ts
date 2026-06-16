import type { Element, Root } from "hast"

import gitRoot from "find-git-root"
import fs from "fs/promises"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

import type { QuartzTransformerPlugin } from "../types"

import { isExternalLink } from "./links"

const projectRoot = path.dirname(gitRoot(fileURLToPath(import.meta.url)))

/** Committed source of truth for archived external links (keyed by canonical URL). */
export const manifestPath = path.join(projectRoot, "config", "link_archive_manifest.json")

/** Class added to an `<a>` whose `href` was swapped for its archived copy. */
export const ARCHIVED_LINK_CLASS = "archived"

export interface ArchiveManifestEntry {
  archive_url: string
  dead: boolean
  dead_strikes: number
  last_status: number
  last_checked: string
}

export type ArchiveManifest = ReadonlyMap<string, ArchiveManifestEntry>

/**
 * Canonical URL form shared with `scripts/archive_links.py`. The Python
 * extractor, the manifest key, and this transformer must agree exactly, so both
 * sides parse with plain string ops — deliberately NOT `new URL`, whose extra
 * normalization (default-port stripping, IDN punycoding, percent-encoding)
 * would silently diverge from Python's `urlsplit` and break key matching.
 *
 * Rule (mirrored by fixture tests on both sides): force `https`, lowercase the
 * `host[:port]` and drop userinfo, drop a single trailing `/`, drop the
 * `#fragment`, keep the query verbatim.
 */
export function canonicalizeUrl(href: string): string {
  const schemeMatch = /^[a-z][a-z0-9+.-]*:\/\//i.exec(href)
  if (!schemeMatch) {
    return href
  }
  const afterScheme = href.slice(schemeMatch[0].length)

  const authorityEnd = afterScheme.search(/[/?#]/)
  const authorityRaw = authorityEnd === -1 ? afterScheme : afterScheme.slice(0, authorityEnd)
  const authority = authorityRaw.slice(authorityRaw.lastIndexOf("@") + 1).toLowerCase()

  let rest = authorityEnd === -1 ? "" : afterScheme.slice(authorityEnd)
  const hashIndex = rest.indexOf("#")
  if (hashIndex !== -1) {
    rest = rest.slice(0, hashIndex)
  }
  const queryIndex = rest.indexOf("?")
  let pathname = queryIndex === -1 ? rest : rest.slice(0, queryIndex)
  // A bare trailing "?" carries no query; drop it to match Python's urlsplit.
  const rawQuery = queryIndex === -1 ? "" : rest.slice(queryIndex)
  const query = rawQuery === "?" ? "" : rawQuery
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1)
  }

  return `https://${authority}${pathname}${query}`
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
    manifest.set(key, {
      archive_url: entry.archive_url,
      dead: entry.dead,
      dead_strikes: Number(entry.dead_strikes ?? 0),
      last_status: Number(entry.last_status ?? 0),
      last_checked: String(entry.last_checked ?? ""),
    })
  }
  return manifest
}

/** Missing manifest → empty map; other I/O errors propagate. */
export async function loadArchiveManifest(
  filePath: string = manifestPath,
): Promise<ArchiveManifest> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, "utf-8")
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

  const entry = manifest.get(canonicalizeUrl(href))
  if (!entry || !entry.dead) {
    return false
  }

  node.properties.href = entry.archive_url
  node.properties["data-original-href"] = href
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
 * `external` class this transformer relies on.
 */
export const ArchiveLinks: QuartzTransformerPlugin<Partial<ArchiveLinksOptions> | undefined> = (
  userOpts,
) => {
  const filePath = userOpts?.manifestPath ?? manifestPath
  let cachedManifest: Promise<ArchiveManifest> | null = null

  return {
    name: "ArchiveLinks",
    htmlPlugins() {
      return [
        () => {
          return async (tree: Root) => {
            cachedManifest ??= loadArchiveManifest(filePath)
            const manifest = await cachedManifest
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
