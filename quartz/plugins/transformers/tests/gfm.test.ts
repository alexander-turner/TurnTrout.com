import { describe, expect, beforeEach, test } from "@jest/globals"
import { type Element } from "hast"
import { h } from "hastscript"

import { slugify, resetSlugger, maybeSpliceAndAppendBackArrow, removeBackArrow } from "../gfm"

describe("slugify function", () => {
  beforeEach(() => {
    // Reset the slugger before each test to ensure uniqueness tests are valid
    resetSlugger()
  })

  test("should convert simple header text to a slug", () => {
    expect(slugify("Simple Header")).toBe("simple-header")
  })

  test("should handle special characters by replacing them with hyphens", () => {
    expect(slugify("Header/With/Slashes")).toBe("header-with-slashes")
    expect(slugify("Header & Special & Characters")).toBe("header-special-characters")
    expect(slugify("Header—With—Em Dashes")).toBe("header-with-em-dashes")
    expect(slugify("Header “With” Quotes")).toBe("header-with-quotes")
  })

  test("should remove consecutive hyphens generated from multiple special characters", () => {
    expect(slugify("Header -- With -- Multiple -- Hyphens")).toBe("header-with-multiple-hyphens")
    expect(slugify("Header ///// With ///// Multiple Slashes")).toBe("header-with-multiple-slashes")
  })

  test("should convert uppercase letters to lowercase", () => {
    expect(slugify("THIS IS UPPERCASE")).toBe("this-is-uppercase")
    expect(slugify("MiXeD CaSe HeAdEr")).toBe("mixed-case-header")
  })

  test("should generate unique slugs for duplicate headers", () => {
    expect(slugify("Duplicate Header")).toBe("duplicate-header")
    expect(slugify("Duplicate Header")).toBe("duplicate-header-1")
    expect(slugify("Duplicate Header")).toBe("duplicate-header-2")
  })

  test("should handle headers with numbers and symbols", () => {
    expect(slugify("Header 123")).toBe("header-123")
    expect(slugify("Header #1")).toBe("header-1")
    expect(slugify("Price is $5")).toBe("price-is-5")
  })

  test("should maintain compatibility with LessWrong slug behavior", () => {
    expect(slugify("Example’s Header")).toBe("example-s-header")
    expect(slugify("Understanding AI/ML Techniques")).toBe("understanding-ai-ml-techniques")
    expect(slugify("Rock & Roll — The Beginning")).toBe("rock-roll-the-beginning")
  })
})

// TODO: needs to come after tagacronyms, refactor
describe("maybeSpliceAndAppendBackArrow function", () => {
  let mockBackArrow: Element

  beforeEach(() => {
    mockBackArrow = h("a", { className: "data-footnote-backref" })
  })

  test("should wrap last four characters with backref in nowrap span", () => {
    const node = h("li", [h("p", ["Long text here"])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    expect(paragraph.children).toHaveLength(2)
    expect(paragraph.children[0]).toEqual({ type: "text", value: "Long text " })

    const span = paragraph.children[1] as Element
    expect(span).toEqual(h("span", { className: "favicon-span" }, ["here", mockBackArrow]))
  })

  test("should handle text shorter than 4 characters", () => {
    const node = h("li", [h("p", ["Hi"])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    const span = paragraph.children[0] as Element
    expect(span).toEqual(h("span", { className: "favicon-span" }, ["Hi", mockBackArrow]))
  })

  test("should handle multiple paragraphs", () => {
    const node = h("li", [h("p", ["First paragraph"]), h("p", ["Second paragraph"])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const firstParagraph = node.children[0] as Element
    expect(firstParagraph.children).toHaveLength(1)
    expect(firstParagraph.children[0]).toEqual({ type: "text", value: "First paragraph" })

    const lastParagraph = node.children[1] as Element
    expect(lastParagraph.children).toHaveLength(2)
    expect(lastParagraph.children[0]).toEqual({ type: "text", value: "Second parag" })
    expect(lastParagraph.children[1]).toEqual(
      h("span", { className: "favicon-span" }, ["raph", mockBackArrow]),
    )
  })

  test("should handle empty paragraph", () => {
    const node = h("li", [h("p", [])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    expect(paragraph.children).toHaveLength(1)
    expect(paragraph.children[0]).toBe(mockBackArrow)
  })

  test("should handle paragraph with only whitespace", () => {
    const node = h("li", h("p", [{ type: "text", value: "  " }]))

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    const span = paragraph.children[0] as Element
    expect(span).toEqual({ type: "text", value: "  " })
  })

  test("should handle multiple paragraphs", () => {
    const node = h("li", [h("p", ["First paragraph"]), h("p", ["Second paragraph"])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const firstParagraph = node.children[0] as Element
    expect(firstParagraph.children).toHaveLength(1)
    expect(firstParagraph.children[0]).toEqual({ type: "text", value: "First paragraph" })

    const lastParagraph = node.children[1] as Element
    expect(lastParagraph.children).toHaveLength(2)
    expect(lastParagraph.children[0]).toEqual({ type: "text", value: "Second parag" })
    expect(lastParagraph.children[1]).toEqual(
      h("span", { className: "favicon-span" }, ["raph", mockBackArrow]),
    )
  })

  test("should handle empty paragraph", () => {
    const node = h("li", [h("p", [])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    expect(paragraph.children).toHaveLength(1)
    expect(paragraph.children[0]).toBe(mockBackArrow)
  })

  test("should handle paragraph with only whitespace", () => {
    const node = h("li", [h("p", ["   "])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    expect(paragraph.children).toHaveLength(2)
    expect(paragraph.children[0]).toEqual({ type: "text", value: "   " })
    expect(paragraph.children[1]).toBe(mockBackArrow)
  })

  test("should handle complex multi-paragraph footnote with rich formatting", () => {
    const node = h("li", [
      h("p", ["First paragraph"]),
      h("p", [
        "Second paragraph.",
        h(
          "a",
          {
            href: "#user-content-fnref-instr",
            "data-footnote-backref": "",
            "aria-label": "Back to reference 2",
            className: "data-footnote-backref internal same-page-link",
          },
          ["⤴"],
        ),
      ]),
    ])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    expect(node.children).toHaveLength(2)

    // Check first paragraph remains unchanged
    const firstPara = node.children[0] as Element
    expect(firstPara.children).toHaveLength(1)
    expect(firstPara.children[0]).toEqual({ type: "text", value: "First paragraph" })

    // Check second paragraph has the text split and back arrow properly appended
    const secondPara = node.children[1] as Element
    expect(secondPara.children).toHaveLength(2)
    expect(secondPara.children[0]).toEqual({ type: "text", value: "Second paragr" })

    const nowrapSpan = secondPara.children[1] as Element
    expect(nowrapSpan.tagName).toBe("span")
    expect(nowrapSpan.properties).toEqual({ className: ["favicon-span"] })
    expect(nowrapSpan.children).toHaveLength(2)
    expect(nowrapSpan.children[0]).toEqual({ type: "text", value: "aph." })
    expect(nowrapSpan.children[1]).toBe(mockBackArrow)
  })

  test("should ignore <li> ending with an image", () => {
    const node = h("li", [h("img", { src: "image.png", alt: "test image" })])

    const originalChildren = [...(node.children[0] as Element).children]
    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    expect(paragraph.children).toEqual(originalChildren)
  })
})

describe("removeBackArrow function", () => {
  test("should remove back arrow from node children", () => {
    const node = h("li", ["Some text", h("a", { className: "data-footnote-backref" })])

    removeBackArrow(node)
    expect(node.children).toHaveLength(1)
    expect(node.children[0]).toEqual({ type: "text", value: "Some text" })
  })

  test("should keep other elements intact", () => {
    const node = h("li", [
      "Text",
      h("a", { className: "regular-link" }),
      h("a", { className: "data-footnote-backref" }),
    ])

    removeBackArrow(node)
    expect(node.children).toHaveLength(2)
    expect(node.children[0]).toEqual({ type: "text", value: "Text" })
    expect(node.children[1]).toEqual(h("a", { className: "regular-link" }))
  })

  test("should handle node with no back arrow", () => {
    const node = h("li", ["Just text"])

    const originalChildren = [...node.children]
    removeBackArrow(node)
    expect(node.children).toEqual(originalChildren)
  })
})
