/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach, beforeAll, afterEach } from "@jest/globals"

const mockGlobbyFn = jest.fn<(pattern: string | string[], options?: unknown) => Promise<string[]>>()
const mockExecSync = jest.fn<(command: string, options?: unknown) => string>()

jest.unstable_mockModule("globby", () => ({
  globby: mockGlobbyFn,
}))

jest.unstable_mockModule("child_process", () => ({
  execSync: mockExecSync,
}))

import fs from "fs"
import { type Element } from "hast"
import { fromHtml } from "hast-util-from-html"

import { simpleConstants, specialFaviconPaths } from "../../components/constants"
import { type BuildCtx } from "../../util/ctx"
import { type StaticResources } from "../../util/resources"

const { minFaviconCount, defaultPath } = simpleConstants
import { faviconCounter } from "../transformers/countFavicons"
// skipcq: JS-C1003
import * as linkfavicons from "../transformers/linkfavicons"
import { type QuartzEmitterPlugin } from "../types"

let populateModule: typeof import("./populateContainers")
let PopulateContainersEmitter: QuartzEmitterPlugin

describe("PopulateContainers", () => {
  let mockCtx: BuildCtx
  const mockOutputDir = "/mock/output"
  const mockStaticResources: StaticResources = { css: [], js: [] }
  const urlCache = linkfavicons.urlCache

  beforeAll(async () => {
    populateModule = await import("./populateContainers")
    PopulateContainersEmitter = populateModule.PopulateContainers
  })

  beforeEach(() => {
    faviconCounter.clear()
    mockGlobbyFn.mockImplementation(async (pattern: string | string[]) => {
      const patternStr = Array.isArray(pattern) ? pattern[0] : pattern
      if (patternStr.includes(".html")) {
        return ["test-page.html", "design.html"]
      }
      return ["file1.test.ts", "file2.test.tsx", "file3.test.ts"]
    })

    // Provide default outputs for all repo-stat commands invoked during emitter.emit
    mockExecSync.mockImplementation((command: string) => {
      if (command.includes("git rev-list")) return "100\n"
      if (command.includes("pnpm test")) return "Tests:       100 passed, 100 total\n"
      if (command.includes("pytest --collect-only")) return "1293 tests collected in 0.50s\n"
      if (command.includes('grep -r "test("')) return "10\n"
      if (command.includes("find . -type f")) return "1000\n"
      return "100\n"
    })

    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
      // Mock implementation - no-op for testing
    })
    jest.spyOn(fs, "readFileSync").mockImplementation((path: unknown) => {
      const pathStr = String(path)
      if (pathStr.includes("test-page.html")) {
        return '<html><body><div id="populate-favicon-container"></div></body></html>'
      }
      if (pathStr.includes("design.html")) {
        return '<html><body><div id="populate-favicon-threshold"></div><div id="populate-max-size-card"></div><span class="populate-commit-count"></span><span class="populate-js-test-count"></span><span class="populate-playwright-test-count"></span><span class="populate-playwright-configs"></span><span class="populate-playwright-total-tests"></span><span class="populate-pytest-count"></span><span class="populate-lines-of-code"></span></body></html>'
      }
      // Default for other files
      return '<html><body><div id="populate-favicon-container"></div><div id="populate-favicon-threshold"></div><span class="populate-commit-count"></span><span class="populate-js-test-count"></span><span class="populate-playwright-test-count"></span><span class="populate-pytest-count"></span><span class="populate-lines-of-code"></span><span class="populate-turntrout-favicon"></span></body></html>'
    })

    if (urlCache) {
      urlCache.clear()
    }

    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
    } as Response)
    mockCtx = {
      argv: {
        output: mockOutputDir,
      },
    } as BuildCtx
  })

  afterEach(() => {
    jest.restoreAllMocks()
    faviconCounter.clear()
    if (urlCache) {
      urlCache.clear()
    }
  })

  const setFaviconCounts = (entries: Array<[string, number]>): void => {
    faviconCounter.clear()
    entries.forEach(([path, count]) => {
      faviconCounter.set(path, count)
    })
  }

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
    ])(
      "%s",
      async (_, counts, assertFn) => {
        setFaviconCounts(counts)

        const emitter = PopulateContainersEmitter()
        await emitter.emit(mockCtx, [], mockStaticResources)

        expect(fs.writeFileSync).toHaveBeenCalled()
        const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
        assertFn(writtenContent)
      },
      10000,
    )

    it("should sort favicons by count descending", async () => {
      // Use whitelisted domains to ensure they pass filtering
      setFaviconCounts([
        ["/static/images/external-favicons/openai_com", minFaviconCount + 10],
        ["/static/images/external-favicons/apple_com", minFaviconCount + 15],
        ["/static/images/external-favicons/x_com", minFaviconCount + 20],
      ])

      // Mock fetch to return ok: true for SVG URLs so they get cached and used
      jest.spyOn(global, "fetch").mockImplementation((url) => {
        const urlStr = url.toString()
        if (urlStr.includes(".svg")) {
          return Promise.resolve({ ok: true } as Response)
        }
        return Promise.resolve({ ok: false } as Response)
      })

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      // Extract domain names in order of appearance (each appears 3 times, so get first occurrence)
      const domainPattern = /data-domain="(?<domain>[^"]+)"/g
      const domains: string[] = []
      for (const match of writtenContent.matchAll(domainPattern)) {
        if (!domains.includes(match.groups?.domain ?? "")) {
          domains.push(match.groups?.domain ?? "")
        }
      }
      // Verify order: x_com (20) > apple_com (15) > openai_com (10)
      expect(domains).toEqual(["x_com", "apple_com", "openai_com"])
    }, 10000)

    it("should include whitelisted favicons even if below threshold", async () => {
      setFaviconCounts([[specialFaviconPaths.turntrout, minFaviconCount - 1]])

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain(specialFaviconPaths.turntrout)
    })

    it("should handle already-normalized paths", async () => {
      setFaviconCounts([["/static/images/external-favicons/openai_com", minFaviconCount + 1]])

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      // Implementation may return SVG or AVIF depending on availability
      expect(writtenContent).toContain("openai_com")
    })

    it("should handle empty counts", async () => {
      setFaviconCounts([])

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('id="populate-favicon-container"')
    })

    it("should not process when #populate-favicon-container does not exist", async () => {
      jest.spyOn(fs, "readFileSync").mockReturnValue("<html><body><div></div></body></html>")

      const emitter = PopulateContainersEmitter()
      const result = await emitter.emit(mockCtx, [], mockStaticResources)

      expect(result).toEqual([])
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it("should throw when test page does not exist", async () => {
      jest.spyOn(fs, "readFileSync").mockImplementation(() => {
        const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException
        error.code = "ENOENT"
        throw error
      })

      const emitter = PopulateContainersEmitter()
      await expect(emitter.emit(mockCtx, [], mockStaticResources)).rejects.toThrow("ENOENT")
    })

    it("should replace existing container children", async () => {
      setFaviconCounts([["/static/images/external-favicons/example_com", minFaviconCount + 1]])
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
      setFaviconCounts([["/static/images/external-favicons/example_com", minFaviconCount + 1]])

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writtenContent = (fs.writeFileSync as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('class="favicon"')
      expect(writtenContent).toContain('alt=""')
      expect(writtenContent).toContain('loading="lazy"')
    })

    it("should populate favicon threshold element", async () => {
      setFaviconCounts([])

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls
      const designPageCall = writeCalls.find(
        (call: unknown[]) => typeof call[0] === "string" && call[0].includes("design.html"),
      )
      expect(designPageCall).toBeDefined()
      if (!designPageCall) {
        throw new Error("designPageCall not found")
      }
      const writtenContent = designPageCall[1] as string
      expect(writtenContent).toContain('id="populate-favicon-threshold"')
      expect(writtenContent).toContain(`<span>${minFaviconCount}</span>`)
    })

    it("should populate both favicon container and threshold element", async () => {
      setFaviconCounts([["/static/images/external-favicons/example_com", minFaviconCount + 1]])

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls
      // Check test page has favicon container
      const testPageCall = writeCalls.find(
        (call: unknown[]) => typeof call[0] === "string" && call[0].includes("test-page.html"),
      )
      expect(testPageCall).toBeDefined()
      if (!testPageCall) {
        throw new Error("testPageCall not found")
      }
      const testPageContent = testPageCall[1] as string
      expect(testPageContent).toContain('id="populate-favicon-container"')
      expect(testPageContent).toContain("example_com")

      // Check design page has threshold
      const designPageCall = writeCalls.find(
        (call: unknown[]) => typeof call[0] === "string" && call[0].includes("design.html"),
      )
      expect(designPageCall).toBeDefined()
      if (!designPageCall) {
        throw new Error("designPageCall not found")
      }
      const designPageContent = designPageCall[1] as string
      expect(designPageContent).toContain('id="populate-favicon-threshold"')
      expect(designPageContent).toContain(`<span>${minFaviconCount}</span>`)
    })

    it("should cache SVG URLs when found on CDN", async () => {
      // Clear urlCache before test
      urlCache.clear()

      const pngPath = "/static/images/external-favicons/example_com"
      setFaviconCounts([[pngPath, minFaviconCount + 1]])

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

    it("should check CDN for paths cached with defaultPath", async () => {
      // Clear urlCache and populate with defaultPath entry
      urlCache.clear()
      const pngPath = "/static/images/external-favicons/example_com"
      urlCache.set(`${pngPath}.png`, defaultPath)

      setFaviconCounts([[pngPath, minFaviconCount + 1]])

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
    it("should handle unknown populate targets gracefully", async () => {
      setFaviconCounts([])

      // Mock HTML with unknown populate targets
      jest.spyOn(fs, "readFileSync").mockImplementation((path: unknown) => {
        const pathStr = String(path)
        if (pathStr.includes("test-page.html")) {
          return '<html><body><div id="populate-unknown-id"></div><span class="populate-unknown-class"></span></body></html>'
        }
        return "<html><body></body></html>"
      })

      const emitter = PopulateContainersEmitter()
      const result = await emitter.emit(mockCtx, [], mockStaticResources)

      // Should not throw, just log warnings
      expect(result).toEqual([])
    })

    it("should skip files that don't exist", async () => {
      setFaviconCounts([])

      // Mock existsSync to return false for one file
      jest.spyOn(fs, "existsSync").mockImplementation((path: unknown) => {
        const pathStr = String(path)
        return !pathStr.includes("nonexistent.html")
      })

      mockGlobbyFn.mockImplementation(async (pattern: string | string[]) => {
        const patternStr = Array.isArray(pattern) ? pattern[0] : pattern
        if (patternStr.includes(".html")) {
          return ["test-page.html", "nonexistent.html", "design.html"]
        }
        return ["file1.test.ts", "file2.test.tsx", "file3.test.ts"]
      })

      const emitter = PopulateContainersEmitter()
      await emitter.emit(mockCtx, [], mockStaticResources)

      expect(fs.writeFileSync).toHaveBeenCalled()
    })
  })

  describe("generalized functions", () => {
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

    describe("generateSpecialFaviconContent", () => {
      it.each([
        ["turntrout", specialFaviconPaths.turntrout],
        ["anchor", specialFaviconPaths.anchor],
      ])("should generate %s favicon element", async (_name, faviconPath) => {
        const generator = populateModule.generateSpecialFaviconContent(faviconPath)
        const elements = await generator()
        expect(elements).toHaveLength(1)

        const wrapperSpan = elements[0]
        expect(wrapperSpan).toMatchObject({
          tagName: "span",
          properties: { className: expect.arrayContaining(["favicon-span"]) },
        })

        const faviconElement = wrapperSpan.children[0] as Element
        expect(faviconElement).toMatchObject({
          tagName: "svg",
          properties: {
            class: expect.stringContaining("favicon"),
            style: expect.stringContaining(faviconPath),
          },
        })
      })

      it("should generate accessible favicon element when alt text provided", async () => {
        const altText = "A trout jumping to the left."
        const generator = populateModule.generateSpecialFaviconContent(
          specialFaviconPaths.turntrout,
          altText,
        )
        const elements = await generator()
        expect(elements).toHaveLength(1)

        const faviconElement = elements[0].children[0] as Element
        expect(faviconElement).toMatchObject({
          tagName: "svg",
          properties: {
            role: "img",
            "aria-label": altText,
          },
        })
        // Should not have hidden properties when accessible
        expect(faviconElement.properties["aria-hidden"]).toBeUndefined()
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
        jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
          // Mock to prevent actual file writes during tests
        })

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

      it("should throw when file does not exist", async () => {
        jest.spyOn(fs, "readFileSync").mockImplementation(() => {
          const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException
          error.code = "ENOENT"
          throw error
        })

        await expect(
          populateModule.populateElements("/tmp/nonexistent.html", [
            {
              id: "id1",
              generator: populateModule.generateConstantContent("value"),
            },
          ]),
        ).rejects.toThrow("ENOENT")
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
        jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
          // Mock to prevent actual file writes during tests
        })

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
        const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true)
        const readSpy = jest.spyOn(fs, "readFileSync").mockReturnValue("<html><body></body></html>")

        type ElementPopulatorConfig = Parameters<typeof populateModule.populateElements>[1][number]
        await expect(
          populateModule.populateElements("/tmp/test.html", [
            {
              generator: populateModule.generateConstantContent("value"),
            } as ElementPopulatorConfig,
          ]),
        ).rejects.toThrow("Config missing both id and className")

        existsSpy.mockRestore()
        readSpy.mockRestore()
      })

      it("should throw when config has both id and className", async () => {
        const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(true)
        const readSpy = jest.spyOn(fs, "readFileSync").mockReturnValue("<html><body></body></html>")

        await expect(
          populateModule.populateElements("/tmp/test.html", [
            {
              id: "test-id",
              className: "test-class",
              generator: populateModule.generateConstantContent("value"),
            },
          ]),
        ).rejects.toThrow("Config cannot have both id and className")

        existsSpy.mockRestore()
        readSpy.mockRestore()
      })
    })
  })

  describe("Repository Statistics Functions", () => {
    beforeEach(() => {
      mockExecSync.mockClear()
      mockGlobbyFn.mockClear()
    })

    describe("countGitCommits", () => {
      it("should count commits for a specific author", async () => {
        mockExecSync.mockReturnValue("4943\n")

        const count = await populateModule.countGitCommits("Alex Turner")

        expect(count).toBe(4943)
        expect(mockExecSync).toHaveBeenCalledWith(
          'git rev-list --all --count --author="Alex Turner"',
          { encoding: "utf-8" },
        )
      })

      it("should handle whitespace in output", async () => {
        mockExecSync.mockReturnValue("\n\n  1234  \n\n")

        const count = await populateModule.countGitCommits("Test Author")

        expect(count).toBe(1234)
      })
    })

    describe("countJsTestFiles", () => {
      it("should count JS/TS tests from pnpm test output", async () => {
        mockExecSync.mockReturnValue("Tests:       1234 passed, 1234 total\n")

        const count = await populateModule.countJsTests()

        expect(count).toBe(1234)
        expect(mockExecSync).toHaveBeenCalledWith(
          "pnpm test 2>&1 | grep -E 'Tests:.*passed' | tail -1",
          { encoding: "utf-8" },
        )
      })

      it("should throw when no tests found", async () => {
        mockExecSync.mockReturnValue("")

        await expect(populateModule.countJsTests()).rejects.toThrow(
          "Failed to parse test count from output",
        )
      })

      it("should handle different test output formats", async () => {
        mockExecSync.mockReturnValue("Tests:       42 passed, 50 total\n")

        const count = await populateModule.countJsTests()

        expect(count).toBe(42)
      })
    })

    describe("countPlaywrightTests", () => {
      it("should count Playwright test cases", async () => {
        mockExecSync.mockReturnValue("158\n")

        const count = await populateModule.countPlaywrightTests()

        expect(count).toBe(158)
        expect(mockExecSync).toHaveBeenCalledWith(
          'grep -r "test(" quartz/components/tests/*.spec.ts | wc -l',
          { encoding: "utf-8" },
        )
      })

      it("should handle zero test cases", async () => {
        mockExecSync.mockReturnValue("0\n")

        const count = await populateModule.countPlaywrightTests()

        expect(count).toBe(0)
      })
    })

    describe("countPytestTests", () => {
      it("should count pytest tests via pytest --collect-only", async () => {
        mockExecSync.mockReturnValue("1293 tests collected in 0.50s\n")

        const count = await populateModule.countPythonTests()

        expect(count).toBe(1293)
        expect(mockExecSync).toHaveBeenCalledWith(populateModule.PYTEST_COUNT_CMD, {
          encoding: "utf-8",
        })
      })

      it("should throw when pytest output doesn't match", async () => {
        mockExecSync.mockReturnValue("some weird output\n")

        await expect(populateModule.countPythonTests()).rejects.toThrow(
          "Failed to parse pytest test count from output",
        )
      })

      it("should handle large numbers", async () => {
        mockExecSync.mockReturnValue("10000 tests collected in 0.50s\n")

        const count = await populateModule.countPythonTests()

        expect(count).toBe(10000)
      })
    })

    describe("countLinesOfCode", () => {
      it("should count total lines of code", async () => {
        mockExecSync.mockReturnValue("83635\n")

        const count = await populateModule.countLinesOfCode()

        expect(count).toBe(83635)
        expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining("find . -type f"), {
          encoding: "utf-8",
        })
      })

      it("should handle very large codebases", async () => {
        mockExecSync.mockReturnValue("1000000\n")

        const count = await populateModule.countLinesOfCode()

        expect(count).toBe(1000000)
      })
    })

    describe("computeRepoStats", () => {
      it("should compute all statistics in parallel", async () => {
        mockExecSync
          .mockReturnValueOnce("4943\n")
          .mockReturnValueOnce("Tests:       1234 passed, 1234 total\n")
          .mockReturnValueOnce("158\n")
          .mockReturnValueOnce("1293 tests collected in 0.50s\n")
          .mockReturnValueOnce("83635\n")

        const stats = await populateModule.computeRepoStats()

        expect(stats).toEqual({
          commitCount: 4943,
          jsTestCount: 1234,
          playwrightTestCount: 158,
          pytestCount: 1293,
          linesOfCode: 83635,
        })
      })
    })

    describe("htmlFileToSlug", () => {
      it.each([
        ["design.html", "design"],
        ["posts/my-post.html", "posts/my-post"],
        ["folder/index.html", "folder/index"],
        ["deep/nested/page.html", "deep/nested/page"],
        ["index.html", "index"],
      ])("converts %s to %s", (input, expected) => {
        expect(populateModule.htmlFileToSlug(input)).toBe(expected)
      })
    })
  })
})
