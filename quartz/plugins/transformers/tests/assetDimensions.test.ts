/**
 * @jest-environment node
 */
import type { Element, Root } from "hast"
import type {
  RequestInfo as NodeFetchRequestInfo,
  RequestInit as NodeFetchRequestInit,
  Response as NodeFetchResponse,
} from "node-fetch"

import { jest, expect, it, describe, beforeEach, afterEach } from "@jest/globals"
import fsExtra from "fs-extra"
import fs from "fs/promises"
import { h } from "hastscript"
import os from "os"
import path from "path"
import { VFile } from "vfile"

import * as assetDimensionsState from "../assetDimensions"
import {
  maybeLoadDimensionCache,
  maybeSaveAssetDimensions,
  fetchAndParseAssetDimensions,
  collectAssetNodes,
  processAsset,
  addAssetDimensionsFromUrl,
  type AssetDimensionMap,
  resetDirectCacheAndDirtyFlag,
  setDirectCache,
  setDirectDirtyFlag,
} from "../assetDimensions"
import { mockFetchResolve, mockFetchNetworkError } from "./test-utils"

type NodeFetchCompatibleSignature = (
  input: URL | NodeFetchRequestInfo,
  init?: NodeFetchRequestInit,
) => Promise<NodeFetchResponse>

// Create a minimal valid PNG file with IHDR chunk
const mockImageData = Buffer.from([
  // PNG signature
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  // IHDR chunk length (13 bytes)
  0x00, 0x00, 0x00, 0x0d,
  // IHDR chunk type
  0x49, 0x48, 0x44, 0x52,
  // Width (4 bytes) - 200
  0x00, 0x00, 0x00, 0xc8,
  // Height (4 bytes) - 150
  0x00, 0x00, 0x00, 0x96,
  // Bit depth (1 byte) - 8
  0x08,
  // Color type (1 byte) - 6 (RGBA)
  0x06,
  // Compression method (1 byte) - 0
  0x00,
  // Filter method (1 byte) - 0
  0x00,
  // Interlace method (1 byte) - 0
  0x00,
  // CRC (4 bytes) - dummy value
  0x00, 0x00, 0x00, 0x00,
])

// Define mock dimensions
const mockWidth = 200
const mockHeight = 150
const mockFetchedDims = { width: mockWidth, height: mockHeight }

// Create a single mock for image-size
const sizeOfMock = jest.fn().mockReturnValue({
  width: mockWidth,
  height: mockHeight,
  type: "png",
})

jest.mock("image-size", () => ({
  __esModule: true,
  default: sizeOfMock,
}))

const mockedFetch = jest.fn() as jest.MockedFunction<NodeFetchCompatibleSignature>
// Assign to global.fetch. The 'as unknown as typeof global.fetch' cast is used because
// NodeFetchCompatibleSignature and global.fetch's type aren't identical,
// but compatible for the subset of functionality used in assetDimensions.ts.
global.fetch = mockedFetch as unknown as typeof global.fetch

let tempDir: string

describe("Asset Dimensions Plugin", () => {
  const actualAssetDimensionsFilePath = assetDimensionsState.ASSET_DIMENSIONS_FILE_PATH

  beforeEach(async () => {
    tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "assetDimensions-test-files-"))
    mockedFetch.mockClear()
    sizeOfMock.mockClear()
    resetDirectCacheAndDirtyFlag()
  })

  afterEach(async () => {
    await fsExtra.remove(tempDir)
    jest.restoreAllMocks()
  })

  describe("maybeLoadDimensionCache", () => {
    it("should load an existing cache file", async () => {
      const mockCacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      const readFileSpy = jest
        .spyOn(fs, "readFile")
        .mockResolvedValue(JSON.stringify(mockCacheData) as never)

      const cache = await maybeLoadDimensionCache()
      expect(cache).toEqual(mockCacheData)
      expect(readFileSpy).toHaveBeenCalledWith(actualAssetDimensionsFilePath, "utf-8")
    })

    it("should return an empty object if cache file does not exist", async () => {
      const readFileSpy = jest
        .spyOn(fs, "readFile")
        .mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }) as never)
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

      const cache = await maybeLoadDimensionCache()
      expect(cache).toEqual({})
      expect(readFileSpy).toHaveBeenCalledWith(actualAssetDimensionsFilePath, "utf-8")
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not load asset dimension cache"),
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(actualAssetDimensionsFilePath),
      )
      consoleWarnSpy.mockRestore()
    })

    it("should return an empty object if cache file is malformed", async () => {
      const readFileSpy = jest.spyOn(fs, "readFile").mockResolvedValue("invalid json" as never)
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

      const cache = await maybeLoadDimensionCache()
      expect(cache).toEqual({})
      expect(readFileSpy).toHaveBeenCalledWith(actualAssetDimensionsFilePath, "utf-8")
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not load asset dimension cache"),
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(actualAssetDimensionsFilePath),
      )
      consoleWarnSpy.mockRestore()
    })

    it("should handle read errors gracefully", async () => {
      const readFileSpy = jest
        .spyOn(fs, "readFile")
        .mockRejectedValue(new Error("Permission denied") as never)
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

      const cache = await maybeLoadDimensionCache()
      expect(cache).toEqual({})
      expect(readFileSpy).toHaveBeenCalledWith(actualAssetDimensionsFilePath, "utf-8")
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not load asset dimension cache"),
      )
      consoleWarnSpy.mockRestore()
    })
  })

  describe("maybeSaveImageDimensions", () => {
    it("should save cache to file if cache is dirty", async () => {
      const cacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      setDirectCache(cacheData)
      setDirectDirtyFlag(true)

      const writeFileSpy = jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never)

      await maybeSaveAssetDimensions()

      expect(writeFileSpy).toHaveBeenCalledWith(
        actualAssetDimensionsFilePath,
        JSON.stringify(cacheData, null, 2),
        "utf-8",
      )
      expect(assetDimensionsState.needToSaveCache).toBe(false)
    })

    it("should not save cache if not dirty", async () => {
      setDirectCache({})
      setDirectDirtyFlag(false)
      const writeFileSpy = jest.spyOn(fs, "writeFile")

      await maybeSaveAssetDimensions()
      expect(writeFileSpy).not.toHaveBeenCalled()
    })

    it("should handle write errors gracefully", async () => {
      const cacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      setDirectCache(cacheData)
      setDirectDirtyFlag(true)

      const writeFileSpy = jest
        .spyOn(fs, "writeFile")
        .mockRejectedValue(new Error("Permission denied") as never)
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      await maybeSaveAssetDimensions()

      expect(writeFileSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to save asset dimensions cache:",
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe("fetchAndParseAssetDimensions", () => {
    const testImageUrl = "https://assets.turntrout.com/image.png"

    it("should fetch and parse dimensions successfully", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" })

      sizeOfMock.mockReturnValueOnce({
        width: mockWidth,
        height: mockHeight,
        type: "png",
      })

      const dimensions = await fetchAndParseAssetDimensions(testImageUrl)

      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)

      expect(dimensions).toEqual(mockFetchedDims)
    })

    it("should return null if fetch fails (e.g., 404)", async () => {
      mockFetchResolve(mockedFetch, "", 404, {}, "Not Found")
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
      const dimensions = await fetchAndParseAssetDimensions(testImageUrl)
      expect(dimensions).toBeNull()
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to fetch asset ${testImageUrl}: 404 Not Found`),
      )
      consoleWarnSpy.mockRestore()
    })

    it("should return null if image-size fails to parse", async () => {
      mockFetchResolve(mockedFetch, Buffer.from("fakeimagedata"))
      sizeOfMock.mockImplementation(() => {
        throw new Error("parsing error")
      })
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      const dimensions = await fetchAndParseAssetDimensions(testImageUrl)
      expect(dimensions).toBeNull()
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching or parsing dimensions for " + testImageUrl),
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })

    it("should return null if fetch results in network error", async () => {
      mockFetchNetworkError(mockedFetch, new Error("Network failure"))
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      const dimensions = await fetchAndParseAssetDimensions(testImageUrl)
      expect(dimensions).toBeNull()
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching or parsing dimensions for " + testImageUrl),
        expect.any(Error),
      )
      consoleErrorSpy.mockRestore()
    })

    it("should handle non-asset content type", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "text/plain" })
      const dimensions = await fetchAndParseAssetDimensions(testImageUrl)
      expect(dimensions).toEqual(mockFetchedDims)
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })
  })

  describe("collectAssetNodes", () => {
    it("should find all img elements with src attributes", () => {
      const tree: Root = {
        type: "root",
        children: [
          h("img", { src: "img1.png" }) as Element,
          h("p", [h("img", { src: "img2.jpg" }) as Element]) as Element,
          h("img") as Element,
          {
            type: "element",
            tagName: "div",
            properties: { src: "notanimage.png" },
            children: [],
          } as Element,
        ],
      }
      const collected = collectAssetNodes(tree)
      expect(collected).toHaveLength(2)
      expect(collected[0].src).toBe("img1.png")
      expect(collected[1].src).toBe("img2.jpg")
    })

    it("should handle empty tree", () => {
      const tree: Root = { type: "root", children: [] }
      const collected = collectAssetNodes(tree)
      expect(collected).toHaveLength(0)
    })

    it("should handle tree with no images", () => {
      const tree: Root = {
        type: "root",
        children: [
          h("p", ["Some text"]) as Element,
          h("div", [h("span", ["More text"]) as Element]) as Element,
        ],
      }
      const collected = collectAssetNodes(tree)
      expect(collected).toHaveLength(0)
    })
  })

  describe("processAsset", () => {
    const cdnImageUrl = "https://assets.turntrout.com/img.png"
    let mockFile: VFile

    beforeEach(() => {
      mockFile = new VFile({ path: "test.md" })
    })

    it("should apply dimensions from cache if available", async () => {
      const cachedDims = { width: 300, height: 200 }
      const currentDimensionsCache: AssetDimensionMap = { [cdnImageUrl]: cachedDims }
      const node = h("img", { src: cdnImageUrl }) as Element
      const fetchSpy = mockedFetch

      await processAsset({ node, src: cdnImageUrl }, currentDimensionsCache, mockFile)
      expect(node.properties?.width).toBe(cachedDims.width)
      expect(node.properties?.height).toBe(cachedDims.height)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("should fetch, apply, and cache dimensions for CDN image not in cache", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" })
      sizeOfMock.mockReturnValueOnce({ ...mockFetchedDims, type: "png" })
      const currentDimensionsCache: AssetDimensionMap = {}
      const node = h("img", { src: cdnImageUrl }) as Element
      await processAsset({ node, src: cdnImageUrl }, currentDimensionsCache, mockFile)
      expect(mockedFetch).toHaveBeenCalledWith(cdnImageUrl)
      expect(node.properties?.width).toBe(mockWidth)
      expect(currentDimensionsCache[cdnImageUrl]).toEqual(mockFetchedDims)
      expect(assetDimensionsState.needToSaveCache).toBe(true)
    })

    it("should not fetch for non-CDN images", async () => {
      const nonCdnImageUrl = "https://othersite.com/image.jpg"
      const currentDimensionsCache: AssetDimensionMap = {}
      const node = h("img", { src: nonCdnImageUrl }) as Element
      const fetchSpy = mockedFetch

      await processAsset({ node, src: nonCdnImageUrl }, currentDimensionsCache, mockFile)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(node.properties?.width).toBeUndefined()
    })

    it("should not apply dimensions if fetching fails for CDN image", async () => {
      mockFetchResolve(mockedFetch, null, 500, {}, "Server Error")
      const currentDimensionsCache: AssetDimensionMap = {}
      const node = h("img", { src: cdnImageUrl }) as Element
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
      await processAsset({ node, src: cdnImageUrl }, currentDimensionsCache, mockFile)
      expect(mockedFetch).toHaveBeenCalledWith(cdnImageUrl)
      expect(node.properties?.width).toBeUndefined()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to fetch asset ${cdnImageUrl}: 500 Server Error`),
      )
      consoleWarnSpy.mockRestore()
    })

    it("should handle invalid URLs gracefully", async () => {
      const invalidUrl = "not-a-valid-url"
      const currentDimensionsCache: AssetDimensionMap = {}
      const node = h("img", { src: invalidUrl }) as Element
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})

      await processAsset({ node, src: invalidUrl }, currentDimensionsCache, mockFile)
      expect(mockedFetch).not.toHaveBeenCalled()
      expect(node.properties?.width).toBeUndefined()
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping dimension fetching"),
      )
      consoleWarnSpy.mockRestore()
    })
  })

  describe("addAssetDimensionsFromUrl Plugin (Integration)", () => {
    it("should process an HTML tree and apply dimensions", async () => {
      const cdnImg1Src = "https://assets.turntrout.com/image1.png"
      const cdnImg2Src = "https://assets.turntrout.com/cached.png"
      const externalImgSrc = "https://example.com/external.png"

      const tree: Root = {
        type: "root",
        children: [
          h("img", { src: cdnImg1Src }) as Element,
          h("img", { src: cdnImg2Src }) as Element,
          h("img", { src: externalImgSrc }) as Element,
        ],
      }
      const mockFile = new VFile({ path: "integrationTest.md" })

      const preCachedDims = { width: 10, height: 20 }
      const readFileMock = jest.spyOn(fs, "readFile").mockImplementation(async (p) => {
        if (p === actualAssetDimensionsFilePath) {
          return JSON.stringify({ [cdnImg2Src]: preCachedDims })
        }
        throw Object.assign(new Error("ENOENT for other files"), { code: "ENOENT" })
      })
      resetDirectCacheAndDirtyFlag()
      setDirectCache(null)

      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" })

      const pluginInstance = addAssetDimensionsFromUrl()
      const transformer = pluginInstance.htmlPlugins()[0]()
      await transformer(tree, mockFile)

      const img1Node = tree.children[0] as Element
      const img2Node = tree.children[1] as Element
      const img3Node = tree.children[2] as Element

      expect(img1Node.properties?.width).toBe(mockWidth)
      expect(img2Node.properties?.width).toBe(preCachedDims.width)
      expect(img3Node.properties?.width).toBeUndefined() // External image, no fetch

      expect(mockedFetch).toHaveBeenCalledTimes(1)
      expect(mockedFetch).toHaveBeenCalledWith(cdnImg1Src)

      const finalCache = assetDimensionsState.assetDimensionsCache
      expect(finalCache).not.toBeNull()
      expect(finalCache![cdnImg1Src]).toEqual(mockFetchedDims)
      expect(finalCache![cdnImg2Src]).toEqual(preCachedDims)
      expect(assetDimensionsState.needToSaveCache).toBe(false)

      const writeFileSpy = jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never)
      setDirectDirtyFlag(true)
      await maybeSaveAssetDimensions()
      expect(writeFileSpy).toHaveBeenCalledTimes(1)
      expect(writeFileSpy).toHaveBeenCalledWith(
        actualAssetDimensionsFilePath,
        expect.any(String),
        "utf-8",
      )

      readFileMock.mockRestore()
    })

    it("should handle empty tree", async () => {
      const tree: Root = { type: "root", children: [] }
      const mockFile = new VFile({ path: "empty.md" })

      const pluginInstance = addAssetDimensionsFromUrl()
      const transformer = pluginInstance.htmlPlugins()[0]()
      await transformer(tree, mockFile)

      expect(tree.children).toHaveLength(0)
      expect(mockedFetch).not.toHaveBeenCalled()
    })

    it("should handle tree with no images", async () => {
      const tree: Root = {
        type: "root",
        children: [
          h("p", ["Some text"]) as Element,
          h("div", [h("span", ["More text"]) as Element]) as Element,
        ],
      }
      const mockFile = new VFile({ path: "no-images.md" })

      const pluginInstance = addAssetDimensionsFromUrl()
      const transformer = pluginInstance.htmlPlugins()[0]()
      await transformer(tree, mockFile)

      expect(mockedFetch).not.toHaveBeenCalled()
    })
  })
})
