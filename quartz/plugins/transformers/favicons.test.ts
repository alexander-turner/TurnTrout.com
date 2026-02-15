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
import * as linkfavicons from "./favicons"

jest.mock("fs")
import fs from "fs"

import {
  simpleConstants,
  localTroutFaviconBasename,
  specialFaviconPaths,
  defaultPath,
} from "../../components/constants"
import { faviconUrlsFile } from "../../components/constants.server"
import { hasClass } from "./utils"

const { minFaviconCount, faviconSubstringBlacklist } = simpleConstants

jest.mock("stream/promises")

beforeAll(() => {
  jest
    .spyOn(fs, "createWriteStream")
    .mockReturnValue(new PassThrough() as unknown as fs.WriteStream)
})

let tempDir: string
beforeEach(async () => {
  // skipcq: JS-P1003
  tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "favicons-test-"))
  jest.resetAllMocks()
  jest.restoreAllMocks()
  linkfavicons.urlCache.clear()
})

afterEach(async () => {
  // skipcq: JS-P1003
  await fsExtra.remove(tempDir)
})

const faviconSpanNode = {
  type: "element",
  tagName: "span",
  properties: { className: "favicon-span" },
}

const createExpectedFavicon = (
  imgPath: string,
  extraMarginLeft?: boolean,
): Record<string, unknown> => {
  const faviconElement = linkfavicons.createFaviconElement(imgPath)
  faviconElement.properties.class = `favicon${extraMarginLeft ? " close-text" : ""}`
  return faviconElement as unknown as Record<string, unknown>
}

describe("Favicon Utilities", () => {
  describe("MaybeSaveFavicon", () => {
    const hostname = "example.com"
    const avifUrl = "https://assets.turntrout.com/static/images/external-favicons/example_com.avif"

    const mockFetchAndFs = (
      avifStatus: number,
      localPngExists: boolean,
      googleStatus = 200,
      localSvgExists = false,
      cdnSvgStatus = 404,
    ) => {
      // SVG CDN response
      let responseBodySvg = ""
      if (cdnSvgStatus === 200) {
        responseBodySvg = "Mock SVG content"
      }
      const svgResponse = new Response(responseBodySvg, {
        status: cdnSvgStatus,
        headers: { "Content-Type": "image/svg+xml" },
      })

      // AVIF CDN response
      let responseBodyAVIF = ""
      if (avifStatus === 200) {
        responseBodyAVIF = "Mock image content"
      }
      const AVIFResponse = new Response(responseBodyAVIF, {
        status: avifStatus,
        headers: { "Content-Type": "image/avif" },
      })

      // Google download response
      let responseBodyGoogle = ""
      if (googleStatus === 200) {
        responseBodyGoogle = "Mock image content"
      }
      const googleResponse = new Response(responseBodyGoogle, {
        status: googleStatus,
        headers: { "Content-Type": "image/png" },
      })

      // Mock fetch: SVG CDN, then AVIF CDN, then Google
      jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(svgResponse)
        .mockResolvedValueOnce(AVIFResponse)
        .mockResolvedValueOnce(googleResponse)

      jest.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined)

      // Mock fs.promises.stat: local SVG, then local PNG
      jest
        .spyOn(fs.promises, "stat")
        .mockImplementationOnce(() =>
          localSvgExists
            ? Promise.resolve({ size: 1000 } as fs.Stats)
            : Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
        )
        .mockImplementationOnce(() =>
          localPngExists
            ? Promise.resolve({ size: 1000 } as fs.Stats)
            : Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
        )
    }

    it.each<[string, number, boolean, string | null, number?, boolean?, number?]>([
      ["AVIF exists", 200, false, avifUrl, 200, false, 404],
    ])(
      "%s",
      async (
        _,
        avifStatus,
        localPngExists,
        expected,
        googleStatus,
        localSvgExists,
        cdnSvgStatus,
      ) => {
        mockFetchAndFs(avifStatus, localPngExists, googleStatus, localSvgExists, cdnSvgStatus)
        expect(await linkfavicons.MaybeSaveFavicon(hostname)).toBe(expected)
      },
    )

    it("should return defaultPath when all attempts fail", async () => {
      mockFetchAndFs(404, false, 404, false, 404)
      const result = await linkfavicons.MaybeSaveFavicon(hostname)
      expect(result).toBe(defaultPath)
      expect(global.fetch).toHaveBeenCalledTimes(3) // SVG CDN, AVIF CDN, and Google attempts
    })

    it("should return defaultPath immediately if blacklisted by transformUrl", async () => {
      const blacklistedHostname = "incompleteideas.net"
      const fetchSpy = jest.spyOn(global, "fetch")
      const result = await linkfavicons.MaybeSaveFavicon(blacklistedHostname)
      expect(result).toBe(defaultPath)
      // Should not attempt any fetches since it's blacklisted
      expect(fetchSpy).not.toHaveBeenCalled()
      fetchSpy.mockRestore()
    })

    it.each<[string, number, boolean, boolean, number]>([
      ["Local PNG exists", 404, true, false, 404],
      ["Download PNG from Google", 404, false, false, 404],
    ])("%s", async (_, avifStatus, localPngExists, localSvgExists, cdnSvgStatus) => {
      const expected = linkfavicons.getQuartzPath(hostname)
      mockFetchAndFs(avifStatus, localPngExists, 200, localSvgExists, cdnSvgStatus)
      expect(await linkfavicons.MaybeSaveFavicon(hostname)).toBe(expected)
    })

    it("should not write local files to URL cache", async () => {
      const localPath = linkfavicons.getQuartzPath(hostname)

      jest.spyOn(global, "fetch").mockRejectedValue(new Error("CDN not available"))

      // Mock fs.promises.stat: SVG not found, PNG found
      jest
        .spyOn(fs.promises, "stat")
        .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
        .mockResolvedValueOnce({} as fs.Stats)

      linkfavicons.urlCache.clear()

      const result = await linkfavicons.MaybeSaveFavicon(hostname)

      expect(result).toBe(localPath)
      expect(linkfavicons.urlCache.size).toBe(0)

      // Check that the URL cache doesn't contain the local path
      expect(linkfavicons.urlCache.has(localPath)).toBe(false)
    })

    it("should cache and skip previously failed downloads", async () => {
      // Mock all download attempts to fail
      mockFetchAndFs(404, false, 404, false, 404)

      // First attempt should try all download methods
      const firstResult = await linkfavicons.MaybeSaveFavicon(hostname)
      expect(firstResult).toBe(defaultPath)
      expect(global.fetch).toHaveBeenCalledTimes(3) // SVG CDN, AVIF CDN, and Google attempts

      // Reset mocks for second attempt
      jest.clearAllMocks()
      mockFetchAndFs(404, false, 404, false, 404)

      // Second attempt should still check for SVG on CDN before using cached failure
      const secondResult = await linkfavicons.MaybeSaveFavicon(hostname)
      expect(secondResult).toBe(defaultPath)
      expect(global.fetch).toHaveBeenCalledTimes(1) // Should check for SVG on CDN
      expect(global.fetch).toHaveBeenCalledWith(
        "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
      )
    })

    it("should persist failed downloads to cache file", async () => {
      // Mock all download attempts to fail
      mockFetchAndFs(404, false, 404, false, 404)

      const writeFileSyncMock = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      await linkfavicons.MaybeSaveFavicon(hostname)

      linkfavicons.writeCacheToFile()

      // Verify the failure was written to cache file
      expect(writeFileSyncMock).toHaveBeenCalledWith(
        faviconUrlsFile,
        expect.stringContaining(`${linkfavicons.getQuartzPath(hostname)},${defaultPath}`),
        expect.any(Object),
      )
    })

    it("should handle fetch errors gracefully when checking CDN", async () => {
      // Mock fs.promises.stat: SVG not found, PNG not found
      jest
        .spyOn(fs.promises, "stat")
        .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
        .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

      // Mock fetch to throw error for SVG, then AVIF, then succeed for Google
      jest
        .spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(
          new Response("Mock image content", {
            status: 200,
            headers: { "Content-Type": "image/png" },
          }),
        )

      jest.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined)

      linkfavicons.urlCache.clear()

      const result = await linkfavicons.MaybeSaveFavicon(hostname)
      const expected = linkfavicons.getQuartzPath(hostname)
      expect(result).toBe(expected)
    })

    it("should return local SVG when found", async () => {
      const hostname = "example.com"
      const faviconPath = linkfavicons.getQuartzPath(hostname)
      const svgPath = faviconPath.replace(".png", ".svg")
      const localSvgPath = path.join("quartz", svgPath)

      linkfavicons.urlCache.clear()

      // Mock fs.promises.stat: SVG found
      jest.spyOn(fs.promises, "stat").mockResolvedValueOnce({ size: 1000 } as fs.Stats)

      const result = await linkfavicons.MaybeSaveFavicon(hostname)

      expect(result).toBe(svgPath)
      expect(linkfavicons.urlCache.get(faviconPath)).toBe(svgPath)
      expect(fs.promises.stat).toHaveBeenCalledWith(localSvgPath)
    })

    it("should load and respect cached failures on startup", async () => {
      const faviconPath = linkfavicons.getQuartzPath(hostname)

      linkfavicons.urlCache.clear()
      linkfavicons.urlCache.set(faviconPath, defaultPath)

      // Mock download attempts (which shouldn't be called)
      mockFetchAndFs(200, false, 200)

      const result = await linkfavicons.MaybeSaveFavicon(hostname)

      // Should check for SVG on CDN before returning cached failure
      expect(result).toBe(defaultPath)
      expect(global.fetch).toHaveBeenCalledTimes(1) // Should check for SVG on CDN
      expect(global.fetch).toHaveBeenCalledWith(
        "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
      )
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
      expect(global.fetch).toHaveBeenCalledTimes(1) // Should check for SVG on CDN
      expect(global.fetch).toHaveBeenCalledWith(
        "https://assets.turntrout.com/static/images/external-favicons/example_com.svg",
      )
    })
    describe("unnormalized SVG fallback", () => {
      const subdomainHost = "open.spotify.com"

      beforeEach(() => {
        linkfavicons.urlCache.clear()
      })

      it("should find SVG locally via unnormalized hostname", async () => {
        jest
          .spyOn(fs.promises, "stat")
          // Normalized SVG not found
          .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
          // Unnormalized SVG found
          .mockResolvedValueOnce({ size: 1000 } as fs.Stats)

        // Normalized CDN SVG 404
        jest
          .spyOn(global, "fetch")
          .mockResolvedValueOnce(
            new Response("", { status: 404, headers: { "Content-Type": "image/svg+xml" } }),
          )

        const result = await linkfavicons.MaybeSaveFavicon(subdomainHost)
        expect(result).toBe("/static/images/external-favicons/open_spotify_com.svg")
      })

      it("should find SVG on CDN via unnormalized hostname", async () => {
        jest
          .spyOn(fs.promises, "stat")
          // Normalized SVG not found
          .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
          // Unnormalized local SVG not found
          .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

        jest
          .spyOn(global, "fetch")
          // Normalized CDN SVG 404
          .mockResolvedValueOnce(
            new Response("", { status: 404, headers: { "Content-Type": "image/svg+xml" } }),
          )
          // Unnormalized CDN SVG 200
          .mockResolvedValueOnce(
            new Response("SVG", { status: 200, headers: { "Content-Type": "image/svg+xml" } }),
          )

        const result = await linkfavicons.MaybeSaveFavicon(subdomainHost)
        expect(result).toBe(
          "https://assets.turntrout.com/static/images/external-favicons/open_spotify_com.svg",
        )
      })
    })
  })

  describe("GetQuartzPath", () => {
    it.each([
      ["www.example.com", "/static/images/external-favicons/example_com.png"],
      ["localhost", specialFaviconPaths.turntrout],
      ["turntrout.com", specialFaviconPaths.turntrout],
      ["https://turntrout.com", specialFaviconPaths.turntrout],
      ["subdomain.example.org", "/static/images/external-favicons/example_org.png"],
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
      [specialFaviconPaths.turntrout, specialFaviconPaths.turntrout],
      [specialFaviconPaths.mail, specialFaviconPaths.mail],
      ["https://example.com/favicon.ico", "https://example.com/favicon.ico"],
    ])("should construct URL from path %s", (path, expectedUrl) => {
      expect(linkfavicons.getFaviconUrl(path)).toBe(expectedUrl)
    })

    it("should return cached SVG URL when cache contains full URL", () => {
      const pngPath = "/static/images/external-favicons/example_com.png"
      const cachedSvgUrl =
        "https://assets.turntrout.com/static/images/external-favicons/example_com.svg"

      linkfavicons.urlCache.set(pngPath, cachedSvgUrl)

      const result = linkfavicons.getFaviconUrl(pngPath)
      expect(result).toBe(cachedSvgUrl)
    })

    it("should return cached SVG path when cache contains path", () => {
      const pngPath = "/static/images/external-favicons/example_com.png"
      const cachedSvgPath = "/static/images/external-favicons/example_com.svg"

      linkfavicons.urlCache.set(pngPath, cachedSvgPath)

      const result = linkfavicons.getFaviconUrl(pngPath)
      expect(result).toBe(`https://assets.turntrout.com${cachedSvgPath}`)
    })

    it("should return cached AVIF URL when cache contains AVIF URL", () => {
      const pngPath = "/static/images/external-favicons/example_com.png"
      const cachedAvifUrl =
        "https://assets.turntrout.com/static/images/external-favicons/example_com.avif"

      linkfavicons.urlCache.set(pngPath, cachedAvifUrl)

      const result = linkfavicons.getFaviconUrl(pngPath)
      expect(result).toBe(cachedAvifUrl)
    })

    it("should ignore cached defaultPath", () => {
      const pngPath = "/static/images/external-favicons/example_com.png"

      linkfavicons.urlCache.set(pngPath, defaultPath)

      const result = linkfavicons.getFaviconUrl(pngPath)
      // Should fall through to AVIF since defaultPath is ignored
      expect(result).toBe(
        "https://assets.turntrout.com/static/images/external-favicons/example_com.avif",
      )
    })

    it("should return SVG URL when local SVG exists for PNG path", () => {
      const pngPath = "/static/images/external-favicons/example_com.png"
      const svgPath = "/static/images/external-favicons/example_com.svg"
      const localSvgPath = path.join("quartz", svgPath)

      linkfavicons.urlCache.clear()
      jest.spyOn(fs, "accessSync").mockImplementationOnce(() => {
        // File exists
      })

      const result = linkfavicons.getFaviconUrl(pngPath)
      expect(result).toBe(`https://assets.turntrout.com${svgPath}`)
      expect(fs.accessSync).toHaveBeenCalledWith(localSvgPath, fs.constants.F_OK)
    })

    it("should handle non-PNG non-SVG paths", () => {
      const otherPath = "/static/images/external-favicons/example_com.jpg"
      const result = linkfavicons.getFaviconUrl(otherPath)
      expect(result).toBe(`https://assets.turntrout.com${otherPath}`)
    })
  })

  describe("normalizePathForCounting", () => {
    it("should preserve full URLs", () => {
      const url = specialFaviconPaths.mail
      expect(linkfavicons.normalizePathForCounting(url)).toBe(url)
    })

    it("should preserve .svg paths", () => {
      const svgPath = "/static/images/external-favicons/mail.svg"
      expect(linkfavicons.normalizePathForCounting(svgPath)).toBe(svgPath)
    })

    it("should preserve .ico paths", () => {
      const icoPath = `/static/images/${localTroutFaviconBasename}`
      expect(linkfavicons.normalizePathForCounting(icoPath)).toBe(icoPath)
    })

    it("should remove .png extension", () => {
      const pngPath = "/static/images/external-favicons/example_com.png"
      expect(linkfavicons.normalizePathForCounting(pngPath)).toBe(
        "/static/images/external-favicons/example_com",
      )
    })

    it("should remove .avif extension", () => {
      const avifPath = "/static/images/external-favicons/example_com.avif"
      expect(linkfavicons.normalizePathForCounting(avifPath)).toBe(
        "/static/images/external-favicons/example_com",
      )
    })
  })

  describe("shouldIncludeFavicon", () => {
    it.each([
      [minFaviconCount + 1, true, "exceeds threshold"],
      [minFaviconCount, true, "equals threshold"],
      [minFaviconCount - 1, false, "below threshold"],
      [0, false, "zero count"],
    ])("should return %s when count %s", (count, expected) => {
      const faviconCounts = new Map<string, number>()
      // Counts are stored without extensions (format-agnostic)
      faviconCounts.set("/static/images/external-favicons/example_com", count)

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
      [specialFaviconPaths.mail],
      [specialFaviconPaths.anchor],
      [specialFaviconPaths.turntrout],
      ["/static/images/external-favicons/apple_com.png"],
    ])("should include whitelisted favicon %s even if count is zero", (imgPath) => {
      const faviconCounts = new Map<string, number>()
      // Counts are stored without extensions (format-agnostic), but special paths are preserved
      faviconCounts.set(linkfavicons.normalizePathForCounting(imgPath), 0)

      const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

      expect(result).toBe(true)
    })

    describe("favicon blacklist", () => {
      it.each(
        faviconSubstringBlacklist.map((blacklistEntry: string) => [
          `/static/images/external-favicons/${linkfavicons.normalizeFaviconListEntry(blacklistEntry)}.png`,
        ]),
      )("should exclude blacklisted favicon %s even if count exceeds threshold", (imgPath) => {
        const faviconCounts = new Map<string, number>()
        // Counts are stored without extensions (format-agnostic)
        faviconCounts.set(linkfavicons.normalizePathForCounting(imgPath), minFaviconCount + 10)

        const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

        expect(result).toBe(false)
      })

      it("should exclude favicons with blacklisted substring in middle of path", () => {
        const blacklistEntry = linkfavicons.normalizeFaviconListEntry(faviconSubstringBlacklist[0])
        const imgPath = `/static/images/external-favicons/subdomain_${blacklistEntry}.png`
        const faviconCounts = new Map<string, number>()
        // Counts are stored without extensions (format-agnostic)
        faviconCounts.set(linkfavicons.normalizePathForCounting(imgPath), minFaviconCount + 10)

        const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

        expect(result).toBe(false)
      })
    })
  })

  describe("linkfavicons.CreateFaviconElement", () => {
    it.each([
      ["/path/to/favicon.png", "Test Description"],
      ["/another/favicon.jpg", "Another Description"],
    ])("should create a favicon img element with src=%s and alt=%s", (urlString, description) => {
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

    it.each([
      ["https://assets.turntrout.com/static/images/external-favicons/github_com.svg", "github_com"],
      ["https://assets.turntrout.com/static/images/external-favicons/openai_com.svg", "openai_com"],
    ])("should create a favicon svg element for SVG with src=%s", (urlString, expectedDomain) => {
      const element = linkfavicons.createFaviconElement(urlString, "")
      expect(element.type).toBe("element")
      expect(element.tagName).toBe("svg")
      expect(element.properties.class).toBe("favicon")
      expect(element.properties["data-domain"]).toBe(expectedDomain)
      expect(element.properties.style).toBe(`--mask-url: url(${urlString});`)
      expect(element.children).toEqual([])
      expect(element.properties["aria-hidden"]).toBe("true")
      expect(element.properties["aria-focusable"]).toBe("false")
    })

    it.each([
      [
        "https://assets.turntrout.com/static/images/external-favicons/turntrout_com.svg",
        "A trout jumping to the left.",
      ],
      [
        "https://assets.turntrout.com/static/images/external-favicons/anchor.svg",
        "A counterclockwise arrow.",
      ],
    ])(
      "should create accessible svg element when description provided for %s",
      (urlString, description) => {
        const element = linkfavicons.createFaviconElement(urlString, description)
        expect(element.type).toBe("element")
        expect(element.tagName).toBe("svg")
        expect(element.properties.class).toBe("favicon")
        expect(element.properties.style).toBe(`--mask-url: url(${urlString});`)
        expect(element.children).toEqual([])
        // Accessible SVG properties
        expect(element.properties.role).toBe("img")
        expect(element.properties["aria-label"]).toBe(description)
        // Should NOT have hidden properties
        expect(element.properties["aria-hidden"]).toBeUndefined()
        expect(element.properties["aria-focusable"]).toBeUndefined()
      },
    )
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

    describe("favicon-span insertion", () => {
      const imgPath = "/test/favicon.png"

      it.each([
        ["Long text content", "Long text con", "tent"],
        ["Medium", "Me", "dium"],
      ])(
        "should splice last 4 chars into favicon-span for %s",
        (text, remainingText, splicedChars) => {
          const node = h("div", {}, [text])
          linkfavicons.insertFavicon(imgPath, node)

          // text is truncated, favicon-span (containing last chars + favicon) appended
          expect(node.children.length).toBe(2)
          expect(node.children[0]).toEqual({ type: "text", value: remainingText })
          const span = node.children[1] as Element
          expect(span).toMatchObject(faviconSpanNode)
          expect(span.children[0]).toEqual({ type: "text", value: splicedChars })
          expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
        },
      )

      it("should replace text node entirely when text is <= 4 chars", () => {
        const node = h("div", {}, ["1234"])
        linkfavicons.insertFavicon(imgPath, node)

        // text node removed, replaced with just the favicon-span
        expect(node.children.length).toBe(1)
        const span = node.children[0] as Element
        expect(span).toMatchObject(faviconSpanNode)
        expect(span.children[0]).toEqual({ type: "text", value: "1234" })
        expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
      })

      it.each([
        [h("div", {}, [h("div")]), "nodes without text content"],
        [h("div", {}, [""]), "empty text nodes"],
      ])("should handle %s correctly", (node) => {
        linkfavicons.insertFavicon(imgPath, node)

        // For non-text/empty nodes, favicon is appended directly (no span wrapping)
        const lastChild = node.children[node.children.length - 1] as Element
        expect(lastChild).toMatchObject(createExpectedFavicon(imgPath))
      })

      /*
       <a>Test <code>tag name test</code></a>
       becomes
       <a>Test <code>tag name <span class="favicon-span">test<img/></span></code></a>
      */
      it.each(linkfavicons.tagsToZoomInto)(
        "should zoom into %s elements and splice text into favicon-span",
        (tagName) => {
          const innerText = "tag name test"
          const node = h("a", {}, [
            { type: "text", value: "Test " },
            h(tagName as string, {}, [innerText]),
          ])
          linkfavicons.insertFavicon(imgPath, node)

          expect(node.children.length).toBe(2)
          expect(node.children[0]).toEqual({ type: "text", value: "Test " })

          const tagChild = node.children[1] as Element
          expect(tagChild.children.length).toBe(2) // truncated text + favicon-span
          expect(tagChild.children[0]).toEqual({ type: "text", value: "tag name " })
          const span = tagChild.children[1] as Element
          expect(span).toMatchObject(faviconSpanNode)
          expect(span.children[0]).toEqual({ type: "text", value: "test" })
          expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
        },
      )

      const codeContent = "6e687609"

      it("should handle code element inside link", () => {
        const node = h("a", { href: "https://github.com/" }, [h("code", {}, [codeContent])])
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(1)
        const codeChild = node.children[0] as Element
        expect(codeChild.children.length).toBe(2) // truncated text + favicon-span
        expect(codeChild.children[0]).toEqual({ type: "text", value: "6e68" })
        const span = codeChild.children[1] as Element
        expect(span).toMatchObject(faviconSpanNode)
        expect(span.children[0]).toEqual({ type: "text", value: "7609" })
        expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
      })

      it("should ignore empty text nodes when finding last child", () => {
        const linkWithEmptyText = h("a", { href: "https://github.com/" }, [
          h("code", {}, [codeContent]),
          { type: "text", value: "" }, // Empty text node at the end
        ])

        linkfavicons.insertFavicon(imgPath, linkWithEmptyText)

        // Zooms into code (skips empty text), splices text inside code
        expect(linkWithEmptyText.children.length).toBe(2) // code + empty text
        const codeChild = linkWithEmptyText.children[0] as Element
        expect(codeChild.children.length).toBe(2) // truncated text + favicon-span
        expect(codeChild.children[0]).toEqual({ type: "text", value: "6e68" })
        const span = codeChild.children[1] as Element
        expect(span).toMatchObject(faviconSpanNode)
        expect(span.children[0]).toEqual({ type: "text", value: "7609" })
        expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
      })

      it.each(linkfavicons.charsToSpace)(
        "should handle special character %s with close-text class",
        (char) => {
          const text = `Test${char}`
          const node = h("p", {}, [text])
          linkfavicons.insertFavicon(imgPath, node)

          // "Test!" is 5 chars, so last 4 chars are spliced: text becomes "T", span has "est!"
          expect(node.children.length).toBe(2) // truncated text + favicon-span
          expect(node.children[0]).toEqual({ type: "text", value: "T" })
          const span = node.children[1] as Element
          expect(span).toMatchObject(faviconSpanNode)
          expect(span.children[0]).toEqual({ type: "text", value: `est${char}` })
          expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath, true))
        },
      )

      it("should splice favicon-span from last text child", () => {
        const node = h("p", [
          "My email is ",
          h("a", { href: "https://mailto:throwaway@turntrout.com", class: "external" }, [
            h("code", ["throwaway@turntrout.com"]),
          ]),
          ".",
        ])

        linkfavicons.insertFavicon(specialFaviconPaths.mail, node)

        // "." is 1 char (<= 4), so text node is removed and replaced with favicon-span
        expect(node.children.length).toBe(3) // text + a + favicon-span (containing "." + favicon)
        const span = node.children[2] as Element
        expect(span).toMatchObject(faviconSpanNode)
        expect(span.children[0]).toEqual({ type: "text", value: "." })
        expect(span.children[1]).toMatchObject(createExpectedFavicon(specialFaviconPaths.mail))
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
      // Clear and reset urlCache to prevent test pollution
      linkfavicons.urlCache.clear()
      linkfavicons.urlCache.set(specialFaviconPaths.turntrout, specialFaviconPaths.turntrout)

      faviconCounts.clear()
      // Set up counts for common favicons
      faviconCounts.set(specialFaviconPaths.turntrout, minFaviconCount + 1)
      faviconCounts.set(specialFaviconPaths.mail, minFaviconCount + 1)
      faviconCounts.set(specialFaviconPaths.anchor, minFaviconCount + 1)

      // Mock fetch to prevent actual network calls during MaybeSaveFavicon
      // Return 404 for all fetches so MaybeSaveFavicon returns defaultPath for unknown hosts
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)

      // Mock fs.promises.stat to simulate that local favicon files don't exist
      // This prevents MaybeSaveFavicon from trying to read local files
      jest
        .spyOn(fs.promises, "stat")
        .mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
    })

    it.each([
      ["./shard-theory", specialFaviconPaths.turntrout],
      ["../shard-theory", specialFaviconPaths.turntrout],
    ])("should insert img favicon for %s", async (href, expectedPath) => {
      const node = h("a", { href })
      const parent = h("div", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)
      // Empty node: favicon appended directly (no span wrapping)
      const faviconElement = node.children[0] as Element
      expect(faviconElement.tagName).toBe("svg")
      expect(faviconElement.properties.style).toContain(expectedPath)
    })

    it.each([
      ["#test", specialFaviconPaths.anchor],
      ["mailto:test@example.com", specialFaviconPaths.mail],
      ["mailto:another@domain.org", specialFaviconPaths.mail],
      ["/rss.xml", specialFaviconPaths.rss],
      ["/some/path/rss.xml", specialFaviconPaths.rss],
    ])("should insert svg favicon for %s", async (href, expectedPath) => {
      const node = h("a", { href })
      const parent = h("div", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)
      // Empty node: favicon appended directly (no span wrapping)
      const faviconElement = node.children[0] as Element
      expect(faviconElement.tagName).toBe("svg")
      expect(faviconElement.properties.style).toContain(expectedPath)
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

    it.each([
      [
        undefined,
        (node: Element) => {
          expect(node.properties.className).toContain("same-page-link")
          expect(node.children.length).toBe(1)
          // ANCHOR_PATH is SVG, empty node so favicon appended directly
          const faviconElement = node.children[0] as Element
          expect(faviconElement.tagName).toBe("svg")
          expect(faviconElement.properties.style).toContain(specialFaviconPaths.anchor)
        },
      ],
      [
        ["existing-class"],
        (node: Element) => {
          expect(Array.isArray(node.properties.className)).toBe(true)
          expect(node.properties.className).toContain("existing-class")
          expect(node.properties.className).toContain("same-page-link")
        },
      ],
      [
        "existing-class",
        (node: Element) => {
          expect(typeof node.properties.className).toBe("string")
          expect(node.properties.className).toBe("existing-class same-page-link")
        },
      ],
    ])(
      "should handle internal links with different className types",
      async (initialClassName, assertFn) => {
        const node =
          initialClassName === undefined
            ? ({
                type: "element",
                tagName: "a",
                properties: { href: "#section-1" },
                children: [],
              } as Element)
            : initialClassName === "existing-class"
              ? ({
                  type: "element",
                  tagName: "a",
                  properties: { href: "#section-1", className: initialClassName },
                  children: [],
                } as Element)
              : h("a", { href: "#section-1", className: initialClassName })
        const parent = h("p", [node])

        await linkfavicons.ModifyNode(node, parent, faviconCounts)

        assertFn(node)
      },
    )

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
      ["https://example.com", h("span", {}, [h("svg", { className: "favicon" })])],
      ["mailto:test@example.com", h("svg", { className: "favicon" })],
      ["#section", h("svg", { className: "favicon" })],
      ["/rss.xml", h("svg", { className: "favicon" })],
      ["https://example.com", h("svg", { className: "favicon" })],
      ["https://example.com", h("img", { className: "favicon", src: "/favicon.ico" })],
      [
        "https://example.com",
        h("span", { className: "some-wrapper" }, [
          h("span", {}, [h("svg", { className: "favicon" })]),
        ]),
      ],
    ])("should skip %s that already has a favicon", async (href, faviconElement) => {
      const node = h("a", { href }, [faviconElement])
      const parent = h("div", [node])
      const initialChildrenCount = node.children.length

      await linkfavicons.ModifyNode(node, parent, faviconCounts)

      expect(node.children.length).toBe(initialChildrenCount)
    })

    it("should add favicon to link with non-zoomable child element", async () => {
      const node = h("a", { href: "mailto:test@example.com" }, [h("span", {}, ["rss"])])
      const parent = h("div", [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)

      // span is not in tagsToZoomInto and not text, so favicon appended directly
      const lastChild = node.children[node.children.length - 1] as Element
      expect(hasClass(lastChild, "favicon")).toBe(true)
    })

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

    it("should handle defaultPath from MaybeSaveFavicon", async () => {
      const hostname = "example-that-fails.com"
      const href = `https://${hostname}/page`

      // Set up cache to return defaultPath for this hostname
      linkfavicons.urlCache.clear()
      linkfavicons.urlCache.set(linkfavicons.getQuartzPath(hostname), defaultPath)

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
      it(`should skip favicons that appear fewer than ${minFaviconCount} times`, async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        counts.set(faviconPath, minFaviconCount - 1)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBe(0)
      })

      it(`should add favicons that appear exactly ${minFaviconCount} times`, async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        // Counts are stored without extensions (format-agnostic)
        counts.set(linkfavicons.normalizePathForCounting(faviconPath), minFaviconCount)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBeGreaterThan(0)
        // Empty node: favicon appended directly
        const faviconElement = node.children[0] as Element
        expect(faviconElement).toHaveProperty("properties.src", faviconPath)
      })

      it(`should add favicons that appear more than ${minFaviconCount} times`, async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        // Counts are stored without extensions (format-agnostic)
        counts.set(linkfavicons.normalizePathForCounting(faviconPath), minFaviconCount + 10)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBeGreaterThan(0)
        // Empty node: favicon appended directly
        const faviconElement = node.children[0] as Element
        expect(faviconElement).toHaveProperty("properties.src", faviconPath)
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
        ["mailto:test@example.com", specialFaviconPaths.mail, "div"],
        ["#section-1", specialFaviconPaths.anchor, "p"],
      ])(
        "should always add %s favicons regardless of count",
        async (href, expectedPath, parentTag) => {
          const counts = new Map<string, number>()
          counts.set(expectedPath, 0)

          const node = h("a", { href }, [])
          const parent = h(parentTag, {}, [node])

          await linkfavicons.ModifyNode(node, parent, counts)
          expect(node.children.length).toBeGreaterThan(0)
          // Empty node: favicon appended directly (no span wrapping)
          const faviconElement = node.children[0] as Element
          expect(faviconElement.tagName).toBe("svg")
          expect(faviconElement.properties.style).toContain(expectedPath)
        },
      )

      it("should add whitelisted favicons even if count is below threshold", async () => {
        const hostname = "turntrout.com"
        const faviconPath = specialFaviconPaths.turntrout
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        counts.set(faviconPath, minFaviconCount - 1)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBeGreaterThan(0)
        // Empty node: favicon appended directly
        const faviconEl = node.children[0] as Element
        expect(faviconEl).toHaveProperty("properties.style")
        expect(faviconEl.properties.style).toContain(faviconPath)
      })

      it("should skip non-whitelisted favicons if count is below threshold", async () => {
        const hostname = "example.com"
        const faviconPath = linkfavicons.getQuartzPath(hostname)
        const href = `https://${hostname}/page`

        const counts = new Map<string, number>()
        counts.set(faviconPath, minFaviconCount - 1)

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
        counts.set(faviconPath, minFaviconCount - 1)

        linkfavicons.urlCache.clear()
        linkfavicons.urlCache.set(faviconPath, faviconPath)

        const node = h("a", { href }, [])
        const parent = h("div", {}, [node])

        await linkfavicons.ModifyNode(node, parent, counts)
        expect(node.children.length).toBeGreaterThan(0)
        // Empty node: favicon appended directly
        const faviconElement = node.children[0] as Element
        expect(faviconElement).toHaveProperty("properties.src", faviconPath)
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
    const imagePath = path.join(tempDir, "image.png")
    const mockContent = "Mock image content"
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    })

    jest.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse)

    // Mock mkdir to throw an error - works in sandboxed environments
    // where file permission restrictions don't apply (e.g., running as root)
    jest.spyOn(fs.promises, "mkdir").mockRejectedValueOnce(new Error("EACCES: permission denied"))

    await expect(linkfavicons.downloadImage(url, imagePath)).rejects.toThrow(
      "Failed to write image",
    )
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

    expect(fs.writeFileSync).toHaveBeenCalledWith(faviconUrlsFile, expectedContent, {
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
      JSON.stringify([
        ["/static/images/external-favicons/example_com", 10],
        ["/static/images/external-favicons/test_com", 5],
      ]),
      new Map([
        ["/static/images/external-favicons/example_com", 10],
        ["/static/images/external-favicons/test_com", 5],
      ]),
      "valid JSON array format",
    ],
    [
      JSON.stringify([
        ["/static/images/external-favicons/github_com", 93],
        ["/static/images/external-favicons/openai_com", 42],
      ]),
      new Map([
        ["/static/images/external-favicons/github_com", 93],
        ["/static/images/external-favicons/openai_com", 42],
      ]),
      "JSON with high count values (regression test for parsing bug)",
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
      "JSON with invalid entries (should skip them)",
    ],
  ])("should handle %s", (fileContent, expectedMap) => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest.spyOn(fs, "readFileSync").mockReturnValue(fileContent)

    const result = linkfavicons.readFaviconCounts()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(expectedMap.size)
    expectedMap.forEach((value, key) => {
      expect(result.get(key)).toBe(value)
    })
  })

  it("should return empty Map when JSON parsing fails", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest.spyOn(fs, "readFileSync").mockReturnValue("invalid json {")

    const result = linkfavicons.readFaviconCounts()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it("should return empty Map when file read fails", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw new Error("File read error")
    })

    const result = linkfavicons.readFaviconCounts()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it("should correctly read data written by countFavicons.ts writeCountsToFile format", () => {
    // Simulate the exact format that countFavicons.ts writes:
    // JSON.stringify(Array.from(faviconCounter.entries()), null, 2)
    const mockData = new Map([
      ["/static/images/external-favicons/github_com", 93],
      ["/static/images/external-favicons/openai_com", 42],
      ["https://assets.turntrout.com/static/images/external-favicons/mail.svg", 15],
    ])
    const jsonContent = JSON.stringify(Array.from(mockData.entries()), null, 2)

    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest.spyOn(fs, "readFileSync").mockReturnValue(jsonContent)

    const result = linkfavicons.readFaviconCounts()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(3)
    expect(result.get("/static/images/external-favicons/github_com")).toBe(93)
    expect(result.get("/static/images/external-favicons/openai_com")).toBe(42)
    expect(
      result.get("https://assets.turntrout.com/static/images/external-favicons/mail.svg"),
    ).toBe(15)
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
  const mockCtx = {
    argv: {
      offline: false,
    },
  } as unknown as import("../../util/ctx").BuildCtx

  beforeEach(() => {
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)
    jest.spyOn(fs, "existsSync").mockReturnValue(true)
    jest
      .spyOn(fs, "readFileSync")
      .mockReturnValue(
        `${minFaviconCount + 1}\t${specialFaviconPaths.mail}\n${minFaviconCount + 1}\t${specialFaviconPaths.anchor}`,
      )
  })

  it("should return a plugin configuration with correct name", () => {
    const plugin = linkfavicons.AddFavicons()
    expect(plugin.name).toBe("AddFavicons")
    expect(plugin.htmlPlugins).toBeDefined()
    expect(typeof plugin.htmlPlugins).toBe("function")
  })

  it("should return [] when offline mode is enabled", () => {
    const plugin = linkfavicons.AddFavicons()
    const offlineCtx = {
      argv: {
        offline: true,
      },
    } as unknown as import("../../util/ctx").BuildCtx

    expect(plugin.htmlPlugins(offlineCtx)).toEqual([])
  })

  it("should default offline to false when ctx.argv.offline is undefined", () => {
    const plugin = linkfavicons.AddFavicons()
    const ctxWithoutOffline = {
      argv: {},
    } as unknown as import("../../util/ctx").BuildCtx

    expect(plugin.htmlPlugins(ctxWithoutOffline).length).toBeGreaterThan(0)
  })

  it("should process HTML tree and add favicons to links", async () => {
    const plugin = linkfavicons.AddFavicons()
    const htmlPlugins = plugin.htmlPlugins(mockCtx)
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
    // MAIL_PATH is SVG, empty node so favicon appended directly
    const mailFavicon = mailtoLink.children[0] as Element
    expect(mailFavicon.tagName).toBe("svg")
    expect(mailFavicon.properties.style).toContain(specialFaviconPaths.mail)

    expect(sectionLink.children.length).toBe(1)
    // ANCHOR_PATH is SVG, empty node so favicon appended directly
    const anchorFavicon = sectionLink.children[0] as Element
    expect(anchorFavicon.tagName).toBe("svg")
    expect(anchorFavicon.properties.style).toContain(specialFaviconPaths.anchor)
  })

  it("should handle nodes with undefined parent", async () => {
    const plugin = linkfavicons.AddFavicons()
    const htmlPlugins = plugin.htmlPlugins(mockCtx)
    const transformFunction = htmlPlugins[0]()

    // This test covers the edge case where visit calls the callback with undefined parent
    // which triggers the early return in the visitor function (line 557)
    const tree = { type: "root", children: [] }
    await transformFunction(tree as unknown as import("hast").Root)

    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it("should skip elements without href", async () => {
    const plugin = linkfavicons.AddFavicons()
    const htmlPlugins = plugin.htmlPlugins(mockCtx)
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

describe("transformUrl", () => {
  beforeEach(() => {
    linkfavicons.urlCache.clear()
  })

  it.each([
    [specialFaviconPaths.mail, specialFaviconPaths.mail],
    [specialFaviconPaths.anchor, specialFaviconPaths.anchor],
    [specialFaviconPaths.turntrout, specialFaviconPaths.turntrout],
    [
      "/static/images/external-favicons/apple_com.png",
      "/static/images/external-favicons/apple_com.png",
    ],
  ])("should return %s if whitelisted", (input, expected) => {
    const result = linkfavicons.transformUrl(input)
    expect(result).toBe(expected)
  })

  it.each(
    faviconSubstringBlacklist.map((blacklistEntry: string) => [
      `/static/images/external-favicons/${linkfavicons.normalizeFaviconListEntry(blacklistEntry)}.png`,
      defaultPath,
    ]),
  )("should return defaultPath if blacklisted: %s", (input, expected) => {
    const result = linkfavicons.transformUrl(input)
    expect(result).toBe(expected)
  })

  it("should return path unchanged for non-whitelisted, non-blacklisted paths", () => {
    const input = "/static/images/external-favicons/example_com.png"
    const result = linkfavicons.transformUrl(input)
    expect(result).toBe(input)
  })
})

describe("normalizeHostname", () => {
  it.each([
    ["example.com", "example.com", "plain domain"],
    ["blog.example.com", "example.com", "single subdomain"],
    ["api.blog.example.com", "example.com", "nested subdomain"],
    ["www.example.com", "example.com", "www subdomain"],
    ["cdn.assets.example.org", "example.org", "multiple subdomains"],
  ])("should remove subdomains: %s -> %s (%s)", (input, expected) => {
    const result = linkfavicons.getQuartzPath(input)
    const expectedPath = `/static/images/external-favicons/${expected.replace(/\./g, "_")}.png`
    expect(result).toBe(expectedPath)
  })

  it.each([
    ["example.co.uk", "example.co.uk", "co.uk TLD"],
    ["blog.example.co.uk", "example.co.uk", "co.uk with subdomain"],
    ["example.com.au", "example.com.au", "com.au TLD"],
    ["api.example.com.au", "example.com.au", "com.au with subdomain"],
    ["example.co.jp", "example.co.jp", "co.jp TLD"],
    ["cdn.example.co.jp", "example.co.jp", "co.jp with subdomain"],
  ])("should handle multi-part TLDs: %s -> %s (%s)", (input, expected) => {
    const result = linkfavicons.getQuartzPath(input)
    const expectedPath = `/static/images/external-favicons/${expected.replace(/\./g, "_")}.png`
    expect(result).toBe(expectedPath)
  })

  it.each([
    ["transformer-circuits.pub", "anthropic.com", "transformer-circuits.pub"],
    ["www.transformer-circuits.pub", "anthropic.com", "transformer-circuits.pub with www"],
    ["protonvpn.com", "proton.me", "protonvpn.com"],
    ["www.protonvpn.com", "proton.me", "protonvpn.com with www"],
    ["subdomain.protonvpn.com", "proton.me", "protonvpn.com with subdomain"],
    ["nbc.com", "msnbc.com", "nbc.com"],
    ["www.nbc.com", "msnbc.com", "nbc.com with www"],
    ["news.nbc.com", "msnbc.com", "nbc.com with subdomain"],
  ])("should apply special domain mappings: %s -> %s (%s)", (input, expected) => {
    const result = linkfavicons.getQuartzPath(input)
    const expectedPath = `/static/images/external-favicons/${expected.replace(/\./g, "_")}.png`
    expect(result).toBe(expectedPath)
  })

  it.each([
    ["mail.google.com", "mail.google.com", "whitelisted google subdomain"],
    ["drive.google.com", "drive.google.com", "whitelisted google subdomain"],
    ["maps.google.com", "google.com", "maps.google.com"],
    ["www.google.com", "google.com", "www.google.com"],
  ])("should normalize google subdomains: %s -> %s (%s)", (input, expected) => {
    const result = linkfavicons.getQuartzPath(input)
    const expectedPath = `/static/images/external-favicons/${expected.replace(/\./g, "_")}.png`
    expect(result).toBe(expectedPath)
  })

  it.each([
    ["scholar.google.com", "scholar.google.com", "scholar"],
    ["play.google.com", "play.google.com", "play"],
    ["docs.google.com", "docs.google.com", "docs"],
  ])("should preserve whitelisted google subdomains: %s -> %s (%s)", (input, expected) => {
    const result = linkfavicons.getQuartzPath(input)
    const expectedPath = `/static/images/external-favicons/${expected.replace(/\./g, "_")}.png`
    expect(result).toBe(expectedPath)
  })

  it.each(["math", "gaming", "stats", "ai"])(
    "should preserve stackexchange subdomains: %s.stackexchange.com",
    (subdomain) => {
      const hostname = `${subdomain}.stackexchange.com`
      const result = linkfavicons.getQuartzPath(hostname)
      const expectedPath = `/static/images/external-favicons/${hostname.replace(/\./g, "_")}.png`
      expect(result).toBe(expectedPath)
    },
  )

  it("should handle localhost specially", () => {
    const result = linkfavicons.getQuartzPath("localhost")
    expect(result).toBe(specialFaviconPaths.turntrout)
  })

  it("should handle turntrout.com specially", () => {
    const result = linkfavicons.getQuartzPath("turntrout.com")
    expect(result).toBe(specialFaviconPaths.turntrout)
  })
})

describe("normalizeFaviconListEntry", () => {
  it.each([
    ["playpen_icomtek_csir_co_za", "csir_co_za", "strips subdomains with multi-part TLD"],
    ["incompleteideas_net", "incompleteideas_net", "already normalized"],
    ["blog_example_com", "example_com", "strips subdomain"],
    ["developer_mozilla_org", "mozilla_org", "strips subdomain"],
  ])("should normalize %s to %s (%s)", (input, expected) => {
    expect(linkfavicons.normalizeFaviconListEntry(input)).toBe(expected)
  })
})

describe("getQuartzPath hostname normalization", () => {
  it.each([
    ["blog.openai.com", "/static/images/external-favicons/openai_com.png"],
    ["support.apple.com", "/static/images/external-favicons/apple_com.png"],
    ["assets.anthropic.com", "/static/images/external-favicons/anthropic_com.png"],
    ["cdn.anthropic.com", "/static/images/external-favicons/anthropic_com.png"],
    ["alignment.anthropic.com", "/static/images/external-favicons/anthropic_com.png"],
    ["subdomain.blog.openai.com", "/static/images/external-favicons/openai_com.png"],
    ["any.subdomain.google.com", "/static/images/external-favicons/google_com.png"],
  ])("should normalize hostname %s to canonical domain", (hostname, expected) => {
    const result = linkfavicons.getQuartzPath(hostname)
    expect(result).toBe(expected)
  })

  it("should not normalize google.com itself", () => {
    const result = linkfavicons.getQuartzPath("google.com")
    expect(result).toBe("/static/images/external-favicons/google_com.png")
  })

  it("should preserve whitelisted google.com subdomains", () => {
    expect(linkfavicons.getQuartzPath("scholar.google.com")).toBe(
      "/static/images/external-favicons/scholar_google_com.png",
    )
    expect(linkfavicons.getQuartzPath("play.google.com")).toBe(
      "/static/images/external-favicons/play_google_com.png",
    )
    expect(linkfavicons.getQuartzPath("docs.google.com")).toBe(
      "/static/images/external-favicons/docs_google_com.png",
    )
  })

  it("should not normalize non-matching hostnames", () => {
    const result = linkfavicons.getQuartzPath("example.com")
    expect(result).toBe("/static/images/external-favicons/example_com.png")
  })

  describe("integration with ModifyNode", () => {
    it("should use normalized path for favicon insertion", async () => {
      const hostname = "blog.openai.com"
      const normalizedPath = linkfavicons.getQuartzPath(hostname)
      const normalizedAvifUrl = linkfavicons.getFaviconUrl(normalizedPath)
      const href = `https://${hostname}/page`

      const faviconCounts = new Map<string, number>()
      // Counts are stored without extensions (format-agnostic)
      faviconCounts.set(linkfavicons.normalizePathForCounting(normalizedPath), minFaviconCount + 1)

      // Mock fetch: normalized SVG (404), unnormalized SVG (404), AVIF (200)
      jest
        .spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response("", {
            status: 404,
            headers: { "Content-Type": "image/svg+xml" },
          }),
        )
        .mockResolvedValueOnce(
          new Response("", {
            status: 404,
            headers: { "Content-Type": "image/svg+xml" },
          }),
        )
        .mockResolvedValueOnce(
          new Response("Mock AVIF content", {
            status: 200,
            headers: { "Content-Type": "image/avif" },
          }),
        )

      // Mock fs.promises.stat: normalized SVG not found, unnormalized SVG not found, PNG not found
      jest
        .spyOn(fs.promises, "stat")
        .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
        .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))
        .mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

      linkfavicons.urlCache.clear()

      const node = h("a", { href }, [])
      const parent = h("div", {}, [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)

      expect(node.children.length).toBeGreaterThan(0)
      // Empty node: favicon appended directly
      const insertedFavicon = node.children[0] as Element
      expect(insertedFavicon.properties.src).toBe(normalizedAvifUrl)
    })

    it("should use normalized path for count checking", async () => {
      const hostname = "blog.openai.com"
      const normalizedPath = linkfavicons.getQuartzPath(hostname)
      const href = `https://${hostname}/page`

      const faviconCounts = new Map<string, number>()
      // Counts are stored without extensions (format-agnostic)
      faviconCounts.set(linkfavicons.normalizePathForCounting(normalizedPath), minFaviconCount + 1)

      jest.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response("Mock AVIF content", {
          status: 200,
          headers: { "Content-Type": "image/avif" },
        }),
      )

      linkfavicons.urlCache.clear()

      const node = h("a", { href }, [])
      const parent = h("div", {}, [node])

      await linkfavicons.ModifyNode(node, parent, faviconCounts)

      expect(node.children.length).toBeGreaterThan(0)
    })
  })
})

describe("normalizeUrl", () => {
  it.each([
    ["https://example.com/page", "https://example.com/page"],
    ["http://example.com/page", "http://example.com/page"],
    ["./shard-theory", "https://www.turntrout.com/shard-theory"],
    ["../shard-theory", "https://www.turntrout.com/shard-theory"],
    ["/absolute/path", "https://www.turntrout.com//absolute/path"],
    ["relative/path", "https://www.turntrout.com/relative/path"],
    ["./nested/./path", "https://www.turntrout.com/nested/./path"],
    ["../parent/../sibling", "https://www.turntrout.com/parent/../sibling"],
  ])("should normalize %s to %s", (input, expected) => {
    const result = linkfavicons.normalizeUrl(input)
    expect(result).toBe(expected)
  })

  it.each([
    ["./page?query=value#section", "https://www.turntrout.com/page?query=value#section"],
    ["./", "https://www.turntrout.com/"],
    ["../../deep/path", "https://www.turntrout.com/../deep/path"],
  ])("should handle edge cases: %s", (input, expected) => {
    const result = linkfavicons.normalizeUrl(input)
    expect(result).toBe(expected)
  })
})

describe("maybeSpliceText edge cases", () => {
  const imgPath = "/test/favicon.png"

  it("should handle node with only whitespace text", () => {
    const node = h("a", {}, ["   "])
    const result = linkfavicons.maybeSpliceText(node, linkfavicons.createFaviconElement(imgPath))
    // Whitespace-only text is treated as empty, favicon returned directly (no span wrapping)
    expect(result).toMatchObject(createExpectedFavicon(imgPath))
  })

  it.each([
    ["A", "single character text"],
    ["1234", "four character text"],
    ["12", "two character text"],
  ])("should handle node with %s", (text) => {
    const node = h("a", {}, [text])
    linkfavicons.insertFavicon(imgPath, node)
    // text <= 4 chars: text node removed, replaced with favicon-span containing all text
    expect(node.children.length).toBe(1)
    const span = node.children[0] as Element
    expect(span).toMatchObject(faviconSpanNode)
    expect(span.children[0]).toEqual({ type: "text", value: text })
    expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
  })

  it("should handle nested tagsToZoomInto elements", () => {
    const innerText = "nested text"
    const node = h("a", {}, [
      { type: "text", value: "Outer " },
      h("em", {}, [{ type: "text", value: "text " }]),
      h("strong", {}, [innerText]),
    ])
    linkfavicons.insertFavicon(imgPath, node)

    const strongElement = node.children[2] as Element
    expect(strongElement.tagName).toBe("strong")
    // "nested text" is 11 chars, last 4 spliced: text becomes "nested " and span has "text"
    expect(strongElement.children.length).toBe(2) // truncated text + favicon-span
    expect(strongElement.children[0]).toEqual({ type: "text", value: "nested " })
    const span = strongElement.children[1] as Element
    expect(span).toMatchObject(faviconSpanNode)
    expect(span.children[0]).toEqual({ type: "text", value: "text" })
    expect(span.children[1]).toMatchObject(createExpectedFavicon(imgPath))
  })

  it("should handle node with element child that has no text", () => {
    const node = h("a", {}, [h("div")])
    const result = linkfavicons.maybeSpliceText(node, linkfavicons.createFaviconElement(imgPath))
    // div is not zoomable and not text, favicon returned directly (no span wrapping)
    expect(node.children.length).toBe(1) // only the div
    expect(result).toMatchObject(createExpectedFavicon(imgPath))
  })

  it("should handle node with mixed children ending in element", () => {
    const node = h("a", {}, [{ type: "text", value: "Text " }, h("span", {}, ["More"])])
    linkfavicons.insertFavicon(imgPath, node)
    // span is not in tagsToZoomInto and not text, so favicon appended directly
    expect(node.children.length).toBe(3) // text + span + favicon
    const faviconEl = node.children[2] as Element
    expect(faviconEl).toMatchObject(createExpectedFavicon(imgPath))
  })

  it("should zoom into abbr inside link (RSS link structure)", () => {
    // Simulates the RSS link structure created in afterArticle.ts
    const node = h("a", {}, [h("abbr", { class: "small-caps" }, ["rss"])])
    linkfavicons.insertFavicon(imgPath, node)

    // Favicon should be appended inside the abbr (it's in tagsToZoomInto)
    expect(node.children.length).toBe(1)
    const abbr = node.children[0] as Element
    expect(abbr.tagName).toBe("abbr")
    // "rss" is 3 chars (<= 4), so text node removed, replaced with favicon-span
    expect(abbr.children.length).toBe(1) // favicon-span only
    const span = abbr.children[0] as Element
    expect(span).toMatchObject(faviconSpanNode)
    expect(span.children[0]).toEqual({ type: "text", value: "rss" })
    expect(span.children[1]).toMatchObject({
      type: "element",
      properties: expect.objectContaining({
        class: "favicon",
      }),
    })
  })

  it("should append to existing favicon-span instead of creating a new one", () => {
    const existingFavicon = linkfavicons.createFaviconElement("/first/favicon.png")
    const existingSpan = h("span", { className: "favicon-span" }, ["text", existingFavicon])
    const node = h("a", {}, [existingSpan])

    const result = linkfavicons.maybeSpliceText(node, linkfavicons.createFaviconElement(imgPath))
    // Should return null because the favicon was appended to the existing span
    expect(result).toBeNull()
    // Existing span should now have 3 children: text + first favicon + second favicon
    expect(existingSpan.children).toHaveLength(3)
    expect(existingSpan.children[2]).toMatchObject(createExpectedFavicon(imgPath))
  })
})

describe("favicon must be inside favicon-span (prevents line-break orphaning)", () => {
  const imgPath = "/test/favicon.png"

  // Helper to find a favicon-span anywhere in the tree
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
    ["text ending with punctuation", h("a", {}, ["Hello!"])],
  ])("wraps favicon inside favicon-span for %s", (_name, node) => {
    const result = linkfavicons.maybeSpliceText(
      node as Element,
      linkfavicons.createFaviconElement(imgPath),
    )
    if (result) {
      ;(node as Element).children.push(result)
    }

    const span = findFaviconSpan(node as Element)
    if (span === null) {
      throw new Error("favicon-span not found")
    }

    // The favicon MUST be a child of the favicon-span, not a sibling.
    const faviconChild = span.children.find(
      (child) =>
        child.type === "element" &&
        (child as Element).tagName !== "span" &&
        hasClass(child as Element, "favicon"),
    )
    expect(faviconChild).toBeDefined()

    // Verify no bare favicon element is a direct child of the link
    // (favicon-span containing the favicon is OK, but a naked favicon img/svg is not)
    const directNakedFavicon = (node as Element).children.find(
      (child) =>
        child.type === "element" &&
        (child as Element).tagName !== "span" &&
        hasClass(child as Element, "favicon"),
    )
    expect(directNakedFavicon).toBeUndefined()
  })

  it.each([
    ["empty node", h("a", {}, [])],
    ["non-text last child (div)", h("a", {}, [h("div")])],
  ])("returns favicon directly for %s (no text to splice)", (_name, node) => {
    const result = linkfavicons.maybeSpliceText(
      node as Element,
      linkfavicons.createFaviconElement(imgPath),
    )
    // For nodes without text, favicon is returned directly (no span wrapping)
    expect(result).toBeDefined()
    expect(result).toMatchObject(createExpectedFavicon(imgPath))
  })
})

describe("shouldIncludeFavicon edge cases", () => {
  it("should exclude blacklisted favicon even if whitelisted", () => {
    const blacklistEntry = linkfavicons.normalizeFaviconListEntry(faviconSubstringBlacklist[0])
    const imgPath = `/static/images/external-favicons/${blacklistEntry}.png`
    const faviconCounts = new Map<string, number>()
    // Counts are stored without extensions (format-agnostic)
    faviconCounts.set(linkfavicons.normalizePathForCounting(imgPath), minFaviconCount + 10)

    // Even if it contains a whitelist entry, blacklist should take precedence
    const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

    expect(result).toBe(false)
  })

  it("should include whitelisted favicon even if count is zero and not in map", () => {
    const imgPath = specialFaviconPaths.mail
    const faviconCounts = new Map<string, number>()

    const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

    expect(result).toBe(true)
  })

  it("should handle whitelist substring matching", () => {
    const imgPath = "/static/images/external-favicons/subdomain_apple_com.png"
    const faviconCounts = new Map<string, number>()
    // Counts are stored without extensions (format-agnostic)
    faviconCounts.set(linkfavicons.normalizePathForCounting(imgPath), 0)

    const result = linkfavicons.shouldIncludeFavicon(imgPath, imgPath, faviconCounts)

    expect(result).toBe(true)
  })

  it("should handle countKey different from imgPath", () => {
    const imgPath = "/static/images/external-favicons/example_com.png"
    const countKey = "/static/images/external-favicons/example_com.png"
    const faviconCounts = new Map<string, number>()
    // Counts are stored without extensions (format-agnostic)
    faviconCounts.set(linkfavicons.normalizePathForCounting(countKey), minFaviconCount + 1)

    const result = linkfavicons.shouldIncludeFavicon(imgPath, countKey, faviconCounts)

    expect(result).toBe(true)
  })
})

describe("getQuartzPath edge cases", () => {
  it.each([
    ["www.www.example.com", "/static/images/external-favicons/example_com.png"],
    ["subdomain.turntrout.com", specialFaviconPaths.turntrout],
    ["www.turntrout.com", specialFaviconPaths.turntrout],
    ["example.co.uk", "/static/images/external-favicons/example_co_uk.png"],
    ["test.example.co.uk", "/static/images/external-favicons/example_co_uk.png"],
  ])("should handle %s correctly", (hostname, expectedPath) => {
    expect(linkfavicons.getQuartzPath(hostname)).toBe(expectedPath)
  })
})

describe("ModifyNode with asset links", () => {
  const faviconCounts = new Map<string, number>()

  beforeEach(() => {
    faviconCounts.clear()
    faviconCounts.set(specialFaviconPaths.turntrout, minFaviconCount + 1)
  })

  it.each([
    ["https://example.com/image.png"],
    ["https://example.com/video.mp4"],
    ["https://example.com/audio.mp3"],
    ["./local-image.jpg"],
    ["../parent/video.webm"],
  ])("should skip asset link %s", async (href) => {
    const node = h("a", { href })
    const parent = h("div", [node])

    await linkfavicons.ModifyNode(node, parent, faviconCounts)

    expect(node.children.length).toBe(0)
  })
})
