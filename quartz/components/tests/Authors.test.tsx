/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from "@jest/globals"
import { h } from "preact"
import { render } from "preact-render-to-string"

import type { QuartzComponentProps } from "../types"

import { type GlobalConfiguration } from "../../cfg"
import { type QuartzPluginData } from "../../plugins/vfile"
import AuthorsConstructor, { formatAuthors } from "../Authors"

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
  const Component = AuthorsConstructor()
  const cfg = {} as GlobalConfiguration

  const makeProps = (frontmatter: Record<string, unknown> = {}): QuartzComponentProps =>
    ({
      fileData: { frontmatter: { title: "Test", ...frontmatter } } as QuartzPluginData,
      cfg,
    }) as QuartzComponentProps

  it("renders default author when no authors specified", () => {
    const html = render(h(Component, makeProps()))
    expect(html).toContain("By Alex Turner")
  })

  it("renders custom authors", () => {
    const html = render(h(Component, makeProps({ authors: ["Alice", "Bob"] })))
    expect(html).toContain("By Alice and Bob")
  })

  it("returns null when hide_metadata is set", () => {
    const html = render(h(Component, makeProps({ hide_metadata: true })))
    expect(html).toBe("")
  })

  it("returns null when hide_authors is set", () => {
    const html = render(h(Component, makeProps({ hide_authors: true })))
    expect(html).toBe("")
  })

  it("renders publication info when date_published is set", () => {
    const html = render(h(Component, makeProps({ date_published: new Date("2024-01-15") })))
    expect(html).toContain("By Alex Turner")
    expect(html).toContain("2024")
  })
})
