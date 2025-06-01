import type { Element, ElementContent, Root } from "hast"

import { spawnSync } from "child_process"
import gitRoot from "find-git-root"
import fs from "fs/promises"
import sizeOf from "image-size"
import os from "os"
import path from "path"
import { visit } from "unist-util-visit"
import { fileURLToPath } from "url"
import { VFile } from "vfile"

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
    try {
      const data = JSON.stringify(assetDimensionsCache, null, 2)
      await fs.writeFile(ASSET_DIMENSIONS_FILE_PATH, data, "utf-8")
      needToSaveCache = false
      console.log("Asset dimensions cache saved.")
    } catch (error) {
      console.error("Failed to save asset dimensions cache:", error)
    }
  }
}

export async function getVideoDimensionsFfprobe(
  videoBuffer: Buffer,
): Promise<AssetDimensions | null> {
  let tempDir: string | undefined = undefined
  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "quartz-video-"))
    const tempFilePath = path.join(tempDir, "video.tmp")
    await fs.writeFile(tempFilePath, videoBuffer)

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
        tempFilePath,
      ],
      { encoding: "utf-8" },
    )
    if (ffprobe.error) {
      if ((ffprobe.error as NodeJS.ErrnoException).code === "ENOENT") {
        console.warn(
          "ffprobe command not found. Please install ffmpeg to get dimensions for video files.",
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
    const dimensionsMatch = output.match(/^(\d+)x(\d+)$/)

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
    console.error("Error during ffprobe processing:", error)
    return null
  } finally {
    if (tempDir) {
      const tempFilePath = path.join(tempDir, "video.tmp")
      await fs.unlink(tempFilePath)
      await fs.rmdir(tempDir)
    }
  }
}

export async function fetchAndParseAssetDimensions(
  assetUrl: string,
): Promise<AssetDimensions | null> {
  console.log(`Fetching dimensions for: ${assetUrl}`)
  try {
    const response = await fetch(assetUrl)
    if (!response.ok) {
      console.warn(`Failed to fetch asset ${assetUrl}: ${response.status} ${response.statusText}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    const assetBuffer = Buffer.from(arrayBuffer)

    // Determine content type to decide processing strategy
    const contentType = response.headers.get("Content-Type")

    if (contentType?.startsWith("video/")) {
      console.log(`Processing as video: ${assetUrl}`)
      // For videos, use ffprobe (which is mocked in tests)
      const videoDimensions = await getVideoDimensionsFfprobe(assetBuffer)
      if (videoDimensions) {
        console.log(
          `Successfully fetched video dimensions for ${assetUrl}: ${videoDimensions.width}x${videoDimensions.height}`,
        )
        return videoDimensions
      } else {
        console.warn(`Could not get video dimensions for ${assetUrl} using ffprobe.`)
        return null
      }
    } else {
      // For images (and other types as a fallback), use image-size
      console.log(`Processing as image/other: ${assetUrl}`)
      const dimensions = sizeOf(assetBuffer)
      if (
        dimensions &&
        typeof dimensions.width === "number" &&
        typeof dimensions.height === "number"
      ) {
        console.log(
          `Successfully fetched image dimensions for ${assetUrl}: ${dimensions.width}x${dimensions.height}`,
        )
        return { width: dimensions.width, height: dimensions.height }
      } else {
        console.warn(
          `Could not determine dimensions from asset data for ${assetUrl}. Type: ${dimensions?.type}`,
        )
      }
    }
  } catch (error) {
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
  console.log(videoAssetsToProcess.length)

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
  }
}

export const addAssetDimensionsFromUrl = () => {
  return {
    name: "AddAssetDimensionsFromUrl",
    htmlPlugins() {
      return [
        () => {
          return async (tree: Root, file: VFile) => {
            const currentDimensionsCache = await maybeLoadDimensionCache()
            const assetsToProcess = collectAssetNodes(tree)

            for (const assetInfo of assetsToProcess) {
              await processAsset(assetInfo, currentDimensionsCache, file)
            }

            await maybeSaveAssetDimensions()
          }
        },
      ]
    },
  }
}
