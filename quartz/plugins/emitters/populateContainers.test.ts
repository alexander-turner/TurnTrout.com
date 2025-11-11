/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach, beforeAll, afterEach } from "@jest/globals"

jest.mock("fs")
jest.mock("../transformers/logger_utils", () => ({
  createWinstonLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}))
let mockFaviconCounts: Map<string, number> = new Map()
const getFaviconCountsMock = jest.fn(() => mockFaviconCounts)
jest.unstable_mockModule("../transformers/countFavicons", () => ({
  getFaviconCounts: getFaviconCountsMock,
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

import { minFaviconCount, specialFaviconPaths } from "../../components/constants"
import { type BuildCtx } from "../../util/ctx"
import { type StaticResources } from "../../util/resources"
// skipcq: JS-C1003
import * as linkfavicons from "../transformers/linkfavicons"
import { type QuartzEmitterPlugin } from "../types"

describe("PopulateContainers", () => {
  let mockCtx: BuildCtx
  const mockOutputDir = "/mock/output"
  const mockStaticResources: StaticResources = { css: [], js: [] }
  let PopulateContainersEmitter: QuartzEmitterPlugin
  let urlCache: Map<string, string>
  let DEFAULT_PATH: string
  let countFavicons: typeof import("../transformers/countFavicons")
  let populateContainers: typeof import("./populateContainers")
  let getFaviconCountsMock: jest.MockedFunction<() => Map<string, number>>

  beforeAll(async () => {
    countFavicons = await import("../transformers/countFavicons")
    getFaviconCountsMock = countFavicons.getFaviconCounts as jest.MockedFunction<
      () => Map<string, number>
    >
    populateContainers = await import("./populateContainers")
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {})
    jest.spyOn(fs, "readFileSync").mockReturnValue("")
    jest.spyOn(fs.promises, "readFile").mockResolvedValue("")

    PopulateContainersEmitter = populateContainers.PopulateContainers
    urlCache = linkfavicons.urlCache
    DEFAULT_PATH = linkfavicons.DEFAULT_PATH
  })

  beforeEach(() => {
    mockFaviconCounts = new Map<string, number>()
    if (getFaviconCountsMock) {
      getFaviconCountsMock.mockClear()
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)
    }
    if (urlCache) {
      urlCache.clear()
    }
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(
        '<html><body><div id="populate-favicon-container"></div><div id="populate-favicon-threshold"></div><span class="populate-site-favicon"></span></body></html>',
      )
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {})

    mockCtx = {
      argv: {
        output: mockOutputDir,
      },
    } as BuildCtx
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (urlCache) {
      urlCache.clear()
    }
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
          ["/static/images/external-favicons/example_com", minFaviconCount - 1],
          ["/static/images/external-favicons/test_com", minFaviconCount + 3],
        ],
        (content: string) => {
          expect(content).not.toContain("example_com.avif")
          expect(content).toContain("test_com.avif")
        },
      ],
      [
        "should filter out favicons below threshold",
        [
          ["/static/images/external-favicons/above_threshold_com", minFaviconCount + 1],
          ["/static/images/external-favicons/below_threshold_com", minFaviconCount - 1],
        ],
        (content: string) => {
          expect(content).toContain("above_threshold_com.avif")
          expect(content).not.toContain("below_threshold_com.avif")
        },
      ],
      [
        "should filter out blacklisted favicons",
        [
          ["/static/images/external-favicons/medium_com", minFaviconCount + 10],
          ["/static/images/external-favicons/valid_com", minFaviconCount + 1],
        ],
        (content: string) => {
          expect(content).not.toContain("medium_com")
          expect(content).toContain("valid_com.avif")
        },
      ],
    ])("%s", async (_, counts, assertFn) => {
      const faviconCounts = createMockCounts(counts)
      mockFaviconCounts = faviconCounts
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(getFaviconCountsMock).toHaveBeenCalled()
      expect(fs.writeFileSync).toHaveBeenCalled()
      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      assertFn(writtenContent)
    })

    it("should sort favicons by count descending", async () => {
      // Use whitelisted domains to ensure they pass filtering
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/openai_com", 10],
        ["/static/images/external-favicons/apple_com", 15],
        ["/static/images/external-favicons/x_com", 20],
      ])
      mockFaviconCounts = faviconCounts
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      // Extract domain names in order of appearance (each appears 3 times, so get first occurrence)
      const domainPattern = /data-domain="([^"]+)"/g
      const domains: string[] = []
      let match
      while ((match = domainPattern.exec(writtenContent)) !== null) {
        if (!domains.includes(match[1])) {
          domains.push(match[1])
        }
      }
      // Verify order: x_com (20) > apple_com (15) > openai_com (10)
      expect(domains).toEqual(["x_com", "apple_com", "openai_com"])
    })

    it("should include whitelisted favicons even if below threshold", async () => {
      const faviconCounts = createMockCounts([[specialFaviconPaths.turntrout, minFaviconCount - 1]])
      mockFaviconCounts = faviconCounts
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain(specialFaviconPaths.turntrout)
    })

    it("should handle already-normalized paths", async () => {
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/openai_com", minFaviconCount + 1],
      ])
      mockFaviconCounts = faviconCounts
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      // Implementation may return SVG or AVIF depending on availability
      expect(writtenContent).toContain("openai_com")
    })

    it("should handle empty counts", async () => {
      mockFaviconCounts = createMockCounts([])
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('id="populate-favicon-container"')
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
        "when #populate-favicon-container does not exist",
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
      mockFaviconCounts = createMockCounts([
        ["/static/images/external-favicons/example_com", minFaviconCount + 1],
      ])
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)
      jest
        .spyOn(fs, "readFileSync")
        .mockReturnValue(
          '<html><body><div id="populate-favicon-container"><span>existing</span><p>content</p></div></body></html>',
        )

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      // Implementation may return SVG or AVIF depending on availability
      expect(writtenContent).toContain("example_com")
      expect(writtenContent).not.toContain("existing")
      expect(writtenContent).not.toContain("content")
    })

    it("should create favicon elements with correct properties", async () => {
      mockFaviconCounts = createMockCounts([
        ["/static/images/external-favicons/example_com", minFaviconCount + 1],
      ])
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('class="favicon"')
      expect(writtenContent).toContain('alt=""')
      expect(writtenContent).toContain('loading="lazy"')
    })

    it("should populate favicon threshold element", async () => {
      mockFaviconCounts = createMockCounts([])
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls
      const designPageCall = writeCalls.find(
        (call: unknown[]) => typeof call[0] === "string" && call[0].includes("design.html"),
      )
      expect(designPageCall).toBeDefined()
      const writtenContent = designPageCall![1] as string
      expect(writtenContent).toContain('id="populate-favicon-threshold"')
      expect(writtenContent).toContain(`<span>${minFaviconCount}</span>`)
    })

    it("should populate both favicon container and threshold element", async () => {
      const faviconCounts = createMockCounts([
        ["/static/images/external-favicons/example_com", minFaviconCount + 1],
      ])
      mockFaviconCounts = faviconCounts
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls
      // Check test page has favicon container
      const testPageCall = writeCalls.find(
        (call: unknown[]) => typeof call[0] === "string" && call[0].includes("Test-page.html"),
      )
      expect(testPageCall).toBeDefined()
      const testPageContent = testPageCall![1] as string
      expect(testPageContent).toContain('id="populate-favicon-container"')
      expect(testPageContent).toContain("example_com")

      // Check design page has threshold
      const designPageCall = writeCalls.find(
        (call: unknown[]) => typeof call[0] === "string" && call[0].includes("design.html"),
      )
      expect(designPageCall).toBeDefined()
      const designPageContent = designPageCall![1] as string
      expect(designPageContent).toContain('id="populate-favicon-threshold"')
      expect(designPageContent).toContain(`<span>${minFaviconCount}</span>`)
    })

    it("should cache SVG URLs when found on CDN", async () => {
      // Clear urlCache before test
      urlCache.clear()

      const pngPath = "/static/images/external-favicons/example_com"
      const faviconCounts = createMockCounts([[pngPath, minFaviconCount + 1]])
      mockFaviconCounts = faviconCounts
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      // Mock fetch to return successful response for SVG
      const originalFetch = global.fetch
      const mockFetch = jest
        .fn<() => Promise<Response>>()
        .mockResolvedValue({ ok: true } as Response)
      global.fetch = mockFetch as unknown as typeof fetch

      try {
        const emitter = PopulateContainersEmitter()
        await emitter.emit(mockCtx, [], mockStaticResources)

        // Verify SVG URL was checked
        expect(mockFetch).toHaveBeenCalledWith(
          "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
        )

        // Verify cache was populated with PNG->SVG mapping
        expect(urlCache.get(`${pngPath}.png`)).toBe(
          "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
        )
      } finally {
        global.fetch = originalFetch
      }
    })

    it("should check CDN for paths cached with DEFAULT_PATH", async () => {
      // Clear urlCache and populate with DEFAULT_PATH entry
      urlCache.clear()
      const pngPath = "/static/images/external-favicons/example_com"
      urlCache.set(`${pngPath}.png`, DEFAULT_PATH)

      const faviconCounts = createMockCounts([[pngPath, minFaviconCount + 1]])
      mockFaviconCounts = faviconCounts
      getFaviconCountsMock.mockImplementation(() => mockFaviconCounts)

      // Mock fetch to return successful response for SVG
      const originalFetch = global.fetch
      const mockFetch = jest
        .fn<() => Promise<Response>>()
        .mockResolvedValue({ ok: true } as Response)
      global.fetch = mockFetch as unknown as typeof fetch

      try {
        const emitter = PopulateContainersEmitter()
        await emitter.emit(mockCtx, [], mockStaticResources)

        // Verify SVG URL was checked even though path was in cache
        expect(mockFetch).toHaveBeenCalledWith(
          "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
        )
      } finally {
        global.fetch = originalFetch
      }
    })
  })

  describe("generalized functions", () => {
    let populateModule: typeof import("./populateContainers")

    beforeAll(async () => {
      populateModule = populateContainers
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

    describe("findElementsByClass", () => {
      it.each<[string, string, string, (elements: Element[]) => void]>([
        [
          "should find single element by class",
          '<html><body><div class="test-class">content</div></body></html>',
          "test-class",
          (elements: Element[]) => {
            expect(elements).toHaveLength(1)
            expect(elements[0]?.tagName).toBe("div")
          },
        ],
        [
          "should find multiple elements by class",
          '<html><body><span class="test-class">1</span><div class="test-class">2</div><p class="test-class">3</p></body></html>',
          "test-class",
          (elements: Element[]) => {
            expect(elements).toHaveLength(3)
            expect(elements.map((e) => e.tagName)).toEqual(["span", "div", "p"])
          },
        ],
        [
          "should return empty array when class not found",
          '<html><body><div class="other-class">content</div></body></html>',
          "test-class",
          (elements: Element[]) => expect(elements).toHaveLength(0),
        ],
        [
          "should find elements with multiple classes",
          '<html><body><div class="test-class other-class">content</div></body></html>',
          "test-class",
          (elements: Element[]) => {
            expect(elements).toHaveLength(1)
            expect(elements[0]?.properties?.className).toEqual(["test-class", "other-class"])
          },
        ],
      ])("%s", (_, html, className, assertFn) => {
        const elements = populateModule.findElementsByClass(fromHtml(html), className)
        assertFn(elements)
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

    describe("generateSiteFaviconContent", () => {
      it("should generate site favicon element", async () => {
        const generator = populateModule.generateSiteFaviconContent()
        const elements = await generator()
        expect(elements).toHaveLength(1)
        expect(elements[0].tagName).toBe("span")
        expect(elements[0].properties?.className).toContain("favicon-span")
        const faviconElement = elements[0].children[0] as Element
        expect(faviconElement.tagName).toBe("svg")
        expect(faviconElement.properties?.class).toContain("favicon")
        expect(faviconElement.properties?.style).toContain(specialFaviconPaths.turntrout)
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

      it.each([
        [
          "should populate single element by class",
          '<html><body><span class="test-class"></span></body></html>',
          [{ className: "test-class", value: "populated" }],
          true,
          (content: string) => {
            expect(content).toContain("populated")
            expect(content).toContain('class="test-class"')
          },
        ],
        [
          "should populate multiple elements by class",
          '<html><body><span class="test-class">1</span><div class="test-class">2</div></body></html>',
          [{ className: "test-class", value: "same" }],
          true,
          (content: string) => {
            const matches = content.match(/>same</g)
            expect(matches).toHaveLength(2)
          },
        ],
        [
          "should handle mixed ID and class configs",
          '<html><body><div id="by-id"></div><span class="by-class"></span></body></html>',
          [
            { id: "by-id", value: "id-value" },
            { className: "by-class", value: "class-value" },
          ],
          true,
          (content: string) => {
            expect(content).toContain("id-value")
            expect(content).toContain("class-value")
          },
        ],
        [
          "should skip when class not found",
          '<html><body><span class="other-class"></span></body></html>',
          [{ className: "test-class", value: "populated" }],
          false,
          (content: string) => {
            expect(content).not.toContain("populated")
            expect(content).toContain('class="other-class"')
          },
        ],
      ])("%s", async (_, html, configs, shouldModify, assertFn) => {
        jest.spyOn(fs, "existsSync").mockReturnValue(true)
        jest.spyOn(fs, "readFileSync").mockReturnValue(html)
        jest.spyOn(fs, "writeFileSync").mockImplementation(() => {})

        const result = await populateModule.populateElements(
          "/tmp/test.html",
          configs.map((c) => ({
            id: c.id,
            className: c.className,
            generator: populateModule.generateConstantContent(c.value),
          })),
        )

        expect(result).toEqual(shouldModify ? ["/tmp/test.html"] : [])
        expect(fs.writeFileSync).toHaveBeenCalledTimes(shouldModify ? 1 : 0)
        const writtenContent = shouldModify
          ? ((fs.writeFileSync as jest.Mock).mock.calls[0][1] as string)
          : html
        assertFn(writtenContent)
      })

      it("should throw when config has neither id nor className", async () => {
        jest.spyOn(fs, "existsSync").mockReturnValue(true)
        jest.spyOn(fs, "readFileSync").mockReturnValue("<html><body></body></html>")

        type ElementPopulatorConfig = Parameters<typeof populateModule.populateElements>[1][number]
        await expect(
          populateModule.populateElements("/tmp/test.html", [
            {
              generator: populateModule.generateConstantContent("value"),
            } as ElementPopulatorConfig,
          ]),
        ).rejects.toThrow("Config missing both id and className")
      })
    })
  })
})
