import type { Code, Heading, Root } from "mdast"

import { describe, it, expect } from "@jest/globals"
import { VFile } from "vfile"

import type { FullSlug } from "../../../util/path"
import type { FrontmatterData } from "../../vfile"

import { BuildCtx } from "../../../util/ctx"
import { generateBibtexEntry, findInsertionIndex, createCitationNodes, Bibtex } from "../bibtex"

function createMockTree(children: Root["children"] = []): Root {
  return { type: "root", children }
}

function createMockFile(frontmatter: Partial<FrontmatterData> = {}): VFile {
  const file = new VFile("")
  file.data = {
    frontmatter: { title: "Test Title", ...frontmatter } as FrontmatterData,
    slug: "test-slug" as FullSlug,
  }
  return file
}

function createTransformer(baseUrl = "turntrout.com"): (tree: Root, file: VFile) => void {
  const plugin = Bibtex({ baseUrl })
  const mockBuildCtx: BuildCtx = {} as BuildCtx
  const markdownPlugins = plugin.markdownPlugins?.(mockBuildCtx)
  const transformerFactory = markdownPlugins?.[0] as () => (tree: Root, file: VFile) => void
  return transformerFactory()
}

describe("generateBibtexEntry", () => {
  it.each([
    {
      name: "basic entry",
      frontmatter: {
        title: "Test Article",
        authors: ["Alex Turner"],
        date_published: "2022-06-15",
      },
      expectations: ["@misc{", "Alex Turner", "title = {Test", "year = {2022}"],
    },
    {
      name: "with permalink",
      frontmatter: { title: "Test", permalink: "custom-url", date_published: "2022-06-15" },
      expectations: ["url = {https://turntrout.com/custom-url}"],
    },
    {
      name: "default author",
      frontmatter: { title: "Test", date_published: "2022-06-15" },
      expectations: ["Alex Turner"],
    },
    {
      name: "handles multiple authors",
      frontmatter: {
        title: "Test",
        authors: ["Alex Irpan", "Alex Turner", "Mark Kurzeja"],
        date_published: "2022-06-15",
      },
      expectations: ["Alex Irpan", "Alex Turner", "Mark Kurzeja"],
    },
  ])("$name", ({ frontmatter, expectations }) => {
    const result = generateBibtexEntry(
      frontmatter as FrontmatterData,
      "turntrout.com",
      "test-article",
    )
    for (const expected of expectations) {
      expect(result).toContain(expected)
    }
  })

  it("includes month in output", () => {
    const result = generateBibtexEntry(
      { title: "Test", date_published: "2022-06-15" },
      "turntrout.com",
      "test",
    )
    expect(result).toContain("month = {6}")
  })

  it("throws when date_published is missing on CI", () => {
    const originalCI = process.env.CI
    process.env.CI = "true"
    try {
      expect(() =>
        generateBibtexEntry({ title: "Test" } as FrontmatterData, "turntrout.com", "test-slug"),
      ).toThrow("date_published is required for BibTeX generation (slug: test-slug)")
    } finally {
      process.env.CI = originalCI
    }
  })

  it("uses current date when date_published is missing locally", () => {
    const originalCI = process.env.CI
    delete process.env.CI
    try {
      const result = generateBibtexEntry(
        { title: "Test" } as FrontmatterData,
        "turntrout.com",
        "test-slug",
      )
      expect(result).toContain(`year = {${new Date().getFullYear()}}`)
    } finally {
      process.env.CI = originalCI
    }
  })
})

describe("findInsertionIndex", () => {
  it("returns end of document when no Appendix heading", () => {
    const tree = createMockTree([
      { type: "paragraph", children: [{ type: "text", value: "Content" }] },
      { type: "heading", depth: 1, children: [{ type: "text", value: "Section" }] },
    ])
    expect(findInsertionIndex(tree)).toBe(2)
  })

  it("returns index of Appendix heading", () => {
    const tree = createMockTree([
      { type: "paragraph", children: [{ type: "text", value: "Content" }] },
      { type: "heading", depth: 1, children: [{ type: "text", value: "Appendix" }] },
      { type: "paragraph", children: [{ type: "text", value: "More" }] },
    ])
    expect(findInsertionIndex(tree)).toBe(1)
  })

  it("is case-insensitive for Appendix", () => {
    const tree = createMockTree([
      { type: "heading", depth: 1, children: [{ type: "text", value: "APPENDIX A" }] },
    ])
    expect(findInsertionIndex(tree)).toBe(0)
  })

  it("ignores h2+ Appendix headings", () => {
    const tree = createMockTree([
      { type: "heading", depth: 2, children: [{ type: "text", value: "Appendix" }] },
    ])
    expect(findInsertionIndex(tree)).toBe(1)
  })

  it("handles headings with mixed content (emphasis, etc)", () => {
    const tree = createMockTree([
      {
        type: "heading",
        depth: 1,
        children: [
          { type: "text", value: "My " },
          { type: "emphasis", children: [{ type: "text", value: "Appendix" }] },
        ],
      },
    ])
    // Emphasis node is skipped, but "My " doesn't contain "appendix"
    expect(findInsertionIndex(tree)).toBe(1)
  })

  it("returns empty tree length", () => {
    expect(findInsertionIndex(createMockTree())).toBe(0)
  })
})

describe("createCitationNodes", () => {
  it("creates heading and code block", () => {
    const nodes = createCitationNodes("@misc{test}")
    expect(nodes).toHaveLength(2)

    const heading = nodes[0] as Heading
    expect(heading.type).toBe("heading")
    expect(heading.depth).toBe(1)

    const code = nodes[1] as Code
    expect(code.type).toBe("code")
    expect(code.lang).toBe("bibtex")
    expect(code.value).toBe("@misc{test}")
  })

  it("trims whitespace from bibtex content", () => {
    const nodes = createCitationNodes("  @misc{test}  \n")
    expect((nodes[1] as Code).value).toBe("@misc{test}")
  })
})

describe("Bibtex plugin", () => {
  it("returns plugin with correct name", () => {
    expect(Bibtex().name).toBe("BibtexTransformer")
  })

  it("returns markdownPlugins array", () => {
    const markdownPlugins = Bibtex().markdownPlugins?.({} as BuildCtx)
    expect(markdownPlugins).toHaveLength(1)
  })

  describe("transformer", () => {
    it.each([
      { name: "createBibtex not set", frontmatter: {}, expectedLength: 0 },
      { name: "createBibtex false", frontmatter: { createBibtex: false }, expectedLength: 0 },
      {
        name: "createBibtex true",
        frontmatter: { createBibtex: true, date_published: "2022-06-15" },
        expectedLength: 2,
      },
    ])("$name → $expectedLength children", ({ frontmatter, expectedLength }) => {
      const tree = createMockTree()
      createTransformer()(tree, createMockFile(frontmatter))
      expect(tree.children).toHaveLength(expectedLength)
    })

    it("inserts before Appendix heading", () => {
      const tree = createMockTree([
        { type: "paragraph", children: [{ type: "text", value: "Content" }] },
        { type: "heading", depth: 1, children: [{ type: "text", value: "Appendix" }] },
      ])
      createTransformer()(
        tree,
        createMockFile({ createBibtex: true, date_published: "2022-06-15" }),
      )

      expect(tree.children).toHaveLength(4)
      expect((tree.children[1] as Heading).children[0]).toEqual({
        type: "text",
        value: "Citation",
      })
      expect((tree.children[3] as Heading).children[0]).toEqual({
        type: "text",
        value: "Appendix",
      })
    })

    it("uses custom baseUrl", () => {
      const tree = createMockTree()
      createTransformer("example.com")(
        tree,
        createMockFile({ createBibtex: true, permalink: "test", date_published: "2022-06-15" }),
      )

      const code = tree.children[1] as Code
      expect(code.value).toContain("https://example.com/test")
    })

    it("handles missing frontmatter", () => {
      const tree = createMockTree()
      const file = new VFile("")
      file.data = {}
      createTransformer()(tree, file)
      expect(tree.children).toHaveLength(0)
    })

    it("handles missing slug", () => {
      const tree = createMockTree()
      const file = new VFile("")
      file.data = {
        frontmatter: { title: "Test", createBibtex: true, date_published: "2022-06-15" },
      }
      expect(() => createTransformer()(tree, file)).not.toThrow()
      expect(tree.children).toHaveLength(2)
    })
  })
})
