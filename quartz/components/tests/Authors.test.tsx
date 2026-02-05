import type { Root } from "hast"
import type { VNode } from "preact"

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"
import { render } from "preact-render-to-string"

import type { GlobalConfiguration, QuartzConfig } from "../../cfg"
import type { QuartzPluginData } from "../../plugins/vfile"
import type { BuildCtx } from "../../util/ctx"
import type { FullSlug } from "../../util/path"
import type { QuartzComponentProps } from "../types"

import Authors, { formatAuthors } from "../Authors"

// Helper function to create test file data
const createFileData = (overrides: Partial<QuartzPluginData> = {}): QuartzPluginData =>
  ({
    slug: "test" as FullSlug,
    frontmatter: { title: "Test Page" },
    ...overrides,
  }) as QuartzPluginData

// Helper function to create test props
const createProps = (fileData: QuartzPluginData): QuartzComponentProps => {
  const cfg = {} as GlobalConfiguration
  return {
    fileData,
    allFiles: [],
    cfg,
    ctx: {
      cfg: {} as unknown as QuartzConfig,
      allSlugs: [] as FullSlug[],
      argv: {} as unknown,
    } as BuildCtx,
    externalResources: { css: [], js: [] },
    children: [],
    tree: h("root") as unknown as Root,
    displayClass: undefined,
  }
}

describe("formatAuthors", () => {
  it.each([
    { authors: [], expected: "Alex Turner", name: "empty array returns default" },
    { authors: ["John Doe"], expected: "John Doe", name: "single author unchanged" },
    {
      authors: ["John Doe", "Jane Smith"],
      expected: "John Doe and Jane Smith",
      name: "two authors with 'and'",
    },
    {
      authors: ["Alice", "Bob", "Charlie"],
      expected: "Alice, Bob, and Charlie",
      name: "three authors with Oxford comma",
    },
    {
      authors: ["A", "B", "C", "D"],
      expected: "A, B, C, and D",
      name: "four authors with Oxford comma",
    },
    {
      authors: ["José García", "François Müller"],
      expected: "José García and François Müller",
      name: "special characters",
    },
    {
      authors: ["Alex Irpan", "Alex Turner", "Mark Kurzeja", "David Elson", "Rohin Shah"],
      expected: "Alex Irpan, Alex Turner, Mark Kurzeja, David Elson, and Rohin Shah",
      name: "many authors",
    },
  ])("$name", ({ authors, expected }) => {
    expect(formatAuthors(authors)).toBe(expected)
  })
})

describe("Authors component", () => {
  it("returns null when hide_metadata is true", () => {
    const fileData = createFileData({ frontmatter: { title: "Test", hide_metadata: true } })
    const props = createProps(fileData)
    const AuthorsComponent = Authors()
    const result = AuthorsComponent(props)
    expect(result).toBeNull()
  })

  it("returns null when hide_authors is true", () => {
    const fileData = createFileData({ frontmatter: { title: "Test", hide_authors: true } })
    const props = createProps(fileData)
    const AuthorsComponent = Authors()
    const result = AuthorsComponent(props)
    expect(result).toBeNull()
  })

  it("renders with default author when no authors specified", () => {
    const fileData = createFileData()
    const props = createProps(fileData)
    const AuthorsComponent = Authors()
    const result = AuthorsComponent(props)
    const html = render(result as VNode)
    expect(html).toContain("By Alex Turner")
    expect(html).toContain('class="authors"')
  })

  it("renders with custom authors from frontmatter", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", authors: ["John Doe", "Jane Smith"] },
    })
    const props = createProps(fileData)
    const AuthorsComponent = Authors()
    const result = AuthorsComponent(props)
    const html = render(result as VNode)
    expect(html).toContain("By John Doe and Jane Smith")
  })

  it("renders publication info when date_published is provided", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", date_published: "2024-01-15" },
      dates: { published: new Date("2024-01-15") },
    })
    const props = createProps(fileData)
    const AuthorsComponent = Authors()
    const result = AuthorsComponent(props)
    const html = render(result as VNode)
    expect(html).toContain("By Alex Turner")
    // Publication info should be rendered
    expect(html).toContain("<p>")
  })
})
