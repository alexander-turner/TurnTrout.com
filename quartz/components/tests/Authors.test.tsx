/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from "@jest/globals"
import { h } from "preact"
import { render } from "preact-render-to-string"

import { type GlobalConfiguration } from "../../cfg"
import { type QuartzPluginData } from "../../plugins/vfile"
import Authors, { formatAuthors } from "../Authors"
import { type QuartzComponentProps } from "../types"

const mockCfg = { locale: "en-US" } as unknown as GlobalConfiguration

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
  const Component = Authors()

  it.each([
    { field: "hide_metadata", value: true },
    { field: "hide_authors", value: true },
  ])("returns null when $field is $value", ({ field, value }) => {
    const fileData = { frontmatter: { title: "Test", [field]: value } } as QuartzPluginData
    const html = render(h(Component, { fileData, cfg: mockCfg } as QuartzComponentProps))
    expect(html).toBe("")
  })

  it("renders default author when no authors provided", () => {
    const fileData = { frontmatter: { title: "Test" } } as QuartzPluginData
    const html = render(h(Component, { fileData, cfg: mockCfg } as QuartzComponentProps))
    expect(html).toContain("By Alex Turner")
  })

  it("renders custom authors", () => {
    const fileData = {
      frontmatter: { title: "Test", authors: ["Jane Doe", "John Smith"] },
    } as QuartzPluginData
    const html = render(h(Component, { fileData, cfg: mockCfg } as QuartzComponentProps))
    expect(html).toContain("By Jane Doe and John Smith")
  })

  it("renders publication info when date_published present", () => {
    const fileData = {
      frontmatter: { title: "Test", date_published: new Date("2024-01-15") },
    } as QuartzPluginData
    const html = render(h(Component, { fileData, cfg: mockCfg } as QuartzComponentProps))
    expect(html).toContain("By Alex Turner")
    expect(html).toContain("January")
  })
})
