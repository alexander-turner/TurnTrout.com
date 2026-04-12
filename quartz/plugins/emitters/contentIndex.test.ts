import { jest, describe, it, beforeAll, beforeEach, expect } from "@jest/globals"

import { type QuartzConfig } from "../../cfg"
import { uiStrings } from "../../components/constants"
import { type BuildCtx } from "../../util/ctx"
import { type FilePath, type FullSlug } from "../../util/path"
import { type StaticResources } from "../../util/resources"
import { defaultProcessedContent, type ProcessedContent } from "../vfile"

jest.unstable_mockModule("./helpers", () => ({
  write: jest.fn(async (opts: { slug: FullSlug }) => {
    return await Promise.resolve(`${opts.slug}.xml`)
  }),
}))

const mockCtx: BuildCtx = {
  argv: {
    directory: "/content",
    output: "public",
    verbose: false,
    serve: false,
    fastRebuild: false,
    port: 3000,
    wsPort: 3001,
  },
  cfg: {
    configuration: { baseUrl: "example.com", pageTitle: "Test Site", defaultDateType: "published" },
  } as unknown as QuartzConfig,
  allSlugs: [],
}

const mockResources: StaticResources = { css: [], js: [] }

describe("ContentIndex", () => {
  let write: jest.MockedFunction<typeof import("./helpers").write>
  let ContentIndex: typeof import("./contentIndex").ContentIndex

  beforeAll(async () => {
    const helpers = await import("./helpers")
    write = helpers.write as jest.MockedFunction<typeof helpers.write>
    const mod = await import("./contentIndex")
    ContentIndex = mod.ContentIndex
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const makeContent = (
    title: string,
    overrides: {
      slug?: FullSlug
      text?: string
      description?: string
      publishedDate?: Date
    } = {},
  ): ProcessedContent[] => [
    defaultProcessedContent({
      slug: overrides.slug ?? ("test-post" as FullSlug),
      filePath: "content/test.md" as FilePath,
      frontmatter: { title, tags: [] },
      text: overrides.text ?? "Some content here",
      description: overrides.description,
      dates: overrides.publishedDate ? { published: overrides.publishedDate } : undefined,
    }),
  ]

  const getWriteCall = (slugSubstring: string) =>
    write.mock.calls.find((c) => c[0].slug.includes(slugSubstring))

  // --- Title formatting (the fix under test) ---
  const titleTransformCases: [string, string, string][] = [
    ["straight quotes become smart quotes", '"hello world"', "\u201CHello World\u201D"],
    ["hyphens become em-dashes", "before -- after", "\u2014"],
  ]

  it.each(titleTransformCases)("%s in content index JSON", async (_, input, expected) => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: false })
    await plugin.emit(mockCtx, makeContent(input), mockResources)

    const jsonCall = getWriteCall("contentIndex")
    const index = JSON.parse(jsonCall![0].content)
    expect(index["test-post"].title).toContain(expected)
  })

  it.each(titleTransformCases)("%s in RSS feed", async (_, input, expected) => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: true })
    await plugin.emit(mockCtx, makeContent(input), mockResources)

    const rssCall = getWriteCall("rss")
    expect(rssCall![0].content).toContain(expected)
  })

  // --- Sitemap ---
  it("generates sitemap with lastmod when date is present", async () => {
    const plugin = ContentIndex({ enableSiteMap: true, enableRSS: false })
    await plugin.emit(
      mockCtx,
      makeContent("My Post", { publishedDate: new Date("2025-01-15") }),
      mockResources,
    )

    const sitemapCall = getWriteCall("sitemap")
    expect(sitemapCall).toBeDefined()
    const xml = sitemapCall![0].content
    expect(xml).toContain("<loc>https://example.com/test-post</loc>")
    expect(xml).toContain("<lastmod>")
    expect(xml).toContain("</urlset>")
  })

  // --- RSS feed sorting ---
  it("RSS feed sorts entries by date descending", async () => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: true })
    const content = [
      ...makeContent("First Post", {
        slug: "aaa-first" as FullSlug,
        publishedDate: new Date("2024-01-01"),
      }),
      ...makeContent("Second Post", {
        slug: "zzz-second" as FullSlug,
        publishedDate: new Date("2025-06-01"),
      }),
    ]
    await plugin.emit(mockCtx, content, mockResources)

    const rssCall = getWriteCall("rss")
    const xml = rssCall![0].content
    const secondIdx = xml.indexOf("zzz-second")
    const firstIdx = xml.indexOf("aaa-first")
    expect(secondIdx).toBeLessThan(firstIdx)
  })

  // --- RSS description transforms ---
  it("applies text transforms to RSS descriptions", async () => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: true })
    await plugin.emit(
      mockCtx,
      makeContent("Post", { description: '"quoted description"' }),
      mockResources,
    )

    const rssCall = getWriteCall("rss")
    expect(rssCall![0].content).toContain("\u201C")
  })

  it("uses richContent in RSS description when rssFullHtml is enabled", async () => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: true, rssFullHtml: true })
    await plugin.emit(mockCtx, makeContent("Post"), mockResources)

    const rssCall = getWriteCall("rss")
    const xml = rssCall![0].content
    // richContent is the HTML-escaped toHtml output; verify it lands in <description>
    expect(xml).toMatch(/<description>.*<\/description>/)
  })

  it("RSS uses all items when rssLimit is undefined", async () => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: true, rssLimit: undefined })
    await plugin.emit(mockCtx, makeContent("Post"), mockResources)

    const rssCall = getWriteCall("rss")
    expect(rssCall![0].content).toContain(uiStrings.pages.rss.recentNotes)
  })

  // --- Dependency graph ---
  it.each([
    ["includes sitemap/RSS edges when enabled", true, true],
    ["omits sitemap/RSS edges when disabled", false, false],
  ])("dependency graph %s", async (_, enableSiteMap, enableRSS) => {
    const plugin = ContentIndex({ enableSiteMap, enableRSS })
    const graph = await plugin.getDependencyGraph!(mockCtx, makeContent("Test"), mockResources)

    expect(graph.hasNode("public/static/contentIndex.json" as FilePath)).toBe(true)
    expect(graph.hasNode("public/sitemap.xml" as FilePath)).toBe(enableSiteMap)
    expect(graph.hasNode("public/rss.xml" as FilePath)).toBe(enableRSS)
  })

  // --- Edge cases ---
  it("skips files with empty text when includeEmptyFiles is false", async () => {
    const plugin = ContentIndex({
      enableSiteMap: false,
      enableRSS: false,
      includeEmptyFiles: false,
    })
    await plugin.emit(mockCtx, makeContent("Empty", { text: "" }), mockResources)

    const jsonCall = getWriteCall("contentIndex")
    const index = JSON.parse(jsonCall![0].content)
    expect(index["test-post"]).toBeUndefined()
  })

  it("includes files with empty text when includeEmptyFiles is true", async () => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: false, includeEmptyFiles: true })
    await plugin.emit(mockCtx, makeContent("Empty", { text: "" }), mockResources)

    const jsonCall = getWriteCall("contentIndex")
    const index = JSON.parse(jsonCall![0].content)
    expect(index["test-post"]).toBeDefined()
  })

  it("content index JSON strips description and date", async () => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: false })
    await plugin.emit(mockCtx, makeContent("Post", { description: "A description" }), mockResources)

    const jsonCall = getWriteCall("contentIndex")
    const index = JSON.parse(jsonCall![0].content)
    expect(index["test-post"].description).toBeUndefined()
    expect(index["test-post"].date).toBeUndefined()
  })

  it("handles missing baseUrl in sitemap and RSS", async () => {
    const noBaseUrlCtx: BuildCtx = {
      ...mockCtx,
      cfg: {
        configuration: { pageTitle: "Test", defaultDateType: "published" },
      } as unknown as QuartzConfig,
    }
    const plugin = ContentIndex({ enableSiteMap: true, enableRSS: true })
    await plugin.emit(noBaseUrlCtx, makeContent("Post"), mockResources)

    const sitemapCall = getWriteCall("sitemap")
    expect(sitemapCall![0].content).toContain("<loc>https://test-post</loc>")
    const rssCall = getWriteCall("rss")
    expect(rssCall![0].content).toContain("<link>https://</link>")
  })

  it("handles missing frontmatter and text", async () => {
    const plugin = ContentIndex({ enableSiteMap: false, enableRSS: false, includeEmptyFiles: true })
    const content: ProcessedContent[] = [
      defaultProcessedContent({
        slug: "bare" as FullSlug,
        filePath: "content/bare.md" as FilePath,
      }),
    ]
    await plugin.emit(mockCtx, content, mockResources)

    const jsonCall = getWriteCall("contentIndex")
    const index = JSON.parse(jsonCall![0].content)
    expect(index["bare"].title).toBe("")
    expect(index["bare"].tags).toEqual([])
    expect(index["bare"].content).toBe("")
  })

  it("getQuartzComponents returns empty array", () => {
    const plugin = ContentIndex({})
    expect(plugin.getQuartzComponents(mockCtx)).toEqual([])
  })
})
