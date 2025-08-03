import { describe, expect, it } from "@jest/globals"
import { rehype } from "rehype"

import type { BuildCtx } from "../../../util/ctx"

import { WrapNakedElements } from "../wrapNakedElements"

function testWrapNakedElementsHTML(inputHTML: string): string {
  const mockBuildCtx: Partial<BuildCtx> = {
    argv: {
      directory: "./",
      verbose: false,
      output: "public",
    } as BuildCtx["argv"],
  }

  const pluginProperty = WrapNakedElements().htmlPlugins
  if (!pluginProperty) {
    throw new Error("Plugin property is undefined")
  }
  const pluginList = pluginProperty(mockBuildCtx as BuildCtx)
  const processor = rehype().data("settings", { fragment: true }).use(pluginList)

  const result = processor.processSync(inputHTML)
  return result.toString()
}

describe("WrapNakedElements Plugin Tests", () => {
  describe("Basic Video Wrapping", () => {
    it("should wrap a naked video element in a span.video-container", () => {
      const input = '<video src="test.mp4"></video>'
      const expected = '<span class="video-container"><video src="test.mp4"></video></span>'
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })

    it("should wrap a naked video element with attributes", () => {
      const input = '<video src="test.mp4" controls width="100%"></video>'
      const expected =
        '<span class="video-container"><video src="test.mp4" controls width="100%"></video></span>'
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })

    it("should wrap a naked video element with child source tags", () => {
      const input =
        '<video controls><source src="test.mp4" type="video/mp4"><source src="test.webm" type="video/webm"></video>'
      const expected =
        '<span class="video-container"><video controls><source src="test.mp4" type="video/mp4"><source src="test.webm" type="video/webm"></video></span>'
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })
  })

  describe("No Wrapping When Already Wrapped", () => {
    it("should not wrap a video already in a span.video-container", () => {
      const input = '<span class="video-container"><video src="test.mp4"></video></span>'
      expect(testWrapNakedElementsHTML(input)).toBe(input)
    })

    it("should not wrap a video already in a div.video-container", () => {
      const input = '<div class="video-container"><video src="test.mp4"></video></div>'
      expect(testWrapNakedElementsHTML(input)).toBe(input)
    })

    it("should not wrap if parent has multiple classes including video-container", () => {
      const input =
        '<span class="other-class video-container another-class"><video src="test.mp4"></video></span>'
      expect(testWrapNakedElementsHTML(input)).toBe(input)
    })
  })

  describe("Multiple Video Elements", () => {
    it("should correctly wrap multiple video elements, some naked, some not", () => {
      const input =
        '<video src="naked1.mp4"></video>' +
        '<span class="video-container"><video src="wrapped1.mp4"></video></span>' +
        '<p><video src="naked2.mp4" controls></video></p>' +
        '<div class="video-container"><video src="wrapped2.mp4" controls></video></div>'
      const expected =
        '<span class="video-container"><video src="naked1.mp4"></video></span>' +
        '<span class="video-container"><video src="wrapped1.mp4"></video></span>' +
        '<p><span class="video-container"><video src="naked2.mp4" controls></video></span></p>' +
        '<div class="video-container"><video src="wrapped2.mp4" controls></video></div>'
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })
  })

  describe("Contextual Wrapping", () => {
    it("should wrap a video element that is a child of a paragraph", () => {
      const input = '<p><video src="test.mp4"></video></p>'
      const expected = '<p><span class="video-container"><video src="test.mp4"></video></span></p>'
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })

    it("should wrap a video that is not the only child of its parent", () => {
      const input = '<p>Some text <video src="test.mp4"></video> More text</p>'
      const expected =
        '<p>Some text <span class="video-container"><video src="test.mp4"></video></span> More text</p>'
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })

    it("should wrap a video deeply nested within other elements", () => {
      const input =
        '<div><section><article><p><video src="deep.mp4"></video></p></article></section></div>'
      const expected =
        '<div><section><article><p><span class="video-container"><video src="deep.mp4"></video></span></p></article></section></div>'
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })
  })

  describe("No Video Elements", () => {
    it("should do nothing if there are no video elements", () => {
      const input = '<p>Some text without videos.</p><div><img src="image.png"></div>'
      expect(testWrapNakedElementsHTML(input)).toBe(input)
    })
  })
})
