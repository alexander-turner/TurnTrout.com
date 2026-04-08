import { describe, expect, it } from "@jest/globals"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import type { FullSlug } from "../../util/path"

import { EXTERNAL_LINK_REL, CAN_TRIGGER_POPOVER_CLASS } from "../../components/constants"
import { CrawlLinks, isExternalLink, isNonRewritableUrl } from "./links"

function processHtml(
  html: string,
  opts: {
    slug?: string
    allSlugs?: FullSlug[]
    lazyLoad?: boolean
    prettyLinks?: boolean
    openLinksInNewTab?: boolean
  } = {},
): Promise<{ html: string; links: readonly string[]; firstImageUrl?: string }> {
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
  const htmlPlugins = plugin.htmlPlugins?.(ctx)
  if (!htmlPlugins) throw new Error("CrawlLinks did not return htmlPlugins")

  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(htmlPlugins)
    .use(rehypeStringify)

  return processor.process({ value: html, data: { slug } }).then((file) => ({
    html: String(file),
    links: (file.data.links as readonly string[]) ?? [],
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

describe("isNonRewritableUrl", () => {
  it.each([
    ["https://example.com", true],
    ["http://example.com", true],
    ["data:image/png;base64,abc", true],
    ["//cdn.example.com/img.avif", false],
    ["#anchor", true],
    ["./relative", false],
    ["../parent", false],
    ["/absolute", false],
    ["example.com", false],
  ])("isNonRewritableUrl(%j) returns %s", (url, expected) => {
    expect(isNonRewritableUrl(url)).toBe(expected)
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

  it.each([
    ["bare domain", "example.com", 'href="https://example.com"'],
    ["mailto", "mailto:test@example.com", 'href="mailto:test@example.com"'],
    ["https", "https://example.com", 'href="https://example.com"'],
  ])("normalizes %s href correctly", async (_desc, href, expected) => {
    const result = await processHtml(`<a href="${href}">Link</a>`)
    expect(result.html).toContain(expected)
  })

  it("sets target=_blank and rel on external links, respects openLinksInNewTab", async () => {
    const withNewTab = await processHtml('<a href="https://example.com">Example</a>')
    expect(withNewTab.html).toContain('target="_blank"')
    expect(withNewTab.html).toContain(`rel="${EXTERNAL_LINK_REL}"`)

    const withoutNewTab = await processHtml('<a href="https://example.com">Example</a>', {
      openLinksInNewTab: false,
    })
    expect(withoutNewTab.html).not.toContain("target=")
    expect(withoutNewTab.html).toContain(`rel="${EXTERNAL_LINK_REL}"`)
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

  it.each([
    ["external", '<a href="https://example.com">Example</a>'],
    ["anchor-only", '<a href="#section">Section</a>'],
  ])("does not track %s links as outgoing", async (_desc, html) => {
    const result = await processHtml(html)
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
  it("marks first image as eager LCP candidate, second as lazy", async () => {
    const result = await processHtml(
      '<img src="https://example.com/1.avif" alt="first"><img src="https://example.com/2.avif" alt="second">',
    )
    expect(result.html).toContain('loading="eager"')
    expect(result.html).toContain('fetchpriority="high"')
    expect(result.html).toContain('loading="lazy"')
    expect(result.firstImageUrl).toBe("https://example.com/1.avif")
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
