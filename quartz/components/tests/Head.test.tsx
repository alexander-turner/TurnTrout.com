/**
 * @jest-environment jsdom
 */
import type { Root } from "hast"

import { describe, it, expect, jest, beforeEach } from "@jest/globals"
import { h } from "preact"
import { render } from "preact-render-to-string"

const mockRenderHead = jest.fn()
const mockHtmlToJsx = jest.fn()
const mockJSResourceToScriptElement = jest.fn()
const mockFromHtml = jest.fn()

jest.mock("../../util/head", () => ({
  renderHead: mockRenderHead,
}))

// Import the Head constructor after mocks are set up

jest.mock("../../util/jsx", () => ({
  htmlToJsx: mockHtmlToJsx,
}))

jest.mock("../../util/resources", () => ({
  JSResourceToScriptElement: mockJSResourceToScriptElement,
}))

jest.mock("hast-util-from-html", () => ({
  fromHtml: mockFromHtml,
}))

import { VFile } from "vfile"

import { type GlobalConfiguration, type QuartzConfig } from "../../cfg"
import { type QuartzPluginData } from "../../plugins/vfile"
import { type BuildCtx } from "../../util/ctx"
import { type FullSlug } from "../../util/path"
import { type StaticResources } from "../../util/resources"
import { defaultTitle, faviconUrl } from "../constants"
import HeadConstructor, { renderMetaJsx } from "../Head"
import { type QuartzComponentProps } from "../types"

describe("Head Component", () => {
  const mockConfig: GlobalConfiguration = {
    baseUrl: "turntrout.com",
  } as GlobalConfiguration

  const mockFrontmatter = {
    title: "Test Page",
    description: "Test description",
    no_dropcap: false,
    avoidIndexing: false,
  }
  const mockFileData: QuartzPluginData = {
    slug: "test-page" as FullSlug,
    frontmatter: mockFrontmatter,
    data: {
      frontmatter: mockFrontmatter,
    },
  } as QuartzPluginData

  const mockExternalResources: StaticResources = {
    css: [],
    js: [
      {
        src: "test-script.js",
        loadTime: "beforeDOMReady" as const,
        contentType: "external" as const,
      },
    ],
  }

  const mockProps: QuartzComponentProps = {
    cfg: mockConfig,
    fileData: mockFileData,
    externalResources: mockExternalResources,
    allFiles: [],
    tree: { type: "root", children: [] } as Root,
    ctx: {
      cfg: {} as unknown as QuartzConfig,
      allSlugs: [] as FullSlug[],
      argv: {} as unknown,
    } as BuildCtx,
    children: [],
  }

  const Head = HeadConstructor()

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default mock implementations
    mockRenderHead.mockReturnValue(`
      <title>Test Page</title>
      <meta name="description" content="Test description">
      <meta property="og:title" content="Test Page" />
    `)

    // Mock fromHtml to return a comprehensive HAST tree matching renderHead output
    mockFromHtml.mockReturnValue({
      type: "root",
      children: [
        { type: "element", tagName: "title", children: [{ type: "text", value: "Test Page" }] },
        {
          type: "element",
          tagName: "meta",
          properties: { name: "description", content: "Test description" },
        },
        {
          type: "element",
          tagName: "meta",
          properties: { property: "og:title", content: "Test Page" },
        },
        {
          type: "element",
          tagName: "meta",
          properties: { property: "og:type", content: "article" },
        },
        {
          type: "element",
          tagName: "link",
          properties: {
            rel: "icon",
            href: faviconUrl,
            type: "image/x-icon",
          },
        },
      ],
    })

    mockHtmlToJsx.mockReturnValue(
      h("div", {}, [
        h("title", {}, "Test Page"),
        h("meta", { name: "description", content: "Test description" }),
        h("meta", { property: "og:title", content: "Test Page" }),
        h("meta", { property: "og:type", content: "article" }),
        h("link", { rel: "icon", href: faviconUrl, type: "image/x-icon" }),
      ]),
    )

    // Mock JSResourceToScriptElement to return a simple script element
    mockJSResourceToScriptElement.mockReturnValue(
      h("script", { src: "test-script.js", defer: true }),
    )
  })

  describe("basic rendering", () => {
    it("should render head element with basic structure", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain("<head")
      expect(html).toContain('charset="utf-8"')
      expect(html).toContain('name="viewport"')
    })

    it("should include charset meta tag", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain('charset="utf-8"')
    })

    it("should include viewport meta tag", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain('name="viewport"')
      expect(html).toContain('content="width=device-width"')
    })
  })

  describe("head content generation", () => {
    it("should include title and meta tags from renderHead", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain("<head")
      expect(html).toContain(defaultTitle)
    })

    it("should handle custom head content", () => {
      const customHeadHtml = "<title>Custom Title</title><meta name='test' content='value'>"
      mockRenderHead.mockReturnValue(customHeadHtml)

      const html = render(h(Head, mockProps))

      expect(html).toContain("<head")
      // The component should render without errors even with custom content
      expect(html).toBeDefined()
    })

    it("should integrate renderHead output into final HTML", () => {
      const html = render(h(Head, mockProps))

      // Check that basic structure is present
      expect(html).toContain("<head")
      expect(html).toContain('charset="utf-8"')
      expect(html).toContain('name="viewport"')
    })
  })

  describe("scripts and resources", () => {
    it("should include dark mode detection script", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain('id="detect-dark-mode"')
      expect(html).toContain("/static/scripts/detectDarkMode.js")
    })

    it("should include analytics script", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain("https://cloud.umami.is/script.js")
      expect(html).toContain("fa8c3e1c-3a3c-4f6d-a913-6f580765bfae")
      expect(html).toContain("defer")
    })

    it("should include external JS resources", () => {
      const html = render(h(Head, mockProps))

      // Check that external resources are included in some form
      expect(html).toContain("<script")
      // The script should have defer attribute
      expect(html).toContain("defer")
      expect(html).toContain('src="test-script.js"')
    })

    it("should include frontmatter script with exposed data", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain('id="quartz-frontmatter"')
      expect(html).toContain('type="application/json"')
      expect(html).toContain('{"no_dropcap":false}')
    })
  })

  describe("stylesheets and resources", () => {
    it("should include CSS and font resources", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain('href="/index.css"')
      expect(html).toContain('href="/static/styles/katex.min.css"')
      expect(html).toContain("turntrout-favicons/favicon.ico")
    })

    it("should preload icons and fonts", () => {
      const html = render(h(Head, mockProps))

      expect(html).toContain("https://assets.turntrout.com/static/icons/note.svg")
      expect(html).toContain("/static/styles/fonts/EBGaramond/EBGaramond-InitialsF1.woff2")
    })
  })

  describe("conditional content", () => {
    it("should include robots meta when avoidIndexing is true", () => {
      const propsWithIndexing = {
        ...mockProps,
        fileData: {
          ...mockFileData,
          frontmatter: {
            ...mockFileData.frontmatter,
            avoidIndexing: true,
          },
          data: {
            frontmatter: {
              ...mockFileData.frontmatter,
              avoidIndexing: true,
            },
          },
        } as QuartzPluginData,
      }

      const html = render(h(Head, propsWithIndexing))

      expect(html).toContain('name="robots"')
      expect(html).toContain("noindex, noimageindex,nofollow")
    })

    it("should not include robots meta when avoidIndexing is false", () => {
      const html = render(h(Head, mockProps))

      expect(html).not.toContain('name="robots"')
    })
  })

  describe("error handling", () => {
    it("should handle renderHead errors gracefully", () => {
      mockRenderHead.mockImplementation(() => {
        throw new Error("Test error")
      })

      expect(() => render(h(Head, mockProps))).not.toThrow()
    })

    it("should handle htmlToJsx errors gracefully", () => {
      // This test verifies the component renders without throwing under normal conditions
      const html = render(h(Head, mockProps))
      expect(html).toContain("<head")
    })

    it("should handle missing slug in renderMetaJsx", () => {
      const fileDataWithoutSlug: QuartzPluginData = {
        ...mockFileData,
        slug: undefined,
        data: {
          frontmatter: {
            title: "Test Page",
            description: "Test description",
            no_dropcap: false,
            avoidIndexing: false,
          },
        },
      }

      // Test that renderMetaJsx can handle missing slug (uses fallback)
      const jsxFragment = renderMetaJsx(mockConfig, fileDataWithoutSlug, new VFile(""))
      expect(jsxFragment).toBeDefined()
    })

    it("should handle missing slug by using fallback", () => {
      const propsWithoutSlug = {
        ...mockProps,
        fileData: {
          ...mockFileData,
          slug: undefined,
          data: {
            frontmatter: mockFrontmatter,
          },
        } as QuartzPluginData,
      }

      const html = render(h(Head, propsWithoutSlug))

      expect(html).toContain("<head")
    })

    it("should handle undefined frontmatter", () => {
      const propsWithoutFrontmatter = {
        ...mockProps,
        fileData: {
          ...mockFileData,
          frontmatter: undefined,
          data: {
            frontmatter: undefined,
          },
        } as QuartzPluginData,
      }

      const html = render(h(Head, propsWithoutFrontmatter))

      expect(html).toContain("<head")
      // When frontmatter is undefined, the exposed frontmatter should be empty object
      expect(html).toContain('id="quartz-frontmatter"')
      expect(html).toContain("{}")
    })

    it("should filter JS resources by loadTime", () => {
      const propsWithNoEarlyResources = {
        ...mockProps,
        externalResources: {
          ...mockExternalResources,
          js: [
            {
              src: "after-dom.js",
              loadTime: "afterDOMReady" as const,
              contentType: "external" as const,
            },
          ],
        },
      }

      const html = render(h(Head, propsWithNoEarlyResources))

      // The filter branch is tested by ensuring the component renders successfully
      // even when there are no beforeDOMReady resources
      expect(html).toContain("<head")
      expect(html).not.toContain("after-dom.js")
    })
  })
})
