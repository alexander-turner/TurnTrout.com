import type { Element, Root } from "hast"

import gitRoot from "find-git-root"
import fs from "fs/promises"
import sizeOf from "image-size"
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
  "asset_dimensions.json",
)
const USER_CDN_HOSTNAME = "assets.turntrout.com"

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
    const imageBuffer = Buffer.from(arrayBuffer)
    const dimensions = sizeOf(imageBuffer)

    if (
      dimensions &&
      typeof dimensions.width === "number" &&
      typeof dimensions.height === "number"
    ) {
      console.log(
        `Successfully fetched dimensions for ${assetUrl}: ${dimensions.width}x${dimensions.height}`,
      )
      return { width: dimensions.width, height: dimensions.height }
    } else {
      console.warn(
        `Could not determine dimensions from asset data for ${assetUrl}. Type: ${dimensions.type}`,
      )
    }
  } catch (error) {
    console.error(`Error fetching or parsing dimensions for ${assetUrl}:`, error)
  }
  return null
}

export function collectAssetNodes(tree: Root): { node: Element; src: string }[] {
  const assetsToProcess: { node: Element; src: string }[] = []
  visit(tree, "element", (node: Element) => {
    if (node.tagName === "img" && node.properties?.src && typeof node.properties.src === "string") {
      assetsToProcess.push({ node, src: node.properties.src })
    }
  })
  return assetsToProcess
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

// --- Test Helper Exports (Re-added) ---
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
