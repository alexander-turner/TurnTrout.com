/**
 * @jest-environment node
 */
import type { Element } from "hast"

import { jest, expect, it, describe, beforeAll, beforeEach, afterEach } from "@jest/globals"
import fsExtra from "fs-extra"
import { h } from "hastscript"
import os from "os"
import path from "path"
import { PassThrough } from "stream"

// skipcq: JS-C1003
import * as linkfavicons from "./linkfavicons"

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
  tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "linkfavicons-test-"))
  jest.resetAllMocks()
  jest.restoreAllMocks()
  linkfavicons.urlCache.clear()
})

afterEach(async () => {
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
  extraStyles?: string,
  extraMarginLeft?: boolean,
): Record<string, unknown> => ({
  type: "element",
  tagName: "span",
  properties: { className: "favicon-span" },
  children: [
    { type: "text", value: text },
    {
      ...linkfavicons.createFaviconElement(imgPath),
      properties: {
        class: `favicon${extraMarginLeft ? " close-text" : ""}`,
      },
    },
  ],
})

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

  describe("linkfavicons.CreateFaviconElement", () => {
    it.each([
      ["/path/to/favicon.png", "Test Description"],
      ["/another/favicon.jpg", "Another Description"],
    ])("should create a favicon element with correct attributes", (urlString, description) => {
      const element = linkfavicons.createFaviconElement(urlString, description)
      expect(element).toEqual({
        type: "element",
        tagName: "img",
        children: [],
        properties: {
          src: urlString,
          class: "favicon",
          alt: description,
        },
      })
    })
  })

  describe("linkfavicons.insertFavicon", () => {
    it.each([
      [null, false],
      ["/valid/path.png", true],
    ])("should insert favicon correctly when imgPath is %s", (imgPath, shouldInsert) => {
      const node = { children: [], type: "element", tagName: "div", properties: {} } as Element
      linkfavicons.insertFavicon(imgPath, node)
      expect(node.children.length).toBe(shouldInsert ? 1 : 0)
    })

    describe("span creation", () => {
      const imgPath = "/test/favicon.png"

      it(`should create a span with the last ${linkfavicons.maxCharsToRead} characters and favicon for long text`, () => {
        const text = "Long text content"
        const node = h("div", {}, [text])
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        const firstSegment = text.slice(0, -linkfavicons.maxCharsToRead)
        expect(node.children[0]).toEqual({ type: "text", value: firstSegment })

        const lastSegment = text.slice(-linkfavicons.maxCharsToRead)
        expect(node.children[1]).toMatchObject(createExpectedSpan(lastSegment, imgPath))
      })

      it("should create a span with all characters and favicon for short text", () => {
        const text = "1234"
        const node = h("div", {}, [text])
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(1)
        expect(node.children[0]).toMatchObject(createExpectedSpan(text, imgPath))
      })

      it(`should create a span with up to ${linkfavicons.maxCharsToRead} characters for medium-length text`, () => {
        const text = "Medium"
        const node = h("div", {}, [text])
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        const firstSegment = text.slice(0, -linkfavicons.maxCharsToRead)
        expect(node.children[0]).toEqual({ type: "text", value: firstSegment })
        const secondSegment = text.slice(-linkfavicons.maxCharsToRead)
        expect(node.children[1]).toMatchObject(createExpectedSpan(secondSegment, imgPath))
      })

      it("should not create a span for nodes without text content", () => {
        const node = h("div", {}, [h("div")])
        linkfavicons.insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        expect(node.children[1]).toEqual(linkfavicons.createFaviconElement(imgPath))
      })

      it("should handle empty text nodes correctly", () => {
        const node = h("div", {}, [""])
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
          expect(node.children[1]).toMatchObject(
            createExpectedSpan(lastSegment, imgPath, undefined, true),
          )
        },
      )

      it("should not replace children with span if more than one child", () => {
        const node = h("p", {}, [
          "My email is ",
          h(
            "a",
            {
              href: "https://mailto:throwaway@turntrout.com",
              class: "external",
            },
            [h("code", {}, ["throwaway@turntrout.com"])],
          ),
          ".",
        ])

        linkfavicons.insertFavicon(linkfavicons.MAIL_PATH, node)

        expect(node.children.length).toBe(3)
        const lastChild = node.children[node.children.length - 1]
        expect(lastChild).toMatchObject(createExpectedSpan(".", linkfavicons.MAIL_PATH))
      })
    })
  })

  describe("linkfavicons.ModifyNode", () => {
    it.each([
      ["./shard-theory", linkfavicons.TURNTROUT_FAVICON_PATH],
      ["../shard-theory", linkfavicons.TURNTROUT_FAVICON_PATH],
      ["#test", linkfavicons.ANCHOR_PATH],
      ["mailto:test@example.com", linkfavicons.MAIL_PATH],
      ["mailto:another@domain.org", linkfavicons.MAIL_PATH],
    ])("should insert favicon for %s", async (href, expectedPath) => {
      const node = h("a", { href }, [])
      const parent = h("div", {}, [node])

      await linkfavicons.ModifyNode(node, parent)
      expect(node.children[0]).toHaveProperty("properties.src", expectedPath)
    })

    it("should skip footnote links", async () => {
      const node = h("a", { href: "#user-content-fn-1" }, [])
      const parent = h("div", {}, [node])

      await linkfavicons.ModifyNode(node, parent)
      expect(node.children.length).toBe(0)
    })

    it("should skip links inside headings", async () => {
      const node = h("a", { href: "#section-1" }, [])
      const parent = h("h2", {}, [node])

      await linkfavicons.ModifyNode(node, parent)
      expect(node.children.length).toBe(0)
    })

    it("should add same-page-link class and anchor icon for internal links", async () => {
      const node = h("a", { href: "#section-1" }, [])
      const parent = h("p", {}, [node])

      await linkfavicons.ModifyNode(node, parent)

      // Check if class was added
      expect(node.properties.className).toContain("same-page-link")

      // Check if anchor icon was added
      expect(node.children.length).toBe(1)
      expect(node.children[0]).toHaveProperty("properties.src", linkfavicons.ANCHOR_PATH)
    })

    it("should handle existing className array for internal links", async () => {
      const node = h("a", { href: "#section-1", className: ["existing-class"] }, [])
      const parent = h("p", {}, [node])

      await linkfavicons.ModifyNode(node, parent)

      expect(Array.isArray(node.properties.className)).toBe(true)
      expect(node.properties.className).toContain("existing-class")
      expect(node.properties.className).toContain("same-page-link")
    })

    it("should handle existing className string for internal links", async () => {
      const node = h("a", { href: "#section-1", className: "existing-class" }, [])
      const parent = h("p", {}, [node])

      await linkfavicons.ModifyNode(node, parent)

      expect(Array.isArray(node.properties.className)).toBe(true)
      expect(node.properties.className).toContain("existing-class")
      expect(node.properties.className).toContain("same-page-link")
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
      jest.spyOn(fs, "createWriteStream").mockReturnValue(fsExtra.createWriteStream(imagePath))
    }

    if (expectedResult) {
      await expect(linkfavicons.downloadImage(url, imagePath)).resolves.not.toThrow()
    } else {
      await expect(linkfavicons.downloadImage(url, imagePath)).rejects.toThrow()
    }

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(url)

    if (expectedFileContent !== undefined) {
      const fileExists = await fsExtra.pathExists(imagePath)
      expect(fileExists).toBe(true)
      if (fileExists) {
        const content = await fsExtra.readFile(imagePath, "utf-8")
        expect(content).toBe(expectedFileContent)
      }
    } else {
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

  // runTest has expect assertions
  // eslint-disable-next-line jest/expect-expect
  it("should throw if fetch response is not ok", async () => {
    const mockResponse = new Response("Mock image content", {
      status: 404,
      headers: { "Content-Type": "image/png" },
    })
    await runTest(mockResponse, false)
  })

  // eslint-disable-next-line jest/expect-expect
  it("should throw if fetch response has no body", async () => {
    const mockResponse = new Response(null, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    })
    await runTest(mockResponse, false)
  })

  // eslint-disable-next-line jest/expect-expect
  it("should throw if header is wrong", async () => {
    const mockResponse = new Response("Fake", { status: 200, headers: { "Content-Type": "txt" } })
    await runTest(mockResponse, false)
  })

  // eslint-disable-next-line jest/expect-expect
  it("should handle fetch errors", async () => {
    const mockError = new Error("Network error")
    await runTest(mockError, false)
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

    const fileExists = await fsExtra.pathExists(imagePath)
    expect(fileExists).toBe(true)

    const content = await fsExtra.readFile(imagePath, "utf-8")
    expect(content).toBe(mockContent)

    // Check if the directory structure was created
    const dirStructure = path.dirname(imagePath)
    const dirExists = await fsExtra.pathExists(dirStructure)
    expect(dirExists).toBe(true)
  })
})

describe("writeCacheToFile", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    linkfavicons.urlCache.clear()
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)
  })

  it("should write the linkfavicons.urlCache to file", () => {
    linkfavicons.urlCache.set("example.com", "https://example.com/favicon.ico")
    linkfavicons.urlCache.set("test.com", "https://test.com/favicon.png")

    linkfavicons.writeCacheToFile()

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      linkfavicons.FAVICON_URLS_FILE,
      "example.com,https://example.com/favicon.ico\ntest.com,https://test.com/favicon.png",
      { flag: "w+" },
    )
  })

  it("should write an empty string if linkfavicons.urlCache is empty", () => {
    linkfavicons.writeCacheToFile()

    expect(fs.writeFileSync).toHaveBeenCalledWith(linkfavicons.FAVICON_URLS_FILE, "", {
      flag: "w+",
    })
  })
})

describe("linkfavicons.readFaviconUrls", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("should read favicon URLs from file and return a Map", async () => {
    const mockFileContent =
      "example.com,https://example.com/favicon.ico\ntest.com,https://test.com/favicon.png"
    jest.spyOn(fs.promises, "readFile").mockResolvedValue(mockFileContent)

    const result = await linkfavicons.readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(2)
    expect(result.get("example.com")).toBe("https://example.com/favicon.ico")
    expect(result.get("test.com")).toBe("https://test.com/favicon.png")
  })

  it("should return an empty Map if the file is empty", async () => {
    jest.spyOn(fs.promises, "readFile").mockResolvedValue("")

    const result = await linkfavicons.readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it("should handle file read errors and return an empty Map", async () => {
    // Mock console.warn to capture the warning without displaying it
    const mockError = new Error("File read error")
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    jest.spyOn(fs.promises, "readFile").mockRejectedValue(mockError)

    const result = await linkfavicons.readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
    expect(consoleWarnSpy).toHaveBeenCalledWith(mockError)
  })

  it("should ignore invalid lines in the file", async () => {
    const mockFileContent =
      "example.com,https://example.com/favicon.ico\ninvalid_line\ntest.com,https://test.com/favicon.png"
    jest.spyOn(fs.promises, "readFile").mockResolvedValue(mockFileContent)

    const result = await linkfavicons.readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(2)
    expect(result.get("example.com")).toBe("https://example.com/favicon.ico")
    expect(result.get("test.com")).toBe("https://test.com/favicon.png")
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
