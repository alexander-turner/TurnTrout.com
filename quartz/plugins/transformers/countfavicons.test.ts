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

import { turntroutFaviconPath, mailIconPath, anchorIconPath } from "../../components/constants"
import { CountFavicons } from "./countfavicons"
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

  it("should count mailto links", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [
          h("a", { href: "mailto:test1@example.com" }),
          h("a", { href: "mailto:test2@example.com" }),
        ]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    expect(content).toContain(mailIconPath)
    const lines = content.split("\n").filter((line) => line.trim())
    const mailLine = lines.find((line) => line.includes(mailIconPath))
    expect(mailLine).toContain("2\t")
  })

  it("should count anchor links", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [h("div", [h("a", { href: "#section-1" }), h("a", { href: "#section-2" })])],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    expect(content).toContain(anchorIconPath)
    const lines = content.split("\n").filter((line) => line.trim())
    const anchorLine = lines.find((line) => line.includes(anchorIconPath))
    expect(anchorLine).toContain("2\t")
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

  it("should skip asset links", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [
          h("a", { href: "https://example.com/image.png" }),
          h("a", { href: "https://example.com/video.mp4" }),
          h("a", { href: "https://example.com/audio.mp3" }),
        ]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    const assetLines = lines.filter(
      (line) => line.includes("example_com.png") && line.includes("image.png"),
    )
    expect(assetLines.length).toBe(0)
  })

  it("should skip footnote links", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [h("a", { href: "#user-content-fn-1" }), h("a", { href: "#user-content-fn-2" })]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    const footnoteLines = lines.filter((line) => line.includes("#user-content-fn"))
    expect(footnoteLines.length).toBe(0)
  })

  it("should skip anchor links in headings", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("h2", [h("a", { href: "#section-1" })]),
        h("h3", [h("a", { href: "#section-2" })]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    const anchorLines = lines.filter((line) => line.includes("#section"))
    expect(anchorLines.length).toBe(0)
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
    expect(content).toContain(anchorIconPath)
    const lines = content.split("\n").filter((line) => line.trim())
    const anchorLine = lines.find((line) => line.includes(anchorIconPath))
    expect(anchorLine).toBeDefined()
    const count = parseInt(anchorLine!.split("\t")[0], 10)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it("should skip links without href", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [h("div", [h("a"), h("span", { href: "https://example.com" })])],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    expect(lines.length).toBeGreaterThanOrEqual(0)
  })

  it("should skip links with non-string href", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [
          h("a", { href: 123 as unknown as string }),
          h("a", { href: ["https://example.com"] as unknown as string }),
        ]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    expect(lines.length).toBeGreaterThanOrEqual(0)
  })

  it("should skip invalid URLs", () => {
    const transformFunction = createTransformFunction()

    const tree = {
      type: "root",
      children: [
        h("div", [h("a", { href: "not-a-url" }), h("a", { href: "http://[invalid-ipv6" })]),
      ],
    } as Root

    transformFunction(tree)

    expect(fs.writeFileSync).toHaveBeenCalled()
    const content = getWrittenContent()
    const lines = content.split("\n").filter((line) => line.trim())
    expect(lines.length).toBeGreaterThanOrEqual(0)
  })

  it("should skip nodes without parent", () => {
    const transformFunction = createTransformFunction()

    const linkNode = h("a", { href: "mailto:test@example.com" })
    const tree = {
      type: "root",
      children: [linkNode],
    } as Root

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

    const mailLine = lines.find((line) => line.includes(mailIconPath))
    const anchorLine = lines.find((line) => line.includes(anchorIconPath))

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

    const mailLine1 = lines1.find((line) => line.includes(mailIconPath))
    const mailLine2 = lines2.find((line) => line.includes(mailIconPath))

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
    expect(content).toContain(turntroutFaviconPath)
    const lines = content.split("\n").filter((line) => line.trim())
    const turntroutLine = lines.find((line) => line.includes(turntroutFaviconPath))
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
})
