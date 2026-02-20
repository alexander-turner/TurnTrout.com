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
  htmlAccessibilityPlugin,
  adoptPrecedingSiblingAsDt,
  deduplicateSvgIds,
  isValidDlStructure,
  ensureHeadingLinksHaveAccessibleNames,
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
      "should handle modifier letter apostrophe (U+02BC) like regular apostrophe",
      "Exampleʼs Header",
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

  test("should splice last 4 chars into favicon-span with back arrow after text", () => {
    const node = h("li", [h("p", ["Long text here"])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    expect(paragraph.children).toHaveLength(2) // shortened text + favicon-span (containing last chars + back arrow)
    expect(paragraph.children[0]).toEqual({ type: "text", value: "Long text " })
    const faviconSpan = paragraph.children[1] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "here" })
    expect(faviconSpan.children[1]).toBe(mockBackArrow)
  })

  test("should handle text shorter than 4 characters by wrapping all text in favicon-span", () => {
    const node = h("li", [h("p", ["Hi"])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    // Text node removed (all chars fit in favicon-span), only favicon-span remains
    expect(paragraph.children).toHaveLength(1)
    const faviconSpan = paragraph.children[0] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "Hi" })
    expect(faviconSpan.children[1]).toBe(mockBackArrow)
  })

  test("should handle multiple paragraphs", () => {
    const node = h("li", [h("p", ["First paragraph"]), h("p", ["Second paragraph"])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const firstParagraph = node.children[0] as Element
    expect(firstParagraph.children).toHaveLength(1)
    expect(firstParagraph.children[0]).toEqual({ type: "text", value: "First paragraph" })

    const lastParagraph = node.children[1] as Element
    // "Second paragraph" = 16 chars, textIndex = 12, text becomes "Second parag", favicon-span gets "raph"
    expect(lastParagraph.children).toHaveLength(2) // shortened text + favicon-span
    expect(lastParagraph.children[0]).toEqual({ type: "text", value: "Second parag" })
    const faviconSpan = lastParagraph.children[1] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "raph" })
    expect(faviconSpan.children[1]).toBe(mockBackArrow)
  })

  test("should handle empty paragraph by appending arrow into it", () => {
    const node = h("li", [h("p", [])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    // Arrow appended into the empty paragraph
    expect(node.children).toHaveLength(1)
    const p = node.children[0] as Element
    expect(p.tagName).toBe("p")
    expect(p.children).toHaveLength(1)
    expect(p.children[0]).toBe(mockBackArrow)
  })

  test("should handle empty paragraph with table sibling", () => {
    const table = h("table", [h("tr", [h("td", ["cell"])])])
    const node = h("li", [table, h("p", [])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    // Arrow appended into the empty paragraph after the table
    expect(node.children).toHaveLength(2)
    expect((node.children[0] as Element).tagName).toBe("table")
    const p = node.children[1] as Element
    expect(p.tagName).toBe("p")
    expect(p.children).toHaveLength(1)
    expect(p.children[0]).toBe(mockBackArrow)
  })

  test("should handle paragraph with only whitespace", () => {
    const node = h("li", h("p", [{ type: "text", value: "  " }]))

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    // Whitespace paragraph preserved with back arrow appended directly (no span wrapping)
    const paragraph = node.children[0] as Element
    expect(paragraph.children).toHaveLength(2)
    expect(paragraph.children[0]).toEqual({ type: "text", value: "  " })
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

    // Check second paragraph: old back arrow removed, last 4 chars spliced into favicon-span
    const secondPara = node.children[1] as Element
    // "Second paragraph." = 17 chars, textIndex = 13
    expect(secondPara.children).toHaveLength(2) // shortened text + favicon-span
    expect(secondPara.children[0]).toEqual({ type: "text", value: "Second paragr" })
    const faviconSpan = secondPara.children[1] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "aph." })
    expect(faviconSpan.children[1]).toBe(mockBackArrow)
  })

  test("should ignore <li> ending with an image", () => {
    const node = h("li", [h("img", { src: "image.png", alt: "test image" })])

    const originalChildren = [...(node.children[0] as Element).children]
    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    const paragraph = node.children[0] as Element
    expect(paragraph.children).toEqual(originalChildren)
  })

  test("should find paragraph even when non-paragraph elements follow it", () => {
    const node = h("li", [h("p", ["Text content"]), h("div", ["trailing div"])])

    maybeSpliceAndAppendBackArrow(node, mockBackArrow)

    // Paragraph should have favicon-span appended even though it's not the last child
    // "Text content" = 12 chars, textIndex = 8
    const paragraph = node.children[0] as Element
    expect(paragraph.children).toHaveLength(2)
    expect(paragraph.children[0]).toEqual({ type: "text", value: "Text con" })
    const faviconSpan = paragraph.children[1] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "tent" })
    expect(faviconSpan.children[1]).toBe(mockBackArrow)
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
    ["Textʼs header", "Text-s header"],
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

  test("should include footnote and fixDefinitionLists plugins when linkHeadings is disabled", () => {
    const plugin = GitHubFlavoredMarkdown({ linkHeadings: false })
    const { htmlPlugins } = getPlugins(plugin)
    expect(htmlPlugins).toHaveLength(2)
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

  test("should find back arrow in last paragraph when there are multiple paragraphs", () => {
    const backArrow = h("a", { className: "data-footnote-backref" }, ["↩"])
    const footnoteItem = h("li", { id: "user-content-fn-1" }, [
      h("p", ["First paragraph text."]),
      h("p", ["Second paragraph text.", backArrow]),
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

    // "Footnote text" = 13 chars, textIndex = 9
    const paragraph = footnoteItem.children[0] as Element
    expect(paragraph.children).toHaveLength(2) // shortened text + favicon-span
    expect(paragraph.children[0]).toEqual({ type: "text", value: "Footnote " })
    const faviconSpan = paragraph.children[1] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "text" })
    expect((faviconSpan.children[1] as Element).tagName).toBe("a")
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

    // "Hi" = 2 chars (< 4), textIndex = 0, text node removed, all text in favicon-span
    const paragraph = footnoteItem.children[0] as Element
    expect(paragraph.children).toHaveLength(1) // only favicon-span (text node removed)
    const faviconSpan = paragraph.children[0] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "Hi" })
    expect((faviconSpan.children[1] as Element).tagName).toBe("a")
  })

  test("should handle footnote with empty paragraph by appending arrow into it", () => {
    const backArrow = h("a", { className: "data-footnote-backref" }, ["↩"])
    const footnoteItem = h("li", { id: "user-content-fn-1" }, [h("p", [backArrow])])

    appendArrowToFootnoteListItemVisitor(footnoteItem)

    // Arrow appended into the now-empty paragraph
    expect(footnoteItem.children).toHaveLength(1)
    const p = footnoteItem.children[0] as Element
    expect(p.tagName).toBe("p")
    expect(p.children).toHaveLength(1)
    expect((p.children[0] as Element).tagName).toBe("a")
  })

  test("should handle table-only footnote by appending arrow into paragraph after table", () => {
    const backArrow = h("a", { className: "data-footnote-backref" }, ["↩"])
    const table = h("table", [h("tr", [h("td", ["cell"])])])
    const footnoteItem = h("li", { id: "user-content-fn-table" }, [table, h("p", [backArrow])])

    appendArrowToFootnoteListItemVisitor(footnoteItem)

    // Arrow appended into the now-empty paragraph after the table
    expect(footnoteItem.children).toHaveLength(2)
    expect((footnoteItem.children[0] as Element).tagName).toBe("table")
    const p = footnoteItem.children[1] as Element
    expect(p.tagName).toBe("p")
    expect(p.children).toHaveLength(1)
    expect((p.children[0] as Element).tagName).toBe("a")
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
    // " and more content." = 18 chars, textIndex = 14
    // original content (text, em, shortened text) + favicon-span
    expect(paragraph.children).toHaveLength(4)
    expect(paragraph.children[0]).toEqual({
      type: "text",
      value: "This is a complex footnote with ",
    })
    expect((paragraph.children[1] as Element).tagName).toBe("em")
    expect(paragraph.children[2]).toEqual({ type: "text", value: " and more cont" })
    const faviconSpan = paragraph.children[3] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "ent." })
    expect((faviconSpan.children[1] as Element).tagName).toBe("a")
  })

  test("should handle multi-paragraph footnote with back arrow in last paragraph", () => {
    const backArrow = h("a", { className: "data-footnote-backref" }, ["↩"])
    const footnoteItem = h("li", { id: "user-content-fn-1" }, [
      h("p", ["First paragraph."]),
      h("p", ["Second paragraph.", backArrow]),
    ])

    appendArrowToFootnoteListItemVisitor(footnoteItem)

    // First paragraph unchanged
    const firstParagraph = footnoteItem.children[0] as Element
    expect(firstParagraph.children).toHaveLength(1)
    expect(firstParagraph.children[0]).toEqual({ type: "text", value: "First paragraph." })

    // Second paragraph: "Second paragraph." = 17 chars, textIndex = 13
    const secondParagraph = footnoteItem.children[1] as Element
    expect(secondParagraph.children).toHaveLength(2)
    expect(secondParagraph.children[0]).toEqual({ type: "text", value: "Second paragr" })
    const faviconSpan = secondParagraph.children[1] as Element
    expect(faviconSpan).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: "favicon-span" },
    })
    expect(faviconSpan.children[0]).toEqual({ type: "text", value: "aph." })
    expect((faviconSpan.children[1] as Element).tagName).toBe("a")
  })
})

describe("adoptPrecedingSiblingAsDt", () => {
  it("adopts preceding <p> as <dt>", () => {
    const dl = h("dl", [h("dd", ["Def"])])
    const children: Element["children"] = [h("p", ["Term"]), dl]

    expect(adoptPrecedingSiblingAsDt(dl, 1, children)).toBe(true)
    expect(children).toHaveLength(1)
    expect((dl.children[0] as Element).tagName).toBe("dt")
    expect((dl.children[1] as Element).tagName).toBe("dd")
  })

  it("adopts past whitespace text nodes", () => {
    const dl = h("dl", [h("dd", ["Def"])])
    const children: Element["children"] = [h("p", ["Term"]), { type: "text", value: "\n" }, dl]

    expect(adoptPrecedingSiblingAsDt(dl, 2, children)).toBe(true)
    expect(children).toHaveLength(1) // <p> and whitespace removed
    expect((dl.children[0] as Element).tagName).toBe("dt")
  })

  it("returns false when no preceding element", () => {
    const dl = h("dl", [h("dd", ["Def"])])
    expect(adoptPrecedingSiblingAsDt(dl, 0, [dl])).toBe(false)
  })

  it("returns false when preceding element is not <p>", () => {
    const dl = h("dl", [h("dd", ["Def"])])
    const children: Element["children"] = [h("h2", ["Heading"]), dl]

    expect(adoptPrecedingSiblingAsDt(dl, 1, children)).toBe(false)
    expect(children).toHaveLength(2) // unchanged
  })
})

describe("htmlAccessibilityPlugin (integration)", () => {
  const runPlugin = (tree: Root): void => {
    const plugin = htmlAccessibilityPlugin()
    plugin(tree)
  }

  it("adopts preceding <p> as <dt> for orphaned <dl>", () => {
    const dl = h("dl", [h("dd", ["Def"])])
    const tree: Root = { type: "root", children: [h("p", ["Term"]), dl] }
    runPlugin(tree)

    expect(tree.children).toHaveLength(1)
    expect(dl.tagName).toBe("dl")
    expect((dl.children[0] as Element).tagName).toBe("dt")
    expect((dl.children[1] as Element).tagName).toBe("dd")
  })

  it("falls back to <div>/<p> when no preceding <p>", () => {
    const dl = h("dl", [h("dd", ["Orphan"])])
    const tree: Root = { type: "root", children: [dl] }
    runPlugin(tree)

    expect(dl.tagName).toBe("div")
    expect((dl.children[0] as Element).tagName).toBe("p")
  })

  it("preserves valid <dl> with <dt>/<dd> pairs", () => {
    const dl = h("dl", [h("dt", ["Term"]), h("dd", ["Desc"])])
    const tree: Root = { type: "root", children: [dl] }
    runPlugin(tree)

    expect(dl.tagName).toBe("dl")
    expect((dl.children[0] as Element).tagName).toBe("dt")
    expect((dl.children[1] as Element).tagName).toBe("dd")
  })

  it.each([
    ["dd", "dd"],
    ["dt", "dt"],
  ])("converts orphaned <%s> outside <dl> to <p>", (_label, tag) => {
    const element = h(tag, ["Orphaned content"])
    const tree: Root = { type: "root", children: [h("div", [element])] }
    runPlugin(tree)

    expect(element.tagName).toBe("p")
  })

  it("preserves <dd> inside valid <dl>", () => {
    const dd = h("dd", ["Valid description"])
    const dl = h("dl", [h("dt", ["Term"]), dd])
    const tree: Root = { type: "root", children: [dl] }
    runPlugin(tree)

    expect(dd.tagName).toBe("dd")
  })

  it("handles elements without children in orphaned dd/dt check", () => {
    const brokenNode = { type: "element" as const, tagName: "span", properties: {} } as Element
    const tree: Root = { type: "root", children: [brokenNode] }
    expect(() => runPlugin(tree)).not.toThrow()
  })

  it("handles multiple consecutive orphaned <dl>s, each adopting its own <p>", () => {
    const dl1 = h("dl", [h("dd", ["Def1"])])
    const dl2 = h("dl", [h("dd", ["Def2"])])
    const tree: Root = {
      type: "root",
      children: [h("p", ["Term1"]), dl1, h("p", ["Term2"]), dl2],
    }
    runPlugin(tree)

    expect(tree.children).toHaveLength(2)
    expect((dl1.children[0] as Element).tagName).toBe("dt")
    expect((dl2.children[0] as Element).tagName).toBe("dt")
  })

  it.each([
    ["with existing properties", false],
    ["without existing properties", true],
  ])("adds tabindex to pre elements %s", (_desc, deleteProperties) => {
    const pre = h("pre", [h("code", ["const x = 1"])])
    if (deleteProperties) {
      delete (pre as unknown as Record<string, unknown>).properties
    }
    const tree: Root = { type: "root", children: [pre] }
    runPlugin(tree)

    expect(pre.properties.tabIndex).toBe(0)
  })

  it.each([
    ["with existing properties", false],
    ["without existing properties", true],
  ])("adds tabindex to code elements inside pre %s", (_desc, deleteProperties) => {
    const code = h("code", { dataLanguage: "bibtex" }, ["@article{...}"])
    if (deleteProperties) {
      delete (code as unknown as Record<string, unknown>).properties
    }
    const pre = h("pre", [code])
    const tree: Root = { type: "root", children: [pre] }
    runPlugin(tree)

    expect(code.properties.tabIndex).toBe(0)
  })

  it.each([
    [
      "adds <track> to video without one",
      () => h("video", { controls: true }, [h("source", { src: "test.mp4", type: "video/mp4" })]),
      (el: Element) => {
        const track = el.children.find(
          (c) => c.type === "element" && c.tagName === "track",
        ) as Element
        expect(track).toBeDefined()
        expect(track.properties?.kind).toBe("captions")
        expect(track.properties?.src).toBe("data:text/vtt,WEBVTT")
      },
    ],
    [
      "does not add duplicate <track>",
      () =>
        h("video", { controls: true }, [
          h("source", { src: "test.mp4", type: "video/mp4" }),
          h("track", { kind: "captions", label: "No audio" }),
        ]),
      (el: Element) => {
        const tracks = el.children.filter((c) => c.type === "element" && c.tagName === "track")
        expect(tracks).toHaveLength(1)
      },
    ],
    [
      "skips non-video elements",
      () => h("div", ["content"]),
      (el: Element) => expect(el.children).toHaveLength(1),
    ],
  ] as [string, () => Element, (el: Element) => void][])(
    "video caption tracks: %s",
    (_desc, createElement, assert) => {
      const element = createElement()
      const tree: Root = { type: "root", children: [element] }
      runPlugin(tree)
      assert(element)
    },
  )

  it("adds tabindex, role, and aria-label to mermaid SVGs", () => {
    const svg = h("svg", { id: "mermaid-1234" }, [h("rect", {})])
    const tree: Root = { type: "root", children: [svg] }
    runPlugin(tree)

    expect(svg.properties?.tabIndex).toBe(0)
    expect(svg.properties?.role).toBe("img")
    expect(svg.properties?.ariaLabel).toBe("Mermaid diagram")
  })

  it("skips non-mermaid SVGs", () => {
    const svg = h("svg", { id: "icon-search" }, [h("path", {})])
    const tree: Root = { type: "root", children: [svg] }
    runPlugin(tree)

    expect(svg.properties?.tabIndex).toBeUndefined()
    expect(svg.properties?.role).toBeUndefined()
  })

  it("skips SVGs without id", () => {
    const svg = h("svg", {}, [h("path", {})])
    const tree: Root = { type: "root", children: [svg] }
    runPlugin(tree)

    expect(svg.properties?.role).toBeUndefined()
  })

  it("demotes dl with trailing dt to div", () => {
    const dl = h("dl", [h("dt", ["T1"]), h("dd", ["D1"]), h("dt", ["T2"])])
    const tree: Root = { type: "root", children: [dl] }
    runPlugin(tree)

    expect(dl.tagName).toBe("div")
  })

  it("demotes dl with invalid child to div", () => {
    const dl = h("dl", [h("dt", ["T"]), h("p", ["Invalid"]), h("dd", ["D"])])
    const tree: Root = { type: "root", children: [dl] }
    runPlugin(tree)

    expect(dl.tagName).toBe("div")
  })
})

describe("deduplicateSvgIds", () => {
  it("prefixes IDs in a single SVG", () => {
    const marker = h("marker", { id: "flowchart-pointEnd" })
    const svg = h("svg", [marker])
    const tree: Root = { type: "root", children: [svg] }
    deduplicateSvgIds(tree)

    expect(marker.properties?.id).toBe("svg-0-flowchart-pointEnd")
  })

  it("uses different prefixes for multiple SVGs", () => {
    const marker1 = h("marker", { id: "pointEnd" })
    const marker2 = h("marker", { id: "pointEnd" })
    const svg1 = h("svg", [marker1])
    const svg2 = h("svg", [marker2])
    const tree: Root = { type: "root", children: [svg1, svg2] }
    deduplicateSvgIds(tree)

    expect(marker1.properties?.id).toBe("svg-0-pointEnd")
    expect(marker2.properties?.id).toBe("svg-1-pointEnd")
  })

  it.each([
    [
      "href",
      () => {
        const use = h("use", { href: "#arrow" })
        return { svg: h("svg", [h("marker", { id: "arrow" }), use]), target: use }
      },
      (target: Element) => expect(target.properties?.href).toBe("#svg-0-arrow"),
    ],
    [
      "xlinkHref",
      () => {
        const rect: Element = {
          type: "element",
          tagName: "rect",
          properties: { xlinkHref: "#grad1" },
          children: [],
        }
        const svg: Element = {
          type: "element",
          tagName: "svg",
          properties: {},
          children: [h("linearGradient", { id: "grad1" }), rect],
        }
        return { svg, target: rect }
      },
      (target: Element) => expect(target.properties?.xlinkHref).toBe("#svg-0-grad1"),
    ],
    [
      "url(#id) in properties",
      () => {
        const rect = h("rect", { "clip-path": "url(#clip1)" })
        return { svg: h("svg", [h("clipPath", { id: "clip1" }), rect]), target: rect }
      },
      (target: Element) => expect(target.properties?.["clip-path"]).toBe("url(#svg-0-clip1)"),
    ],
  ] as [string, () => { svg: Element; target: Element }, (target: Element) => void][])(
    "updates %s references to prefixed IDs",
    (_desc, setup, assert) => {
      const { svg, target } = setup()
      const tree: Root = { type: "root", children: [svg] }
      deduplicateSvgIds(tree)
      assert(target)
    },
  )

  it.each([
    [
      "url(#id) in <style>",
      "clip1",
      ".cls { clip-path: url(#clip1); }",
      ".cls { clip-path: url(#svg-0-clip1); }",
    ],
    [
      "#id CSS selector in <style>",
      "myNode",
      "#myNode { fill: red; }",
      "#svg-0-myNode { fill: red; }",
    ],
  ])("updates %s text content", (_desc, id, cssInput, cssExpected) => {
    const style: Element = {
      type: "element",
      tagName: "style",
      properties: {},
      children: [{ type: "text", value: cssInput }],
    }
    const svg: Element = {
      type: "element",
      tagName: "svg",
      properties: {},
      children: [h("g", { id }), style],
    }
    const tree: Root = { type: "root", children: [svg] }
    deduplicateSvgIds(tree)

    expect((style.children[0] as { type: "text"; value: string }).value).toBe(cssExpected)
  })

  it("skips SVGs without any IDs", () => {
    const rect = h("rect", { width: 100, height: 50 })
    const svg = h("svg", [rect])
    const tree: Root = { type: "root", children: [svg] }
    deduplicateSvgIds(tree)

    // Should not modify anything
    expect(rect.properties?.width).toBe(100)
    expect(rect.properties?.id).toBeUndefined()
  })

  it("skips non-SVG elements", () => {
    const div = h("div", { id: "should-not-change" })
    const tree: Root = { type: "root", children: [div] }
    deduplicateSvgIds(tree)

    expect(div.properties?.id).toBe("should-not-change")
  })

  it.each([
    ["href", { href: "#unknown-ref" }, "href", "#unknown-ref"],
    ["url(#id)", { fill: "url(#unknown-gradient)" }, "fill", "url(#unknown-gradient)"],
  ])("leaves unmatched %s references unchanged", (_desc, props, key, expectedValue) => {
    const ref = h("rect", props)
    const svg = h("svg", [h("marker", { id: "arrow" }), ref])
    const tree: Root = { type: "root", children: [svg] }
    deduplicateSvgIds(tree)

    expect(ref.properties?.[key]).toBe(expectedValue)
  })

  it.each([
    [
      "non-text children of style elements",
      () => {
        const style: Element = {
          type: "element",
          tagName: "style",
          properties: {},
          children: [h("span", ["not text"])],
        }
        return h("svg", [h("g", { id: "myNode" }), style]) as unknown as Element
      },
    ],
    [
      "elements without properties",
      () => {
        const emptyElement = {
          type: "element" as const,
          tagName: "g",
          properties: undefined,
          children: [],
        } as unknown as Element
        return {
          type: "element",
          tagName: "svg",
          properties: {},
          children: [h("marker", { id: "arrow" }), emptyElement],
        } as Element
      },
    ],
  ] as [string, () => Element][])("handles %s without throwing", (_desc, createSvg) => {
    const tree: Root = { type: "root", children: [createSvg()] }
    expect(() => deduplicateSvgIds(tree)).not.toThrow()
  })

  it("leaves numeric property values unchanged", () => {
    const rect = h("rect", { id: "box", width: 100, height: 50 })
    const svg = h("svg", [h("marker", { id: "arrow" }), rect])
    const tree: Root = { type: "root", children: [svg] }
    deduplicateSvgIds(tree)

    expect(rect.properties?.width).toBe(100)
    expect(rect.properties?.height).toBe(50)
  })

  it.each([
    ["no url(#) content (plain CSS)", "myNode", ".cls { fill: red; }", [".cls { fill: red; }"]],
    [
      "mixed known/unknown url(#id) references",
      "knownId",
      ".cls { clip-path: url(#unknownId); fill: url(#knownId); }",
      ["url(#unknownId)", "url(#svg-0-knownId)"],
    ],
  ])("style elements: %s", (_desc, id, cssInput, expectedSubstrings) => {
    const style: Element = {
      type: "element",
      tagName: "style",
      properties: {},
      children: [{ type: "text", value: cssInput }],
    }
    const svg: Element = {
      type: "element",
      tagName: "svg",
      properties: {},
      children: [h("g", { id }), style],
    }
    const tree: Root = { type: "root", children: [svg] }
    deduplicateSvgIds(tree)

    const result = (style.children[0] as { type: "text"; value: string }).value
    for (const substring of expectedSubstrings) {
      expect(result).toContain(substring)
    }
  })
})

describe("isValidDlStructure", () => {
  it.each([
    ["valid dt/dd pair", [h("dt", ["Term"]), h("dd", ["Desc"])], true],
    [
      "multiple dt/dd pairs",
      [h("dt", ["T1"]), h("dd", ["D1"]), h("dt", ["T2"]), h("dd", ["D2"])],
      true,
    ],
    ["multiple dd after one dt", [h("dt", ["Term"]), h("dd", ["D1"]), h("dd", ["D2"])], true],
    ["orphaned dd (no preceding dt)", [h("dd", ["Orphan"])], false],
    ["trailing dt without dd", [h("dt", ["Term"])], false],
    ["valid pair + trailing dt", [h("dt", ["T1"]), h("dd", ["D1"]), h("dt", ["T2"])], false],
    ["invalid child element (p)", [h("dt", ["T"]), h("p", ["Bad"]), h("dd", ["D"])], false],
    ["dt interrupted by div before dd", [h("dt", ["T"]), h("div", ["Mid"]), h("dd", ["D"])], false],
    ["empty children", [], false],
    [
      "text nodes between dt and dd (valid)",
      [h("dt", ["T"]), { type: "text" as const, value: "\n" }, h("dd", ["D"])],
      true,
    ],
    ["dd after div (orphaned)", [h("div", ["X"]), h("dd", ["D"])], false],
  ])("%s → %s", (_desc, children, expected) => {
    expect(isValidDlStructure(children)).toBe(expected)
  })
})

describe("ensureHeadingLinksHaveAccessibleNames", () => {
  const runPlugin = (tree: Root): void => {
    const fn = ensureHeadingLinksHaveAccessibleNames()
    fn(tree)
  }

  it("adds aria-label from KaTeX annotation to heading link with no direct text", () => {
    const link = h("a", { href: "#math-heading" }, [
      h("span", { className: ["katex"] }, [
        h("span", { className: ["katex-mathml"] }, [
          h("semantics", [h("annotation", { encoding: "application/x-tex" }, ["E = mc^2"])]),
        ]),
      ]),
    ])
    const heading = h("h2", { id: "math-heading" }, [link])
    const tree: Root = { type: "root", children: [heading] }
    runPlugin(tree)

    expect(link.properties?.ariaLabel).toBe("E = mc^2")
  })

  it("skips heading links with direct text content", () => {
    const link = h("a", { href: "#text-heading" }, ["Regular text heading"])
    const heading = h("h2", { id: "text-heading" }, [link])
    const tree: Root = { type: "root", children: [heading] }
    runPlugin(tree)

    expect(link.properties?.ariaLabel).toBeUndefined()
  })

  it("skips headings without links", () => {
    const heading = h("h2", { id: "no-link" }, ["Just text"])
    const tree: Root = { type: "root", children: [heading] }
    expect(() => runPlugin(tree)).not.toThrow()
  })

  it("falls back to heading id when no annotation found", () => {
    const link = h("a", { href: "#e-mc2" }, [
      h("span", { className: ["katex"] }, [h("span", { className: ["katex-html"] })]),
    ])
    const heading = h("h2", { id: "e-mc2" }, [link])
    const tree: Root = { type: "root", children: [heading] }
    runPlugin(tree)

    expect(link.properties?.ariaLabel).toBe("e mc2")
  })

  it("falls back to 'heading' when id is empty", () => {
    const link = h("a", { href: "#" }, [h("span", ["no text content"])])
    const heading = h("h2", {}, [link])
    const tree: Root = { type: "root", children: [heading] }
    runPlugin(tree)

    expect(link.properties?.ariaLabel).toBe("heading")
  })

  it("skips non-heading elements", () => {
    const link = h("a", { href: "#something" }, [h("span", ["no text"])])
    const paragraph = h("p", [link])
    const tree: Root = { type: "root", children: [paragraph] }
    runPlugin(tree)

    expect(link.properties?.ariaLabel).toBeUndefined()
  })

  it("handles link without properties object", () => {
    const link: Element = {
      type: "element",
      tagName: "a",
      properties: undefined as unknown as Element["properties"],
      children: [h("span", ["katex content"])],
    }
    const heading = h("h2", { id: "test-heading" }, [link])
    const tree: Root = { type: "root", children: [heading] }
    runPlugin(tree)

    expect(link.properties?.ariaLabel).toBe("test heading")
  })

  it("skips annotations with empty text", () => {
    const link = h("a", { href: "#math" }, [
      h("span", { className: ["katex"] }, [
        h("semantics", [h("annotation", { encoding: "application/x-tex" }, [""])]),
      ]),
    ])
    const heading = h("h2", { id: "math" }, [link])
    const tree: Root = { type: "root", children: [heading] }
    runPlugin(tree)

    expect(link.properties?.ariaLabel).toBe("math")
  })
})
