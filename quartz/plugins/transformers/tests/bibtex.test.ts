import type { Root, Element } from "hast"

import { describe, it, expect, beforeEach } from "@jest/globals"
import { h } from "hastscript"
import { VFile } from "vfile"

import type { FullSlug } from "../../../util/path"
import type { FrontmatterData } from "../../vfile"

import { BuildCtx } from "../../../util/ctx"
import {
  extractLastName,
  generateCitationKey,
  generateBibtexEntry,
  insertBibtexBeforeOrnament,
  populateBibtexSpans,
  Bibtex,
  getBibtexForSlug,
  clearBibtexCache,
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

describe("extractLastName", () => {
  it.each([
    ["Alex Turner", "turner"],
    ["Turner", "turner"],
    ["Alex Turner, John Doe", "turner"],
    ["Alex Turner & John Doe", "turner"],
    ["  Alex   Turner  ", "turner"],
  ])("extracts last name from %j → %j", (input, expected) => {
    expect(extractLastName(input)).toBe(expected)
  })

  it.each([[""], ["   "]])("throws for invalid input %j", (input) => {
    expect(() => extractLastName(input)).toThrow("Author name cannot be empty")
  })
})

describe("generateCitationKey", () => {
  it.each([
    ["Alex Turner", 2022, "Looking back on my PhD", "turner2022lookingbackonmyphd"],
    ["Alex Turner, John Doe", 2023, "Paper Title", "turner2023papertitle"],
    ["Alex Turner & John Doe", 2023, "Test", "turner2023test"],
    ["Turner", 2022, "Test: A Study of $100 & More!", "turner2022testastudyof100more"],
  ])("generates key from (%j, %d, %j) → %j", (author, year, title, expected) => {
    expect(generateCitationKey(author, year, title)).toBe(expected)
  })

  it("truncates long titles to 20 characters", () => {
    const result = generateCitationKey(
      "Turner",
      2022,
      "A Very Long Title That Exceeds Twenty Characters Significantly",
    )
    expect(result).toBe("turner2022averylongtitlethatex")
  })

  it("throws for empty author", () => {
    expect(() => generateCitationKey("", 2022, "My Article")).toThrow("Author name cannot be empty")
  })
})

describe("generateBibtexEntry", () => {
  it.each([
    {
      name: "basic entry",
      frontmatter: { title: "Test Article", authors: "Alex Turner", date_published: "2022-06-15" },
      expectations: [
        "@misc{turner2022testarticle,",
        "author = {Alex Turner},",
        "title = {Test Article},",
        "year = {2022},",
        "month = jun,",
        "url = {https://turntrout.com/test-article},",
      ],
    },
    {
      name: "with permalink",
      frontmatter: { title: "Test", permalink: "custom-url", date_published: "2022-06-15" },
      expectations: ["url = {https://turntrout.com/custom-url},"],
    },
    {
      name: "default author",
      frontmatter: { title: "Test", date_published: "2022-06-15" },
      expectations: ["author = {Alex Turner},"],
    },
    {
      name: "escapes special characters",
      frontmatter: {
        title: "Test & Study: 100% Results",
        authors: "Turner & Doe",
        date_published: "2022-06-15",
      },
      expectations: ["author = {Turner \\& Doe},", "title = {Test \\& Study: 100\\% Results},"],
    },
  ])("$name", ({ frontmatter, expectations }) => {
    const result = generateBibtexEntry(frontmatter as FrontmatterData, "turntrout.com", "test-article")
    for (const expected of expectations) {
      expect(result).toContain(expected)
    }
  })

  it.each([
    { date: "2022-01-15", month: "jan" },
    { date: "2022-03-15", month: "mar" },
    { date: "2022-12-15", month: "dec" },
  ])("handles month for $date → $month", ({ date, month }) => {
    const result = generateBibtexEntry({ title: "Test", date_published: date }, "turntrout.com", "test")
    expect(result).toContain(`month = ${month},`)
  })
})

describe("insertBibtexBeforeOrnament", () => {
  it.each([
    {
      name: "inserts before ornament",
      children: [ornamentNode],
      expectedLength: 3,
      expectedInserted: true,
    },
    {
      name: "returns false when ornament missing",
      children: [h("div", { id: "some-other-div" }, "Content")],
      expectedLength: 1,
      expectedInserted: false,
    },
    {
      name: "inserts before ornament with other elements",
      children: [h("p", "Paragraph"), h("div", "Content"), ornamentNode],
      expectedLength: 5,
      expectedInserted: true,
    },
  ])("$name", ({ children, expectedLength, expectedInserted }) => {
    const tree = createMockTree(children as Root["children"])
    const result = insertBibtexBeforeOrnament(tree, "@misc{test}")
    expect(result).toBe(expectedInserted)
    expect(tree.children).toHaveLength(expectedLength)
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

describe("populateBibtexSpans", () => {
  it.each([
    { name: "no spans", children: [h("p", "No spans")], expectedCount: 0 },
    { name: "one span", children: [h("span", { class: "populate-bibtex" })], expectedCount: 1 },
    {
      name: "multiple spans",
      children: [h("span", { class: "populate-bibtex" }), h("p"), h("span", { class: "populate-bibtex" })],
      expectedCount: 2,
    },
    { name: "different class", children: [h("span", { class: "other-class" })], expectedCount: 0 },
  ])("$name → $expectedCount populated", ({ children, expectedCount }) => {
    const tree: Root = { type: "root", children }
    expect(populateBibtexSpans(tree, "@misc{test}")).toBe(expectedCount)
  })

  it("creates correct structure", () => {
    const tree: Root = { type: "root", children: [h("span", { class: "populate-bibtex" })] }
    const bibtex = "@misc{test}"
    populateBibtexSpans(tree, bibtex)

    const span = tree.children[0] as Element
    const details = span.children[0] as Element
    expect(details.tagName).toBe("details")

    const code = (details.children[1] as Element).children[0] as Element
    expect((code.children[0] as { value: string }).value).toBe(bibtex)
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
      createTransformer("example.com")(tree, createMockFile({ createBibtex: true, permalink: "test" }))

      const code = ((tree.children[1] as Element).children[1] as Element).children[0] as Element
      expect((code.children[0] as { value: string }).value).toContain("https://example.com/test")
    })

    it("handles missing ornament", () => {
      const tree = createMockTree([h("div", { id: "not-ornament" })])
      transformer(tree, createMockFile({ createBibtex: true }))
      expect(tree.children).toHaveLength(1)
    })

    it("handles missing frontmatter", () => {
      const tree = createMockTree()
      const file = new VFile("")
      file.data = {}
      transformer(tree, file)
      expect(tree.children).toHaveLength(1)
    })

    it("handles missing slug", () => {
      const tree = createMockTree()
      const file = new VFile("")
      file.data = { frontmatter: { title: "Test", createBibtex: true } as FrontmatterData }
      transformer(tree, file)

      const code = ((tree.children[1] as Element).children[1] as Element).children[0] as Element
      expect((code.children[0] as { value: string }).value).toContain("url = {https://turntrout.com/}")
    })

    it("caches bibtex content for later retrieval", () => {
      clearBibtexCache()
      const tree = createMockTree()
      const file = createMockFile({ createBibtex: true, date_published: "2022-06-15" })
      transformer(tree, file)

      const cached = getBibtexForSlug("test-slug")
      expect(cached).toBeDefined()
      expect(cached).toContain("@misc{")
      expect(cached).toContain("Test Title")
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
})
