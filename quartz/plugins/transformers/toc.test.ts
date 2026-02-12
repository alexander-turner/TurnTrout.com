import type { Node } from "hast"
import type { Root, Text, InlineCode, Code, Link, Emphasis, Blockquote, Paragraph } from "mdast"

import { describe, expect, it } from "@jest/globals"

import type { BuildCtx } from "../../util/ctx"

import { normalizeNbsp } from "../../components/constants"
import { customToString, stripHtmlTagsFromString, TableOfContents, type TocEntry } from "./toc"

// Type definitions for test objects
type MockFile = {
  path?: string
  data: {
    frontmatter?: Record<string, unknown>
    toc?: TocEntry[]
    collapseToc?: boolean
  }
}

type ProcessorFunction = (tree: Root, file: MockFile) => void

const createNode = <T extends { type: string }>(type: T["type"], props: Omit<T, "type">): T =>
  ({
    type,
    ...props,
  }) as T

// Helper functions for creating MDAST nodes
const createHeading = (depth: 1 | 2 | 3 | 4 | 5 | 6, children: Array<Text | InlineCode>) =>
  createNode<import("mdast").Heading>("heading", { depth, children })

const createText = (value: string) => createNode<Text>("text", { value })

const createInlineCode = (value: string) => createNode<InlineCode>("inlineCode", { value })

const createRoot = (children: Root["children"]) => createNode<Root>("root", { children })

const createFootnoteDefinition = (identifier: string) =>
  createNode<import("mdast").FootnoteDefinition>("footnoteDefinition", { identifier, children: [] })

const createParagraph = (children: Paragraph["children"]) =>
  createNode<Paragraph>("paragraph", { children })

const createBlockquote = (children: Blockquote["children"]) =>
  createNode<Blockquote>("blockquote", { children })

describe("customToString", () => {
  it.each([
    ["text", createNode<Text>("text", { value: "Hello world" }), "Hello world"],
    ["inlineCode", createNode<InlineCode>("inlineCode", { value: "const x = 1" }), "`const x = 1`"],
    [
      "code",
      createNode<Code>("code", { value: "function test() {}", lang: "js" }),
      "`function test() {}`",
    ],
    [
      "link",
      createNode<Link>("link", {
        url: "https://example.com",
        children: [createNode<Text>("text", { value: "Link text" })],
      }),
      "Link text",
    ],
    [
      "emphasis",
      createNode<Emphasis>("emphasis", {
        children: [createNode<Text>("text", { value: "emphasized text" })],
      }),
      "emphasized text",
    ],
  ])("handles %s nodes", (_, node, expected) => {
    expect(customToString(node)).toBe(expected)
  })

  describe("math nodes", () => {
    it("handles inlineMath nodes", () => {
      const mathNode = { type: "inlineMath", value: "x = y + z" } as Node
      expect(customToString(mathNode)).toBe("$x = y + z$")
    })

    it("handles math block nodes", () => {
      const mathNode = { type: "math", value: "\\sum_{i=1}^{n} x_i" } as Node
      expect(customToString(mathNode)).toBe("$$\\sum_{i=1}^{n} x_i$$")
    })
  })

  describe("nested children", () => {
    it("handles nodes with multiple nested children", () => {
      const complexNode = createNode<Emphasis>("emphasis", {
        children: [
          createNode<Text>("text", { value: "Start " }),
          createNode<InlineCode>("inlineCode", { value: "code" }),
          createNode<Text>("text", { value: " end" }),
        ],
      })
      expect(customToString(complexNode)).toBe("Start `code` end")
    })

    it("handles deeply nested structures", () => {
      const deeplyNested = createNode<Link>("link", {
        url: "https://example.com",
        children: [
          createNode<Emphasis>("emphasis", {
            children: [
              createNode<Text>("text", { value: "Nested " }),
              createNode<InlineCode>("inlineCode", { value: "emphasized code" }),
            ],
          }),
        ],
      })
      expect(customToString(deeplyNested)).toBe("Nested `emphasized code`")
    })
  })

  describe("edge cases", () => {
    it("handles nodes without value property", () => {
      const nodeWithoutValue = { type: "unknown" } as Node
      expect(customToString(nodeWithoutValue)).toBe("")
    })

    it("handles nodes with empty value", () => {
      const emptyValueNode = { type: "text", value: "" } as Node
      expect(customToString(emptyValueNode)).toBe("")
    })

    it("handles nodes with null/undefined value", () => {
      const nullValueNode = { type: "text", value: null } as Node
      expect(customToString(nullValueNode)).toBe("null")

      const undefinedValueNode = { type: "text", value: undefined } as Node
      expect(customToString(undefinedValueNode)).toBe("undefined")
    })

    it("handles nodes with numeric value", () => {
      const numericNode = { type: "text", value: 42 } as Node
      expect(customToString(numericNode)).toBe("42")
    })

    it("handles empty children array", () => {
      const emptyChildrenNode = createNode<Emphasis>("emphasis", { children: [] })
      expect(customToString(emptyChildrenNode)).toBe("")
    })
  })
})

describe("stripHtmlTagsFromString", () => {
  it("removes simple HTML tags", () => {
    expect(stripHtmlTagsFromString("<p>Hello world</p>")).toBe("Hello world")
  })

  it("removes multiple HTML tags", () => {
    expect(stripHtmlTagsFromString("<div><span>Hello</span> <strong>world</strong></div>")).toBe(
      "Hello world",
    )
  })

  it("removes self-closing tags", () => {
    expect(stripHtmlTagsFromString("Line break<br/>here")).toBe("Line breakhere")
    expect(stripHtmlTagsFromString("Image<img src='test.jpg'/>here")).toBe("Imagehere")
  })

  it("removes tags with attributes", () => {
    expect(
      stripHtmlTagsFromString('<a href="https://example.com" class="link">Link text</a>'),
    ).toBe("Link text")
  })

  it("handles nested tags", () => {
    expect(stripHtmlTagsFromString("<div><p><em>Nested</em> content</p></div>")).toBe(
      "Nested content",
    )
  })

  it("handles malformed HTML gracefully", () => {
    expect(stripHtmlTagsFromString("<div>Unclosed tag")).toBe("Unclosed tag")
    expect(stripHtmlTagsFromString("No tags here")).toBe("No tags here")
  })

  it("handles empty string", () => {
    expect(stripHtmlTagsFromString("")).toBe("")
  })

  it("handles string with only tags", () => {
    expect(stripHtmlTagsFromString("<div></div>")).toBe("")
    expect(stripHtmlTagsFromString("<br/><hr/>")).toBe("")
  })

  it("preserves content between tags", () => {
    expect(stripHtmlTagsFromString("Before<tag>middle</tag>after")).toBe("Beforemiddleafter")
  })

  it("handles complex HTML with special characters", () => {
    expect(
      stripHtmlTagsFromString(
        '<div data-test="value with spaces" onclick="alert(\'hello\')">Content</div>',
      ),
    ).toBe("Content")
  })
})

describe("TableOfContents Plugin", () => {
  describe("Core functionality", () => {
    it("actually processes markdown and generates TOC", () => {
      const plugin = TableOfContents()
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []

      // Get the processor
      const processorFactory = plugins[0] as () => ProcessorFunction
      const processor = processorFactory()

      // Create mock file and tree
      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }

      const mockTree: Root = createRoot([
        createHeading(1, [createText("Main Title")]),
        createHeading(2, [createText("Section")]),
      ])

      // Process it
      processor(mockTree, mockFile)

      // Check results
      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc).toHaveLength(2)
      expect(normalizeNbsp(mockFile.data.toc?.[0]?.text ?? "")).toBe("Main Title")
      expect(normalizeNbsp(mockFile.data.toc?.[1]?.text ?? "")).toBe("Section")
    })

    it("respects showByDefault false", () => {
      const plugin = TableOfContents({ showByDefault: false })
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }
      const mockTree: Root = createRoot([])

      processor(mockTree, mockFile)
      expect(mockFile.data.toc).toBeUndefined()
    })

    it("respects frontmatter enableToc override", () => {
      const plugin = TableOfContents({ showByDefault: false })
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: { enableToc: true } },
      }
      const mockTree: Root = createRoot([createHeading(1, [createText("Title")])])

      processor(mockTree, mockFile)
      expect(mockFile.data.toc).toBeDefined()
    })

    it("handles minEntries threshold", () => {
      const plugin = TableOfContents({ minEntries: 2 })
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }
      const mockTree: Root = createRoot([createHeading(1, [createText("Single")])])

      processor(mockTree, mockFile)
      expect(mockFile.data.toc).toBeUndefined() // 1 entry, but minEntries is 2, so 1 >= 2 is false
    })

    it("handles footnotes", () => {
      const plugin = TableOfContents()
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }
      const mockTree: Root = createRoot([
        createHeading(1, [createText("Title")]),
        createFootnoteDefinition("1"),
      ])

      processor(mockTree, mockFile)
      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc).toHaveLength(2)
      expect(mockFile.data.toc?.[1]?.text).toBe("Footnotes")
    })

    it("respects maxDepth setting", () => {
      const plugin = TableOfContents({ maxDepth: 2 })
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }
      const mockTree: Root = createRoot([
        createHeading(1, [createText("H1")]),
        createHeading(3, [createText("H3")]),
      ])

      processor(mockTree, mockFile)
      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc).toHaveLength(1) // Only H1, H3 excluded
    })

    it("adjusts depths relative to highest level", () => {
      const plugin = TableOfContents({ maxDepth: 4 })
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }
      const mockTree: Root = createRoot([
        createHeading(2, [createText("H2")]),
        createHeading(3, [createText("H3")]),
      ])

      processor(mockTree, mockFile)
      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc?.[0]?.depth).toBe(0) // 2 - 2 = 0
      expect(mockFile.data.toc?.[1]?.depth).toBe(1) // 3 - 2 = 1
    })

    it("sets collapse option", () => {
      const plugin = TableOfContents({ collapseByDefault: true })
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }
      const mockTree: Root = createRoot([createHeading(1, [createText("Title")])])

      processor(mockTree, mockFile)
      expect(mockFile.data.collapseToc).toBe(true)
    })

    it("handles complex heading content", () => {
      const plugin = TableOfContents()
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }
      const mockTree: Root = createRoot([
        createHeading(1, [createText("Start "), createInlineCode("code"), createText(" end")]),
      ])

      processor(mockTree, mockFile)
      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc?.[0]?.text).toContain("code")
    })

    it.each([
      [
        "empty tree",
        createRoot([]),
        { frontmatter: {} },
        (mockFile: MockFile) => expect(mockFile.data.toc).toBeUndefined(),
      ],
      [
        "undefined frontmatter",
        createRoot([createHeading(1, [createText("Title")])]),
        {},
        (mockFile: MockFile) => expect(mockFile.data.toc).toBeDefined(),
      ],
    ])("handles edge case: %s", (_, mockTree, frontmatterData, assertion) => {
      const plugin = TableOfContents()
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: frontmatterData,
      }

      processor(mockTree, mockFile)
      assertion(mockFile)
    })

    it("generates TOC with multiple headings", () => {
      const plugin = TableOfContents()
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }

      const mockTree: Root = createRoot([
        createHeading(1, [createText("First Heading")]),
        createHeading(1, [createText("Second Heading")]),
      ])

      processor(mockTree, mockFile)

      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc).toHaveLength(2)
    })

    it("excludes headings inside blockquotes", () => {
      const plugin = TableOfContents()
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }

      const mockTree: Root = createRoot([
        createHeading(1, [createText("Normal Heading")]),
        createBlockquote([
          createParagraph([createText("Quote content")]),
          createHeading(2, [createText("Quoted Heading")]),
        ]),
        createHeading(2, [createText("Another Normal Heading")]),
      ])

      processor(mockTree, mockFile)

      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc).toHaveLength(2) // Only the non-blockquote headings
      expect(normalizeNbsp(mockFile.data.toc?.[0]?.text ?? "")).toBe("Normal Heading")
      expect(normalizeNbsp(mockFile.data.toc?.[1]?.text ?? "")).toBe("Another Normal Heading")
    })

    it("generates correct slugs for headings", () => {
      const plugin = TableOfContents()
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }

      const mockTree: Root = createRoot([
        createHeading(1, [createText("Simple Title")]),
        createHeading(2, [createText("Title with Spaces")]),
        createHeading(2, [createText("Title-with-Dashes")]),
        createHeading(2, [createText("Complex "), createInlineCode("code"), createText(" Title")]),
      ])

      processor(mockTree, mockFile)

      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc).toHaveLength(4)

      // Test exact slug generation
      expect(mockFile.data.toc?.[0]?.slug).toBe("simple-title")
      expect(mockFile.data.toc?.[1]?.slug).toBe("title-with-spaces")
      expect(mockFile.data.toc?.[2]?.slug).toBe("title-with-dashes")
      expect(mockFile.data.toc?.[3]?.slug).toBe("complex-code-title")
    })

    it("normalizes NBSP in heading slugs", () => {
      const plugin = TableOfContents()
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }

      // "I love this" gets NBSP inserted by applyTextTransforms (orphan prevention)
      const mockTree: Root = createRoot([createHeading(2, [createText("I love this")])])

      processor(mockTree, mockFile)

      expect(mockFile.data.toc).toHaveLength(1)
      // Slug should use regular hyphens, not NBSP artifacts
      expect(mockFile.data.toc?.[0]?.slug).toBe("i-love-this")
    })

    it("handles mixed depth scenarios correctly", () => {
      const plugin = TableOfContents({ maxDepth: 3 })
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }

      const mockTree: Root = createRoot([
        createHeading(2, [createText("H2 First")]),
        createHeading(1, [createText("H1 Second")]),
        createHeading(3, [createText("H3 Third")]),
        createHeading(4, [createText("H4 Excluded")]),
        createHeading(2, [createText("H2 Last")]),
      ])

      processor(mockTree, mockFile)

      expect(mockFile.data.toc).toBeDefined()
      expect(mockFile.data.toc).toHaveLength(4) // H4 should be excluded due to maxDepth: 3

      // Depths should be adjusted relative to the highest level (H1 = depth 1)
      expect(mockFile.data.toc?.[0]?.depth).toBe(1) // H2 relative to H1
      expect(mockFile.data.toc?.[1]?.depth).toBe(0) // H1 is the base
      expect(mockFile.data.toc?.[2]?.depth).toBe(2) // H3 relative to H1
      expect(mockFile.data.toc?.[3]?.depth).toBe(1) // H2 relative to H1
    })

    it("handles interaction between minEntries and maxDepth", () => {
      const plugin = TableOfContents({ maxDepth: 2, minEntries: 3 })
      const mockCtx = {} as BuildCtx
      const plugins = plugin.markdownPlugins?.(mockCtx) ?? []
      const processor = (plugins[0] as () => ProcessorFunction)()

      const mockFile: MockFile = {
        path: "test.md",
        data: { frontmatter: {} },
      }

      // Test case: 2 headings within maxDepth, but minEntries is 3
      const mockTree: Root = createRoot([
        createHeading(1, [createText("H1")]),
        createHeading(2, [createText("H2")]),
        createHeading(3, [createText("H3 - excluded by maxDepth")]),
      ])

      processor(mockTree, mockFile)

      // Should not generate TOC because only 2 headings meet maxDepth but minEntries is 3
      expect(mockFile.data.toc).toBeUndefined()
    })
  })
})
