/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals"

jest.mock("fs")
jest.unstable_mockModule("../transformers/logger_utils", () => ({
  createWinstonLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}))
jest.unstable_mockModule("../transformers/countfavicons", () => ({
  getFaviconCounts: jest.fn(() => new Map<string, number>()),
}))
jest.unstable_mockModule("../transformers/linkfavicons", () => ({
  MIN_FAVICON_COUNT: 3,
  TURNTROUT_FAVICON_PATH:
    "https://assets.turntrout.com/static/images/turntrout-favicons/favicon.ico",
  getFaviconUrl: jest.fn((path: string) => {
    if (path.startsWith("http")) {
      return path
    }
    return path.replace(".png", ".avif")
  }),
  shouldIncludeFavicon: jest.fn(
    (imgPath: string, countKey: string, faviconCounts: Map<string, number>) => {
      const count = faviconCounts.get(countKey) || 0
      const isWhitelisted =
        imgPath === "https://assets.turntrout.com/static/images/turntrout-favicons/favicon.ico" ||
        imgPath.endsWith("apple_com.png")
      return isWhitelisted || count >= 3
    },
  ),
  createFaviconElement: jest.fn((url: string) => ({
    type: "element",
    tagName: "img",
    properties: { src: url, class: "favicon", alt: "", loading: "lazy" },
    children: [],
  })),
  DEFAULT_PATH: "/default-favicon.png",
}))

import fs from "fs"

import { type BuildCtx } from "../../util/ctx"
import { type StaticResources } from "../../util/resources"

describe("PopulateFaviconContainer", () => {
  let mockCtx: BuildCtx
  const mockOutputDir = "/mock/output"
  const mockStaticResources: StaticResources = { css: [], js: [] }
  let mockGetFaviconCounts: jest.MockedFunction<() => Map<string, number>>
  let PopulateFaviconContainer: typeof import("./populateFaviconContainer").PopulateFaviconContainer
  let linkfavicons: typeof import("../transformers/linkfavicons")

  beforeAll(async () => {
    const countfaviconsModule = await import("../transformers/countfavicons")
    mockGetFaviconCounts = countfaviconsModule.getFaviconCounts as jest.MockedFunction<
      () => Map<string, number>
    >

    const populateModule = await import("./populateFaviconContainer")
    PopulateFaviconContainer = populateModule.PopulateFaviconContainer

    linkfavicons = await import("../transformers/linkfavicons")
  })

  beforeEach(() => {
    mockGetFaviconCounts.mockReturnValue(new Map<string, number>())
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue('<html><body><div id="favicon-container"></div></body></html>')
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {})

    mockCtx = {
      argv: {
        output: mockOutputDir,
      },
    } as BuildCtx
  })

  afterEach(() => {
    jest.restoreAllMocks()
    // Don't restore the countfavicons mock - it's a module mock
  })

  const createMockCounts = (entries: Array<[string, number]>): Map<string, number> => {
    return new Map(entries)
  }

  describe("plugin structure", () => {
    it("should return empty components", () => {
      const emitter = PopulateFaviconContainer()
      expect(emitter.getQuartzComponents(mockCtx)).toEqual([])
    })

    it("should return dependency graph", async () => {
      const emitter = PopulateFaviconContainer()
      if (!emitter.getDependencyGraph) {
        throw new Error("getDependencyGraph is not defined")
      }
      const graph = await emitter.getDependencyGraph(mockCtx, [], mockStaticResources)
      expect(graph).toBeDefined()
    })
  })

  describe("container population", () => {
    it("should populate #favicon-container with valid favicons that exceed threshold", async () => {
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/example_com.png", 10],
        ["/static/images/external-favicons/test_com.png", 5],
      ])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateFaviconContainer()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(mockGetFaviconCounts).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain("example_com.avif")
      expect(writtenContent).toContain("test_com.avif")
    })

    it("should sort favicons by count descending", async () => {
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/zebra_com.png", 15],
        ["/static/images/external-favicons/apple_com.png", 10],
        ["/static/images/external-favicons/beta_com.png", 20],
      ])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateFaviconContainer()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(mockGetFaviconCounts).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      // Beta (20) should appear before zebra (15) before apple (10)
      const betaIndex = writtenContent.indexOf("beta_com.avif")
      const zebraIndex = writtenContent.indexOf("zebra_com.avif")
      const appleIndex = writtenContent.indexOf("apple_com.avif")
      expect(betaIndex).toBeLessThan(zebraIndex)
      expect(zebraIndex).toBeLessThan(appleIndex)
    })

    it("should filter out favicons below threshold", async () => {
      const faviconCounts = createMockCounts([
        [
          "/static/images/external-favicons/above_threshold_com.png",
          linkfavicons.MIN_FAVICON_COUNT + 1,
        ],
        [
          "/static/images/external-favicons/below_threshold_com.png",
          linkfavicons.MIN_FAVICON_COUNT - 1,
        ],
      ])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateFaviconContainer()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(mockGetFaviconCounts).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain("above_threshold_com.avif")
      expect(writtenContent).not.toContain("below_threshold_com.avif")
    })

    it("should include whitelisted favicons even if below threshold", async () => {
      const faviconCounts = createMockCounts([
        [linkfavicons.TURNTROUT_FAVICON_PATH, linkfavicons.MIN_FAVICON_COUNT - 1],
      ])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateFaviconContainer()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(mockGetFaviconCounts).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain(linkfavicons.TURNTROUT_FAVICON_PATH)
    })

    it("should handle empty counts", async () => {
      const faviconCounts = createMockCounts([])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateFaviconContainer()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(mockGetFaviconCounts).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      // Container should be empty but still exist
      expect(writtenContent).toContain('id="favicon-container"')
    })

    it("should not process when test page does not exist", async () => {
      jest.spyOn(fs, "existsSync").mockReturnValue(false)

      const emitter = PopulateFaviconContainer()
      const result = await emitter.emit(mockCtx, [], mockStaticResources)

      expect(result).toEqual([])
      expect(fs.readFileSync).not.toHaveBeenCalled()
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it("should not process when #favicon-container does not exist", async () => {
      jest.spyOn(fs, "readFileSync").mockReturnValue("<html><body><div></div></body></html>")

      const emitter = PopulateFaviconContainer()
      const result = await emitter.emit(mockCtx, [], mockStaticResources)

      expect(result).toEqual([])
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it("should replace existing container children", async () => {
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/example_com.png", linkfavicons.MIN_FAVICON_COUNT + 1],
      ])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)
      jest
        .spyOn(fs, "readFileSync")
        .mockReturnValue(
          '<html><body><div id="favicon-container"><span>existing</span><p>content</p></div></body></html>',
        )

      const emitter = PopulateFaviconContainer()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(mockGetFaviconCounts).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain("example_com.avif")
      expect(writtenContent).not.toContain("existing")
      expect(writtenContent).not.toContain("content")
    })

    it("should create favicon elements with correct properties", async () => {
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/example_com.png", linkfavicons.MIN_FAVICON_COUNT + 1],
      ])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateFaviconContainer()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(mockGetFaviconCounts).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('class="favicon"')
      expect(writtenContent).toContain('alt=""')
      expect(writtenContent).toContain('loading="lazy"')
    })
  })
})
