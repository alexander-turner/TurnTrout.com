/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals"

import { coerceDate, CreatedModifiedDate } from "./lastmod"

describe("coerceDate", () => {
  it.each([
    ["ISO 8601 date", "2024-01-19T00:47:04.621Z", new Date("2024-01-19T00:47:04.621Z")],
    ["date with space separator", "2024-01-19 20:10:07", new Date("2024-01-19T20:10:07")],
    ["simple date", "2024-01-19", new Date("2024-01-19")],
    ["numeric timestamp", 1705694407919, new Date(1705694407919)],
  ])("parses valid date: %s", (_, input, expected) => {
    const result = coerceDate("test.md", input)
    expect(result.getTime()).toBe(expected.getTime())
  })

  it("returns current date for undefined input", () => {
    const before = Date.now()
    const result = coerceDate("test.md", undefined)
    const after = Date.now()
    expect(result.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.getTime()).toBeLessThanOrEqual(after)
  })

  it.each([
    ["Unix epoch (0)", 0],
    ["invalid string", "not-a-date"],
  ])("throws for invalid date: %s", (_, input) => {
    expect(() => coerceDate("test.md", input)).toThrow("Invalid date")
  })

  it("includes file path and documentation link in error", () => {
    expect(() => coerceDate("my/custom/path.md", "invalid")).toThrow("my/custom/path.md")
    expect(() => coerceDate("test.md", "invalid")).toThrow(
      "developer.mozilla.org/en-US/docs/Web/JavaScript",
    )
  })
})

describe("CreatedModifiedDate", () => {
  type MockFile = {
    data: {
      filePath: string
      frontmatter?: Record<string, unknown>
      dates?: { created: Date; modified: Date; published: Date }
    }
  }

  const createMockFile = (frontmatter: Record<string, unknown> = {}): MockFile => ({
    data: { filePath: "test.md", frontmatter },
  })

  const getProcessor = () => {
    const transformer = CreatedModifiedDate()
    const markdownPlugins = transformer.markdownPlugins
    if (!markdownPlugins) throw new Error("markdownPlugins not defined")
    const plugins = markdownPlugins({} as never)
    return (plugins[0] as () => (tree: never, file: MockFile) => Promise<void>)()
  }

  it("returns transformer with correct name", () => {
    const transformer = CreatedModifiedDate()
    expect(transformer.name).toBe("CreatedModifiedDate")
  })

  it("extracts date_published as created and published", async () => {
    const processor = getProcessor()
    const mockFile = createMockFile({ date_published: "2024-01-15" })

    await processor({} as never, mockFile)

    expect(mockFile.data.dates?.created.toISOString()).toContain("2024-01-15")
    expect(mockFile.data.dates?.published.toISOString()).toContain("2024-01-15")
  })

  it("extracts date_updated as modified", async () => {
    const processor = getProcessor()
    const mockFile = createMockFile({ date_updated: "2024-01-20" })

    await processor({} as never, mockFile)

    expect(mockFile.data.dates?.modified.toISOString()).toContain("2024-01-20")
  })

  it("handles missing frontmatter", async () => {
    const processor = getProcessor()
    const mockFile = { data: { filePath: "test.md" } } as unknown as MockFile

    await processor({} as never, mockFile)

    const now = Date.now()
    expect(mockFile.data.dates?.created.getTime()).toBeGreaterThan(now - 1000)
  })

  it("handles new article without date fields", async () => {
    const processor = getProcessor()
    const mockFile = createMockFile({ title: "New Article" }) // has frontmatter, no dates

    await processor({} as never, mockFile)

    const now = Date.now()
    expect(mockFile.data.dates?.created.getTime()).toBeGreaterThan(now - 1000)
    expect(mockFile.data.dates?.modified.getTime()).toBeGreaterThan(now - 1000)
  })

  it("handles missing filePath", async () => {
    const processor = getProcessor()
    const mockFile = { data: {} } as unknown as MockFile

    await processor({} as never, mockFile)

    expect(mockFile.data.dates).toBeDefined()
  })
})
