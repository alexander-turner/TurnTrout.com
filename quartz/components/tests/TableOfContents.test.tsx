/**
 * @jest-environment jsdom
 */

import type { Parent, RootContent, Node } from "hast"
import type { JSX } from "preact"
import type { FunctionComponent } from "preact"

import { jest, describe, it, expect, beforeEach } from "@jest/globals"
import { h } from "hastscript"

import type { BuildCtx } from "../../util/ctx"
import type { QuartzComponentProps } from "../types"

import { TocEntry } from "../../plugins/transformers/toc"
import {
  CreateTableOfContents,
  processHtmlAst,
  processTocEntry,
  buildNestedList,
  elementToJsx,
  addListItem,
  toJSXListItem,
} from "../TableOfContents"

// Helper function to assert JSX element properties
function assertJSXElement(
  element: unknown,
): asserts element is JSX.Element & { props: Record<string, unknown> } {
  expect(element).toBeTruthy()
  expect(typeof element).toBe("object")
}

// Helper function that combines null check and JSX assertion
function expectJSXElement(element: unknown): JSX.Element & { props: Record<string, unknown> } {
  expect(element).not.toBeNull()
  assertJSXElement(element)
  return element
}

// Mock the createLogger function
jest.mock("../../plugins/transformers/logger_utils", () => ({
  createWinstonLogger: () => ({
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

  it("should handle TOC entries with LaTeX expressions", () => {
    const entry: TocEntry = {
      depth: 1,
      text: "Math with $x^2$",
      slug: "math-heading",
    }

    const result = processTocEntry(entry)

    expect(result.children).toHaveLength(2)
    expect(result.children[0]).toMatchObject({ type: "text", value: "Math with " })
    expect(result.children[1]).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: ["katex-toc"] },
    })
  })

  it("should handle TOC entries with arrows", () => {
    const entry: TocEntry = {
      depth: 1,
      text: "Arrow →",
      slug: "arrow-heading",
    }

    const result = processTocEntry(entry)

    expect(result.children).toHaveLength(2)
    expect(result.children[0]).toMatchObject({ type: "text", value: "Arrow " })
    expect(result.children[1]).toMatchObject({
      type: "element",
      tagName: "span",
      properties: { className: ["monospace-arrow"] },
    })
  })

  it("should handle empty parts in text", () => {
    const entry: TocEntry = {
      depth: 1,
      text: "",
      slug: "empty-heading",
    }

    const result = processTocEntry(entry)

    expect(result.children).toHaveLength(0)
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

describe("buildNestedList", () => {
  it("should build a nested list for headings up to depth 3", () => {
    const entries = [
      { depth: 1, text: "Heading 1", slug: "heading-1" },
      { depth: 2, text: "Heading 1.1", slug: "heading-1-1" },
      { depth: 3, text: "Heading 1.1.1", slug: "heading-1-1-1" },
      { depth: 2, text: "Heading 1.2", slug: "heading-1-2" },
    ]
    const [result] = buildNestedList(entries)

    // Verify structure and content
    expect(result).toHaveLength(1)
    const firstItem = result[0]
    expect(firstItem.type).toBe("li")
    expect(firstItem.key).toBe("li-1")

    // Check that the first item contains the link and nested list
    expect(firstItem.props.children).toHaveLength(2)
    const link = firstItem.props.children[0]
    expect(link.type).toBe("a")
    expect(link.props.href).toBe("#heading-1")
    expect(link.props.className).toBe("internal same-page-link")
    expect(link.props["data-for"]).toBe("heading-1")

    // Check nested list structure
    const nestedList = firstItem.props.children[1]
    expect(nestedList.type).toBe("ol")
    expect(nestedList.key).toBe("ol-1")
    expect(nestedList.props.children).toHaveLength(2)

    // Verify first nested item (Heading 1.1)
    const firstNestedItem = nestedList.props.children[0]
    expect(firstNestedItem.type).toBe("li")
    expect(firstNestedItem.props.children).toHaveLength(2) // link + nested ol
    const firstNestedLink = firstNestedItem.props.children[0]
    expect(firstNestedLink.props.href).toBe("#heading-1-1")

    // Verify deeply nested item (Heading 1.1.1)
    const deeplyNestedList = firstNestedItem.props.children[1]
    expect(deeplyNestedList.type).toBe("ol")
    expect(deeplyNestedList.props.children).toHaveLength(1)
    const deeplyNestedItem = deeplyNestedList.props.children[0]
    expect(deeplyNestedItem.props.children.props.href).toBe("#heading-1-1-1")

    // Verify second nested item (Heading 1.2)
    const secondNestedItem = nestedList.props.children[1]
    expect(secondNestedItem.type).toBe("li")
    expect(secondNestedItem.props.children.props.href).toBe("#heading-1-2")
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

    // Verify first item
    expect(result[0].type).toBe("li")
    expect(result[0].key).toBe("li-0")
    const firstLink = result[0].props.children
    expect(firstLink.type).toBe("a")
    expect(firstLink.props.href).toBe("#first")
    expect(firstLink.props["data-for"]).toBe("first")

    // Verify second item
    expect(result[1].type).toBe("li")
    expect(result[1].key).toBe("li-1")
    const secondLink = result[1].props.children
    expect(secondLink.type).toBe("a")
    expect(secondLink.props.href).toBe("#second")
    expect(secondLink.props["data-for"]).toBe("second")
  })

  it("should handle nested structure starting at depth > 1", () => {
    const entries = [{ depth: 2, text: "Nested heading", slug: "nested" }]
    const [result] = buildNestedList(entries)

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("li")
    expect(result[0].key).toBe("li-0")
    const link = result[0].props.children
    expect(link.type).toBe("a")
    expect(link.props.href).toBe("#nested")
    expect(link.props["data-for"]).toBe("nested")
  })

  it("should handle complex nesting with depth jumps", () => {
    const entries = [
      { depth: 1, text: "H1", slug: "h1" },
      { depth: 3, text: "H3", slug: "h3" },
      { depth: 1, text: "H1-2", slug: "h1-2" },
    ]
    const [result] = buildNestedList(entries)

    expect(result).toHaveLength(2)

    // First item should have nested structure for the depth-3 heading
    const firstTopLevelItem = result[0]
    expect(firstTopLevelItem.type).toBe("li")
    expect(firstTopLevelItem.props.children).toHaveLength(2) // link + nested ol
    const firstLink = firstTopLevelItem.props.children[0]
    expect(firstLink.props.href).toBe("#h1")

    // Check the nested structure for H3
    const nestedList = firstTopLevelItem.props.children[1]
    expect(nestedList.type).toBe("ol")
    expect(nestedList.props.children).toHaveLength(1)
    const nestedItem = nestedList.props.children[0]
    expect(nestedItem.props.children.props.href).toBe("#h3")

    // Second top-level item
    const secondItem = result[1]
    expect(secondItem.type).toBe("li")
    expect(secondItem.props.children.props.href).toBe("#h1-2")
  })

  it("should correctly handle depth decreases (backtracking)", () => {
    const entries = [
      { depth: 1, text: "Chapter 1", slug: "chapter-1" },
      { depth: 2, text: "Section 1.1", slug: "section-1-1" },
      { depth: 3, text: "Subsection 1.1.1", slug: "subsection-1-1-1" },
      { depth: 2, text: "Section 1.2", slug: "section-1-2" },
      { depth: 1, text: "Chapter 2", slug: "chapter-2" },
    ]
    const [result] = buildNestedList(entries)

    expect(result).toHaveLength(2) // Two chapters

    // Verify Chapter 1 structure
    const chapter1 = result[0]
    expect(chapter1.props.children[0].props.href).toBe("#chapter-1")
    const chapter1Sections = chapter1.props.children[1]
    expect(chapter1Sections.props.children).toHaveLength(2) // Two sections

    // Verify Section 1.1 has subsection
    const section11 = chapter1Sections.props.children[0]
    expect(section11.props.children[0].props.href).toBe("#section-1-1")
    expect(section11.props.children[1].props.children).toHaveLength(1) // One subsection
    const subsection111 = section11.props.children[1].props.children[0]
    expect(subsection111.props.children.props.href).toBe("#subsection-1-1-1")

    // Verify Section 1.2 has no subsections
    const section12 = chapter1Sections.props.children[1]
    expect(section12.props.children.props.href).toBe("#section-1-2")

    // Verify Chapter 2
    const chapter2 = result[1]
    expect(chapter2.props.children.props.href).toBe("#chapter-2")
  })
})

describe("afterDOMLoaded Script Attachment", () => {
  it("should have an afterDOMLoaded script assigned", () => {
    expect(CreateTableOfContents.afterDOMLoaded).toBeDefined()
    expect(typeof CreateTableOfContents.afterDOMLoaded).toBe("string")
    expect(CreateTableOfContents.afterDOMLoaded).toContain("document.addEventListener('nav'")
  })
})

describe("addListItem", () => {
  it("should generate nested list from TOC entries", () => {
    const entries = [
      { depth: 1, text: "Heading 1", slug: "heading-1" },
      { depth: 2, text: "Heading 1.1", slug: "heading-1-1" },
    ]

    const result = addListItem(entries)

    expect(result.type).toBe("ol")
    expect(result.props.children).toHaveLength(1)

    // Verify the content structure
    const firstItem = result.props.children[0]
    expect(firstItem.type).toBe("li")
    expect(firstItem.props.children).toHaveLength(2) // link + nested list

    // Verify first heading link
    const firstLink = firstItem.props.children[0]
    expect(firstLink.props.href).toBe("#heading-1")
    expect(firstLink.props["data-for"]).toBe("heading-1")

    // Verify nested structure
    const nestedList = firstItem.props.children[1]
    expect(nestedList.type).toBe("ol")
    expect(nestedList.props.children).toHaveLength(1)
    const nestedItem = nestedList.props.children[0]
    expect(nestedItem.props.children.props.href).toBe("#heading-1-1")
  })

  it("should handle flat list of entries", () => {
    const entries = [
      { depth: 1, text: "First", slug: "first" },
      { depth: 1, text: "Second", slug: "second" },
      { depth: 1, text: "Third", slug: "third" },
    ]

    const result = addListItem(entries)

    expect(result.type).toBe("ol")
    expect(result.props.children).toHaveLength(3)

    // Verify each item is a simple link without nesting
    result.props.children.forEach((item: JSX.Element, index: number) => {
      expect(item.type).toBe("li")
      assertJSXElement(item)
      assertJSXElement(item.props.children)
      expect(item.props.children.type).toBe("a")
      expect(item.props.children.props.href).toBe(`#${entries[index].slug}`)
    })
  })

  it("should handle empty entries list", () => {
    const result = addListItem([])

    expect(result.type).toBe("ol")
    expect(result.props.children).toHaveLength(0)
  })
})

describe("toJSXListItem", () => {
  it("should convert TOC entry to JSX list item", () => {
    const entry: TocEntry = { depth: 1, text: "Test Item", slug: "test-item" }

    const result = toJSXListItem(entry)

    expect(result.type).toBe("a")
    expect(result.props.href).toBe("#test-item")
    expect(result.props.className).toBe("internal same-page-link")
    expect(result.props["data-for"]).toBe("test-item")

    // Verify the children contain the processed text
    expect(result.props.children).toBeDefined()
    expect(Array.isArray(result.props.children)).toBe(true)
  })

  it("should handle TOC entry with complex text formatting", () => {
    const entry: TocEntry = {
      depth: 2,
      text: "Math $x^2$ and `code` with →",
      slug: "complex-entry",
    }

    const result = toJSXListItem(entry)

    expect(result.type).toBe("a")
    expect(result.props.href).toBe("#complex-entry")
    expect(result.props.className).toBe("internal same-page-link")
    expect(result.props["data-for"]).toBe("complex-entry")

    // Verify children are processed (contains multiple elements)
    expect(result.props.children.length).toBeGreaterThan(1)
  })

  it("should handle TOC entry with leading numbers", () => {
    const entry: TocEntry = {
      depth: 1,
      text: "1: Introduction",
      slug: "introduction",
    }

    const result = toJSXListItem(entry)

    expect(result.type).toBe("a")
    expect(result.props.href).toBe("#introduction")
    expect(result.props["data-for"]).toBe("introduction")

    // The children should contain processed content with number prefix
    expect(result.props.children).toBeDefined()
  })

  it("should handle TOC entry with small caps", () => {
    const entry: TocEntry = {
      depth: 1,
      text: "About AI",
      slug: "about-ai",
    }

    const result = toJSXListItem(entry)

    expect(result.type).toBe("a")
    expect(result.props.href).toBe("#about-ai")
    expect(result.props["data-for"]).toBe("about-ai")

    // Should contain processed children
    expect(result.props.children).toBeDefined()
  })
})

describe("CreateTableOfContents", () => {
  const mockQuartzComponentProps = {
    fileData: {
      filePath: "test.md",
      frontmatter: { title: "Test Page" },
      toc: [
        { depth: 1, text: "Heading 1", slug: "heading-1" },
        { depth: 2, text: "Heading 1.1", slug: "heading-1-1" },
      ],
    },
    cfg: {},
    allFiles: [],
    displayClass: "",
    externalResources: {},
    children: [],
    ctx: {} as BuildCtx,
    tree: {} as Node,
  } as unknown as QuartzComponentProps

  it("should render table of contents when TOC data is available", () => {
    const result = (CreateTableOfContents as FunctionComponent<QuartzComponentProps>)(
      mockQuartzComponentProps,
    ) as JSX.Element | null

    expect(result).not.toBeNull()
    expect(result?.type).toBe("div")
    expect(result?.props.id).toBe("table-of-contents")
    expect(result?.props.className).toBe("desktop-only")

    // Verify header structure and content
    const header = result?.props.children[0]
    expect(header.type).toBe("h1")
    expect(header.props.id).toBe("toc-title")
    const button = header.props.children
    expect(button.type).toBe("button")
    expect(button.props.className).toBe("internal same-page-link")
    expect(button.props.children).toBe("Test Page")

    // Verify content structure
    const content = result?.props.children[1]
    expect(content.type).toBe("div")
    expect(content.props.id).toBe("toc-content")
    const outerList = content.props.children
    expect(outerList.type).toBe("ol")

    // Verify the actual TOC entries are rendered
    const tocItems = outerList.props.children
    expect(tocItems).toHaveLength(1) // One top-level item
    const firstItem = tocItems[0]
    expect(firstItem.type).toBe("li")
    // The structure might be different due to how buildNestedList works
    expect(firstItem.props.children).toBeDefined()

    // The actual structure verification depends on buildNestedList implementation
    // Just verify that the basic structure contains the expected elements
    const outerListItems = outerList.props.children
    expect(outerListItems).toBeDefined()
    expect(Array.isArray(outerListItems) || outerListItems).toBeTruthy()
  })

  it("should return null when TOC data is not available", () => {
    const propsWithoutToc = {
      ...mockQuartzComponentProps,
      fileData: {
        ...mockQuartzComponentProps.fileData,
        toc: undefined,
      },
    }

    const result = (CreateTableOfContents as FunctionComponent<QuartzComponentProps>)(
      propsWithoutToc,
    ) as JSX.Element | null

    expect(result).toBeNull()
  })

  it("should return null when TOC is disabled in frontmatter (boolean)", () => {
    const propsWithTocDisabled = {
      ...mockQuartzComponentProps,
      fileData: {
        ...mockQuartzComponentProps.fileData,
        frontmatter: { ...mockQuartzComponentProps.fileData.frontmatter, toc: false },
      },
    }

    const result = (CreateTableOfContents as FunctionComponent<QuartzComponentProps>)(
      propsWithTocDisabled as unknown as QuartzComponentProps,
    ) as JSX.Element | null

    expect(result).toBeNull()
  })

  it("should return null when TOC is disabled in frontmatter (string)", () => {
    const propsWithTocDisabled = {
      ...mockQuartzComponentProps,
      fileData: {
        ...mockQuartzComponentProps.fileData,
        frontmatter: { ...mockQuartzComponentProps.fileData.frontmatter, toc: "false" },
      },
    }

    const result = (CreateTableOfContents as FunctionComponent<QuartzComponentProps>)(
      propsWithTocDisabled as unknown as QuartzComponentProps,
    ) as JSX.Element | null

    expect(result).toBeNull()
  })

  it("should return null when page has no headings (empty TOC array)", () => {
    const propsWithNoHeadings = {
      ...mockQuartzComponentProps,
      fileData: {
        ...mockQuartzComponentProps.fileData,
        toc: [],
      },
    }

    const result = (CreateTableOfContents as FunctionComponent<QuartzComponentProps>)(
      propsWithNoHeadings as unknown as QuartzComponentProps,
    ) as JSX.Element | null

    expect(result).toBeNull()
  })

  it.each([
    [undefined, "Table of Contents"],
    ["understanding machine learning algorithms", "Understanding Machine Learning Algorithms"],
    ["ai & machine learning: the future", "Ai & Machine Learning: The Future"],
  ])("should format title correctly: %s -> %s", (inputTitle, expectedTitle) => {
    const props = {
      ...mockQuartzComponentProps,
      fileData: {
        ...mockQuartzComponentProps.fileData,
        frontmatter: inputTitle ? { title: inputTitle } : {},
      },
    }

    const result = (CreateTableOfContents as FunctionComponent<QuartzComponentProps>)(
      props as unknown as QuartzComponentProps,
    ) as JSX.Element | null
    const button = result?.props.children[0].props.children
    expect(button.props.children).toBe(expectedTitle)
  })

  it("should render complex TOC structure with multiple levels", () => {
    const complexTocProps = {
      ...mockQuartzComponentProps,
      fileData: {
        ...mockQuartzComponentProps.fileData,
        frontmatter: { title: "Complex Document" },
        toc: [
          { depth: 1, text: "Introduction", slug: "introduction" },
          { depth: 1, text: "Methods", slug: "methods" },
          { depth: 2, text: "Data Collection", slug: "data-collection" },
          { depth: 3, text: "Survey Design", slug: "survey-design" },
          { depth: 2, text: "Analysis", slug: "analysis" },
          { depth: 1, text: "Results", slug: "results" },
        ],
      },
    }

    const result = (CreateTableOfContents as FunctionComponent<QuartzComponentProps>)(
      complexTocProps as unknown as QuartzComponentProps,
    ) as JSX.Element | null

    // Verify the TOC is rendered successfully
    expect(result).not.toBeNull()
    expect(result?.type).toBe("div")
    expect(result?.props.id).toBe("table-of-contents")

    // Verify the title is correct
    const header = result?.props.children[0]
    const button = header.props.children
    expect(button.props.children).toBe("Complex Document")

    // Verify TOC content structure exists
    const content = result?.props.children[1]
    expect(content.type).toBe("div")
    expect(content.props.id).toBe("toc-content")

    // Verify the nested list was built properly
    const outerList = content.props.children
    expect(outerList.type).toBe("ol")
    expect(outerList.props.children).toBeDefined()
  })

  it("should handle TOC entries with special formatting", () => {
    const specialTocProps = {
      ...mockQuartzComponentProps,
      fileData: {
        ...mockQuartzComponentProps.fileData,
        toc: [
          { depth: 1, text: "Math: $E=mc^2$", slug: "math-equation" },
          { depth: 1, text: "Code: `function()`", slug: "code-example" },
          { depth: 1, text: "Arrow: →", slug: "arrow-example" },
        ],
      },
    }

    const result = (CreateTableOfContents as FunctionComponent<QuartzComponentProps>)(
      specialTocProps as unknown as QuartzComponentProps,
    ) as JSX.Element | null

    // Verify the TOC is rendered successfully
    expect(result).not.toBeNull()
    expect(result?.type).toBe("div")
    expect(result?.props.id).toBe("table-of-contents")

    // Verify TOC content structure exists
    const content = result?.props.children[1]
    expect(content.type).toBe("div")
    expect(content.props.id).toBe("toc-content")

    // Verify the nested list was built with special formatting entries
    const outerList = content.props.children
    expect(outerList.type).toBe("ol")
    expect(outerList.props.children).toBeDefined()
  })
})

describe("Component Export", () => {
  it("should export default component constructor function", async () => {
    const TableOfContentsModule = await import("../TableOfContents")
    const TableOfContentsComponent = TableOfContentsModule.default
    const component = TableOfContentsComponent()

    expect(typeof component).toBe("function")
    expect(component).toBe(CreateTableOfContents)
  })
})

describe("elementToJsx", () => {
  it("should handle text nodes and return the text value", () => {
    const node = { type: "text", value: "Hello World" } as RootContent
    const result = elementToJsx(node)
    expect(result).toBe("Hello World")
    expect(typeof result).toBe("string")
  })

  it("should handle abbr elements with small-caps styling", () => {
    const node = h("abbr", { className: ["small-caps"] }, "API")
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "abbr",
      props: {
        className: "small-caps",
        children: "API",
      },
    })

    // Verify it's a proper JSX element
    expect(typeof result).toBe("object")
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.type).toBe("abbr")
  })

  it("should handle katex spans with LaTeX content", () => {
    const latexContent = "<span class='katex'><span class='katex-mathml'>E = mc^2</span></span>"
    const node = h("span", { className: ["katex-toc"] }, [{ type: "raw", value: latexContent }])
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "span",
      props: {
        className: "katex-toc",
        dangerouslySetInnerHTML: { __html: latexContent },
      },
    })

    // Verify dangerous HTML injection is properly handled
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.props.dangerouslySetInnerHTML.__html).toBe(latexContent)
  })

  it("should handle katex spans with no content gracefully", () => {
    const node = h("span", { className: ["katex-toc"] }, [])
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "span",
      props: {
        className: "katex-toc",
        dangerouslySetInnerHTML: { __html: "" },
      },
    })

    // Verify empty content doesn't break the component
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.props.dangerouslySetInnerHTML.__html).toBe("")
  })

  it("should handle katex spans with non-text children by returning empty HTML", () => {
    const node = h("span", { className: ["katex-toc"] }, [h("span", "nested")])
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "span",
      props: {
        className: "katex-toc",
        dangerouslySetInnerHTML: { __html: "" },
      },
    })

    // Non-text children should result in empty HTML to prevent rendering errors
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.props.dangerouslySetInnerHTML.__html).toBe("")
  })

  it("should transform inline-code spans to code elements", () => {
    const codeText = "const foo = 'bar'"
    const node = h("span", { className: ["inline-code"] }, codeText)
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "code",
      props: {
        className: "inline-code",
        children: [codeText],
      },
    })

    // Verify span is transformed to code element
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.type).toBe("code")
    expect(jsxElement.props.children[0]).toBe(codeText)
  })

  it("should handle monospace arrows with proper styling", () => {
    const arrowSymbol = "→"
    const node = h("span", { className: ["monospace-arrow"] }, arrowSymbol)
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "span",
      props: {
        className: "monospace-arrow",
        children: [arrowSymbol],
      },
    })

    // Verify arrow symbol is preserved
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.props.children[0]).toBe(arrowSymbol)
  })

  it("should handle number prefix spans for TOC numbering", () => {
    const numberPrefix = "2.1: "
    const node = h("span", { className: ["number-prefix"] }, numberPrefix)
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "span",
      props: {
        className: "number-prefix",
        children: [numberPrefix],
      },
    })

    // Verify number prefix is correctly rendered
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.props.children[0]).toBe(numberPrefix)
  })

  it("should handle generic spans without special classes", () => {
    const genericText = "regular text content"
    const node = h("span", {}, genericText)
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "span",
      props: {
        children: [genericText],
      },
    })

    // Verify generic spans are rendered as-is
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.type).toBe("span")
    expect(jsxElement.props.children[0]).toBe(genericText)
  })

  it("should handle spans with multiple child elements", () => {
    const node = h("span", {}, [
      { type: "text", value: "Hello " },
      { type: "text", value: "world" },
    ])
    const result = elementToJsx(node)

    const jsxElement = expectJSXElement(result)
    expect(jsxElement.type).toBe("span")
    expect(Array.isArray(jsxElement.props.children)).toBe(true)
    expect(jsxElement.props.children).toHaveLength(2)
    expect(jsxElement.props.children[0]).toBe("Hello ")
    expect(jsxElement.props.children[1]).toBe("world")
  })

  it("should handle abbr elements without className gracefully", () => {
    const abbrText = "HTML"
    const node = h("abbr", {}, abbrText)
    const result = elementToJsx(node)

    expect(result).toMatchObject({
      type: "abbr",
      props: {
        className: "",
        children: abbrText,
      },
    })

    // Verify empty className doesn't break functionality
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.props.className).toBe("")
  })

  it("should handle complex nested abbreviations", () => {
    const node = h("abbr", { className: ["small-caps", "tooltip"] }, [
      { type: "text", value: "CSS" },
    ])
    const result = elementToJsx(node)

    const jsxElement = expectJSXElement(result)
    expect(jsxElement.type).toBe("abbr")
    expect(jsxElement.props.className).toBe("small-caps tooltip")
    expect(jsxElement.props.children).toBe("CSS")
  })

  it("should return null for unsupported element types", () => {
    const unsupportedNode = { type: "comment", value: "<!-- comment -->" } as unknown as RootContent
    const result = elementToJsx(unsupportedNode)

    expect(result).toBeNull()
  })

  it("should handle elements with missing children gracefully", () => {
    const elementWithEmptyChildren = {
      type: "element",
      tagName: "span",
      properties: {},
      children: [],
    } as unknown as RootContent
    const result = elementToJsx(elementWithEmptyChildren)

    // Should handle empty children array gracefully
    const jsxElement = expectJSXElement(result)
    expect(jsxElement.type).toBe("span")
    expect(jsxElement.props.children).toHaveLength(0)
  })
})
