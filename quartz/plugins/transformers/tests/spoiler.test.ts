import { expect, describe, it, test } from "@jest/globals"
import { type Element, type Parent, type Root } from "hast"
import { h } from "hastscript"
import { visit } from "unist-util-visit"

import { BuildCtx } from "../../../util/ctx"
import {
  matchSpoilerText,
  createSpoilerNode,
  modifyNode,
  processParagraph,
  rehypeCustomSpoiler,
} from "../spoiler"
import { removePositions, createRehypeProcessor } from "./test-utils"

const process = createRehypeProcessor(modifyNode)

describe("rehype-custom-spoiler", () => {
  it.each([
    ["<blockquote><p>! This is a spoiler</p></blockquote>", "simple spoiler"],
    ["<blockquote><p>!This is a spoiler without space</p></blockquote>", "spoiler without space"],
    [
      "<blockquote><p>! Multi-line</p><p>! spoiler</p><p>! content</p></blockquote>",
      "multi-paragraph spoiler",
    ],
    [
      "<blockquote><p>! Spoiler with <em>formatting</em></p></blockquote>",
      "spoiler with formatting",
    ],
  ])("transforms spoiler blockquote to custom spoiler element (%s)", async (input) => {
    const output = await process(input)
    expect(output).toMatch(/<div class="spoiler-container"[^>]*>/)
    expect(output).toContain('<span class="spoiler-content">')
    expect(output).toMatch(/<span class="spoiler-overlay"[^>]*><\/span>/)
    expect(output).not.toContain("<blockquote>")
    expect(output).toMatch(/onclick="[^"]*"/)
    expect(output).toContain('role="button"')
  })

  it.each([
    ["<blockquote><p>This is not a spoiler</p></blockquote>", "regular blockquote"],
    [
      "<blockquote><p>! This is a spoiler</p><p>This is not a spoiler</p></blockquote>",
      "mixed content blockquote",
    ], // Not a spoiler overall
    ["<p>! This is not in a blockquote</p>", "not in blockquote"],
  ])("does not transform non-spoiler content (%s)", async (input) => {
    const output = await process(input)
    expect(output).toBe(input)
  })

  it.each([
    ["!This is a spoiler", true],
    ["! This is a spoiler", true],
    ["This is not a spoiler", false],
  ])("matchSpoilerText function (%s)", (input: string, expectedSpoiler: boolean) => {
    const match = matchSpoilerText(input)
    expect(Boolean(match)).toBe(expectedSpoiler)
  })

  test("createSpoilerNode function", () => {
    const node = createSpoilerNode("Spoiler content") as Element

    expect(node.tagName).toBe("div")
    expect(node.properties?.className).toContain("spoiler-container")
    expect(node.children).toHaveLength(2)
    expect((node.children[0] as Element).tagName).toBe("span")
    expect((node.children[0] as Element).properties?.className).toContain("spoiler-overlay")
    expect((node.children[1] as Element).tagName).toBe("span")
    expect((node.children[1] as Element).properties?.className).toContain("spoiler-content")

    // Accessibility attributes are on the overlay, not the container
    const overlay = node.children[0] as Element
    expect(overlay.properties?.role).toBe("button")
    expect(overlay.properties?.tabIndex).toBe(0)
    expect(overlay.properties?.ariaExpanded).toBe("false")
    expect(overlay.properties?.ariaLabel).toContain("Spoiler")
    expect(overlay.properties?.onKeyDown).toBeDefined()
  })

  describe("processParagraph function", () => {
    it.each([
      {
        name: "simple spoiler paragraph",
        input: h("p", {}, "! This is a spoiler"),
        expected: h("p", {}, "This is a spoiler"),
      },
      {
        name: "spoiler with inline elements",
        input: h("p", {}, [
          "! This is a ",
          h("em", "spoiler"),
          " with ",
          h("strong", "formatting"),
        ]),
        expected: h("p", {}, [
          "This is a ",
          h("em", "spoiler"),
          " with ",
          h("strong", "formatting"),
        ]),
      },
      {
        name: "non-spoiler paragraph",
        input: h("p", {}, "This is not a spoiler"),
        expected: null,
      },
    ])("$name", ({ input, expected }) => {
      const result = processParagraph(input as Element)
      expect(removePositions(result)).toEqual(removePositions(expected))
    })
  })

  describe("modifyNode function", () => {
    it.each([
      {
        name: "simple spoiler blockquote",
        input: h("blockquote", {}, [h("p", {}, "! This is a spoiler")]),
        expected: createSpoilerNode([h("p", {}, "This is a spoiler")]),
      },
      {
        name: "multi-paragraph spoiler",
        input: h("blockquote", {}, [
          h("p", {}, "! First paragraph"),
          h("p", {}, "! Second paragraph"),
        ]),
        expected: createSpoilerNode([
          h("p", {}, "First paragraph"),
          h("p", {}, "Second paragraph"),
        ]),
      },
      {
        name: "spoiler with empty line",
        input: h("blockquote", {}, [
          h("p", {}, "! First paragraph"),
          { type: "text", value: "!" },
          h("p", {}, "! Third paragraph"),
        ]),
        expected: createSpoilerNode([
          h("p", {}, "First paragraph"),
          h("p", {}),
          h("p", {}, "Third paragraph"),
        ]),
      },
      {
        name: "non-spoiler blockquote",
        input: h("blockquote", {}, [h("p", {}, "This is not a spoiler")]),
        expected: h("blockquote", {}, [h("p", {}, "This is not a spoiler")]),
      },
    ])("$name", ({ input, expected }) => {
      const parent: Parent = { type: "root", children: [input] }
      modifyNode(input as Element, 0, parent)
      expect(removePositions(parent.children[0])).toEqual(removePositions(expected))
    })
  })

  it.each([
    {
      name: "simple spoiler",
      input: h("blockquote", {}, [h("p", {}, "!Spoiler text")]),
    },
    {
      name: "spoiler with space",
      input: h("blockquote", {}, [h("p", {}, "! Spoiler with space")]),
    },
    {
      name: "multi-paragraph spoiler",
      input: h("blockquote", {}, [h("p", {}, "!Multi-line"), h("p", {}, "!spoiler")]),
    },
  ])("modifyNode function ($name)", ({ input }) => {
    const parent: Parent = { type: "root", children: [input] }
    modifyNode(input as Element, 0, parent)

    const result = parent.children[0] as Element
    expect(result.tagName).toBe("div")
    expect(result.properties?.className).toContain("spoiler-container")
    expect(result.children).toHaveLength(2)
    expect((result.children[0] as Element).properties?.className).toContain("spoiler-overlay")
    expect((result.children[1] as Element).properties?.className).toContain("spoiler-content")
  })

  it("correctly handles multiline spoilers with empty lines", async () => {
    const input = `
      <blockquote>
        <p>! There can even be multiline spoilers!</p>
        \n!
        <p>! This should be in another element.</p>
      </blockquote>
    `
    const output = await process(input)

    expect(output).toMatch(/<div class="spoiler-container"[^>]*>/)
    expect(output).toContain('<span class="spoiler-content">')
    expect(output).toMatch(/<p>There can even be multiline spoilers!<\/p>/)
    expect(output).toMatch(/<p><\/p>/)
    expect(output).toMatch(/<p>This should be in another element.<\/p>/)
    expect(output.match(/<p>/g)).toHaveLength(3) // Ensure we have 3 paragraph elements
  })

  test("modifyNode function handles newline text nodes and empty paragraphs", () => {
    const input = h("blockquote", {}, [
      h("p", {}, "!Spoiler text"),
      { type: "text", value: "!" },
      h("p", {}, "!More spoiler"),
    ])
    const parent: Parent = { type: "root", children: [input] }

    modifyNode(input as Element, 0, parent)

    const result = removePositions(parent.children[0])
    const expectedSpoiler = createSpoilerNode([
      h("p", {}, "Spoiler text"),
      h("p", {}),
      h("p", {}, "More spoiler"),
    ])
    expect(result).toEqual(removePositions(expectedSpoiler))
  })

  describe("Inline element handling", () => {
    const testCases = [
      {
        name: "multiline with various inline elements",
        input: `
          <blockquote>
            <p>! There can be <em>multiline</em> spoilers!</p>
            \n!
            <p>! This has <code>code</code> and <strong>bold</strong>.</p>
          </blockquote>
        `,
        expectedMatches: [
          /<div class="spoiler-container"[^>]*>/,
          /<span class="spoiler-content">/,
          /<p>\s*There can be <em>multiline<\/em> spoilers!<\/p>/,
          /<p>\s*<\/p>/,
          /<p>\s*This has <code>code<\/code> and <strong>bold<\/strong>.<\/p>/,
        ],
        paragraphCount: 3,
      },
      {
        name: "inline elements at paragraph start",
        input: `
          <blockquote>
            <p>! <em>Emphasized</em> spoiler start</p>
            <p>! <code>Coded</code> second line</p>
          </blockquote>
        `,
        expectedMatches: [
          /<p>\s*<em>Emphasized<\/em> spoiler start<\/p>/,
          /<p>\s*<code>Coded<\/code> second line<\/p>/,
        ],
        paragraphCount: 2,
      },
    ]

    test.each(testCases)("$name", async ({ input, expectedMatches, paragraphCount }) => {
      const output = await process(input)
      expectedMatches.forEach((matcher) => expect(output).toMatch(matcher))
      expect(output.match(/<p[^>]*>/g)).toHaveLength(paragraphCount)
    })
  })

  test("modifyNode preserves complex inline structures", () => {
    const input = h("blockquote", {}, [
      h("p", {}, [
        "!Complex ",
        h("em", {}, ["nested ", h("strong", {}, "inline")]),
        " ",
        h("code", {}, "elements"),
      ]),
    ])
    const parent: Parent = { type: "root", children: [input] }

    modifyNode(input as Element, 0, parent)

    const result = removePositions(parent.children[0])
    const expectedSpoiler = createSpoilerNode([
      h("p", {}, [
        "Complex ",
        h("em", {}, ["nested ", h("strong", {}, "inline")]),
        " ",
        h("code", {}, "elements"),
      ]),
    ])
    expect(result).toEqual(removePositions(expectedSpoiler))
  })

  test("modifyNode handles blockquote with non-paragraph child element", () => {
    const blockquote = h("blockquote", {}, [
      h("p", {}, "! First spoiler"),
      h("div", {}, "Not a paragraph"), // This should break spoiler detection
    ])
    const parent: Parent = { type: "root", children: [blockquote] }

    modifyNode(blockquote as Element, 0, parent)

    // Should remain unchanged since it contains a non-paragraph element
    expect(parent.children[0]).toEqual(blockquote)
  })

  test("rehypeCustomSpoiler plugin function", () => {
    const plugin = rehypeCustomSpoiler()

    expect(plugin.name).toBe("customSpoiler")
    expect(plugin.htmlPlugins).toBeDefined()
    expect(typeof plugin.htmlPlugins).toBe("function")

    const mockCtx = {} as BuildCtx
    // skipcq: JS-0339
    const htmlPlugins = plugin.htmlPlugins!(mockCtx)
    expect(Array.isArray(htmlPlugins)).toBe(true)
    expect(htmlPlugins).toHaveLength(1)
    expect(typeof htmlPlugins[0]).toBe("function")
  })

  it.each([
    { name: "undefined index", index: undefined, parent: "valid" },
    { name: "undefined parent", index: 0, parent: undefined },
  ])("modifyNode handles $name", ({ index, parent: parentType }) => {
    const blockquote = h("blockquote", {}, [h("p", {}, "! Spoiler")])
    const parent: Parent = { type: "root", children: [blockquote] }
    const parentArg = parentType === "valid" ? parent : undefined

    modifyNode(blockquote as Element, index, parentArg)
    expect(parent.children[0]).toBe(blockquote) // Should remain unchanged
  })

  it.each([
    {
      name: "paragraph with only element children",
      input: h("p", {}, [h("em", "emphasis"), h("strong", "bold")]),
      expected: null,
    },
    {
      name: "mixed content starting with spoiler",
      input: h("p", {}, ["! Start with spoiler", h("em", "then element"), " then more text"]),
      expected: h("p", {}, ["Start with spoiler", h("em", "then element"), " then more text"]),
    },
  ])("processParagraph handles $name", ({ input, expected }) => {
    const result = processParagraph(input as Element)
    expect(removePositions(result)).toEqual(removePositions(expected))
  })

  it.each([
    {
      name: "direct modifyNode visitor",
      setupTree: () => ({
        type: "root",
        children: [
          h("blockquote", {}, [h("p", {}, "! This is a spoiler")]),
          h("p", {}, "Not a spoiler"),
        ],
      }),
      transform: (tree: Root) => {
        visit(tree, "element", modifyNode)
      },
      extraChecks: (tree: Root) => {
        expect((tree.children[1] as Element).tagName).toBe("p") // Should remain unchanged
      },
    },
    {
      name: "htmlPlugins transformer",
      setupTree: () => ({
        type: "root",
        children: [h("blockquote", {}, [h("p", {}, "! Test spoiler")])],
      }),
      transform: (tree: Root) => {
        const plugin = rehypeCustomSpoiler()
        const mockCtx = {} as BuildCtx
        // skipcq: JS-0339
        const htmlPlugins = plugin.htmlPlugins!(mockCtx)
        const transformerFunction = htmlPlugins[0] as () => (tree: Root) => void
        const actualTransformer = transformerFunction()
        actualTransformer(tree)
      },
      extraChecks: () => {
        /* testing */
      },
    },
  ])("$name works correctly", ({ setupTree, transform, extraChecks }) => {
    const tree = setupTree() as Root
    transform(tree)

    const firstChild = tree.children[0] as Element
    expect(firstChild.tagName).toBe("div")
    expect((firstChild.properties as Record<string, unknown>).className).toContain(
      "spoiler-container",
    )
    extraChecks(tree)
  })
})
