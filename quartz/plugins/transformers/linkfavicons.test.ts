/**
 * @jest-environment node
 */
import type { Element } from "hast"

import { jest, expect, it, describe, beforeAll, beforeEach, afterEach } from "@jest/globals"
// skipcq: JS-W1028 -- this is a test file
import fsExtra from "fs-extra"
import { h } from "hastscript"
import os from "os"
import path from "path"
import { PassThrough } from "stream"

// skipcq: JS-C1003
import * as linkfavicons from "./linkfavicons"
import { FAVICON_SUBSTRING_BLACKLIST } from "./linkfavicons"

jest.mock("fs")
import fs from "fs"

jest.mock("stream/promises")

beforeAll(() => {
  jest
    .spyOn(fs, "createWriteStream")
    .mockReturnValue(new PassThrough() as unknown as fs.WriteStream)
})

let tempDir: string
beforeEach(async () => {
  // skipcq: JS-P1003
  tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "linkfavicons-test-"))
  jest.resetAllMocks()
  jest.restoreAllMocks()
  linkfavicons.urlCache.clear()
})

afterEach(async () => {
  // skipcq: JS-P1003
  await fsExtra.remove(tempDir)
})

jest.mock("./linkfavicons", () => {
  const actual = jest.requireActual("./linkfavicons")
  return {
    ...(actual as unknown as Record<string, unknown>),
    urlCache: new Map(),
  }
})

const createExpectedSpan = (
  text: string,
  imgPath: string,
  extraMarginLeft?: boolean,
): Record<string, unknown> => {
  const faviconElement = linkfavicons.createFaviconElement(imgPath)
  faviconElement.properties.class = `favicon${extraMarginLeft ? " close-text" : ""}`

  return {
    type: "element",
    tagName: "span",
    properties: {
      className: "favicon-span",
    },
    children: [{ type: "text", value: text }, faviconElement],
  } as unknown as Record<string, unknown>
}

describe("Favicon Utilities", () => {
  describe("MaybeSaveFavicon", () => {
    const hostname = "example.com"
    const avifUrl = "https://assets.turntrout.com/static/images/external-favicons/example_com.avif"

    const mockFetchAndFs = (avifStatus: number, localPngExists: boolean, googleStatus = 200) => {
      let responseBodyAVIF = ""
      if (avifStatus === 200) {
        responseBodyAVIF = "Mock image content"
      }
      const AVIFResponse = new Response(responseBodyAVIF, {
        status: avifStatus,
        headers: { "Content-Type": "image/avif" },
      })

      let responseBodyGoogle = ""
      if (googleStatus === 200) {
        responseBodyGoogle = "Mock image content"
      }
      const googleResponse = new Response(responseBodyGoogle, {
        status: googleStatus,
        headers: { "Content-Type": "image/png" },
      })

      jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(AVIFResponse)
        .mockResolvedValueOnce(googleResponse)

      jest.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined)

      jest
        .spyOn(fs.promises, "stat")
        .mockImplementationOnce(() =>
          localPngExists
            ? Promise.resolve({ size: 1000 } as fs.Stats)
            : Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
        )
        .mockImplementationOnce(() => Promise.resolve({ size: 1000 } as fs.Stats))
    }

    it.each<[string, number, boolean, string | null, number?]>([
      ["AVIF exists", 200, false, avifUrl],
    ])("%s", async (_, avifStatus, localPngExists, expected, googleStatus = 200) => {
      mockFetchAndFs(avifStatus, localPngExists, googleStatus)
      expect(await linkfavicons.MaybeSaveFavicon(hostname)).toBe(expected)
    })

    it("should return DEFAULT_PATH when all attempts fail", async () => {
      mockFetchAndFs(404, false, 404)
      const result = await linkfavicons.MaybeSaveFavicon(hostname)
      expect(result).toBe(linkfavicons.DEFAULT_PATH)
      expect(global.fetch).toHaveBeenCalledTimes(2) // AVIF and Google attempts
    })

    it.each<[string, number, boolean]>([
      ["Local PNG exists", 404, true],
      ["Download PNG from Google", 404, false],
    ])("%s", async (_, avifStatus, localPngExists) => {
      const expected = linkfavicons.getQuartzPath(hostname)
      mockFetchAndFs(avifStatus, localPngExists)
      expect(await linkfavicons.MaybeSaveFavicon(hostname)).toBe(expected)
    })

    it("should not write local files to URL cache", async () => {
      const localPath = linkfavicons.getQuartzPath(hostname)

      jest.spyOn(global, "fetch").mockRejectedValue(new Error("CDN not available"))

      // Mock fs.promises.stat to succeed for local file
      jest.spyOn(fs.promises, "stat").mockResolvedValue({} as fs.Stats)

      linkfavicons.urlCache.clear()

      const result = await linkfavicons.MaybeSaveFavicon(hostname)

      expect(result).toBe(localPath)
      expect(linkfavicons.urlCache.size).toBe(0)

      // Check that the URL cache doesn't contain the local path
      expect(linkfavicons.urlCache.has(localPath)).toBe(false)
    })

    it("should cache and skip previously failed downloads", async () => {
      // Mock all download attempts to fail
      mockFetchAndFs(404, false, 404)

      // First attempt should try all download methods
      const firstResult = await linkfavicons.MaybeSaveFavicon(hostname)
      expect(firstResult).toBe(linkfavicons.DEFAULT_PATH)
      expect(global.fetch).toHaveBeenCalledTimes(2) // AVIF and Google attempts

      // Reset mocks for second attempt
      jest.clearAllMocks()
      mockFetchAndFs(404, false, 404)

      // Second attempt should skip immediately due to cached failure
      const secondResult = await linkfavicons.MaybeSaveFavicon(hostname)
      expect(secondResult).toBe(linkfavicons.DEFAULT_PATH)
      expect(global.fetch).not.toHaveBeenCalled() // Should not try to download again
    })

    it("should persist failed downloads to cache file", async () => {
      // Mock all download attempts to fail
      mockFetchAndFs(404, false, 404)

      // Mock writeFileSync
      const writeFileSyncMock = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      await linkfavicons.MaybeSaveFavicon(hostname)

      // Call writeCacheToFile directly since it's what actually writes to the file
      linkfavicons.writeCacheToFile()

      // Verify the failure was written to cache file
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        linkfavicons.FAVICON_URLS_FILE,
        expect.stringContaining(
          `${linkfavicons.getQuartzPath(hostname)},${linkfavicons.DEFAULT_PATH}`,
        ),
        expect.any(Object),
      )
    })

    it("should load and respect cached failures on startup", async () => {
      // Mock reading a cached failure from file
      const faviconPath = linkfavicons.getQuartzPath(hostname)

      // Set up the cache directly
      linkfavicons.urlCache.clear()
      linkfavicons.urlCache.set(faviconPath, linkfavicons.DEFAULT_PATH)

      // Mock download attempts (which shouldn't be called)
      mockFetchAndFs(200, false, 200)

      // Attempt to get favicon
      const result = await linkfavicons.MaybeSaveFavicon(hostname)

      // Should return default path without attempting downloads
      expect(result).toBe(linkfavicons.DEFAULT_PATH)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("should return cached successful favicon URL", async () => {
      const faviconPath = linkfavicons.getQuartzPath(hostname)
      const cachedUrl = "https://assets.turntrout.com/favicon.png"

      linkfavicons.urlCache.clear()
      linkfavicons.urlCache.set(faviconPath, cachedUrl)

      // Mock download attempts (which shouldn't be called)
      mockFetchAndFs(200, false, 200)

      const result = await linkfavicons.MaybeSaveFavicon(hostname)

      expect(result).toBe(cachedUrl)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe("GetQuartzPath", () => {
    it.each([
      ["www.example.com", "/static/images/external-favicons/example_com.png"],
      ["localhost", linkfavicons.TURNTROUT_FAVICON_PATH],
      ["turntrout.com", linkfavicons.TURNTROUT_FAVICON_PATH],
      ["https://turntrout.com", linkfavicons.TURNTROUT_FAVICON_PATH],
      ["subdomain.example.org", "/static/images/external-favicons/subdomain_example_org.png"],
    ])("should return the correct favicon path for %s", (hostname, expectedPath) => {
      expect(linkfavicons.getQuartzPath(hostname)).toBe(expectedPath)
    })
  })

  describe("getFaviconUrl", () => {
    it.each([
      [
        "/static/images/external-favicons/example_com.png",
        "https://assets.turntrout.com/static/images/external-favicons/example_com.avif",
      ],
      [
        "/static/images/external-favicons/test_com.png",
        "https://assets.turntrout.com/static/images/external-favicons/test_com.avif",
      ],
      [linkfavicons.TURNTROUT_FAVICON_PATH, linkfavicons.TURNTROUT_FAVICON_PATH],
      [linkfavicons.MAIL_PATH, linkfavicons.MAIL_PATH],
      ["https://example.com/favicon.ico", "https://example.com/favicon.ico"],
    ])("should construct URL from path %s", (path, expectedUrl) => {
      expect(linkfavicons.getFaviconUrl(path)).toBe(expectedUrl)
    })
  })

  describe("shouldIncludeFavicon", () => {
    it.each([
      [linkfavicons.MIN_FAVICON_COUNT + 1, true, "exceeds threshold"],
      [linkfavicons.MIN_FAVICON_COUNT, true, "equals threshold"],
      [linkfavicons.MIN_FAVICON_COUNT - 1, false, "below threshold"],
      [0, false, "zero count"],
    ])("should return %s when count %s", (count, expected) => {
      const faviconCounts = new Map<string, number>()
      faviconCounts.set("/static/images/external-favicons/example_com.png", count)

      const result = linkfavicons.shouldIncludeFavicon(
        "/favicon.png",
        "/static/images/external-favicons/example_com.png",
        faviconCounts,
      )

      expect(result).toBe(expected)
    })

    it("should treat missing count as zero", () => {
      const faviconCounts = new Map<string, number>()

      const result = linkfavicons.shouldIncludeFavicon(
        "/favicon.png",
        "/static/images/external-favicons/example_com.png",
        faviconCounts,
      )

      expect(result).toBe(false)
    })

    it.each([
      [linkfavicons.MAIL_PATH],
      [linkfavicons.ANCHOR_PATH],
      [linkfavicons.TURNTROUT_FAVICON_PATH],
      ["/static/images/external-favicons/apple_com.png"],
    ])("should include whitelisted favicon %s even if count is zero", (imgPath) => {
      const faviconCounts = new Map<string, number>()
      faviconCounts.set(imgPath, 0)

      const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

      expect(result).toBe(true)
    })

    describe("favicon blacklist", () => {
      it.each(
        FAVICON_SUBSTRING_BLACKLIST.map((blacklistEntry) => [
          `/static/images/external-favicons/${blacklistEntry}.png`,
        ]),
      )("should exclude blacklisted favicon %s even if count exceeds threshold", (imgPath) => {
        const faviconCounts = new Map<string, number>()
        faviconCounts.set(imgPath, linkfavicons.MIN_FAVICON_COUNT + 10)

        const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

        expect(result).toBe(false)
      })

      it("should exclude favicons with blacklisted substring in middle of path", () => {
        const blacklistEntry = FAVICON_SUBSTRING_BLACKLIST[0]
        const imgPath = `/static/images/external-favicons/subdomain_${blacklistEntry}.png`
        const faviconCounts = new Map<string, number>()
        faviconCounts.set(imgPath, linkfavicons.MIN_FAVICON_COUNT + 10)

        const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

        expect(result).toBe(false)
      })
    })
  })

  describe("linkfavicons.CreateFaviconElement", () => {
    it.each([
      ["/path/to/favicon.png", "Test Description"],
      ["/another/favicon.jpg", "Another Description"],
    ])("should create a favicon element with src=%s and alt=%s", (urlString, description) => {
      const element = linkfavicons.createFaviconElement(urlString, description)
      expect(element).toEqual({
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
  })

  describe("linkfavicons.insertFavicon", () => {
    it.each([
      [null, 0],
      ["/valid/path.png", 1],
    ])("should insert favicon correctly when imgPath is %s", (imgPath, expectedChildren) => {
      const node = h("div")
      linkfavicons.insertFavicon(imgPath, node)
      expect(node.children.length).toBe(expectedChildren)
    })

    describe("span creation", () => {
      const imgPath = "/test/favicon.png"

      it.each([
        ["Long text content", 2],
        ["Medium", 2],
      ])("should create a span correctly for %s", (text, expectedChildren) => {
        const node = h("div", {}, [text])
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(expectedChildren)
        const firstSegment = text.slice(0, -linkfavicons.maxCharsToRead)
        expect(node.children[0]).toEqual({ type: "text", value: firstSegment })
        const lastSegment = text.slice(-linkfavicons.maxCharsToRead)
        expect(node.children[1]).toMatchObject(createExpectedSpan(lastSegment, imgPath))
      })

      it("should create a span correctly for short text", () => {
        const text = "1234"
        const node = h("div", {}, [text])
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(1)
        expect(node.children[0]).toMatchObject(createExpectedSpan(text, imgPath))
      })

      it.each([
        [h("div", {}, [h("div")]), "nodes without text content"],
        [h("div", {}, [""]), "empty text nodes"],
      ])("should handle %s correctly", (node) => {
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        expect(node.children[1]).toEqual(linkfavicons.createFaviconElement(imgPath))
      })

      /* 
       <a>Test <code>tag name test</code></a>
       becomes 
       <a>Test <code>tag name <span>test</span></code></a>
      */
      it.each(linkfavicons.tagsToZoomInto)("should create span for %s elements", (tagName) => {
        const innerText = "tag name test"
        const node = h("a", {}, [{ type: "text", value: "Test " }, h(tagName, {}, [innerText])])
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        expect(node.children[0]).toEqual({ type: "text", value: "Test " })

        const firstSegment = innerText.slice(0, -linkfavicons.maxCharsToRead)
        const lastSegment = innerText.slice(-linkfavicons.maxCharsToRead)

        const expectedTagNode = h(tagName, {}, [
          { type: "text", value: firstSegment },
          createExpectedSpan(lastSegment, imgPath) as unknown as Element,
        ])

        expect(node.children[1]).toMatchObject(
          expectedTagNode as unknown as Record<string, unknown>,
        )
      })

      const codeContent = "6e687609"
      const complicatedHTMLCode = h("a", { href: "https://github.com/" }, [
        h("code", {}, [codeContent]),
      ])

      it("should handle complicated HTML code", () => {
        linkfavicons.insertFavicon(imgPath, complicatedHTMLCode)

        expect(complicatedHTMLCode.children.length).toBe(1)

        const codeChild = complicatedHTMLCode.children[0] as Element
        const firstSegment = codeContent.slice(0, -linkfavicons.maxCharsToRead)
        const lastSegment = codeContent.slice(-linkfavicons.maxCharsToRead)
        const expectedCodeChild = h("code", {}, [
          { type: "text", value: firstSegment },
          createExpectedSpan(lastSegment, imgPath) as unknown as Element,
        ])
        expect(codeChild).toMatchObject(expectedCodeChild as unknown as Record<string, unknown>)
      })

      it("should ignore empty text nodes when finding last child to splice", () => {
        const linkWithEmptyText = h("a", { href: "https://github.com/" }, [
          h("code", {}, [codeContent]),
          { type: "text", value: "" }, // Empty text node at the end
        ])

        linkfavicons.insertFavicon(imgPath, linkWithEmptyText)

        expect(linkWithEmptyText.children.length).toBe(2) // Original code element + empty text
        const codeChild = linkWithEmptyText.children[0] as Element
        const firstSegment = codeContent.slice(0, -linkfavicons.maxCharsToRead)
        const lastSegment = codeContent.slice(-linkfavicons.maxCharsToRead)
        const expectedCodeChild = h("code", {}, [
          { type: "text", value: firstSegment },
          createExpectedSpan(lastSegment, imgPath) as unknown as Element,
        ])
        expect(codeChild).toMatchObject(expectedCodeChild as unknown as Record<string, unknown>)
      })

      it.each(linkfavicons.charsToSpace)(
        "should handle special character %s with proper spacing",
        (char) => {
          const text = `Test${char}`
          const node = h("p", {}, [text])
          linkfavicons.insertFavicon(imgPath, node)

          expect(node.children.length).toBe(2)
          const firstSegment = text.slice(0, -linkfavicons.maxCharsToRead)
          expect(node.children[0]).toEqual({ type: "text", value: firstSegment })

          const lastSegment = text.slice(-linkfavicons.maxCharsToRead)
          expect(node.children[1]).toMatchObject(createExpectedSpan(lastSegment, imgPath, true))
        },
      )

      it("should not replace children with span if more than one child", () => {
        const node = h("p", [
          "My email is ",
          h("a", { href: "https://mailto:throwaway@turntrout.com", class: "external" }, [
            h("code", ["throwaway@turntrout.com"]),
          ]),
          ".",
        ])

        linkfavicons.insertFavicon(linkfavicons.MAIL_PATH, node)

        expect(node.children.length).toBe(3)
        const lastChild = node.children[node.children.length - 1]
        expect(lastChild).toMatchObject(createExpectedSpan(".", linkfavicons.MAIL_PATH))
      })
    })
  })

  describe("shouldSkipFavicon behavior through ModifyNode", () => {
    it("should skip links with string className containing 'same-page-link'", async () => {
      // Create node manually to ensure string className (tests line 438)
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
      const faviconCounts = new Map<string, number>()

      await linkfavicons.ModifyNode(node, parent, faviconCounts)
      // Should not add any favicon since it has same-page-link class
      expect(node.children.length).toBe(0)
    })
  })

  describe("linkfavicons.ModifyNode", () => {
    const faviconCounts = new Map<string, number>()

    beforeEach(() => {
      faviconCounts.clear()
      // Set up counts for common favicons
      faviconCounts.set(linkfavicons.TURNTROUT_FAVICON_PATH, linkfavicons.MIN_FAVICON_COUNT + 1)
      faviconCounts.set(linkfavicons.MAIL_PATH, linkfavicons.MIN_FAVICON_COUNT + 1)
      faviconCounts.set(linkfavicons.ANCHOR_PATH, linkfavicons.MIN_FAVICON_COUNT + 1)
    })

    it.each([
      ["./shard-theory", linkfavicons.TURNTROUT_FAVICON_PATH],
      ["../shard-theory", linkfavicons.TURNTROUT_FAVICON_PATH],
      ["#test", linkfavicons.ANCHOR_PATH],
      ["mailto:test@example.com", linkfavicons.MAIL_PATH],
      ["mailto:another@domain.org", linkfavicons.MAIL_PATH],
    ])("should insert favicon for %s", async (href, expectedPath) => {
      const node = h("a", { href })
      const parent = h("div", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children[0]).toHaveProperty("properties.src", expectedPath)
    })

    it.each([
      ["#user-content-fn-1", "div", "footnote links"],
      ["#section-1", "h2", "links inside headings"],
    ])("should skip %s", async (href, parentTag) => {
      const node = h("a", { href })
      const parent = h(parentTag, [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children.length).toBe(0)
    })

    it("should add same-page-link class and anchor icon for internal links", async () => {
      const node = h("a", { href: "#section-1" })
      const parent = h("p", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)

      expect(node.properties.className).toContain("same-page-link")
      expect(node.children.length).toBe(1)
      expect(node.children[0]).toHaveProperty("properties.src", linkfavicons.ANCHOR_PATH)
    })

    it("should handle existing className array for internal links", async () => {
      const node = h("a", { href: "#section-1", className: ["existing-class"] })
      const parent = h("p", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)

      expect(Array.isArray(node.properties.className)).toBe(true)
      expect(node.properties.className).toContain("existing-class")
      expect(node.properties.className).toContain("same-page-link")
    })

    it("should handle existing className string for internal links", async () => {
      // Create node manually to ensure string className remains string (h() converts to array)
      const node = {
        type: "element",
        tagName: "a",
        properties: { href: "#section-1", className: "existing-class" },
        children: [],
      } as Element
      const parent = h("p", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)

      expect(typeof node.properties.className).toBe("string")
      expect(node.properties.className).toBe("existing-class same-page-link")
    })

    it("should handle internal links with no existing className", async () => {
      // Create node manually to test the undefined className case
      const node = {
        type: "element",
        tagName: "a",
        properties: { href: "#section-1" },
        children: [],
      } as Element
      const parent = h("p", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)

      expect(Array.isArray(node.properties.className)).toBe(true)
      expect(node.properties.className).toEqual(["same-page-link"])
    })

    it.each([[123 as unknown as string], ["image.png"]])(
      "should skip when href is %s",
      async (href) => {
        const node = h("a", { href })
        const parent = h("div", [node])

        await linkfavicons.ModifyNode(node, parent, faviconCounts)
        expect(node.children.length).toBe(0)
      },
    )

    it.each([
      ["external-link.html", "a", { className: "some-class same-page-link other-class" }],
      [undefined, "div", {}],
      [undefined, "a", {}],
    ])("should skip when href=%s tagName=%s", async (href, tagName, extraProps) => {
      const properties = href ? { href, ...extraProps } : extraProps
      const node = h(tagName, properties)
      const parent = h("div", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children.length).toBe(0)
    })

    it("should handle DEFAULT_PATH from MaybeSaveFavicon", async () => {
      const hostname = "example-that-fails.com"
      const href = `https://${hostname}/page`

      // Set up cache to return DEFAULT_PATH for this hostname
      linkfavicons.urlCache.clear()
      linkfavicons.urlCache.set(linkfavicons.getQuartzPath(hostname), linkfavicons.DEFAULT_PATH)

      const node = h("a", { href }, [])
      const parent = h("div", {}, [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children.length).toBe(0)
    })

    it("should handle URL processing errors", async () => {
      // Create a URL that will cause an error in the new URL() constructor
      const invalidHref = "http://[invalid-ipv6"
      const node = h("a", { href: invalidHref }, [])
      const parent = h("div", {}, [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)
      expect(node.children.length).toBe(0)
    })

    describe("favicon count threshold", () => {
      it(`should skip favicons that appear fewer than ${linkfavicons.MIN_FAVICON_COUNT} times`, async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        counts.set(faviconPath, linkfavicons.MIN_FAVICON_COUNT - 1)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBe(0)
      })

      it(`should add favicons that appear exactly ${linkfavicons.MIN_FAVICON_COUNT} times`, async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        counts.set(faviconPath, linkfavicons.MIN_FAVICON_COUNT)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBeGreaterThan(0)
        expect(node.children[0]).toHaveProperty("properties.src", faviconPath)
      })

      it(`should add favicons that appear more than ${linkfavicons.MIN_FAVICON_COUNT} times`, async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        counts.set(faviconPath, linkfavicons.MIN_FAVICON_COUNT + 10)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBeGreaterThan(0)
        expect(node.children[0]).toHaveProperty("properties.src", faviconPath)
      })

      it("should skip favicons not in counts map (treat as 0)", async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBe(0)
      })

      it.each([
        ["mailto:test@example.com", linkfavicons.MAIL_PATH, "div"],
        ["#section-1", linkfavicons.ANCHOR_PATH, "p"],
      ])(
        "should always add %s favicons regardless of count",
        async (href, expectedPath, parentTag) => {
          const counts = new Map<string, number>()
          counts.set(expectedPath, 0)

          const node = h("a", { href }, [])
          const parent = h(parentTag, {}, [node])

          await linkfavicons.ModifyNode(node, parent, counts)
          expect(node.children.length).toBeGreaterThan(0)
          expect(node.children[0]).toHaveProperty("properties.src", expectedPath)
        },
      )

      it("should add whitelisted favicons even if count is below threshold", async () => {
        const hostname = "turntrout.com"
        const faviconPath = linkfavicons.TURNTROUT_FAVICON_PATH
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        counts.set(faviconPath, linkfavicons.MIN_FAVICON_COUNT - 1)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBeGreaterThan(0)
        expect(node.children[0]).toHaveProperty("properties.src", faviconPath)
      })

      it("should skip non-whitelisted favicons if count is below threshold", async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        counts.set(faviconPath, linkfavicons.MIN_FAVICON_COUNT - 1)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBe(0)
      })

      it("should whitelist favicons that end with whitelist suffix", async () => {
        const hostname = "apple.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        // Verify the path ends with the whitelist suffix
        expect(faviconPath.endsWith("apple_com.png")).toBe(true)

        const counts = new Map<string, number>()
        counts.set(faviconPath, linkfavicons.MIN_FAVICON_COUNT - 1)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBeGreaterThan(0)
        expect(node.children[0]).toHaveProperty("properties.src", faviconPath)
      })
    })
  })
})

describe("linkfavicons.downloadImage", () => {
  const runTest = async (
    mockResponse: Response | Error,
    expectedResult: boolean,
    expectedFileContent?: string,
  ) => {
    const url = "https://example.com/image.png"
    const imagePath = path.join(tempDir, "image.png")

    if (mockResponse instanceof Error) {
      jest.spyOn(global, "fetch").mockRejectedValueOnce(mockResponse)
    } else {
      jest.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse)
      jest
        .spyOn(fs, "createWriteStream")
        .mockImplementation(() => fsExtra.createWriteStream(imagePath))
    }

    if (expectedResult) {
      await expect(linkfavicons.downloadImage(url, imagePath)).resolves.not.toThrow()
    } else {
      await expect(linkfavicons.downloadImage(url, imagePath)).rejects.toThrow()
    }

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(url)

    if (expectedFileContent !== undefined) {
      // skipcq: JS-P1003
      const fileExists = await fsExtra.pathExists(imagePath)
      expect(fileExists).toBe(true)
      if (fileExists) {
        // skipcq: JS-P1003
        const content = await fsExtra.readFile(imagePath, "utf-8")
        expect(content).toBe(expectedFileContent)
      }
    } else {
      // skipcq: JS-P1003
      const fileExists = await fsExtra.pathExists(imagePath)
      expect(fileExists).toBe(false)
    }
  }

  // eslint-disable-next-line jest/expect-expect
  it("should download image successfully", async () => {
    const mockContent = "Mock image content"
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    })
    await runTest(mockResponse, true, mockContent)
  })

  // eslint-disable-next-line jest/expect-expect -- runTest has expect assertions
  it.each([
    [new Response("Mock image content", { status: 404, headers: { "Content-Type": "image/png" } })],
    [new Response(null, { status: 200, headers: { "Content-Type": "image/png" } })],
    [new Response("Fake", { status: 200, headers: { "Content-Type": "txt" } })],
    [new Error("Network error")],
  ])("should throw error case %#", async (mockResponse) => {
    await runTest(mockResponse, false)
  })

  it("should create directory structure if it doesn't exist", async () => {
    const url = "https://example.com/image.png"
    const imagePath = path.join(tempDir, "nested", "directory", "structure", "image.png")
    const mockContent = "Mock image content"
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    })

    jest.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse)

    await expect(linkfavicons.downloadImage(url, imagePath)).resolves.toBe(true)

    // skipcq: JS-P1003
    const fileExists = await fsExtra.pathExists(imagePath)
    expect(fileExists).toBe(true)

    // skipcq: JS-P1003
    const content = await fsExtra.readFile(imagePath, "utf-8")
    expect(content).toBe(mockContent)

    // Check if the directory structure was created
    const dirStructure = path.dirname(imagePath)
    // skipcq: JS-P1003
    const dirExists = await fsExtra.pathExists(dirStructure)
    expect(dirExists).toBe(true)
  })

  it("should throw if downloaded file is empty and clean up", async () => {
    const url = "https://example.com/image.png"
    const imagePath = path.join(tempDir, "image.png")
    const mockContent = ""
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    })

    jest.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse)
    jest
      .spyOn(fs, "createWriteStream")
      .mockImplementation(() => fsExtra.createWriteStream(imagePath))

    await expect(linkfavicons.downloadImage(url, imagePath)).rejects.toThrow(
      "Downloaded file is empty",
    )

    expect(fs.existsSync(imagePath)).toBe(false)
  })

  it("should throw if content-length indicates empty file", async () => {
    const url = "https://example.com/image.png"
    const imagePath = path.join(tempDir, "image.png")
    const mockResponse = new Response("", {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": "0",
      },
    })

    jest.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse)

    await expect(linkfavicons.downloadImage(url, imagePath)).rejects.toThrow("Empty image file")
  })

  it("should throw if write stream fails", async () => {
    const url = "https://example.com/image.png"
    const imagePath = path.join(tempDir, "readonly-dir", "image.png")
    const mockContent = "Mock image content"
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    })

    jest.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse)

    // Create a directory that doesn't allow writing
    const readonlyDir = path.join(tempDir, "readonly-dir")
    // skipcq: JS-P1003
    await fsExtra.ensureDir(readonlyDir)
    // skipcq: JS-P1003
    await fsExtra.chmod(readonlyDir, 0o444) // Read-only permissions

    try {
      await expect(linkfavicons.downloadImage(url, imagePath)).rejects.toThrow(
        "Failed to write image",
      )
    } finally {
      // skipcq: JS-P1003
      // Restore permissions so cleanup works
      await fsExtra.chmod(readonlyDir, 0o755)
    }
  })
})

describe("writeCacheToFile", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    linkfavicons.urlCache.clear()
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)
  })

  it.each([
    [
      new Map([
        ["example.com", "https://example.com/favicon.ico"],
        ["test.com", "https://test.com/favicon.png"],
      ]),
      "example.com,https://example.com/favicon.ico\ntest.com,https://test.com/favicon.png",
      "populated cache",
    ],
    [new Map(), "", "empty cache"],
  ])("should write $description to file", (cacheEntries, expectedContent) => {
    linkfavicons.urlCache.clear()
    cacheEntries.forEach((value, key) => linkfavicons.urlCache.set(key, value))

    linkfavicons.writeCacheToFile()

    expect(fs.writeFileSync).toHaveBeenCalledWith(linkfavicons.FAVICON_URLS_FILE, expectedContent, {
      flag: "w+",
    })
  })
})

describe("linkfavicons.readFaviconUrls", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it.each([
    [
      "example.com,https://example.com/favicon.ico\ntest.com,https://test.com/favicon.png",
      new Map([
        ["example.com", "https://example.com/favicon.ico"],
        ["test.com", "https://test.com/favicon.png"],
      ]),
      "valid file content",
    ],
    ["", new Map(), "empty file"],
    [
      "example.com,https://example.com/favicon.ico\ninvalid_line\ntest.com,https://test.com/favicon.png",
      new Map([
        ["example.com", "https://example.com/favicon.ico"],
        ["test.com", "https://test.com/favicon.png"],
      ]),
      "file with invalid lines",
    ],
  ])("should handle $description", async (fileContent, expectedMap) => {
    jest.spyOn(fs.promises, "readFile").mockResolvedValue(fileContent)

    const result = await linkfavicons.readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(expectedMap.size)
    expectedMap.forEach((value, key) => {
      expect(result.get(key)).toBe(value)
    })
  })

  it("should handle file read errors and return an empty Map", async () => {
    const mockError = new Error("File read error")
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    jest.spyOn(fs.promises, "readFile").mockRejectedValue(mockError)

    const result = await linkfavicons.readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
    expect(consoleWarnSpy).toHaveBeenCalledWith(mockError)
  })
})

describe("linkfavicons.readFaviconCounts", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("should return empty Map when file doesn't exist", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false)

    const result = linkfavicons.readFaviconCounts()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it.each([
    [
      "10\t/static/images/external-favicons/example_com.png\n5\t/static/images/external-favicons/test_com.png",
      new Map([
        ["/static/images/external-favicons/example_com.png", 10],
        ["/static/images/external-favicons/test_com.png", 5],
      ]),
      "valid file content",
    ],
    ["", new Map(), "empty file"],
    [
      "10\t/static/images/external-favicons/example_com.png\ninvalid_line\n5\t/static/images/external-favicons/test_com.png",
      new Map([
        ["/static/images/external-favicons/example_com.png", 10],
        ["/static/images/external-favicons/test_com.png", 5],
      ]),
      "file with invalid lines",
    ],
    [
      "10\t/static/images/external-favicons/example_com.png\n\n5\t/static/images/external-favicons/test_com.png",
      new Map([
        ["/static/images/external-favicons/example_com.png", 10],
        ["/static/images/external-favicons/test_com.png", 5],
      ]),
      "file with empty lines",
    ],
  ])("should handle $description", (fileContent, expectedMap) => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest.spyOn(fs, "readFileSync").mockReturnValue(fileContent)

    const result = linkfavicons.readFaviconCounts()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(expectedMap.size)
    expectedMap.forEach((value, key) => {
      expect(result.get(key)).toBe(value)
    })
  })

  it("should throw when file read fails", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("File read error")
    })

    expect(() => linkfavicons.readFaviconCounts()).toThrow("File read error")
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
  ])("should correctly identify if %s is a heading", (tagName, expected) => {
    const node = { tagName } as Element
    expect(linkfavicons.isHeading(node)).toBe(expected)
  })

  it("should handle undefined tagName", () => {
    const node = {} as Element
    expect(linkfavicons.isHeading(node)).toBe(false)
  })
})

describe("isAssetLink", () => {
  it.each([
    ["https://example.com/page", false],
    ["https://example.com/page/", false],
    ["https://example.com", false],
    ["/relative/path", false],
    ["https://example", false],
    ["https://example/", false],
    ["https://example.com/page.", false],
    ["https://example.com/page.?query", false],
    ["https://example.com/file.xyz", false],
    ["https://example.com/file.unknown", false],
    ["https://example.com/document.pdf", false],
    ["https://example.com/page.html", false],
    ["https://example.com/data.json", false],
    ["https://example.com/style.css", false],
    ["https://example.com/image.png", true],
    ["https://example.com/image.jpg", true],
    ["https://example.com/image.jpeg", true],
    ["https://example.com/image.gif", true],
    ["https://example.com/image.svg", true],
    ["https://example.com/image.webp", true],
    ["https://example.com/image.avif", true],
    ["https://example.com/video.mp4", true],
    ["https://example.com/video.webm", true],
    ["https://example.com/audio.mp3", true],
    ["https://example.com/audio.wav", true],
    ["https://example.com/audio.m4a", true],
    ["https://example.com/image.png?size=large", true],
    ["https://example.com/video.mp4?v=123", true],
    ["https://example.com/image.png#section", true],
    ["https://example.com/video.mp4#timestamp=10", true],
    ["https://example.com/image.png?size=large#section", true],
    ["https://example.com/image.PNG", true],
    ["https://example.com/image.JPG", true],
    ["https://example.com/video.MP4", true],
    ["./image.png", true],
    ["../video.mp4", true],
    ["audio.mp3", true],
  ])("should return %s for %s", (href, expected) => {
    expect(linkfavicons.isAssetLink(href)).toBe(expected)
  })
})

describe("AddFavicons plugin", () => {
  beforeEach(() => {
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(
        `${linkfavicons.MIN_FAVICON_COUNT + 1}\t${linkfavicons.MAIL_PATH}\n${linkfavicons.MIN_FAVICON_COUNT + 1}\t${linkfavicons.ANCHOR_PATH}`,
      )
  })

  it("should return a plugin configuration with correct name", () => {
    const plugin = linkfavicons.AddFavicons()
    expect(plugin.name).toBe("AddFavicons")
    expect(plugin.htmlPlugins).toBeDefined()
    expect(typeof plugin.htmlPlugins).toBe("function")
  })

  it("should process HTML tree and add favicons to links", async () => {
    const plugin = linkfavicons.AddFavicons()
    const htmlPlugins = plugin.htmlPlugins()
    const transformFunction = htmlPlugins[0]()

    const tree = {
      type: "root",
      children: [
        h("div", [h("a", { href: "mailto:test@example.com" }), h("a", { href: "#section" })]),
      ],
    }

    await transformFunction(tree as unknown as import("hast").Root)

    expect(fs.writeFileSync).toHaveBeenCalled()

    // Verify favicons were added
    const divElement = tree.children[0] as Element
    const mailtoLink = divElement.children[0] as Element
    const sectionLink = divElement.children[1] as Element

    expect(mailtoLink.children.length).toBe(1)
    expect((mailtoLink.children[0] as Element).properties.src).toBe(linkfavicons.MAIL_PATH)

    expect(sectionLink.children.length).toBe(1)
    expect((sectionLink.children[0] as Element).properties.src).toBe(linkfavicons.ANCHOR_PATH)
  })

  it("should handle nodes with undefined parent", async () => {
    const plugin = linkfavicons.AddFavicons()
    const htmlPlugins = plugin.htmlPlugins()
    const transformFunction = htmlPlugins[0]()

    // This test covers the edge case where visit calls the callback with undefined parent
    // which triggers the early return in the visitor function (line 557)
    const tree = { type: "root", children: [] }
    await transformFunction(tree as unknown as import("hast").Root)

    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it("should skip elements without href", async () => {
    const plugin = linkfavicons.AddFavicons()
    const htmlPlugins = plugin.htmlPlugins()
    const transformFunction = htmlPlugins[0]()

    const tree = {
      type: "root",
      children: [h("div", [h("span"), h("a")])],
    }

    await transformFunction(tree as unknown as import("hast").Root)

    expect(fs.writeFileSync).toHaveBeenCalled()

    const divElement = tree.children[0] as Element
    const spanElement = divElement.children[0] as Element
    const anchorWithoutHref = divElement.children[1] as Element

    expect(spanElement.children.length).toBe(0)
    expect(anchorWithoutHref.children.length).toBe(0)
  })
})
