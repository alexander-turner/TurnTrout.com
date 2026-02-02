/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals"

import { coerceDate, CreatedModifiedDate } from "./lastmod"

describe("coerceDate", () => {
  const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {})

  beforeEach(() => {
    consoleSpy.mockClear()
  })

  it.each([
    ["ISO 8601 date", "2024-01-19T00:47:04.621Z", new Date("2024-01-19T00:47:04.621Z")],
    ["date with space separator", "2024-01-19 20:10:07", new Date("2024-01-19T20:10:07")],
    ["simple date", "2024-01-19", new Date("2024-01-19")],
    ["numeric timestamp", 1705694407919, new Date(1705694407919)],
  ])("parses valid date: %s", (_, input, expected) => {
    const result = coerceDate("test.md", input)
    expect(result.getTime()).toBe(expected.getTime())
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it("returns current date for undefined input without warning", () => {
    const before = Date.now()
    const result = coerceDate("test.md", undefined)
    const after = Date.now()
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(after)
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it("warns and returns current date for Unix epoch (0)", () => {
    const before = Date.now()
    const result = coerceDate("test.md", 0)
    const after = Date.now()
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(after)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('invalid date "0"'))
  })

  it("warns and returns current date for invalid date string", () => {
    const before = Date.now()
    const result = coerceDate("test.md", "not-a-date")
    const after = Date.now()
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(after)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('invalid date "not-a-date"'))
  })

  it("includes file path in warning message", () => {
    coerceDate("my/custom/path.md", "invalid")
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("my/custom/path.md"))
  })

  it("includes link to documentation in warning message", () => {
    coerceDate("test.md", "bad-date")
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("developer.mozilla.org/en-US/docs/Web/JavaScript"),
    )
  })
})

describe("CreatedModifiedDate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns a transformer with the correct name", () => {
    const transformer = CreatedModifiedDate()
    expect(transformer.name).toBe("CreatedModifiedDate")
  })

  it("uses default options when none provided", () => {
    const transformer = CreatedModifiedDate()
    expect(transformer.name).toBe("CreatedModifiedDate")
    expect(transformer.markdownPlugins).toBeDefined()
  })

  it("accepts custom priority options", () => {
    const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
    expect(transformer.name).toBe("CreatedModifiedDate")
  })

  it("accepts empty options", () => {
    const transformer = CreatedModifiedDate({})
    expect(transformer.name).toBe("CreatedModifiedDate")
  })

  it("returns markdownPlugins function", () => {
    const transformer = CreatedModifiedDate()
    expect(typeof transformer.markdownPlugins).toBe("function")
  })

  describe("markdownPlugins with frontmatter priority", () => {
    type MockFile = {
      data: {
        filePath: string
        frontmatter?: Record<string, unknown>
        dates?: { created: Date; modified: Date; published: Date }
      }
      cwd: string
    }

    const createMockFile = (
      frontmatter: Record<string, unknown> = {},
      filePath = "test.md",
    ): MockFile => ({
      data: {
        filePath,
        frontmatter,
      },
      cwd: "/test/cwd",
    })

    const mockBuildCtx = {} as never

    it("extracts dates from date and lastmod frontmatter", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = createMockFile({
        date: "2024-01-15",
        lastmod: "2024-01-20",
        date_published: "2024-01-15",
      })

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.created.toISOString()).toContain("2024-01-15")
      expect(mockFile.data.dates?.modified.toISOString()).toContain("2024-01-20")
      expect(mockFile.data.dates?.published.toISOString()).toContain("2024-01-15")
    })

    it("uses date_published as fallback for created", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = createMockFile({
        date_published: "2024-01-15",
      })

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.created.toISOString()).toContain("2024-01-15")
    })

    it("uses date_updated as fallback for modified", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = createMockFile({
        date_updated: "2024-01-20",
      })

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.modified.toISOString()).toContain("2024-01-20")
    })

    it("uses updated as fallback for modified", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = createMockFile({
        updated: "2024-01-18",
      })

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.modified.toISOString()).toContain("2024-01-18")
    })

    it("uses last-modified as fallback for modified", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = createMockFile({
        "last-modified": "2024-01-19",
      })

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.modified.toISOString()).toContain("2024-01-19")
    })

    it("handles file with no frontmatter", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = {
        data: {
          filePath: "test.md",
          frontmatter: undefined,
        },
        cwd: "/test/cwd",
      } as unknown as MockFile

      await processor({} as never, mockFile)

      // Should return current dates as fallback
      const now = Date.now()
      expect(mockFile.data.dates?.created.getTime()).toBeGreaterThan(now - 1000)
    })

    it("handles empty filePath", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = {
        data: {
          filePath: "",
          frontmatter: { date: "2024-01-15" },
        },
        cwd: "/test/cwd",
      } as unknown as MockFile

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.created.toISOString()).toContain("2024-01-15")
    })

    it("prioritizes date over date_published for created", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = createMockFile({
        date: "2024-01-01",
        date_published: "2024-01-15",
      })

      await processor({} as never, mockFile)

      // date should take priority
      expect(mockFile.data.dates?.created.toISOString()).toContain("2024-01-01")
    })

    it("prioritizes lastmod over date_updated for modified", async () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      const plugin = plugins[0] as () => (tree: never, file: MockFile) => Promise<void>
      const processor = plugin()
      const mockFile = createMockFile({
        lastmod: "2024-01-01",
        date_updated: "2024-01-20",
      })

      await processor({} as never, mockFile)

      // lastmod should take priority
      expect(mockFile.data.dates?.modified.toISOString()).toContain("2024-01-01")
    })
  })
})
