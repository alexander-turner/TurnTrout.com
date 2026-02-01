import type { Root, Element } from "hast"

import { describe, it, expect, beforeEach } from "@jest/globals"
import { h } from "hastscript"
import { VFile } from "vfile"

import { BuildCtx } from "../../../util/ctx"
import type { FullSlug } from "../../../util/path"
import { ornamentNode } from "../trout_hr"
import {
  extractLastName,
  generateCitationKey,
  escapeBibtexString,
  generateBibtexEntry,
  insertBibtexBeforeOrnament,
  Bibtex,
} from "../bibtex"
import type { FrontmatterData } from "../../vfile"

function createMockTree(children: Root["children"] = [ornamentNode]): Root {
  return {
    type: "root",
    children,
  }
}

function createMockFile(frontmatter: Partial<FrontmatterData> = {}): VFile {
  const file = new VFile("")
  file.data = {
    frontmatter: {
      title: "Test Title",
      ...frontmatter,
    } as FrontmatterData,
    slug: "test-slug" as FullSlug,
  }
  return file
}

function createTransformer(baseUrl = "turntrout.com"): (tree: Root, file: VFile) => void {
  const plugin = Bibtex({ baseUrl })
  const mockBuildCtx: BuildCtx = {} as BuildCtx
  const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx)
  const transformerFactory = htmlPlugins?.[0] as () => (tree: Root, file: VFile) => void
  return transformerFactory()
}

describe("extractLastName", () => {
  it("should extract last name from a full name", () => {
    expect(extractLastName("Alex Turner")).toBe("turner")
  })

  it("should extract last name from a single name", () => {
    expect(extractLastName("Turner")).toBe("turner")
  })

  it("should take first author when multiple authors with comma", () => {
    expect(extractLastName("Alex Turner, John Doe")).toBe("turner")
  })

  it("should take first author when multiple authors with ampersand", () => {
    expect(extractLastName("Alex Turner & John Doe")).toBe("turner")
  })

  it("should throw error for empty string", () => {
    expect(() => extractLastName("")).toThrow("Author name cannot be empty")
  })

  it("should throw error for whitespace-only string", () => {
    expect(() => extractLastName("   ")).toThrow("Author name cannot be empty")
  })

  it("should handle names with extra whitespace", () => {
    expect(extractLastName("  Alex   Turner  ")).toBe("turner")
  })
})

describe("generateCitationKey", () => {
  it("should generate key from author last name, year, and title", () => {
    const result = generateCitationKey("Alex Turner", 2022, "Looking back on my PhD")
    expect(result).toBe("turner2022lookingbackonmyphd")
  })

  it("should handle multiple authors by taking the first", () => {
    const result = generateCitationKey("Alex Turner, John Doe", 2023, "Paper Title")
    expect(result).toBe("turner2023papertitle")
  })

  it("should handle authors separated by ampersand", () => {
    const result = generateCitationKey("Alex Turner & John Doe", 2023, "Test")
    expect(result).toBe("turner2023test")
  })

  it("should throw error when author is an empty string", () => {
    expect(() => generateCitationKey("", 2022, "My Article")).toThrow("Author name cannot be empty")
  })

  it("should truncate long titles to 20 characters", () => {
    const longTitle = "A Very Long Title That Exceeds Twenty Characters Significantly"
    const result = generateCitationKey("Turner", 2022, longTitle)
    // "averylongtitlethatexceedstwentycharacterssignificantly" → first 20 chars = "averylongtitlethatex"
    expect(result).toBe("turner2022averylongtitlethatex")
  })

  it("should remove special characters from title", () => {
    const result = generateCitationKey("Turner", 2022, "Test: A Study of $100 & More!")
    expect(result).toBe("turner2022testastudyof100more")
  })
})

describe("escapeBibtexString", () => {
  it("should escape ampersand", () => {
    expect(escapeBibtexString("A & B")).toBe("A \\& B")
  })

  it("should escape percent sign", () => {
    expect(escapeBibtexString("100%")).toBe("100\\%")
  })

  it("should escape dollar sign", () => {
    expect(escapeBibtexString("$100")).toBe("\\$100")
  })

  it("should escape hash sign", () => {
    expect(escapeBibtexString("#1")).toBe("\\#1")
  })

  it("should escape underscore", () => {
    expect(escapeBibtexString("test_value")).toBe("test\\_value")
  })

  it("should escape curly braces", () => {
    expect(escapeBibtexString("{test}")).toBe("\\{test\\}")
  })

  it("should escape backslash", () => {
    expect(escapeBibtexString("test\\path")).toBe("test\\textbackslash{}path")
  })

  it("should escape tilde", () => {
    expect(escapeBibtexString("~test")).toBe("\\textasciitilde{}test")
  })

  it("should escape caret", () => {
    expect(escapeBibtexString("x^2")).toBe("x\\textasciicircum{}2")
  })

  it("should handle multiple special characters", () => {
    expect(escapeBibtexString("$100 & 50%")).toBe("\\$100 \\& 50\\%")
  })

  it("should return unchanged string when no special characters", () => {
    expect(escapeBibtexString("Simple Text")).toBe("Simple Text")
  })
})

describe("generateBibtexEntry", () => {
  it("should generate a valid BibTeX entry", () => {
    const frontmatter: FrontmatterData = {
      title: "Test Article",
      authors: "Alex Turner",
      date_published: "2022-06-15",
    }

    const result = generateBibtexEntry(frontmatter, "turntrout.com", "test-article")

    expect(result).toContain("@misc{turner2022testarticle,")
    expect(result).toContain("author = {Alex Turner},")
    expect(result).toContain("title = {Test Article},")
    expect(result).toContain("year = {2022},")
    expect(result).toContain("month = jun,")
    expect(result).toContain("url = {https://turntrout.com/test-article},")
    expect(result).toContain("note = {Accessed:")
    expect(result).toContain("}")
  })

  it("should use permalink if available", () => {
    const frontmatter: FrontmatterData = {
      title: "Test Article",
      permalink: "custom-url",
      date_published: "2022-06-15",
    }

    const result = generateBibtexEntry(frontmatter, "turntrout.com", "test-article")

    expect(result).toContain("url = {https://turntrout.com/custom-url},")
  })

  it("should default to Alex Turner if no authors specified", () => {
    const frontmatter: FrontmatterData = {
      title: "Test Article",
      date_published: "2022-06-15",
    }

    const result = generateBibtexEntry(frontmatter, "turntrout.com", "test-article")

    expect(result).toContain("author = {Alex Turner},")
  })

  it("should escape special characters in title and author", () => {
    const frontmatter: FrontmatterData = {
      title: "Test & Study: 100% Results",
      authors: "Turner & Doe",
      date_published: "2022-06-15",
    }

    const result = generateBibtexEntry(frontmatter, "turntrout.com", "test-article")

    expect(result).toContain("author = {Turner \\& Doe},")
    expect(result).toContain("title = {Test \\& Study: 100\\% Results},")
  })

  it("should handle different months correctly", () => {
    const months = [
      { date: "2022-01-15", expected: "jan" },
      { date: "2022-03-15", expected: "mar" },
      { date: "2022-12-15", expected: "dec" },
    ]

    for (const { date, expected } of months) {
      const frontmatter: FrontmatterData = {
        title: "Test",
        date_published: date,
      }

      const result = generateBibtexEntry(frontmatter, "turntrout.com", "test")

      expect(result).toContain(`month = ${expected},`)
    }
  })
})

describe("insertBibtexBeforeOrnament", () => {
  it("should insert bibtex block before the trout ornament", () => {
    const mockTree = createMockTree()
    const bibtexContent = "@misc{test, title={Test}}"

    const result = insertBibtexBeforeOrnament(mockTree, bibtexContent)

    expect(result).toBe(true)
    expect(mockTree.children).toHaveLength(2)

    const bibtexBlock = mockTree.children[0] as Element
    expect(bibtexBlock.tagName).toBe("details")
    expect(bibtexBlock.properties?.className).toContain("bibtex-citation")

    // Check for summary
    const summary = bibtexBlock.children[0] as Element
    expect(summary.tagName).toBe("summary")

    // Check for pre/code
    const pre = bibtexBlock.children[1] as Element
    expect(pre.tagName).toBe("pre")
    const code = pre.children[0] as Element
    expect(code.tagName).toBe("code")
    expect(code.properties?.className).toContain("language-bibtex")
  })

  it("should return false when trout ornament is not found", () => {
    const mockTree = createMockTree([h("div", { id: "some-other-div" }, "Content")])
    const bibtexContent = "@misc{test, title={Test}}"

    const result = insertBibtexBeforeOrnament(mockTree, bibtexContent)

    expect(result).toBe(false)
    expect(mockTree.children).toHaveLength(1)
  })

  it("should insert before ornament when other elements exist", () => {
    const mockTree = createMockTree([
      h("p", "Some paragraph"),
      h("div", "Some content"),
      ornamentNode,
    ])
    const bibtexContent = "@misc{test, title={Test}}"

    insertBibtexBeforeOrnament(mockTree, bibtexContent)

    expect(mockTree.children).toHaveLength(4)
    const bibtexBlock = mockTree.children[2] as Element
    expect(bibtexBlock.tagName).toBe("details")
    expect(mockTree.children[3]).toBe(ornamentNode)
  })
})

describe("Bibtex plugin", () => {
  beforeEach(() => {
    // Reset any mocks if needed
  })

  it("should return a QuartzTransformerPlugin with correct name", () => {
    const plugin = Bibtex()
    expect(plugin.name).toBe("BibtexTransformer")
  })

  it("should return htmlPlugins function", () => {
    const plugin = Bibtex()
    const mockBuildCtx: BuildCtx = {} as BuildCtx
    const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx)
    expect(Array.isArray(htmlPlugins)).toBe(true)
    expect(htmlPlugins).toHaveLength(1)
  })

  describe("transformer function", () => {
    let transformer: (tree: Root, file: VFile) => void

    beforeEach(() => {
      transformer = createTransformer()
    })

    it("should not modify tree when createBibtex is not set", () => {
      const mockTree = createMockTree()
      const mockFile = createMockFile()

      transformer(mockTree, mockFile)

      expect(mockTree.children).toHaveLength(1)
      expect(mockTree.children[0]).toBe(ornamentNode)
    })

    it("should not modify tree when createBibtex is false", () => {
      const mockTree = createMockTree()
      const mockFile = createMockFile({ createBibtex: false })

      transformer(mockTree, mockFile)

      expect(mockTree.children).toHaveLength(1)
    })

    it("should add bibtex block when createBibtex is true", () => {
      const mockTree = createMockTree()
      const mockFile = createMockFile({
        createBibtex: true,
        title: "Test Article",
        authors: "Alex Turner",
        date_published: "2022-06-15",
        permalink: "test-article",
      })

      transformer(mockTree, mockFile)

      expect(mockTree.children).toHaveLength(2)
      const bibtexBlock = mockTree.children[0] as Element
      expect(bibtexBlock.tagName).toBe("details")
      expect(bibtexBlock.properties?.className).toContain("bibtex-citation")
    })

    it("should use custom baseUrl when provided", () => {
      const customTransformer = createTransformer("example.com")
      const mockTree = createMockTree()
      const mockFile = createMockFile({
        createBibtex: true,
        title: "Test",
        permalink: "test",
      })

      customTransformer(mockTree, mockFile)

      expect(mockTree.children).toHaveLength(2)
      const bibtexBlock = mockTree.children[0] as Element
      const pre = bibtexBlock.children[1] as Element
      const code = pre.children[0] as Element
      const codeContent = (code.children[0] as { value: string }).value
      expect(codeContent).toContain("url = {https://example.com/test}")
    })

    it("should not add bibtex when ornament is missing", () => {
      const mockTree = createMockTree([h("div", { id: "not-ornament" }, "Content")])
      const mockFile = createMockFile({ createBibtex: true })

      transformer(mockTree, mockFile)

      expect(mockTree.children).toHaveLength(1)
    })

    it("should handle missing frontmatter gracefully", () => {
      const mockTree = createMockTree()
      const mockFile = new VFile("")
      mockFile.data = {}

      transformer(mockTree, mockFile)

      expect(mockTree.children).toHaveLength(1)
    })

    it("should handle missing slug gracefully", () => {
      const mockTree = createMockTree()
      const mockFile = new VFile("")
      mockFile.data = {
        frontmatter: {
          title: "Test Article",
          createBibtex: true,
        } as FrontmatterData,
        // slug is intentionally missing
      }

      transformer(mockTree, mockFile)

      expect(mockTree.children).toHaveLength(2)
      const bibtexBlock = mockTree.children[0] as Element
      const pre = bibtexBlock.children[1] as Element
      const code = pre.children[0] as Element
      const codeContent = (code.children[0] as { value: string }).value
      // With no slug or permalink, URL should end with just the baseUrl and empty path
      expect(codeContent).toContain("url = {https://turntrout.com/}")
    })
  })

  it("should use default baseUrl when no options provided", () => {
    const plugin = Bibtex()
    const mockBuildCtx: BuildCtx = {} as BuildCtx
    const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx)
    const transformerFactory = htmlPlugins?.[0] as () => (tree: Root, file: VFile) => void
    const noOptsTransformer = transformerFactory()

    const mockTree = createMockTree()
    const mockFile = createMockFile({
      createBibtex: true,
      title: "Test",
      permalink: "test",
    })

    noOptsTransformer(mockTree, mockFile)

    expect(mockTree.children).toHaveLength(2)
    const bibtexBlock = mockTree.children[0] as Element
    const pre = bibtexBlock.children[1] as Element
    const code = pre.children[0] as Element
    const codeContent = (code.children[0] as { value: string }).value
    expect(codeContent).toContain("url = {https://turntrout.com/test}")
  })
})
