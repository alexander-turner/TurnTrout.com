/**
 * @jest-environment node
 */
import type { Element, Root } from "hast"

import { jest, expect, it, describe, beforeEach, afterEach } from "@jest/globals"
import fs from "fs/promises"
import { h } from "hastscript"

import { cdnBaseUrl, invertInDarkModeClass } from "../../../components/constants"
import {
  addCrossOriginToImages,
  addInvertClass,
  applyLabelsToTree,
  collectVideoSources,
  InvertInDarkMode,
  isInlineLoopingVideo,
  labelsPath,
  loadInvertLabels,
  wrapInDarkModePicture,
} from "../invertInDarkMode"

const errno = (code: string): NodeJS.ErrnoException => Object.assign(new Error(code), { code })

const tree = (...nodes: Element[]): Root => ({ type: "root", children: nodes })

let readFileSpy: ReturnType<typeof jest.spyOn>

describe("InvertInDarkMode", () => {
  beforeEach(() => {
    readFileSpy = jest.spyOn(fs, "readFile")
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("loadInvertLabels", () => {
    it("returns empty map when file is missing", async () => {
      readFileSpy.mockRejectedValue(errno("ENOENT") as never)
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

    it("propagates non-ENOENT read errors", async () => {
      readFileSpy.mockRejectedValue(errno("EACCES") as never)
      await expect(loadInvertLabels()).rejects.toThrow("EACCES")
    })

    it("does not cache across calls", async () => {
      readFileSpy.mockResolvedValue(JSON.stringify({}) as never)
      await loadInvertLabels()
      await loadInvertLabels()
      expect(readFileSpy).toHaveBeenCalledTimes(2)
    })

    it("default path points at the project sidecar", () => {
      expect(labelsPath).toMatch(/\.invert_labels\.json$/)
    })
  })

  describe("addInvertClass", () => {
    it.each<[string, Element, string[]]>([
      [
        "array",
        h("img", { className: ["existing"] }) as Element,
        ["existing", invertInDarkModeClass],
      ],
      [
        "array w/ duplicate",
        h("img", { className: [invertInDarkModeClass] }) as Element,
        [invertInDarkModeClass],
      ],
      [
        "string",
        {
          type: "element",
          tagName: "img",
          properties: { className: "foo bar" },
          children: [],
        } as Element,
        ["foo", "bar", invertInDarkModeClass],
      ],
      [
        "empty string",
        {
          type: "element",
          tagName: "img",
          properties: { className: "" },
          children: [],
        } as Element,
        [invertInDarkModeClass],
      ],
      [
        "missing properties",
        { type: "element", tagName: "img", children: [] } as unknown as Element,
        [invertInDarkModeClass],
      ],
    ])("normalizes className for %s", (_label, node, expected) => {
      addInvertClass(node)
      expect(node.properties?.className).toEqual(expected)
    })
  })

  describe("applyLabelsToTree", () => {
    it.each<[string, string]>([
      ["avif", "https://x/a.avif"],
      ["svg", "https://x/chart.svg"],
    ])("adds class only when label is true (%s)", (_label, yesSrc) => {
      const yes = h("img", { src: yesSrc }) as Element
      const no = h("img", { src: "https://x/b.avif" }) as Element
      const unlabeled = h("img", { src: "https://x/c.avif" }) as Element
      applyLabelsToTree(
        tree(yes, no, unlabeled),
        new Map([
          [yesSrc, true],
          ["https://x/b.avif", false],
        ]),
      )
      expect(yes.properties?.className).toEqual([invertInDarkModeClass])
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
      expect(video.properties?.className).toEqual([invertInDarkModeClass])
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

  describe("wrapInDarkModePicture", () => {
    it("skips when parent is already a picture (defensive)", () => {
      const img = h("img", { src: `${cdnBaseUrl}/x.avif` }) as Element
      const picture = h("picture", [img]) as Element
      wrapInDarkModePicture(img, picture, 0)
      expect(picture.children[0]).toBe(img)
    })

    it("skips when src is not an invertible raster (svg)", () => {
      const img = h("img", { src: `${cdnBaseUrl}/x.svg` }) as Element
      const root = tree(img)
      wrapInDarkModePicture(img, root, 0)
      expect(root.children[0]).toBe(img)
    })

    it("skips when src is missing", () => {
      const img = h("img") as Element
      const root = tree(img)
      wrapInDarkModePicture(img, root, 0)
      expect(root.children[0]).toBe(img)
    })
  })



  describe("addCrossOriginToImages", () => {
    it.each<[string, Element, "anonymous" | undefined]>([
      ["CDN-hosted img", h("img", { src: `${cdnBaseUrl}/x.avif` }) as Element, "anonymous"],
      ["img with no src", h("img") as Element, undefined],
      ["relative src skipped", h("img", { src: "/local.png" }) as Element, undefined],
      ["data URI skipped", h("img", { src: "data:image/png;base64,AAA" }) as Element, undefined],
      ["non-img element ignored", h("video", { src: `${cdnBaseUrl}/v.mp4` }) as Element, undefined],
    ])("%s", (_label, node, expected) => {
      addCrossOriginToImages(tree(node))
      expect(node.properties?.crossOrigin).toBe(expected)
    })

    it("preserves an existing crossOrigin value", () => {
      const img = h("img", {
        src: `${cdnBaseUrl}/x.avif`,
        crossOrigin: "use-credentials",
      }) as Element
      addCrossOriginToImages(tree(img))
      expect(img.properties?.crossOrigin).toBe("use-credentials")
    })

    it("throws on absolute non-CDN src", () => {
      const img = h("img", { src: "https://evil.example.com/x.avif" }) as Element
      expect(() => addCrossOriginToImages(tree(img))).toThrow(/expected.*assets\.turntrout/)
    })
  })

  describe("InvertInDarkMode plugin", () => {
    const transformOf = (plugin: ReturnType<typeof InvertInDarkMode>) => {
      const factories = plugin.htmlPlugins() as Array<() => (tree: Root) => Promise<void>>
      return factories[0]()
    }

    it("applies the invert class to a labeled img", async () => {
      const cdnSrc = `${cdnBaseUrl}/a.avif`
      readFileSpy.mockResolvedValue(
        JSON.stringify({ [cdnSrc]: { invert: true, reviewed: true } }) as never,
      )
      const plugin = InvertInDarkMode()
      const img = h("img", { src: cdnSrc }) as Element
      await transformOf(plugin)(tree(img))
      expect(img.properties?.className).toEqual([invertInDarkModeClass])
    })

    it("wraps invert-labeled raster img in <picture> with dark-mode <source>", async () => {
      const cdnSrc = `${cdnBaseUrl}/a.avif`
      readFileSpy.mockResolvedValue(
        JSON.stringify({ [cdnSrc]: { invert: true, reviewed: true } }) as never,
      )
      const plugin = InvertInDarkMode()
      const img = h("img", { src: cdnSrc }) as Element
      const root = tree(img)
      await transformOf(plugin)(root)
      const wrapped = root.children[0] as Element
      expect(wrapped.tagName).toBe("picture")
      const source = wrapped.children[0] as Element
      expect(source.tagName).toBe("source")
      expect(source.properties?.media).toBe("(prefers-color-scheme: dark)")
      expect(source.properties?.srcSet).toBe(`${cdnBaseUrl}/a-inverted.avif`)
      expect((wrapped.children[1] as Element).tagName).toBe("img")
    })

    it("does not wrap an unlabeled img", async () => {
      const cdnSrc = `${cdnBaseUrl}/plain.avif`
      readFileSpy.mockResolvedValue(JSON.stringify({}) as never)
      const plugin = InvertInDarkMode()
      const img = h("img", { src: cdnSrc }) as Element
      const root = tree(img)
      await transformOf(plugin)(root)
      expect((root.children[0] as Element).tagName).toBe("img")
    })

    it("does not wrap an invert-labeled SVG (kept on the SVG fetch-rewrite path)", async () => {
      const cdnSrc = `${cdnBaseUrl}/icon.svg`
      readFileSpy.mockResolvedValue(
        JSON.stringify({ [cdnSrc]: { invert: true, reviewed: true } }) as never,
      )
      const plugin = InvertInDarkMode()
      const img = h("img", { src: cdnSrc }) as Element
      const root = tree(img)
      await transformOf(plugin)(root)
      expect((root.children[0] as Element).tagName).toBe("img")
    })

    it("reads labels once per plugin instance and re-reads for a new instance", async () => {
      readFileSpy.mockResolvedValue(JSON.stringify({}) as never)
      const plugin = InvertInDarkMode()
      const transform = transformOf(plugin)
      await transform(tree())
      await transform(tree())
      expect(readFileSpy).toHaveBeenCalledTimes(1)

      const other = InvertInDarkMode()
      await transformOf(other)(tree())
      expect(readFileSpy).toHaveBeenCalledTimes(2)
    })
  })
})
