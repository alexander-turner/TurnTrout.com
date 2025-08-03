import type { Element, ElementContent, Root } from "hast"

import { spawnSync, type SpawnSyncReturns } from "child_process"
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
export const paths = {
  _filepath: __filepath,
  projectRoot,
  assetDimensions: path.join(
    projectRoot,
    "quartz",
    "plugins",
    "transformers",
    ".asset_dimensions.json",
  ),
}

// TODO add to paths?
export const ASSET_DIMENSIONS_FILE_PATH = path.join(
  paths.projectRoot,
  "quartz",
  "plugins",
  "transformers",
  ".asset_dimensions.json",
)

export interface AssetDimensions {
  width: number
  height: number
}

export interface AssetDimensionMap {
  [src: string]: AssetDimensions | undefined
}

class AssetProcessor {
  private spawnSyncWrapper: typeof spawnSync
  private assetDimensionsCache: AssetDimensionMap | null = null
  private needToSaveCache = false

  constructor(spawnFn: typeof spawnSync = spawnSync) {
    this.spawnSyncWrapper = spawnFn
  }

  public resetDirectCacheAndDirtyFlag(): void {
    this.assetDimensionsCache = null
    this.needToSaveCache = false
  }

  public setDirectCache(cache: AssetDimensionMap | null): void {
    this.assetDimensionsCache = cache
  }

  public setDirectDirtyFlag(isDirty: boolean): void {
    this.needToSaveCache = isDirty
  }

  public async maybeLoadDimensionCache(): Promise<AssetDimensionMap> {
    if (this.assetDimensionsCache !== null) {
      return this.assetDimensionsCache
    }
    try {
      const data = await fs.readFile(paths.assetDimensions, "utf-8")
      this.assetDimensionsCache = JSON.parse(data) as AssetDimensionMap
      console.log("Asset dimensions cache loaded.")
    } catch (error) {
      console.warn(
        `Could not load asset dimension cache from ${paths.assetDimensions}: ${error}. Starting fresh.`,
      )
      this.assetDimensionsCache = {}
    }
    return this.assetDimensionsCache
  }

  public async maybeSaveAssetDimensions(): Promise<void> {
    if (this.assetDimensionsCache && this.needToSaveCache) {
      const tempFilePath = `${paths.assetDimensions}.tmp`
      const data = JSON.stringify(this.assetDimensionsCache, null, 2)

      await fs.writeFile(tempFilePath, data, "utf-8")
      await fs.rename(tempFilePath, paths.assetDimensions)
      this.needToSaveCache = false
      console.log("Asset dimensions cache saved.")
    }
  }

  public async getAssetDimensionsFfprobe(assetSrc: string): Promise<AssetDimensions | null> {
    const ffprobe: SpawnSyncReturns<string> = this.spawnSyncWrapper(
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

    throw new Error(`Could not parse dimensions from ffprobe output: ${output}`)
  }

  /**
   * Determine whether a given source string points to a remote (HTTP/S) resource.
   * Any non-HTTP(S) protocol (including "file://" and relative or absolute paths) is considered local.
   */
  private static isRemoteUrl(src: string): boolean {
    try {
      const parsed = new URL(src)
      return parsed.protocol === "http:" || parsed.protocol === "https:"
    } catch {
      // If URL constructor throws, treat as local path
      return false
    }
  }

  private static async resolveLocalAssetPath(src: string): Promise<string> {
    if (src.startsWith("file://")) {
      const localPath = fileURLToPath(src)
      await fs.access(localPath)
      return localPath
    }

    let localPath = src
    if (localPath.startsWith("/")) {
      // Treat as relative to the project root
      localPath = path.join(paths.projectRoot, "quartz", localPath.substring(1))
    } else if (!path.isAbsolute(localPath)) {
      // Assumes asset is in website_content for relative paths
      localPath = path.join(paths.projectRoot, "website_content", localPath)
    }
    await fs.access(localPath)
    return localPath
  }

  // Get dimensions for a local asset: use ffprobe for videos, image-size for images/SVGs
  private async getLocalAssetDimensions(assetSrc: string): Promise<AssetDimensions> {
    const localPath = await AssetProcessor.resolveLocalAssetPath(assetSrc)
    const ext = path.extname(localPath).toLowerCase()
    const videoExts = new Set([".mp4", ".mov", ".m4v", ".webm", ".mpeg", ".mpg", ".avi", ".mkv"])
    if (videoExts.has(ext)) {
      const dims = await this.getAssetDimensionsFfprobe(localPath)
      if (!dims) throw new Error(`Could not get dimensions for local video asset ${assetSrc}`)
      logger.debug(`Local video dimensions for ${assetSrc}: ${dims.width}x${dims.height}`)
      return dims
    }

    const buffer = await fs.readFile(localPath)
    const dimensions = sizeOf(buffer)
    if (
      dimensions &&
      typeof dimensions.width === "number" &&
      typeof dimensions.height === "number"
    ) {
      logger.debug(
        `Local image dimensions for ${assetSrc}: ${dimensions.width}x${dimensions.height}`,
      )
      return { width: dimensions.width, height: dimensions.height }
    }
    throw new Error(
      `Unable to determine local asset dimensions for ${assetSrc}. Type: ${dimensions?.type}`,
    )
  }

  // Get dimensions for a remote asset: fetch + ffprobe or image-size fallback
  private async getRemoteAssetDimensions(
    assetSrc: string,
    retries = 1,
    delay = 1000,
  ): Promise<AssetDimensions> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(assetSrc)
        if (!response.ok) {
          throw new Error(
            `Failed to fetch asset ${assetSrc}: ${response.status} ${response.statusText}`,
          )
        }

        const contentType = response.headers.get("Content-Type")
        const isSvgRemote = contentType === "image/svg+xml" || assetSrc.endsWith(".svg")
        if (
          !isSvgRemote &&
          (contentType?.startsWith("video/") || contentType?.startsWith("image/"))
        ) {
          response.body?.cancel()
          const dims = await this.getAssetDimensionsFfprobe(assetSrc)
          if (!dims) throw new Error(`ffprobe failed for ${assetSrc}`)

          logger.debug(`Remote ffprobe dimensions for ${assetSrc}: ${dims.width}x${dims.height}`)
          return dims
        }

        const buffer = Buffer.from(await response.arrayBuffer())
        const dimensions = sizeOf(buffer)
        if (
          dimensions &&
          typeof dimensions.width === "number" &&
          typeof dimensions.height === "number"
        ) {
          logger.debug(
            `Remote image dimensions for ${assetSrc}: ${dimensions.width}x${dimensions.height}`,
          )
          return { width: dimensions.width, height: dimensions.height }
        }
        throw new Error(
          `Unable to determine remote asset dimensions for ${assetSrc}. Type: ${dimensions?.type}`,
        )
      } catch (error) {
        if (i === retries - 1) throw error
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)))
      }
    }
    throw new Error(`Failed to fetch ${assetSrc} after ${retries} attempts.`)
  }

  public async fetchAndParseAssetDimensions(
    assetSrc: string,
    retries = 1,
  ): Promise<AssetDimensions | null> {
    return AssetProcessor.isRemoteUrl(assetSrc)
      ? await this.getRemoteAssetDimensions(assetSrc, retries)
      : await this.getLocalAssetDimensions(assetSrc)
  }

  /** Returns the src of a video element or that of its first source child.
   * In this project, each video element should have two source elements, one for mp4 and one for webm.
   */
  public static getVideoSource(node: Element): string | undefined {
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

  public imageTagsToProcess = ["img", "svg"]
  public collectAssetNodes(tree: Root): { node: Element; src: string }[] {
    const imageAssetsToProcess: { node: Element; src: string }[] = []
    visit(tree, "element", (node: Element) => {
      if (
        this.imageTagsToProcess.includes(node.tagName) &&
        node.properties?.src &&
        typeof node.properties.src === "string"
      ) {
        imageAssetsToProcess.push({ node, src: node.properties.src })
      }
    })

    const videoAssetsToProcess: { node: Element; src: string }[] = []
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "video") {
        const src = AssetProcessor.getVideoSource(node)
        if (src) {
          videoAssetsToProcess.push({ node, src })
        }
      }
    })

    return [...imageAssetsToProcess, ...videoAssetsToProcess]
  }

  public async processAsset(
    assetInfo: { node: Element; src: string },
    currentDimensionsCache: AssetDimensionMap,
    retries = 1,
  ): Promise<void> {
    const { node, src } = assetInfo
    let dims = currentDimensionsCache[src]

    if (!dims) {
      const fetchedDims = await this.fetchAndParseAssetDimensions(src, retries)
      if (fetchedDims) {
        dims = fetchedDims
        currentDimensionsCache[src] = fetchedDims
        this.needToSaveCache = true
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
}

export const assetProcessor = new AssetProcessor()

// --- Test Helper Exports ---
export { AssetProcessor }
export function setSpawnSyncForTesting(fn: typeof spawnSync): void {
  // Replace the default assetProcessor with a new one that uses the mock spawn function
  Object.assign(assetProcessor, new AssetProcessor(fn))
}

export const addAssetDimensionsFromSrc = () => {
  return {
    name: "AddAssetDimensionsFromSrc",
    htmlPlugins() {
      return [
        () => {
          return async (tree: Root) => {
            const currentDimensionsCache = await assetProcessor.maybeLoadDimensionCache()
            const assetsToProcess = assetProcessor.collectAssetNodes(tree)

            for (const assetInfo of assetsToProcess) {
              await assetProcessor.processAsset(assetInfo, currentDimensionsCache, 3)
            }
            if (assetProcessor["needToSaveCache"]) {
              await assetProcessor.maybeSaveAssetDimensions()
              assetProcessor["needToSaveCache"] = false
            }
          }
        },
      ]
    },
  }
}
