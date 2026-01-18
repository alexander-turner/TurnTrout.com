/**
 * @jest-environment jsdom
 */

import type { Root } from "hast"

import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"
import { JSX } from "preact"
import { render } from "preact-render-to-string"

import type { QuartzComponentProps } from "../types"

import { type GlobalConfiguration } from "../../cfg"
import { type QuartzPluginData } from "../../plugins/vfile"
import { type BuildCtx } from "../../util/ctx"
import { type FullSlug } from "../../util/path"
import { PageList } from "../PageList"
import {
  AllPosts,
  allSlug,
  allTitle,
  allDescription,
  allPostsListing,
  generateAllPostsBlock,
} from "../pages/AllPosts"

const callAllPosts = AllPosts as (props: QuartzComponentProps) => JSX.Element

/**
 * Create test file data with default values.
 *
 * @param overrides - Optional properties to override default values
 * @returns A QuartzPluginData object for testing
 */
const createFileData = (overrides: Partial<QuartzPluginData> = {}): QuartzPluginData =>
  ({
    slug: "test" as FullSlug,
    frontmatter: {
      title: "Test Page",
    },
    ...overrides,
  }) as QuartzPluginData

/**
 * Create test props for AllPosts component.
 *
 * @param fileData - Optional file data for the current page
 * @param allFiles - Optional array of all files in the site
 * @returns A QuartzComponentProps object for testing
 */
const createProps = (
  fileData?: Partial<QuartzPluginData>,
  allFiles?: QuartzPluginData[],
): QuartzComponentProps => {
  const cfg = {
    baseUrl: "http://example.com",
    analytics: { provider: "google", tagId: "dummy" },
    configuration: {},
    plugins: [],
    locale: "en-US",
    defaultDateType: "created",
  } as unknown as GlobalConfiguration

  const mockFileData = fileData
    ? ({ ...createFileData(), ...fileData } as QuartzPluginData)
    : createFileData()

  return {
    fileData: mockFileData,
    allFiles: allFiles ?? [],
    cfg,
    ctx: {
      cfg: {} as unknown,
      allSlugs: [] as FullSlug[],
      argv: {} as unknown,
    } as BuildCtx,
    externalResources: { css: [], js: [] },
    children: [],
    tree: h("root") as unknown as Root,
    displayClass: undefined,
  }
}

describe("AllPosts exports", () => {
  it("exports the correct constants", () => {
    expect(allSlug).toBe("all-posts")
    expect(allTitle).toBe("All Posts")
    expect(allDescription).toBe("A listing of all posts on turntrout.com.")
    expect(allPostsListing).toBe("all-posts-listing")
  })
})

describe("generateAllPostsBlock", () => {
  it("generates a block with correct structure and attributes", () => {
    const mockProps = createProps()
    const result = generateAllPostsBlock(mockProps)

    expect(result.type).toBe("span")
    expect(result.props.id).toBe("all-posts-listing")
    expect(result.props["data-url"]).toBe("all-posts-listing")
    expect(result.props["data-block"]).toBe("all-posts-listing")
  })

  it("wraps PageList in span with correct structure", () => {
    const mockProps = createProps()
    const result = generateAllPostsBlock(mockProps)

    expect(result.props.children).toBeDefined()
    expect(result.props.children.type).toBe(PageList)
  })

  it("passes through props to PageList", () => {
    const mockFileData = createFileData({ frontmatter: { title: "Custom Title" } })
    const mockAllFiles = [mockFileData]
    const mockProps = createProps(mockFileData, mockAllFiles)

    const result = generateAllPostsBlock(mockProps)
    const pageListElement = result.props.children

    // Verify PageList receives the exact props passed to generateAllPostsBlock
    expect(pageListElement.type).toBe(PageList)
    expect(pageListElement.props).toEqual(mockProps)
  })
})

describe("AllPosts component", () => {
  it("renders with correct structure for basic case", () => {
    const mockProps = createProps()
    const result = callAllPosts(mockProps)

    expect(result.type).toBe("div")
    expect(result.props.className).toBe("previewable")
    expect(result.props.children.type).toBe("article")
  })

  it("renders correct post count", () => {
    const mockAllFiles = [
      createFileData({ slug: "post1" as FullSlug }),
      createFileData({ slug: "post2" as FullSlug }),
      createFileData({ slug: "post3" as FullSlug }),
    ]
    const mockProps = createProps({}, mockAllFiles)
    const html = render(callAllPosts(mockProps))

    expect(html).toContain("This site has 3 blog posts.")
    expect(html).toContain("<article")
    expect(html).toContain('id="all-posts-listing"')
  })

  it("handles single post correctly", () => {
    const mockAllFiles = [createFileData({ slug: "single-post" as FullSlug })]
    const mockProps = createProps({}, mockAllFiles)
    const result = callAllPosts(mockProps)

    const article = result.props.children
    const paragraph = article.props.children[0]
    expect(paragraph.props.children).toEqual(["This site has ", 1, " blog posts."])
  })

  it("handles zero posts", () => {
    const mockProps = createProps({}, [])
    const result = callAllPosts(mockProps)

    const article = result.props.children
    const paragraph = article.props.children[0]
    expect(paragraph.props.children).toEqual(["This site has ", 0, " blog posts."])
  })

  it("includes CSS classes from frontmatter", () => {
    const mockFileData = createFileData({
      frontmatter: {
        title: "Test",
        cssclasses: ["custom-class", "another-class"],
      },
    })
    const mockProps = createProps(mockFileData)
    const result = callAllPosts(mockProps)

    expect(result.props.className).toBe("previewable custom-class another-class")
  })

  it("handles empty CSS classes array", () => {
    const mockFileData = createFileData({
      frontmatter: {
        title: "Test",
        cssclasses: [],
      },
    })
    const mockProps = createProps(mockFileData)
    const result = callAllPosts(mockProps)

    expect(result.props.className).toBe("previewable")
  })

  it("handles undefined CSS classes", () => {
    const mockFileData = createFileData({
      frontmatter: {
        title: "Test",
        cssclasses: undefined,
      },
    })
    const mockProps = createProps(mockFileData)
    const result = callAllPosts(mockProps)

    expect(result.props.className).toBe("previewable")
  })

  it("handles missing frontmatter", () => {
    const mockFileData = createFileData({ frontmatter: undefined })
    const mockProps = createProps(mockFileData)
    const result = callAllPosts(mockProps)

    expect(result.props.className).toBe("previewable")
  })

  it("includes the PageList block in the article", () => {
    const mockProps = createProps()
    const result = callAllPosts(mockProps)

    const article = result.props.children
    const children = article.props.children

    expect(children).toHaveLength(2)
    expect(children[0].type).toBe("p")
    expect(children[1].type).toBe("span")
    expect(children[1].props.id).toBe("all-posts-listing")
  })

  it("has attached CSS style", () => {
    expect(AllPosts.css).toBeDefined()
    expect(typeof AllPosts.css).toBe("object")
  })

  it("renders to HTML without errors", () => {
    const mockAllFiles = [
      createFileData({
        slug: "test-post" as FullSlug,
        frontmatter: { title: "Test Post" },
      }),
    ]
    const mockProps = createProps({}, mockAllFiles)

    expect(() => {
      render(callAllPosts(mockProps))
    }).not.toThrow()
  })

  it("passes all props to generateAllPostsBlock", () => {
    const mockFileData = createFileData({
      slug: "custom-page" as FullSlug,
      frontmatter: { title: "Custom Page" },
    })
    const mockAllFiles = [mockFileData]
    const mockProps = createProps(mockFileData, mockAllFiles)

    const result = callAllPosts(mockProps)
    const article = result.props.children
    const pageListBlock = article.props.children[1]

    // Verify the PageList within the block receives the correct props
    expect(pageListBlock.type).toBe("span")
    expect(pageListBlock.props.id).toBe("all-posts-listing")

    const pageListElement = pageListBlock.props.children
    expect(pageListElement.type).toBe(PageList)
    expect(pageListElement.props).toEqual(mockProps)
  })

  it("maintains component structure with complex frontmatter", () => {
    const mockFileData = createFileData({
      frontmatter: {
        title: "Complex Page",
        cssclasses: ["test-class"],
        tags: ["tag1", "tag2"],
        description: "A test description",
        custom_property: "custom_value",
      },
    })
    const mockProps = createProps(mockFileData, [mockFileData])
    const result = callAllPosts(mockProps)

    expect(result.type).toBe("div")
    expect(result.props.className).toBe("previewable test-class")

    const article = result.props.children
    expect(article.type).toBe("article")
    expect(article.props.children).toHaveLength(2)
  })
})

describe("AllPosts default export", () => {
  it("exports AllPosts as default", () => {
    // This test ensures the default export is working
    const mockProps = createProps()
    const result = callAllPosts(mockProps)
    expect(result).toBeDefined()
    expect(result.type).toBe("div")
  })
})
