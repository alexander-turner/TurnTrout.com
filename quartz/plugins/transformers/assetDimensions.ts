import type { Element, ElementContent, Root } from "hast"

import { spawnSync } from "child_process"
import gitRoot from "find-git-root"
import fs from "fs/promises"
import sizeOf from "image-size"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"

import { createLogger } from "./logger_utils"

const logger = createLogger("assetDimensions")

const __filepath = fileURLToPath(import.meta.url)
const projectRoot = path.dirname(gitRoot(__filepath))

export const ASSET_DIMENSIONS_FILE_PATH = path.join(
  projectRoot,
  "quartz",
  "plugins",
  "transformers",
  ".asset_dimensions.json",
)

// --- Test Helper Exports ---
export let spawnSyncWrapper: typeof spawnSync = spawnSync
export function setSpawnSyncForTesting(fn: typeof spawnSync): void {
  spawnSyncWrapper = fn
}

export function resetDirectCacheAndDirtyFlag(): void {
  assetDimensionsCache = null
  needToSaveCache = false
}

export function setDirectCache(cache: AssetDimensionMap | null): void {
  assetDimensionsCache = cache
}

export function setDirectDirtyFlag(isDirty: boolean): void {
  needToSaveCache = isDirty
}

export interface AssetDimensions {
  width: number
  height: number
}

export interface AssetDimensionMap {
  [src: string]: AssetDimensions | undefined
}

export let assetDimensionsCache: AssetDimensionMap | null = null
export let needToSaveCache = false

export async function maybeLoadDimensionCache(): Promise<AssetDimensionMap> {
  if (assetDimensionsCache !== null) {
    return assetDimensionsCache
  }
  try {
    const data = await fs.readFile(ASSET_DIMENSIONS_FILE_PATH, "utf-8")
    assetDimensionsCache = JSON.parse(data) as AssetDimensionMap
    console.log("Asset dimensions cache loaded.")
  } catch (error) {
    console.warn(
      `Could not load asset dimension cache from ${ASSET_DIMENSIONS_FILE_PATH}: ${error}. Starting fresh.`,
    )
    assetDimensionsCache = {}
  }
  return assetDimensionsCache
}

export async function maybeSaveAssetDimensions(): Promise<void> {
  if (assetDimensionsCache && needToSaveCache) {
    const tempFilePath = ASSET_DIMENSIONS_FILE_PATH + ".tmp"
    const data = JSON.stringify(assetDimensionsCache, null, 2)

    await fs.writeFile(tempFilePath, data, "utf-8")
    await fs.rename(tempFilePath, ASSET_DIMENSIONS_FILE_PATH)
    needToSaveCache = false
    console.log("Asset dimensions cache saved.")
  }
}

export async function getAssetDimensionsFfprobe(assetSrc: string): Promise<AssetDimensions | null> {
  const ffprobe = spawnSyncWrapper(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=s=x:p=0",
      assetSrc,
    ],
    { encoding: "utf-8" },
  )
  if (ffprobe.error) {
    if ((ffprobe.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "ffprobe command not found. Please install ffmpeg to get dimensions for assets.",
      )
    } else {
      throw new Error(`Error spawning ffprobe: ${ffprobe.error.message}`)
    }
  }

  const output = ffprobe.stdout.trim()
  const dimensionsMatch = output.match(/^(\d+)x(\d+)/)

  if (dimensionsMatch) {
    const width = parseInt(dimensionsMatch[1], 10)
    const height = parseInt(dimensionsMatch[2], 10)
    if (!isNaN(width) && !isNaN(height)) {
      return { width, height }
    }
  }

  console.error("ffprobe stdout:", ffprobe.stdout)
  console.error("ffprobe stderr:", ffprobe.stderr)
  throw new Error(`Could not parse dimensions from ffprobe output: ${output}`)
}

export async function fetchAndParseAssetDimensions(
  assetSrc: string,
): Promise<AssetDimensions | null> {
  const response = await fetch(assetSrc)
  if (!response.ok) {
    throw new Error(`Failed to fetch asset ${assetSrc}: ${response.status} ${response.statusText}`)
  }
  const contentType = response.headers.get("Content-Type")
  const isSvg = contentType === "image/svg+xml" || assetSrc.endsWith(".svg")

  if (!isSvg && (contentType?.startsWith("video/") || contentType?.startsWith("image/"))) {
    // don't need the response body, so cancel it to free resources
    response.body?.cancel()
    const dimensions = await getAssetDimensionsFfprobe(assetSrc)
    if (dimensions) {
      logger.debug(
        `Successfully fetched dimensions for ${assetSrc}: ${dimensions.width}x${dimensions.height}`,
      )
      return dimensions
    }
    throw new Error(`Could not get dimensions for ${assetSrc} using ffprobe.`)
  }

  // sizeOf fallback for SVGs and other types
  const assetBuffer = Buffer.from(await response.arrayBuffer())
  const dimensions = sizeOf(assetBuffer)
  if (dimensions && typeof dimensions.width === "number" && typeof dimensions.height === "number") {
    logger.debug(
      `Successfully fetched dimensions for ${assetSrc}: ${dimensions.width}x${dimensions.height}`,
    )
    return { width: dimensions.width, height: dimensions.height }
  }
  throw new Error(
    `Could not determine dimensions from asset data for ${assetSrc}. Type: ${dimensions?.type}`,
  )
}

/** Returns the src of a video element or that of its first source child.
 * In this project, each video element should have two source elements, one for mp4 and one for webm.
 */
export function getVideoSource(node: Element): string | undefined {
  const directSrc = node.properties?.src as string | undefined
  if (directSrc) {
    return directSrc
  }

  const source = node.children.find(
    (child: ElementContent) => child.type === "element" && child.tagName === "source",
  ) as Element | undefined
  if (source && source.properties?.src && typeof source.properties.src === "string") {
    return source.properties.src
  }
  return undefined
}

export const imageTagsToProcess = ["img", "svg"]
export function collectAssetNodes(tree: Root): { node: Element; src: string }[] {
  const imageAssetsToProcess: { node: Element; src: string }[] = []
  visit(tree, "element", (node: Element) => {
    if (
      imageTagsToProcess.includes(node.tagName) &&
      node.properties?.src &&
      typeof node.properties.src === "string"
    ) {
      imageAssetsToProcess.push({ node, src: node.properties.src })
    }
  })

  const videoAssetsToProcess: { node: Element; src: string }[] = []
  visit(tree, "element", (node: Element) => {
    if (node.tagName === "video") {
      const src = getVideoSource(node)
      if (src) {
        videoAssetsToProcess.push({ node, src })
      }
    }
  })

  return [...imageAssetsToProcess, ...videoAssetsToProcess]
}

export async function processAsset(
  assetInfo: { node: Element; src: string },
  currentDimensionsCache: AssetDimensionMap,
): Promise<void> {
  const { node, src } = assetInfo
  let dims = currentDimensionsCache[src]

  if (!dims) {
    const fetchedDims = await fetchAndParseAssetDimensions(src)
    if (fetchedDims) {
      dims = fetchedDims
      currentDimensionsCache[src] = fetchedDims
      needToSaveCache = true
    }
  }

  if (dims && dims.width > 0 && dims.height > 0) {
    node.properties = node.properties || {}
    node.properties.width = dims.width
    node.properties.height = dims.height

    // Add or prepend aspect-ratio to the style attribute
    const existingStyle = typeof node.properties.style === "string" ? node.properties.style : ""
    const aspectRatioStyle = `aspect-ratio: ${dims.width} / ${dims.height};`
    // Ensure a space if existingStyle is not empty and doesn't end with a semicolon or space
    const separator =
      existingStyle && !existingStyle.endsWith(";") && !existingStyle.endsWith(" ") ? " " : ""
    node.properties.style = `${aspectRatioStyle}${separator}${existingStyle}`.trim()
  }
}

export const addAssetDimensionsFromSrc = () => {
  return {
    name: "AddAssetDimensionsFromSrc",
    htmlPlugins() {
      return [
        () => {
          return async (tree: Root) => {
            const currentDimensionsCache = await maybeLoadDimensionCache()
            const assetsToProcess = collectAssetNodes(tree)

            for (const assetInfo of assetsToProcess) {
              await processAsset(assetInfo, currentDimensionsCache)
            }
            if (needToSaveCache) {
              await maybeSaveAssetDimensions()
              needToSaveCache = false
            }
          }
        },
      ]
    },
  }
}
