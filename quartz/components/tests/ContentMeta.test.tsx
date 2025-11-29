import type { Root } from "hast"

/**
 * @jest-environment jsdom
 */
import { jest, describe, it, expect } from "@jest/globals"
// skipcq: JS-W1028
import React from "react"
import { createRoot } from "react-dom/client"

import { type GlobalConfiguration } from "../../cfg"

import "@testing-library/jest-dom"

import { type QuartzPluginData } from "../../plugins/vfile"
import { type FilePath } from "../../util/path"
import {
  ContentMetadata,
  RenderPublicationInfo,
  processReadingTime,
  renderLastUpdated,
  renderReadingTime,
  renderLinkpostInfo,
  renderTags,
  renderSequenceTitleJsx,
  renderPreviousPostJsx,
  renderNextPostJsx,
  renderPostStatistics,
  renderSequenceInfo,
} from "../ContentMeta"
import ContentMeta from "../ContentMeta"
import { type QuartzComponentProps } from "../types"

const LINKPOST_URL = "https://example.com"
const GITHUB_URL_STEM =
  "https://github.com/alexander-turner/TurnTrout.com/blob/main/website_content/"
const TEST_PATH = "folder/test-file.md"
const SEQUENCE_TITLE = "My Sequence"
const SEQUENCE_LINK = "/sequence-page"
const PREV_POST_SLUG = "/prev-post"
const PREV_POST_TITLE = "Previous Post Title"
const PREV_POST_TITLE_CAPS = "PREVIOUS POST TITLE"
const NEXT_POST_SLUG = "/next-post"
const NEXT_POST_TITLE = "Next Post Title"
const NEXT_POST_TITLE_CAPS = "NEXT POST TITLE"
const SOME_TEXT = "some text"

jest.mock("../Backlinks", () => ({
  Backlinks: () => <div data-testid="backlinks">Mocked Backlinks</div>,
}))

jest.mock("../ContentMeta", () => {
  const originalModule = jest.requireActual("../ContentMeta") as object
  return {
    ...originalModule,
    urlCache: new Map(),
    TURNTROUT_FAVICON_PATH: "path/to/turntrout/favicon.png",
  }
})

jest.mock("../Date", () => ({
  DateElement: () => <span data-testid="date-element">Mocked Date</span>,
}))

jest.mock("../../plugins/transformers/linkfavicons", () => ({
  GetQuartzPath: jest.fn(),
  urlCache: new Map(),
  getFaviconPath: () => "/mock/favicon.avif",
}))

const mockConfig = {
  configuration: {
    enableFrontmatterTags: true,
  },
} as unknown as GlobalConfiguration

// Dummy object constructor
const createFileData = (
  overrides = { filePath: "test.md", relativePath: "test.md" } as Partial<QuartzPluginData>,
): QuartzPluginData =>
  ({
    frontmatter: {
      date_published: "2024-03-20",
      ...overrides,
    },
    filePath: overrides?.filePath || "test.md",
    relativePath: overrides?.relativePath || "test.md",
  }) as QuartzPluginData

// Smoke test for RenderPublicationInfo
it("renders without crashing", () => {
  const div = document.createElement("div")
  const root = createRoot(div)

  const cfg = {} as GlobalConfiguration
  const fileData = {} as QuartzPluginData
  const publicationInfo = RenderPublicationInfo(cfg, fileData)
  root.render(publicationInfo as React.ReactElement)
})

describe("processReadingTime", () => {
  it.each([
    // minutes only
    [1, "1 minute"],
    [30, "30 minutes"],
    [59, "59 minutes"],

    // hours only (no remaining minutes)
    [60, "1 hour"],
    [120, "2 hours"],

    // hours and minutes
    [61, "1 hour 1 minute"],
    [62, "1 hour 2 minutes"],
    [122, "2 hours 2 minutes"],
    [150, "2 hours 30 minutes"],

    // edge cases
    [0, ""],
    [0.5, "1 minute"], // rounds up to 1
  ])("should format %i minutes as '%s'", (input, expected) => {
    expect(processReadingTime(input)).toBe(expected)
  })
})

describe("RenderPublicationInfo", () => {
  it("should return null when no date_published", () => {
    const fileData = createFileData({ date_published: undefined })
    const result = RenderPublicationInfo(mockConfig, fileData)
    expect(result).toBeNull()
  })

  it("should return null when hide_metadata is true", () => {
    const fileData = createFileData({ hide_metadata: true })
    const result = RenderPublicationInfo(mockConfig, fileData)
    expect(result).toBeNull()
  })

  it("should render basic publication info without original URL", () => {
    const fileData = createFileData()
    const result = RenderPublicationInfo(mockConfig, fileData)

    expect(result?.type).toBe("span")
    expect(result?.props.className).toBe("publication-str")

    const children = result?.props.children
    // Simplified check - just verify structure exists
    expect(children[0]).toBe("Published on ")
    expect(children[1]).toBeTruthy() // Just verify date element exists
  })

  it("should render publication info with original URL and favicon", () => {
    const fileData = createFileData({
      original_url: "https://example.com/post",
    })
    const result = RenderPublicationInfo(mockConfig, fileData)

    expect(result?.type).toBe("span")
    expect(result?.props.className).toBe("publication-str")

    const children = result?.props.children
    expect(children).toHaveLength(3)

    // Simplified checks
    const [linkElement, separator, dateElement] = children
    expect(linkElement).toBeTruthy()
    expect(separator).toBe(" on ")
    expect(dateElement).toBeTruthy()
  })

  it("should handle invalid original URLs gracefully", () => {
    const fileData = createFileData({
      original_url: "not-a-valid-url",
    })

    expect(() => {
      RenderPublicationInfo(mockConfig, fileData)
    }).toThrow()
  })
})

describe("renderLastUpdated", () => {
  it("should return null when no date_updated", () => {
    const fileData = createFileData()

    const result = renderLastUpdated(mockConfig, fileData)
    expect(result).toBeNull()
  })

  it("should return null when hide_metadata is true", () => {
    const fileData = createFileData({ hide_metadata: true })
    const result = renderLastUpdated(mockConfig, fileData)
    expect(result).toBeNull()
  })

  it("should render update info with github link and date", () => {
    const fileData = createFileData({ date_updated: "2024-03-20" })
    const result = renderLastUpdated(mockConfig, fileData)

    expect(result?.type).toBe("span")
    expect(result?.props.className).toBe("last-updated-str")

    const children = result?.props.children
    expect(children).toHaveLength(3)

    // Check link with favicon
    const linkWithFavicon = children[0]
    expect(linkWithFavicon.type).toBe("a")
    expect(linkWithFavicon.props.href).toContain("github.com")
    expect(linkWithFavicon.props.children).toBe("Updated")
  })

  it("should use correct GitHub URL in link", () => {
    const testPath = TEST_PATH
    const fileData = createFileData({
      date_updated: "2024-03-20",
      relativePath: testPath as FilePath,
      filePath: testPath as FilePath,
    }) as QuartzPluginData

    const result = renderLastUpdated(mockConfig, fileData)
    const linkElement = result?.props.children[0]

    expect(linkElement.props.href).toBe(`${GITHUB_URL_STEM}${testPath}`)
  })
})

describe("renderReadingTime", () => {
  it("should return empty element when hide_reading_time is true", () => {
    const fileData = createFileData({
      hide_reading_time: true,
      text: SOME_TEXT,
    }) as QuartzPluginData

    const result = renderReadingTime(fileData)
    expect(result).toBeTruthy()
    expect(result.props?.children).toBeFalsy()
  })
})

describe("renderLinkpostInfo", () => {
  it("should return null when no linkpost URL exists", () => {
    const fileData = createFileData()
    const result = renderLinkpostInfo(fileData)
    expect(result).toBeNull()
  })

  it("should render linkpost info with hostname and favicon", () => {
    const testUrl = "https://www.example.com/post"
    const fileData = createFileData({
      "lw-linkpost-url": testUrl,
    })
    const result = renderLinkpostInfo(fileData)

    expect(result?.type).toBe("span")
    expect(result?.props.className).toBe("linkpost-info")

    const children = result?.props.children
    expect(children[0]).toBe("Originally linked to")
    expect(children[1]).toBe(" ")

    const linkElement = children[2]
    expect(linkElement.type).toBe("a")
    expect(linkElement.props.href).toBe(testUrl)
    expect(linkElement.props.className).toBe("external")
    expect(linkElement.props.target).toBe("_blank")
    expect(linkElement.props.rel).toBe("noopener noreferrer")

    const codeElement = linkElement.props.children
    expect(codeElement.type).toBe("code")
    expect(codeElement.props.children).toBe("example.com")
  })

  it("should handle URLs with www prefix", () => {
    const testUrl = "https://www.test-site.com/path"
    const fileData = createFileData({
      "lw-linkpost-url": testUrl,
    })
    const result = renderLinkpostInfo(fileData)
    expect(result).not.toBeNull()

    const linkElement = result?.props.children[2]
    expect(linkElement).toBeTruthy()
    expect(linkElement.type).toBe("a")
    expect(linkElement.props.href).toBe(testUrl)

    const codeElement = linkElement.props.children
    expect(codeElement.type).toBe("code")
    expect(codeElement.props.children).toBe("test-site.com")
  })

  it("should handle URLs without protocol", () => {
    const fileData = createFileData({
      "lw-linkpost-url": "test-domain.org/path",
    })
    expect(() => renderLinkpostInfo(fileData)).toThrow()
  })
})

describe("renderTags", () => {
  // Mock props given fileData
  const mockProps = (fileData: QuartzPluginData): QuartzComponentProps => ({
    fileData,
    cfg: mockConfig,
    tree: { type: "root", children: [] } as Root,
    allFiles: [],
    children: [],
    externalResources: {
      css: [],
      js: [],
    },
    ctx: {
      argv: {
        directory: "",
        verbose: false,
        output: "",
        serve: false,
        port: 8080,
        concurrency: 1,
        fastRebuild: false,
        wsPort: 8081,
      },
      cfg: {
        configuration: mockConfig,
        plugins: { transformers: [], filters: [], emitters: [] },
      },
      allSlugs: [],
    },
  })

  it("should return an empty fragment when no tags are present", () => {
    const fileData = createFileData({ tags: undefined })
    const props = mockProps(fileData)
    const result = renderTags(props)
    const div = document.createElement("div")
    const root = createRoot(div)
    root.render(result as React.ReactElement)
    expect(div.innerHTML).toBe("")
  })

  it("should return an empty fragment when tags array is empty", () => {
    const fileData = createFileData({ tags: [] })
    const props = mockProps(fileData)
    const result = renderTags(props)
    const div = document.createElement("div")
    const root = createRoot(div)
    root.render(result as React.ReactElement)
    expect(div.innerHTML).toBe("")
  })

  it("should render tags when they are present", () => {
    const fileData = createFileData({ tags: ["tag1", "tag2"] })
    const props = mockProps(fileData)
    const result = renderTags(props)
    expect(result.type).toBe("blockquote")
    expect(result.props["data-admonition"]).toContain("tag")
    // Check for title and content
    expect(result.props.children[0].props.className).toBe("admonition-title")
    expect(result.props.children[1].props.id).toBe("tags")
  })
})

describe("renderSequenceTitleJsx", () => {
  it("should return null if no sequence title", () => {
    const fileData = createFileData({})
    const result = renderSequenceTitleJsx(fileData)
    expect(result).toBeNull()
  })

  it("should render sequence title", () => {
    const fileData = createFileData({
      "lw-sequence-title": SEQUENCE_TITLE,
      "sequence-link": SEQUENCE_LINK,
    })
    const result = renderSequenceTitleJsx(fileData)
    expect(result).not.toBeNull()
    expect(result?.type).toBe("span")
    const link = result?.props.children[2]
    expect(link.type).toBe("a")
    expect(link.props.href).toBe(SEQUENCE_LINK)
    expect(link.props.children).toBe(SEQUENCE_TITLE)
  })
})

describe("renderPreviousPostJsx", () => {
  it("should return null if no previous post", () => {
    const fileData = createFileData({})
    const result = renderPreviousPostJsx(fileData)
    expect(result).toBeNull()
  })

  it("should render previous post link", () => {
    const fileData = createFileData({
      "prev-post-slug": PREV_POST_SLUG,
      "prev-post-title": PREV_POST_TITLE,
    })
    const result = renderPreviousPostJsx(fileData)
    expect(result).not.toBeNull()
    expect(result?.type).toBe("p")
    const link = result?.props.children[2]
    expect(link.type).toBe("a")
    expect(link.props.href).toBe(PREV_POST_SLUG)
    expect(link.props.children).toBe(PREV_POST_TITLE)
  })

  it("should format all-caps title", () => {
    const fileData = createFileData({
      "prev-post-slug": PREV_POST_SLUG,
      "prev-post-title": PREV_POST_TITLE_CAPS,
    })
    const result = renderPreviousPostJsx(fileData)
    const link = result?.props.children[2]
    expect(link.props.children).toBe(PREV_POST_TITLE_CAPS)
  })
})

describe("renderNextPostJsx", () => {
  it("should return null if no next post", () => {
    const fileData = createFileData({})
    const result = renderNextPostJsx(fileData)
    expect(result).toBeNull()
  })

  it("should render next post link", () => {
    const fileData = createFileData({
      "next-post-slug": NEXT_POST_SLUG,
      "next-post-title": NEXT_POST_TITLE,
    })
    const result = renderNextPostJsx(fileData)
    expect(result).not.toBeNull()
    expect(result?.type).toBe("p")
    const link = result?.props.children[2]
    expect(link.type).toBe("a")
    expect(link.props.href).toBe(NEXT_POST_SLUG)
    expect(link.props.children).toBe(NEXT_POST_TITLE)
  })

  it("should format all-caps title", () => {
    const fileData = createFileData({
      "next-post-slug": NEXT_POST_SLUG,
      "next-post-title": NEXT_POST_TITLE_CAPS,
    })
    const result = renderNextPostJsx(fileData)
    const link = result?.props.children[2]
    expect(link.props.children).toBe(NEXT_POST_TITLE_CAPS)
  })
})

describe("renderSequenceInfo", () => {
  it("should render only the sequence title when no prev/next posts", () => {
    const fileData = createFileData({
      "lw-sequence-title": SEQUENCE_TITLE,
      "sequence-link": SEQUENCE_LINK,
    })

    const result = renderSequenceInfo(fileData)

    expect(result).not.toBeNull()
    expect(result?.type).toBe("blockquote")

    // Check for title
    const title = result?.props.children[0]
    expect(title).not.toBeNull()
    const titleInner = title.props.children
    const sequenceTitleJsx = titleInner.props.children[1]
    const titleLink = sequenceTitleJsx.props.children[2]
    expect(titleLink.props.children).toBe(SEQUENCE_TITLE)

    // Check that prev/next are not rendered
    const content = result?.props.children[1]
    expect(content.props.children[0]).toBeNull()
    expect(content.props.children[1]).toBeNull()
  })
})

describe("renderPostStatistics", () => {
  // Mock props given fileData
  const mockProps = (fileData: QuartzPluginData): QuartzComponentProps => ({
    fileData,
    cfg: mockConfig,
    tree: { type: "root", children: [] } as Root,
    allFiles: [],
    children: [],
    externalResources: {
      css: [],
      js: [],
    },
    ctx: {
      argv: {
        directory: "",
        verbose: false,
        output: "",
        serve: false,
        port: 8080,
        concurrency: 1,
        fastRebuild: false,
        wsPort: 8081,
      },
      cfg: {
        configuration: mockConfig,
        plugins: { transformers: [], filters: [], emitters: [] },
      },
      allSlugs: [],
    },
  })
  it("should render post statistics with all info present", () => {
    const fileData = createFileData({
      "lw-linkpost-url": LINKPOST_URL,
      date_published: "2024-01-01",
      date_updated: "2024-01-02",
    })
    fileData.text = SOME_TEXT
    const props = mockProps(fileData)
    const result = renderPostStatistics(props)

    expect(result).not.toBeNull()
    expect(result?.type).toBe("blockquote")
    const listItems = result?.props.children[1].props.children.props.children
    const filteredItems = listItems.filter(Boolean)
    expect(filteredItems).toHaveLength(4) // reading time, linkpost, published, updated
  })

  it("should render only available info", () => {
    const fileData = createFileData({
      date_published: "2024-01-01",
    })
    fileData.text = SOME_TEXT
    const props = mockProps(fileData)
    const result = renderPostStatistics(props)

    expect(result).not.toBeNull()
    const listItems = result?.props.children[1].props.children.props.children
    const filteredItems = listItems.filter(Boolean)
    expect(filteredItems).toHaveLength(2) // reading time, published
  })

  it("should render with no info", () => {
    const fileData = createFileData({
      date_published: undefined,
    })
    fileData.text = "" // so reading time is 0
    const props = mockProps(fileData)
    const result = renderPostStatistics(props)

    expect(result).not.toBeNull()
    const listItems = result?.props.children[1].props.children.props.children
    const filteredItems = listItems.filter(Boolean)
    // readingTime is not null, so it will be 1
    expect(filteredItems).toHaveLength(1)
  })
})

// Smoke test for ContentMetadata
it("renders without crashing", () => {
  const div = document.createElement("div")
  const root = createRoot(div)
  const fileData = createFileData()
  const quartzProps = {
    fileData,
    cfg: mockConfig,
  }
  const result = ContentMetadata(quartzProps as QuartzComponentProps)
  root.render(result as React.ReactElement)
})

describe("ContentMetadata", () => {
  // Mock props given fileData
  const mockProps = (fileData: QuartzPluginData): QuartzComponentProps => ({
    fileData,
    cfg: mockConfig,
    tree: { type: "root", children: [] } as Root,
    allFiles: [],
    children: [],
    externalResources: {
      css: [],
      js: [],
    },
    ctx: {
      argv: {
        directory: "",
        verbose: false,
        output: "",
        serve: false,
        port: 8080,
        concurrency: 1,
        fastRebuild: false,
        wsPort: 8081,
      },
      cfg: {
        configuration: mockConfig,
        plugins: { transformers: [], filters: [], emitters: [] },
      },
      allSlugs: [],
    },
  })

  it("should render a div with a non-breaking space if hide_metadata is true", () => {
    const fileData = createFileData({ hide_metadata: true })
    const props = mockProps(fileData)
    const result = ContentMetadata(props)
    expect(result).not.toBeNull()
    expect(result?.type).toBe("div")
    expect(result?.props.id).toBe("content-meta")
    expect(result?.props.children).toBe(undefined)
  })

  it("should render an empty content-meta div when no metadata is present and text is empty", () => {
    const fileData = createFileData({ date_published: undefined, tags: undefined })
    delete (fileData as Partial<QuartzPluginData>).text
    const props = mockProps(fileData)

    const result = ContentMetadata(props)
    expect(result).not.toBeNull()
    expect(result?.type).toBe("div")
    expect(result?.props.id).toBe("content-meta")
    const children = result?.props.children as (React.ReactElement | null)[]
    const flatChildren = children.flat().filter(Boolean)
    expect(flatChildren).toHaveLength(0)
  })

  it("should render metadata when text and frontmatter is present", () => {
    const fileData = createFileData({
      tags: ["test"],
      date_published: "2024-01-01",
    })
    fileData.text = SOME_TEXT
    const props = mockProps(fileData)

    const result = ContentMetadata(props)
    expect(result).not.toBeNull()
    const children = result?.props.children as (React.ReactElement | null)[]
    const flatChildren = children.flat().filter(Boolean)

    // renderTags, renderPostStatistics, and Backlinks
    expect(flatChildren.length).toBe(3)
  })

  it("should not render backlinks or metadata when text is empty", () => {
    const fileData = createFileData({
      tags: ["test"],
      date_published: "2024-01-01",
    })
    delete (fileData as Partial<QuartzPluginData>).text
    const props = mockProps(fileData)

    const result = ContentMetadata(props)
    expect(result).not.toBeNull()
    const children = result?.props.children as (React.ReactElement | null)[]
    const flatChildren = children.flat().filter(Boolean)
    expect(flatChildren.length).toBe(0)
  })
})

describe("date handling", () => {
  it("should handle different date_updated and date_published values", () => {
    const fileData = createFileData({
      date_published: new Date("2024-01-01"),
      date_updated: new Date("2024-03-20"),
    })

    const publicationInfo = RenderPublicationInfo(mockConfig, fileData)
    const updateInfo = renderLastUpdated(mockConfig, fileData)

    // Verify both elements are rendered
    expect(publicationInfo).not.toBeNull()
    expect(updateInfo).not.toBeNull()

    // Verify they have different dates in their props
    const publicationDate = publicationInfo?.props.children[1].props.date
    const updateDate = updateInfo?.props.children[2].props.date

    expect(publicationDate.getTime()).not.toBe(updateDate.getTime())
    expect(publicationDate).toEqual(new Date("2024-01-01"))
    expect(updateDate).toEqual(new Date("2024-03-20"))
  })
})

describe("Default export", () => {
  it("should return the ContentMetadata component", () => {
    const component = ContentMeta()
    expect(component).toBe(ContentMetadata)
  })
})
