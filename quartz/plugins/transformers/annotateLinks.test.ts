import type { Element } from "hast"

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals"
import fs from "fs/promises"
import os from "os"
import path from "path"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import type { FullSlug } from "../../util/path"

import { CAN_TRIGGER_POPOVER_CLASS } from "../../components/constants"
import { ANNOTATED_LINK_CLASS } from "../../util/annotations"
import {
  testAnnotation,
  TEST_ANNOTATION_KEY as WIKI_KEY,
} from "../../util/tests/annotationFixtures"
import {
  annotateLink,
  AnnotateLinks,
  annotationKeyForNode,
  loadLinkAnnotations,
} from "./annotateLinks"
import { ArchiveLinks, type ArchiveManifestEntry } from "./archiveLinks"
import { CrawlLinks } from "./links"

function anchor(href?: string, properties: Element["properties"] = {}): Element {
  if (href !== undefined) {
    properties.href = href
  }
  return { type: "element", tagName: "a", properties, children: [] }
}

describe("loadLinkAnnotations", () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "link-annotations-"))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it("returns an empty map when the manifest file is missing", () => {
    expect(loadLinkAnnotations(path.join(dir, "nope.json")).size).toBe(0)
  })

  it("loads and validates a manifest file", async () => {
    const file = path.join(dir, "annotations.json")
    await fs.writeFile(file, JSON.stringify({ [WIKI_KEY]: testAnnotation() }))
    const annotations = loadLinkAnnotations(file)
    expect(annotations.get(WIKI_KEY)).toEqual(testAnnotation())
  })

  it("throws on a malformed manifest", async () => {
    const file = path.join(dir, "bad.json")
    await fs.writeFile(file, JSON.stringify({ [WIKI_KEY]: { title: "no other fields" } }))
    expect(() => loadLinkAnnotations(file)).toThrow('field "attribution" must be an object')
  })

  it("loads the committed manifest when no path is given", () => {
    expect(loadLinkAnnotations()).toBeInstanceOf(Map)
  })

  it("propagates non-ENOENT read errors", () => {
    // A directory path makes readFileSync fail with EISDIR, not ENOENT.
    expect(() => loadLinkAnnotations(dir)).toThrow()
  })
})

describe("annotationKeyForNode", () => {
  it("canonicalizes the href", () => {
    expect(annotationKeyForNode(anchor("https://EN.wikipedia.org/wiki/Foo/"))).toBe(
      "https://en.wikipedia.org/wiki/Foo",
    )
  })

  it("prefers data-original-href over the (archived) href", () => {
    const node = anchor("https://assets.turntrout.com/link-archive/abc/singlefile.html", {
      "data-original-href": WIKI_KEY,
    })
    expect(annotationKeyForNode(node)).toBe(WIKI_KEY)
  })

  it.each([
    ["no href", undefined],
    ["internal link", "/posts/foo"],
    ["anchor link", "#section"],
    ["relative link", "./other"],
    ["mailto link", "mailto:test@example.com"],
    ["malformed http href", "http://"],
  ])("returns null for %s", (_desc, href) => {
    expect(annotationKeyForNode(anchor(href))).toBeNull()
  })

  it("returns null for a non-string href", () => {
    expect(annotationKeyForNode(anchor(undefined, { href: 5 as unknown as string }))).toBeNull()
  })
})

describe("annotateLink", () => {
  const annotations = new Map([[WIKI_KEY, testAnnotation()]])

  it("marks a manifest-hit external link", () => {
    const node = anchor(WIKI_KEY, { className: ["external"] })
    expect(annotateLink(node, annotations)).toBe(true)
    expect(node.properties.className).toEqual([
      "external",
      CAN_TRIGGER_POPOVER_CLASS,
      ANNOTATED_LINK_CLASS,
    ])
    expect(node.properties["data-annotated"]).toBe("true")
  })

  it("adds classes even when no className exists", () => {
    const node = anchor(WIKI_KEY)
    expect(annotateLink(node, annotations)).toBe(true)
    expect(node.properties.className).toEqual([CAN_TRIGGER_POPOVER_CLASS, ANNOTATED_LINK_CLASS])
  })

  it("is idempotent: does not duplicate classes on a second pass", () => {
    const node = anchor(WIKI_KEY)
    annotateLink(node, annotations)
    annotateLink(node, annotations)
    expect(node.properties.className).toEqual([CAN_TRIGGER_POPOVER_CLASS, ANNOTATED_LINK_CLASS])
  })

  it("skips a manifest miss", () => {
    const node = anchor("https://en.wikipedia.org/wiki/Other")
    expect(annotateLink(node, annotations)).toBe(false)
    expect(node.properties.className).toBeUndefined()
    expect(node.properties["data-annotated"]).toBeUndefined()
  })

  it("skips a blocklisted canonical URL", () => {
    const node = anchor(WIKI_KEY)
    expect(annotateLink(node, annotations, [WIKI_KEY])).toBe(false)
    expect(node.properties["data-annotated"]).toBeUndefined()
  })

  it("skips a non-external link", () => {
    const node = anchor("/posts/foo")
    expect(annotateLink(node, annotations)).toBe(false)
  })
})

describe("AnnotateLinks plugin", () => {
  let dir: string
  let annotationsFile: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "annotate-plugin-"))
    annotationsFile = path.join(dir, "annotations.json")
    await fs.writeFile(annotationsFile, JSON.stringify({ [WIKI_KEY]: testAnnotation() }))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  function makeProcessor() {
    const plugin = AnnotateLinks({ annotationsPath: annotationsFile })
    const ctx = {} as Parameters<NonNullable<ReturnType<typeof AnnotateLinks>["htmlPlugins"]>>[0]
    const htmlPlugins = plugin.htmlPlugins?.(ctx)
    if (!htmlPlugins) throw new Error("AnnotateLinks did not return htmlPlugins")
    return unified().use(rehypeParse, { fragment: true }).use(htmlPlugins).use(rehypeStringify)
  }

  it("marks manifest-hit links and leaves other elements alone", async () => {
    const html =
      `<p>text</p><a href="${WIKI_KEY}">annotated</a>` +
      '<a href="https://unknown.example.com/page">plain</a>'
    const out = String(await makeProcessor().process({ value: html }))
    expect(out).toContain('data-annotated="true"')
    expect(out).toContain(ANNOTATED_LINK_CLASS)
    expect(out).toContain("<p>text</p>")
    // Only the manifest-hit link is marked
    expect(out.match(/data-annotated/g)).toHaveLength(1)
  })

  it("defaults to the committed manifest path when none is provided", () => {
    expect(AnnotateLinks().name).toBe("AnnotateLinks")
  })
})

// An archived link's href points at the archive copy; the annotation lookup
// must go through the live URL recorded in data-original-href.
describe("AnnotateLinks after CrawlLinks and ArchiveLinks", () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "annotate-roundtrip-"))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it("annotates an archived link via its original URL", async () => {
    const archiveEntry: ArchiveManifestEntry = {
      archive_url: "https://assets.turntrout.com/link-archive/abc/singlefile.html",
      dead: true,
      dead_strikes: 2,
      last_status: 404,
      last_checked: "2026-01-01T00:00:00Z",
    }
    const archiveFile = path.join(dir, "archive.json")
    const annotationsFile = path.join(dir, "annotations.json")
    await fs.writeFile(archiveFile, JSON.stringify({ [WIKI_KEY]: archiveEntry }))
    await fs.writeFile(annotationsFile, JSON.stringify({ [WIKI_KEY]: testAnnotation() }))

    const crawl = CrawlLinks({
      lazyLoad: true,
      prettyLinks: false,
      openLinksInNewTab: false,
      markdownLinkResolution: "shortest",
    })
    const crawlCtx = { allSlugs: ["test-page"] as FullSlug[] } as Parameters<
      NonNullable<ReturnType<typeof CrawlLinks>["htmlPlugins"]>
    >[0]
    const pluginCtx = {} as Parameters<
      NonNullable<ReturnType<typeof ArchiveLinks>["htmlPlugins"]>
    >[0]
    const crawlPlugins = crawl.htmlPlugins?.(crawlCtx)
    const archivePlugins = ArchiveLinks({ manifestPath: archiveFile }).htmlPlugins?.(pluginCtx)
    const annotatePlugins = AnnotateLinks({ annotationsPath: annotationsFile }).htmlPlugins?.(
      pluginCtx,
    )
    if (!crawlPlugins || !archivePlugins || !annotatePlugins) {
      throw new Error("missing htmlPlugins")
    }

    const processor = unified()
      .use(rehypeParse, { fragment: true })
      .use(crawlPlugins)
      .use(archivePlugins)
      .use(annotatePlugins)
      .use(rehypeStringify)

    const out = String(
      await processor.process({
        value: `<a href="${WIKI_KEY}">x</a>`,
        data: { slug: "test-page" as FullSlug },
      }),
    )
    expect(out).toContain(`href="${archiveEntry.archive_url}"`)
    expect(out).toContain('data-annotated="true"')
    expect(out).toContain(ANNOTATED_LINK_CLASS)
  })
})
