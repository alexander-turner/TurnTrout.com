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
import { spawnSync } from "child_process"
import fsExtra from "fs-extra"
import fs from "fs/promises"
import { h } from "hastscript"
import os from "os"
import path from "path"

const testVideoUrl = "https://assets.turntrout.com/video.mp4"
const mockVideoData = Buffer.from("fakevideocontent")
const mockVideoWidth = 640
const mockVideoHeight = 360
const mockFetchedVideoDims = { width: mockVideoWidth, height: mockVideoHeight }

const mockSpawnSync = jest.fn().mockReturnValue({
  status: 0,
  stdout: `${mockVideoWidth}x${mockVideoHeight}`,
  stderr: "",
  error: null,
})

setSpawnSyncForTesting(mockSpawnSync as unknown as typeof spawnSync)

import * as assetDimensionsState from "../assetDimensions"
import {
  maybeLoadDimensionCache,
  maybeSaveAssetDimensions,
  fetchAndParseAssetDimensions,
  collectAssetNodes,
  processAsset,
  addAssetDimensionsFromSrc,
  getVideoSource,
  type AssetDimensionMap,
  resetDirectCacheAndDirtyFlag,
  setDirectCache,
  setDirectDirtyFlag,
  getAssetDimensionsFfprobe,
  setSpawnSyncForTesting,
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
const mockImageWidth = 200
const mockImageHeight = 150
const mockFetchedImageDims = { width: mockImageWidth, height: mockImageHeight }

const sizeOfMock = jest.fn().mockReturnValue({
  width: mockImageWidth,
  height: mockImageHeight,
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
    mockSpawnSync.mockClear()
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
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(actualAssetDimensionsFilePath),
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
      const renameSpy = jest.spyOn(fs, "rename").mockResolvedValue(undefined as never)

      await maybeSaveAssetDimensions()

      const tempFilePath = actualAssetDimensionsFilePath + ".tmp"
      expect(writeFileSpy).toHaveBeenCalledWith(
        tempFilePath,
        JSON.stringify(cacheData, null, 2),
        "utf-8",
      )
      expect(renameSpy).toHaveBeenCalledWith(tempFilePath, actualAssetDimensionsFilePath)
      expect(assetDimensionsState.needToSaveCache).toBe(false)

      renameSpy.mockRestore()
    })

    it("should not save cache if not dirty", async () => {
      setDirectCache({})
      setDirectDirtyFlag(false)
      const writeFileSpy = jest.spyOn(fs, "writeFile")
      const renameSpy = jest.spyOn(fs, "rename")

      await maybeSaveAssetDimensions()
      expect(writeFileSpy).not.toHaveBeenCalled()
      expect(renameSpy).not.toHaveBeenCalled()
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
      const renameSpy = jest.spyOn(fs, "rename").mockResolvedValue(undefined as never)

      await expect(maybeSaveAssetDimensions()).rejects.toThrow("Permission denied")

      expect(writeFileSpy).toHaveBeenCalled()
      expect(renameSpy).not.toHaveBeenCalled()
      renameSpy.mockRestore()
    })
  })

  describe("getAssetDimensionsFfprobe", () => {
    it("should parse asset dimensions successfully from a URL", async () => {
      const dimensions = await getAssetDimensionsFfprobe(testVideoUrl)
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "ffprobe",
        expect.arrayContaining([testVideoUrl]),
        expect.any(Object),
      )
      expect(dimensions).toEqual(mockFetchedVideoDims)
    })

    it("should parse dimensions correctly even with a trailing 'x'", async () => {
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockVideoWidth}x${mockVideoHeight}x`, // faulty output
        stderr: "",
        error: null,
      })
      const dimensions = await getAssetDimensionsFfprobe(testVideoUrl)
      expect(dimensions).toEqual(mockFetchedVideoDims)
    })
  })

  describe("fetchAndParseAssetDimensions", () => {
    const testImageUrl = "https://assets.turntrout.com/image.png"

    it("should work with SVG files", async () => {
      const testSvgUrl = "https://assets.turntrout.com/image.svg"
      const mockSvgData = Buffer.from(
        `<svg width="${mockImageWidth}" height="${mockImageHeight}"></svg>`,
      )
      mockFetchResolve(mockedFetch, mockSvgData, 200, { "Content-Type": "image/svg+xml" })
      sizeOfMock.mockReturnValueOnce({
        width: mockImageWidth,
        height: mockImageHeight,
        type: "svg",
      })

      const dimensions = await fetchAndParseAssetDimensions(testSvgUrl)

      expect(mockedFetch).toHaveBeenCalledWith(testSvgUrl)
      expect(dimensions).toEqual({ width: mockImageWidth, height: mockImageHeight })
    })

    it("should fetch and parse image dimensions successfully using ffprobe", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)

      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        error: null,
      })

      const dimensions = await fetchAndParseAssetDimensions(testImageUrl)
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "ffprobe",
        expect.arrayContaining([testImageUrl]),
        expect.any(Object),
      )
      expect(sizeOfMock).not.toHaveBeenCalled()
      expect(dimensions).toEqual(mockFetchedImageDims)
    })

    it("should fetch and parse video dimensions successfully using ffprobe", async () => {
      mockFetchResolve(mockedFetch, mockVideoData, 200, { "Content-Type": "video/mp4" }, "OK", true)

      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockVideoWidth}x${mockVideoHeight}`,
        stderr: "",
        error: null,
      })

      const dimensions = await fetchAndParseAssetDimensions(testVideoUrl)

      expect(mockedFetch).toHaveBeenCalledWith(testVideoUrl)
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "ffprobe",
        expect.arrayContaining([testVideoUrl]),
        { encoding: "utf-8" },
      )
      expect(sizeOfMock).not.toHaveBeenCalled()
      expect(dimensions).toEqual(mockFetchedVideoDims)
    })

    it("should throw for video if ffprobe command is not found", async () => {
      const cancel = jest.fn()
      mockedFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === "Content-Type" ? "video/mpeg" : null) } as Headers,
        body: { cancel } as unknown as ReadableStream<Uint8Array>,
        arrayBuffer: async () => mockVideoData,
      } as unknown as NodeFetchResponse)
      mockSpawnSync.mockReturnValueOnce({
        status: null,
        stdout: "",
        stderr: "",
        error: Object.assign(new Error("Command not found"), { code: "ENOENT" }),
      })

      await expect(fetchAndParseAssetDimensions(testVideoUrl)).rejects.toThrow(
        /ffprobe command not found/,
      )
      expect(cancel).toHaveBeenCalled()
      expect(mockSpawnSync).toHaveBeenCalled()
    })

    it("should throw for video if ffprobe fails (non-zero status)", async () => {
      const cancel = jest.fn()
      mockedFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h: string) => (h === "Content-Type" ? "video/quicktime" : null),
        } as Headers,
        body: { cancel } as unknown as ReadableStream<Uint8Array>,
        arrayBuffer: async () => mockVideoData,
      } as unknown as NodeFetchResponse)
      mockSpawnSync.mockReturnValueOnce({
        status: 1,
        stdout: "",
        stderr: "FFprobe execution error",
        error: null,
      })

      await expect(fetchAndParseAssetDimensions(testVideoUrl)).rejects.toThrow(
        "Could not parse dimensions from ffprobe output: ",
      )
      expect(cancel).toHaveBeenCalled()
      expect(mockSpawnSync).toHaveBeenCalled()
    })

    it("should throw for video if ffprobe output is unparseable", async () => {
      const cancel = jest.fn()
      mockedFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === "Content-Type" ? "video/webm" : null) } as Headers,
        body: { cancel } as unknown as ReadableStream<Uint8Array>,
        arrayBuffer: async () => mockVideoData,
      } as unknown as NodeFetchResponse)
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: "this:is:not:dimensions",
        stderr: "",
        error: null,
      })

      await expect(fetchAndParseAssetDimensions(testVideoUrl)).rejects.toThrow(
        "Could not parse dimensions from ffprobe output: this:is:not:dimensions",
      )
      expect(cancel).toHaveBeenCalled()
      expect(mockSpawnSync).toHaveBeenCalled()
    })

    it("should throw if fetch fails (e.g., 404)", async () => {
      mockFetchResolve(mockedFetch, "", 404, {}, "Not Found")
      await expect(fetchAndParseAssetDimensions(testImageUrl)).rejects.toThrow(
        `Failed to fetch asset ${testImageUrl}: 404 Not Found`,
      )
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })

    it("should throw if image-size fails to parse", async () => {
      mockFetchResolve(mockedFetch, Buffer.from("fakeimagedata"))
      sizeOfMock.mockImplementation(() => {
        throw new Error("parsing error")
      })
      await expect(fetchAndParseAssetDimensions(testImageUrl)).rejects.toThrow(
        /unsupported file type/,
      )
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })

    it("should throw if fetch results in network error", async () => {
      mockFetchNetworkError(mockedFetch, new Error("Network failure"))
      await expect(fetchAndParseAssetDimensions(testImageUrl)).rejects.toThrow("Network failure")
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })

    it("should handle non-asset content type", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "text/plain" })
      const dimensions = await fetchAndParseAssetDimensions(testImageUrl)
      expect(dimensions).toEqual(mockFetchedImageDims)
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })

    it("should retry on network failure and succeed on third attempt", async () => {
      let callCount = 0
      mockedFetch.mockImplementation(async () => {
        callCount++
        if (callCount <= 2) {
          throw new Error("Network failure")
        }
        // Succeed on third attempt
        return {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "Content-Type" ? "image/png" : null) } as Headers,
          arrayBuffer: async () => mockImageData,
        } as unknown as NodeFetchResponse
      })

      sizeOfMock.mockClear()
      sizeOfMock.mockReturnValue({
        width: mockImageWidth,
        height: mockImageHeight,
        type: "png",
      })

      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        error: null,
      })

      const dimensions = await fetchAndParseAssetDimensions(testImageUrl, 3)
      expect(dimensions).toEqual(mockFetchedImageDims)
      expect(mockedFetch).toHaveBeenCalledTimes(3)
    })
  })

  describe("collectAssetNodes", () => {
    it.each([
      {
        description: "img elements with src attributes",
        tree: {
          type: "root",
          children: [
            h("img", { src: "img1.png" }) as Element,
            h("p", [h("img", { src: "img2.jpg" }) as Element]) as Element,
            h("img") as Element, // No src
            h("svg", { src: "icon.svg" }) as Element,
            h("svg") as Element, // No src
            {
              type: "element",
              tagName: "div",
              properties: { src: "notanasset.png" }, // not an img or svg tag
              children: [],
            } as Element,
          ],
        } as Root,
        expected: [
          { tagName: "img", src: "img1.png" },
          { tagName: "img", src: "img2.jpg" },
          { tagName: "svg", src: "icon.svg" },
        ],
      },
      {
        description: "only svg elements with src attributes",
        tree: {
          type: "root",
          children: [
            h("svg", { src: "icon1.svg" }) as Element,
            h("p", [h("svg", { src: "icon2.svg" }) as Element]) as Element,
            h("svg") as Element, // No src
          ],
        } as Root,
        expected: [
          { tagName: "svg", src: "icon1.svg" },
          { tagName: "svg", src: "icon2.svg" },
        ],
      },
      {
        description: "video elements with src attributes",
        tree: {
          type: "root",
          children: [
            h("video", { src: "video1.mp4" }) as Element,
            h("p", [h("video", { src: "video2.mp4" }) as Element]) as Element,
            h("video") as Element, // No src
            h("figure", [h("video", { src: "figure.mp4" }) as Element]) as Element,
            h("video", [h("source", { src: "source.mp4" }) as Element]) as Element,
          ],
        } as Root,
        expected: [
          { tagName: "video", src: "video1.mp4" },
          { tagName: "video", src: "video2.mp4" },
          { tagName: "video", src: "figure.mp4" },
          { tagName: "video", src: "source.mp4" },
        ],
      },
      {
        description: "no relevant elements",
        tree: {
          type: "root",
          children: [
            h("p", ["Some text"]) as Element,
            h("img") as Element, // No src
            h("svg") as Element, // No src
            h("div", [h("span", ["More text"]) as Element]) as Element,
          ],
        } as Root,
        expected: [],
      },
      {
        description: "empty tree",
        tree: { type: "root", children: [] } as Root,
        expected: [],
      },
    ])("should find $description", ({ tree, expected }) => {
      const collected = collectAssetNodes(tree)
      expect(collected).toHaveLength(expected.length)
      expected.forEach((exp, index) => {
        expect(collected[index].node.tagName).toBe(exp.tagName)
        expect(collected[index].src).toBe(exp.src)
      })
    })
  })

  describe("getVideoSource", () => {
    it.each([
      {
        description: "direct source",
        videoElement: h("video", { src: "video1.mp4" }),
        expected: "video1.mp4",
      },
      {
        description: "no source",
        videoElement: h("video"),
        expected: undefined,
      },
      {
        description: "source is first child",
        videoElement: h("video", [h("source", { src: "child.mp4" })]),
        expected: "child.mp4",
      },
      {
        description: "source is not first child",
        videoElement: h("video", [h("p"), h("source", { src: "second-child.mp4" })]),
        expected: "second-child.mp4",
      },
      {
        description: "source is not in children",
        videoElement: h("video", [h("p")]),
        expected: undefined,
      },
    ])("retrieves correct sources", ({ videoElement, expected }) => {
      const inferredSrc = getVideoSource(videoElement)
      expect(inferredSrc).toStrictEqual(expected)
    })
  })

  describe("processAsset", () => {
    const imageUrl = "https://assets.turntrout.com/img.png"

    it("should apply dimensions from cache if available", async () => {
      const cachedDims = { width: 300, height: 200 }
      const currentDimensionsCache: AssetDimensionMap = { [imageUrl]: cachedDims }
      const node = h("img", { src: imageUrl }) as Element
      const fetchSpy = mockedFetch

      await processAsset({ node, src: imageUrl }, currentDimensionsCache)
      expect(node.properties?.width).toBe(cachedDims.width)
      expect(node.properties?.height).toBe(cachedDims.height)
      expect(node.properties?.style).toBe(
        `aspect-ratio: ${cachedDims.width} / ${cachedDims.height};`,
      )
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("should fetch, apply, and cache dimensions for image not in cache", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        error: null,
      })
      const currentDimensionsCache: AssetDimensionMap = {}
      const node = h("img", { src: imageUrl }) as Element
      await processAsset({ node, src: imageUrl }, currentDimensionsCache)
      expect(mockedFetch).toHaveBeenCalledWith(imageUrl)
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "ffprobe",
        expect.arrayContaining([imageUrl]),
        expect.any(Object),
      )
      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(`aspect-ratio: ${mockImageWidth} / ${mockImageHeight};`)
      expect(currentDimensionsCache[imageUrl]).toEqual(mockFetchedImageDims)
      expect(assetDimensionsState.needToSaveCache).toBe(true)
    })

    it("should not apply dimensions if fetching fails for image", async () => {
      mockFetchResolve(mockedFetch, null, 500, {}, "Server Error")
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "border: 1px solid red;"
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element
      await expect(processAsset({ node, src: imageUrl }, currentDimensionsCache)).rejects.toThrow(
        `Failed to fetch asset ${imageUrl}: 500 Server Error`,
      )
      expect(mockedFetch).toHaveBeenCalledWith(imageUrl)

      expect(node.properties?.width).toBeUndefined()
      expect(node.properties?.style).toBe(initialStyle)
    })

    it("should prepend aspect-ratio to existing style, creating a valid combined style string (existing no semicolon)", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        error: null,
      })
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "color: blue"
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element

      await processAsset({ node, src: imageUrl }, currentDimensionsCache)

      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(
        `aspect-ratio: ${mockImageWidth} / ${mockImageHeight}; ${initialStyle}`,
      )
      expect(assetDimensionsState.needToSaveCache).toBe(true)
    })

    it("should prepend aspect-ratio to existing style, creating a valid combined style string (existing with semicolon)", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        error: null,
      })
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "color: red;"
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element

      await processAsset({ node, src: imageUrl }, currentDimensionsCache)

      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(
        `aspect-ratio: ${mockImageWidth} / ${mockImageHeight};${initialStyle}`,
      )
      expect(assetDimensionsState.needToSaveCache).toBe(true)
    })

    it("should prepend aspect-ratio to existing style, handling trailing spaces (existing with semicolon and space)", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        error: null,
      })
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "color: green; " // Note the trailing space
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element

      await processAsset({ node, src: imageUrl }, currentDimensionsCache)

      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(
        `aspect-ratio: ${mockImageWidth} / ${mockImageHeight};color: green;`,
      )
      expect(assetDimensionsState.needToSaveCache).toBe(true)
    })

    it("should correctly set aspect-ratio style if existing style is only whitespace", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        error: null,
      })
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "   " // Just whitespace
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element

      await processAsset({ node, src: imageUrl }, currentDimensionsCache)

      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(`aspect-ratio: ${mockImageWidth} / ${mockImageHeight};`)
      expect(assetDimensionsState.needToSaveCache).toBe(true)
    })
  })

  describe("addAssetDimensionsFromUrl Plugin (Integration)", () => {
    it("should process an HTML tree and apply dimensions", async () => {
      const cdnImg1Src = "https://assets.turntrout.com/image1.png"
      const cdnImg2Src = "https://assets.turntrout.com/cached.png"
      const cdnSvg1Src = "https://assets.turntrout.com/icon1.svg"

      const tree: Root = {
        type: "root",
        children: [
          h("img", { src: cdnImg1Src }) as Element,
          h("img", { src: cdnImg2Src }) as Element,
          h("svg", { src: cdnSvg1Src }) as Element,
        ],
      }
      const preCachedDims = { width: 10, height: 20 }
      const readFileMock = jest.spyOn(fs, "readFile").mockImplementation(async (p) => {
        if (p === actualAssetDimensionsFilePath) {
          return JSON.stringify({ [cdnImg2Src]: preCachedDims })
        }
        throw Object.assign(new Error("ENOENT for other files"), { code: "ENOENT" })
      })
      resetDirectCacheAndDirtyFlag()
      setDirectCache(null)

      // Mock fetch for the first uncached asset (cdnImg1Src - image), which will use ffprobe
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        error: null,
      })

      // Mock fetch for the second uncached asset (cdnSvg1Src - svg), which will use image-size
      const mockSvgData = Buffer.from(
        `<svg width="${mockImageWidth}" height="${mockImageHeight}" xmlns="http://www.w3.org/2000/svg"></svg>`,
      )
      mockFetchResolve(mockedFetch, mockSvgData, 200, { "Content-Type": "image/svg+xml" })
      sizeOfMock.mockReturnValueOnce({
        width: mockImageWidth,
        height: mockImageHeight,
        type: "svg",
      })

      const writeFileSpy = jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never)
      const renameSpy = jest.spyOn(fs, "rename").mockResolvedValue(undefined as never)

      const pluginInstance = addAssetDimensionsFromSrc()
      const transformer = pluginInstance.htmlPlugins()[0]()
      await transformer(tree)

      const img1Node = tree.children[0] as Element
      const img2Node = tree.children[1] as Element
      const svg1Node = tree.children[2] as Element

      expect(img1Node.properties?.width).toBe(mockImageWidth)
      expect(img1Node.properties?.height).toBe(mockImageHeight)
      expect(img2Node.properties?.width).toBe(preCachedDims.width)
      expect(img2Node.properties?.height).toBe(preCachedDims.height)

      expect(svg1Node.properties?.width).toBe(mockImageWidth)
      expect(svg1Node.properties?.height).toBe(mockImageHeight)

      expect(mockedFetch).toHaveBeenCalledTimes(2) // img1 and svg1
      expect(mockedFetch).toHaveBeenCalledWith(cdnImg1Src)
      expect(mockedFetch).toHaveBeenCalledWith(cdnSvg1Src)

      const finalCache = assetDimensionsState.assetDimensionsCache
      expect(finalCache).not.toBeNull()
      expect(finalCache![cdnImg1Src]).toEqual(mockFetchedImageDims)
      expect(finalCache![cdnImg2Src]).toEqual(preCachedDims)
      // SVG also uses mockFetchedDims due to current sizeOfMock behavior
      expect(finalCache![cdnSvg1Src]).toEqual(mockFetchedImageDims)

      // false since we saved the cache already
      expect(assetDimensionsState.needToSaveCache).toBe(false)

      setDirectDirtyFlag(true)
      await maybeSaveAssetDimensions()
      expect(writeFileSpy).toHaveBeenCalledTimes(2)
      const tempFilePath = actualAssetDimensionsFilePath + ".tmp"
      expect(writeFileSpy).toHaveBeenCalledWith(tempFilePath, expect.any(String), "utf-8")
      expect(renameSpy).toHaveBeenCalledWith(tempFilePath, actualAssetDimensionsFilePath)

      readFileMock.mockRestore()
      renameSpy.mockRestore()
    })

    it("should handle empty tree", async () => {
      const tree: Root = { type: "root", children: [] }

      const pluginInstance = addAssetDimensionsFromSrc()
      const transformer = pluginInstance.htmlPlugins()[0]()
      await transformer(tree)

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
      const pluginInstance = addAssetDimensionsFromSrc()
      const transformer = pluginInstance.htmlPlugins()[0]()
      await transformer(tree)

      expect(mockedFetch).not.toHaveBeenCalled()
    })
  })

  describe("fetchAndParseAssetDimensions for local assets", () => {
    let tmpDir: string
    let imageFile: string
    let videoFile: string
    const imageFileName = "local-image.png"

    beforeEach(async () => {
      tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "assetDimensions-local-"))
      imageFile = path.join(tmpDir, imageFileName)
      await fs.writeFile(imageFile, mockImageData)

      videoFile = path.join(tmpDir, "video.mp4")
      await fs.writeFile(videoFile, "dummy")
    })

    afterEach(async () => {
      await fsExtra.remove(tmpDir)
      jest.restoreAllMocks()
    })

    it("reads dimensions for local image via file://", async () => {
      const dims = await fetchAndParseAssetDimensions(`file://${imageFile}`)
      expect(dims).toEqual(mockFetchedImageDims)
    })

    it("reads dimensions for local video via file://", async () => {
      const dims = await fetchAndParseAssetDimensions(`file://${videoFile}`)
      expect(mockSpawnSync).toHaveBeenCalledWith("ffprobe", expect.arrayContaining([videoFile]), {
        encoding: "utf-8",
      })
      expect(dims).toEqual(mockFetchedVideoDims)
    })

    it("throws when local asset not found", async () => {
      const missing = path.join(tmpDir, "not-exist.png")
      await expect(fetchAndParseAssetDimensions(`file://${missing}`)).rejects.toThrow("ENOENT")
    })

    it("reads dimensions for local asset with root-relative path", async () => {
      const staticDir = path.join(assetDimensionsState.paths.projectRoot, "quartz", "static")
      await fsExtra.ensureDir(staticDir)
      const assetPath = path.join(staticDir, imageFileName)
      await fs.writeFile(assetPath, mockImageData)

      try {
        const dims = await fetchAndParseAssetDimensions(`/static/${imageFileName}`)
        expect(dims).toEqual(mockFetchedImageDims)
      } finally {
        await fs.unlink(assetPath)
      }
    })
  })
})
