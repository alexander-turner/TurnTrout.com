/**
 * @jest-environment node
 */
import type { Root as HastRoot } from "hast"

import { describe, expect, it } from "@jest/globals"
import { VFile } from "vfile"

import type { QuartzPluginData } from "../vfile"

import { uiStrings } from "../../components/constants"
import {
  coalesceAliases,
  coerceToArray,
  FrontMatter,
  gatherAllText,
  transformTag,
} from "./frontmatter"

describe("gatherAllText", () => {
  it("extracts text from text nodes", () => {
    const tree: HastRoot = {
      type: "root",
      children: [
        { type: "text", value: "Hello" },
        { type: "text", value: "world" },
      ],
    }
    expect(gatherAllText(tree)).toBe("Hello world ")
  })

  it("extracts text from inlineCode nodes", () => {
    const tree: HastRoot = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "p",
          properties: {},
          children: [
            { type: "text", value: "Use " },
            // @ts-expect-error: mixing AST node types for test
            { type: "inlineCode", value: "const x = 1" },
          ],
        },
      ],
    }
    // Each text/inlineCode value gets a trailing space appended
    expect(gatherAllText(tree)).toBe("Use  const x = 1 ")
  })

  it("returns empty string for tree with no text", () => {
    const tree: HastRoot = {
      type: "root",
      children: [{ type: "element", tagName: "br", properties: {}, children: [] }],
    }
    expect(gatherAllText(tree)).toBe("")
  })
})

describe("coalesceAliases", () => {
  it.each([
    ["returns first matching alias", { tags: ["a", "b"], tag: ["c"] }, ["a", "b"]],
    ["falls back to second alias", { tag: ["fallback"] }, ["fallback"]],
    ["returns [] if no aliases match", {}, []],
    ["skips null values", { tags: null, tag: ["found"] }, ["found"]],
  ])("%s", (_, data, expected) => {
    expect(coalesceAliases(data as Record<string, string[]>, ["tags", "tag"])).toEqual(expected)
  })
})

describe("transformTag", () => {
  it.each([
    ["preserves AI tag", "AI", "AI"],
    ["lowercases normal tags", "JavaScript", "javascript"],
    ["trims whitespace", "  padded  ", "padded"],
    ["replaces spaces with hyphens", "machine learning", "machine-learning"],
    ["replaces multiple spaces with single hyphen", "a  b   c", "a-b-c"],
    ["handles AI with whitespace", " AI ", "AI"],
  ])("%s", (_, input, expected) => {
    expect(transformTag(input)).toBe(expected)
  })
})

describe("coerceToArray", () => {
  it.each([
    ["undefined input", undefined, true, undefined],
    ["null input", null, true, undefined],
    ["comma string lowercased", "Tag1,Tag2,Tag3", true, ["tag1", "tag2", "tag3"]],
    ["comma string not lowercased", "Alice, Bob", false, ["Alice", "Bob"]],
    ["array passthrough", ["a", "b"], true, ["a", "b"]],
    [
      "filters non-string/number and converts numbers",
      ["valid", 42, true, null],
      true,
      ["valid", "42"],
    ],
    ["non-string via toString", 42, true, ["42"]],
  ])("handles %s", (_, input, lowercase, expected) => {
    expect(coerceToArray(input as unknown as string, lowercase as boolean)).toEqual(expected)
  })
})

describe("FrontMatter Plugin", () => {
  type MockFile = VFile & { data: Partial<QuartzPluginData>; stem?: string }

  const getProcessor = () => {
    const transformer = FrontMatter()
    const markdownPlugins = transformer.markdownPlugins
    if (!markdownPlugins) throw new Error("markdownPlugins not defined")
    const plugins = markdownPlugins({} as never)
    return (plugins[1] as () => (tree: HastRoot, file: MockFile) => void)()
  }

  const createMockFile = (content: string, stem = "test"): MockFile => {
    const file = new VFile({ value: content }) as MockFile
    file.stem = stem
    return file
  }

  const emptyTree: HastRoot = { type: "root", children: [] }

  it("returns transformer with correct name", () => {
    expect(FrontMatter().name).toBe("FrontMatter")
  })

  it("parses YAML frontmatter and sets title", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntitle: My Post\n---\nContent here")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("My Post")
  })

  it("uses file stem as title when title is missing", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ndraft: false\n---\nContent", "my-post")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("my-post")
  })

  it("uses file stem when title is empty string", () => {
    const processor = getProcessor()
    const file = createMockFile('---\ntitle: ""\n---\nContent', "fallback-stem")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("fallback-stem")
  })

  it("uses default title when file stem is also missing", () => {
    const processor = getProcessor()
    // Use a plain object mock since VFile's stem is a getter that can't be deleted
    const file = { value: "---\ndraft: false\n---\nContent", data: {} } as unknown as MockFile
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe(uiStrings.propertyDefaults.title)
  })

  it("converts title to string via toString", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntitle: 42\n---\nContent")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("42")
  })

  it("processes and deduplicates tags", () => {
    const processor = getProcessor()
    const file = createMockFile(
      "---\ntags:\n  - AI\n  - Machine Learning\n  - Test\n  - test\n---\n",
    )
    processor(emptyTree, file)
    expect(file.data.frontmatter?.tags).toEqual(["AI", "machine-learning", "test"])
  })

  it("processes aliases from frontmatter", () => {
    const processor = getProcessor()
    const file = createMockFile("---\naliases:\n  - my-alias\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.aliases).toEqual(["my-alias"])
  })

  it("processes cssclasses from frontmatter", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ncssclasses:\n  - custom-class\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.cssclasses).toEqual(["custom-class"])
  })

  it("processes authors without lowercasing", () => {
    const processor = getProcessor()
    const file = createMockFile("---\nauthors: Alice, Bob\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.authors).toEqual(["Alice", "Bob"])
  })

  it("escapes HTML in gathered text", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntitle: Test\n---\n")
    const tree: HastRoot = {
      type: "root",
      children: [{ type: "text", value: "<script>alert('xss')</script>" }],
    }
    processor(tree, file)
    expect(file.data.text).toContain("&lt;script&gt;")
    expect(file.data.text).not.toContain("<script>")
  })

  it("strips protocols from URLs in gathered text", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntitle: Test\n---\n")
    const tree: HastRoot = {
      type: "root",
      children: [{ type: "text", value: "Visit (https://example.com/page)" }],
    }
    processor(tree, file)
    expect(file.data.text).toBe("Visit (example.com/page) ")
  })

  it("handles file with no frontmatter", () => {
    const processor = getProcessor()
    const file = createMockFile("Just plain content", "plain")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("plain")
    expect(file.data.frontmatter?.tags).toEqual([])
    expect(file.data.frontmatter?.aliases).toEqual([])
    expect(file.data.frontmatter?.cssclasses).toEqual([])
    expect(file.data.frontmatter?.authors).toEqual([])
  })

  it("handles empty file value", () => {
    const processor = getProcessor()
    const file = new VFile() as MockFile
    file.stem = "empty"
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("empty")
  })

  it.each([
    ["tag", "tag:\n  - solo", "tags", ["solo"]],
    ["alias", "alias:\n  - alt-name", "aliases", ["alt-name"]],
    ["cssclass", "cssclass:\n  - my-style", "cssclasses", ["my-style"]],
    ["author", "author: Jane", "authors", ["Jane"]],
  ])("supports singular %s field", (_, yaml, field, expected) => {
    const processor = getProcessor()
    const file = createMockFile(`---\n${yaml}\n---\n`)
    processor(emptyTree, file)
    expect(file.data.frontmatter?.[field]).toEqual(expected)
  })

  it("accepts custom delimiters option", () => {
    expect(FrontMatter({ delimiters: "+++" }).name).toBe("FrontMatter")
  })

  it("parses TOML frontmatter", () => {
    const transformer = FrontMatter({ language: "toml", delimiters: "+++" })
    const { markdownPlugins } = transformer
    if (!markdownPlugins) throw new Error("markdownPlugins not defined")
    const processor = (
      markdownPlugins({} as never)[1] as () => (tree: HastRoot, file: MockFile) => void
    )()
    const file = createMockFile('+++\ntitle = "TOML Post"\n+++\nContent')
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("TOML Post")
  })

  it.each(["tags", "aliases", "cssclasses", "authors"])(
    "handles falsy %s value with || [] fallback",
    (field) => {
      const processor = getProcessor()
      const file = createMockFile(`---\n${field}: false\n---\n`)
      processor(emptyTree, file)
      expect(file.data.frontmatter?.[field]).toEqual([])
    },
  )
})
