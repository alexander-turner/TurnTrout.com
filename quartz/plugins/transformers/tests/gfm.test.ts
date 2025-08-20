import { describe, expect, beforeEach, test, it } from "@jest/globals"
import { type Element, type Root } from "hast"
import { h } from "hastscript"

import type { BuildCtx } from "../../../util/ctx"

import { QuartzConfig } from "../../../cfg"
import {
  slugify,
  resetSlugger,
  maybeSpliceAndAppendBackArrow,
  removeBackArrowFromChildren,
  preprocessSlug,
  returnAddIdsToHeadingsFn,
  GitHubFlavoredMarkdown,
  isFootnoteListItem,
  findFootnoteBackArrow,
  appendArrowToFootnoteListItemVisitor,
} from "../gfm"

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
  cfg: {} as QuartzConfig,
  allSlugs: [],
}

describe("slugify function", () => {
  beforeEach(() => {
    // Reset the slugger before each test to ensure uniqueness tests are valid
    resetSlugger()
  })

  it.each([
    ["should convert simple header text to a slug", "Simple Header", "simple-header"],
    [
      "should handle special characters by replacing them with hyphens: slashes",
      "Header/With/Slashes",
      "header-with-slashes",
    ],
    [
      "should handle special characters by replacing them with hyphens: ampersands",
      "Header & Special & Characters",
      "header-special-characters",
    ],
    [
      "should handle special characters by replacing them with hyphens: em dashes",
      "Header—With—Em Dashes",
      "header-with-em-dashes",
    ],
    [
      "should handle special characters by replacing them with hyphens: quotes",
      "Header “With” Quotes",
      "header-with-quotes",
    ],
    [
      "should remove consecutive hyphens generated from multiple special characters: double hyphens",
      "Header -- With -- Multiple -- Hyphens",
      "header-with-multiple-hyphens",
    ],
    [
      "should remove consecutive hyphens generated from multiple special characters: multiple slashes",
      "Header ///// With ///// Multiple Slashes",
      "header-with-multiple-slashes",
    ],
    [
      "should convert uppercase letters to lowercase: all uppercase",
      "THIS IS UPPERCASE",
      "this-is-uppercase",
    ],
    [
      "should convert uppercase letters to lowercase: mixed case",
      "MiXeD CaSe HeAdEr",
      "mixed-case-header",
    ],
    ["should handle headers with numbers and symbols: numbers", "Header 123", "header-123"],
    ["should handle headers with numbers and symbols: hash", "Header #1", "header-1"],
    ["should handle headers with numbers and symbols: dollar sign", "Price is $5", "price-is-5"],
    [
      "should maintain compatibility with LessWrong slug behavior: apostrophe",
      "Example's Header",
      "example-s-header",
    ],
    [
      "should maintain compatibility with LessWrong slug behavior: slash",
      "Understanding AI/ML Techniques",
      "understanding-ai-ml-techniques",
    ],
    [
      "should maintain compatibility with LessWrong slug behavior: ampersand and em dash",
      "Rock & Roll — The Beginning",
      "rock-roll-the-beginning",
    ],
  ])("%s", (_desc: string, input: string, expected: string) => {
    expect(slugify(input)).toBe(expected)
  })

  test("should generate unique slugs for duplicate headers", () => {
    expect(slugify("Duplicate Header")).toBe("duplicate-header")
    expect(slugify("Duplicate Header")).toBe("duplicate-header-1")
    expect(slugify("Duplicate Header")).toBe("duplicate-header-2")
  })
})

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

  test("should handle node without children property", () => {
    const node = h("li", [h("p", [])])

    // Should not throw an error
    expect(() => {
      maybeSpliceAndAppendBackArrow(node, mockBackArrow)
    }).not.toThrow()
  })

  test("should handle node with empty children array", () => {
    const node = h("li", [])

    // Should not throw an error
    expect(() => {
      maybeSpliceAndAppendBackArrow(node, mockBackArrow)
    }).not.toThrow()
  })
})

describe("removeBackArrowFromChildren function", () => {
  test("should remove back arrow from node children", () => {
    const node = h("li", ["Some text", h("a", { className: "data-footnote-backref" })])

    removeBackArrowFromChildren(node)
    expect(node.children).toHaveLength(1)
    expect(node.children[0]).toEqual({ type: "text", value: "Some text" })
  })

  test("should keep other elements intact", () => {
    const node = h("li", [
      "Text",
      h("a", { className: "regular-link" }),
      h("a", { className: "data-footnote-backref" }),
    ])

    removeBackArrowFromChildren(node)
    expect(node.children).toHaveLength(2)
    expect(node.children[0]).toEqual({ type: "text", value: "Text" })
    expect(node.children[1]).toEqual(h("a", { className: "regular-link" }))
  })

  test("should handle node with no back arrow", () => {
    const node = h("li", ["Just text"])

    const originalChildren = [...node.children]
    removeBackArrowFromChildren(node)
    expect(node.children).toEqual(originalChildren)
  })
})

describe("preprocessSlug function", () => {
  it.each([
    ["Text's header", "Text-s header"],
    ["Text's header", "Text-s header"],
    ["Text/With/Slashes", "Text-With-Slashes"],
    ["Text & Ampersand", "Text - Ampersand"],
    ["Text—Em Dash", "Text-Em Dash"],
    ["Text'Quote", "Text-Quote"],
    ["Text---Multiple---Hyphens", "Text-Multiple-Hyphens"],
    ["Text/&/Combo", "Text-Combo"],
    ["", ""],
    ["Normal Text", "Normal Text"],
  ])("should process '%s' to '%s'", (input: string, expected: string) => {
    expect(preprocessSlug(input)).toBe(expected)
  })
})

describe("returnAddIdsToHeadingsFn function", () => {
  beforeEach(() => {
    resetSlugger()
  })

  test("should add ids to headings without existing ids", () => {
    const tree: Root = {
      type: "root",
      children: [h("h1", ["First Heading"]), h("h2", ["Second Heading"])],
    }

    const processor = returnAddIdsToHeadingsFn()
    processor(tree)

    const h1 = tree.children[0] as Element
    const h2 = tree.children[1] as Element

    expect(h1.properties?.id).toBe("first-heading")
    expect(h2.properties?.id).toBe("second-heading")
  })

  test("should not override existing ids", () => {
    const tree: Root = {
      type: "root",
      children: [h("h1", { id: "custom-id" }, ["Heading with ID"]), h("h2", ["Another Heading"])],
    }

    const processor = returnAddIdsToHeadingsFn()
    processor(tree)

    const h1 = tree.children[0] as Element
    const h2 = tree.children[1] as Element

    expect(h1.properties?.id).toBe("custom-id")
    expect(h2.properties?.id).toBe("another-heading")
  })

  test("should handle non-heading elements", () => {
    const tree: Root = {
      type: "root",
      children: [h("p", ["This is a paragraph"]), h("div", ["This is a div"])],
    }

    const processor = returnAddIdsToHeadingsFn()
    processor(tree)

    const paragraphElement = tree.children[0] as Element
    const divElement = tree.children[1] as Element

    expect(paragraphElement.properties?.id).toBeUndefined()
    expect(divElement.properties?.id).toBeUndefined()
  })

  test("should reset slugger on each call", () => {
    const tree1: Root = {
      type: "root",
      children: [h("h1", ["Same Heading"])],
    }

    const tree2: Root = {
      type: "root",
      children: [h("h1", ["Same Heading"])],
    }

    const processor = returnAddIdsToHeadingsFn()
    processor(tree1)
    processor(tree2)

    const h1_tree1 = tree1.children[0] as Element
    const h1_tree2 = tree2.children[0] as Element

    // Both should get the same ID since slugger is reset
    expect(h1_tree1.properties?.id).toBe("same-heading")
    expect(h1_tree2.properties?.id).toBe("same-heading")
  })
})

describe("GitHubFlavoredMarkdown plugin", () => {
  function getPlugins(plugin: ReturnType<typeof GitHubFlavoredMarkdown>) {
    if (!plugin.markdownPlugins || !plugin.htmlPlugins) {
      throw new Error("Plugin markdownPlugins or htmlPlugins is undefined")
    }
    return {
      markdownPlugins: plugin.markdownPlugins(mockBuildCtx),
      htmlPlugins: plugin.htmlPlugins(mockBuildCtx),
    }
  }

  test("should return correct plugin name", () => {
    const plugin = GitHubFlavoredMarkdown()
    expect(plugin.name).toBe("GitHubFlavoredMarkdown")
  })

  test("should include SmartyPants when enabled", () => {
    const plugin = GitHubFlavoredMarkdown({ enableSmartyPants: true })
    const { markdownPlugins } = getPlugins(plugin)
    expect(markdownPlugins).toHaveLength(2)
  })

  test("should exclude SmartyPants when disabled", () => {
    const plugin = GitHubFlavoredMarkdown({ enableSmartyPants: false })
    const { markdownPlugins } = getPlugins(plugin)
    expect(markdownPlugins).toHaveLength(1)
  })

  test("should include heading plugins when linkHeadings is enabled", () => {
    const plugin = GitHubFlavoredMarkdown({ linkHeadings: true })
    const { htmlPlugins } = getPlugins(plugin)
    expect(htmlPlugins.length).toBeGreaterThan(1)
  })

  test("should only include footnote plugin when linkHeadings is disabled", () => {
    const plugin = GitHubFlavoredMarkdown({ linkHeadings: false })
    const { htmlPlugins } = getPlugins(plugin)
    expect(htmlPlugins).toHaveLength(1)
  })

  test("should use default options when no options provided", () => {
    const plugin = GitHubFlavoredMarkdown()
    const { markdownPlugins, htmlPlugins } = getPlugins(plugin)

    // Default is SmartyPants enabled and linkHeadings enabled
    expect(markdownPlugins).toHaveLength(2)
    expect(htmlPlugins.length).toBeGreaterThan(1)
  })

  test("should merge user options with defaults", () => {
    const plugin = GitHubFlavoredMarkdown({ enableSmartyPants: false })
    const { markdownPlugins, htmlPlugins } = getPlugins(plugin)

    // SmartyPants disabled, but linkHeadings should still use default (true)
    expect(markdownPlugins).toHaveLength(1)
    expect(htmlPlugins.length).toBeGreaterThan(1)
  })

  test("should verify footnote plugin is included in html plugins", () => {
    const plugin = GitHubFlavoredMarkdown()
    const { htmlPlugins } = getPlugins(plugin)

    // Should have at least one plugin (the footnote plugin)
    expect(htmlPlugins.length).toBeGreaterThanOrEqual(1)
    expect(typeof htmlPlugins[0]).toBe("function")
  })

  test("footnote plugin should be a function", () => {
    const plugin = GitHubFlavoredMarkdown()
    const { htmlPlugins } = getPlugins(plugin)

    // Verify the footnote plugin is included and is a function
    expect(htmlPlugins.length).toBeGreaterThanOrEqual(1)
    expect(typeof htmlPlugins[0]).toBe("function")
  })

  test("footnote plugin should handle undefined tree gracefully", () => {
    const plugin = GitHubFlavoredMarkdown()
    const { htmlPlugins } = getPlugins(plugin)

    const footnoteProcessor = htmlPlugins[0] as (tree: unknown) => void

    // Should not throw when called with undefined tree
    expect(() => {
      footnoteProcessor(undefined)
    }).not.toThrow()
  })
})

describe("isFootnoteListItem function", () => {
  it.each([
    [
      "footnote list item with id fn-1",
      () => h("li", { id: "user-content-fn-1" }, ["Footnote text"]),
      true,
    ],
    [
      "footnote list item with id fn-42",
      () => h("li", { id: "user-content-fn-42" }, ["Footnote text"]),
      true,
    ],
    ["non-footnote list item", () => h("li", ["Regular list item"]), false],
    ["list item with wrong id", () => h("li", { id: "some-other-id" }, ["List item"]), false],
    [
      "non-list element with footnote id",
      () => h("p", { id: "user-content-fn-1" }, ["Not a list item"]),
      false,
    ],
    ["list item without id", () => h("li", ["List item without id"]), false],
  ])("should handle %s", (_desc: string, createElement: () => Element, expected: boolean) => {
    expect(isFootnoteListItem(createElement())).toBe(expected)
  })
})

describe("findFootnoteBackArrow function", () => {
  test("should find back arrow in footnote", () => {
    const backArrow = h("a", { className: "data-footnote-backref" }, ["↩"])
    const footnoteItem = h("li", { id: "user-content-fn-1" }, [
      h("p", ["Footnote text", backArrow]),
    ])

    const result = findFootnoteBackArrow(footnoteItem)
    expect(result).toBe(backArrow)
  })

  it.each([
    [
      "no paragraph found",
      () => h("li", { id: "user-content-fn-1" }, [h("div", ["Not a paragraph"])]),
    ],
    ["paragraph has no children", () => h("li", { id: "user-content-fn-1" }, [h("p", [])])],
    [
      "last child is not an element",
      () => h("li", { id: "user-content-fn-1" }, [h("p", ["Just text"])]),
    ],
    [
      "last child is not an anchor",
      () => h("li", { id: "user-content-fn-1" }, [h("p", ["Text", h("span", ["Not an anchor"])])]),
    ],
    [
      "anchor does not have backref class",
      () =>
        h("li", { id: "user-content-fn-1" }, [
          h("p", ["Text", h("a", { className: "regular-link" }, ["Link"])]),
        ]),
    ],
    ["empty paragraph", () => h("li", { id: "user-content-fn-1" }, [h("p", [])])],
    [
      "paragraph without children property",
      () => {
        const paragraph = h("p", ["text"])
        delete (paragraph as unknown as { children?: unknown }).children
        return h("li", { id: "user-content-fn-1" }, [paragraph])
      },
    ],
    [
      "footnote node without children property",
      () => {
        const listItem = h("li", { id: "user-content-fn-1" }, [h("p", ["text"])])
        delete (listItem as unknown as { children?: unknown }).children
        return listItem
      },
    ],
  ])("should return null when %s", (_desc: string, createElement: () => Element) => {
    const result = findFootnoteBackArrow(createElement())
    expect(result).toBeNull()
  })

  test("should find back arrow even with multiple classes", () => {
    const backArrow = h("a", { className: "data-footnote-backref some-other-class" }, ["↩"])
    const footnoteItem = h("li", { id: "user-content-fn-1" }, [
      h("p", ["Footnote text", backArrow]),
    ])

    const result = findFootnoteBackArrow(footnoteItem)
    expect(result).toBe(backArrow)
  })
})

describe("gfmVisitor function", () => {
  test("should handle undefined node gracefully", () => {
    // Should not throw an error when called with undefined
    expect(() => {
      appendArrowToFootnoteListItemVisitor(undefined as unknown as Element)
    }).not.toThrow()
  })

  test("should process footnote with back arrow", () => {
    const backArrow = h("a", { className: "data-footnote-backref" }, ["↩"])
    const footnoteItem = h("li", { id: "user-content-fn-1" }, [
      h("p", ["Footnote text", backArrow]),
    ])

    appendArrowToFootnoteListItemVisitor(footnoteItem)

    // Should have processed the footnote - text + wrapped back arrow
    const paragraph = footnoteItem.children[0] as Element
    expect(paragraph.children).toHaveLength(2) // text + span with back arrow

    // Check that the back arrow is wrapped in a span
    const lastChild = paragraph.children[1] as Element
    expect(lastChild.tagName).toBe("span")
    expect(lastChild.properties?.className).toEqual(["favicon-span"])
  })

  it.each([
    ["non-footnote elements", () => h("li", ["Regular list item"])],
    [
      "footnotes without back arrows",
      () => h("li", { id: "user-content-fn-1" }, [h("p", ["Footnote text without back arrow"])]),
    ],
    [
      "footnotes with non-paragraph children",
      () => h("li", { id: "user-content-fn-1" }, [h("div", ["Not a paragraph"])]),
    ],
    [
      "footnote with back arrow not at end",
      () =>
        h("li", { id: "user-content-fn-1" }, [
          h("p", [h("a", { className: "data-footnote-backref" }, ["↩"]), "Text after back arrow"]),
        ]),
    ],
    [
      "footnote with non-anchor last child",
      () =>
        h("li", { id: "user-content-fn-1" }, [
          h("p", ["Footnote text", h("span", ["Not an anchor"])]),
        ]),
    ],
    [
      "footnote with anchor without backref class",
      () =>
        h("li", { id: "user-content-fn-1" }, [
          h("p", ["Footnote text", h("a", { className: "regular-link" }, ["Link"])]),
        ]),
    ],
  ])("should ignore %s", (_desc: string, createElement: () => Element) => {
    const element = createElement()
    const originalChildren = JSON.parse(JSON.stringify(element.children))

    appendArrowToFootnoteListItemVisitor(element)

    expect(element.children).toEqual(originalChildren)
  })

  test("should handle footnote with short text", () => {
    const backArrow = h("a", { className: "data-footnote-backref" }, ["↩"])
    const footnoteItem = h("li", { id: "user-content-fn-1" }, [h("p", ["Hi", backArrow])])

    appendArrowToFootnoteListItemVisitor(footnoteItem)

    // Should have processed the footnote
    const paragraph = footnoteItem.children[0] as Element
    expect(paragraph.children).toHaveLength(1) // just the span with all text + back arrow

    // Check that all text is wrapped with the back arrow
    const span = paragraph.children[0] as Element
    expect(span.tagName).toBe("span")
    expect(span.properties?.className).toEqual(["favicon-span"])
    expect(span.children).toHaveLength(2) // text + back arrow
  })

  test("should handle footnote with empty paragraph", () => {
    const backArrow = h("a", { className: "data-footnote-backref" }, ["↩"])
    const footnoteItem = h("li", { id: "user-content-fn-1" }, [h("p", [backArrow])])

    appendArrowToFootnoteListItemVisitor(footnoteItem)

    // Should have added just the back arrow
    const paragraph = footnoteItem.children[0] as Element
    expect(paragraph.children).toHaveLength(1)
    expect(paragraph.children[0]).toBe(backArrow)
  })

  test("should handle complex footnote structure", () => {
    const backArrow = h(
      "a",
      {
        className: "data-footnote-backref internal same-page-link",
        href: "#user-content-fnref-1",
      },
      ["⤴"],
    )

    const footnoteItem = h("li", { id: "user-content-fn-1" }, [
      h("p", [
        "This is a complex footnote with ",
        h("em", ["emphasized text"]),
        " and more content.",
        backArrow,
      ]),
    ])

    appendArrowToFootnoteListItemVisitor(footnoteItem)

    // Should have processed the footnote
    const paragraph = footnoteItem.children[0] as Element
    expect(paragraph.children).toHaveLength(4) // original content + span with last text + back arrow

    // Check that the last part is wrapped
    const lastChild = paragraph.children[3] as Element
    expect(lastChild.tagName).toBe("span")
    expect(lastChild.properties?.className).toEqual(["favicon-span"])
    expect(lastChild.children).toHaveLength(2) // text + back arrow
  })
})
