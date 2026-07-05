import type { Element, Root } from "hast"

import path from "path"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

import { addClassesOnce } from "../../util/hast"
import { projectRoot, readManifestFile } from "../../util/manifests"
import { tryCanonicalizeUrl } from "../../util/urls"
import { isExternalLink } from "./links"

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
export function loadArchiveManifest(filePath: string = manifestPath): ArchiveManifest {
  const raw = readManifestFile(filePath)
  if (raw === null) return new Map()
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

  const canonical = tryCanonicalizeUrl(href)
  if (canonical === null) {
    return false
  }

  const entry = manifest.get(canonical)
  if (!entry || !entry.dead || !entry.archive_url) {
    // A dead entry with an empty archive_url has no snapshot to point at;
    // rewriting would set href="". Leave the (broken) live link in place.
    return false
  }

  node.properties.href = entry.archive_url
  node.properties["data-original-href"] = href
  addClassesOnce(node, [ARCHIVED_LINK_CLASS])
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
