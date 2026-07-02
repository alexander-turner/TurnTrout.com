import type { Element } from "hast"

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals"
import fs from "fs/promises"
import os from "os"
import path from "path"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import type { FullSlug } from "../../util/path"

import {
  ARCHIVED_LINK_CLASS,
  ArchiveLinks,
  type ArchiveManifest,
  type ArchiveManifestEntry,
  canonicalizeUrl,
  loadArchiveManifest,
  rewriteArchivedLink,
} from "./archiveLinks"
import { CrawlLinks } from "./links"

function entry(overrides: Partial<ArchiveManifestEntry> = {}): ArchiveManifestEntry {
  return {
    archive_url: "https://assets.turntrout.com/link-archive/abc/singlefile.html",
    dead: true,
    dead_strikes: 2,
    last_status: 404,
    last_checked: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("canonicalizeUrl", () => {
  it.each([
    ["https://example.com/", "https://example.com"],
    ["https://example.com", "https://example.com"],
    ["http://Example.com/Path/", "https://example.com/Path"],
    ["https://EXAMPLE.com/a?q=1", "https://example.com/a?q=1"],
    ["https://example.com/a/?q=1", "https://example.com/a?q=1"],
    ["https://example.com/a#frag", "https://example.com/a"],
    ["https://example.com/a/#frag", "https://example.com/a"],
    ["https://example.com:8080/a/", "https://example.com:8080/a"],
    ["http://example.com/keep?x=1&y=2#z", "https://example.com/keep?x=1&y=2"],
    ["https://user:pw@example.com/a", "https://example.com/a"],
    // WHATWG normalization (the writer mirrors this with the same ada parser):
    ["http://example.com:80/a", "https://example.com/a"],
    ["https://example.com:443/a", "https://example.com/a"],
    ["https://example.com/a b", "https://example.com/a%20b"],
    ["https://example.com/café", "https://example.com/caf%C3%A9"],
    ["https://exämple.com/a", "https://xn--exmple-cua.com/a"],
    ["https://en.wikipedia.org/wiki/Foo_(bar)", "https://en.wikipedia.org/wiki/Foo_(bar)"],
    ["https://example.com/a;p=1", "https://example.com/a;p=1"],
    ["https://example.com/a?", "https://example.com/a"],
  ])("canonicalizes %j to %j", (input, expected) => {
    expect(canonicalizeUrl(input)).toBe(expected)
  })

  it("throws on an unparsable URL", () => {
    expect(() => canonicalizeUrl("not a url")).toThrow()
  })
})

describe("loadArchiveManifest", () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "archive-manifest-"))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it("returns an empty map when the manifest is missing", () => {
    expect(loadArchiveManifest(path.join(dir, "nope.json")).size).toBe(0)
  })

  it("parses entries and defaults optional numeric/string fields", async () => {
    const file = path.join(dir, "manifest.json")
    await fs.writeFile(
      file,
      JSON.stringify({
        "https://example.com/a": { archive_url: "https://cdn/x.html", dead: true },
      }),
    )
    expect(loadArchiveManifest(file).get("https://example.com/a")).toEqual({
      archive_url: "https://cdn/x.html",
      dead: true,
      dead_strikes: 0,
      last_status: 0,
      last_checked: "",
    })
  })

  it.each([
    ["a JSON array", "[]"],
    ["a JSON scalar", '"hello"'],
    ["a JSON null", "null"],
  ])("throws when the manifest is %s", async (_desc, body) => {
    const file = path.join(dir, "bad.json")
    await fs.writeFile(file, body)
    expect(() => loadArchiveManifest(file)).toThrow("must contain a JSON object")
  })

  it("throws when an entry is not an object", async () => {
    const file = path.join(dir, "bad-entry.json")
    await fs.writeFile(file, JSON.stringify({ "https://example.com": 5 }))
    expect(() => loadArchiveManifest(file)).toThrow("must be an object")
  })

  it("throws when an entry is missing required fields", async () => {
    const file = path.join(dir, "missing.json")
    await fs.writeFile(file, JSON.stringify({ "https://example.com": { dead: true } }))
    expect(() => loadArchiveManifest(file)).toThrow("archive_url")
  })

  it("loads the committed manifest when no path is given", () => {
    // Exercises the default-path branch. The committed manifest is valid JSON
    // (empty until the writer populates it), so this returns a Map.
    expect(loadArchiveManifest()).toBeInstanceOf(Map)
  })

  it("propagates non-ENOENT read errors", () => {
    // A directory path makes readFileSync fail with EISDIR, not ENOENT.
    expect(() => loadArchiveManifest(dir)).toThrow()
  })
})

describe("rewriteArchivedLink", () => {
  function makeManifest(
    pairs: Record<string, ArchiveManifestEntry> = {
      "https://dead.example.com/gone": entry(),
    },
  ): ArchiveManifest {
    return new Map(Object.entries(pairs))
  }

  function anchor(href?: string, className?: string[]): Element {
    const properties: Element["properties"] = {}
    if (href !== undefined) {
      properties.href = href
    }
    if (className !== undefined) {
      properties.className = className
    }
    return { type: "element", tagName: "a", properties, children: [] }
  }

  it("rewrites a dead external link and records the original href", () => {
    const node = anchor("https://dead.example.com/gone/#frag", ["external"])
    const changed = rewriteArchivedLink(node, makeManifest())
    expect(changed).toBe(true)
    expect(node.properties.href).toBe(entry().archive_url)
    expect(node.properties["data-original-href"]).toBe("https://dead.example.com/gone/#frag")
    expect(node.properties.className).toContain(ARCHIVED_LINK_CLASS)
    expect(node.properties.className).toContain("external")
  })

  it("adds the archived class even when no className exists", () => {
    const node = anchor("https://dead.example.com/gone")
    rewriteArchivedLink(node, makeManifest())
    expect(node.properties.className).toEqual([ARCHIVED_LINK_CLASS])
  })

  it("does not duplicate the archived class", () => {
    const node = anchor("https://dead.example.com/gone", [ARCHIVED_LINK_CLASS])
    rewriteArchivedLink(node, makeManifest())
    expect(node.properties.className).toEqual([ARCHIVED_LINK_CLASS])
  })

  it("leaves a live in-manifest link untouched", () => {
    const manifest = makeManifest({
      "https://live.example.com/ok": entry({ dead: false }),
    })
    const node = anchor("https://live.example.com/ok", ["external"])
    expect(rewriteArchivedLink(node, manifest)).toBe(false)
    expect(node.properties.href).toBe("https://live.example.com/ok")
  })

  it.each([
    ["unknown external link", "https://unknown.example.com/page"],
    ["internal link", "/posts/foo"],
    ["anchor link", "#section"],
    ["relative link", "./other"],
    ["mailto link", "mailto:test@example.com"],
  ])("leaves %s untouched", (_desc, href) => {
    const node = anchor(href)
    expect(rewriteArchivedLink(node, makeManifest())).toBe(false)
    expect(node.properties.href).toBe(href)
  })

  it("leaves a dead entry with an empty archive_url untouched", () => {
    const manifest = makeManifest({
      "https://dead.example.com/gone": entry({ archive_url: "" }),
    })
    const node = anchor("https://dead.example.com/gone", ["external"])
    expect(rewriteArchivedLink(node, manifest)).toBe(false)
    expect(node.properties.href).toBe("https://dead.example.com/gone")
    expect(node.properties["data-original-href"]).toBeUndefined()
  })

  it("ignores anchors without a string href", () => {
    const node = anchor()
    expect(rewriteArchivedLink(node, makeManifest())).toBe(false)
  })

  it("leaves a malformed http href untouched instead of throwing", () => {
    const node = anchor("http://")
    expect(rewriteArchivedLink(node, makeManifest())).toBe(false)
    expect(node.properties.href).toBe("http://")
  })
})

describe("ArchiveLinks plugin", () => {
  let dir: string
  let manifestFile: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "archive-plugin-"))
    manifestFile = path.join(dir, "manifest.json")
    await fs.writeFile(
      manifestFile,
      JSON.stringify({
        "https://dead.example.com/gone": entry(),
        "https://live.example.com/ok": entry({ dead: false }),
      }),
    )
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  function makeProcessor() {
    const plugin = ArchiveLinks({ manifestPath: manifestFile })
    const ctx = {} as Parameters<NonNullable<ReturnType<typeof ArchiveLinks>["htmlPlugins"]>>[0]
    const htmlPlugins = plugin.htmlPlugins?.(ctx)
    if (!htmlPlugins) throw new Error("ArchiveLinks did not return htmlPlugins")
    return unified().use(rehypeParse, { fragment: true }).use(htmlPlugins).use(rehypeStringify)
  }

  it("rewrites dead links and leaves live/internal links alone", async () => {
    const html =
      '<a href="https://dead.example.com/gone">dead</a>' +
      '<a href="https://live.example.com/ok">live</a>' +
      '<a href="/internal">internal</a>'

    const out = String(await makeProcessor().process({ value: html }))
    expect(out).toContain(`href="${entry().archive_url}"`)
    expect(out).toContain('data-original-href="https://dead.example.com/gone"')
    expect(out).toContain('href="https://live.example.com/ok"')
    expect(out).toContain('href="/internal"')
  })

  it("defaults to the committed manifest path when none is provided", () => {
    expect(ArchiveLinks().name).toBe("ArchiveLinks")
  })

  it("visits non-anchor elements without error", async () => {
    const html = '<p>Some text</p><a href="https://dead.example.com/gone">dead</a>'
    const out = String(await makeProcessor().process({ value: html }))
    expect(out).toContain(`href="${entry().archive_url}"`)
    expect(out).toContain("<p>Some text</p>")
  })
})

// The transformer looks up the manifest by the href AFTER CrawlLinks has
// normalized it. This round-trip proves CrawlLinks leaves the canonical key
// unchanged, so a key derived from the raw Markdown URL still matches.
describe("ArchiveLinks after CrawlLinks (manifest-key round trip)", () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "archive-roundtrip-"))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it.each([
    ["https://Dead.Example.com/Gone/", "https://dead.example.com/Gone"],
    ["https://dead.example.com/p?a=1&b=2", "https://dead.example.com/p?a=1&b=2"],
    ["https://dead.example.com/wiki/Foo_(bar)", "https://dead.example.com/wiki/Foo_(bar)"],
  ])("rewrites %j (canonical key %j) after CrawlLinks", async (rawHref, expectedKey) => {
    expect(canonicalizeUrl(rawHref)).toBe(expectedKey)

    const archiveUrl = "https://assets.turntrout.com/link-archive/rt/singlefile.html"
    const manifestFile = path.join(dir, "manifest.json")
    await fs.writeFile(
      manifestFile,
      JSON.stringify({ [expectedKey]: entry({ archive_url: archiveUrl }) }),
    )

    const crawl = CrawlLinks({
      lazyLoad: true,
      prettyLinks: false,
      openLinksInNewTab: false,
      markdownLinkResolution: "shortest",
    })
    const archive = ArchiveLinks({ manifestPath: manifestFile })
    const crawlCtx = { allSlugs: ["test-page"] as FullSlug[] } as Parameters<
      NonNullable<ReturnType<typeof CrawlLinks>["htmlPlugins"]>
    >[0]
    const archiveCtx = {} as Parameters<
      NonNullable<ReturnType<typeof ArchiveLinks>["htmlPlugins"]>
    >[0]
    const crawlPlugins = crawl.htmlPlugins?.(crawlCtx)
    const archivePlugins = archive.htmlPlugins?.(archiveCtx)
    if (!crawlPlugins || !archivePlugins) throw new Error("missing htmlPlugins")

    const processor = unified()
      .use(rehypeParse, { fragment: true })
      .use(crawlPlugins)
      .use(archivePlugins)
      .use(rehypeStringify)

    const result = String(
      await processor.process({
        value: `<a href="${rawHref}">x</a>`,
        data: { slug: "test-page" as FullSlug },
      }),
    )
    // The href becoming the archive URL is what proves CrawlLinks left the
    // canonical key unchanged.
    expect(result).toContain(`href="${archiveUrl}"`)
    expect(result).toContain(ARCHIVED_LINK_CLASS)
  })
})
