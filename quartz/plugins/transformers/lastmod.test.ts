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

  it.each([
    ["Unix epoch (0)", 0, '"0"'],
    ["invalid string", "not-a-date", '"not-a-date"'],
  ])("warns and returns current date for %s", (_, input, expectedWarning) => {
    const before = Date.now()
    const result = coerceDate("test.md", input)
    const after = Date.now()
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(after)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`invalid date ${expectedWarning}`))
  })

  it("includes file path and documentation link in warning", () => {
    coerceDate("my/custom/path.md", "invalid")
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("my/custom/path.md"))
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("developer.mozilla.org/en-US/docs/Web/JavaScript"),
    )
  })
})

describe("CreatedModifiedDate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    [undefined],
    [{}],
    [{ priority: ["frontmatter" as const] }],
  ])("creates transformer with options: %j", (opts) => {
    const transformer = CreatedModifiedDate(opts)
    expect(transformer.name).toBe("CreatedModifiedDate")
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
      data: { filePath, frontmatter },
      cwd: "/test/cwd",
    })

    const mockBuildCtx = {} as never

    const getProcessor = () => {
      const transformer = CreatedModifiedDate({ priority: ["frontmatter"] })
      const plugins = transformer.markdownPlugins!(mockBuildCtx)
      return (plugins[0] as () => (tree: never, file: MockFile) => Promise<void>)()
    }

    it("extracts dates from date, lastmod, and date_published frontmatter", async () => {
      const processor = getProcessor()
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
      const processor = getProcessor()
      const mockFile = createMockFile({ date_published: "2024-01-15" })

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.created.toISOString()).toContain("2024-01-15")
    })

    it.each([
      ["date_updated", { date_updated: "2024-01-20" }],
      ["updated", { updated: "2024-01-18" }],
      ["last-modified", { "last-modified": "2024-01-19" }],
    ])("uses %s as fallback for modified", async (_, frontmatter) => {
      const processor = getProcessor()
      const mockFile = createMockFile(frontmatter)

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.modified).toBeDefined()
      expect(mockFile.data.dates?.modified.getFullYear()).toBe(2024)
    })

    it("handles file with no frontmatter", async () => {
      const processor = getProcessor()
      const mockFile = { data: { filePath: "test.md", frontmatter: undefined }, cwd: "/test/cwd" } as unknown as MockFile

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.created).toBeDefined()
    })

    it("handles empty filePath", async () => {
      const processor = getProcessor()
      const mockFile = { data: { filePath: "", frontmatter: { date: "2024-01-15" } }, cwd: "/test/cwd" } as unknown as MockFile

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.created).toBeDefined()
    })

    it.each([
      ["date over date_published for created", { date: "2024-01-01", date_published: "2024-01-15" }, "created", "2024-01-01"],
      ["lastmod over date_updated for modified", { lastmod: "2024-01-01", date_updated: "2024-01-20" }, "modified", "2024-01-01"],
    ])("prioritizes %s", async (_, frontmatter, field, expectedDate) => {
      const processor = getProcessor()
      const mockFile = createMockFile(frontmatter)

      await processor({} as never, mockFile)

      const dates = mockFile.data.dates as Record<string, Date>
      expect(dates[field].toISOString()).toContain(expectedDate)
    })

    it("correctly parses published date with ISO format", async () => {
      const processor = getProcessor()
      const mockFile = createMockFile({ date_published: "2024-01-19T00:47:04.621Z" })

      await processor({} as never, mockFile)

      expect(mockFile.data.dates?.published.toISOString()).toBe("2024-01-19T00:47:04.621Z")
    })
  })
})
