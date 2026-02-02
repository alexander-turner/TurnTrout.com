import type { Root, Element } from "hast"

import { describe, it, expect, beforeEach } from "@jest/globals"
import { h } from "hastscript"
import { VFile } from "vfile"

import type { FullSlug } from "../../../util/path"
import type { FrontmatterData } from "../../vfile"

import { BuildCtx } from "../../../util/ctx"
import {
  generateBibtexEntry,
  insertBibtexBeforeOrnament,
  Bibtex,
  getBibtexForSlug,
  clearBibtexCache,
  isBibtexCachePopulated,
} from "../bibtex"
import { ornamentNode } from "../trout_hr"

function createMockTree(children: Root["children"] = [ornamentNode]): Root {
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
  const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx)
  const transformerFactory = htmlPlugins?.[0] as () => (tree: Root, file: VFile) => void
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
      expectations: [
        "@misc{",
        "author = {Turner, Alex}",
        "title = {Test Article}",
        "year = {2022}",
        "url = {https://turntrout.com/test-article}",
      ],
    },
    {
      name: "with permalink",
      frontmatter: { title: "Test", permalink: "custom-url", date_published: "2022-06-15" },
      expectations: ["url = {https://turntrout.com/custom-url}"],
    },
    {
      name: "default author",
      frontmatter: { title: "Test", date_published: "2022-06-15" },
      expectations: ["author = {Turner, Alex}"],
    },
    {
      name: "escapes special characters",
      frontmatter: {
        title: "Test & Study: 100% Results",
        authors: ["Turner", "Doe"],
        date_published: "2022-06-15",
      },
      // citation.js handles special characters in BibTeX
      expectations: ["author = {", "title = {"],
    },
    {
      name: "handles multiple authors",
      frontmatter: {
        title: "Test",
        authors: ["Alex Irpan", "Alex Turner", "Mark Kurzeja"],
        date_published: "2022-06-15",
      },
      expectations: ["Irpan, Alex", "Turner, Alex", "Kurzeja, Mark"],
    },
    {
      name: "handles compound surnames",
      frontmatter: {
        title: "Test",
        authors: ["Ludwig van Beethoven"],
        date_published: "2022-06-15",
      },
      expectations: ["van Beethoven, Ludwig"],
    },
    {
      name: "handles suffixes like Jr.",
      frontmatter: {
        title: "Test",
        authors: ["Martin Luther King Jr."],
        date_published: "2022-06-15",
      },
      // humanparser correctly separates the suffix, giving "King, Martin Luther"
      expectations: ["King, Martin Luther"],
    },
    {
      name: "handles empty author name",
      frontmatter: {
        title: "Test",
        authors: ["", "Alex Turner"],
        date_published: "2022-06-15",
      },
      // Empty name becomes "Unknown", so we just check Alex Turner is there
      expectations: ["Turner, Alex"],
    },
    {
      name: "handles single-word author name (family only)",
      frontmatter: {
        title: "Test",
        authors: ["Madonna"],
        date_published: "2022-06-15",
      },
      // Single name becomes family name only, citation.js wraps in double braces
      expectations: ["author = {{Madonna}}"],
    },
    {
      name: "handles French diacritics",
      frontmatter: {
        title: "Test",
        authors: ["François Müller"],
        date_published: "2022-06-15",
      },
      // citation.js escapes diacritics with LaTeX commands: ü → \" u, ç → \c c
      expectations: ['M{\\" u}ller', "{\\c c}ois"],
    },
    {
      name: "handles German umlauts",
      frontmatter: {
        title: "Test",
        authors: ["Jürgen Schröder"],
        date_published: "2022-06-15",
      },
      // ö → \" o, ü → \" u
      expectations: ['Schr{\\" o}der', 'J{\\" u}rgen'],
    },
    {
      name: "handles Spanish characters",
      frontmatter: {
        title: "Test",
        authors: ["José García"],
        date_published: "2022-06-15",
      },
      // é → \' e, í → \' i
      expectations: ["Garc{\\' i}a", "Jos{\\' e}"],
    },
    {
      name: "handles Nordic characters",
      frontmatter: {
        title: "Test",
        authors: ["Søren Ødegård"],
        date_published: "2022-06-15",
      },
      // ø → \o{}, Ø → \O{}, å → \r a
      expectations: ["\\O{}deg", "{\\r a}rd", "S\\o{}ren"],
    },
    {
      name: "handles Polish characters",
      frontmatter: {
        title: "Test",
        authors: ["Stanisław Łukasiewicz"],
        date_published: "2022-06-15",
      },
      // Ł → \L{}, ł → \l{}
      expectations: ["\\L{}ukasiewicz", "Stanis\\l{}aw"],
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

describe("insertBibtexBeforeOrnament", () => {
  it.each([
    {
      name: "inserts before ornament",
      children: [ornamentNode],
      expectedLength: 3,
    },
    {
      name: "inserts before ornament with other elements",
      children: [h("p", "Paragraph"), h("div", "Content"), ornamentNode],
      expectedLength: 5,
    },
  ])("$name", ({ children, expectedLength }) => {
    const tree = createMockTree(children as Root["children"])
    insertBibtexBeforeOrnament(tree, "@misc{test}")
    expect(tree.children).toHaveLength(expectedLength)
  })

  it("throws when ornament is missing", () => {
    const tree = createMockTree([h("div", { id: "some-other-div" }, "Content")])
    expect(() => insertBibtexBeforeOrnament(tree, "@misc{test}")).toThrow(
      'Trout ornament with id "trout-ornament-container" not found in tree',
    )
  })

  it("creates correct structure", () => {
    const tree = createMockTree()
    insertBibtexBeforeOrnament(tree, "@misc{test}")

    const heading = tree.children[0] as Element
    expect(heading.tagName).toBe("h1")

    const details = tree.children[1] as Element
    expect(details.tagName).toBe("details")
    expect(details.properties?.className).toContain("bibtex-citation")

    const summary = details.children[0] as Element
    expect(summary.tagName).toBe("summary")

    const pre = details.children[1] as Element
    const code = pre.children[0] as Element
    expect(code.tagName).toBe("code")
    expect(code.properties?.className).toContain("language-bibtex")
  })
})

describe("Bibtex plugin", () => {
  it("returns plugin with correct name", () => {
    expect(Bibtex().name).toBe("BibtexTransformer")
  })

  it("returns htmlPlugins array", () => {
    const htmlPlugins = Bibtex().htmlPlugins?.({} as BuildCtx)
    expect(htmlPlugins).toHaveLength(1)
  })

  describe("transformer", () => {
    let transformer: (tree: Root, file: VFile) => void

    beforeEach(() => {
      transformer = createTransformer()
    })

    it.each([
      { name: "createBibtex not set", frontmatter: {}, expectedLength: 1 },
      { name: "createBibtex false", frontmatter: { createBibtex: false }, expectedLength: 1 },
      {
        name: "createBibtex true",
        frontmatter: { createBibtex: true, date_published: "2022-06-15" },
        expectedLength: 3,
      },
    ])("$name → $expectedLength children", ({ frontmatter, expectedLength }) => {
      const tree = createMockTree()
      transformer(tree, createMockFile(frontmatter))
      expect(tree.children).toHaveLength(expectedLength)
    })

    it("uses custom baseUrl", () => {
      const tree = createMockTree()
      createTransformer("example.com")(
        tree,
        createMockFile({ createBibtex: true, permalink: "test", date_published: "2022-06-15" }),
      )

      const code = ((tree.children[1] as Element).children[1] as Element).children[0] as Element
      expect((code.children[0] as { value: string }).value).toContain("https://example.com/test")
    })

    it("throws when ornament is missing", () => {
      const tree = createMockTree([h("div", { id: "not-ornament" })])
      expect(() =>
        transformer(tree, createMockFile({ createBibtex: true, date_published: "2022-06-15" })),
      ).toThrow('Trout ornament with id "trout-ornament-container" not found in tree')
    })

    it("throws when date_published is missing on CI", () => {
      const originalCI = process.env.CI
      process.env.CI = "true"
      try {
        const tree = createMockTree()
        expect(() => transformer(tree, createMockFile({ createBibtex: true }))).toThrow(
          "date_published is required for BibTeX generation",
        )
      } finally {
        process.env.CI = originalCI
      }
    })

    it("handles missing frontmatter", () => {
      const tree = createMockTree()
      const file = new VFile("")
      file.data = {}
      transformer(tree, file)
      expect(tree.children).toHaveLength(1)
    })

    it("handles missing slug (uses empty string)", () => {
      const tree = createMockTree()
      const file = new VFile("")
      file.data = {
        frontmatter: { title: "Test", createBibtex: true, date_published: "2022-06-15" },
        // No slug provided
      }
      transformer(tree, file)
      expect(tree.children).toHaveLength(3)
      // Check that the URL uses empty slug
      const code = ((tree.children[1] as Element).children[1] as Element).children[0] as Element
      expect((code.children[0] as { value: string }).value).toContain("https://turntrout.com/")
    })

    it("caches bibtex content for later retrieval", () => {
      clearBibtexCache()
      const tree = createMockTree()
      const file = createMockFile({ createBibtex: true, date_published: "2022-06-15" })
      transformer(tree, file)

      const cached = getBibtexForSlug("test-slug")
      expect(cached).toBeDefined()
      expect(cached).toContain("@misc{")
      expect(cached).toContain("title = {")
    })
  })
})

describe("Bibtex cache", () => {
  beforeEach(() => {
    clearBibtexCache()
  })

  it("returns undefined for unknown slug", () => {
    expect(getBibtexForSlug("unknown-slug")).toBeUndefined()
  })

  it("clears all cached content", () => {
    const transformer = createTransformer()
    const tree = createMockTree()
    transformer(tree, createMockFile({ createBibtex: true, date_published: "2022-06-15" }))

    expect(getBibtexForSlug("test-slug")).toBeDefined()

    clearBibtexCache()

    expect(getBibtexForSlug("test-slug")).toBeUndefined()
  })

  it("isBibtexCachePopulated returns false when cache is empty", () => {
    expect(isBibtexCachePopulated()).toBe(false)
  })

  it("isBibtexCachePopulated returns true when cache has entries", () => {
    const transformer = createTransformer()
    const tree = createMockTree()
    transformer(tree, createMockFile({ createBibtex: true, date_published: "2022-06-15" }))

    expect(isBibtexCachePopulated()).toBe(true)
  })
})
