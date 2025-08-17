import type { Root, Element as HastElement } from "hast"

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"
import { h as preactH } from "preact"
import { render } from "preact-render-to-string"

import type { QuartzComponentProps } from "../types"

import { type GlobalConfiguration, type QuartzConfig } from "../../cfg"
import { type QuartzPluginData } from "../../plugins/vfile"
import { type BuildCtx } from "../../util/ctx"
import { type FullSlug, resolveRelative } from "../../util/path"
import {
  PageList,
  byDateAndAlphabetical,
  createPageListHast,
  createPageTitleElement,
  createTagsElement,
  createPageItemElement,
} from "../PageList"

// Helper function to create test file data
const createFileData = (overrides: Partial<QuartzPluginData> = {}): QuartzPluginData =>
  ({
    slug: "test" as FullSlug,
    frontmatter: {
      title: "Test Page",
      tags: ["test"],
    },
    ...overrides,
  }) as QuartzPluginData

/****
 * Creates properties based on Quartz plugin data.
 *
 * @param fileData - Data for the current file.
 * @param allFiles - Collection of all file data.
 * @param limit - Optional limit for number of items.
 * @returns The generated properties object.
 */
const createProps = (
  fileData: QuartzPluginData,
  allFiles: QuartzPluginData[],
  limit?: number,
): QuartzComponentProps & { limit?: number } => {
  const cfg = {
    enableSPA: true,
    baseUrl: "http://example.com",
    analytics: { provider: "google", tagId: "dummy" },
    configuration: {},
    plugins: [],
    locale: "en-US",
    defaultDateType: "created",
  } as unknown as GlobalConfiguration

  return {
    fileData,
    allFiles,
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
    limit,
  }
}

describe("byDateAndAlphabetical", () => {
  const cfg = { defaultDateType: "created" } as GlobalConfiguration

  it("sorts by date in descending order when both files have dates", () => {
    const file1 = createFileData({
      dates: { created: new Date("2023-01-01") },
      frontmatter: { title: "A" },
    })
    const file2 = createFileData({
      dates: { created: new Date("2023-02-01") },
      frontmatter: { title: "B" },
    })

    const sorter = byDateAndAlphabetical(cfg)
    expect(sorter(file1, file2)).toBeGreaterThan(0)
    expect(sorter(file2, file1)).toBeLessThan(0)
  })

  it("prioritizes files with dates over files without dates", () => {
    const fileWithDate = createFileData({
      dates: { created: new Date("2023-01-01") },
    })
    const fileWithoutDate = createFileData()

    const sorter = byDateAndAlphabetical(cfg)
    expect(sorter(fileWithDate, fileWithoutDate)).toBeLessThan(0)
    expect(sorter(fileWithoutDate, fileWithDate)).toBeGreaterThan(0)
  })

  it("sorts alphabetically by title when neither file has dates", () => {
    const file1 = createFileData({
      frontmatter: { title: "Alpha" },
    })
    const file2 = createFileData({
      frontmatter: { title: "Beta" },
    })

    const sorter = byDateAndAlphabetical(cfg)
    expect(sorter(file1, file2)).toBeLessThan(0)
    expect(sorter(file2, file1)).toBeGreaterThan(0)
  })
})

describe("createPageListHast", () => {
  it("creates a valid HAST structure", () => {
    const fileData = createFileData()
    const allFiles = [fileData]
    const props = createProps(fileData, allFiles)
    const hast = createPageListHast(props.cfg, fileData, allFiles)

    expect(hast.type).toBe("element")
    expect(hast.tagName).toBe("div")
    expect(hast.properties?.className).toEqual(["page-listing"])
  })

  it("respects the limit parameter", () => {
    const fileData = createFileData()
    const allFiles = [
      createFileData({ slug: "1" as FullSlug }),
      createFileData({ slug: "2" as FullSlug }),
      createFileData({ slug: "3" as FullSlug }),
    ]
    const props = createProps(fileData, allFiles)
    const hast = createPageListHast(props.cfg, fileData, allFiles, 2)

    const listItems = (hast.children[0] as HastElement).children.filter(
      (child): child is HastElement => child.type === "element" && child.tagName === "li",
    )
    expect(listItems).toHaveLength(2)
  })

  it("includes dates when available", () => {
    const fileData = createFileData()
    const fileWithDate = createFileData({
      dates: { created: new Date("2023-01-01") },
    })
    const props = createProps(fileData, [fileWithDate])
    const html = render(preactH(PageList, props))

    expect(html).toContain("time")
    expect(html).toContain("meta")
  })

  it("renders tags correctly", () => {
    const fileData = createFileData()
    const fileWithTags = createFileData({
      frontmatter: {
        title: "Test",
        tags: ["tag1", "tag2"],
      },
    })
    const props = createProps(fileData, [fileWithTags])
    const html = render(preactH(PageList, props))

    expect(html).toContain("tag1")
    expect(html).toContain("tag2")
    expect(html).toContain("tag-link")
  })

  it("handles missing fileData slug", () => {
    const fileData = createFileData({ slug: undefined })
    const allFiles = [fileData]
    const hast = createPageListHast(
      { defaultDateType: "created" } as GlobalConfiguration,
      fileData,
      allFiles,
    )

    expect(hast.type).toBe("element")
    expect(hast.tagName).toBe("div")
    expect(hast.properties?.className).toEqual(["page-listing"])
    // Should still have content, just with empty slug fallback
    expect(hast.children).toHaveLength(1)
  })
})

describe("PageList", () => {
  it("renders without crashing", () => {
    const props = createProps(createFileData(), [])
    const element = preactH(PageList, props)
    expect(element).toBeTruthy()
  })

  it("renders empty list when no files provided", () => {
    const props = createProps(createFileData(), [])
    const html = render(preactH(PageList, props))
    expect(html).toContain("section-ul")
    expect(html).not.toContain("section-li")
  })

  it("renders multiple pages correctly", () => {
    const files = [
      createFileData({
        slug: "page1" as FullSlug,
        frontmatter: { title: "Page 1", tags: ["tag1"] },
      }),
      createFileData({
        slug: "page2" as FullSlug,
        frontmatter: { title: "Page 2", tags: ["tag2"] },
      }),
    ]
    const props = createProps(files[0], files)
    const html = render(preactH(PageList, props))

    expect(html).toContain("Page 1")
    expect(html).toContain("Page 2")
    expect(html).toContain("tag1")
    expect(html).toContain("tag2")
  })

  it("handles files without titles", () => {
    const fileWithoutTitle = createFileData({
      frontmatter: { title: "", tags: ["test"] },
    })
    const props = createProps(fileWithoutTitle, [fileWithoutTitle])
    const html = render(preactH(PageList, props))

    expect(html).toContain("section-li")
    expect(html).toContain("page-listing-title")
  })

  it("handles files without tags", () => {
    const fileWithoutTags = createFileData({
      frontmatter: { title: "Test", tags: [] },
    })
    const props = createProps(fileWithoutTags, [fileWithoutTags])
    const html = render(preactH(PageList, props))

    expect(html).toContain("section-li")
    expect(html).toContain("tags")
  })

  it("renders dividers between pages", () => {
    const files = [
      createFileData({ slug: "page1" as FullSlug }),
      createFileData({ slug: "page2" as FullSlug }),
    ]
    const props = createProps(files[0], files)
    const html = render(preactH(PageList, props))

    expect(html).toContain("page-divider")
    // Should have one less divider than total pages
    expect(html.match(/page-divider/g)?.length).toBe(1)
  })
})

// Additional tests for full coverage

describe("createPageTitleElement", () => {
  it("generates an anchor with correct href and classes", () => {
    const formattedTitle = "My Title"
    const fileDataSlug = "src/page" as FullSlug
    const pageSlug = "dest/page" as FullSlug

    const element = createPageTitleElement(formattedTitle, fileDataSlug, pageSlug) as HastElement

    // Expect a wrapping <p> element with the correct class
    expect(element.tagName).toBe("p")
    expect(element.properties?.className).toEqual(["page-listing-title"])

    // The first (and only) child should be the anchor
    const anchor = element.children[0] as HastElement
    expect(anchor.tagName).toBe("a")
    expect(anchor.properties?.href).toBe(resolveRelative(fileDataSlug, pageSlug))
    expect(anchor.properties?.className).toContain("internal")

    // Ensure the anchor contains the provided title text node
    const textNode = anchor.children[0] as { type: "text"; value: string }
    expect(textNode.type).toBe("text")
    expect(textNode.value).toBe(formattedTitle)
  })
})

describe("createTagsElement", () => {
  it("creates an unordered list of tag links", () => {
    const tags = ["tagA", "tagB"]
    const fileDataSlug = "src/page" as FullSlug

    const element = createTagsElement(tags, fileDataSlug) as HastElement
    expect(element.tagName).toBe("ul")
    expect(element.properties?.className).toEqual(["tags"])

    // Validate each generated anchor
    element.children.forEach((child, idx) => {
      const anchor = child as HastElement
      expect(anchor.tagName).toBe("a")
      expect(anchor.properties?.href).toBe(
        resolveRelative(fileDataSlug, `tags/${tags[idx]}` as FullSlug),
      )

      // Ensure a text node is present (avoid strict typing issues)
      const textNode = anchor.children[0] as { type: "text"; value: string }
      expect(textNode.type).toBe("text")
      expect(textNode.value.length).toBeGreaterThan(0)
    })
  })
})

describe("createPageItemElement", () => {
  const cfg = { defaultDateType: "created" } as GlobalConfiguration

  it("omits the time element when no dates are present", () => {
    const page = createFileData()
    const element = createPageItemElement(page, "src" as FullSlug, cfg) as HastElement

    const timeElements = (element.children as HastElement[]).filter(
      (c) => (c as HastElement).tagName === "time",
    )
    expect(timeElements).toHaveLength(0)
  })

  it("sorts tags by length in descending order", () => {
    const longerTag = "muchlonger"
    const page = createFileData({
      frontmatter: {
        title: "Page",
        tags: ["short", longerTag],
      },
    })

    const element = createPageItemElement(page, "src" as FullSlug, cfg) as HastElement

    const descDiv = (element.children.find((c) => (c as HastElement).tagName === "div") ??
      {}) as HastElement
    const tagsUl = (descDiv.children?.find((c) => (c as HastElement).tagName === "ul") ??
      {}) as HastElement

    const anchorChildren = tagsUl.children as HastElement[]
    expect(anchorChildren).toHaveLength(2)

    const firstAnchorText = (anchorChildren[0].children[0] as { value: string }).value
    expect(firstAnchorText).toBe(longerTag)
  })

  it("handles missing frontmatter tags", () => {
    const page = createFileData({
      frontmatter: { title: "Test" },
    })

    const element = createPageItemElement(page, "src" as FullSlug, cfg) as HastElement
    expect(element.tagName).toBe("div")
    expect(element.properties?.className).toEqual(["section"])
  })

  it("handles missing page slug", () => {
    const page = createFileData({
      slug: undefined,
      frontmatter: { title: "Test" },
    })

    const element = createPageItemElement(page, "src" as FullSlug, cfg) as HastElement

    // Should still create the element successfully with empty slug fallback
    expect(element.tagName).toBe("div")
    expect(element.properties?.className).toEqual(["section"])
  })
})

describe("byDateAndAlphabetical additional branches", () => {
  it("returns 0 when both files have dates but the configured date field is missing", () => {
    const cfg = { defaultDateType: "created" } as GlobalConfiguration

    const file1 = createFileData({ dates: { modified: new Date("2023-03-03") } })
    const file2 = createFileData({ dates: { modified: new Date("2022-01-01") } })

    const sorter = byDateAndAlphabetical(cfg)
    expect(sorter(file1, file2)).toBe(0)
  })

  it("handles files with null titles in alphabetical sorting", () => {
    const cfg = { defaultDateType: "created" } as GlobalConfiguration

    const file1 = createFileData({ frontmatter: { title: "" } })
    const file2 = createFileData({ frontmatter: { title: "Beta" } })

    const sorter = byDateAndAlphabetical(cfg)
    expect(sorter(file1, file2)).toBeLessThan(0) // empty string comes before "Beta"
  })

  it("handles files with missing frontmatter in alphabetical sorting", () => {
    const cfg = { defaultDateType: "created" } as GlobalConfiguration

    const file1 = createFileData({ frontmatter: undefined })
    const file2 = createFileData({ frontmatter: { title: "Beta" } })

    const sorter = byDateAndAlphabetical(cfg)
    expect(sorter(file1, file2)).toBeLessThan(0) // empty string comes before "Beta"
  })

  it("handles second file with missing title in alphabetical sorting", () => {
    const cfg = { defaultDateType: "created" } as GlobalConfiguration

    const file1 = createFileData({ frontmatter: { title: "Alpha" } })
    const file2 = createFileData({ frontmatter: undefined })

    const sorter = byDateAndAlphabetical(cfg)
    expect(sorter(file1, file2)).toBeGreaterThan(0) // "Alpha" comes after empty string
  })
})
