import type { Element, Root } from "hast"

import { afterEach, describe, expect, it } from "@jest/globals"
import fs from "fs"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"
import { VFile } from "vfile"

import type { TitleIndex } from "../../processors/buildTitleIndex"
import type { FilePath, FullSlug } from "../../util/path"

import { titleIndexFile } from "../../components/constants.server"
import { writeTitleIndex } from "../../processors/buildTitleIndex"
import {
  BindLinkTitles,
  bindTitlesInTree,
  readTitleIndex,
  resetTitleIndexCache,
} from "./bindLinkTitles"
import { CrawlLinks } from "./links"

type HtmlPluginFn = () => (tree: Root, file: VFile) => void | Promise<void>

function index(
  entries: Record<string, { title: string; headings?: Record<string, string> }>,
): TitleIndex {
  return new Map(
    Object.entries(entries).map(([slug, t]) => [
      slug as FullSlug,
      { title: t.title, headings: new Map(Object.entries(t.headings ?? {})) },
    ]),
  )
}

/** A title-bound anchor with hyphenated `data-*` keys, as the real pipeline sets. */
function boundAnchor(props: Record<string, string>, text = "@title"): Element {
  return {
    type: "element",
    tagName: "a",
    properties: props,
    children: [{ type: "text", value: text }],
  }
}

function tree(...children: Element[]): Root {
  return { type: "root", children }
}

function textOf(root: Root): string {
  const stringifier = unified().use(rehypeStringify)
  return String(stringifier.stringify(root))
}

describe("bindTitlesInTree", () => {
  const idx = index({
    "other-page": { title: "The Live Title", headings: { "some-heading": "Live Heading" } },
    self: { title: "Self", headings: { local: "Local Heading" } },
  })

  it("binds a page link to the target's current title", () => {
    const root = tree(boundAnchor({ "data-slug": "other-page", href: "/other-page" }))
    bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")
    expect(textOf(root)).toContain(">The Live Title<")
  })

  it("binds a section link to the target heading's current text", () => {
    const root = tree(
      boundAnchor({
        "data-slug": "other-page",
        href: "/other-page#some-heading",
      }),
    )
    bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")
    expect(textOf(root)).toContain(">Live Heading<")
  })

  it("binds a same-page anchor against the current page", () => {
    const root = tree(boundAnchor({ href: "#local" }))
    bindTitlesInTree(root, idx, "self" as FullSlug, "self.md")
    expect(textOf(root)).toContain(">Local Heading<")
  })

  it("re-resolves even when the text is no longer the sentinel", () => {
    const root = tree(boundAnchor({ "data-slug": "other-page", href: "/other-page" }, "Stale"))
    bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")
    // "Stale" is not the sentinel, so it is left untouched (idempotency is
    // guaranteed by re-running before favicons on a freshly parsed tree).
    expect(textOf(root)).toContain(">Stale<")
  })

  it("trims whitespace around the sentinel", () => {
    const root = tree(boundAnchor({ "data-slug": "other-page", href: "/other-page" }, "  @title  "))
    bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")
    expect(textOf(root)).toContain(">The Live Title<")
  })

  it("ignores non-anchor elements", () => {
    const span: Element = {
      type: "element",
      tagName: "span",
      properties: {},
      children: [{ type: "text", value: "@title" }],
    }
    const root = tree(span)
    bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")
    expect(textOf(root)).toContain(">@title<")
  })

  it("ignores anchors with multiple children", () => {
    const anchor: Element = {
      type: "element",
      tagName: "a",
      properties: { "data-slug": "other-page", href: "/other-page" },
      children: [
        { type: "text", value: "@title" },
        { type: "element", tagName: "em", properties: {}, children: [] },
      ],
    }
    const root = tree(anchor)
    bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")
    expect(textOf(root)).toContain("@title")
  })

  it("leaves the sentinel on an external/unresolvable link as literal text", () => {
    const root = tree(boundAnchor({ href: "https://example.com" }))
    bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")
    expect(textOf(root)).toContain(">@title<")
  })

  it("ignores anchors without an href", () => {
    const root = tree(boundAnchor({ "data-slug": "other-page" }))
    bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")
    expect(textOf(root)).toContain(">@title<")
  })

  it("throws on a missing target page", () => {
    const root = tree(boundAnchor({ "data-slug": "ghost", href: "/ghost" }))
    expect(() => bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")).toThrow(
      /missing page "ghost"/,
    )
  })

  it("throws on a same-page link when the current page has no slug", () => {
    const root = tree(boundAnchor({ href: "#local" }))
    expect(() => bindTitlesInTree(root, idx, undefined, "source.md")).toThrow(/missing page/)
  })

  it("throws on a missing target heading", () => {
    const root = tree(boundAnchor({ "data-slug": "other-page", href: "/other-page#gone" }))
    expect(() => bindTitlesInTree(root, idx, "source" as FullSlug, "source.md")).toThrow(
      /missing heading "#gone"/,
    )
  })
})

describe("readTitleIndex", () => {
  afterEach(() => {
    resetTitleIndexCache()
    fs.rmSync(titleIndexFile, { force: true })
  })

  it("returns an empty index when the cache file is absent", async () => {
    resetTitleIndexCache()
    fs.rmSync(titleIndexFile, { force: true })
    expect((await readTitleIndex()).size).toBe(0)
  })

  it("rethrows read errors that are not ENOENT", async () => {
    resetTitleIndexCache()
    fs.rmSync(titleIndexFile, { force: true, recursive: true })
    fs.mkdirSync(titleIndexFile)
    await expect(readTitleIndex()).rejects.toThrow()
    fs.rmdirSync(titleIndexFile)
    resetTitleIndexCache()
  })

  it("reads a written index and caches it", async () => {
    await writeTitleIndex(index({ p: { title: "Cached", headings: { h: "Heading" } } }))
    resetTitleIndexCache()

    const first = await readTitleIndex()
    expect(first.get("p" as FullSlug)?.title).toBe("Cached")
    expect(first.get("p" as FullSlug)?.headings.get("h")).toBe("Heading")

    // Second read returns the same cached instance.
    fs.rmSync(titleIndexFile, { force: true })
    expect(await readTitleIndex()).toBe(first)
  })
})

describe("BindLinkTitles plugin", () => {
  afterEach(() => {
    resetTitleIndexCache()
    fs.rmSync(titleIndexFile, { force: true })
  })

  async function runPlugin(root: Root, slug?: string, filePath?: string): Promise<void> {
    const plugin = BindLinkTitles()
    const htmlPlugins = plugin.htmlPlugins?.(
      {} as Parameters<NonNullable<typeof plugin.htmlPlugins>>[0],
    )
    if (!htmlPlugins) throw new Error("BindLinkTitles did not return htmlPlugins")

    const file = new VFile("")
    if (slug) file.data.slug = slug as FullSlug
    if (filePath) file.data.filePath = filePath as FilePath
    for (const p of htmlPlugins) {
      await (p as HtmlPluginFn)()(root, file)
    }
  }

  it("substitutes a bound link's text from the cache file", async () => {
    await writeTitleIndex(index({ "other-page": { title: "From Cache" } }))
    resetTitleIndexCache()
    const root = tree(boundAnchor({ "data-slug": "other-page", href: "/other-page" }))
    await runPlugin(root, "source", "source.md")
    expect(textOf(root)).toContain(">From Cache<")
  })

  it("uses <unknown file> in errors when the file has no slug or path", async () => {
    await writeTitleIndex(index({}))
    resetTitleIndexCache()
    const root = tree(boundAnchor({ "data-slug": "ghost", href: "/ghost" }))
    await expect(runPlugin(root)).rejects.toThrow(/in <unknown file>/)
  })

  it("resolves the data-slug that CrawlLinks sets, end to end", async () => {
    await writeTitleIndex(index({ "other-page": { title: "Resolved Title" } }))
    resetTitleIndexCache()

    const crawl = CrawlLinks({ markdownLinkResolution: "shortest", prettyLinks: true })
    const crawlPlugins = crawl.htmlPlugins?.({
      allSlugs: ["source", "other-page"] as FullSlug[],
    } as Parameters<NonNullable<typeof crawl.htmlPlugins>>[0])
    const bindPlugins = BindLinkTitles().htmlPlugins?.(
      {} as Parameters<NonNullable<ReturnType<typeof BindLinkTitles>["htmlPlugins"]>>[0],
    )
    if (!crawlPlugins || !bindPlugins) throw new Error("missing html plugins")

    const processor = unified()
      .use(rehypeParse, { fragment: true })
      .use(crawlPlugins)
      .use(bindPlugins)
      .use(rehypeStringify)
    const file = new VFile({ value: '<a href="/other-page">@title</a>' })
    file.data.slug = "source" as FullSlug
    const out = String(await processor.process(file))
    expect(out).toContain(">Resolved Title<")
  })
})
