/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from "@jest/globals"
import { h } from "preact"
import { render } from "preact-render-to-string"

import type { GlobalConfiguration } from "../../cfg"
import type { QuartzPluginData } from "../../plugins/vfile"
import type { QuartzComponentProps } from "../types"

import { formatAuthors } from "../Authors"
import Authors from "../Authors"

const createProps = (
  frontmatter: Partial<QuartzPluginData["frontmatter"]> = {},
): QuartzComponentProps =>
  ({
    fileData: {
      frontmatter: { title: "Test", ...frontmatter },
    } as QuartzPluginData,
    cfg: {} as GlobalConfiguration,
  }) as QuartzComponentProps

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
  const AuthorsComponent = Authors()

  it("returns null when hide_metadata is true", () => {
    const html = render(h(AuthorsComponent, createProps({ hide_metadata: true })))
    expect(html).toBe("")
  })

  it("returns null when hide_authors is true", () => {
    const html = render(h(AuthorsComponent, createProps({ hide_authors: true })))
    expect(html).toBe("")
  })

  it("renders default author when no authors specified", () => {
    const html = render(h(AuthorsComponent, createProps()))
    expect(html).toContain("By Alex Turner")
  })

  it("renders specified authors", () => {
    const html = render(h(AuthorsComponent, createProps({ authors: ["John Doe", "Jane Smith"] })))
    expect(html).toContain("By John Doe and Jane Smith")
  })

  it("renders with authors div class", () => {
    const html = render(h(AuthorsComponent, createProps()))
    expect(html).toContain('class="authors"')
  })

  it("renders publication info when date_published is present", () => {
    const html = render(
      h(AuthorsComponent, createProps({ date_published: new Date("2024-03-20") })),
    )
    // When date_published exists, RenderPublicationInfo returns content
    expect(html).toContain("<p>")
    // Should have two <p> tags - one for authors, one for publication info
    expect((html.match(/<p>/g) || []).length).toBe(2)
  })
})
