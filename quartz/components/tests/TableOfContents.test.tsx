/**
 * @jest-environment jsdom
 */
import { jest } from "@jest/globals"

import { Parent } from "hast"
import { describe, it, expect } from "@jest/globals"
import { TocEntry } from "../../plugins/transformers/toc"
import { processHtmlAst, processSmallCaps, processTocEntry, processKatex } from "../TableOfContents"
import { h } from "hastscript"

// Mock the createLogger function
jest.mock("../../plugins/transformers/logger_utils", () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
  }),
}))

let parent: Parent
beforeEach(() => {
  parent = { type: "element", tagName: "div", children: [] } as Parent
})

describe("processKatex", () => {
  it("should output katex node", () => {
    const latex = "E = mc^2"
    processKatex(latex, parent)

    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]).toHaveProperty("tagName", "span")
    expect(parent.children[0]).toHaveProperty("properties.className", ["katex-toc"])
    // The value itself is HTML so it's clunky to test
  })
})

describe("processSmallCaps", () => {
  beforeEach(() => {
    parent = { type: "element", tagName: "div", children: [] } as Parent
  })

  it("processes small caps correctly", () => {
    processSmallCaps("Test SMALLCAPS", parent)
    expect(parent.children).toMatchObject([
      { type: "text", value: "Test " },
      {
        type: "element",
        tagName: "abbr",
        properties: { className: ["small-caps"] },
        children: [{ type: "text", value: "SMALLCAPS" }],
      },
    ])
  })

  it("handles text without small caps", () => {
    processSmallCaps("No small caps here", parent)
    expect(parent.children).toMatchObject([{ type: "text", value: "No small caps here" }])
  })

  it("handles multiple small caps", () => {
    processSmallCaps("^SMALLCAPS-A normal SMALLCAPS-B", parent)
    expect(parent.children).toMatchObject([
      { type: "text", value: "^" },
      {
        type: "element",
        tagName: "abbr",
        properties: { className: ["small-caps"] },
        children: [{ type: "text", value: "SMALLCAPS-A" }],
      },
      { type: "text", value: " normal " },
      {
        type: "element",
        tagName: "abbr",
        properties: { className: ["small-caps"] },
        children: [{ type: "text", value: "SMALLCAPS-B" }],
      },
    ])
  })

  it("handles parent with existing children", () => {
    parent.children = [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["number-prefix"] },
        children: [{ type: "text", value: "8: " }],
      },
    ]

    processSmallCaps("Estimating the CDF and Statistical Functionals", parent)

    expect(parent.children).toMatchObject([
      {
        type: "element",
        tagName: "span",
        properties: { className: ["number-prefix"] },
        children: [{ type: "text", value: "8: " }],
      },
      { type: "text", value: "Estimating the " },
      {
        type: "element",
        tagName: "abbr",
        properties: { className: ["small-caps"] },
        children: [{ type: "text", value: "CDF" }],
      },
      { type: "text", value: " and Statistical Functionals" },
    ])
  })
})

describe("processTocEntry", () => {
  it("should process a TOC entry correctly into a hast node", () => {
    const entry: TocEntry = { depth: 1, text: "Test Heading", slug: "test-heading" }

    const result = processTocEntry(entry)

    expect(result.type).toBe("element")
    expect(result.children[0] as Parent).toHaveProperty("value", "Test Heading")
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

  it("should process text nodes with leading numbers", () => {
    const htmlAst = h(null, [{ type: "text", value: "1: Chapter One" }])

    processHtmlAst(htmlAst, parent)

    expect(parent.children).toHaveLength(2)
    expect(parent.children[0]).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: ["number-prefix"] },
      children: [{ type: "text", value: "1: " }],
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
      children: [{ type: "text", value: "SMALLCAPS" }],
    })
  })
})
