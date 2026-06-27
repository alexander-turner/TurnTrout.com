/**
 * @jest-environment node
 */
import type { Element, Root } from "hast"

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import fs from "fs/promises"
import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"

import {
  clearSnapshotCache,
  extractTweetId,
  loadSnapshot,
  parseTweetReferences,
  replaceTweetBlocks,
  toXcancelUrl,
  tweetBlockBody,
  TweetEmbed,
} from "../tweetEmbed"

const errno = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code })

const tree = (...nodes: Element[]): Root => ({ type: "root", children: nodes })

const tweetBlock = (body: string): Element =>
  h("pre", [h("code", { className: ["language-tweet"] }, body)])

const snapshotJson = (id: string): string =>
  JSON.stringify({
    id,
    url: `https://xcancel.com/turntrout/status/${id}`,
    author: { name: "Alex", handle: "turntrout", verified: false, avatarSrc: "a.jpg" },
    createdAt: "2025-01-21T17:32:00.000Z",
    text: "hi",
    urls: [],
    media: [],
    snapshotAt: "2026-06-27T00:00:00+00:00",
  })

let readFileSpy: ReturnType<typeof jest.spyOn>

beforeEach(() => {
  clearSnapshotCache()
  readFileSpy = jest.spyOn(fs, "readFile")
})
afterEach(() => {
  jest.restoreAllMocks()
})

describe("extractTweetId", () => {
  it.each([
    ["https://x.com/turntrout/status/123456", "123456"],
    ["https://twitter.com/u/statuses/987654", "987654"],
    ["123456789", "123456789"],
    ["https://xcancel.com/u/status/111222333", "111222333"],
  ])("extracts %s", (input, expected) => {
    expect(extractTweetId(input)).toBe(expected)
  })

  it("returns null when there is no id", () => {
    expect(extractTweetId("https://example.com/no-id")).toBeNull()
  })
})

describe("toXcancelUrl", () => {
  it.each([
    ["https://x.com/u/status/1", "https://xcancel.com/u/status/1"],
    ["https://www.twitter.com/u/status/1", "https://xcancel.com/u/status/1"],
    ["https://xcancel.com/u/status/1", "https://xcancel.com/u/status/1"],
    ["1234567890", "1234567890"],
  ])("rewrites %s", (input, expected) => {
    expect(toXcancelUrl(input)).toBe(expected)
  })
})

describe("parseTweetReferences", () => {
  it("parses multiple URLs, skipping blank lines", () => {
    const refs = parseTweetReferences(
      "https://x.com/u/status/10001\n\n  https://x.com/u/status/10002  \n",
    )
    expect(refs).toEqual([
      { id: "10001", xcancelUrl: "https://xcancel.com/u/status/10001" },
      { id: "10002", xcancelUrl: "https://xcancel.com/u/status/10002" },
    ])
  })

  it("throws when a line has no tweet id", () => {
    expect(() => parseTweetReferences("https://example.com/nope")).toThrow(/no tweet id/)
  })
})

describe("tweetBlockBody", () => {
  it("returns the body of a tweet code block", () => {
    expect(tweetBlockBody(tweetBlock("url\n"))).toBe("url\n")
  })

  const stringClassNamePre: Element = {
    type: "element",
    tagName: "pre",
    properties: {},
    children: [
      {
        type: "element",
        tagName: "code",
        properties: { className: "language-tweet" },
        children: [],
      },
    ],
  }

  it.each([
    ["non-pre node", h("div", "x")],
    ["pre without a code child", h("pre", [h("span", "x")])],
    [
      "code without the language-tweet class",
      h("pre", [h("code", { className: ["language-js"] }, "x")]),
    ],
    ["code with a non-array className", stringClassNamePre],
  ])("returns null for %s", (_label, node) => {
    expect(tweetBlockBody(node as Element)).toBeNull()
  })
})

describe("loadSnapshot", () => {
  it("returns the parsed snapshot", async () => {
    readFileSpy.mockResolvedValue(snapshotJson("10123") as never)
    const snapshot = await loadSnapshot("10123", "/dir")
    expect(snapshot?.id).toBe("10123")
  })

  it("returns null when the file is missing", async () => {
    readFileSpy.mockRejectedValue(errno("ENOENT") as never)
    expect(await loadSnapshot("404", "/dir")).toBeNull()
  })

  it("falls back to the default snapshot directory", async () => {
    readFileSpy.mockRejectedValue(errno("ENOENT") as never)
    expect(await loadSnapshot("405")).toBeNull()
  })

  it("rethrows non-ENOENT errors", async () => {
    readFileSpy.mockRejectedValue(errno("EACCES") as never)
    await expect(loadSnapshot("123", "/dir")).rejects.toThrow("EACCES")
  })

  it("caches results so the file is read once", async () => {
    readFileSpy.mockResolvedValue(snapshotJson("10123") as never)
    await loadSnapshot("123", "/dir")
    await loadSnapshot("123", "/dir")
    expect(readFileSpy).toHaveBeenCalledTimes(1)
  })
})

describe("replaceTweetBlocks", () => {
  it("replaces a tweet block with a rendered card", async () => {
    readFileSpy.mockResolvedValue(snapshotJson("10123") as never)
    const root = tree(tweetBlock("https://x.com/turntrout/status/10123\n"))
    await replaceTweetBlocks(root, "/dir")
    const html = toHtml(root)
    expect(html).toContain("tweet-embed")
    expect(html).toContain('data-tweet-id="10123"')
    expect(html).not.toContain("<pre>")
  })

  it("renders a stub when the snapshot is missing", async () => {
    readFileSpy.mockRejectedValue(errno("ENOENT") as never)
    const root = tree(tweetBlock("https://x.com/turntrout/status/10123\n"))
    await replaceTweetBlocks(root, "/dir")
    expect(toHtml(root)).toContain("tweet-card-unavailable")
  })

  it("renders a thread for multiple URLs", async () => {
    readFileSpy.mockImplementation(((filePath: string) =>
      Promise.resolve(snapshotJson(filePath.includes("10124") ? "10124" : "10123"))) as never)
    const root = tree(
      tweetBlock("https://x.com/turntrout/status/10123\nhttps://x.com/turntrout/status/10124\n"),
    )
    await replaceTweetBlocks(root, "/dir")
    expect(toHtml(root)).toContain("tweet-thread")
  })

  it("leaves non-tweet nodes untouched", async () => {
    const root = tree(h("p", "untouched"))
    await replaceTweetBlocks(root, "/dir")
    expect(toHtml(root)).toBe("<p>untouched</p>")
  })
})

describe("TweetEmbed plugin", () => {
  it("exposes the htmlPlugins hook and runs", async () => {
    readFileSpy.mockResolvedValue(snapshotJson("10123") as never)
    const plugin = TweetEmbed()
    expect(plugin.name).toBe("TweetEmbed")
    const htmlPlugins = plugin.htmlPlugins?.({} as never) ?? []
    const root = tree(tweetBlock("https://x.com/turntrout/status/10123\n"))
    for (const factory of htmlPlugins) {
      const transform = (factory as () => (t: Root) => unknown)()
      await transform(root)
    }
    expect(toHtml(root)).toContain("tweet-embed")
  })
})
