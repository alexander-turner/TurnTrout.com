import { expect, describe, it, test } from "@jest/globals"
import { type Element, type Parent, type ElementContent, type Root } from "hast"
import { h } from "hastscript"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import type { BuildCtx } from "../../../util/ctx"

import {
  transformAST,
  SUBTITLE_REGEX,
  createSubtitleWithChildren,
  modifyNode,
  processParagraph,
  rehypeCustomSubtitle,
} from "../subtitles"

/**
 * Recursively removes 'position' properties from AST nodes for testing purposes.
 * This helps in comparing AST nodes without considering their position information.
 *
 * @param obj - The Element object to process, typically a HAST (HTML Abstract Syntax Tree) node
 * @returns A new object with all 'position' properties removed, preserving the rest of the structure
 *
 * @example
 * const node = {
 *   type: 'element',
 *   position: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
 *   children: []
 * }
 * const cleaned = removePositions(node) // Returns object without position property
 */
function removePositions(obj: Element): unknown {
  if (Array.isArray(obj)) {
    return obj.map(removePositions)
  } else if (typeof obj === "object") {
    const newObj: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (key !== "position") {
        newObj[key] = removePositions(value)
      }
    }
    return newObj
  } else {
    return obj
  }
}

async function process(input: string) {
  const result = await unified()
    .use(rehypeParse, { fragment: true })
    .use(() => transformAST)
    .use(rehypeStringify)
    .process(input)
  return result.toString()
}

describe("rehype-custom-subtitle", () => {
  it.each([
    ["<p>Subtitle:This is a subtitle</p>", "simple subtitle"],
    ["<p>Subtitle:This is a subtitle without space</p>", "subtitle without space"],
    ["<p>Subtitle:Subtitle with <em>formatting</em></p>", "subtitle with formatting"],
    [
      "<p>Subtitle:Subtitle with <strong>bold</strong> and <em>italic</em> text</p>",
      "subtitle with multiple formatting",
    ],
  ])("transforms subtitle paragraph to custom subtitle element (%s)", async (input) => {
    const output = await process(input)
    expect(output).toMatch(/<p class="subtitle"[^>]*>/)
    expect(output).not.toContain("Subtitle:")
  })

  it.each([
    ["<p>This is not a subtitle</p>", "regular paragraph"],
    [
      "<p>Not at start. Subtitle: This is not at the start of the paragraph</p>",
      "subtitle not at start",
    ],
  ])("does not transform non-subtitle content (%s)", async (input) => {
    const output = await process(input)
    expect(output).toBe(input)
  })

  describe("SUBTITLE_REGEX", () => {
    it.each([
      ["Subtitle:This is a subtitle", "This is a subtitle"],
      ["Subtitle:This is a subtitle without space", "This is a subtitle without space"],
      ["Subtitle:Subtitle with multiple words", "Subtitle with multiple words"],
    ])("matches valid subtitle syntax (%s)", (input, expected) => {
      const match = input.match(SUBTITLE_REGEX)
      expect(match).not.toBeNull()
      expect(match?.[1]).toBe(expected)
    })

    it.each([
      ["This is not a subtitle"],
      ["Not at start. Subtitle: This is not at the start of the paragraph"],
      ["subtitle: non-capitalized prefix"],
    ])("does not match invalid subtitle syntax (%s)", (input) => {
      const match = input.match(SUBTITLE_REGEX)
      expect(match).toBeNull()
    })

    it("matches valid subtitle syntax (Subtitle: Capitalized prefix)", () => {
      const input = "Subtitle: Capitalized prefix"
      const match = input.match(SUBTITLE_REGEX)
      expect(match).not.toBeNull()
      expect(match?.[1]).toBe("Capitalized prefix")
    })
  })

  test("createSubtitleNode function", () => {
    const contentNode = { type: "text", value: "Subtitle content" } as ElementContent
    const node = createSubtitleWithChildren([contentNode]) as Element

    expect(node.tagName).toBe("p")
    expect(node.properties?.className).toContain("subtitle")
    expect(node.children).toHaveLength(1)
    expect(node.children[0]).toEqual({ type: "text", value: "Subtitle content" })
  })

  describe("processParagraph function", () => {
    it.each([
      {
        name: "simple subtitle paragraph",
        input: h("p", {}, "Subtitle: This is a subtitle"),
        expected: true,
        resultText: "This is a subtitle",
      },
      {
        name: "non-subtitle paragraph",
        input: h("p", {}, "This is not a subtitle"),
        expected: false,
        resultText: "This is not a subtitle",
      },
      {
        name: "paragraph with multiple children",
        input: h("p", {}, ["Subtitle: ", h("em", "A subtitle")]),
        expected: true,
        resultText: "",
      },
    ])("$name", ({ input, expected, resultText }) => {
      const result = processParagraph(input as Element)
      expect(result).toBe(expected)
      const firstChild = input.children[0]
      expect(firstChild.type).toBe("text")
      expect(firstChild).toHaveProperty("value", resultText)
    })

    it("handles paragraph with no children", () => {
      const input = h("p", {})
      const result = processParagraph(input as Element)
      expect(result).toBe(false)
    })

    it("handles paragraph with non-text first child", () => {
      const input = h("p", {}, [h("em", "Not text first")])
      const result = processParagraph(input as Element)
      expect(result).toBe(false)
    })
  })

  describe("modifyNode function", () => {
    it.each([
      {
        name: "simple subtitle paragraph",
        input: h("p", {}, "Subtitle: This is a subtitle"),
        expected: h("p", { className: ["subtitle"] }, "This is a subtitle"),
      },
      {
        name: "non-subtitle paragraph",
        input: h("p", {}, "This is not a subtitle"),
        expected: h("p", {}, "This is not a subtitle"),
      },
    ])("$name", ({ input, expected }) => {
      const parent: Parent = { type: "root", children: [input] }
      modifyNode(input as Element, 0, parent)
      expect(removePositions(parent.children[0] as Element)).toEqual(removePositions(expected))
    })

    it("handles non-paragraph elements", () => {
      const input = h("div", {}, "Not a paragraph")
      const parent: Parent = { type: "root", children: [input] }
      const originalNode = { ...input }
      modifyNode(input as Element, 0, parent)
      expect(removePositions(parent.children[0] as Element)).toEqual(removePositions(originalNode))
    })

    it("handles missing parent", () => {
      const input = h("p", {}, "Subtitle: This is a subtitle")
      expect(() => modifyNode(input as Element, 0, null)).not.toThrow()
    })

    it("handles undefined index", () => {
      const input = h("p", {}, "Subtitle: This is a subtitle")
      const parent: Parent = { type: "root", children: [input] }
      expect(() => modifyNode(input as Element, undefined, parent)).not.toThrow()
    })

    it("throws error when index does not match node position in parent", () => {
      const input = h("p", {}, "Subtitle: This is a subtitle")
      const otherNode = h("p", {}, "Different node")
      const parent: Parent = { type: "root", children: [otherNode] }

      expect(() => modifyNode(input as Element, 1, parent)).toThrow("Index does not match node")
    })

    it("handles index 0 (falsy) without throwing error even when node mismatch", () => {
      const input = h("p", {}, "Subtitle: This is a subtitle")
      const otherNode = h("p", {}, "Different node")
      const parent: Parent = { type: "root", children: [otherNode] }

      expect(() => modifyNode(input as Element, 0, parent)).not.toThrow()
    })
  })
})

describe("rehypeCustomSubtitle Plugin", () => {
  const processHtml = (html: string): string => {
    return unified()
      .use(rehypeParse, { fragment: true })
      .use(() => transformAST)
      .use(rehypeStringify)
      .processSync(html)
      .toString()
  }

  it("should convert a subtitle with plain text", async () => {
    const input = "<p>Subtitle: This is a subtitle.</p>"
    const output = await processHtml(input)
    expect(output).toContain('<p class="subtitle">This is a subtitle.</p>')
  })

  it("should convert a subtitle with rich text (e.g., bold and italic)", async () => {
    const input = "<p>Subtitle: This is a <strong>bold</strong> and <em>italic</em> subtitle.</p>"
    const output = await processHtml(input)
    expect(output).toContain(
      '<p class="subtitle">This is a <strong>bold</strong> and <em>italic</em> subtitle.</p>',
    )
  })

  it("should preserve non-subtitle paragraphs", async () => {
    const input = "<p>This is a normal paragraph.</p>"
    const output = await processHtml(input)
    expect(output).toContain("<p>This is a normal paragraph.</p>")
  })

  it("should handle multiple subtitles with rich text", async () => {
    const input = `
      <p>Subtitle: First <strong>subtitle</strong>.</p>
      <p>Subtitle: Second <em>subtitle</em> with <a href="#">link</a>.</p>
    `
    const output = await processHtml(input)
    expect(output).toContain('<p class="subtitle">First <strong>subtitle</strong>.</p>')
    expect(output).toContain(
      '<p class="subtitle">Second <em>subtitle</em> with <a href="#">link</a>.</p>',
    )
  })

  it('should trim the "Subtitle:" prefix correctly when converting', async () => {
    const input = "<p>Subtitle:    Subtitle with leading spaces.</p>"
    const output = await processHtml(input)
    expect(output).toContain('<p class="subtitle">Subtitle with leading spaces.</p>')
  })

  it('should not convert paragraphs without the "Subtitle:" prefix', async () => {
    const input = "<p>Subtle subtitle without proper prefix.</p>"
    const output = await processHtml(input)
    expect(output).toContain("<p>Subtle subtitle without proper prefix.</p>")
  })

  it("should handle subtitles with complex nested elements", async () => {
    const input = "<p>Subtitle: This is a <strong>bold <em>and italic</em></strong> subtitle.</p>"
    const output = await processHtml(input)
    expect(output).toContain(
      '<p class="subtitle">This is a <strong>bold <em>and italic</em></strong> subtitle.</p>',
    )
  })
})

describe("rehypeCustomSubtitle plugin function", () => {
  const mockBuildCtx: BuildCtx = {
    argv: {
      directory: ".",
      verbose: false,
      output: "public",
      serve: false,
      fastRebuild: false,
      port: 8080,
      wsPort: 3001,
    },
    cfg: {} as BuildCtx["cfg"],
    allSlugs: [],
  }

  it("returns plugin object with correct name and htmlPlugins function", () => {
    const plugin = rehypeCustomSubtitle()
    expect(plugin).toHaveProperty("name", "customSubtitle")
    expect(plugin).toHaveProperty("htmlPlugins")
    expect(typeof plugin.htmlPlugins).toBe("function")
  })

  it("htmlPlugins returns array with transformAST function", () => {
    const plugin = rehypeCustomSubtitle()
    const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx)
    expect(Array.isArray(htmlPlugins)).toBe(true)
    expect(htmlPlugins).toHaveLength(1)
    expect(htmlPlugins?.[0]).toBeDefined()
    expect(typeof htmlPlugins?.[0]).toBe("function")
  })

  it("plugin function can be called without arguments", () => {
    expect(() => rehypeCustomSubtitle()).not.toThrow()
  })

  it("htmlPlugins function returns plugin that returns transformAST", () => {
    const plugin = rehypeCustomSubtitle()
    const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx)
    const pluginFunction = htmlPlugins?.[0] as () => typeof transformAST
    const transformer = pluginFunction()
    expect(transformer).toBe(transformAST)
  })
})

describe("transformAST function", () => {
  it("transforms AST tree by visiting all elements", () => {
    const mockRoot: Root = {
      type: "root",
      children: [
        h("p", {}, "Subtitle: This is a subtitle"),
        h("p", {}, "Regular paragraph"),
        h("div", {}, [h("p", {}, "Subtitle: Nested subtitle")]),
      ],
    }

    transformAST(mockRoot)

    // Check that subtitle paragraphs were transformed
    const firstChild = mockRoot.children[0] as Element
    expect(firstChild.properties?.className).toContain("subtitle")

    // Check that regular paragraphs weren't transformed
    const secondChild = mockRoot.children[1] as Element
    expect(secondChild.properties?.className).not.toBeTruthy()

    // Check nested elements
    const thirdChild = mockRoot.children[2] as Element
    const nestedP = thirdChild.children[0] as Element
    expect(nestedP.properties?.className).toContain("subtitle")
  })
})
