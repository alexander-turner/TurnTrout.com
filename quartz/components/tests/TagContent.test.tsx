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
import { type FilePath, type FullSlug } from "../../util/path"
import { PageList } from "../PageList"
import TagContentConstructor from "../pages/TagContent"

const TagContent = TagContentConstructor()
const callTagContent = TagContent as (props: QuartzComponentProps) => JSX.Element

type ChildWithProps = { type?: unknown; props?: { className?: string; children?: unknown } }

function findChildByClassName(children: unknown, className: string): ChildWithProps | undefined {
  if (!Array.isArray(children)) return undefined

  return children.find((child): child is ChildWithProps => {
    if (!child || typeof child !== "object") return false
    const props = (child as ChildWithProps).props
    return props?.className === className
  })
}

function findChild(
  children: unknown,
  predicate: (child: ChildWithProps) => boolean,
): ChildWithProps | undefined {
  if (!Array.isArray(children)) return undefined

  return children.find((child): child is ChildWithProps => {
    if (!child || typeof child !== "object") return false
    return predicate(child as ChildWithProps)
  })
}

const createFileData = (overrides: Partial<QuartzPluginData> = {}): QuartzPluginData =>
  ({
    slug: "tags/test-tag" as FullSlug,
    frontmatter: { title: "Test Tag", tags: [] },
    description: "Test tag description",
    ...overrides,
  }) as QuartzPluginData

const createProps = (
  fileData?: Partial<QuartzPluginData>,
  allFiles?: QuartzPluginData[],
): QuartzComponentProps => ({
  fileData: fileData
    ? ({ ...createFileData(), ...fileData } as QuartzPluginData)
    : createFileData(),
  allFiles: allFiles ?? [],
  cfg: {
    baseUrl: "http://example.com",
    analytics: { provider: "google", tagId: "dummy" },
    configuration: {},
    plugins: [],
    locale: "en-US",
    defaultDateType: "created",
  } as unknown as GlobalConfiguration,
  ctx: {
    cfg: {} as unknown,
    allSlugs: [] as FullSlug[],
    argv: {} as unknown,
  } as BuildCtx,
  externalResources: { css: [], js: [] },
  children: [],
  tree: h("root") as unknown as Root,
  displayClass: undefined,
})

describe("TagContent component", () => {
  it("renders with correct structure for basic case", () => {
    const mockProps = createProps()
    const result = callTagContent(mockProps)

    expect(result.type).toBe("article")
    expect(result.props.className).toBe("previewable")
  })

  it("throws error for non-tag page", () => {
    expect(() =>
      callTagContent(createProps(createFileData({ slug: "not-a-tag" as FullSlug }))),
    ).toThrow('Component "TagContent" tried to render a non-tag page: not-a-tag')
  })

  it("renders correct post count for tag", () => {
    const mockAllFiles = [
      createFileData({
        slug: "post1" as FullSlug,
        frontmatter: { title: "Post 1", tags: ["test-tag"] },
      }),
      createFileData({
        slug: "post2" as FullSlug,
        frontmatter: { title: "Post 2", tags: ["test-tag"] },
      }),
      createFileData({
        slug: "post3" as FullSlug,
        frontmatter: { title: "Post 3", tags: ["other-tag"] },
      }),
    ]
    const mockProps = createProps({}, mockAllFiles)
    const html = render(callTagContent(mockProps))

    expect(html).toContain("2 items with this tag.")
    expect(html).toContain("<article")
  })

  it("handles single post with tag", () => {
    const html = render(
      callTagContent(
        createProps({}, [
          createFileData({
            slug: "single-post" as FullSlug,
            frontmatter: { title: "Single Post", tags: ["test-tag"] },
          }),
        ]),
      ),
    )

    expect(html).toContain("1 item with this tag.")
  })

  it("handles zero posts with tag", () => {
    expect(render(callTagContent(createProps({}, [])))).toContain("0 items with this tag.")
  })

  it("includes CSS classes from frontmatter", () => {
    const result = callTagContent(
      createProps(
        createFileData({
          frontmatter: { title: "Test", cssclasses: ["custom-class", "another-class"] },
        }),
      ),
    )

    expect(result.props.className).toBe("previewable custom-class another-class")
  })

  it("handles empty CSS classes array", () => {
    expect(
      callTagContent(
        createProps(
          createFileData({
            frontmatter: { title: "Test", cssclasses: [] },
          }),
        ),
      ).props.className,
    ).toBe("previewable")
  })

  it("handles undefined CSS classes", () => {
    expect(
      callTagContent(
        createProps(
          createFileData({
            frontmatter: { title: "Test", cssclasses: undefined },
          }),
        ),
      ).props.className,
    ).toBe("previewable")
  })

  it("handles missing frontmatter", () => {
    expect(
      callTagContent(createProps(createFileData({ frontmatter: undefined }))).props.className,
    ).toBe("previewable")
  })

  it("renders description when tree is empty", () => {
    const html = render(
      callTagContent(createProps(createFileData({ description: "Custom tag description" }))),
    )

    expect(html).toContain("Custom tag description")
  })

  it("filters posts by tag correctly with nested tags", () => {
    const html = render(
      callTagContent(
        createProps({}, [
          createFileData({
            slug: "post1" as FullSlug,
            frontmatter: { title: "Post 1", tags: ["test-tag/nested"] },
          }),
          createFileData({
            slug: "post2" as FullSlug,
            frontmatter: { title: "Post 2", tags: ["test-tag"] },
          }),
          createFileData({
            slug: "post3" as FullSlug,
            frontmatter: { title: "Post 3", tags: ["other-tag"] },
          }),
        ]),
      ),
    )

    // Both posts with "test-tag" and "test-tag/nested" should be included
    expect(html).toContain("2 items with this tag.")
  })

  it("handles tags index page", () => {
    // Should not throw error for 'tags' slug
    expect(() =>
      callTagContent(
        createProps(createFileData({ slug: "tags" as FullSlug }), [
          createFileData({
            slug: "post1" as FullSlug,
            frontmatter: { title: "Post 1", tags: ["tag1"] },
          }),
          createFileData({
            slug: "post2" as FullSlug,
            frontmatter: { title: "Post 2", tags: ["tag2"] },
          }),
        ]),
      ),
    ).not.toThrow()
  })

  it("throws error when slug is undefined", () => {
    // createFileData expects `slug: FullSlug`, but this test intentionally passes invalid input.
    expect(() =>
      callTagContent(createProps(createFileData({ slug: undefined as unknown as FullSlug }))),
    ).toThrow('Component "TagContent" tried to render a non-tag page: undefined')
  })

  it("handles files without frontmatter in allFiles", () => {
    const html = render(
      callTagContent(
        createProps({}, [
          createFileData({
            slug: "post1" as FullSlug,
            frontmatter: { title: "Post 1", tags: ["test-tag"] },
          }),
          createFileData({ slug: "post2" as FullSlug, frontmatter: undefined }),
          createFileData({
            slug: "post3" as FullSlug,
            frontmatter: { title: "Post 3", tags: undefined },
          }),
        ]),
      ),
    )

    // Only post1 should be included
    expect(html).toContain("1 item with this tag.")
  })

  it("renders content from tree when tree has children", () => {
    const mockTree = h("root", [h("p", "Custom content from markdown")]) as unknown as Root

    const mockFileData = createFileData({
      description: "This should be ignored",
      filePath: "tags/test-tag.md" as unknown as FilePath,
    })
    const mockProps = createProps(mockFileData)
    mockProps.tree = mockTree

    const html = render(callTagContent(mockProps))

    expect(html).toContain("Custom content from markdown")
    expect(html).not.toContain("This should be ignored")
  })

  it("handles missing filePath when rendering tree content", () => {
    const mockTree = h("root", [h("p", "Content without filePath")]) as unknown as Root

    const mockFileData = createFileData({
      filePath: undefined as unknown as FilePath,
    })
    const mockProps = createProps(mockFileData)
    mockProps.tree = mockTree

    expect(() => render(callTagContent(mockProps))).not.toThrow()
  })

  it("does not render description div when tagPageDescription is falsy", () => {
    const result = callTagContent(createProps(createFileData({ description: undefined })))
    const pageListingDiv = findChildByClassName(result.props.children, "page-listing")

    expect(pageListingDiv).toBeDefined()
    expect(pageListingDiv?.type).toBe("div")
    expect(pageListingDiv?.props?.className).toBe("page-listing")
  })

  it("renders description div when tagPageDescription is truthy", () => {
    const result = callTagContent(
      createProps(createFileData({ description: "Tag description text" })),
    )

    const descriptionDiv = findChild(
      result.props.children,
      (child) => child.type === "div" && !child.props?.className,
    )
    const pageListingDiv = findChildByClassName(result.props.children, "page-listing")

    expect(descriptionDiv).toBeDefined()
    expect(pageListingDiv).toBeDefined()
  })

  it("article wraps all content including page-listing", () => {
    const result = callTagContent(createProps())
    const pageListingDiv = findChildByClassName(result.props.children, "page-listing")

    expect(result.type).toBe("article")
    expect(Array.isArray(result.props.children)).toBe(true)
    expect(pageListingDiv).toBeDefined()
    expect(pageListingDiv?.type).toBe("div")
    expect(pageListingDiv?.props?.className).toBe("page-listing")
  })

  it("has attached CSS style", () => {
    expect(TagContent.css).toBeDefined()
    expect(typeof TagContent.css).toBe("object")
  })

  it("renders to HTML without errors", () => {
    const mockAllFiles = [
      createFileData({
        slug: "test-post" as FullSlug,
        frontmatter: { title: "Test Post", tags: ["test-tag"] },
      }),
    ]
    const mockProps = createProps({}, mockAllFiles)

    expect(() => {
      render(callTagContent(mockProps))
    }).not.toThrow()
  })

  it("passes filtered props to PageList", () => {
    const mockAllFiles = [
      createFileData({
        slug: "post1" as FullSlug,
        frontmatter: { title: "Post 1", tags: ["test-tag"] },
      }),
      createFileData({
        slug: "post2" as FullSlug,
        frontmatter: { title: "Post 2", tags: ["other-tag"] },
      }),
    ]
    const mockProps = createProps({}, mockAllFiles)
    const result = callTagContent(mockProps)

    const children = result.props.children
    const pageListingDiv = Array.isArray(children)
      ? findChildByClassName(children, "page-listing")
      : children

    expect(pageListingDiv.props.className).toBe("page-listing")

    const pageListWrapper = pageListingDiv.props.children[1]
    const pageListElement = pageListWrapper.props.children

    expect(pageListElement.type).toBe(PageList)
    // Only Post 1 should be included (has test-tag)
    expect(pageListElement.props.allFiles).toHaveLength(1)
    expect(pageListElement.props.allFiles[0].frontmatter.title).toBe("Post 1")
  })

  it("maintains component structure with complex frontmatter", () => {
    const mockFileData = createFileData({
      frontmatter: {
        title: "Complex Tag",
        cssclasses: ["test-class"],
        tags: [],
        description: "A test description",
        custom_property: "custom_value",
      },
    })
    const mockAllFiles = [
      createFileData({
        slug: "post1" as FullSlug,
        frontmatter: { title: "Post 1", tags: ["test-tag"] },
      }),
    ]
    const mockProps = createProps(mockFileData, mockAllFiles)
    const result = callTagContent(mockProps)

    expect(result.type).toBe("article")
    expect(result.props.className).toBe("previewable test-class")

    const children = result.props.children
    const pageListingDiv = Array.isArray(children)
      ? findChildByClassName(children, "page-listing")
      : children

    expect(pageListingDiv).toBeDefined()
    expect(pageListingDiv.type).toBe("div")
    expect(pageListingDiv.props.className).toBe("page-listing")
  })
})

describe("TagContent default export", () => {
  it("exports TagContent as default", () => {
    const mockProps = createProps()
    const result = callTagContent(mockProps)
    expect(result).toBeDefined()
    expect(result.type).toBe("article")
  })
})
