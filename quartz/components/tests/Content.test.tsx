/**
 * @jest-environment jsdom
 */

import type { Root } from "hast"
import type { JSX } from "preact"

import { describe, it, expect } from "@jest/globals"

import type { GlobalConfiguration } from "../../cfg"
import type { QuartzPluginData } from "../../plugins/vfile"
import type { BuildCtx } from "../../util/ctx"
import type { FullSlug } from "../../util/path"
import type { QuartzComponentProps } from "../types"

import Content from "../pages/Content"

const mockConfig = {
  pageTitle: "Test",
  enablePopovers: true,
  analytics: null,
  ignorePatterns: [],
  defaultDateType: "created",
  theme: {},
} as unknown as GlobalConfiguration

const createQuartzProps = (overrides: Partial<QuartzPluginData> = {}): QuartzComponentProps => {
  const fileData: QuartzPluginData = {
    filePath: "test.md",
    relativePath: "test.md",
    frontmatter: {
      title: "Test Page",
    },
    toc: undefined,
    ...overrides,
  } as QuartzPluginData

  return {
    fileData,
    cfg: mockConfig,
    tree: { type: "root", children: [] } as Root,
    allFiles: [],
    children: [],
    externalResources: { css: [], js: [] },
    ctx: {
      cfg: {},
      allSlugs: [] as FullSlug[],
      argv: {},
    } as BuildCtx,
  } as QuartzComponentProps
}

function assertJSXElement(element: unknown): asserts element is JSX.Element {
  expect(element).toBeTruthy()
  expect(typeof element).toBe("object")
}

describe("Content component - mobile ToC rendering", () => {
  it("should not render mobile ToC when toc is undefined", () => {
    const props = createQuartzProps({ toc: undefined })
    const ContentComponent = Content()
    const result = ContentComponent(props)

    assertJSXElement(result)
    expect(result.type).toBe("article")

    // Check that mobile ToC is not rendered
    const children = result.props.children as JSX.Element[]
    const mobileOnlySpan = children[0]
    assertJSXElement(mobileOnlySpan)
    expect(mobileOnlySpan.props.className).toBe("mobile-only")
    expect(mobileOnlySpan.props.children).toBeNull()
  })

  it("should not render mobile ToC when page has no headings (empty TOC array)", () => {
    const props = createQuartzProps({ toc: [] })
    const ContentComponent = Content()
    const result = ContentComponent(props)

    assertJSXElement(result)
    expect(result.type).toBe("article")

    const children = result.props.children as JSX.Element[]
    const mobileOnlySpan = children[0]
    assertJSXElement(mobileOnlySpan)
    expect(mobileOnlySpan.props.className).toBe("mobile-only")
    expect(mobileOnlySpan.props.children).toBeNull()
  })

  it("should not render mobile ToC when toc is disabled in frontmatter", () => {
    const props = createQuartzProps({
      toc: [{ depth: 1, text: "Heading", slug: "heading" }],
      frontmatter: { title: "Test Page", toc: "false" },
    })
    const ContentComponent = Content()
    const result = ContentComponent(props)

    assertJSXElement(result)
    expect(result.type).toBe("article")

    // Check that mobile ToC is not rendered
    const children = result.props.children as JSX.Element[]
    const mobileOnlySpan = children[0]
    assertJSXElement(mobileOnlySpan)
    expect(mobileOnlySpan.props.className).toBe("mobile-only")
    expect(mobileOnlySpan.props.children).toBeNull()
  })

  it("should render mobile ToC when toc has entries", () => {
    const props = createQuartzProps({
      toc: [
        { depth: 1, text: "Heading 1", slug: "heading-1" },
        { depth: 2, text: "Heading 1.1", slug: "heading-1-1" },
      ],
    })
    const ContentComponent = Content()
    const result = ContentComponent(props)

    assertJSXElement(result)
    expect(result.type).toBe("article")

    // Check that mobile ToC is rendered
    const children = result.props.children as JSX.Element[]
    const mobileOnlySpan = children[0]
    assertJSXElement(mobileOnlySpan)
    expect(mobileOnlySpan.props.className).toBe("mobile-only")
    expect(mobileOnlySpan.props.children).not.toBeNull()
    assertJSXElement(mobileOnlySpan.props.children)
    expect(mobileOnlySpan.props.children.type).toBe("blockquote")
    expect(mobileOnlySpan.props.children.props["data-admonition"]).toBe("example")

    // Verify the structure contains the toc-content-mobile div
    const blockquoteChildren = mobileOnlySpan.props.children.props.children as JSX.Element[]
    const admonitionContent = blockquoteChildren[1]
    assertJSXElement(admonitionContent)
    expect(admonitionContent.props.id).toBe("toc-content-mobile")
  })

  it("should render article without errors when filePath is undefined", () => {
    const props = createQuartzProps({ filePath: undefined })
    const ContentComponent = Content()
    const result = ContentComponent(props)

    expect(result).toBeNull()
  })
})
