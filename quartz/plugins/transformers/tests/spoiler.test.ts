import { expect, describe, it, test } from "@jest/globals"
import { type Element, type Parent } from "hast"
import { h } from "hastscript"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import {
  transformAST,
  matchSpoilerText,
  createSpoilerNode,
  modifyNode,
  processParagraph,
} from "../spoiler"

function removePositions(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(removePositions)
  } else if (typeof obj === "object" && obj !== null) {
    const newObj: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (key !== "position") {
        newObj[key] = removePositions(value)
      }
    }
    return newObj
  }
  return obj
}

async function process(input: string) {
  const result = await unified()
    .use(rehypeParse, { fragment: true })
    .use(() => transformAST)
    .use(rehypeStringify)
    .process(input)
  return result.toString()
}

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
    expect(output).toContain('<span class="spoiler-overlay"></span>')
    expect(output).not.toContain("<blockquote>")
    expect(output).toMatch(/onclick="[^"]*"/)
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
    ["<blockquote><p>!Spoiler text</p></blockquote>", "simple spoiler"],
    ["<blockquote><p>! Spoiler with space</p></blockquote>", "spoiler with space"],
    ["<blockquote><p>!Multi-line</p><p>!spoiler</p></blockquote>", "multi-paragraph spoiler"],
  ])("modifyNode function (%s)", (input) => {
    const parser = unified().use(rehypeParse, { fragment: true })
    const parsed = parser.parse(input) as Parent
    const node = parsed.children[0] as Element
    const parent: Parent = { type: "root", children: [node] }
    modifyNode(node, 0, parent)

    expect((parent.children[0] as Element).tagName).toBe("div")
    expect((parent.children[0] as Element).properties?.className).toContain("spoiler-container")
    expect((parent.children[0] as Element).children).toHaveLength(2)
    expect(
      ((parent.children[0] as Element).children[0] as Element).properties?.className,
    ).toContain("spoiler-overlay")
    expect(
      ((parent.children[0] as Element).children[1] as Element).properties?.className,
    ).toContain("spoiler-content")
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
    const input = "<blockquote><p>!Spoiler text</p>\n!<p>!More spoiler</p></blockquote>"
    const parser = unified().use(rehypeParse, { fragment: true })
    const parsed = parser.parse(input) as Parent
    const node = parsed.children[0] as Element
    const parent: Parent = { type: "root", children: [node] }

    modifyNode(node, 0, parent)

    const result = removePositions(parent.children[0])
    expect(result).toMatchObject({
      type: "element",
      tagName: "div",
      properties: {
        className: ["spoiler-container"],
      },
      children: [
        expect.objectContaining({
          type: "element",
          tagName: "span",
          properties: { className: ["spoiler-overlay"] },
        }),
        expect.objectContaining({
          type: "element",
          tagName: "span",
          properties: { className: ["spoiler-content"] },
          children: [
            expect.objectContaining({
              type: "element",
              tagName: "p",
              children: [{ type: "text", value: "Spoiler text" }],
            }),
            expect.objectContaining({ type: "element", tagName: "p", children: [] }),
            expect.objectContaining({
              type: "element",
              tagName: "p",
              children: [{ type: "text", value: "More spoiler" }],
            }),
          ],
        }),
      ],
    })
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
    const input =
      "<blockquote><p>!Complex <em>nested <strong>inline</strong></em> <code>elements</code></p></blockquote>"
    const node = unified().use(rehypeParse, { fragment: true }).parse(input).children[0] as Element
    const parent: Parent = { type: "root", children: [node] }

    modifyNode(node, 0, parent)

    const result = removePositions(parent.children[0])
    expect(result).toMatchObject({
      type: "element",
      tagName: "div",
      properties: { className: ["spoiler-container"] },
      children: [
        expect.objectContaining({
          tagName: "span",
          properties: { className: ["spoiler-overlay"] },
        }),
        expect.objectContaining({
          tagName: "span",
          properties: { className: ["spoiler-content"] },
          children: [
            expect.objectContaining({
              tagName: "p",
              children: [
                { type: "text", value: "Complex " },
                {
                  type: "element",
                  tagName: "em",
                  properties: {},
                  children: [
                    { type: "text", value: "nested " },
                    {
                      type: "element",
                      tagName: "strong",
                      properties: {},
                      children: [{ type: "text", value: "inline" }],
                    },
                  ],
                },
                { type: "text", value: " " },
                {
                  type: "element",
                  tagName: "code",
                  properties: {},
                  children: [{ type: "text", value: "elements" }],
                },
              ],
            }),
          ],
        }),
      ],
    })
  })
})
