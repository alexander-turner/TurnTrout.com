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
import Authors, { formatAuthors } from "../Authors"

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
      name: "two authors",
    },
    {
      authors: ["Alice", "Bob", "Charlie"],
      expected: "Alice, Bob, and Charlie",
      name: "Oxford comma",
    },
    { authors: ["A", "B", "C", "D"], expected: "A, B, C, and D", name: "four authors" },
    {
      authors: ["José García", "François Müller"],
      expected: "José García and François Müller",
      name: "special chars",
    },
  ])("$name", ({ authors, expected }) => {
    expect(formatAuthors(authors)).toBe(expected)
  })
})

describe("Authors component", () => {
  const AuthorsComponent = Authors()

  it.each([
    {
      name: "renders default author when no authors specified",
      frontmatter: { title: "Test" },
      contains: ["By Alex Turner", 'class="authors"'],
      notContains: [],
    },
    {
      name: "renders custom authors from frontmatter",
      frontmatter: { title: "Test", authors: ["John Doe", "Jane Smith"] },
      contains: ["By John Doe and Jane Smith"],
      notContains: [],
    },
    {
      name: "renders publication info when date_published is provided",
      frontmatter: { title: "Test", date_published: new Date("2024-01-15") },
      contains: ["By Alex Turner", "Published"],
      notContains: [],
    },
    {
      name: "renders without publication info when date_published is missing",
      frontmatter: { title: "Test" },
      contains: ["By Alex Turner"],
      notContains: ["Published"],
    },
  ])("$name", ({ frontmatter, contains, notContains }) => {
    const fileData = createFileData({ frontmatter })
    const html = render(preactH(AuthorsComponent, createProps(fileData)))

    contains.forEach((text) => expect(html).toContain(text))
    notContains.forEach((text) => expect(html).not.toContain(text))
  })

  it.each([
    {
      name: "returns null when hide_metadata is true",
      frontmatter: { title: "Test", hide_metadata: true },
    },
    {
      name: "returns null when hide_authors is true",
      frontmatter: { title: "Test", hide_authors: true },
    },
  ])("$name", ({ frontmatter }) => {
    const fileData = createFileData({ frontmatter })
    const html = render(preactH(AuthorsComponent, createProps(fileData)))

    expect(html).toBe("")
  })
})
