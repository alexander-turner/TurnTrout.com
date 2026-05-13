/**
 * @jest-environment node
 */
import type { Element, Root } from "hast"

import { jest, expect, it, describe, beforeEach, afterEach } from "@jest/globals"
import fs from "fs/promises"
import { h } from "hastscript"
import os from "os"
import path from "path"

import {
  addInvertClass,
  applyLabelsToTree,
  collectVideoSources,
  INVERT_CLASS,
  InvertInDarkMode,
  isInlineLoopingVideo,
  labelsPath,
  loadInvertLabels,
  resetCacheForTesting,
} from "../invertInDarkMode"

let readFileSpy: ReturnType<typeof jest.spyOn>

const enoent = (): NodeJS.ErrnoException => Object.assign(new Error("ENOENT"), { code: "ENOENT" })

describe("InvertInDarkMode", () => {
  beforeEach(() => {
    resetCacheForTesting()
    readFileSpy = jest.spyOn(fs, "readFile")
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("loadInvertLabels", () => {
    it("returns empty map when file is missing", async () => {
      readFileSpy.mockRejectedValue(enoent() as never)
      expect(await loadInvertLabels()).toEqual(new Map())
    })

    it("parses {invert, reviewed} entries to a Map<string, boolean>", async () => {
      readFileSpy.mockResolvedValue(
        JSON.stringify({
          "https://x/a.avif": { invert: true, reviewed: true },
          "https://x/b.avif": { invert: false, reviewed: false },
        }) as never,
      )
      const labels = await loadInvertLabels()
      expect(labels.get("https://x/a.avif")).toBe(true)
      expect(labels.get("https://x/b.avif")).toBe(false)
    })

    it("rejects non-object JSON", async () => {
      readFileSpy.mockResolvedValue(JSON.stringify(["a"]) as never)
      await expect(loadInvertLabels()).rejects.toThrow(/JSON object/)
    })

    it("rejects entries that are not objects with `invert`", async () => {
      readFileSpy.mockResolvedValue(JSON.stringify({ "https://x/a.avif": true }) as never)
      await expect(loadInvertLabels()).rejects.toThrow(/invert, reviewed/)
    })

    it("caches by default path", async () => {
      readFileSpy.mockResolvedValue(JSON.stringify({}) as never)
      await loadInvertLabels()
      await loadInvertLabels()
      expect(readFileSpy).toHaveBeenCalledTimes(1)
    })

    it("does not cache for non-default paths", async () => {
      const tempPath = path.join(os.tmpdir(), "labels-test.json")
      readFileSpy.mockResolvedValue(JSON.stringify({}) as never)
      await loadInvertLabels(tempPath)
      await loadInvertLabels(tempPath)
      expect(readFileSpy).toHaveBeenCalledTimes(2)
    })

    it("propagates non-ENOENT read errors", async () => {
      readFileSpy.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }) as never)
      await expect(loadInvertLabels()).rejects.toThrow("EACCES")
    })

    it("default path points at the project sidecar", () => {
      expect(labelsPath).toMatch(/\.invert_labels\.json$/)
    })
  })

  describe("addInvertClass", () => {
    it.each<[string, Element, string[]]>([
      ["array", h("img", { className: ["existing"] }) as Element, ["existing", INVERT_CLASS]],
      ["array w/ duplicate", h("img", { className: [INVERT_CLASS] }) as Element, [INVERT_CLASS]],
      [
        "string",
        {
          type: "element",
          tagName: "img",
          properties: { className: "foo bar" },
          children: [],
        } as Element,
        ["foo", "bar", INVERT_CLASS],
      ],
      [
        "empty string",
        {
          type: "element",
          tagName: "img",
          properties: { className: "" },
          children: [],
        } as Element,
        [INVERT_CLASS],
      ],
      [
        "missing properties",
        { type: "element", tagName: "img", children: [] } as unknown as Element,
        [INVERT_CLASS],
      ],
    ])("normalizes className for %s", (_label, node, expected) => {
      addInvertClass(node)
      expect(node.properties?.className).toEqual(expected)
    })
  })

  describe("applyLabelsToTree", () => {
    const tree = (...nodes: Element[]): Root => ({ type: "root", children: nodes })

    it("adds class only when label is true", () => {
      const yes = h("img", { src: "https://x/a.avif" }) as Element
      const no = h("img", { src: "https://x/b.avif" }) as Element
      const unlabeled = h("img", { src: "https://x/c.avif" }) as Element
      applyLabelsToTree(
        tree(yes, no, unlabeled),
        new Map([
          ["https://x/a.avif", true],
          ["https://x/b.avif", false],
        ]),
      )
      expect(yes.properties?.className).toEqual([INVERT_CLASS])
      expect(no.properties?.className).toBeUndefined()
      expect(unlabeled.properties?.className).toBeUndefined()
    })

    it("ignores non-img and src-less elements", () => {
      const div = h("div", { src: "https://x/a.avif" }) as Element
      const noSrc = h("img", {}) as Element
      applyLabelsToTree(tree(div, noSrc), new Map([["https://x/a.avif", true]]))
      expect(div.properties?.className).toBeUndefined()
      expect(noSrc.properties?.className).toBeUndefined()
    })

    it("tags inline looping muted videos when any source is labeled", () => {
      const video = h("video", { autoplay: true, loop: true, muted: true }, [
        h("source", { src: "https://x/a.mp4" }),
        h("source", { src: "https://x/a.webm" }),
      ]) as Element
      applyLabelsToTree(tree(video), new Map([["https://x/a.webm", true]]))
      expect(video.properties?.className).toEqual([INVERT_CLASS])
    })

    it("does not tag the persistent #pond-video", () => {
      const pond = h("video", { id: "pond-video", autoplay: true, loop: true, muted: true }, [
        h("source", { src: "https://x/pond.mp4" }),
      ]) as Element
      applyLabelsToTree(tree(pond), new Map([["https://x/pond.mp4", true]]))
      expect(pond.properties?.className).toBeUndefined()
    })

    it.each([
      ["no autoplay", { loop: true, muted: true }],
      ["no loop", { autoplay: true, muted: true }],
      ["no muted", { autoplay: true, loop: true }],
    ])("does not tag video missing %s", (_label, props) => {
      const video = h("video", props, [h("source", { src: "https://x/a.mp4" })]) as Element
      applyLabelsToTree(tree(video), new Map([["https://x/a.mp4", true]]))
      expect(video.properties?.className).toBeUndefined()
    })
  })

  describe("collectVideoSources", () => {
    it("collects direct src plus every <source>", () => {
      const node = h("video", { src: "https://x/direct.mp4" }, [
        h("source", { src: "https://x/a.mp4" }),
        h("source", { src: "https://x/a.webm" }),
        h("track"), // non-source children ignored
      ]) as Element
      expect(collectVideoSources(node)).toEqual([
        "https://x/direct.mp4",
        "https://x/a.mp4",
        "https://x/a.webm",
      ])
    })

    it("returns [] when there are no sources", () => {
      const node = h("video") as Element
      expect(collectVideoSources(node)).toEqual([])
    })

    it("ignores <source> elements without a string src", () => {
      const node = h("video", {}, [h("source")]) as Element
      expect(collectVideoSources(node)).toEqual([])
    })
  })

  describe("isInlineLoopingVideo", () => {
    it.each([
      ["non-video", h("div", { autoplay: true, loop: true, muted: true }) as Element, false],
      [
        "looping muted autoplay video",
        h("video", { autoplay: true, loop: true, muted: true }) as Element,
        true,
      ],
      [
        "pond video",
        h("video", { id: "pond-video", autoplay: true, loop: true, muted: true }) as Element,
        false,
      ],
      ["bare video", h("video") as Element, false],
      [
        // Defensive: hast guarantees properties on h()-built nodes, but a
        // synthetic tree without properties should still be handled.
        "video with no properties object",
        { type: "element", tagName: "video", children: [] } as unknown as Element,
        false,
      ],
    ])("classifies %s correctly", (_label, node, expected) => {
      expect(isInlineLoopingVideo(node)).toBe(expected)
    })
  })

  describe("InvertInDarkMode plugin", () => {
    it("applies labels to a tree at build time", async () => {
      readFileSpy.mockResolvedValue(
        JSON.stringify({ "https://x/a.avif": { invert: true, reviewed: true } }) as never,
      )
      const plugin = InvertInDarkMode()
      expect(plugin.name).toBe("InvertInDarkMode")
      const factories = plugin.htmlPlugins() as Array<() => (tree: Root) => Promise<void>>
      const transform = factories[0]()
      const img = h("img", { src: "https://x/a.avif" }) as Element
      const tree: Root = { type: "root", children: [img] }
      await transform(tree)
      expect(img.properties?.className).toEqual([INVERT_CLASS])
    })
  })
})
