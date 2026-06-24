/**
 * @jest-environment node
 */
import type { Root } from "hast"

import { describe, expect, it } from "@jest/globals"

import { gatherAllText, gatherReadingTimeText, processGatheredText } from "../extractText"

// Builders for the minimal mdast shapes the gather functions inspect.
const text = (value: string) => ({ type: "text", value })
const paragraph = (value: string) => ({ type: "paragraph", children: [text(value)] })
const heading = (depth: number, value: string) => ({
  type: "heading",
  depth,
  children: [text(value)],
})
const blockquote = (firstLine: string, body: string) => ({
  type: "blockquote",
  children: [{ type: "paragraph", children: [text(`${firstLine}\n${body}`)] }],
})
const root = (children: unknown[]): Root => ({ type: "root", children }) as unknown as Root

// Reading-time gathering appends a trailing space per node; normalize for comparison.
const gathered = (tree: Root) => gatherReadingTimeText(tree).trim()

describe("gatherAllText", () => {
  it("gathers every text/code/math node, including hidden content", () => {
    const tree = root([
      paragraph("visible prose"),
      blockquote("[!note]- Hidden", "secret body"),
      heading(2, "Appendix: extras"),
      paragraph("appendix body"),
      { type: "code", value: "const x = 1" },
    ])
    const result = gatherAllText(tree)
    for (const piece of ["visible prose", "secret body", "appendix body", "const x = 1"]) {
      expect(result).toContain(piece)
    }
  })
})

describe("gatherReadingTimeText", () => {
  it("gathers plain prose", () => {
    const tree = root([paragraph("hello world"), paragraph("goodbye world")])
    expect(gathered(tree)).toBe("hello world goodbye world")
  })

  it("excludes collapsed admonitions", () => {
    const tree = root([
      paragraph("visible prose"),
      blockquote("[!note]- Hidden title", "secret body text"),
    ])
    expect(gathered(tree)).toBe("visible prose")
  })

  it.each([
    ["[!note] Open title", "expanded by default"],
    ["[!note]+ Open title", "expanded with plus"],
    ["just a normal quote", "regular quoted text"],
  ])("includes non-collapsed blockquotes (%s)", (firstLine, body) => {
    const tree = root([blockquote(firstLine, body)])
    expect(gathered(tree)).toContain(body)
  })

  it("ignores blockquotes whose first child is not a paragraph", () => {
    const tree = root([
      { type: "blockquote", children: [heading(3, "quoted heading"), paragraph("quoted prose")] },
    ])
    expect(gathered(tree)).toContain("quoted prose")
  })

  it("ignores blockquotes whose first paragraph does not start with text", () => {
    const tree = root([
      {
        type: "blockquote",
        children: [{ type: "paragraph", children: [{ type: "emphasis", children: [] }] }],
      },
      paragraph("after quote"),
    ])
    expect(gathered(tree)).toBe("after quote")
  })

  it("ignores empty blockquotes", () => {
    const tree = root([{ type: "blockquote" }, paragraph("after empty quote")])
    expect(gathered(tree)).toBe("after empty quote")
  })

  it("tolerates headings and text-type nodes with missing or non-string values", () => {
    const tree = root([
      { type: "heading", depth: 2 }, // no children
      { type: "heading", depth: 2, children: [{ type: "text", value: 7 }] }, // non-string value
      { type: "code" }, // text-type node lacking a value
      paragraph("trailing prose"),
    ])
    expect(gathered(tree)).toBe("trailing prose")
  })

  it("excludes footnote definitions", () => {
    const tree = root([
      paragraph("body with a marker[^1]"),
      paragraph("[^1]: the footnote text that should not count"),
    ])
    expect(gathered(tree)).toBe("body with a marker[^1]")
  })

  it.each([1, 2])("excludes the appendix region from a depth-%i heading", (depth) => {
    const tree = root([
      paragraph("main body"),
      heading(depth, "Appendix: extras"),
      paragraph("appendix body that should not count"),
    ])
    expect(gathered(tree)).toBe("main body")
  })

  it("matches appendix headings case-insensitively", () => {
    const tree = root([paragraph("main body"), heading(2, "APPENDIX A"), paragraph("nope")])
    expect(gathered(tree)).toBe("main body")
  })

  it("does not treat deeper headings as an appendix boundary", () => {
    const tree = root([
      paragraph("main body"),
      heading(3, "Appendix: still counted"),
      paragraph("trailing prose"),
    ])
    expect(gathered(tree)).toContain("trailing prose")
  })

  it("does not treat a heading without leading text as an appendix boundary", () => {
    const tree = root([
      paragraph("main body"),
      { type: "heading", depth: 2, children: [{ type: "emphasis", children: [] }] },
      paragraph("trailing prose"),
    ])
    expect(gathered(tree)).toContain("trailing prose")
  })

  it("does not treat non-appendix headings as a boundary", () => {
    const tree = root([paragraph("intro"), heading(2, "Conclusion"), paragraph("final thoughts")])
    expect(gathered(tree)).toBe("intro Conclusion final thoughts")
  })

  it("only treats a top-level appendix heading as the boundary", () => {
    const tree = root([
      {
        type: "blockquote",
        children: [heading(2, "Appendix nested in a quote"), paragraph("nested prose")],
      },
      paragraph("trailing top-level prose"),
    ])
    expect(gathered(tree)).toContain("trailing top-level prose")
  })
})

describe("processGatheredText", () => {
  it("escapes HTML and collapses URLs", () => {
    expect(processGatheredText("a < b")).toContain("&lt;")
    expect(processGatheredText("see https://example.com/path here")).toContain("example.com/path")
  })
})
