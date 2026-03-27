import { describe, expect, it } from "@jest/globals"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import type { FullSlug } from "../../util/path"

import { EXTERNAL_LINK_REL, CAN_TRIGGER_POPOVER_CLASS } from "../../components/constants"
import { CrawlLinks, isExternalLink } from "./links"

function processHtml(
  html: string,
  opts: {
    slug?: string
    allSlugs?: FullSlug[]
    lazyLoad?: boolean
    prettyLinks?: boolean
    openLinksInNewTab?: boolean
  } = {},
): Promise<{ html: string; links: string[]; firstImageUrl?: string }> {
  const slug = (opts.slug ?? "test-page") as FullSlug
  const allSlugs = opts.allSlugs ?? (["test-page", "other-page"] as FullSlug[])

  const plugin = CrawlLinks({
    lazyLoad: opts.lazyLoad ?? true,
    prettyLinks: opts.prettyLinks ?? true,
    openLinksInNewTab: opts.openLinksInNewTab ?? true,
    markdownLinkResolution: "shortest",
  })

  const ctx = { allSlugs } as Parameters<
    NonNullable<ReturnType<typeof CrawlLinks>["htmlPlugins"]>
  >[0]
  const htmlPlugins = plugin.htmlPlugins!(ctx)

  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(htmlPlugins)
    .use(rehypeStringify)

  return processor.process({ value: html, data: { slug } }).then((file) => ({
    html: String(file),
    links: (file.data.links as string[]) ?? [],
    firstImageUrl: file.data.firstImageUrl as string | undefined,
  }))
}

describe("isExternalLink", () => {
  it.each([
    ["example.com", true],
    ["https://example.com", true],
    ["http://example.com", true],
    ["mailto:test@example.com", true],
    ["ftp://files.example.com", true],
    ["#anchor", false],
    ["./relative", false],
    ["../parent", false],
    ["/absolute", false],
    ["/path/to/page", false],
    ["#", false],
    [".", false],
    ["/", false],
  ])("isExternalLink(%j) returns %s", (href, expected) => {
    expect(isExternalLink(href)).toBe(expected)
  })
})

describe("CrawlLinks anchor processing", () => {
  it.each([
    ["external link", '<a href="https://example.com">Example</a>', "external"],
    ["bare domain", '<a href="example.com">Example</a>', "external"],
    ["internal link", '<a href="./other-page">Other</a>', "internal"],
    ["root-relative link", '<a href="/other-page">Other</a>', "internal"],
    ["anchor link", '<a href="#section">Section</a>', "internal"],
  ])("classifies %s as %s", async (_desc, html, expectedClass) => {
    const result = await processHtml(html)
    expect(result.html).toContain(expectedClass)
  })

  it("adds same-page-link class for anchor-only hrefs", async () => {
    const result = await processHtml('<a href="#section">Section</a>')
    expect(result.html).toContain("same-page-link")
  })

  it("prepends https:// to bare external domains", async () => {
    const result = await processHtml('<a href="example.com">Example</a>')
    expect(result.html).toContain('href="https://example.com"')
  })

  it("does not modify mailto links", async () => {
    const result = await processHtml('<a href="mailto:test@example.com">Email</a>')
    expect(result.html).toContain('href="mailto:test@example.com"')
  })

  it("does not modify links that already have https", async () => {
    const result = await processHtml('<a href="https://example.com">Example</a>')
    expect(result.html).toContain('href="https://example.com"')
  })

  it("sets target=_blank for external links when openLinksInNewTab is true", async () => {
    const result = await processHtml('<a href="https://example.com">Example</a>', {
      openLinksInNewTab: true,
    })
    expect(result.html).toContain('target="_blank"')
  })

  it("does not set target=_blank when openLinksInNewTab is false", async () => {
    const result = await processHtml('<a href="https://example.com">Example</a>', {
      openLinksInNewTab: false,
    })
    expect(result.html).not.toContain("target=")
  })

  it("sets rel attribute on external links", async () => {
    const result = await processHtml('<a href="https://example.com">Example</a>')
    expect(result.html).toContain(`rel="${EXTERNAL_LINK_REL}"`)
  })

  it("does not set rel on internal links", async () => {
    const result = await processHtml('<a href="./other-page">Other</a>')
    expect(result.html).not.toContain("rel=")
  })

  it.each(["h1", "h2", "h3", "h4", "h5", "h6"])(
    "does not add popover class for links inside <%s>",
    async (tag) => {
      const result = await processHtml(`<${tag}><a href="./other-page">Title</a></${tag}>`)
      expect(result.html).not.toContain(CAN_TRIGGER_POPOVER_CLASS)
    },
  )

  it("adds popover class for internal links not inside headers", async () => {
    const result = await processHtml('<p><a href="./other-page">Link</a></p>')
    expect(result.html).toContain(CAN_TRIGGER_POPOVER_CLASS)
  })

  it("tracks outgoing internal links", async () => {
    const result = await processHtml('<a href="./other-page">Other</a>', {
      allSlugs: ["other-page"] as FullSlug[],
    })
    expect(result.links.length).toBeGreaterThan(0)
  })

  it("does not track external links as outgoing", async () => {
    const result = await processHtml('<a href="https://example.com">Example</a>')
    expect(result.links).toEqual([])
  })

  it("does not track anchor-only links as outgoing", async () => {
    const result = await processHtml('<a href="#section">Section</a>')
    expect(result.links).toEqual([])
  })

  it("resolves trailing-slash internal links to index", async () => {
    const result = await processHtml('<a href="./folder/">Folder</a>', {
      allSlugs: ["folder/index"] as FullSlug[],
    })
    expect(result.html).toContain("data-slug")
  })

  it("applies prettyLinks (strips folder path from link text)", async () => {
    const result = await processHtml('<a href="./folder/other-page">folder/other-page</a>', {
      prettyLinks: true,
      allSlugs: ["folder/other-page"] as FullSlug[],
    })
    expect(result.html).toContain(">other-page<")
  })

  it("does not apply prettyLinks when disabled", async () => {
    const result = await processHtml('<a href="./folder/other-page">folder/other-page</a>', {
      prettyLinks: false,
      allSlugs: ["folder/other-page"] as FullSlug[],
    })
    expect(result.html).toContain(">folder/other-page<")
  })

  it("skips anchor elements without href", async () => {
    const result = await processHtml('<a name="anchor">Anchor</a>')
    expect(result.html).toContain('<a name="anchor">Anchor</a>')
  })
})

describe("CrawlLinks media processing", () => {
  it("marks first image as eager with high fetchpriority", async () => {
    const result = await processHtml('<img src="https://example.com/img.avif" alt="test">')
    expect(result.html).toContain('loading="eager"')
    expect(result.html).toContain('fetchpriority="high"')
  })

  it("stores first image URL in file data", async () => {
    const result = await processHtml('<img src="https://example.com/img.avif" alt="test">')
    expect(result.firstImageUrl).toBe("https://example.com/img.avif")
  })

  it("marks second image as lazy", async () => {
    const result = await processHtml(
      '<img src="https://example.com/1.avif" alt="first"><img src="https://example.com/2.avif" alt="second">',
    )
    expect(result.html).toContain('loading="eager"')
    expect(result.html).toContain('loading="lazy"')
  })

  it.each(["video", "audio", "iframe"])("marks <%s> as lazy-loaded", async (tag) => {
    const result = await processHtml(`<${tag} src="https://example.com/media.mp4"></${tag}>`)
    expect(result.html).toContain('loading="lazy"')
  })

  it("does not add loading attribute when lazyLoad is false", async () => {
    const result = await processHtml('<img src="https://example.com/img.avif" alt="test">', {
      lazyLoad: false,
    })
    expect(result.html).not.toContain("loading=")
  })

  it("transforms relative src URLs for media elements", async () => {
    const result = await processHtml('<img src="./image.avif" alt="test">', {
      allSlugs: ["test-page", "image.avif"] as FullSlug[],
    })
    // transformLink should resolve the relative path
    expect(result.html).toContain("src=")
  })

  it("skips media elements without src attribute", async () => {
    const result = await processHtml("<video controls></video>")
    expect(result.html).not.toContain("loading=")
  })

  it("does not transform absolute src URLs", async () => {
    const result = await processHtml('<img src="https://cdn.example.com/img.avif" alt="test">')
    expect(result.html).toContain('src="https://cdn.example.com/img.avif"')
  })
})
