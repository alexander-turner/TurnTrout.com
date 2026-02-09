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
): Root => {
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
  return { type: "root", children: [parentNode] }
}

const createMedia = (tagName: string, src: string): Root => ({
  type: "root",
  children: [{ type: "element", tagName, properties: { src }, children: [] }],
})

const getProcessor = (opts?: Parameters<typeof CrawlLinks>[0], ctx?: BuildCtx) => {
  const plugin = CrawlLinks(opts)
  const { htmlPlugins } = plugin
  if (!htmlPlugins) throw new Error("htmlPlugins not defined")
  const plugins = htmlPlugins(ctx ?? createMockCtx())
  return (plugins[0] as () => (tree: Root, file: MockFile) => void)()
}

/** Process a link tree and return the link element + file for assertions. */
const processLink = (
  href: string,
  {
    opts,
    children,
    parentTag,
  }: {
    opts?: Parameters<typeof CrawlLinks>[0]
    children?: Element["children"]
    parentTag?: string
  } = {},
) => {
  const tree = createLink(href, children, parentTag ? { tagName: parentTag } : undefined)
  const file = createMockFile()
  getProcessor(opts)(tree, file)
  return {
    link: (tree.children[0] as Element).children[0] as Element,
    file,
  }
}

describe("CrawlLinks", () => {
  it("returns plugin with correct name", () => {
    expect(CrawlLinks().name).toBe("LinkProcessing")
  })

  describe("external links", () => {
    it("adds external class, target=_blank, rel, and no icon by default", () => {
      const { link, file } = processLink("https://example.com")
      expect(link.properties.className).toContain("external")
      expect(link.properties.target).toBe("_blank")
      expect(link.properties.rel).toBe("noopener noreferrer")
      expect(
        link.children.find((c) => c.type === "element" && (c as Element).tagName === "svg"),
      ).toBeUndefined()
      expect(file.data.links).toEqual([])
    })

    it("does not set target=_blank when openLinksInNewTab is false", () => {
      const { link } = processLink("https://example.com", { opts: { openLinksInNewTab: false } })
      expect(link.properties.target).toBeUndefined()
    })

    it.each([
      ["prepends https:// to bare domains", "example.com/page", "https://example.com/page"],
      ["keeps mailto: links unchanged", "mailto:user@example.com", "mailto:user@example.com"],
      ["keeps http:// links unchanged", "http://example.com", "http://example.com"],
    ])("%s", (_, href, expectedHref) => {
      const { link } = processLink(href)
      expect(link.properties.href).toBe(expectedHref)
    })

    it("adds external link icon SVG when enabled", () => {
      const { link } = processLink("https://example.com", { opts: { externalLinkIcon: true } })
      const svg = link.children.find(
        (c) => c.type === "element" && (c as Element).tagName === "svg",
      ) as Element
      expect(svg?.properties.class).toBe("external-icon")
    })
  })

  describe("internal links", () => {
    it("adds internal and can-trigger-popover classes to relative links", () => {
      const { link } = processLink("./other-page")
      const classes = link.properties.className as string[]
      expect(classes).toContain("internal")
      expect(classes).toContain("can-trigger-popover")
    })

    it("transforms internal link and sets data-slug", () => {
      const { link, file } = processLink("./other-page")
      expect(link.properties["data-slug"]).toBe("other-page")
      expect(file.data.links).toEqual(["other-page"])
    })

    it("appends index to folder paths in data-slug", () => {
      const { link } = processLink("./folder/")
      expect(link.properties["data-slug"]).toBe("folder/index")
    })

    it("handles links starting with /", () => {
      const { link } = processLink("/absolute-path")
      expect(link.properties.className as string[]).toContain("internal")
    })

    it("strips anchor from slug via splitAnchor", () => {
      const { link, file } = processLink("./page#section")
      expect(link.properties["data-slug"]).toBe("page")
      expect(file.data.links).toEqual(["page"])
    })

    it("deduplicates outgoing links", () => {
      const tree: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "p",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "a",
                properties: { href: "./target" },
                children: [{ type: "text", value: "first" }],
              },
              {
                type: "element",
                tagName: "a",
                properties: { href: "./target" },
                children: [{ type: "text", value: "second" }],
              },
            ],
          },
        ],
      }
      const file = createMockFile()
      getProcessor()(tree, file)
      expect(file.data.links).toEqual(["target"])
    })
  })

  describe("same-page links", () => {
    it("adds same-page-link and internal classes, preserves href, no outgoing", () => {
      const { link, file } = processLink("#section")
      const classes = link.properties.className as string[]
      expect(classes).toContain("same-page-link")
      expect(classes).toContain("internal")
      expect(link.properties.href).toBe("#section")
      expect(file.data.links).toEqual([])
    })
  })

  describe("pretty links", () => {
    it("strips folder paths from link text when prettyLinks is on", () => {
      const { link } = processLink("./folder/my-page", {
        opts: { prettyLinks: true },
        children: [{ type: "text", value: "folder/my-page" }],
      })
      expect((link.children[0] as { value: string }).value).toBe("my-page")
    })

    it("does not modify link text when prettyLinks is off", () => {
      const { link } = processLink("./folder/my-page", {
        opts: { prettyLinks: false },
        children: [{ type: "text", value: "folder/my-page" }],
      })
      expect((link.children[0] as { value: string }).value).toBe("folder/my-page")
    })

    it("does not prettify links with # prefix in text", () => {
      const { link } = processLink("./page", {
        opts: { prettyLinks: true },
        children: [{ type: "text", value: "#section" }],
      })
      expect((link.children[0] as { value: string }).value).toBe("#section")
    })

    it("does not prettify external links", () => {
      const { link } = processLink("https://example.com/path", {
        opts: { prettyLinks: true },
        children: [{ type: "text", value: "https://example.com/path" }],
      })
      expect((link.children[0] as { value: string }).value).toBe("https://example.com/path")
    })

    it("does not prettify links with multiple children", () => {
      const { link } = processLink("./folder/page", {
        opts: { prettyLinks: true },
        children: [
          { type: "text", value: "some " },
          {
            type: "element",
            tagName: "strong",
            properties: {},
            children: [{ type: "text", value: "bold" }],
          },
        ],
      })
      expect((link.children[0] as { value: string }).value).toBe("some ")
    })
  })

  describe("media elements", () => {
    it.each(["img", "video", "audio", "iframe"])("adds lazy loading to %s elements", (tagName) => {
      const tree = createMedia(tagName, "./media/file.mp4")
      const file = createMockFile()
      getProcessor({ lazyLoad: true })(tree, file)
      expect((tree.children[0] as Element).properties.loading).toBe("lazy")
    })

    it("does not add lazy loading when disabled", () => {
      const tree = createMedia("img", "./image.png")
      const file = createMockFile()
      getProcessor({ lazyLoad: false })(tree, file)
      expect((tree.children[0] as Element).properties.loading).toBeUndefined()
    })

    it("transforms relative media src via transformLink", () => {
      const tree = createMedia("img", "./images/photo.png")
      const file = createMockFile()
      getProcessor()(tree, file)
      const el = tree.children[0] as Element
      expect(el.properties.src).toBe("./images/photo.png")
      expect(el.properties.loading).toBe("lazy")
    })

    it("does not transform absolute media src", () => {
      const tree = createMedia("img", "https://cdn.example.com/photo.png")
      const file = createMockFile()
      getProcessor()(tree, file)
      expect((tree.children[0] as Element).properties.src).toBe("https://cdn.example.com/photo.png")
    })
  })

  describe("edge cases", () => {
    it.each([
      ["without href", {}],
      ["with non-string href", { href: 42 }],
    ])("handles anchor elements %s", (_, properties) => {
      const tree: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "a",
            properties,
            children: [{ type: "text", value: "text" }],
          },
        ],
      }
      const file = createMockFile()
      getProcessor()(tree, file)
      expect(file.data.links).toEqual([])
    })

    it.each([
      [
        "non-link elements",
        {
          type: "element" as const,
          tagName: "div",
          properties: {},
          children: [{ type: "text" as const, value: "text" }],
        },
      ],
      ["text nodes only", { type: "text" as const, value: "plain text" }],
    ])("handles %s with no link tracking", (_, child) => {
      const tree: Root = { type: "root", children: [child as Root["children"][0]] }
      const file = createMockFile()
      getProcessor()(tree, file)
      expect(file.data.links).toEqual([])
    })

    it("handles img without src property", () => {
      const tree: Root = {
        type: "root",
        children: [{ type: "element", tagName: "img", properties: {}, children: [] }],
      }
      const file = createMockFile()
      getProcessor()(tree, file)
    })

    it.each(["h1", "h2", "h3", "h4", "h5", "h6"])(
      "adds internal but not can-trigger-popover for links inside %s",
      (heading) => {
        const { link } = processLink("./page", { parentTag: heading })
        const classes = link.properties.className as string[]
        expect(classes).toContain("internal")
        expect(classes).not.toContain("can-trigger-popover")
      },
    )
  })
})
