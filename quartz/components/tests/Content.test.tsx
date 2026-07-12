/**
 * @jest-environment jest-fixed-jsdom
 */

import type { Root } from "hast"
import type { JSX } from "preact"

import { describe, expect, it } from "@jest/globals"

import type { QuartzPluginData } from "../../plugins/vfile"
import type { GlobalConfiguration } from "../../util/config"
import type { BuildCtx } from "../../util/ctx"
import type { FullSlug } from "../../util/path"
import type { QuartzComponentProps } from "../types"

import { CAN_TRIGGER_POPOVER_CLASS, specialFaviconPaths } from "../constants"
import Content, { createLinkWithFavicon } from "../pages/Content"

// `buildNestedList(toc, 0, 0)` wraps its output in an extra <li><ol> layer
// (currentDepth starts at 0, below every real heading depth), so the first
// link's position in the tree varies with the TOC shape. Recurse to it
// instead of hardcoding indices through that wrapping.
function findFirstAnchor(node: unknown): (JSX.Element & { props: Record<string, unknown> }) | null {
  if (!node || typeof node !== "object") return null
  const element = node as JSX.Element & { props: Record<string, unknown> }
  if (element.type === "a") return element
  const children = element.props?.children
  const childArray = Array.isArray(children) ? children : [children]
  for (const child of childArray) {
    const found = findFirstAnchor(child)
    if (found) return found
  }
  return null
}

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

  it("should not mark mobile ToC links as popover-capable, since popovers are desktop-only", () => {
    const props = createQuartzProps({
      toc: [
        { depth: 1, text: "Heading 1", slug: "heading-1" },
        { depth: 2, text: "Heading 1.1", slug: "heading-1-1" },
      ],
    })
    const ContentComponent = Content()
    const result = ContentComponent(props)

    assertJSXElement(result)
    const children = result.props.children as JSX.Element[]
    const mobileOnlySpan = children[0]
    assertJSXElement(mobileOnlySpan)

    const anchor = findFirstAnchor(mobileOnlySpan)
    expect(anchor).not.toBeNull()
    const classNames = (anchor?.props.className as string).split(" ")
    expect(classNames).not.toContain(CAN_TRIGGER_POPOVER_CLASS)
  })

  it("should render article without errors when filePath is undefined", () => {
    const props = createQuartzProps({ filePath: undefined })
    const ContentComponent = Content()
    const result = ContentComponent(props)

    expect(result).toBeNull()
  })

  it.each([
    {
      description: "lw-is-question is true and lw-url exists",
      frontmatter: {
        title: "Test Question",
        "lw-is-question": "true",
        "lw-url": "https://lesswrong.com/posts/test",
      },
      expectedAdmonition: "question",
      childIndex: 1,
    },
    {
      description: "lw-reward-post-warning is true",
      frontmatter: {
        title: "Test",
        "lw-reward-post-warning": "true",
      },
      expectedAdmonition: "warning",
      childIndex: 2,
    },
  ])(
    "should render $expectedAdmonition admonition when $description",
    ({ frontmatter, expectedAdmonition, childIndex }) => {
      const props = createQuartzProps({ frontmatter })
      const ContentComponent = Content()
      const result = ContentComponent(props)

      assertJSXElement(result)
      const children = result.props.children as JSX.Element[]
      const admonitionBlock = children[childIndex]
      assertJSXElement(admonitionBlock)
      expect(admonitionBlock.props["data-admonition"]).toBe(expectedAdmonition)
    },
  )

  it.each([
    {
      description: "lw-is-question is true but lw-url is missing",
      frontmatter: {
        title: "Test Question",
        "lw-is-question": "true",
      },
    },
    {
      description: "lw-is-question is false with lw-url present",
      frontmatter: {
        title: "Test",
        "lw-is-question": "false",
        "lw-url": "https://lesswrong.com/posts/test",
      },
    },
    {
      description: "lw-reward-post-warning is not set",
      frontmatter: {
        title: "Test",
      },
    },
  ])("should not render admonitions when $description", ({ frontmatter }) => {
    const props = createQuartzProps({ frontmatter })
    const ContentComponent = Content()
    const result = ContentComponent(props)

    assertJSXElement(result)
    const children = result.props.children as JSX.Element[]
    expect(children.length).toBe(4)
    expect(children[1]).toBeFalsy()
    expect(children[2]).toBeFalsy()
  })
})

describe("Content component - dropcap attributes", () => {
  it.each([
    ["absent frontmatter enables dropcap and keeps color", {}, true, false],
    ["no_dropcap true disables the dropcap", { no_dropcap: true }, false, false],
    ['no_dropcap "true" disables the dropcap', { no_dropcap: "true" }, false, false],
    ["no_dropcap_color true opts out of color", { no_dropcap_color: true }, true, true],
    ['no_dropcap_color "true" opts out of color', { no_dropcap_color: "true" }, true, true],
    ["no_dropcap_color false keeps color", { no_dropcap_color: false }, true, false],
  ])("%s", (_name, extraFrontmatter, expectedUseDropcap, expectedNoColor) => {
    const props = createQuartzProps({
      frontmatter: { title: "Test Page", ...extraFrontmatter },
    })
    const result = Content()(props)

    assertJSXElement(result)
    expect(result.props["data-use-dropcap"]).toBe(expectedUseDropcap)
    expect(result.props["data-no-dropcap-color"]).toBe(expectedNoColor)
  })
})

describe("createLinkWithFavicon", () => {
  it("should create a link with favicon using default props", () => {
    const result = createLinkWithFavicon("Test Link", "/test-page", specialFaviconPaths.turntrout)

    assertJSXElement(result)
    expect(result.type).toBe("a")
    expect(result.props.href).toBe("/test-page")
  })

  it("should create a link with custom props", () => {
    const result = createLinkWithFavicon("External Link", "https://example.com", "/favicon.svg", {
      class: "external",
      target: "_blank",
      rel: "noopener noreferrer",
    })

    assertJSXElement(result)
    expect(result.type).toBe("a")
    expect(result.props.href).toBe("https://example.com")
    expect(result.props.class).toBe("external")
    expect(result.props.target).toBe("_blank")
    expect(result.props.rel).toBe("noopener noreferrer")
  })

  it("should create internal link with popover props", () => {
    const result = createLinkWithFavicon(
      "Internal Link",
      "./another-page",
      specialFaviconPaths.turntrout,
      {
        class: "internal can-trigger-popover",
        "data-slug": "another-page",
      },
    )

    assertJSXElement(result)
    expect(result.type).toBe("a")
    expect(result.props.href).toBe("./another-page")
    expect(result.props.class).toBe("internal can-trigger-popover")
    expect(result.props["data-slug"]).toBe("another-page")
  })

  it("should include favicon-span with spliced text in link children", () => {
    const result = createLinkWithFavicon(
      "Link with favicon",
      "/page",
      specialFaviconPaths.lesswrong,
    )

    assertJSXElement(result)
    const children = result.props.children as unknown[]
    // text (spliced) + favicon-span (last 4 chars + favicon)
    expect(children.length).toBe(2)
    expect(children[0]).toBe("Link with fav")

    const faviconSpan = children[1] as JSX.Element
    assertJSXElement(faviconSpan)
    expect(faviconSpan.type).toBe("span")
    expect(faviconSpan.props.class).toBe("favicon-span")

    const spanChildren = faviconSpan.props.children as unknown[]
    expect(spanChildren[0]).toBe("icon")
    const favicon = spanChildren[1]
    assertJSXElement(favicon as JSX.Element)
    expect((favicon as JSX.Element).props.class).toContain("favicon")
  })

  it("should splice text and wrap with favicon-span", () => {
    const result = createLinkWithFavicon("Test text", "/page", specialFaviconPaths.turntrout)

    assertJSXElement(result)
    const children = result.props.children as unknown[]

    // text (spliced) + favicon-span (last 4 chars + favicon)
    expect(children.length).toBe(2)
    expect(children[0]).toBe("Test ")

    const faviconSpan = children[1] as JSX.Element
    assertJSXElement(faviconSpan)
    expect(faviconSpan.type).toBe("span")
    expect(faviconSpan.props.class).toBe("favicon-span")

    const spanChildren = faviconSpan.props.children as unknown[]
    expect(spanChildren[0]).toBe("text")
    const favicon = spanChildren[1]
    assertJSXElement(favicon as JSX.Element)
    expect((favicon as JSX.Element).props.class).toContain("favicon")
  })
})
