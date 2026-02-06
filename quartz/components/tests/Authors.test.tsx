/**
 * @jest-environment jsdom
 */
import type { Root } from "hast"

import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"
import { h as preactH } from "preact"
import { render } from "preact-render-to-string"

import type { QuartzComponentProps } from "../types"

import { type GlobalConfiguration, type QuartzConfig } from "../../cfg"
import { type QuartzPluginData } from "../../plugins/vfile"
import { type BuildCtx } from "../../util/ctx"
import { type FullSlug } from "../../util/path"
import { formatAuthors } from "../Authors"
import AuthorsConstructor from "../Authors"

const Authors = AuthorsConstructor()

const createFileData = (overrides: Partial<QuartzPluginData> = {}): QuartzPluginData =>
  ({
    slug: "test" as FullSlug,
    frontmatter: {
      title: "Test Page",
    },
    ...overrides,
  }) as QuartzPluginData

const createProps = (fileData: QuartzPluginData): QuartzComponentProps => {
  const cfg = {
    baseUrl: "http://example.com",
    analytics: { provider: "google", tagId: "dummy" },
    configuration: {},
    plugins: [],
  } as unknown as GlobalConfiguration

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
  it.each([
    { frontmatter: { title: "Test", hide_metadata: true }, expected: "", name: "hide_metadata" },
    { frontmatter: { title: "Test", hide_authors: true }, expected: "", name: "hide_authors" },
  ])("returns empty when $name is true", ({ frontmatter, expected }) => {
    const html = render(preactH(Authors, createProps(createFileData({ frontmatter }))))
    expect(html).toBe(expected)
  })

  it.each([
    {
      frontmatter: { title: "Test" },
      contains: ["By Alex Turner", 'class="authors"'],
      notContains: ["Published"],
      name: "default author, no publication info",
    },
    {
      frontmatter: { title: "Test", authors: ["John Doe", "Jane Smith"] },
      contains: ["By John Doe and Jane Smith"],
      notContains: [],
      name: "custom authors",
    },
    {
      frontmatter: {
        title: "Test",
        date_published: new Date("2024-01-15"),
        original_url: "https://example.com",
      },
      contains: ["authors", "Published"],
      notContains: [],
      name: "with publication info",
    },
  ])("renders $name", ({ frontmatter, contains, notContains }) => {
    const html = render(preactH(Authors, createProps(createFileData({ frontmatter }))))
    contains.forEach((text) => expect(html).toContain(text))
    notContains.forEach((text) => expect(html).not.toContain(text))
  })
})
