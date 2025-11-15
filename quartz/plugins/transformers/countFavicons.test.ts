/**
 * @jest-environment node
 */
import { jest, expect, it, describe, beforeEach, afterEach } from "@jest/globals"
import fsExtra from "fs-extra"
import os from "os"
import path from "path"

jest.mock("fs")
jest.mock("./logger_utils", () => ({
  createWinstonLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}))

import fs from "fs"

import type { BuildCtx } from "../../util/ctx"
import type { FilePath } from "../../util/path"

import { specialFaviconPaths } from "../../components/constants"
import { countAllFavicons, getFaviconCounts } from "./countFavicons"
import { getQuartzPath, FAVICON_COUNTS_FILE } from "./linkfavicons"

let tempDir: string
let mockCtx: BuildCtx

beforeEach(async () => {
  tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "countlinks-test-"))
  jest.resetAllMocks()
  jest.restoreAllMocks()
  jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)
  jest.spyOn(fs, "renameSync").mockImplementation(() => undefined)
  jest.spyOn(fs, "readFileSync").mockImplementation(() => "")
  jest.spyOn(fs, "existsSync").mockReturnValue(false)

  mockCtx = {
    argv: {
      directory: tempDir,
      verbose: false,
    },
    cfg: {
      plugins: {
        transformers: [],
        filters: [],
        emitters: [],
      },
      configuration: {
        ignorePatterns: [],
      },
    },
    allSlugs: [],
  } as unknown as BuildCtx
})

afterEach(async () => {
  await fsExtra.remove(tempDir)
})

function getWrittenCounts(): Map<string, number> {
  const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find((call) =>
    (call[0] as string).toString().endsWith(".tmp"),
  )
  expect(writeCall).toBeDefined()
  if (!writeCall) {
    throw new Error("writeCall not found")
  }
  const jsonContent = writeCall[1] as string
  const entries = JSON.parse(jsonContent) as Array<[string, number]>
  return new Map(entries)
}

async function createTestFile(content: string, filename = "test.md"): Promise<FilePath> {
  const filePath = path.join(tempDir, filename) as FilePath
  await fsExtra.writeFile(filePath, content, "utf8")
  return filePath
}

describe("countAllLinks", () => {
  it.each([
    {
      name: "mailto links",
      content: "[test1](mailto:test1@example.com)\n[test2](mailto:test2@example.com)",
      expectedPath: specialFaviconPaths.mail,
      expectedCount: 2,
    },
    {
      name: "anchor links",
      content: "[section 1](#section-1)\n[section 2](#section-2)",
      expectedPath: specialFaviconPaths.anchor,
      expectedCount: 2,
    },
    {
      name: "RSS links",
      content: "[RSS](/rss.xml)\n[RSS 2](/rss.xml)",
      expectedPath: specialFaviconPaths.rss,
      expectedCount: 2,
    },
  ])("should count $name", async ({ content, expectedPath, expectedCount }) => {
    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    expect(counts.get(expectedPath)).toBe(expectedCount)
  })

  it("should count external URL links", async () => {
    const hostname = "example.com"
    const faviconPath = getQuartzPath(hostname)
    const content = `[page1](https://${hostname}/page1)\n[page2](https://${hostname}/page2)\n[page3](https://${hostname}/page3)`

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    const pathWithoutExt = faviconPath.replace(/\.png$/, "")
    expect(counts.get(pathWithoutExt)).toBe(3)
  })

  it.each([
    {
      name: "asset links",
      content:
        "[image](https://example.com/image.png)\n[video](https://example.com/video.mp4)\n[audio](https://example.com/audio.mp3)",
      check: (paths: string[]) => {
        const assetPaths = paths.filter((path) => path.includes("image.png"))
        expect(assetPaths.length).toBe(0)
      },
    },
    {
      name: "footnote links",
      content: "[fn1](#user-content-fn-1)\n[fn2](#user-content-fn-2)",
      check: (paths: string[]) => {
        const footnotePaths = paths.filter((path) => path.includes("#user-content-fn"))
        expect(footnotePaths.length).toBe(0)
      },
    },
    {
      name: "anchor links in headings",
      content: "## [Section 1](#section-1)\n### [Section 2](#section-2)",
      check: (paths: string[]) => {
        const anchorPaths = paths.filter((path) => path.includes("#section"))
        expect(anchorPaths.length).toBe(0)
      },
    },
  ])("should skip $name", async ({ content, check }) => {
    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    check(Array.from(counts.keys()))
  })

  it("should count anchor links in non-heading elements", async () => {
    const content = "Some text [section 1](#section-1)\n\nMore text [section 2](#section-2)"

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    const count = counts.get(specialFaviconPaths.anchor)
    expect(count).toBeDefined()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it.each([
    {
      name: "invalid URLs",
      content: "[link](not-a-url)\n[link2](http://[invalid-ipv6)",
      check: (paths: string[]) => {
        // Invalid URLs should be skipped, so they shouldn't appear in counts
        const invalidPaths = paths.filter(
          (path) => path.includes("not-a-url") || path.includes("invalid-ipv6"),
        )
        expect(invalidPaths.length).toBe(0)
      },
    },
    {
      name: "empty link URLs",
      content: "[link]()",
      check: (paths: string[]) => {
        // Empty URLs should be skipped
        expect(paths.length).toBe(0)
      },
    },
  ])("should skip $name", async ({ content, check }) => {
    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    check(Array.from(counts.keys()))
  })

  it("should count relative URLs correctly", async () => {
    const content = "[link1](./shard-theory)\n[link2](../shard-theory)"

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    const count = counts.get(specialFaviconPaths.turntrout)
    expect(count).toBeDefined()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it("should count multiple different hostnames separately", async () => {
    const content = `[page1](https://example.com/page1)\n[page2](https://example.com/page2)\n[page3](https://test.com/page1)`

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    expect(counts.size).toBeGreaterThanOrEqual(2)

    const examplePath = getQuartzPath("example.com").replace(/\.png$/, "")
    const testPath = getQuartzPath("test.com").replace(/\.png$/, "")

    const exampleCount = counts.get(examplePath)
    const testCount = counts.get(testPath)

    expect(exampleCount).toBeDefined()
    expect(testCount).toBeDefined()
    expect(exampleCount).toBeGreaterThanOrEqual(2)
    expect(testCount).toBeGreaterThanOrEqual(1)
    expect(exampleCount).toBeGreaterThan(testCount!)
  })

  it("should write counts", async () => {
    const content = `[test1](mailto:test1@example.com)\n[test2](mailto:test2@example.com)\n[test3](mailto:test3@example.com)\n[section 1](#section-1)\n[section 2](#section-2)`

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    expect(counts.size).toBeGreaterThanOrEqual(2)

    const mailCount = counts.get(specialFaviconPaths.mail)
    const anchorCount = counts.get(specialFaviconPaths.anchor)

    expect(mailCount).toBeDefined()
    expect(anchorCount).toBeDefined()
    expect(mailCount).toBeGreaterThanOrEqual(3)
    expect(anchorCount).toBeGreaterThanOrEqual(2)
  })

  it("should count when hostnames have equal counts", async () => {
    const content = `[page1](https://example.com/page1)\n[page2](https://example.com/page2)\n[page1](https://apple.com/page1)\n[page2](https://apple.com/page2)`

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()

    const applePath = getQuartzPath("apple.com")
    const applePathWithoutExt = applePath.replace(/\.png$/, "")
    const examplePath = getQuartzPath("example.com")
    const examplePathWithoutExt = examplePath.replace(/\.png$/, "")

    const appleCount = counts.get(applePathWithoutExt)
    const exampleCount = counts.get(examplePathWithoutExt)

    expect(appleCount).toBeDefined()
    expect(exampleCount).toBeDefined()
    expect(appleCount).toBe(2)
    expect(exampleCount).toBe(2)
  })

  it("should accumulate counts across multiple files", async () => {
    const file1 = await createTestFile("[test](mailto:test@example.com)", "file1.md")
    const file2 = await createTestFile("[test](mailto:test@example.com)", "file2.md")

    await countAllFavicons(mockCtx, [file1, file2])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const counts = getWrittenCounts()
    const count = counts.get(specialFaviconPaths.mail)
    expect(count).toBeDefined()
    expect(count).toBe(2)
  })

  it("should write atomically using temporary file then rename", async () => {
    const filePath = await createTestFile("[test](mailto:test@example.com)")
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    expect(fs.renameSync).toHaveBeenCalled()

    const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find((call) =>
      (call[0] as string).toString().endsWith(".tmp"),
    )
    expect(writeCall).toBeDefined()
    const renameCall = (fs.renameSync as jest.Mock).mock.calls[0]

    expect(writeCall![0]).toContain(".tmp")
    expect(renameCall[0]).toContain(".tmp")
    expect(renameCall[1]).toBe(FAVICON_COUNTS_FILE)
  })

  it("should handle write errors gracefully", async () => {
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("Write failed")
    })
    const filePath = await createTestFile("[test](mailto:test@example.com)")
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(countAllFavicons(mockCtx, [filePath])).resolves.not.toThrow()

    errorSpy.mockRestore()
  })

  it("should reset counter at the start of each build run", async () => {
    // First build
    const file1 = await createTestFile(
      "[test1](mailto:test1@example.com)\n[test2](mailto:test2@example.com)",
      "file1.md",
    )
    await countAllFavicons(mockCtx, [file1])

    const countsAfterFirstBuild = getFaviconCounts()
    expect(countsAfterFirstBuild.get(specialFaviconPaths.mail)).toBe(2)

    // Second build - counter should be reset
    const file2 = await createTestFile("[test3](mailto:test3@example.com)", "file2.md")
    await countAllFavicons(mockCtx, [file2])

    const countsAfterSecondBuild = getFaviconCounts()
    expect(countsAfterSecondBuild.get(specialFaviconPaths.mail)).toBe(1)
  })

  it("should handle invalid markdown files gracefully", async () => {
    const invalidPath = path.join(tempDir, "nonexistent.md") as FilePath
    const errorSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined)

    await expect(countAllFavicons(mockCtx, [invalidPath])).resolves.not.toThrow()

    errorSpy.mockRestore()
  })
})

describe("getFaviconCounts", () => {
  it("should read from file when in-memory map is empty", () => {
    // Mock file system to return valid favicon counts as JSON
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    const jsonData = JSON.stringify([
      ["quartz/static/images/external-favicons/example_com", 10],
      ["mail", 5],
    ])
    jest.spyOn(fs, "readFileSync").mockReturnValue(jsonData)

    const counts = getFaviconCounts()

    expect(counts.size).toBe(2)
    expect(counts.get("quartz/static/images/external-favicons/example_com")).toBe(10)
    expect(counts.get("mail")).toBe(5)
  })

  it("should return empty map when file does not exist", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false)

    const counts = getFaviconCounts()

    expect(counts.size).toBe(0)
  })
})
