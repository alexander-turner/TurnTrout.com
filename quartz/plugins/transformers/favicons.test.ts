/**
 * @jest-environment node
 */
import type { Element, Parent, Properties } from "hast"

import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { h } from "hastscript"
// skipcq: JS-C1003
import { visit } from "unist-util-visit"

import * as favicons from "./favicons"

jest.mock("fs")
import fs from "fs"

import {
  defaultPath,
  localTroutFaviconBasename,
  simpleConstants,
  specialFaviconPaths,
} from "../../components/constants"
import { normalizeFaviconListEntry } from "../../util/favicon-config"
import { hasClass } from "./utils"

const { minFaviconCount, faviconSubstringBlocklist } = simpleConstants

const faviconSpanNode = {
  type: "element",
  tagName: "span",
  properties: { className: "favicon-span" },
}

const createExpectedFavicon = (
  imgPath: string,
  nudgeClass?: "close-text" | "closer-text",
): Record<string, unknown> => {
  const faviconElement = favicons.createFaviconElement(imgPath)
  faviconElement.properties.class = `favicon${nudgeClass ? ` ${nudgeClass}` : ""}`
  return faviconElement as unknown as Record<string, unknown>
}

const mockCdnLookup = (cdnOk = false): void => {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue({ ok: cdnOk, status: cdnOk ? 200 : 404 } as Response)
}

beforeEach(() => {
  jest.resetAllMocks()
  favicons.faviconExistsCache.clear()
})

describe("getQuartzPath", () => {
  it.each([
    ["www.example.com", "/static/images/external-favicons/example_com.svg"],
    ["localhost", specialFaviconPaths.turntrout],
    ["turntrout.com", specialFaviconPaths.turntrout],
    ["subdomain.example.org", "/static/images/external-favicons/example_org.svg"],
    ["blog.openai.com", "/static/images/external-favicons/openai_com.svg"],
    ["support.apple.com", "/static/images/external-favicons/apple_com.svg"],
    ["www.www.example.com", "/static/images/external-favicons/example_com.svg"],
    ["subdomain.turntrout.com", specialFaviconPaths.turntrout],
    ["example.co.uk", "/static/images/external-favicons/example_co_uk.svg"],
    ["test.example.co.uk", "/static/images/external-favicons/example_co_uk.svg"],
  ])("returns expected path for %s", (hostname, expectedPath) => {
    expect(favicons.getQuartzPath(hostname)).toBe(expectedPath)
  })

  it.each([
    ["scholar.google.com", "/static/images/external-favicons/scholar_google_com.svg"],
    ["play.google.com", "/static/images/external-favicons/play_google_com.svg"],
    ["docs.google.com", "/static/images/external-favicons/docs_google_com.svg"],
    ["mail.google.com", "/static/images/external-favicons/mail_google_com.svg"],
  ])("preserves allowlisted google subdomain %s", (hostname, expected) => {
    expect(favicons.getQuartzPath(hostname)).toBe(expected)
  })

  it.each(["math", "gaming", "stats", "ai"])(
    "collapses stackexchange subdomain %s.stackexchange.com to the root domain",
    (subdomain) => {
      const hostname = `${subdomain}.stackexchange.com`
      const expected = "/static/images/external-favicons/stackexchange_com.svg"
      expect(favicons.getQuartzPath(hostname)).toBe(expected)
    },
  )

  it.each([
    ["transformer-circuits.pub", "/static/images/external-favicons/anthropic_com.svg"],
    ["news.nbc.com", "/static/images/external-favicons/msnbc_com.svg"],
    ["protonvpn.com", "/static/images/external-favicons/proton_me.svg"],
  ])("applies special domain mappings: %s -> %s", (hostname, expected) => {
    expect(favicons.getQuartzPath(hostname)).toBe(expected)
  })
})

describe("getFaviconUrl", () => {
  it.each([
    [
      "/static/images/external-favicons/example_com.svg",
      "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
    ],
    [specialFaviconPaths.turntrout, specialFaviconPaths.turntrout],
    [specialFaviconPaths.mail, specialFaviconPaths.mail],
    ["https://example.com/favicon.ico", "https://example.com/favicon.ico"],
  ])("constructs URL from path %s", (path, expectedUrl) => {
    expect(favicons.getFaviconUrl(path)).toBe(expectedUrl)
  })
})

describe("normalizePathForCounting", () => {
  it("preserves full URLs", () => {
    expect(favicons.normalizePathForCounting(specialFaviconPaths.mail)).toBe(
      specialFaviconPaths.mail,
    )
  })

  it("preserves .ico paths", () => {
    const icoPath = `/static/images/${localTroutFaviconBasename}`
    expect(favicons.normalizePathForCounting(icoPath)).toBe(icoPath)
  })

  it("removes .svg extension", () => {
    expect(
      favicons.normalizePathForCounting("/static/images/external-favicons/example_com.svg"),
    ).toBe("/static/images/external-favicons/example_com")
  })
})

describe("transformUrl", () => {
  it("returns path unchanged for non-blocklisted path", () => {
    const input = "/static/images/external-favicons/example_com.svg"
    expect(favicons.transformUrl(input)).toBe(input)
  })

  it.each(
    faviconSubstringBlocklist.map((entry: string) => [
      `/static/images/external-favicons/${normalizeFaviconListEntry(entry)}.svg`,
    ]),
  )("returns defaultPath for blocklisted path %s", (input) => {
    expect(favicons.transformUrl(input)).toBe(defaultPath)
  })
})

describe("findFaviconPath", () => {
  const hostname = "example.com"
  const expectedPath = "/static/images/external-favicons/example_com.svg"
  const expectedCdnUrl = `https://assets.turntrout.com${expectedPath}`

  it("returns null for blocklisted hostname without any network call", async () => {
    const fetchSpy = jest.spyOn(global, "fetch")
    expect(await favicons.findFaviconPath("incompleteideas.net")).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns SVG path when CDN has the SVG", async () => {
    mockCdnLookup(true)
    expect(await favicons.findFaviconPath(hostname)).toBe(expectedPath)
    expect(global.fetch).toHaveBeenCalledWith(expectedCdnUrl)
    await expect(favicons.faviconExistsCache.get(expectedPath)).resolves.toBe(true)
  })

  it("returns null when CDN does not have the SVG", async () => {
    mockCdnLookup(false)
    expect(await favicons.findFaviconPath(hostname)).toBeNull()
    await expect(favicons.faviconExistsCache.get(expectedPath)).resolves.toBe(false)
  })

  it("uses cached positive result without re-querying", async () => {
    favicons.faviconExistsCache.set(expectedPath, Promise.resolve(true))
    const fetchSpy = jest.spyOn(global, "fetch")
    expect(await favicons.findFaviconPath(hostname)).toBe(expectedPath)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("falls back to unnormalized SVG path when normalized is missing on CDN", async () => {
    const subdomainHost = "open.spotify.com"
    const normalizedPath = "/static/images/external-favicons/spotify_com.svg"
    const unnormalizedPath = "/static/images/external-favicons/open_spotify_com.svg"

    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation((url: string | URL | Request) => {
        const urlString = url.toString()
        const ok = urlString.includes("open_spotify_com")
        return Promise.resolve({ ok, status: ok ? 200 : 404 } as Response)
      })

    expect(await favicons.findFaviconPath(subdomainHost)).toBe(unnormalizedPath)
    await expect(favicons.faviconExistsCache.get(normalizedPath)).resolves.toBe(false)
    await expect(favicons.faviconExistsCache.get(unnormalizedPath)).resolves.toBe(true)
    fetchSpy.mockRestore()
  })

  it("returns null when both normalized and unnormalized are missing", async () => {
    const subdomainHost = "open.spotify.com"
    const unnormalizedPath = "/static/images/external-favicons/open_spotify_com.svg"
    mockCdnLookup(false)
    expect(await favicons.findFaviconPath(subdomainHost)).toBeNull()
    await expect(favicons.faviconExistsCache.get(unnormalizedPath)).resolves.toBe(false)
  })

  it("uses cached unnormalized-positive result", async () => {
    const subdomainHost = "open.spotify.com"
    const normalizedPath = "/static/images/external-favicons/spotify_com.svg"
    const unnormalizedPath = "/static/images/external-favicons/open_spotify_com.svg"
    favicons.faviconExistsCache.set(normalizedPath, Promise.resolve(false))
    favicons.faviconExistsCache.set(unnormalizedPath, Promise.resolve(true))
    const fetchSpy = jest.spyOn(global, "fetch")
    expect(await favicons.findFaviconPath(subdomainHost)).toBe(unnormalizedPath)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns null when unnormalized is cached missing", async () => {
    const subdomainHost = "open.spotify.com"
    const normalizedPath = "/static/images/external-favicons/spotify_com.svg"
    const unnormalizedPath = "/static/images/external-favicons/open_spotify_com.svg"
    favicons.faviconExistsCache.set(normalizedPath, Promise.resolve(false))
    favicons.faviconExistsCache.set(unnormalizedPath, Promise.resolve(false))
    const fetchSpy = jest.spyOn(global, "fetch")
    expect(await favicons.findFaviconPath(subdomainHost)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("uses the full URL directly for special CDN paths like turntrout.com", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response)
    expect(await favicons.findFaviconPath("turntrout.com")).toBe(specialFaviconPaths.turntrout)
    expect(fetchSpy).toHaveBeenCalledWith(specialFaviconPaths.turntrout)
  })

  it("returns null when CDN fetch throws", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"))
    expect(await favicons.findFaviconPath(hostname)).toBeNull()
  })

  it("retries on server error then succeeds", async () => {
    const fetchSpy = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
    expect(await favicons.findFaviconPath(hostname)).toBe(expectedPath)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe("readFaviconCounts", () => {
  it("returns empty Map when the file is missing (ENOENT)", async () => {
    const err: NodeJS.ErrnoException = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    jest.spyOn(fs.promises, "readFile").mockRejectedValue(err)
    const result = await favicons.readFaviconCounts()
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it("throws when the file cannot be accessed for a non-ENOENT reason", async () => {
    const err: NodeJS.ErrnoException = Object.assign(new Error("EACCES"), { code: "EACCES" })
    jest.spyOn(fs.promises, "readFile").mockRejectedValue(err)
    await expect(favicons.readFaviconCounts()).rejects.toThrow("EACCES")
  })

  it.each([
    [
      JSON.stringify([
        ["/static/images/external-favicons/example_com", 10],
        ["/static/images/external-favicons/test_com", 5],
      ]),
      new Map([
        ["/static/images/external-favicons/example_com", 10],
        ["/static/images/external-favicons/test_com", 5],
      ]),
      "valid JSON array",
    ],
    ["[]", new Map(), "empty JSON array"],
    [
      JSON.stringify([
        ["/static/images/external-favicons/example_com", 10],
        ["invalid", "not_a_number"],
        ["/static/images/external-favicons/test_com", 5],
      ]),
      new Map([
        ["/static/images/external-favicons/example_com", 10],
        ["/static/images/external-favicons/test_com", 5],
      ]),
      "JSON with invalid entries (skipped)",
    ],
  ])("parses %s", async (fileContent, expectedMap) => {
    jest.spyOn(fs.promises, "readFile").mockResolvedValue(fileContent)
    const result = await favicons.readFaviconCounts()
    expect(result.size).toBe(expectedMap.size)
    expectedMap.forEach((value, key) => {
      expect(result.get(key)).toBe(value)
    })
  })

  it("throws when the file is malformed (JSON parse fails)", async () => {
    jest.spyOn(fs.promises, "readFile").mockResolvedValue("not json")
    await expect(favicons.readFaviconCounts()).rejects.toThrow()
  })

  it("throws when file read fails for a non-ENOENT reason", async () => {
    jest.spyOn(fs.promises, "readFile").mockRejectedValue(new Error("read failed"))
    await expect(favicons.readFaviconCounts()).rejects.toThrow("read failed")
  })
})

describe("shouldIncludeFavicon", () => {
  it.each([
    [minFaviconCount + 1, true],
    [minFaviconCount, true],
    [minFaviconCount - 1, false],
    [0, false],
  ])("returns %s for count %s vs threshold", (count, expected) => {
    const counts = new Map<string, number>([
      ["/static/images/external-favicons/example_com", count],
    ])
    expect(
      favicons.shouldIncludeFavicon(
        "/static/images/external-favicons/example_com.svg",
        "/static/images/external-favicons/example_com.svg",
        counts,
      ),
    ).toBe(expected)
  })

  it("treats missing count as zero", () => {
    expect(
      favicons.shouldIncludeFavicon(
        "/static/images/external-favicons/example_com.svg",
        "/static/images/external-favicons/example_com.svg",
        new Map(),
      ),
    ).toBe(false)
  })

  it.each([
    [specialFaviconPaths.mail],
    [specialFaviconPaths.anchor],
    [specialFaviconPaths.turntrout],
    ["/static/images/external-favicons/apple_com.svg"],
  ])("includes allowlisted favicon %s with zero count", (imgPath) => {
    expect(favicons.shouldIncludeFavicon(imgPath, imgPath, new Map())).toBe(true)
  })

  it.each(
    faviconSubstringBlocklist.map((entry: string) => [
      `/static/images/external-favicons/${normalizeFaviconListEntry(entry)}.svg`,
    ]),
  )("excludes blocklisted favicon %s above threshold", (imgPath) => {
    const counts = new Map<string, number>([
      [favicons.normalizePathForCounting(imgPath), minFaviconCount + 10],
    ])
    expect(favicons.shouldIncludeFavicon(imgPath, imgPath, counts)).toBe(false)
  })

  it("excludes favicons with blocklisted substring anywhere in path", () => {
    const entry = normalizeFaviconListEntry(faviconSubstringBlocklist[0])
    const imgPath = `/static/images/external-favicons/subdomain_${entry}.svg`
    const counts = new Map<string, number>([
      [favicons.normalizePathForCounting(imgPath), minFaviconCount + 10],
    ])
    expect(favicons.shouldIncludeFavicon(imgPath, imgPath, counts)).toBe(false)
  })

  it("handles allowlist substring matching anywhere in path", () => {
    const imgPath = "/static/images/external-favicons/subdomain_apple_com.svg"
    const counts = new Map<string, number>([[favicons.normalizePathForCounting(imgPath), 0]])
    expect(favicons.shouldIncludeFavicon(imgPath, imgPath, counts)).toBe(true)
  })
})

describe("createFaviconElement", () => {
  it.each([
    ["/path/to/favicon.png", "Test Description"],
    ["/another/favicon.jpg", "Another Description"],
  ])("creates img element for non-SVG path %s alt=%s", (urlString, description) => {
    expect(favicons.createFaviconElement(urlString, description)).toEqual({
      type: "element",
      tagName: "img",
      children: [],
      properties: {
        src: urlString,
        class: "favicon",
        alt: description,
        loading: "lazy",
      },
    })
  })

  it.each([
    ["https://assets.turntrout.com/static/images/external-favicons/github_com.svg", "github_com"],
    ["https://assets.turntrout.com/static/images/external-favicons/openai_com.svg", "openai_com"],
  ])("creates hidden svg element for %s", (urlString, expectedDomain) => {
    const element = favicons.createFaviconElement(urlString, "")
    expect(element.tagName).toBe("svg")
    expect(element.properties.class).toBe("favicon")
    expect(element.properties["data-domain"]).toBe(expectedDomain)
    expect(element.properties.style).toBe(`--mask-url: url(${urlString});`)
    expect(element.properties["aria-hidden"]).toBe("true")
    expect(element.properties["aria-focusable"]).toBe("false")
  })

  it("creates accessible svg element when description provided", () => {
    const url = "https://assets.turntrout.com/static/images/external-favicons/turntrout_com.svg"
    const description = "A trout jumping to the left."
    const element = favicons.createFaviconElement(url, description)
    expect(element.tagName).toBe("svg")
    expect(element.properties.role).toBe("img")
    expect(element.properties["aria-label"]).toBe(description)
    expect(element.properties["aria-hidden"]).toBeUndefined()
    expect(element.properties["aria-focusable"]).toBeUndefined()
  })
})

describe("insertFavicon", () => {
  const imgPath = "/test/favicon.png"

  it.each([
    [null, 0],
    ["/valid/path.png", 1],
  ])("inserts favicon when imgPath is %s", (path, expectedChildren) => {
    const node = h("div")
    favicons.insertFavicon(path, node)
    expect(node.children.length).toBe(expectedChildren)
  })

  describe("favicon-span insertion", () => {
    it.each([
      ["Long text concord", "Long text con", "cord"],
      ["Medium", "Me", "dium"],
    ])("splices last 4 chars into favicon-span for %s", (text, remainingText, splicedChars) => {
      const node = h("div", {}, [text])
      favicons.insertFavicon(imgPath, node)

      expect(node.children.length).toBe(2)
      expect(node.children[0]).toEqual({ type: "text", value: remainingText })
      const span = node.children[1] as Element
      expect(span).toMatchObject(faviconSpanNode)
      expect(span.children[0]).toEqual({ type: "text", value: splicedChars })
      expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
    })

    it("replaces text node entirely when text is <= 4 chars", () => {
      const node = h("div", {}, ["1234"])
      favicons.insertFavicon(imgPath, node)

      expect(node.children.length).toBe(1)
      const span = node.children[0] as Element
      expect(span).toMatchObject(faviconSpanNode)
      expect(span.children[0]).toEqual({ type: "text", value: "1234" })
      expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
    })

    it.each([
      [h("div", {}, [h("div")]), "nodes without text content"],
      [h("div", {}, [""]), "empty text nodes"],
    ])("handles %s correctly", (node) => {
      favicons.insertFavicon(imgPath, node)
      const lastChild = node.children[node.children.length - 1] as Element
      expect(lastChild).toMatchObject(faviconSpanNode)
      expect(lastChild.children[1]).toMatchObject(createExpectedFavicon(imgPath))
    })

    it.each(favicons.tagsToZoomInto)(
      "zooms into %s elements and splices text into favicon-span",
      (tagName) => {
        const innerText = "tag name plan"
        const node = h("a", {}, [
          { type: "text", value: "Test " },
          h(tagName as string, {}, [innerText]),
        ])
        favicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        const tagChild = node.children[1] as Element
        expect(tagChild.children.length).toBe(2)
        const span = tagChild.children[1] as Element
        expect(span).toMatchObject(faviconSpanNode)
        expect(span.children[0]).toEqual({ type: "text", value: "plan" })
      },
    )

    it("ignores empty text nodes when finding last child", () => {
      const node = h("a", { href: "https://github.com/" }, [
        h("code", {}, ["6e687609"]),
        { type: "text", value: "" },
      ])
      favicons.insertFavicon(imgPath, node)
      const codeChild = node.children[0] as Element
      const span = codeChild.children[1] as Element
      expect(span).toMatchObject(faviconSpanNode)
    })

    it.each([
      ...favicons.charsToSpace.map((char) => [char, "close-text"] as const),
      ...favicons.charsToSpaceMost.map((char) => [char, "closer-text"] as const),
    ])("trailing %s gets the %s nudge class", (char, nudgeClass) => {
      const node = h("p", {}, [`Test${char}`])
      favicons.insertFavicon(imgPath, node)
      const span = node.children[1] as Element
      expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath, nudgeClass))
    })

    it.each([
      ["serif sets", favicons.charsToSpace, favicons.charsToSpaceMost],
      ["italic sets", favicons.charsToSpaceItalic, favicons.charsToSpaceMostItalic],
    ])("keeps the %s disjoint", (_label, close, most) => {
      const overlap = close.filter((char) => most.includes(char))
      expect(overlap).toEqual([])
    })

    it("appends to existing favicon-span instead of creating a new one", () => {
      const existingFavicon = favicons.createFaviconElement("/first/favicon.png")
      const existingSpan = h("span", { className: "favicon-span" }, ["text", existingFavicon])
      const node = h("a", {}, [existingSpan])

      const result = favicons.maybeSpliceText(node, favicons.createFaviconElement(imgPath))
      expect(result).toBeNull()
      expect(existingSpan.children).toHaveLength(3)
    })
  })

  describe("glyph context", () => {
    const ctx = (overrides: Partial<favicons.GlyphContext>): favicons.GlyphContext => ({
      ...favicons.EMPTY_GLYPH_CONTEXT,
      ...overrides,
    })

    describe("nudgeClassFor", () => {
      it.each([
        ["T", {}, "close-text"],
        ["f", {}, "closer-text"],
        ["o", {}, null],
        // Monospace bearing is handled uniformly in CSS.
        ["T", { code: true }, null],
        ["f", { code: true }, null],
        // Italic membership is ink-derived; leaning glyphs join, others leave.
        ["t", { italic: true }, "close-text"],
        ["V", { italic: true }, "closer-text"],
        ["f", { italic: true }, "closer-text"],
        ["w", { italic: true }, null],
        ["y", { italic: true }, null],
        // Small-cap lowercase forms clear the icon; capitals keep their sets.
        ["y", { smallCaps: true }, null],
        ["f", { smallCaps: true }, null],
        ["T", { smallCaps: true }, "close-text"],
        ["(", { smallCaps: true }, "close-text"],
        ["y", { smallCaps: true, italic: true }, null],
        ["R", { italic: true }, null],
      ] as const)("%s in %o gets %s", (char, overrides, expected) => {
        expect(favicons.nudgeClassFor(char, ctx(overrides))).toBe(expected)
      })
    })

    describe("broadenContext and contextFromAncestors", () => {
      it.each([
        [h("em"), { italic: true, smallCaps: false, code: false }],
        [h("i"), { italic: true, smallCaps: false, code: false }],
        [h("abbr", { className: "small-caps" }), { italic: false, smallCaps: true, code: false }],
        [h("code"), { italic: false, smallCaps: false, code: true }],
        [h("strong"), favicons.EMPTY_GLYPH_CONTEXT],
      ])("broadens over %o", (element, expected) => {
        expect(favicons.broadenContext(element, favicons.EMPTY_GLYPH_CONTEXT)).toEqual(expected)
      })

      it("folds element ancestors and skips non-elements", () => {
        const root = { type: "root", children: [] } as Parent
        const ancestors = [root, h("p"), h("em")]
        expect(favicons.contextFromAncestors(ancestors)).toEqual(ctx({ italic: true }))
      })
    })

    describe("context threading through insertFavicon", () => {
      const classOf = (node: Element): string | undefined => {
        let found: string | undefined
        visit(node, "element", (el: Element) => {
          const cls = el.properties?.class
          if (typeof cls === "string" && cls.includes("favicon") && !cls.includes("favicon-span")) {
            found = cls
          }
        })
        return found
      }

      it("descends into <em>, assigning the italic membership", () => {
        // "Incoherent" ends in "t": italic member, serif non-member.
        const node = h("a", { href: "https://example.com" }, [h("em", {}, ["Incoherent"])])
        favicons.insertFavicon(imgPath, node)
        expect(classOf(node)).toBe("favicon close-text")
      })

      it("suppresses the serif nudge after small-cap lowercase", () => {
        const node = h("a", { href: "https://example.com" }, [
          h("abbr", { className: "small-caps" }, ["proxy"]),
        ])
        favicons.insertFavicon(imgPath, node)
        expect(classOf(node)).toBe("favicon")
      })

      it("suppresses per-glyph nudges inside <code>", () => {
        const node = h("a", { href: "https://example.com" }, [h("code", {}, ["subfont -y"])])
        favicons.insertFavicon(imgPath, node)
        expect(classOf(node)).toBe("favicon")
      })

      it("applies an outer context supplied by the caller", () => {
        // The whole link sits inside <em>…</em>: the visitor derives the
        // context from ancestors and passes it in.
        const node = h("a", { href: "https://example.com" }, ["Incoherent"])
        favicons.insertFavicon(imgPath, node, ctx({ italic: true }))
        expect(classOf(node)).toBe("favicon close-text")
      })
    })
  })
})

describe("ModifyNode", () => {
  const faviconCounts = new Map<string, number>()
  const hostname = "example.com"
  const faviconPath = "/static/images/external-favicons/example_com.svg"

  beforeEach(() => {
    favicons.faviconExistsCache.clear()
    faviconCounts.clear()
  })

  it.each([
    ["./shard-theory", specialFaviconPaths.turntrout],
    ["../shard-theory", specialFaviconPaths.turntrout],
  ])("inserts turntrout favicon for relative href %s", async (href, expectedPath) => {
    favicons.faviconExistsCache.set(specialFaviconPaths.turntrout, Promise.resolve(true))
    const node = h("a", { href })
    const parent = h("div", [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    const span = node.children[0] as Element
    expect(span).toMatchObject(faviconSpanNode)
    const fav = span.children[1] as Element
    expect(fav.properties.style).toContain(expectedPath)
  })

  it.each([
    ["#test", specialFaviconPaths.anchor],
    ["mailto:test@example.com", specialFaviconPaths.mail],
    ["/rss.xml", specialFaviconPaths.rss],
    ["/some/path/rss.xml", specialFaviconPaths.rss],
  ])("inserts svg favicon for %s", async (href, expectedPath) => {
    const node = h("a", { href })
    const parent = h("div", [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    const span = node.children[0] as Element
    expect(span).toMatchObject(faviconSpanNode)
    const fav = span.children[1] as Element
    expect(fav.properties.style).toContain(expectedPath)
  })

  it.each([
    ["#user-content-fn-1", "div"],
    ["#section-1", "h2"],
  ])("skips footnote/heading anchors: %s in %s", async (href, parentTag) => {
    const node = h("a", { href })
    const parent = h(parentTag, [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(0)
  })

  it("preserves existing string className when adding same-page-link", async () => {
    const node = {
      type: "element",
      tagName: "a",
      properties: { href: "#section-1", className: "existing-class" },
      children: [],
    } as Element
    const parent = h("p", [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.properties.className).toBe("existing-class same-page-link")
  })

  it("preserves existing array className when adding same-page-link", async () => {
    const node = h("a", { href: "#section-1", className: ["existing-class"] })
    const parent = h("p", [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(Array.isArray(node.properties.className)).toBe(true)
    expect(node.properties.className).toContain("existing-class")
    expect(node.properties.className).toContain("same-page-link")
  })

  it.each([[123 as unknown as string], ["image.png"]])(
    "skips invalid/asset href %s",
    async (href) => {
      const node = h("a", { href })
      const parent = h("div", [node])
      await favicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children.length).toBe(0)
    },
  )

  it.each([
    ["array className", ["other", "no-favicon"]],
    ["string className", "other no-favicon"],
  ])("skips links opted out with a no-favicon class (%s)", async (_label, className) => {
    const node = h("a", { href: "https://example.com", className })
    const parent = h("div", [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(0)
  })

  it("skips links that already have a favicon", async () => {
    const node = h("a", { href: "https://example.com" }, [
      h("span", {}, [h("svg", { className: "favicon" })]),
    ])
    const parent = h("div", [node])
    const initialCount = node.children.length
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(initialCount)
  })

  it("skips when a sibling of the direct favicon child has no favicon descendants", async () => {
    // <a> → [<span> (no children, no favicon), <svg class="favicon">]
    // hasFavicon visits span first: hasClass=false, recursive hasFavicon=false (false branch),
    // then visits svg: hasClass=true → returns true overall. ModifyNode exits early.
    const node = h("a", { href: "https://example.com" }, [
      h("span", {}),
      h("svg", { className: "favicon" }),
    ])
    const parent = h("div", [node])
    const initialCount = node.children.length
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(initialCount)
  })

  it("skips non-element (text) children inside hasFavicon without throwing", async () => {
    // hasFavicon iterates node.children; text nodes hit the `continue` branch.
    const node = h("a", { href: "https://example.com" }, [
      "some text",
      h("svg", { className: "favicon" }),
    ])
    const parent = h("div", [node])
    const initialCount = node.children.length
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(initialCount)
  })

  it("skips when href missing or tagName non-anchor", async () => {
    const div = h("div", { href: "https://example.com" })
    await favicons.ModifyNode(div, h("section", [div]), faviconCounts)
    expect(div.children.length).toBe(0)

    const anchorNoHref = h("a")
    await favicons.ModifyNode(anchorNoHref, h("div", [anchorNoHref]), faviconCounts)
    expect(anchorNoHref.children.length).toBe(0)
  })

  it("skips link with string className containing same-page-link", async () => {
    const node = {
      type: "element",
      tagName: "a",
      properties: {
        href: "https://example.com",
        className: "some-class same-page-link other-class",
      },
      children: [],
    } as Element
    const parent = h("div", [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(0)
  })

  it("skips asset link with string className not containing same-page-link", async () => {
    const node = {
      type: "element",
      tagName: "a",
      properties: {
        href: "https://example.com/photo.jpg",
        className: "external",
      },
      children: [],
    } as Element
    const parent = h("div", [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(0)
  })

  it("skips asset link with array className not containing same-page-link", async () => {
    const node = h("a", { href: "https://example.com/photo.jpg", className: ["external"] })
    const parent = h("div", [node])
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(0)
  })

  it("handles invalid URLs silently", async () => {
    const node = h("a", { href: "http://[invalid-ipv6" })
    const parent = h("div", [node])
    faviconCounts.set("/static/images/external-favicons/[invalid-ipv6", minFaviconCount + 10)
    await favicons.ModifyNode(node, parent, faviconCounts)
    expect(node.children.length).toBe(0)
  })

  describe("count threshold", () => {
    it("skips external link with count below threshold", async () => {
      faviconCounts.set(favicons.normalizePathForCounting(faviconPath), minFaviconCount - 1)
      const node = h("a", { href: `https://${hostname}/page` })
      const parent = h("div", [node])
      await favicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children.length).toBe(0)
    })

    it("inserts favicon at exact threshold when SVG exists", async () => {
      faviconCounts.set(favicons.normalizePathForCounting(faviconPath), minFaviconCount)
      favicons.faviconExistsCache.set(faviconPath, Promise.resolve(true))
      const node = h("a", { href: `https://${hostname}/page` })
      const parent = h("div", [node])
      await favicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children.length).toBeGreaterThan(0)
    })

    it("inserts allowlisted favicon below threshold", async () => {
      const turntroutHost = "turntrout.com"
      faviconCounts.set(specialFaviconPaths.turntrout, minFaviconCount - 1)
      favicons.faviconExistsCache.set(specialFaviconPaths.turntrout, Promise.resolve(true))
      const node = h("a", { href: `https://${turntroutHost}/page` })
      const parent = h("div", [node])
      await favicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children.length).toBeGreaterThan(0)
    })

    it("inserts no favicon when threshold met but SVG missing", async () => {
      faviconCounts.set(favicons.normalizePathForCounting(faviconPath), minFaviconCount + 10)
      mockCdnLookup(false)
      const node = h("a", { href: `https://${hostname}/page` })
      const parent = h("div", [node])
      await expect(favicons.ModifyNode(node, parent, faviconCounts)).resolves.toBeUndefined()
      expect(node.children.length).toBe(0)
    })

    it("inserts no favicon when allowlisted favicon has no SVG", async () => {
      const appleHost = "apple.com"
      // No counts entry; apple_com is allowlisted so should still try to include.
      mockCdnLookup(false)
      const node = h("a", { href: `https://${appleHost}/page` })
      const parent = h("div", [node])
      await expect(favicons.ModifyNode(node, parent, faviconCounts)).resolves.toBeUndefined()
      expect(node.children.length).toBe(0)
    })

    it("does not throw for blocklisted hostnames even with very high count", async () => {
      const blocklistedHost = "incompleteideas.net"
      const path = favicons.getQuartzPath(blocklistedHost)
      faviconCounts.set(favicons.normalizePathForCounting(path), minFaviconCount + 100)
      const node = h("a", { href: `https://${blocklistedHost}/page` })
      const parent = h("div", [node])
      await expect(favicons.ModifyNode(node, parent, faviconCounts)).resolves.toBeUndefined()
      expect(node.children.length).toBe(0)
    })
  })
})

describe("AddFavicons plugin", () => {
  const mockCtx = { argv: { offline: false } } as unknown as import("../../util/ctx").BuildCtx

  beforeEach(() => {
    jest.spyOn(fs.promises, "access").mockResolvedValue()
    jest.spyOn(fs.promises, "readFile").mockResolvedValue(
      JSON.stringify([
        [specialFaviconPaths.mail, minFaviconCount + 1],
        [specialFaviconPaths.anchor, minFaviconCount + 1],
      ]),
    )
  })

  it("returns [] when offline mode is enabled", () => {
    const plugin = favicons.AddFavicons()
    const offlineCtx = {
      argv: { offline: true },
    } as unknown as import("../../util/ctx").BuildCtx
    expect(plugin.htmlPlugins(offlineCtx)).toEqual([])
  })

  it("defaults offline to false when ctx.argv.offline is undefined", () => {
    const plugin = favicons.AddFavicons()
    const ctxNoOffline = { argv: {} } as unknown as import("../../util/ctx").BuildCtx
    expect(plugin.htmlPlugins(ctxNoOffline).length).toBeGreaterThan(0)
  })

  it("processes HTML tree and adds favicons to mailto/anchor links", async () => {
    const plugin = favicons.AddFavicons()
    const transform = plugin.htmlPlugins(mockCtx)[0]()

    const tree = {
      type: "root",
      children: [
        h("div", [h("a", { href: "mailto:test@example.com" }), h("a", { href: "#section" })]),
      ],
    }

    await transform(tree as unknown as import("hast").Root)

    const divEl = tree.children[0] as Element
    const mailLink = divEl.children[0] as Element
    const sectionLink = divEl.children[1] as Element

    const mailSpan = mailLink.children[0] as Element
    expect(mailSpan).toMatchObject(faviconSpanNode)
    expect((mailSpan.children[1] as Element).properties.style).toContain(specialFaviconPaths.mail)

    const anchorSpan = sectionLink.children[0] as Element
    expect(anchorSpan).toMatchObject(faviconSpanNode)
    expect((anchorSpan.children[1] as Element).properties.style).toContain(
      specialFaviconPaths.anchor,
    )
  })

  it("handles trees with no link nodes", async () => {
    const plugin = favicons.AddFavicons()
    const transform = plugin.htmlPlugins(mockCtx)[0]()
    const tree = { type: "root", children: [h("div", [h("span"), h("a")])] }
    await transform(tree as unknown as import("hast").Root)
    const divEl = tree.children[0] as Element
    expect((divEl.children[0] as Element).children.length).toBe(0)
    expect((divEl.children[1] as Element).children.length).toBe(0)
  })
})

describe("isHeading", () => {
  it.each([
    ["h1", true],
    ["h2", true],
    ["h3", true],
    ["h4", true],
    ["h5", true],
    ["h6", true],
    ["p", false],
    ["div", false],
    ["span", false],
  ])("identifies %s as heading=%s", (tagName, expected) => {
    expect(favicons.isHeading({ tagName } as Element)).toBe(expected)
  })

  it("handles undefined tagName", () => {
    expect(favicons.isHeading({} as Element)).toBe(false)
  })
})

describe("isAssetLink", () => {
  it.each([
    ["https://example.com/page", false],
    ["https://example.com/file.unknown", false],
    ["https://example.com/page.", false],
    ["https://example", false],
    ["https://example.com/document.pdf", false],
    ["https://example.com/page.html", false],
    ["https://github.com/repo/blob/main/file.ts", false],
    ["https://github.com/repo/blob/main/file.tsx", false],
    ["https://example.com/image.png", true],
    ["https://example.com/image.svg", true],
    ["https://example.com/image.avif", true],
    ["https://example.com/video.mp4", true],
    ["https://example.com/audio.mp3", true],
    ["https://example.com/image.png?size=large", true],
    ["https://example.com/image.png#section", true],
    ["./image.png", true],
    ["../video.mp4", true],
    ["audio.mp3", true],
  ])("returns %s for %s", (href, expected) => {
    expect(favicons.isAssetLink(href)).toBe(expected)
  })
})

describe("normalizeUrl", () => {
  it.each([
    ["https://example.com/page", "https://example.com/page"],
    ["./shard-theory", "https://www.turntrout.com/shard-theory"],
    ["../shard-theory", "https://www.turntrout.com/shard-theory"],
    ["relative/path", "https://www.turntrout.com/relative/path"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(favicons.normalizeUrl(input)).toBe(expected)
  })
})

describe("normalizeFaviconListEntry", () => {
  it.each([
    ["playpen_icomtek_csir_co_za", "csir_co_za"],
    ["incompleteideas_net", "incompleteideas_net"],
    ["blog_example_com", "example_com"],
    ["developer_mozilla_org", "mozilla_org"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeFaviconListEntry(input)).toBe(expected)
  })
})

describe("maybeSpliceText edge cases", () => {
  const imgPath = "/test/favicon.png"

  it("handles whitespace-only text", () => {
    const node = h("a", {}, ["   "])
    const result = favicons.maybeSpliceText(node, favicons.createFaviconElement(imgPath))
    expect(result).toMatchObject(faviconSpanNode)
  })

  it("zooms into abbr inside link (RSS structure)", () => {
    const node = h("a", {}, [h("abbr", { class: "small-caps" }, ["rss"])])
    favicons.insertFavicon(imgPath, node)
    const abbr = node.children[0] as Element
    const span = abbr.children[0] as Element
    expect(span).toMatchObject(faviconSpanNode)
    expect(span.children[0]).toEqual({ type: "text", value: "rss" })
  })

  it("handles nested tagsToZoomInto", () => {
    const node = h("a", {}, [
      { type: "text", value: "Outer " },
      h("em", {}, [{ type: "text", value: "text " }]),
      h("strong", {}, ["nested plan"]),
    ])
    favicons.insertFavicon(imgPath, node)
    const strong = node.children[2] as Element
    expect(strong.children.length).toBe(2)
    const span = strong.children[1] as Element
    expect(span).toMatchObject(faviconSpanNode)
    expect(span.children[0]).toEqual({ type: "text", value: "plan" })
  })
})

describe("favicon must be inside favicon-span", () => {
  const imgPath = "/test/favicon.png"

  const findFaviconSpan = (el: Element): Element | null => {
    for (const child of el.children) {
      if (child.type !== "element") continue
      const elem = child as Element
      if (hasClass(elem, "favicon-span")) return elem
      const found = findFaviconSpan(elem)
      if (found) return found
    }
    return null
  }

  it.each([
    ["simple text", h("a", {}, ["Click here"])],
    ["nested code element", h("a", {}, [h("code", {}, ["linkchecker"])])],
    ["empty node", h("a", {}, [])],
    ["non-text child div", h("a", {}, [h("div")])],
  ])("wraps favicon inside favicon-span: %s", (_name, node) => {
    const result = favicons.maybeSpliceText(node as Element, favicons.createFaviconElement(imgPath))
    if (result) {
      ;(node as Element).children.push(result)
    }
    const span = findFaviconSpan(node as Element)
    if (!span) throw new Error("favicon-span not found")
    const directNakedFavicon = (node as Element).children.find(
      (child) =>
        child.type === "element" &&
        (child as Element).tagName !== "span" &&
        hasClass(child as Element, "favicon"),
    )
    expect(directNakedFavicon).toBeUndefined()
  })
})

describe("isFootnoteRefSup", () => {
  const footnoteAnchor = (props: Properties) => h("sup", {}, [h("a", props, ["1"])])

  it.each([
    ["data-footnote-ref attribute", footnoteAnchor({ dataFootnoteRef: true }), true],
    [
      "user-content-fnref id",
      footnoteAnchor({ id: "user-content-fnref-1", href: "#user-content-fn-1" }),
      true,
    ],
    ["plain sup without footnote anchor", h("sup", {}, ["2"]), false],
    ["sup wrapping a non-footnote link", footnoteAnchor({ href: "#other", id: "other-1" }), false],
    ["non-sup element", h("span", {}, [h("a", { dataFootnoteRef: true }, ["1"])]), false],
  ])("detects %s", (_name, node, expected) => {
    expect(favicons.isFootnoteRefSup(node as Element)).toBe(expected)
  })

  it.each([
    ["undefined", undefined],
    ["a bare text node", { type: "text", value: "hi" } as import("hast").Text],
  ])("returns false for %s", (_name, node) => {
    expect(favicons.isFootnoteRefSup(node)).toBe(false)
  })
})

describe("endsWithFavicon", () => {
  const favicon = () => h("img", { className: "favicon" })
  const faviconSpan = () => h("span", { className: "favicon-span" }, ["ext", favicon()])

  it.each([
    ["a bare trailing favicon", h("a", {}, ["link", favicon()]), true],
    ["a trailing favicon-span", h("a", {}, ["li", faviconSpan()]), true],
    ["a nested favicon inside code", h("a", {}, [h("code", {}, ["fn", favicon()])]), true],
    ["trailing whitespace after the favicon", h("a", {}, ["li", faviconSpan(), "   "]), true],
    ["a link with no favicon", h("a", {}, ["just text"]), false],
    ["a favicon that is not the last child", h("a", {}, [favicon(), "trailing text"]), false],
    ["an empty element", h("a", {}, []), false],
  ])("returns %s", (_name, node, expected) => {
    expect(favicons.endsWithFavicon(node as Element)).toBe(expected)
  })
})

describe("glueFootnoteRefsToFavicons", () => {
  const favicon = () => h("img", { className: "favicon" })
  const faviconLink = () =>
    h("a", { href: "https://example.com" }, [
      "si",
      h("span", { className: "favicon-span" }, ["te", favicon()]),
    ])
  const footnoteRef = (n: number) =>
    h("sup", {}, [
      h(
        "a",
        { dataFootnoteRef: true, id: `user-content-fnref-${n}`, href: `#user-content-fn-${n}` },
        [String(n)],
      ),
    ])
  const asRoot = (...children: (Element | string)[]) =>
    ({ type: "root", children: [h("p", {}, children)] }) as unknown as import("hast").Root

  const isGlueSpan = (node: Element | undefined): boolean =>
    node?.type === "element" &&
    node.tagName === "span" &&
    node.properties?.className === "favicon-footnote-span"

  it("wraps a favicon-ending link and a following footnote ref in a nowrap span", () => {
    const tree = asRoot(faviconLink(), footnoteRef(1))
    favicons.glueFootnoteRefsToFavicons(tree)
    const paragraphChildren = (tree.children[0] as Element).children
    expect(paragraphChildren).toHaveLength(1)
    const span = paragraphChildren[0] as Element
    expect(isGlueSpan(span)).toBe(true)
    expect(span.children).toHaveLength(2)
    expect((span.children[0] as Element).tagName).toBe("a")
    expect((span.children[1] as Element).tagName).toBe("sup")
  })

  it("does not wrap when the preceding link has no favicon", () => {
    const tree = asRoot(h("a", { href: "https://example.com" }, ["plain"]), footnoteRef(1))
    favicons.glueFootnoteRefsToFavicons(tree)
    const paragraphChildren = (tree.children[0] as Element).children
    expect(paragraphChildren).toHaveLength(2)
    expect(paragraphChildren.some((child) => isGlueSpan(child as Element))).toBe(false)
  })

  it("does not wrap when the following sup is not a footnote reference", () => {
    const tree = asRoot(faviconLink(), h("sup", {}, ["th"]))
    favicons.glueFootnoteRefsToFavicons(tree)
    const paragraphChildren = (tree.children[0] as Element).children
    expect(paragraphChildren).toHaveLength(2)
    expect(paragraphChildren.some((child) => isGlueSpan(child as Element))).toBe(false)
  })

  it("does not wrap a footnote ref that opens a paragraph", () => {
    const tree = {
      type: "root",
      children: [h("p", {}, [footnoteRef(1)])],
    } as unknown as import("hast").Root
    favicons.glueFootnoteRefsToFavicons(tree)
    const paragraphChildren = (tree.children[0] as Element).children
    expect(paragraphChildren).toHaveLength(1)
    expect(isGlueSpan(paragraphChildren[0] as Element)).toBe(false)
  })

  it("wraps each of several favicon/footnote pairs in one parent", () => {
    const tree = asRoot(faviconLink(), footnoteRef(1), " and ", faviconLink(), footnoteRef(2))
    favicons.glueFootnoteRefsToFavicons(tree)
    const paragraphChildren = (tree.children[0] as Element).children
    // Two glue spans separated by the " and " text node.
    const spanChildCounts = paragraphChildren
      .filter((child) => isGlueSpan(child as Element))
      .map((span) => (span as Element).children.length)
    expect(spanChildCounts).toEqual([2, 2])
    // Each glue span ends with a footnote sup.
    const endsWithSup = paragraphChildren
      .filter((child) => isGlueSpan(child as Element))
      .map((span) => favicons.isFootnoteRefSup((span as Element).children.at(-1) as Element))
    expect(endsWithSup).toEqual([true, true])
  })

  it("wraps across an empty text node left by whitespace stripping", () => {
    const tree = asRoot(faviconLink(), "", footnoteRef(1))
    favicons.glueFootnoteRefsToFavicons(tree)
    const paragraphChildren = (tree.children[0] as Element).children
    expect(paragraphChildren).toHaveLength(1)
    const span = paragraphChildren[0] as Element
    expect(isGlueSpan(span)).toBe(true)
    // The empty text node is carried inside the span between the link and the sup.
    expect((span.children[0] as Element).tagName).toBe("a")
    expect(favicons.isFootnoteRefSup(span.children.at(-1) as Element)).toBe(true)
  })

  it("does not wrap when only empty text nodes precede a paragraph-opening ref", () => {
    const tree = asRoot("", footnoteRef(1))
    favicons.glueFootnoteRefsToFavicons(tree)
    const paragraphChildren = (tree.children[0] as Element).children
    expect(paragraphChildren.some((child) => isGlueSpan(child as Element))).toBe(false)
  })
})
