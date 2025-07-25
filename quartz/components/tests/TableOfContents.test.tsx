/**
 * @jest-environment jsdom
 */

import type { Parent, RootContent } from "hast"

import { jest, describe, it, expect, beforeEach } from "@jest/globals"
import { h } from "hastscript"

import { TocEntry } from "../../plugins/transformers/toc"
import {
  CreateTableOfContents,
  processHtmlAst,
  processTocEntry,
  buildNestedList,
  elementToJsx,
} from "../TableOfContents"

// Mock the createLogger function
jest.mock("../../plugins/transformers/logger_utils", () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
  }),
}))

describe("processTocEntry", () => {
  it("should process a TOC entry correctly into a hast node", () => {
    const entry: TocEntry = { depth: 1, text: "Test Heading", slug: "test-heading" }

    const result = processTocEntry(entry)

    expect(result.type).toBe("element")
    expect(result.children[0] as Parent).toHaveProperty("value", "Test Heading")
  })

  it("should handle TOC entries with inline code and produce correct hast", () => {
    const entry: TocEntry = {
      depth: 1,
      text: "A heading with `code`",
      slug: "heading-with-code",
    }

    const result = processTocEntry(entry)

    expect(result.children).toHaveLength(2)
    expect(result.children[0]).toMatchObject({ type: "text", value: "A heading with " })
    expect(result.children[1]).toMatchObject({
      type: "element",
      tagName: "code",
      properties: { className: ["inline-code"] },
      children: [{ type: "text", value: "code" }],
    })
  })
})

describe("processHtmlAst", () => {
  let parent: Parent

  beforeEach(() => {
    parent = h("div") as Parent
  })

  it("should process text nodes without leading numbers", () => {
    const htmlAst = h(null, [{ type: "text", value: "Simple text" }])

    processHtmlAst(htmlAst, parent)

    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]).toMatchObject({ type: "text", value: "Simple text" })
  })

  it.each(["1: ", "1984"])("should process text nodes with leading numbers %s", (prefix) => {
    const htmlAst = h(null, [{ type: "text", value: `${prefix}Chapter One` }])

    processHtmlAst(htmlAst, parent)

    expect(parent.children).toHaveLength(2)
    expect(parent.children[0]).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: ["number-prefix"] },
      children: [{ type: "text", value: prefix }],
    })
    expect(parent.children[1]).toMatchObject({ type: "text", value: "Chapter One" })
  })

  it("should process nested elements", () => {
    const htmlAst = h(null, [h("p", "Nested text")])

    processHtmlAst(htmlAst, parent)

    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]).toMatchObject({
      type: "element",
      tagName: "p",
      properties: {},
      children: [{ type: "text", value: "Nested text" }],
    })
  })

  it("should process mixed content", () => {
    const htmlAst = h(null, [
      { type: "text", value: "2: Introduction" },
      h("em", "emphasized"),
      { type: "text", value: " and normal text" },
    ])

    processHtmlAst(htmlAst, parent)

    expect(parent.children).toHaveLength(4)
    expect(parent.children[0]).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: ["number-prefix"] },
      children: [{ type: "text", value: "2: " }],
    })
    expect(parent.children[1]).toMatchObject({ type: "text", value: "Introduction" })
    expect(parent.children[2]).toMatchObject({
      type: "element",
      tagName: "em",
      properties: {},
      children: [{ type: "text", value: "emphasized" }],
    })
    expect(parent.children[3]).toMatchObject({ type: "text", value: " and normal text" })
  })

  it("should handle small caps in text", () => {
    const htmlAst = h(null, [{ type: "text", value: "Text with SMALLCAPS" }])

    processHtmlAst(htmlAst, parent)

    expect(parent.children).toHaveLength(2)
    expect(parent.children[0]).toMatchObject({ type: "text", value: "Text with " })
    expect(parent.children[1]).toMatchObject({
      type: "element",
      tagName: "abbr",
      properties: { className: ["small-caps"] },
      children: [{ type: "text", value: "smallcaps" }],
    })
  })

  it("should handle empty ast", () => {
    const ast = h(null, [])
    processHtmlAst(ast, parent)
    expect(parent.children).toHaveLength(0)
  })

  it("should handle mixed inline elements", () => {
    const ast = h(null, [
      h("em", "emphasized"),
      { type: "text", value: " normal " },
      h("strong", "bold"),
    ])
    processHtmlAst(ast, parent)
    expect(parent.children).toHaveLength(3)
  })
})

// Mock the createLogger function
jest.mock("../../plugins/transformers/logger_utils", () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  }),
}))

describe("buildNestedList", () => {
  it("should build a nested list for headings up to depth 3", () => {
    const entries = [
      { depth: 1, text: "Heading 1", slug: "heading-1" },
      { depth: 2, text: "Heading 1.1", slug: "heading-1-1" },
      { depth: 3, text: "Heading 1.1.1", slug: "heading-1-1-1" },
      { depth: 2, text: "Heading 1.2", slug: "heading-1-2" },
    ]
    const [result] = buildNestedList(entries)

    // Instead of rendering, let's check the structure directly
    expect(result).toHaveLength(1)
    const firstItem = result[0]
    expect(firstItem.props.children[1].type).toBe("ul")
    expect(firstItem.props.children[1].props.children).toHaveLength(2)
  })

  it("should handle empty entries", () => {
    const [result] = buildNestedList([])
    expect(result).toHaveLength(0)
  })

  it("should handle single level entries", () => {
    const entries = [
      { depth: 1, text: "First", slug: "first" },
      { depth: 1, text: "Second", slug: "second" },
    ]
    const [result] = buildNestedList(entries)
    expect(result).toHaveLength(2)
  })
})

describe("afterDOMLoaded Script Attachment", () => {
  it("should have an afterDOMLoaded script assigned", () => {
    expect(CreateTableOfContents.afterDOMLoaded).toBeDefined()
    expect(typeof CreateTableOfContents.afterDOMLoaded).toBe("string")
    expect(CreateTableOfContents.afterDOMLoaded).toContain("document.addEventListener('nav'")
  })
})

describe("elementToJsx", () => {
  it("should handle text nodes", () => {
    const node = { type: "text", value: "Hello" } as RootContent
    expect(elementToJsx(node)).toBe("Hello")
  })

  it("should handle abbr elements", () => {
    const node = h("abbr", { className: ["small-caps"] }, "test")
    expect(elementToJsx(node)).toMatchObject({
      type: "abbr",
      props: {
        className: "small-caps",
        children: "test",
      },
    })
  })

  it("should handle katex spans", () => {
    const node = h("span", { className: ["katex-toc"] }, [
      { type: "raw", value: "<span>x^2</span>" },
    ])
    expect(elementToJsx(node)).toMatchObject({
      type: "span",
      props: {
        className: "katex-toc",
        dangerouslySetInnerHTML: { __html: "<span>x^2</span>" },
      },
    })
  })

  it("should handle inline code", () => {
    const node = h("span", { className: ["inline-code"] }, "const x = 1")
    expect(elementToJsx(node)).toMatchObject({
      type: "code",
      props: {
        className: "inline-code",
        children: ["const x = 1"],
      },
    })
  })

  it("should handle monospace arrows", () => {
    const node = h("span", { className: ["monospace-arrow"] }, "→")
    expect(elementToJsx(node)).toMatchObject({
      type: "span",
      props: {
        className: "monospace-arrow",
        children: ["→"],
      },
    })
  })
})
