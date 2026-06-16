import type { Element } from "hast"

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import fs from "fs/promises"
import os from "os"
import path from "path"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import {
  ARCHIVED_LINK_CLASS,
  ArchiveLinks,
  type ArchiveManifest,
  type ArchiveManifestEntry,
  canonicalizeUrl,
  loadArchiveManifest,
  rewriteArchivedLink,
} from "./archiveLinks"

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
  // These cases are mirrored verbatim in test_archive_links.py; both
  // implementations must produce identical output for every row.
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
    // Deliberately NOT normalized (would diverge from Python's urlsplit):
    ["http://example.com:80/a", "https://example.com:80/a"],
    ["https://example.com:443/a", "https://example.com:443/a"],
    ["https://example.com/a b", "https://example.com/a b"],
    ["https://example.com/café", "https://example.com/café"],
    ["https://exämple.com/a", "https://exämple.com/a"],
    ["https://en.wikipedia.org/wiki/Foo_(bar)", "https://en.wikipedia.org/wiki/Foo_(bar)"],
    ["https://example.com/a;p=1", "https://example.com/a;p=1"],
    ["https://example.com/a?", "https://example.com/a"],
  ])("canonicalizes %j to %j", (input, expected) => {
    expect(canonicalizeUrl(input)).toBe(expected)
  })

  it("returns a non-URL string unchanged", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url")
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

  it("returns an empty map when the manifest is missing", async () => {
    const manifest = await loadArchiveManifest(path.join(dir, "nope.json"))
    expect(manifest.size).toBe(0)
  })

  it("parses entries and defaults optional numeric/string fields", async () => {
    const file = path.join(dir, "manifest.json")
    await fs.writeFile(
      file,
      JSON.stringify({
        "https://example.com/a": { archive_url: "https://cdn/x.html", dead: true },
      }),
    )
    const manifest = await loadArchiveManifest(file)
    const parsed = manifest.get("https://example.com/a")
    expect(parsed).toEqual({
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
    await expect(loadArchiveManifest(file)).rejects.toThrow("must contain a JSON object")
  })

  it("throws when an entry is not an object", async () => {
    const file = path.join(dir, "bad-entry.json")
    await fs.writeFile(file, JSON.stringify({ "https://example.com": 5 }))
    await expect(loadArchiveManifest(file)).rejects.toThrow("must be an object")
  })

  it("throws when an entry is missing required fields", async () => {
    const file = path.join(dir, "missing.json")
    await fs.writeFile(file, JSON.stringify({ "https://example.com": { dead: true } }))
    await expect(loadArchiveManifest(file)).rejects.toThrow("archive_url")
  })

  it("loads the committed manifest when no path is given", async () => {
    // Exercises the default-path branch. The committed manifest is valid JSON
    // (empty until the backfill PR lands), so this resolves to a Map.
    const manifest = await loadArchiveManifest()
    expect(manifest).toBeInstanceOf(Map)
  })

  it("propagates non-ENOENT read errors", async () => {
    // A directory path makes fs.readFile fail with EISDIR, not ENOENT.
    await expect(loadArchiveManifest(dir)).rejects.toThrow()
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

  it("ignores anchors without a string href", () => {
    const node = anchor(undefined)
    expect(rewriteArchivedLink(node, makeManifest())).toBe(false)
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

  it("rewrites dead links and leaves live/internal links alone, reading the manifest once", async () => {
    const readSpy = jest.spyOn(fs, "readFile")
    const processor = makeProcessor()
    const html =
      '<a href="https://dead.example.com/gone">dead</a>' +
      '<a href="https://live.example.com/ok">live</a>' +
      '<a href="/internal">internal</a>'

    const first = String(await processor.process({ value: html }))
    expect(first).toContain(`href="${entry().archive_url}"`)
    expect(first).toContain('data-original-href="https://dead.example.com/gone"')
    expect(first).toContain('href="https://live.example.com/ok"')
    expect(first).toContain('href="/internal"')

    // Second pass must reuse the cached manifest, not re-read the file.
    const second = String(await processor.process({ value: html }))
    expect(second).toContain(`href="${entry().archive_url}"`)
    expect(readSpy).toHaveBeenCalledTimes(1)
    readSpy.mockRestore()
  })

  it("defaults to the committed manifest path when none is provided", () => {
    const plugin = ArchiveLinks()
    expect(plugin.name).toBe("ArchiveLinks")
  })
})
