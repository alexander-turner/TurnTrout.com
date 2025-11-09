/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach, afterEach, beforeAll } from "@jest/globals"

import { specialFaviconPaths, minFaviconCount } from "../../components/constants"

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
jest.unstable_mockModule("../../components/constants", () => ({
  specialFaviconPaths: { ...specialFaviconPaths },
  minFaviconCount: minFaviconCount,
  faviconCountWhitelist: ["apple_com"],
  faviconSubstringBlacklist: ["blacklisted_com"],
  googleSubdomainWhitelist: [],
}))
jest.unstable_mockModule("../transformers/linkfavicons", () => ({
  urlCache: new Map<string, string>(),
  transformUrl: jest.fn((path: string) => {
    // Mock blacklist check
    if (path.includes("blacklisted_com")) {
      return "/default-favicon.png"
    }
    // Mock replacements (e.g., blog_openai_com -> openai_com)
    if (path.includes("blog_openai_com")) {
      return path.replace("blog_openai_com", "openai_com")
    }
    // Return path as-is (no replacement needed)
    return path
  }),
  getFaviconUrl: jest.fn((path: string) => {
    // Return DEFAULT_PATH for paths that should be filtered out
    if (path === "/default-favicon.png" || path.includes("invalid_url")) {
      return "/default-favicon.png"
    }
    if (path.startsWith("http")) {
      return path
    }
    return path.replace(".png", ".avif")
  }),
  normalizePathForCounting: jest.fn((path: string) => {
    // Remove extensions for counting
    if (path.startsWith("http")) {
      return path
    }
    if (path.match(/\.(svg|ico)$/)) {
      return path
    }
    return path.replace(/\.(png|svg|avif)$/, "")
  }),
  shouldIncludeFavicon: jest.fn(
    (imgPath: string, countKey: string, faviconCounts: Map<string, number>) => {
      // Mock blacklist check (check URL path)
      if (imgPath.includes("blacklisted_com")) {
        return false
      }
      // Mock whitelist check (check URL path)
      const isWhitelisted =
        imgPath.includes("apple_com") ||
        imgPath.includes("turntrout") ||
        imgPath.includes("mail.svg") ||
        imgPath.includes("anchor.svg")
      if (isWhitelisted) {
        return true
      }
      // Check count threshold - normalize countKey like the real function does
      // Handle both normalized keys (no extension) and keys with extensions from test data
      // Test data has keys with extensions, but real getFaviconCounts() returns keys without extensions
      // So check original key first (for test compatibility), then normalized key (for real behavior)
      let count = faviconCounts.get(countKey)
      if (count === undefined) {
        // Normalize like the real function
        if (countKey.startsWith("http") || countKey.match(/\.(svg|ico)$/)) {
          count = faviconCounts.get(countKey) ?? 0
        } else {
          const normalizedKey = countKey.replace(/\.(png|svg|avif)$/, "")
          count = faviconCounts.get(normalizedKey) ?? 0
        }
      }
      return count >= minFaviconCount
    },
  ),
  createFaviconElement: jest.fn((url: string) => {
    if (url.endsWith(".svg")) {
      const domain = url.match(/\/([^/]+)\.svg$/)?.[1] || ""
      return {
        type: "element",
        tagName: "svg",
        properties: {
          class: "favicon",
          "data-domain": domain,
          style: `--mask-url: url(${url});`,
          alt: "",
        },
        children: [],
      }
    }
    return {
      type: "element",
      tagName: "img",
      properties: { src: url, class: "favicon", alt: "", loading: "lazy" },
      children: [],
    }
  }),
  DEFAULT_PATH: "/default-favicon.png",
}))
jest.unstable_mockModule("globby", () => ({
  globby: jest.fn(async (pattern: string) => {
    if (pattern.includes("test")) {
      return ["file1.test.ts", "file2.test.tsx", "file3.test.ts"]
    }
    return []
  }),
}))

import fs from "fs"
import { type Element } from "hast"
import { fromHtml } from "hast-util-from-html"

import { type BuildCtx } from "../../util/ctx"
import { type StaticResources } from "../../util/resources"
import { type QuartzEmitterPlugin } from "../types"

describe("PopulateContainers", () => {
  let mockCtx: BuildCtx
  const mockOutputDir = "/mock/output"
  const mockStaticResources: StaticResources = { css: [], js: [] }
  let mockGetFaviconCounts: jest.MockedFunction<() => Map<string, number>>
  let PopulateContainersEmitter: QuartzEmitterPlugin
  let linkFaviconsModule: typeof import("../transformers/linkfavicons")

  beforeAll(async () => {
    const countfaviconsModule = await import("../transformers/countfavicons")
    mockGetFaviconCounts = countfaviconsModule.getFaviconCounts as jest.MockedFunction<
      () => Map<string, number>
    >

    const populateModule = await import("./populateContainers")
    PopulateContainersEmitter = populateModule.PopulateContainers

    linkFaviconsModule = await import("../transformers/linkfavicons")
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
      const emitter = PopulateContainersEmitter()
      expect(emitter.getQuartzComponents(mockCtx)).toEqual([])
    })

    it("should return dependency graph", async () => {
      const emitter = PopulateContainersEmitter()
      if (!emitter.getDependencyGraph) {
        throw new Error("getDependencyGraph is not defined")
      }
      const graph = await emitter.getDependencyGraph(mockCtx, [], mockStaticResources)
      expect(graph).toBeDefined()
    })
  })

  describe("container population", () => {
    it.each<[string, Array<[string, number]>, (content: string) => void]>([
      [
        "should populate with valid favicons that exceed threshold",
        [
          ["/static/images/external-favicons/example_com.png", minFaviconCount - 1],
          ["/static/images/external-favicons/test_com.png", minFaviconCount + 3],
        ],
        (content: string) => {
          expect(content).not.toContain("example_com.avif")
          expect(content).toContain("test_com.avif")
        },
      ],
      [
        "should filter out favicons below threshold",
        [
          ["/static/images/external-favicons/above_threshold_com.png", minFaviconCount + 1],
          ["/static/images/external-favicons/below_threshold_com.png", minFaviconCount - 1],
        ],
        (content: string) => {
          expect(content).toContain("above_threshold_com.avif")
          expect(content).not.toContain("below_threshold_com.avif")
        },
      ],
      [
        "should filter out blacklisted favicons",
        [
          ["/static/images/external-favicons/blacklisted_com.png", minFaviconCount + 10],
          ["/static/images/external-favicons/valid_com.png", minFaviconCount + 1],
        ],
        (content: string) => {
          expect(content).not.toContain("blacklisted_com")
          expect(content).toContain("valid_com.avif")
        },
      ],
      [
        "should filter out favicons where getFaviconUrl returns DEFAULT_PATH",
        [
          ["/static/images/external-favicons/invalid_url.png", minFaviconCount + 1],
          ["/static/images/external-favicons/valid_com.png", minFaviconCount + 1],
        ],
        (content: string) => {
          expect(content).not.toContain("invalid_url")
          expect(content).toContain("valid_com.avif")
        },
      ],
    ])("%s", async (_, counts, assertFn) => {
      const faviconCounts = createMockCounts(counts)
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(mockGetFaviconCounts).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      assertFn(writtenContent)
    })

    it("should sort favicons by count descending", async () => {
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/zebra_com.png", 15],
        ["/static/images/external-favicons/apple_com.png", 10],
        ["/static/images/external-favicons/beta_com.png", 20],
      ])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      const betaIndex = writtenContent.indexOf("beta_com.avif")
      const zebraIndex = writtenContent.indexOf("zebra_com.avif")
      const appleIndex = writtenContent.indexOf("apple_com.avif")
      expect(betaIndex).toBeLessThan(zebraIndex)
      expect(zebraIndex).toBeLessThan(appleIndex)
    })

    it("should include whitelisted favicons even if below threshold", async () => {
      const faviconCounts = createMockCounts([[specialFaviconPaths.turntrout, minFaviconCount - 1]])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain(specialFaviconPaths.turntrout)
    })

    it("should handle already-normalized paths", async () => {
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/openai_com.png", minFaviconCount + 1],
      ])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain("openai_com.avif")
    })

    it("should handle empty counts", async () => {
      mockGetFaviconCounts.mockReturnValue(createMockCounts([]))

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('id="favicon-container"')
    })

    it.each([
      [
        "when test page does not exist",
        () => {
          jest.spyOn(fs, "existsSync").mockReturnValue(false)
        },
        () => {
          expect(fs.readFileSync).not.toHaveBeenCalled()
        },
      ],
      [
        "when #favicon-container does not exist",
        () => {
          jest.spyOn(fs, "readFileSync").mockReturnValue("<html><body><div></div></body></html>")
        },
        () => {},
      ],
    ])("should not process %s", async (_, setupFn, additionalAssert) => {
      setupFn()

      const emitter = PopulateContainersEmitter()
      const result = await emitter.emit(mockCtx, [], mockStaticResources)

      expect(result).toEqual([])
      expect(fs.writeFileSync).not.toHaveBeenCalled()
      additionalAssert()
    })

    it("should replace existing container children", async () => {
      mockGetFaviconCounts.mockReturnValue(
        createMockCounts([
          ["/static/images/external-favicons/example_com.png", minFaviconCount + 1],
        ]),
      )
      jest
        .spyOn(fs, "readFileSync")
        .mockReturnValue(
          '<html><body><div id="favicon-container"><span>existing</span><p>content</p></div></body></html>',
        )

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain("example_com.avif")
      expect(writtenContent).not.toContain("existing")
      expect(writtenContent).not.toContain("content")
    })

    it("should create favicon elements with correct properties", async () => {
      mockGetFaviconCounts.mockReturnValue(
        createMockCounts([
          ["/static/images/external-favicons/example_com.png", minFaviconCount + 1],
        ]),
      )

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('class="favicon"')
      expect(writtenContent).toContain('alt=""')
      expect(writtenContent).toContain('loading="lazy"')
    })

    it("should cache SVG URLs when found on CDN", async () => {
      // Clear urlCache before test
      linkFaviconsModule.urlCache.clear()

      const pngPath = "/static/images/external-favicons/example_com"
      const faviconCounts = createMockCounts([[pngPath, minFaviconCount + 1]])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      // Mock fetch to return successful response for SVG
      const mockFetch = jest
        .fn<() => Promise<Response>>()
        .mockResolvedValue({ ok: true } as Response)
      global.fetch = mockFetch as unknown as typeof fetch

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      // Verify SVG URL was checked
      expect(mockFetch).toHaveBeenCalledWith(
        "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
      )

      // Verify cache was populated with PNG->SVG mapping
      expect(linkFaviconsModule.urlCache.get(`${pngPath}.png`)).toBe(
        "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
      )
    })

    it("should check CDN for paths cached with DEFAULT_PATH", async () => {
      // Clear urlCache and populate with DEFAULT_PATH entry
      linkFaviconsModule.urlCache.clear()
      const pngPath = "/static/images/external-favicons/example_com"
      linkFaviconsModule.urlCache.set(`${pngPath}.png`, linkFaviconsModule.DEFAULT_PATH)

      const faviconCounts = createMockCounts([[pngPath, minFaviconCount + 1]])
      mockGetFaviconCounts.mockReturnValue(faviconCounts)

      // Mock fetch to return successful response for SVG
      const mockFetch = jest
        .fn<() => Promise<Response>>()
        .mockResolvedValue({ ok: true } as Response)
      global.fetch = mockFetch as unknown as typeof fetch

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      // Verify SVG URL was checked even though path was in cache
      expect(mockFetch).toHaveBeenCalledWith(
        "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
      )
    })
  })

  describe("generalized functions", () => {
    let populateModule: typeof import("./populateContainers")

    beforeAll(async () => {
      populateModule = await import("./populateContainers")
    })

    describe("findElementById", () => {
      it.each<[string, string, string, (root: Element | null) => void]>([
        [
          "should find element by ID",
          '<html><body><div id="test-id">content</div></body></html>',
          "test-id",
          (root: Element | null) => {
            expect(root).not.toBeNull()
            expect((root as Element)?.properties?.id).toBe("test-id")
          },
        ],
        [
          "should return null when element not found",
          '<html><body><div id="other-id">content</div></body></html>',
          "test-id",
          (root: Element | null) => expect(root).toBeNull(),
        ],
      ])("%s", (_, html, id, assertFn) => {
        const root = populateModule.findElementById(fromHtml(html), id)
        assertFn(root)
      })
    })

    describe("generateConstantContent", () => {
      it.each([
        ["string constant", "test value", "test value"],
        ["number constant", 42, "42"],
      ])("should generate content from %s", async (_, value, expected) => {
        const generator = populateModule.generateConstantContent(value)
        const elements = await generator()
        expect(elements).toHaveLength(1)
        expect(elements[0].children[0]).toHaveProperty("value", expected)
      })
    })

    describe("generateTestCountContent", () => {
      it("should generate test count content", async () => {
        const generator = populateModule.generateTestCountContent()
        const elements = await generator()
        expect(elements).toHaveLength(1)
        expect(elements[0].tagName).toBe("span")
        expect(elements[0].children[0]).toHaveProperty("value", "3 test files")
      })
    })

    describe("populateElements", () => {
      it.each([
        [
          "should populate multiple elements",
          '<html><body><div id="id1"></div><div id="id2"></div></body></html>',
          [
            { id: "id1", value: "value1" },
            { id: "id2", value: "value2" },
          ],
          (content: string) => {
            expect(content).toContain("value1")
            expect(content).toContain("value2")
          },
        ],
        [
          "should skip missing elements",
          '<html><body><div id="id1"></div></body></html>',
          [
            { id: "id1", value: "value1" },
            { id: "missing-id", value: "value2" },
          ],
          (content: string) => {
            expect(content).toContain("value1")
            expect(content).not.toContain("value2")
          },
        ],
      ])("%s", async (_, html, configs, assertFn) => {
        jest.spyOn(fs, "existsSync").mockReturnValue(true)
        jest.spyOn(fs, "readFileSync").mockReturnValue(html)
        jest.spyOn(fs, "writeFileSync").mockImplementation(() => {})

        const result = await populateModule.populateElements(
          "/tmp/test.html",
          configs.map((c) => ({
            id: c.id,
            generator: populateModule.generateConstantContent(c.value),
          })),
        )

        expect(result).toHaveLength(1)
        const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
        assertFn(writtenContent)
      })

      it("should return empty array when file does not exist", async () => {
        jest.spyOn(fs, "existsSync").mockReturnValue(false)

        const result = await populateModule.populateElements("/tmp/nonexistent.html", [
          {
            id: "id1",
            generator: populateModule.generateConstantContent("value"),
          },
        ])

        expect(result).toEqual([])
        expect(fs.readFileSync).not.toHaveBeenCalled()
        expect(fs.writeFileSync).not.toHaveBeenCalled()
      })
    })
  })
})
