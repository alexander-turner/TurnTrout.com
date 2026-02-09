/**
 * @jest-environment node
 */
import type { Element, Root } from "hast"

import { describe, expect, it } from "@jest/globals"

import type { BuildCtx } from "../../util/ctx"
import type { FullSlug, SimpleSlug } from "../../util/path"

import { CrawlLinks } from "./links"

type MockFile = {
  data: {
    slug: FullSlug
    links?: SimpleSlug[]
  }
}

const createMockCtx = (allSlugs: FullSlug[] = []): BuildCtx => ({ allSlugs }) as unknown as BuildCtx

const createMockFile = (slug = "test" as FullSlug): MockFile => ({
  data: { slug },
})

const createLink = (
  href: string,
  children: Element["children"] = [],
  parent?: Partial<Element>,
): { tree: Root; node: Element; parent: Element } => {
  const linkNode: Element = {
    type: "element",
    tagName: "a",
    properties: { href },
    children: children.length > 0 ? children : [{ type: "text", value: href }],
  }
  const parentNode: Element = {
    type: "element",
    tagName: parent?.tagName ?? "p",
    properties: parent?.properties ?? {},
    children: [linkNode],
  }
  const tree: Root = { type: "root", children: [parentNode] }
  return { tree, node: linkNode, parent: parentNode }
}

const createMedia = (tagName: string, src: string): Root => ({
  type: "root",
  children: [
    {
      type: "element",
      tagName,
      properties: { src },
      children: [],
    },
  ],
})

const getProcessor = (opts?: Parameters<typeof CrawlLinks>[0], ctx?: BuildCtx) => {
  const plugin = CrawlLinks(opts)
  const htmlPlugins = plugin.htmlPlugins
  if (!htmlPlugins) throw new Error("htmlPlugins not defined")
  const plugins = htmlPlugins(ctx ?? createMockCtx())
  return (plugins[0] as () => (tree: Root, file: MockFile) => void)()
}

describe("CrawlLinks", () => {
  it("returns plugin with correct name", () => {
    const plugin = CrawlLinks()
    expect(plugin.name).toBe("LinkProcessing")
  })

  describe("external links", () => {
    it("adds external class to absolute URLs", () => {
      const { tree } = createLink("https://example.com")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect((link.properties.className as string[]).includes("external")).toBe(true)
    })

    it("sets target=_blank when openLinksInNewTab is true", () => {
      const { tree } = createLink("https://example.com")
      const file = createMockFile()
      const processor = getProcessor({ openLinksInNewTab: true })
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties.target).toBe("_blank")
    })

    it("does not set target=_blank when openLinksInNewTab is false", () => {
      const { tree } = createLink("https://example.com")
      const file = createMockFile()
      const processor = getProcessor({ openLinksInNewTab: false })
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties.target).toBeUndefined()
    })

    it("sets rel=noopener noreferrer on external links", () => {
      const { tree } = createLink("https://example.com")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties.rel).toBe("noopener noreferrer")
    })

    it("prepends https:// to external links without protocol", () => {
      const { tree } = createLink("example.com/page")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties.href).toBe("https://example.com/page")
    })

    it("does not prepend https:// to mailto links", () => {
      const { tree } = createLink("mailto:user@example.com")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties.href).toBe("mailto:user@example.com")
    })

    it("does not prepend https:// to http links", () => {
      const { tree } = createLink("http://example.com")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties.href).toBe("http://example.com")
    })

    it("adds external link icon when enabled", () => {
      const { tree } = createLink("https://example.com")
      const file = createMockFile()
      const processor = getProcessor({ externalLinkIcon: true })
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      const svgChild = link.children.find(
        (c) => c.type === "element" && (c as Element).tagName === "svg",
      ) as Element | undefined
      expect(svgChild).toBeDefined()
      expect(svgChild?.properties.class).toBe("external-icon")
    })

    it("does not add external link icon when disabled (default)", () => {
      const { tree } = createLink("https://example.com")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      const svgChild = link.children.find(
        (c) => c.type === "element" && (c as Element).tagName === "svg",
      )
      expect(svgChild).toBeUndefined()
    })
  })

  describe("internal links", () => {
    it("adds internal class to relative links", () => {
      const { tree } = createLink("./other-page")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect((link.properties.className as string[]).includes("internal")).toBe(true)
    })

    it("adds can-trigger-popover class to internal links", () => {
      const { tree } = createLink("./other-page")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect((link.properties.className as string[]).includes("can-trigger-popover")).toBe(true)
    })

    it("does not add can-trigger-popover when link is in a header", () => {
      const { tree } = createLink("./other-page", [], { tagName: "h2" })
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect((link.properties.className as string[]).includes("internal")).toBe(true)
      expect((link.properties.className as string[]).includes("can-trigger-popover")).toBe(false)
    })

    it("transforms internal link hrefs", () => {
      const { tree } = createLink("./other-page")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties["data-slug"]).toBeDefined()
    })

    it("sets data-slug on internal links", () => {
      const { tree } = createLink("./my-page")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties["data-slug"]).toBeDefined()
    })

    it("tracks outgoing internal links", () => {
      const { tree } = createLink("./other-page")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      expect(file.data.links).toBeDefined()
      expect(file.data.links!.length).toBeGreaterThan(0)
    })

    it("handles internal link to path ending with /", () => {
      const { tree } = createLink("./folder/")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties["data-slug"]).toBeDefined()
    })

    it("handles links starting with /", () => {
      const { tree } = createLink("/absolute-path")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect((link.properties.className as string[]).includes("internal")).toBe(true)
    })
  })

  describe("same-page links", () => {
    it("adds same-page-link class for # links", () => {
      const { tree } = createLink("#section")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect((link.properties.className as string[]).includes("same-page-link")).toBe(true)
    })

    it("does not transform same-page anchor links", () => {
      const { tree } = createLink("#heading")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      expect(link.properties.href).toBe("#heading")
    })
  })

  describe("pretty links", () => {
    it("strips folder paths from link text when prettyLinks is on", () => {
      const { tree } = createLink("./folder/my-page", [{ type: "text", value: "folder/my-page" }])
      const file = createMockFile()
      const processor = getProcessor({ prettyLinks: true })
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      const textChild = link.children[0] as { type: string; value: string }
      expect(textChild.value).toBe("my-page")
    })

    it("does not modify link text when prettyLinks is off", () => {
      const { tree } = createLink("./folder/my-page", [{ type: "text", value: "folder/my-page" }])
      const file = createMockFile()
      const processor = getProcessor({ prettyLinks: false })
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      const textChild = link.children[0] as { type: string; value: string }
      expect(textChild.value).toBe("folder/my-page")
    })

    it("does not prettify links with # prefix in text", () => {
      const { tree } = createLink("./page", [{ type: "text", value: "#section" }])
      const file = createMockFile()
      const processor = getProcessor({ prettyLinks: true })
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      const textChild = link.children[0] as { type: string; value: string }
      expect(textChild.value).toBe("#section")
    })

    it("does not prettify external links", () => {
      const { tree } = createLink("https://example.com/path", [
        { type: "text", value: "https://example.com/path" },
      ])
      const file = createMockFile()
      const processor = getProcessor({ prettyLinks: true })
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      const textChild = link.children[0] as { type: string; value: string }
      expect(textChild.value).toBe("https://example.com/path")
    })

    it("does not prettify links with multiple children", () => {
      const { tree } = createLink("./folder/page", [
        { type: "text", value: "some " },
        {
          type: "element",
          tagName: "strong",
          properties: {},
          children: [{ type: "text", value: "bold" }],
        },
      ])
      const file = createMockFile()
      const processor = getProcessor({ prettyLinks: true })
      processor(tree, file)

      const link = (tree.children[0] as Element).children[0] as Element
      const textChild = link.children[0] as { type: string; value: string }
      expect(textChild.value).toBe("some ")
    })
  })

  describe("media elements", () => {
    it.each(["img", "video", "audio", "iframe"])("adds lazy loading to %s elements", (tagName) => {
      const tree = createMedia(tagName, "./media/file.mp4")
      const file = createMockFile()
      const processor = getProcessor({ lazyLoad: true })
      processor(tree, file)

      const el = tree.children[0] as Element
      expect(el.properties.loading).toBe("lazy")
    })

    it("does not add lazy loading when disabled", () => {
      const tree = createMedia("img", "./image.png")
      const file = createMockFile()
      const processor = getProcessor({ lazyLoad: false })
      processor(tree, file)

      const el = tree.children[0] as Element
      expect(el.properties.loading).toBeUndefined()
    })

    it("transforms relative media src", () => {
      const tree = createMedia("img", "./images/photo.png")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const el = tree.children[0] as Element
      expect(el.properties.src).toBeDefined()
    })

    it("does not transform absolute media src", () => {
      const tree = createMedia("img", "https://cdn.example.com/photo.png")
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)

      const el = tree.children[0] as Element
      expect(el.properties.src).toBe("https://cdn.example.com/photo.png")
    })
  })

  describe("edge cases", () => {
    it("handles elements without href", () => {
      const tree: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "a",
            properties: {},
            children: [{ type: "text", value: "no href" }],
          },
        ],
      }
      const file = createMockFile()
      const processor = getProcessor()
      // Should not throw
      processor(tree, file)
    })

    it("handles elements with non-string href", () => {
      const tree: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "a",
            properties: { href: 42 },
            children: [{ type: "text", value: "numeric href" }],
          },
        ],
      }
      const file = createMockFile()
      const processor = getProcessor()
      // Should not throw
      processor(tree, file)
    })

    it("handles non-link, non-media elements", () => {
      const tree: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "div",
            properties: {},
            children: [{ type: "text", value: "just a div" }],
          },
        ],
      }
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)
      // No links should be tracked
      expect(file.data.links).toEqual([])
    })

    it("handles tree with text nodes only", () => {
      const tree: Root = {
        type: "root",
        children: [{ type: "text", value: "plain text" }],
      }
      const file = createMockFile()
      const processor = getProcessor()
      processor(tree, file)
      expect(file.data.links).toEqual([])
    })

    it("handles img without src property", () => {
      const tree: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "img",
            properties: {},
            children: [],
          },
        ],
      }
      const file = createMockFile()
      const processor = getProcessor()
      // Should not throw
      processor(tree, file)
    })

    it.each(["h1", "h2", "h3", "h4", "h5", "h6"])(
      "does not add can-trigger-popover for links inside %s",
      (heading) => {
        const { tree } = createLink("./page", [], { tagName: heading })
        const file = createMockFile()
        const processor = getProcessor()
        processor(tree, file)

        const link = (tree.children[0] as Element).children[0] as Element
        expect((link.properties.className as string[]).includes("can-trigger-popover")).toBe(false)
      },
    )
  })
})
