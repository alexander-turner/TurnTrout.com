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

export const IMAGE_DIMENSIONS_FILE_PATH = path.join(
  projectRoot,
  "quartz",
  "plugins",
  "transformers",
  "image_dimensions.json",
)
const USER_CDN_HOSTNAME = "assets.turntrout.com"

export interface ImageDimensions {
  width: number
  height: number
}

export interface ImageDimensionsMap {
  [url: string]: ImageDimensions | undefined
}

export let imageDimensionsCache: ImageDimensionsMap | null = null
export let needToSaveCache = false

export async function maybeLoadDimensionCache(): Promise<ImageDimensionsMap> {
  if (imageDimensionsCache !== null) {
    return imageDimensionsCache
  }
  try {
    const data = await fs.readFile(IMAGE_DIMENSIONS_FILE_PATH, "utf-8")
    imageDimensionsCache = JSON.parse(data) as ImageDimensionsMap
    console.log("Image dimensions cache loaded.")
  } catch (error) {
    console.warn(
      `Could not load image dimension cache from ${IMAGE_DIMENSIONS_FILE_PATH}: ${error}. Starting fresh.`,
    )
    imageDimensionsCache = {}
  }
  return imageDimensionsCache
}

export async function maybeSaveImageDimensions(): Promise<void> {
  if (imageDimensionsCache && needToSaveCache) {
    try {
      const data = JSON.stringify(imageDimensionsCache, null, 2)
      await fs.writeFile(IMAGE_DIMENSIONS_FILE_PATH, data, "utf-8")
      needToSaveCache = false
      console.log("Image dimensions cache saved.")
    } catch (error) {
      console.error("Failed to save image dimensions cache:", error)
    }
  }
}

export async function fetchAndParseImageDimensions(
  imageUrl: string,
): Promise<ImageDimensions | null> {
  console.log(`Fetching dimensions for: ${imageUrl}`)
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.warn(`Failed to fetch image ${imageUrl}: ${response.status} ${response.statusText}`)
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
        `Successfully fetched dimensions for ${imageUrl}: ${dimensions.width}x${dimensions.height}`,
      )
      return { width: dimensions.width, height: dimensions.height }
    } else {
      console.warn(
        `Could not determine dimensions from image data for ${imageUrl}. Type: ${dimensions.type}`,
      )
    }
  } catch (error) {
    console.error(`Error fetching or parsing dimensions for ${imageUrl}:`, error)
  }
  return null
}

export function collectImageNodes(tree: Root): { node: Element; src: string }[] {
  const imagesToProcess: { node: Element; src: string }[] = []
  visit(tree, "element", (node: Element) => {
    if (node.tagName === "img" && node.properties?.src && typeof node.properties.src === "string") {
      imagesToProcess.push({ node, src: node.properties.src })
    }
  })
  return imagesToProcess
}

export async function processSingleImage(
  imageInfo: { node: Element; src: string },
  currentDimensionsCache: ImageDimensionsMap,
  file: VFile,
): Promise<void> {
  const { node, src } = imageInfo
  let imageDims = currentDimensionsCache[src]

  if (!imageDims) {
    try {
      const imageUrl = new URL(src)
      if (imageUrl.hostname === USER_CDN_HOSTNAME) {
        const fetchedDims = await fetchAndParseImageDimensions(src)
        if (fetchedDims) {
          imageDims = fetchedDims
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

  if (imageDims && imageDims.width > 0 && imageDims.height > 0) {
    node.properties = node.properties || {}
    node.properties.width = imageDims.width
    node.properties.height = imageDims.height
  }
}

export const addImageDimensionsFromUrl = () => {
  return {
    name: "AddImageDimensionsFromUrl",
    htmlPlugins() {
      return [
        () => {
          return async (tree: Root, file: VFile) => {
            const currentDimensionsCache = await maybeLoadDimensionCache()
            const imagesToProcess = collectImageNodes(tree)

            for (const imageInfo of imagesToProcess) {
              await processSingleImage(imageInfo, currentDimensionsCache, file)
            }

            await maybeSaveImageDimensions()
          }
        },
      ]
    },
  }
}

// --- Test Helper Exports (Re-added) ---
export function resetDirectCacheAndDirtyFlag(): void {
  imageDimensionsCache = null
  needToSaveCache = false
}

export function setDirectCache(cache: ImageDimensionsMap | null): void {
  imageDimensionsCache = cache
}

export function setDirectDirtyFlag(isDirty: boolean): void {
  needToSaveCache = isDirty
}
