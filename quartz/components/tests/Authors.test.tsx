import { jest, describe, it, expect, beforeEach } from "@jest/globals"

import type { QuartzPluginData } from "../../plugins/vfile"

import Authors, { formatAuthors } from "../Authors"

const mockRenderPublicationInfo = jest.fn()
jest.mock("../ContentMeta", () => ({
  RenderPublicationInfo: (...args: unknown[]) => mockRenderPublicationInfo(...args),
}))

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

const createFileData = (overrides: Partial<QuartzPluginData> = {}): QuartzPluginData =>
  ({
    frontmatter: { title: "Test", tags: [], ...overrides.frontmatter },
    slug: "test",
    ...overrides,
  }) as QuartzPluginData

describe("Authors component", () => {
  const AuthorsComponent = Authors()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const makeProps = (fileData: QuartzPluginData): any => ({
    fileData,
    cfg: {},
  })

  beforeEach(() => {
    mockRenderPublicationInfo.mockReturnValue("Publication info text")
  })

  it("returns null when hide_metadata is true", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: [], hide_metadata: true },
    })
    const result = AuthorsComponent(makeProps(fileData))
    expect(result).toBeNull()
  })

  it("returns null when hide_authors is true", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: [], hide_authors: true },
    })
    const result = AuthorsComponent(makeProps(fileData))
    expect(result).toBeNull()
  })

  it("renders default author when no authors specified", () => {
    const fileData = createFileData()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = AuthorsComponent(makeProps(fileData)) as any
    expect(result).not.toBeNull()
    expect(result.props.children[0].props.children).toBe("By Alex Turner")
  })

  it("renders custom authors", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: [], authors: ["Jane Doe"] },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = AuthorsComponent(makeProps(fileData)) as any
    expect(result).not.toBeNull()
    expect(result.props.children[0].props.children).toBe("By Jane Doe")
  })

  it("includes publication info section in output structure", () => {
    const fileData = createFileData()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = AuthorsComponent(makeProps(fileData)) as any
    expect(result).not.toBeNull()
    // Verify the component structure has author text and publication info area
    expect(result.props.className).toBe("authors")
    expect(result.props.children).toHaveLength(2)
  })

  it("does not render publication info paragraph when unavailable", () => {
    mockRenderPublicationInfo.mockReturnValue(null)
    const fileData = createFileData()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = AuthorsComponent(makeProps(fileData)) as any
    expect(result).not.toBeNull()
    // children[1] should be falsy when no publication info
    expect(result.props.children[1]).toBeFalsy()
  })
})
