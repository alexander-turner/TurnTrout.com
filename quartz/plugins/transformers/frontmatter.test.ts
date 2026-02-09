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

  it("ignores non-text, non-inlineCode nodes", () => {
    const tree: HastRoot = {
      type: "root",
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {},
          children: [{ type: "text", value: "nested" }],
        },
      ],
    }
    // The "element" and "root" nodes are visited but skipped; only "text" is collected
    expect(gatherAllText(tree)).toBe("nested ")
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
  it("returns first matching alias value", () => {
    const data = { tags: ["a", "b"], tag: ["c"] }
    expect(coalesceAliases(data, ["tags", "tag"])).toEqual(["a", "b"])
  })

  it("falls back to second alias if first is undefined", () => {
    const data = { tag: ["fallback"] } as Record<string, string[]>
    expect(coalesceAliases(data, ["tags", "tag"])).toEqual(["fallback"])
  })

  it("returns empty array if no aliases match", () => {
    expect(coalesceAliases({}, ["tags", "tag"])).toEqual([])
  })

  it("skips null values", () => {
    const data = { tags: null, tag: ["found"] } as unknown as Record<string, string[]>
    expect(coalesceAliases(data, ["tags", "tag"])).toEqual(["found"])
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
  it("returns undefined for undefined input", () => {
    expect(coerceToArray(undefined as unknown as string)).toBeUndefined()
  })

  it("returns undefined for null input", () => {
    expect(coerceToArray(null as unknown as string)).toBeUndefined()
  })

  it("splits comma-separated string and lowercases", () => {
    expect(coerceToArray("Tag1,Tag2,Tag3")).toEqual(["tag1", "tag2", "tag3"])
  })

  it("splits comma-separated string without lowercasing", () => {
    expect(coerceToArray("Alice, Bob", false)).toEqual(["Alice", "Bob"])
  })

  it("passes through arrays unchanged", () => {
    expect(coerceToArray(["a", "b"])).toEqual(["a", "b"])
  })

  it("filters out non-string non-number values", () => {
    const mixed = ["valid", 42, true, null, undefined] as unknown as string[]
    expect(coerceToArray(mixed)).toEqual(["valid", "42"])
  })

  it("converts number elements to strings", () => {
    const nums = [1, 2, 3] as unknown as string[]
    expect(coerceToArray(nums)).toEqual(["1", "2", "3"])
  })

  it("coerces non-string input via toString before splitting", () => {
    expect(coerceToArray(42 as unknown as string)).toEqual(["42"])
  })
})

describe("FrontMatter Plugin", () => {
  type MockFile = VFile & { data: Partial<QuartzPluginData>; stem?: string }

  const getProcessor = () => {
    const transformer = FrontMatter()
    const markdownPlugins = transformer.markdownPlugins
    if (!markdownPlugins) throw new Error("markdownPlugins not defined")
    const plugins = markdownPlugins({} as never)
    // The second plugin is our custom processor (first is remarkFrontmatter)
    return (plugins[1] as () => (tree: HastRoot, file: MockFile) => void)()
  }

  const createMockFile = (content: string, stem = "test"): MockFile => {
    const file = new VFile({ value: content }) as MockFile
    file.stem = stem
    return file
  }

  const emptyTree: HastRoot = { type: "root", children: [] }

  it("returns transformer with correct name", () => {
    const transformer = FrontMatter()
    expect(transformer.name).toBe("FrontMatter")
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
    const file = {
      value: "---\ndraft: false\n---\nContent",
      data: {},
    } as unknown as MockFile
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe(uiStrings.propertyDefaults.title)
  })

  it("converts title to string via toString", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntitle: 42\n---\nContent")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("42")
  })

  it("processes tags from frontmatter", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntags:\n  - AI\n  - Machine Learning\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.tags).toEqual(["AI", "machine-learning"])
  })

  it("deduplicates tags", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntags:\n  - test\n  - Test\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.tags).toHaveLength(1)
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

  it("processes authors from frontmatter without lowercasing", () => {
    const processor = getProcessor()
    const file = createMockFile("---\nauthors: Alice, Bob\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.authors).toEqual(["Alice", "Bob"])
  })

  it("gathers text content from tree", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntitle: Test\n---\n")
    const tree: HastRoot = {
      type: "root",
      children: [{ type: "text", value: "Hello world" }],
    }
    processor(tree, file)
    expect(file.data.text).toContain("Hello world")
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
  })

  it("handles empty file value", () => {
    const processor = getProcessor()
    const file = new VFile() as MockFile
    file.stem = "empty"
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("empty")
  })

  it("supports singular tag field", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ntag:\n  - solo\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.tags).toContain("solo")
  })

  it("supports singular alias field", () => {
    const processor = getProcessor()
    const file = createMockFile("---\nalias:\n  - alt-name\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.aliases).toEqual(["alt-name"])
  })

  it("supports singular cssclass field", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ncssclass:\n  - my-style\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.cssclasses).toEqual(["my-style"])
  })

  it("supports singular author field", () => {
    const processor = getProcessor()
    const file = createMockFile("---\nauthor: Jane\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.authors).toEqual(["Jane"])
  })

  it("accepts custom delimiters option", () => {
    const transformer = FrontMatter({ delimiters: "+++" })
    expect(transformer.name).toBe("FrontMatter")
  })

  it("parses TOML frontmatter", () => {
    const transformer = FrontMatter({ language: "toml", delimiters: "+++" })
    const markdownPlugins = transformer.markdownPlugins!({} as never)
    const processor = (markdownPlugins[1] as () => (tree: HastRoot, file: MockFile) => void)()
    const file = createMockFile('+++\ntitle = "TOML Post"\n+++\nContent')
    processor(emptyTree, file)
    expect(file.data.frontmatter?.title).toBe("TOML Post")
  })

  it("handles falsy tags value with || [] fallback", () => {
    const processor = getProcessor()
    // tags: false produces a falsy value from coalesceAliases, triggering || []
    const file = createMockFile("---\ntags: false\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.tags).toEqual([])
  })

  it("handles falsy aliases value with || [] fallback", () => {
    const processor = getProcessor()
    const file = createMockFile("---\naliases: false\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.aliases).toEqual([])
  })

  it("handles falsy cssclasses value with || [] fallback", () => {
    const processor = getProcessor()
    const file = createMockFile("---\ncssclasses: false\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.cssclasses).toEqual([])
  })

  it("handles falsy authors value with || [] fallback", () => {
    const processor = getProcessor()
    const file = createMockFile("---\nauthors: false\n---\n")
    processor(emptyTree, file)
    expect(file.data.frontmatter?.authors).toEqual([])
  })
})
