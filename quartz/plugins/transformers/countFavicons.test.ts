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
import * as linkfavicons from "./linkfavicons"

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

function getWrittenContent(): string {
  const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find((call) =>
    (call[0] as string).toString().endsWith(".tmp"),
  )
  expect(writeCall).toBeDefined()
  return writeCall![1] as string
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
    const writtenContent = getWrittenContent()
    expect(writtenContent).toContain(expectedPath)
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    const matchingLine = lines.find((line) => line.includes(expectedPath))
    expect(matchingLine).toContain(`${expectedCount}\t`)
  })

  it("should count external URL links", async () => {
    const hostname = "example.com"
    const faviconPath = linkfavicons.getQuartzPath(hostname)
    const content = `[page1](https://${hostname}/page1)\n[page2](https://${hostname}/page2)\n[page3](https://${hostname}/page3)`

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    const pathWithoutExt = faviconPath.replace(/\.png$/, "")
    expect(writtenContent).toContain(pathWithoutExt)
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    const externalLine = lines.find((line) => line.includes(pathWithoutExt))
    expect(externalLine).toContain("3\t")
  })

  it.each([
    {
      name: "asset links",
      content:
        "[image](https://example.com/image.png)\n[video](https://example.com/video.mp4)\n[audio](https://example.com/audio.mp3)",
      check: (lines: string[]) => {
        const assetLines = lines.filter(
          (line) => line.includes("example_com") && line.includes("image.png"),
        )
        expect(assetLines.length).toBe(0)
      },
    },
    {
      name: "footnote links",
      content: "[fn1](#user-content-fn-1)\n[fn2](#user-content-fn-2)",
      check: (lines: string[]) => {
        const footnoteLines = lines.filter((line) => line.includes("#user-content-fn"))
        expect(footnoteLines.length).toBe(0)
      },
    },
    {
      name: "anchor links in headings",
      content: "## [Section 1](#section-1)\n### [Section 2](#section-2)",
      check: (lines: string[]) => {
        const anchorLines = lines.filter((line) => line.includes("#section"))
        expect(anchorLines.length).toBe(0)
      },
    },
  ])("should skip $name", async ({ content, check }) => {
    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    check(lines)
  })

  it("should count anchor links in non-heading elements", async () => {
    const content = "Some text [section 1](#section-1)\n\nMore text [section 2](#section-2)"

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    expect(writtenContent).toContain(specialFaviconPaths.anchor)
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    const anchorLine = lines.find((line) => line.includes(specialFaviconPaths.anchor))
    expect(anchorLine).toBeDefined()
    const count = parseInt(anchorLine!.split("\t")[0], 10)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it.each([
    {
      name: "invalid URLs",
      content: "[link](not-a-url)\n[link2](http://[invalid-ipv6)",
      check: (lines: string[]) => {
        // Invalid URLs should be skipped, so they shouldn't appear in counts
        const invalidLines = lines.filter(
          (line) => line.includes("not-a-url") || line.includes("invalid-ipv6"),
        )
        expect(invalidLines.length).toBe(0)
      },
    },
    {
      name: "empty link URLs",
      content: "[link]()",
      check: (lines: string[]) => {
        // Empty URLs should be skipped
        expect(lines.length).toBe(0)
      },
    },
  ])("should skip $name", async ({ content, check }) => {
    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    check(lines)
  })

  it("should count relative URLs correctly", async () => {
    const content = "[link1](./shard-theory)\n[link2](../shard-theory)"

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    expect(writtenContent).toContain(specialFaviconPaths.turntrout)
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    const turntroutLine = lines.find((line) => line.includes(specialFaviconPaths.turntrout))
    expect(turntroutLine).toBeDefined()
    const count = parseInt(turntroutLine!.split("\t")[0], 10)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it("should count multiple different hostnames separately", async () => {
    const content = `[page1](https://example.com/page1)\n[page2](https://example.com/page2)\n[page3](https://test.com/page1)`

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    expect(lines.length).toBeGreaterThanOrEqual(2)

    const exampleLine = lines.find((line) => line.includes("example_com"))
    const testLine = lines.find((line) => line.includes("test_com"))

    expect(exampleLine).toBeDefined()
    expect(testLine).toBeDefined()

    const exampleCount = parseInt(exampleLine!.split("\t")[0], 10)
    const testCount = parseInt(testLine!.split("\t")[0], 10)

    expect(exampleCount).toBeGreaterThanOrEqual(2)
    expect(testCount).toBeGreaterThanOrEqual(1)
    expect(exampleCount).toBeGreaterThan(testCount)
  })

  it("should write counts sorted by count descending, then alphabetically", async () => {
    const content = `[test1](mailto:test1@example.com)\n[test2](mailto:test2@example.com)\n[test3](mailto:test3@example.com)\n[section 1](#section-1)\n[section 2](#section-2)`

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    expect(lines.length).toBeGreaterThanOrEqual(2)

    const mailLine = lines.find((line) => line.includes(specialFaviconPaths.mail))
    const anchorLine = lines.find((line) => line.includes(specialFaviconPaths.anchor))

    expect(mailLine).toBeDefined()
    expect(anchorLine).toBeDefined()

    const mailCount = parseInt(mailLine!.split("\t")[0], 10)
    const anchorCount = parseInt(anchorLine!.split("\t")[0], 10)

    expect(mailCount).toBeGreaterThanOrEqual(3)
    expect(anchorCount).toBeGreaterThanOrEqual(2)

    const mailIndex = lines.indexOf(mailLine!)
    const anchorIndex = lines.indexOf(anchorLine!)

    const countsEqual = mailCount === anchorCount
    const mailAfterAnchor = mailIndex > anchorIndex

    expect(countsEqual ? mailAfterAnchor : mailCount > anchorCount).toBe(true)
  })

  it("should sort alphabetically when counts are equal", async () => {
    const content = `[page1](https://example.com/page1)\n[page2](https://example.com/page2)\n[page1](https://apple.com/page1)\n[page2](https://apple.com/page2)`

    const filePath = await createTestFile(content)
    await countAllFavicons(mockCtx, [filePath])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    const lines = writtenContent.split("\n").filter((line) => line.trim())

    const applePath = linkfavicons.getQuartzPath("apple.com")
    const applePathWithoutExt = applePath.replace(/\.png$/, "")
    const examplePath = linkfavicons.getQuartzPath("example.com")
    const examplePathWithoutExt = examplePath.replace(/\.png$/, "")

    const appleLine = lines.find((line) => line.includes(applePathWithoutExt))
    const exampleLine = lines.find((line) => line.includes(examplePathWithoutExt))

    expect(appleLine).toBeDefined()
    expect(exampleLine).toBeDefined()

    const appleCount = parseInt(appleLine!.split("\t")[0], 10)
    const exampleCount = parseInt(exampleLine!.split("\t")[0], 10)

    expect(appleCount).toBe(2)
    expect(exampleCount).toBe(2)

    const appleIndex = lines.indexOf(appleLine!)
    const exampleIndex = lines.indexOf(exampleLine!)
    expect(appleIndex).toBeLessThan(exampleIndex)
  })

  it("should accumulate counts across multiple files", async () => {
    const file1 = await createTestFile("[test](mailto:test@example.com)", "file1.md")
    const file2 = await createTestFile("[test](mailto:test@example.com)", "file2.md")

    await countAllFavicons(mockCtx, [file1, file2])

    expect(fs.writeFileSync).toHaveBeenCalled()
    const writtenContent = getWrittenContent()
    const lines = writtenContent.split("\n").filter((line) => line.trim())
    const mailLine = lines.find((line) => line.includes(specialFaviconPaths.mail))
    expect(mailLine).toBeDefined()
    const count = parseInt(mailLine!.split("\t")[0], 10)
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
    expect(renameCall[1]).toBe(linkfavicons.FAVICON_COUNTS_FILE)
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
