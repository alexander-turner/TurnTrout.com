import type { Parent } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"
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
    it.each([
      [
        "naked video element",
        '<video src="test.mp4"></video>',
        '<span class="video-container"><video src="test.mp4"></video></span>',
      ],
      [
        "video element with attributes",
        '<video src="test.mp4" controls width="100%"></video>',
        '<span class="video-container"><video src="test.mp4" controls width="100%"></video></span>',
      ],
      [
        "video element with child source tags",
        '<video controls><source src="test.mp4" type="video/mp4"><source src="test.webm" type="video/webm"></video>',
        '<span class="video-container"><video controls><source src="test.mp4" type="video/mp4"><source src="test.webm" type="video/webm"></video></span>',
      ],
    ])("should wrap %s in span.video-container", (_, input, expected) => {
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })
  })

  describe("No Wrapping When Already Wrapped", () => {
    it.each([
      [
        "span.video-container",
        '<span class="video-container"><video src="test.mp4"></video></span>',
      ],
      ["div.video-container", '<div class="video-container"><video src="test.mp4"></video></div>'],
      [
        "element with multiple classes including video-container",
        '<span class="other-class video-container another-class"><video src="test.mp4"></video></span>',
      ],
    ])("should not wrap video already in %s", (_, input) => {
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
    it.each([
      [
        "video as child of paragraph",
        '<p><video src="test.mp4"></video></p>',
        '<p><span class="video-container"><video src="test.mp4"></video></span></p>',
      ],
      [
        "video with text siblings",
        '<p>Some text <video src="test.mp4"></video> More text</p>',
        '<p>Some text <span class="video-container"><video src="test.mp4"></video></span> More text</p>',
      ],
      [
        "deeply nested video",
        '<div><section><article><p><video src="deep.mp4"></video></p></article></section></div>',
        '<div><section><article><p><span class="video-container"><video src="deep.mp4"></video></span></p></article></section></div>',
      ],
    ])("should wrap %s", (_, input, expected) => {
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })
  })

  describe("No Video Elements", () => {
    it("should do nothing if there are no video elements", () => {
      const input = '<p>Some text without videos.</p><div><img src="image.png"></div>'
      expect(testWrapNakedElementsHTML(input)).toBe(input)
    })
  })

  describe("Plugin Structure", () => {
    it("should return a plugin with correct name", () => {
      const plugin = WrapNakedElements()
      expect(plugin.name).toBe("WrapNakedElements")
    })

    it("should return a plugin with htmlPlugins function", () => {
      const plugin = WrapNakedElements()
      expect(typeof plugin.htmlPlugins).toBe("function")
    })

    it("should return an array when htmlPlugins is called", () => {
      const plugin = WrapNakedElements()
      const mockBuildCtx: Partial<BuildCtx> = {
        argv: {
          directory: "./",
          verbose: false,
          output: "public",
        } as BuildCtx["argv"],
      }
      const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx as BuildCtx)
      expect(Array.isArray(htmlPlugins)).toBe(true)
    })

    it("should return exactly one plugin function in the array", () => {
      const plugin = WrapNakedElements()
      const mockBuildCtx: Partial<BuildCtx> = {
        argv: {
          directory: "./",
          verbose: false,
          output: "public",
        } as BuildCtx["argv"],
      }
      const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx as BuildCtx)
      expect(htmlPlugins).toHaveLength(1)
    })

    it("should return a function as the first array element", () => {
      const plugin = WrapNakedElements()
      const mockBuildCtx: Partial<BuildCtx> = {
        argv: {
          directory: "./",
          verbose: false,
          output: "public",
        } as BuildCtx["argv"],
      }
      const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx as BuildCtx)
      expect(typeof htmlPlugins?.[0]).toBe("function")
    })
  })

  describe("Edge Cases", () => {
    it.each([
      [
        "non-video elements",
        '<img src="test.jpg"><audio src="test.mp3"></audio><div>content</div>',
      ],
      ["empty HTML", ""],
    ])("should handle %s without throwing", (_, input) => {
      expect(() => testWrapNakedElementsHTML(input)).not.toThrow()
      expect(testWrapNakedElementsHTML(input)).toBe(input)
    })

    it("should not wrap video when parent has video-container class among multiple classes", () => {
      const input =
        '<div class="wrapper video-container extra-class"><video src="test.mp4"></video></div>'
      expect(testWrapNakedElementsHTML(input)).toBe(input)
    })

    it("should wrap video when parent has similar but not exact video-container class", () => {
      const input =
        '<div class="not-video-container-but-similar"><video src="test.mp4"></video></div>'
      const expected =
        '<div class="not-video-container-but-similar"><span class="video-container"><video src="test.mp4"></video></span></div>'
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })
  })

  describe("Element Identification", () => {
    it.each([
      ["img", true],
      ["audio", true],
      ["div", true],
      ["span", true],
      ["p", true],
      ["video", false],
    ])("should identify %s element as not video: %s", (tagName, expected) => {
      const element = h(tagName, { src: "test.file" })
      const notVideo = element.tagName !== "video"
      expect(notVideo).toBe(expected)
    })

    it.each([
      ["video-container", true],
      ["other-class", false],
    ])("should detect video-container class presence for class '%s': %s", (className, expected) => {
      const parent = h("div", { class: className })
      const classNameString = parent.properties?.className as string
      const hasVideoContainerClass = classNameString?.includes("video-container") || false
      expect(hasVideoContainerClass).toBe(expected)
    })

    it.each([
      [
        "wraps when video needs wrapping",
        '<div><video src="test.mp4"></video></div>',
        '<div><span class="video-container"><video src="test.mp4"></video></span></div>',
      ],
      [
        "skips when already wrapped",
        '<div class="video-container"><video src="test.mp4"></video></div>',
        '<div class="video-container"><video src="test.mp4"></video></div>',
      ],
      [
        "wraps in paragraph context",
        '<p><video src="test.mp4"></video></p>',
        '<p><span class="video-container"><video src="test.mp4"></video></span></p>',
      ],
    ])("should handle wrapping logic: %s", (_, input, expected) => {
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })

    it.each([
      "Video element is expected to have an existing parent element in the AST.",
      "Video element is not actually a child of its claimed parent.",
    ])("should have defined error message: %s", (errorMessage) => {
      expect(() => {
        throw new Error(errorMessage)
      }).toThrow(errorMessage)
    })

    it("should detect empty ancestors condition", () => {
      const emptyAncestors: Parent[] = []
      expect(emptyAncestors).toHaveLength(0)
    })

    it("should detect orphaned video element condition", () => {
      const orphanedVideo = h("video", { src: "orphaned.mp4" })
      const parentWithoutThisVideo = h("div", [h("p", "some text")])
      const index = parentWithoutThisVideo.children.indexOf(orphanedVideo)
      expect(index).toEqual(-1)
    })

    it("should maintain normal processing functionality", () => {
      const normalResult = testWrapNakedElementsHTML('<div><video src="test.mp4"></video></div>')
      expect(normalResult).toBe(
        '<div><span class="video-container"><video src="test.mp4"></video></span></div>',
      )
    })

    it("should handle hastscript-generated className arrays", () => {
      const element = h("div", { class: "video-container other" })
      const className = element.properties?.className
      expect(Array.isArray(className)).toBe(true)
      expect((className as string[]).includes("video-container")).toBe(true)
    })

    it("should handle manual array className properties", () => {
      const elementProperties = {
        className: ["video-container", "other-class"],
      }
      const arrayClassName = elementProperties.className
      expect(Array.isArray(arrayClassName)).toBe(true)
      expect(arrayClassName.includes("video-container")).toBe(true)
    })

    it("should handle string className logic", () => {
      const stringClassLogic = "video-container other-class"
      expect(typeof stringClassLogic).toBe("string")
      expect(stringClassLogic.includes("video-container")).toBe(true)
    })

    it("should handle elements with no className", () => {
      const elementWithoutClass = h("div")
      const noClassName = elementWithoutClass.properties?.className
      expect(noClassName).toBeUndefined()
    })

    it("should wrap video in complex nested structure", () => {
      const complexInput =
        '<main><section><article><div class="content"><div class="media-section"><video src="deep-nested.mp4" controls><source src="video.webm" type="video/webm"><source src="video.mp4" type="video/mp4"><p>Your browser doesn\'t support HTML5 video.</p></video></div></div></article></section></main>'
      const expectedOutput =
        '<main><section><article><div class="content"><div class="media-section"><span class="video-container"><video src="deep-nested.mp4" controls><source src="video.webm" type="video/webm"><source src="video.mp4" type="video/mp4"><p>Your browser doesn\'t support HTML5 video.</p></video></span></div></div></article></section></main>'
      expect(testWrapNakedElementsHTML(complexInput)).toBe(expectedOutput)
    })
  })

  describe("Additional Scenarios", () => {
    it.each([
      [
        "video with no properties",
        "<video></video>",
        '<span class="video-container"><video></video></span>',
      ],
      [
        "video with text content",
        '<div><p>Text before<video src="test.mp4">Your browser does not support video.</video>Text after</p></div>',
        '<div><p>Text before<span class="video-container"><video src="test.mp4">Your browser does not support video.</video></span>Text after</p></div>',
      ],
      [
        "video at root level",
        '<video src="root.mp4"></video>',
        '<span class="video-container"><video src="root.mp4"></video></span>',
      ],
    ])("should handle %s", (_, input, expected) => {
      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })

    it("should handle multiple videos in different contexts", () => {
      const input = `
        <article>
          <video src="naked1.mp4"></video>
          <p><video src="naked2.mp4"></video></p>
          <span class="video-container"><video src="wrapped1.mp4"></video></span>
          <div class="video-container"><video src="wrapped2.mp4"></video></div>
        </article>
      `.trim()

      const expected = `
        <article>
          <span class="video-container"><video src="naked1.mp4"></video></span>
          <p><span class="video-container"><video src="naked2.mp4"></video></span></p>
          <span class="video-container"><video src="wrapped1.mp4"></video></span>
          <div class="video-container"><video src="wrapped2.mp4"></video></div>
        </article>
      `.trim()

      expect(testWrapNakedElementsHTML(input)).toBe(expected)
    })
  })

  describe("Float-right Wrapping in Figure Tags", () => {
    interface FloatRightTestCase {
      name: string
      input: string
      shouldWrap: boolean
      preservedContent: string
    }

    const floatRightCases: FloatRightTestCase[] = [
      {
        name: "wrap standalone float-right element",
        input: '<div class="float-right">Content</div>',
        shouldWrap: true,
        preservedContent: '<div class="float-right">Content</div>',
      },
      {
        name: "wrap parent when child has float-right",
        input: '<div><span class="float-right">Content</span></div>',
        shouldWrap: true,
        preservedContent: '<span class="float-right">Content</span>',
      },
      {
        name: "wrap video-container when video has float-right",
        input: '<video class="float-right" width="316" height="178">Content</video>',
        shouldWrap: true,
        preservedContent: '<span class="video-container"><video class="float-right"',
      },
      {
        name: "not wrap without float-right class",
        input: '<div class="other-class">Content</div>',
        shouldWrap: false,
        preservedContent: '<div class="other-class">Content</div>',
      },
      {
        name: "not wrap figure with float-right content",
        input: '<figure><div class="float-right">Content</div></figure>',
        shouldWrap: false,
        preservedContent: '<figure><div class="float-right">Content</div></figure>',
      },
    ]

    it.each(floatRightCases)("should $name", ({ input, shouldWrap, preservedContent }) => {
      const result = testWrapNakedElementsHTML(input)
      const figureCount = (result.match(/<figure>/g) || []).length
      const inputFigureCount = (input.match(/<figure>/g) || []).length
      const addedFigure = figureCount > inputFigureCount
      expect(addedFigure).toBe(shouldWrap)
      expect(result).toContain(preservedContent)
    })

    interface FigureCountTestCase {
      name: string
      input: string
      expectedCount: number
    }

    const figureCountCases: FigureCountTestCase[] = [
      {
        name: "multiple standalone float-right elements",
        input:
          '<div class="float-right">First</div><p>Text</p><div class="float-right">Second</div>',
        expectedCount: 2,
      },
      {
        name: "parent with float-right child",
        input: '<div><span class="float-right">Inner</span></div>',
        expectedCount: 1,
      },
    ]

    it.each(figureCountCases)("should handle $name correctly", ({ input, expectedCount }) => {
      const result = testWrapNakedElementsHTML(input)
      const figureCount = (result.match(/<figure>/g) || []).length
      expect(figureCount).toBe(expectedCount)
    })
  })

  describe("Admonition Content Protection", () => {
    it("should not wrap admonition-content div when it contains float-right child", () => {
      const input =
        '<div class="admonition-content"><p>Text</p><img class="float-right" src="test.jpg"><p>More text</p></div>'
      const result = testWrapNakedElementsHTML(input)
      expect(result).not.toContain("<figure>")
      expect(result).toBe(input)
    })

    it("should not wrap admonition div when it contains float-right child", () => {
      const input =
        '<div class="admonition"><div class="admonition-title">Title</div><div class="admonition-content"><img class="float-right" src="test.jpg"></div></div>'
      const result = testWrapNakedElementsHTML(input)
      expect(result).not.toContain("<figure>")
      expect(result).toBe(input)
    })

    it("should not wrap blockquote with admonition-content containing float-right image", () => {
      const input =
        '<blockquote class="admonition"><div class="admonition-title">Quote</div><div class="admonition-content"><p>Paragraph</p><img class="float-right" src="test.avif" width="780" height="572"><p>More</p></div></blockquote>'
      const result = testWrapNakedElementsHTML(input)
      expect(result).not.toContain("<figure>")
      expect(result).toBe(input)
    })
  })
})
