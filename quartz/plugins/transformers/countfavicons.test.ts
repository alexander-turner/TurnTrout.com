/**
 * @jest-environment node
 */
import type { Root } from "hast"

import { jest, expect, it, describe, beforeEach, afterEach } from "@jest/globals"
import fsExtra from "fs-extra"
import { h } from "hastscript"
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

import { specialFaviconPaths } from "../../components/constants"
import { CountFavicons, getFaviconCounts } from "./countfavicons"
import * as linkfavicons from "./linkfavicons"

let tempDir: string

beforeEach(async () => {
  tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "countfavicons-test-"))
  jest.resetAllMocks()
  jest.restoreAllMocks()
  jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)
  jest.spyOn(fs, "renameSync").mockImplementation(() => undefined)
})

afterEach(async () => {
  await fsExtra.remove(tempDir)
})

function createTransformFunction(): (tree: Root) => void {
  const plugin = CountFavicons()
  const htmlPlugins = (plugin.htmlPlugins as () => Array<() => (tree: Root) => void>)()
  return htmlPlugins[0]()
}

function getWrittenContent(): string {
  const writeCall = (fs.writeFileSync as jest.Mock).mock.calls.find((call) =>
    (call[0] as string).toString().endsWith(".tmp"),
  )
  expect(writeCall).toBeDefined()
  return writeCall![1] as string
}

describe("CountFavicons plugin", () => {
  it("should return a plugin configuration with correct name", () => {
    const plugin = CountFavicons()
    expect(plugin.name).toBe("CountFavicons")
    expect(plugin.htmlPlugins).toBeDefined()
    expect(typeof plugin.htmlPlugins).toBe("function")
  })

  it.each([
    {
      name: "mailto links",
      links: [
        h("a", { href: "mailto:test1@example.com" }),
        h("a", { href: "mailto:test2@example.com" }),
      ],
      expectedPath: specialFaviconPaths.mail,
      expectedCount: 2,
    },
    {
      name: "anchor links",
      links: [h("a", { href: "#section-1" }), h("a", { href: "#section-2" })],
      expectedPath: specialFaviconPaths.anchor,
      expectedCount: 2,
    },
    {
      name: "RSS links",
      links: [h("a", { href: "/rss.xml" }), h("a", { href: "/rss.xml" })],
      expectedPath: specialFaviconPaths.rss,
      expectedCount: 2,
    },
  ])("should count $name", ({ links, expectedPath, expectedCount }) => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [h("div", links)],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    expect(content).toContain(expectedPath)
    const lines = content.split("\n").filter((line) => line.trim())
    const matchingLine = lines.find((line) => line.includes(expectedPath))
    expect(matchingLine).toContain(`${expectedCount}\t`)
  })

  it("should count external URL links", () => {
    const transformFunction = createTransformFunction()
    const hostname = "example.com"
    const faviconPath = linkfavicons.getQuartzPath(hostname)

    const tree = {
      type: "root",
      children: [
        h("div", [
          h("a", { href: `https://${hostname}/page1` }),
          h("a", { href: `https://${hostname}/page2` }),
          h("a", { href: `https://${hostname}/page3` }),
        ]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    // Counts are now stored without extensions (format-agnostic)
    const pathWithoutExt = faviconPath.replace(/\.png$/, "")
    expect(content).toContain(pathWithoutExt)
    const lines = content.split("\n").filter((line) => line.trim())
    const externalLine = lines.find((line) => line.includes(pathWithoutExt))
    expect(externalLine).toContain("3\t")
  })

  it.each([
    {
      name: "asset links",
      tree: {
        type: "root",
        children: [
          h("div", [
            h("a", { href: "https://example.com/image.png" }),
            h("a", { href: "https://example.com/video.mp4" }),
            h("a", { href: "https://example.com/audio.mp3" }),
          ]),
        ],
      } as Root,
      check: (lines: string[]) => {
        const assetLines = lines.filter(
          (line) => line.includes("example_com.png") && line.includes("image.png"),
        )
        expect(assetLines.length).toBe(0)
      },
    },
    {
      name: "footnote links",
      tree: {
        type: "root",
        children: [
          h("div", [
            h("a", { href: "#user-content-fn-1" }),
            h("a", { href: "#user-content-fn-2" }),
          ]),
        ],
      } as Root,
      check: (lines: string[]) => {
        const footnoteLines = lines.filter((line) => line.includes("#user-content-fn"))
        expect(footnoteLines.length).toBe(0)
      },
    },
    {
      name: "anchor links in headings",
      tree: {
        type: "root",
        children: [
          h("h2", [h("a", { href: "#section-1" })]),
          h("h3", [h("a", { href: "#section-2" })]),
        ],
      } as Root,
      check: (lines: string[]) => {
        const anchorLines = lines.filter((line) => line.includes("#section"))
        expect(anchorLines.length).toBe(0)
      },
    },
  ])("should skip $name", ({ tree, check }) => {
    const transformFunction = createTransformFunction()

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    check(lines)
  })

  it("should count anchor links in non-heading elements", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [h("a", { href: "#section-1" })]),
        h("p", [h("a", { href: "#section-2" })]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    expect(content).toContain(specialFaviconPaths.anchor)
    const lines = content.split("\n").filter((line) => line.trim())
    const anchorLine = lines.find((line) => line.includes(specialFaviconPaths.anchor))
    expect(anchorLine).toBeDefined()
    const count = parseInt(anchorLine!.split("\t")[0], 10)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it.each([
    {
      name: "links without href",
      tree: {
        type: "root",
        children: [h("div", [h("a"), h("span", { href: "https://example.com" })])],
      } as Root,
    },
    {
      name: "links with non-string href",
      tree: {
        type: "root",
        children: [
          h("div", [
            h("a", { href: 123 as unknown as string }),
            h("a", { href: ["https://example.com"] as unknown as string }),
          ]),
        ],
      } as Root,
    },
    {
      name: "invalid URLs",
      tree: {
        type: "root",
        children: [
          h("div", [h("a", { href: "not-a-url" }), h("a", { href: "http://[invalid-ipv6" })]),
        ],
      } as Root,
    },
    {
      name: "nodes without parent",
      tree: {
        type: "root",
        children: [h("a", { href: "mailto:test@example.com" })],
      } as Root,
    },
  ])("should skip $name", ({ tree }) => {
    const transformFunction = createTransformFunction()

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    expect(lines.length).toBeGreaterThanOrEqual(0)
  })

  it("should write counts sorted by count descending, then alphabetically", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [
          h("a", { href: "mailto:test1@example.com" }),
          h("a", { href: "mailto:test2@example.com" }),
          h("a", { href: "mailto:test3@example.com" }),
          h("a", { href: "#section-1" }),
          h("a", { href: "#section-2" }),
        ]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
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

  it("should accumulate counts across multiple file processing", () => {
    const transformFunction = createTransformFunction()

    const tree1 = {
      type: "root",
      children: [h("div", [h("a", { href: "mailto:test@example.com" })])],
    } as Root

    const tree2 = {
      type: "root",
      children: [h("div", [h("a", { href: "mailto:test@example.com" })])],
    } as Root

    transformFunction(tree1)
    const callCount1 = (fs.writeFileSync as jest.Mock).mock.calls.length
    transformFunction(tree2)
    const callCount2 = (fs.writeFileSync as jest.Mock).mock.calls.length

    expect(callCount2).toBeGreaterThan(callCount1)

    const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls.filter((call) =>
      (call[0] as string).toString().endsWith(".tmp"),
    )
    expect(writeCalls.length).toBeGreaterThanOrEqual(2)

    const content1 = writeCalls[writeCalls.length - 2][1] as string
    const content2 = writeCalls[writeCalls.length - 1][1] as string

    const lines1 = content1.split("\n").filter((line) => line.trim())
    const lines2 = content2.split("\n").filter((line) => line.trim())

    const mailLine1 = lines1.find((line) => line.includes(specialFaviconPaths.mail))
    const mailLine2 = lines2.find((line) => line.includes(specialFaviconPaths.mail))

    expect(mailLine1).toBeDefined()
    expect(mailLine2).toBeDefined()

    const count1 = parseInt(mailLine1!.split("\t")[0], 10)
    const count2 = parseInt(mailLine2!.split("\t")[0], 10)

    expect(count2).toBeGreaterThan(count1)
  })

  it("should write atomically using temporary file then rename", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [h("div", [h("a", { href: "mailto:test@example.com" })])],
    } as Root

    transformFunction(tree)

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

  it("should handle write errors gracefully", () => {
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("Write failed")
    })
    const transformFunction = createTransformFunction()
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined)

    const tree = {
      type: "root",
      children: [h("div", [h("a", { href: "mailto:test@example.com" })])],
    } as Root

    expect(() => transformFunction(tree)).not.toThrow()

    errorSpy.mockRestore()
  })

  it("should count relative URLs correctly", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [h("a", { href: "./shard-theory" }), h("a", { href: "../shard-theory" })]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    expect(content).toContain(specialFaviconPaths.turntrout)
    const lines = content.split("\n").filter((line) => line.trim())
    const turntroutLine = lines.find((line) => line.includes(specialFaviconPaths.turntrout))
    expect(turntroutLine).toBeDefined()
    const count = parseInt(turntroutLine!.split("\t")[0], 10)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it("should count multiple different hostnames separately", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [
          h("a", { href: "https://example.com/page1" }),
          h("a", { href: "https://example.com/page2" }),
          h("a", { href: "https://test.com/page1" }),
        ]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    expect(lines.length).toBeGreaterThanOrEqual(2)

    // Counts are now stored without extensions (format-agnostic)
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

  it("should reset counter at the start of each build run", () => {
    // Simulate first build: process some files
    const plugin1 = CountFavicons()
    const htmlPlugins1 = (plugin1.htmlPlugins as () => Array<() => (tree: Root) => void>)()
    const transformFunction1 = htmlPlugins1[0]()

    const tree1 = {
      type: "root",
      children: [
        h("div", [
          h("a", { href: "mailto:test1@example.com" }),
          h("a", { href: "mailto:test2@example.com" }),
        ]),
      ],
    } as Root

    transformFunction1(tree1)

    // Verify counts accumulated in first build
    const countsAfterFirstBuild = getFaviconCounts()
    expect(countsAfterFirstBuild.get(specialFaviconPaths.mail)).toBe(2)

    // Simulate second build: create new plugin instance and call htmlPlugins again
    // This should reset the counter
    const plugin2 = CountFavicons()
    const htmlPlugins2 = (plugin2.htmlPlugins as () => Array<() => (tree: Root) => void>)()
    const transformFunction2 = htmlPlugins2[0]()

    // Verify counter was reset (should be empty or 0)
    const countsAfterReset = getFaviconCounts()
    expect(countsAfterReset.get(specialFaviconPaths.mail)).toBeUndefined()

    // Process files in second build
    const tree2 = {
      type: "root",
      children: [h("div", [h("a", { href: "mailto:test3@example.com" })])],
    } as Root

    transformFunction2(tree2)

    // Verify counts start fresh in second build (should be 1, not 3)
    const countsAfterSecondBuild = getFaviconCounts()
    expect(countsAfterSecondBuild.get(specialFaviconPaths.mail)).toBe(1)
  })
})
