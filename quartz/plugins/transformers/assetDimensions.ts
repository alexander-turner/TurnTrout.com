import type { Element, ElementContent, Root } from "hast"

import { spawnSync } from "child_process"
import gitRoot from "find-git-root"
import fs from "fs/promises"
import sizeOf from "image-size"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"
import { VFile } from "vfile"

import { createLogger } from "./logger_utils"

export class FFprobeNotInstalledError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FFprobeNotInstalledError"
  }
}

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
const USER_CDN_HOSTNAME = "assets.turntrout.com"

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
  [url: string]: AssetDimensions | undefined
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

    try {
      await fs.writeFile(tempFilePath, data, "utf-8")
      await fs.rename(tempFilePath, ASSET_DIMENSIONS_FILE_PATH)
      needToSaveCache = false
      console.log("Asset dimensions cache saved.")
    } catch (error) {
      console.error("Failed to save asset dimensions cache:", error)
    }
  }
}

export async function getAssetDimensionsFfprobe(assetUrl: string): Promise<AssetDimensions | null> {
  try {
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
        assetUrl,
      ],
      { encoding: "utf-8" },
    )
    if (ffprobe.error) {
      if ((ffprobe.error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FFprobeNotInstalledError(
          "ffprobe command not found. Please install ffmpeg to get dimensions for assets.",
        )
      } else {
        console.error(`Error spawning ffprobe: ${ffprobe.error.message}`)
      }
      return null
    }

    if (ffprobe.status !== 0) {
      console.error(`ffprobe exited with status ${ffprobe.status}: ${ffprobe.stderr}`)
      return null
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

    console.warn(`Could not parse dimensions from ffprobe output: ${output}`)
    return null
  } catch (error) {
    if (error instanceof FFprobeNotInstalledError) {
      throw error
    }
    console.error("Error during ffprobe processing:", error)
    return null
  }
}

export async function fetchAndParseAssetDimensions(
  assetUrl: string,
): Promise<AssetDimensions | null> {
  try {
    const response = await fetch(assetUrl)
    if (!response.ok) {
      console.warn(`Failed to fetch asset ${assetUrl}: ${response.status} ${response.statusText}`)
      return null
    }
    const contentType = response.headers.get("Content-Type")
    const isSvg = contentType === "image/svg+xml" || assetUrl.endsWith(".svg")

    if (!isSvg && (contentType?.startsWith("video/") || contentType?.startsWith("image/"))) {
      // don't need the response body, so cancel it to free resources
      response.body?.cancel()
      const dimensions = await getAssetDimensionsFfprobe(assetUrl)
      if (dimensions) {
        logger.debug(
          `Successfully fetched dimensions for ${assetUrl}: ${dimensions.width}x${dimensions.height}`,
        )
        return dimensions
      } else {
        console.warn(`Could not get dimensions for ${assetUrl} using ffprobe.`)
        return null
      }
    } else {
      // Fallback for SVGs and other types
      const assetBuffer = Buffer.from(await response.arrayBuffer())
      const dimensions = sizeOf(assetBuffer)
      if (
        dimensions &&
        typeof dimensions.width === "number" &&
        typeof dimensions.height === "number"
      ) {
        logger.debug(
          `Successfully fetched dimensions for ${assetUrl}: ${dimensions.width}x${dimensions.height}`,
        )
        return { width: dimensions.width, height: dimensions.height }
      } else {
        console.warn(
          `Could not determine dimensions from asset data for ${assetUrl}. Type: ${dimensions?.type}`,
        )
      }
    }
  } catch (error) {
    if (error instanceof FFprobeNotInstalledError) {
      throw error
    }
    console.error(`Error fetching or parsing dimensions for ${assetUrl}:`, error)
  }
  return null
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
  file: VFile,
): Promise<void> {
  const { node, src } = assetInfo
  let dims = currentDimensionsCache[src]

  if (!dims) {
    try {
      const assetUrl = new URL(src)
      if (assetUrl.hostname === USER_CDN_HOSTNAME) {
        const fetchedDims = await fetchAndParseAssetDimensions(src)
        if (fetchedDims) {
          dims = fetchedDims
          currentDimensionsCache[src] = fetchedDims
          needToSaveCache = true
        }
      }
    } catch (e: unknown) {
      if (e instanceof FFprobeNotInstalledError) {
        throw e
      }
      const errorMessage = e instanceof Error ? e.message : String(e)
      console.warn(
        `Skipping dimension fetching for ${src} in file ${file.path}. Error: ${errorMessage}`,
      )
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

export const addAssetDimensionsFromUrl = () => {
  return {
    name: "AddAssetDimensionsFromUrl",
    async buildEnd(): Promise<void> {
      await maybeSaveAssetDimensions()
    },
    htmlPlugins() {
      return [
        () => {
          return async (tree: Root, file: VFile) => {
            const currentDimensionsCache = await maybeLoadDimensionCache()
            const assetsToProcess = collectAssetNodes(tree)

            for (const assetInfo of assetsToProcess) {
              await processAsset(assetInfo, currentDimensionsCache, file)
            }
          }
        },
      ]
    },
  }
}
