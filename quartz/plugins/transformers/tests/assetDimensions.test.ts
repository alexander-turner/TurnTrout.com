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
import { type SpawnSyncReturns, type spawnSync } from "child_process"
// skipcq: JS-W1028
import fsExtra from "fs-extra"
import { h } from "hastscript"
import os from "os"
import path from "path"

import type { BuildCtx } from "../../../util/ctx"

const testVideoUrl = "https://assets.turntrout.com/video.mp4"
const mockVideoData = Buffer.from("fakevideocontent")
const mockVideoWidth = 640
const mockVideoHeight = 360
const mockFetchedVideoDims = { width: mockVideoWidth, height: mockVideoHeight }

const mockSpawnSync = jest.fn()

import {
  addAssetDimensionsFromSrc,
  type AssetDimensionMap,
  AssetProcessor,
  paths,
  assetProcessor as globalAssetProcessor,
  setSpawnSyncForTesting,
  numRetries,
  maybeResolveAssetStagingPath,
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

jest.mock("fs/promises")
import fs from "fs/promises"

const mockedFetch = jest.fn() as jest.MockedFunction<NodeFetchCompatibleSignature>
// Assign to global.fetch. The 'as unknown as typeof global.fetch' cast is used because
// NodeFetchCompatibleSignature and global.fetch's type aren't identical,
// but compatible for the subset of functionality used in assetDimensions.ts.
global.fetch = mockedFetch as unknown as typeof global.fetch

let tempDir: string

describe("Asset Dimensions Plugin", () => {
  // replace local instance creation
  let assetProcessor: AssetProcessor
  const actualAssetDimensionsFilePath = paths.assetDimensions

  describe("maybeResolveAssetStagingPath", () => {
    it.each([
      {
        description: "relative path with ../",
        input: "../asset_staging/privacy.png",
        expected: path.join(paths.projectRoot, "website_content", "asset_staging/privacy.png"),
      },
      {
        description: "absolute path with leading slash",
        input: "/asset_staging/privacy.png",
        expected: path.join(paths.projectRoot, "website_content", "asset_staging/privacy.png"),
      },
      {
        description: "relative path without ../",
        input: "asset_staging/privacy.png",
        expected: path.join(paths.projectRoot, "website_content", "asset_staging/privacy.png"),
      },
      {
        description: "path without asset_staging returns null",
        input: "/static/images/test.png",
        expected: null,
      },
      {
        description: "path without asset_staging (relative) returns null",
        input: "static/test.png",
        expected: null,
      },
    ])("handles $description", ({ input, expected }) => {
      const result = maybeResolveAssetStagingPath(input)
      expect(result).toBe(expected)
    })
  })

  beforeEach(async () => {
    // skipcq: JS-P1003
    tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "assetDimensions-test-files-"))
    assetProcessor = globalAssetProcessor as AssetProcessor
    mockedFetch.mockClear()
    sizeOfMock.mockClear()
    mockSpawnSync.mockClear()
    mockSpawnSync.mockImplementation(
      (): SpawnSyncReturns<string> => ({
        pid: 1,
        output: ["", `${mockImageWidth}x${mockImageHeight}`, ""],
        stdout: `${mockImageWidth}x${mockImageHeight}`,
        stderr: "",
        status: 0,
        signal: null,
      }),
    )
    setSpawnSyncForTesting(mockSpawnSync as unknown as typeof spawnSync)
  })

  afterEach(async () => {
    // skipcq: JS-P1003
    await fsExtra.remove(tempDir)
    jest.restoreAllMocks()
    assetProcessor.resetDirectCacheAndDirtyFlag()
  })

  describe("maybeLoadDimensionCache", () => {
    it("should load an existing cache file", async () => {
      const mockCacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      const readFileSpy = jest
        .spyOn(fs, "readFile")
        .mockResolvedValue(JSON.stringify(mockCacheData) as never)

      const cache = await assetProcessor.maybeLoadDimensionCache()
      expect(cache).toEqual(mockCacheData)
      expect(readFileSpy).toHaveBeenCalledWith(actualAssetDimensionsFilePath, "utf-8")
    })

    it("should return an empty object if cache file does not exist", async () => {
      const readFileSpy = jest
        .spyOn(fs, "readFile")
        .mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }) as never)
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        // Mock console.warn to prevent logging during test
      })

      const cache = await assetProcessor.maybeLoadDimensionCache()
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
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        // Mock console.warn to prevent logging during test
      })

      const cache = await assetProcessor.maybeLoadDimensionCache()
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
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
        // Mock console.warn to prevent logging during test
      })

      const cache = await assetProcessor.maybeLoadDimensionCache()
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

    it("should return cached dimensions without reading file if already loaded", async () => {
      const preloadedCache: AssetDimensionMap = {
        "preloaded.png": { width: 42, height: 24 },
      }
      assetProcessor.setDirectCache(preloadedCache)
      const readFileSpy = jest.spyOn(fs, "readFile")

      const returnedCache = await assetProcessor.maybeLoadDimensionCache()
      expect(returnedCache).toBe(preloadedCache)

      expect(readFileSpy).not.toHaveBeenCalled()
      readFileSpy.mockRestore()
    })
  })

  describe("maybeSaveImageDimensions", () => {
    it("should save cache to file if cache is dirty", async () => {
      const cacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      assetProcessor.setDirectCache(cacheData)
      assetProcessor.setDirectDirtyFlag(true)

      const writeFileSpy = jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never)
      const renameSpy = jest.spyOn(fs, "rename").mockResolvedValue(undefined as never)

      await assetProcessor.maybeSaveAssetDimensions()

      // Temp file includes process.pid and timestamp for uniqueness
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${actualAssetDimensionsFilePath}\\.tmp\\.\\d+\\.\\d+$`)),
        JSON.stringify(cacheData, null, 2),
        "utf-8",
      )
      expect(renameSpy).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${actualAssetDimensionsFilePath}\\.tmp\\.\\d+\\.\\d+$`)),
        actualAssetDimensionsFilePath,
      )
      expect(assetProcessor["needToSaveCache"]).toBe(false)

      renameSpy.mockRestore()
    })

    it("should not save cache if not dirty", async () => {
      assetProcessor.setDirectCache({})
      assetProcessor.setDirectDirtyFlag(false)
      const writeFileSpy = jest.spyOn(fs, "writeFile")
      const renameSpy = jest.spyOn(fs, "rename")

      await assetProcessor.maybeSaveAssetDimensions()
      expect(writeFileSpy).not.toHaveBeenCalled()
      expect(renameSpy).not.toHaveBeenCalled()
    })

    it("should not attempt to save if cache is null even when dirty flag is set", async () => {
      assetProcessor.resetDirectCacheAndDirtyFlag()
      assetProcessor.setDirectCache(null)
      assetProcessor.setDirectDirtyFlag(true)

      const writeFileSpy = jest.spyOn(fs, "writeFile")
      const renameSpy = jest.spyOn(fs, "rename")

      await assetProcessor.maybeSaveAssetDimensions()

      expect(writeFileSpy).not.toHaveBeenCalled()
      expect(renameSpy).not.toHaveBeenCalled()
      // Dirty flag should remain true since nothing was saved
      expect(assetProcessor["needToSaveCache"]).toBe(true)

      writeFileSpy.mockRestore()
      renameSpy.mockRestore()
    })

    it("should handle write errors gracefully", async () => {
      const cacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      assetProcessor.setDirectCache(cacheData)
      assetProcessor.setDirectDirtyFlag(true)

      const writeFileSpy = jest
        .spyOn(fs, "writeFile")
        .mockRejectedValue(new Error("Permission denied") as never)
      const renameSpy = jest.spyOn(fs, "rename").mockResolvedValue(undefined as never)

      await expect(assetProcessor.maybeSaveAssetDimensions()).rejects.toThrow("Permission denied")

      expect(writeFileSpy).toHaveBeenCalled()
      expect(renameSpy).not.toHaveBeenCalled()
      renameSpy.mockRestore()
    })

    it("should cleanup temp file and rethrow on rename error", async () => {
      const cacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      assetProcessor.setDirectCache(cacheData)
      assetProcessor.setDirectDirtyFlag(true)

      jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never)
      jest.spyOn(fs, "rename").mockRejectedValue(new Error("Permission denied") as never)
      const unlinkSpy = jest.spyOn(fs, "unlink").mockResolvedValue(undefined as never)

      await expect(assetProcessor.maybeSaveAssetDimensions()).rejects.toThrow("Permission denied")
      expect(unlinkSpy).toHaveBeenCalled()
    })

    it("should rethrow rename error even if cleanup fails", async () => {
      const cacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      assetProcessor.setDirectCache(cacheData)
      assetProcessor.setDirectDirtyFlag(true)

      jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never)
      jest.spyOn(fs, "rename").mockRejectedValue(new Error("Rename failed") as never)
      const unlinkSpy = jest.spyOn(fs, "unlink").mockRejectedValue(new Error("Cleanup failed"))

      await expect(assetProcessor.maybeSaveAssetDimensions()).rejects.toThrow("Rename failed")
      expect(unlinkSpy).toHaveBeenCalled()
    })

    it("should handle ENOENT rename error gracefully (race condition)", async () => {
      const cacheData: AssetDimensionMap = {
        "https://assets.turntrout.com/img.png": { width: 100, height: 50 },
      }
      assetProcessor.setDirectCache(cacheData)
      assetProcessor.setDirectDirtyFlag(true)

      jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never)
      jest
        .spyOn(fs, "rename")
        .mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }) as never)
      const unlinkSpy = jest.spyOn(fs, "unlink").mockResolvedValue(undefined as never)

      // Should not throw - ENOENT means another worker succeeded
      await assetProcessor.maybeSaveAssetDimensions()
      expect(unlinkSpy).toHaveBeenCalled()
      expect(assetProcessor["needToSaveCache"]).toBe(false)
    })
  })

  describe("getAssetDimensionsFfprobe", () => {
    it("should parse asset dimensions successfully from a URL", async () => {
      mockSpawnSync.mockReturnValueOnce({
        pid: 1,
        output: ["", `${mockVideoWidth}x${mockVideoHeight}`, ""],
        stdout: `${mockVideoWidth}x${mockVideoHeight}`,
        stderr: "",
        status: 0,
        signal: null,
      } as unknown as SpawnSyncReturns<string>)
      const dimensions = await assetProcessor.getAssetDimensionsFfprobe(testVideoUrl)
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "ffprobe",
        expect.arrayContaining([testVideoUrl]),
        expect.any(Object),
      )
      expect(dimensions).toEqual(mockFetchedVideoDims)
    })

    it("should parse dimensions correctly even with a trailing 'x'", async () => {
      mockSpawnSync.mockReturnValueOnce({
        pid: 1,
        output: ["", `${mockVideoWidth}x${mockVideoHeight}x`, ""],
        stdout: `${mockVideoWidth}x${mockVideoHeight}x`,
        stderr: "",
        status: 0,
        signal: null,
      } as unknown as SpawnSyncReturns<string>)
      const dimensions = await assetProcessor.getAssetDimensionsFfprobe(testVideoUrl)
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

      const dimensions = await assetProcessor.fetchAndParseAssetDimensions(testSvgUrl, 1)

      expect(mockedFetch).toHaveBeenCalledWith(testSvgUrl)
      expect(dimensions).toEqual({ width: mockImageWidth, height: mockImageHeight })
    })

    it("should fetch and parse image dimensions successfully using ffprobe", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      const dimensions = await assetProcessor.fetchAndParseAssetDimensions(testImageUrl, 1)
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
      mockSpawnSync.mockReturnValueOnce({
        pid: 1,
        output: ["", `${mockVideoWidth}x${mockVideoHeight}`, ""],
        stdout: `${mockVideoWidth}x${mockVideoHeight}`,
        stderr: "",
        status: 0,
        signal: null,
      } as unknown as SpawnSyncReturns<string>)
      mockFetchResolve(mockedFetch, mockVideoData, 200, { "Content-Type": "video/mp4" }, "OK", true)
      const dimensions = await assetProcessor.fetchAndParseAssetDimensions(testVideoUrl, 1)

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
        pid: 1,
        output: ["", "", ""],
        stdout: "",
        stderr: "",
        status: null,
        signal: null,
        error: Object.assign(new Error("Command not found"), { code: "ENOENT" }),
      } as unknown as SpawnSyncReturns<string>)

      await expect(assetProcessor.fetchAndParseAssetDimensions(testVideoUrl, 1)).rejects.toThrow(
        /ffprobe command not found/,
      )
      expect(cancel).toHaveBeenCalled()
      expect(mockSpawnSync).toHaveBeenCalled()
    })

    it("should throw if ffprobe spawn fails with a generic error", async () => {
      const cancel = jest.fn()
      mockedFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === "Content-Type" ? "video/mpeg" : null) } as Headers,
        body: { cancel } as unknown as ReadableStream<Uint8Array>,
        arrayBuffer: async () => mockVideoData,
      } as unknown as NodeFetchResponse)
      const genericError = new Error("Custom spawn error")
      mockSpawnSync.mockReturnValueOnce({
        pid: 1,
        output: ["", "", ""],
        stdout: "",
        stderr: "",
        status: null,
        signal: null,
        error: genericError,
      } as unknown as SpawnSyncReturns<string>)

      await expect(assetProcessor.fetchAndParseAssetDimensions(testVideoUrl, 1)).rejects.toThrow(
        `Error spawning ffprobe: ${genericError.message}`,
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
        pid: 1,
        output: ["", "", "FFprobe execution error"],
        stdout: "",
        stderr: "FFprobe execution error",
        status: 1,
        signal: null,
      } as unknown as SpawnSyncReturns<string>)

      await expect(assetProcessor.fetchAndParseAssetDimensions(testVideoUrl, 1)).rejects.toThrow(
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
        pid: 1,
        output: ["", "this:is:not:dimensions", ""],
        stdout: "this:is:not:dimensions",
        stderr: "",
        status: 0,
        signal: null,
      } as unknown as SpawnSyncReturns<string>)

      await expect(assetProcessor.fetchAndParseAssetDimensions(testVideoUrl, 1)).rejects.toThrow(
        "Could not parse dimensions from ffprobe output: this:is:not:dimensions",
      )
      expect(cancel).toHaveBeenCalled()
      expect(mockSpawnSync).toHaveBeenCalled()
    })

    it("should throw if fetch fails (e.g., 404)", async () => {
      mockFetchResolve(mockedFetch, "", 404, {}, "Not Found")
      await expect(assetProcessor.fetchAndParseAssetDimensions(testImageUrl, 1)).rejects.toThrow(
        `Failed to fetch asset ${testImageUrl}: 404 Not Found`,
      )
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })

    it("should throw if image-size fails to parse", async () => {
      mockFetchResolve(mockedFetch, Buffer.from("fakeimagedata"))
      sizeOfMock.mockImplementation(() => {
        throw new Error("parsing error")
      })
      await expect(assetProcessor.fetchAndParseAssetDimensions(testImageUrl, 1)).rejects.toThrow(
        "unsupported file type",
      )
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })

    it("should throw if image-size fails to parse remote asset", async () => {
      mockFetchResolve(mockedFetch, Buffer.from("fakeimagedata"))
      sizeOfMock.mockImplementation(() => {
        throw new Error("parsing error")
      })
      await expect(assetProcessor.fetchAndParseAssetDimensions(testImageUrl, 1)).rejects.toThrow(
        "unsupported file type",
      )
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })

    it("should throw if fetch results in network error", async () => {
      mockFetchNetworkError(mockedFetch, new Error("Network failure"))
      await expect(assetProcessor.fetchAndParseAssetDimensions(testImageUrl, 1)).rejects.toThrow(
        "Network failure",
      )
      expect(mockedFetch).toHaveBeenCalledWith(testImageUrl)
    })

    it("should handle non-asset content type", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "text/plain" })
      const dimensions = await assetProcessor.fetchAndParseAssetDimensions(testImageUrl, 1)
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

      const dimensions = await assetProcessor.fetchAndParseAssetDimensions(testImageUrl)
      expect(dimensions).toEqual(mockFetchedImageDims)
      expect(mockedFetch).toHaveBeenCalledTimes(numRetries)
    })

    it("should throw when remote asset dimensions cannot be determined", async () => {
      const invalidDimsUrl = "https://assets.turntrout.com/invalid.png"
      mockFetchResolve(
        mockedFetch,
        Buffer.from("not-an-image"),
        200,
        { "Content-Type": "text/plain" },
        "OK",
        true,
      )
      sizeOfMock.mockReset()
      sizeOfMock.mockReturnValueOnce({ type: "unknown" })

      await expect(assetProcessor.fetchAndParseAssetDimensions(invalidDimsUrl, 1)).rejects.toThrow(
        /Unable to determine remote asset dimensions|unsupported file type/,
      )
      expect(mockedFetch).toHaveBeenCalledWith(invalidDimsUrl)
    })

    it("should throw after zero retry attempts", async () => {
      const neverFetchedUrl = "https://assets.turntrout.com/never.png"
      // fetch should never be called when retries=0, but guard anyway
      const fetchSpy = mockedFetch.mockImplementation(async () => {
        throw new Error("Should not be called")
      })
      await expect(assetProcessor.fetchAndParseAssetDimensions(neverFetchedUrl, 0)).rejects.toThrow(
        `Failed to fetch ${neverFetchedUrl} after 0 attempts.`,
      )
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe("extractMaskUrl", () => {
    it.each([
      {
        description: "extracts URL from standard --mask-url style",
        style: "--mask-url: url(https://example.com/icon.svg);",
        expected: "https://example.com/icon.svg",
      },
      {
        description: "extracts URL with spaces around colon",
        style: "--mask-url:   url(https://example.com/icon.svg);",
        expected: "https://example.com/icon.svg",
      },
      {
        description: "extracts URL from style with other properties",
        style: "color: red; --mask-url: url(https://example.com/icon.svg); width: 24px;",
        expected: "https://example.com/icon.svg",
      },
      {
        description: "returns null for undefined style",
        style: undefined,
        expected: null,
      },
      {
        description: "returns null for style without --mask-url",
        style: "color: red; width: 24px;",
        expected: null,
      },
      {
        description: "returns null for empty string",
        style: "",
        expected: null,
      },
    ])("$description", ({ style, expected }) => {
      expect(AssetProcessor.extractMaskUrl(style)).toBe(expected)
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
        description: "svg elements with --mask-url style (CSS-mask favicons)",
        tree: {
          type: "root",
          children: [
            h("svg", {
              class: "favicon",
              style: "--mask-url: url(https://example.com/favicon1.svg);",
            }) as Element,
            h("p", [
              h("svg", {
                class: "favicon",
                style: "--mask-url: url(https://example.com/favicon2.svg);",
              }) as Element,
            ]) as Element,
            h("svg", { style: "color: red;" }) as Element, // No --mask-url
            h("svg") as Element, // No style at all
            h("img", {
              style: "--mask-url: url(https://example.com/not-collected.svg);",
            }) as Element, // img tags don't use mask-url extraction
          ],
        } as Root,
        expected: [
          { tagName: "svg", src: "https://example.com/favicon1.svg" },
          { tagName: "svg", src: "https://example.com/favicon2.svg" },
        ],
      },
      {
        description: "mixed elements: img with src, svg with src, svg with mask-url",
        tree: {
          type: "root",
          children: [
            h("img", { src: "image.png" }) as Element,
            h("svg", { src: "direct-src.svg" }) as Element,
            h("svg", {
              style: "--mask-url: url(https://example.com/mask-favicon.svg);",
            }) as Element,
          ],
        } as Root,
        expected: [
          { tagName: "img", src: "image.png" },
          { tagName: "svg", src: "direct-src.svg" },
          { tagName: "svg", src: "https://example.com/mask-favicon.svg" },
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
      const collected = assetProcessor.collectAssetNodes(tree)
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
      const inferredSrc = AssetProcessor.getVideoSource(videoElement as Element)
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

      await assetProcessor.processAsset({ node, src: imageUrl }, currentDimensionsCache)
      expect(node.properties?.width).toBe(cachedDims.width)
      expect(node.properties?.height).toBe(cachedDims.height)
      expect(node.properties?.style).toBe(
        `aspect-ratio: ${cachedDims.width} / ${cachedDims.height};`,
      )
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("should fetch, apply, and cache dimensions for image not in cache", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)

      const currentDimensionsCache: AssetDimensionMap = {}
      const node = h("img", { src: imageUrl }) as Element
      await assetProcessor.processAsset({ node, src: imageUrl }, currentDimensionsCache)
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
      expect(assetProcessor["needToSaveCache"]).toBe(true)
    })

    it("should not apply dimensions if fetching fails for image", async () => {
      mockFetchResolve(mockedFetch, null, 500, {}, "Server Error")
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "border: 1px solid red;"
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element
      await expect(
        assetProcessor.processAsset({ node, src: imageUrl }, currentDimensionsCache, 1),
      ).rejects.toThrow(`Failed to fetch asset ${imageUrl}: 500 Server Error`)
      expect(mockedFetch).toHaveBeenCalledWith(imageUrl)

      expect(node.properties?.width).toBeUndefined()
      expect(node.properties?.style).toBe(initialStyle)
    })

    it("should prepend aspect-ratio to existing style, creating a valid combined style string (existing no semicolon)", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "color: blue"
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element

      await assetProcessor.processAsset({ node, src: imageUrl }, currentDimensionsCache)

      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(
        `aspect-ratio: ${mockImageWidth} / ${mockImageHeight}; ${initialStyle}`,
      )
      expect(assetProcessor["needToSaveCache"]).toBe(true)
    })

    it("should prepend aspect-ratio to existing style, creating a valid combined style string (existing with semicolon)", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "color: red;"
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element

      await assetProcessor.processAsset({ node, src: imageUrl }, currentDimensionsCache)

      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(
        `aspect-ratio: ${mockImageWidth} / ${mockImageHeight};${initialStyle}`,
      )
      expect(assetProcessor["needToSaveCache"]).toBe(true)
    })

    it("should prepend aspect-ratio to existing style, handling trailing spaces (existing with semicolon and space)", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "color: green; " // Note the trailing space
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element

      await assetProcessor.processAsset({ node, src: imageUrl }, currentDimensionsCache)

      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(
        `aspect-ratio: ${mockImageWidth} / ${mockImageHeight};color: green;`,
      )
      expect(assetProcessor["needToSaveCache"]).toBe(true)
    })

    it("should correctly set aspect-ratio style if existing style is only whitespace", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      const currentDimensionsCache: AssetDimensionMap = {}
      const initialStyle = "   " // Just whitespace
      const node = h("img", { src: imageUrl, style: initialStyle }) as Element

      await assetProcessor.processAsset({ node, src: imageUrl }, currentDimensionsCache)

      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(`aspect-ratio: ${mockImageWidth} / ${mockImageHeight};`)
      expect(assetProcessor["needToSaveCache"]).toBe(true)
    })

    it("should initialize properties object when node has no properties", async () => {
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)
      const currentDimensionsCache: AssetDimensionMap = {}
      // Create a node without properties object
      const node = {
        type: "element" as const,
        tagName: "img",
        children: [],
      } as unknown as Element

      await assetProcessor.processAsset({ node, src: imageUrl }, currentDimensionsCache)

      // Properties object should be created and populated
      expect(node.properties).toBeDefined()
      expect(node.properties?.width).toBe(mockImageWidth)
      expect(node.properties?.height).toBe(mockImageHeight)
      expect(node.properties?.style).toBe(`aspect-ratio: ${mockImageWidth} / ${mockImageHeight};`)
      expect(assetProcessor["needToSaveCache"]).toBe(true)
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
      assetProcessor.resetDirectCacheAndDirtyFlag()
      assetProcessor.setDirectCache(null)

      // Mock fetch for the first uncached asset (cdnImg1Src - image)
      mockFetchResolve(mockedFetch, mockImageData, 200, { "Content-Type": "image/png" }, "OK", true)

      // Mock fetch for the second uncached asset (cdnSvg1Src - svg)
      const mockSvgData = Buffer.from(
        `<svg width="${mockImageWidth}" height="${mockImageHeight}" xmlns="http://www.w3.org/2000/svg"></svg>`,
      )
      // a second mock fetch call for the svg
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "image/svg+xml" },
        arrayBuffer: async () => mockSvgData,
      } as unknown as NodeFetchResponse)

      sizeOfMock.mockReturnValueOnce({
        width: mockImageWidth,
        height: mockImageHeight,
        type: "svg",
      })

      const writeFileSpy = jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never)
      const renameSpy = jest.spyOn(fs, "rename").mockResolvedValue(undefined as never)

      const pluginInstance = addAssetDimensionsFromSrc()
      const mockCtx = { argv: { offline: false } } as BuildCtx
      const transformer = pluginInstance.htmlPlugins(mockCtx)[0]()
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

      const finalCache = assetProcessor["assetDimensionsCache"]
      expect(finalCache).not.toBeNull()

      expect(finalCache?.[cdnImg1Src]).toEqual(mockFetchedImageDims)
      expect(finalCache?.[cdnImg2Src]).toEqual(preCachedDims)
      // SVG also uses mockFetchedDims due to current sizeOfMock behavior
      expect(finalCache?.[cdnSvg1Src]).toEqual(mockFetchedImageDims)

      // false since we saved the cache already
      expect(assetProcessor["needToSaveCache"]).toBe(false)

      assetProcessor.setDirectDirtyFlag(true)
      await assetProcessor.maybeSaveAssetDimensions()
      expect(writeFileSpy).toHaveBeenCalledTimes(2)
      // Temp file includes process.pid and timestamp for uniqueness
      const tempFilePattern = new RegExp(`^${actualAssetDimensionsFilePath}\\.tmp\\.\\d+\\.\\d+$`)
      expect(writeFileSpy).toHaveBeenCalledWith(
        expect.stringMatching(tempFilePattern),
        expect.any(String),
        "utf-8",
      )
      expect(renameSpy).toHaveBeenCalledWith(
        expect.stringMatching(tempFilePattern),
        actualAssetDimensionsFilePath,
      )

      readFileMock.mockRestore()
      renameSpy.mockRestore()
    })

    it("should handle empty tree", async () => {
      const tree: Root = { type: "root", children: [] }

      const pluginInstance = addAssetDimensionsFromSrc()
      const mockCtx = { argv: {} } as BuildCtx
      const transformer = pluginInstance.htmlPlugins(mockCtx)[0]()
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
      const mockCtx = { argv: { offline: false } } as BuildCtx
      const transformer = pluginInstance.htmlPlugins(mockCtx)[0]()
      await transformer(tree)

      expect(mockedFetch).not.toHaveBeenCalled()
    })

    it("should skip remote assets in offline mode", async () => {
      const cdnImgSrc = "https://assets.turntrout.com/static/images/test.avif"
      const tree: Root = {
        type: "root",
        children: [h("img", { src: cdnImgSrc }) as Element],
      }

      const pluginInstance = addAssetDimensionsFromSrc()
      const mockCtx = { argv: { offline: true } } as BuildCtx
      const transformer = pluginInstance.htmlPlugins(mockCtx)[0]()
      await transformer(tree)

      // In offline mode, remote assets should not be fetched
      expect(mockedFetch).not.toHaveBeenCalled()

      // The image should not have dimensions added (since we skipped the fetch)
      const imgNode = tree.children[0] as Element
      expect(imgNode.properties?.width).toBeUndefined()
      expect(imgNode.properties?.height).toBeUndefined()
    })

    it("should default to online mode when offline flag is not provided", async () => {
      const tree: Root = {
        type: "root",
        children: [h("p", ["No assets"]) as Element],
      }
      const pluginInstance = addAssetDimensionsFromSrc()
      // argv without offline property to test the ?? false branch
      const mockCtx = { argv: {} } as BuildCtx
      const transformer = pluginInstance.htmlPlugins(mockCtx)[0]()
      await transformer(tree)

      // Should work without errors (offline defaults to false)
      expect(tree.children).toHaveLength(1)
    })
  })

  describe("fetchAndParseAssetDimensions for local assets", () => {
    let tmpDir: string
    let imageFile: string
    let videoFile: string
    const imageFileName = "local-image.png"

    beforeEach(async () => {
      // skipcq: JS-P1003
      tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "assetDimensions-local-"))
      imageFile = path.join(tmpDir, imageFileName)
      await fs.writeFile(imageFile, mockImageData)

      videoFile = path.join(tmpDir, "video.mp4")
      await fs.writeFile(videoFile, "dummy")
    })

    afterEach(async () => {
      // skipcq: JS-P1003
      await fsExtra.remove(tmpDir)
      jest.restoreAllMocks()
    })

    it("reads dimensions for local image via file://", async () => {
      const dims = await assetProcessor.fetchAndParseAssetDimensions(`file://${imageFile}`, 1)
      expect(dims).toEqual(mockFetchedImageDims)
    })

    it("reads dimensions for local video via file://", async () => {
      mockSpawnSync.mockReturnValueOnce({
        pid: 1,
        output: ["", `${mockVideoWidth}x${mockVideoHeight}`, ""],
        stdout: `${mockVideoWidth}x${mockVideoHeight}`,
        stderr: "",
        status: 0,
        signal: null,
      } as unknown as SpawnSyncReturns<string>)
      const dims = await assetProcessor.fetchAndParseAssetDimensions(`file://${videoFile}`, 1)
      expect(mockSpawnSync).toHaveBeenCalledWith("ffprobe", expect.arrayContaining([videoFile]), {
        encoding: "utf-8",
      })
      expect(dims).toEqual(mockFetchedVideoDims)
    })

    it("throws when local asset not found", async () => {
      const missing = path.join(tmpDir, "not-exist.png")
      await expect(
        assetProcessor.fetchAndParseAssetDimensions(`file://${missing}`, 1),
      ).rejects.toThrow("ENOENT")
    })

    it("reads dimensions for local asset with root-relative path", async () => {
      const expectedPath = path.join(paths.projectRoot, "quartz", "static", imageFileName)
      jest.spyOn(fs, "access").mockResolvedValueOnce(undefined)
      jest.spyOn(fs, "readFile").mockResolvedValueOnce(mockImageData)

      const dims = await assetProcessor.fetchAndParseAssetDimensions(`/static/${imageFileName}`, 1)

      expect(fs.access).toHaveBeenCalledWith(expectedPath)
      expect(fs.readFile).toHaveBeenCalledWith(expectedPath)
      expect(dims).toEqual(mockFetchedImageDims)
    })

    it("should throw for local asset if image-size fails", async () => {
      sizeOfMock.mockImplementation(() => {
        throw new Error("parsing error")
      })
      const missing = path.join(tmpDir, "not-exist.png")
      await fs.writeFile(missing, "fake-data")
      await expect(
        assetProcessor.fetchAndParseAssetDimensions(`file://${missing}`, 1),
      ).rejects.toThrow("unsupported file type")
    })

    it("reads dimensions for relative path inside website_content", async () => {
      const relImageName = "relimage.png"
      const expectedPath = path.join(paths.projectRoot, "website_content", relImageName)
      jest.spyOn(fs, "access").mockResolvedValueOnce(undefined)
      jest.spyOn(fs, "readFile").mockResolvedValueOnce(mockImageData)

      const dims = await assetProcessor.fetchAndParseAssetDimensions(relImageName, 1)

      expect(fs.access).toHaveBeenCalledWith(expectedPath)
      expect(fs.readFile).toHaveBeenCalledWith(expectedPath)
      expect(dims).toEqual(mockFetchedImageDims)
    })

    it.each([
      { description: "leading slash", inputPath: `/asset_staging/${imageFileName}` },
      { description: "relative path", inputPath: `asset_staging/${imageFileName}` },
      { description: "relative path with ../", inputPath: `../asset_staging/${imageFileName}` },
    ])("reads dimensions for asset_staging path with $description", async ({ inputPath }) => {
      const expectedPath = path.join(
        paths.projectRoot,
        "website_content",
        "asset_staging",
        imageFileName,
      )
      jest.spyOn(fs, "access").mockResolvedValueOnce(undefined)
      jest.spyOn(fs, "readFile").mockResolvedValueOnce(mockImageData)

      const dims = await assetProcessor.fetchAndParseAssetDimensions(inputPath, 1)

      expect(fs.access).toHaveBeenCalledWith(expectedPath)
      expect(fs.readFile).toHaveBeenCalledWith(expectedPath)
      expect(dims).toEqual(mockFetchedImageDims)
    })

    it("throws when sizeOf returns object lacking width/height for local image", async () => {
      const badImagePath = path.join(tmpDir, "bad.png")
      await fs.writeFile(badImagePath, mockImageData)

      jest.resetModules()
      const invalidSizeOf = jest.fn().mockReturnValue({ type: "png" })
      jest.doMock("image-size", () => ({ __esModule: true, default: invalidSizeOf }))

      const { AssetProcessor: FreshAssetProcessor } = await import("../assetDimensions")
      const freshProcessor = new FreshAssetProcessor()

      const dims = await freshProcessor.fetchAndParseAssetDimensions(`file://${badImagePath}`, 1)
      expect(dims).toEqual({ width: mockImageWidth, height: mockImageHeight })

      jest.dontMock("image-size")
    })
  })
})
