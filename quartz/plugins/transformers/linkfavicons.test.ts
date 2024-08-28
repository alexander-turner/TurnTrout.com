import { jest } from "@jest/globals"
import { PassThrough } from "stream"

import fsExtra from "fs-extra"
import path from "path"
import os from "os"

import {
  GetQuartzPath,
  MaybeSaveFavicon,
  CreateFaviconElement,
  ModifyNode,
  MAIL_PATH,
  DownloadError,
  downloadImage,
  TURNTROUT_FAVICON_PATH,
  urlCache,
  insertFavicon,
  readFaviconUrls,
  writeCacheToFile,
  FAVICON_URLS_FILE,
} from "./linkfavicons"

jest.mock("fs")
import fs from "fs"

jest.mock("stream/promises")

beforeAll(async () => {
  jest.spyOn(fs, "createWriteStream").mockReturnValue(new PassThrough() as any)
})

let tempDir: string
beforeEach(async () => {
  tempDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "linkfavicons-test-"))
  jest.resetAllMocks()
  jest.restoreAllMocks()
  urlCache.clear()
})

afterEach(async () => {
  await fsExtra.remove(tempDir)
})

jest.mock("./linkfavicons", () => {
  const actual = jest.requireActual("./linkfavicons")
  return {
    ...(actual as any),
    urlCache: new Map(),
  }
})

describe("Favicon Utilities", () => {
  describe("MaybeSaveFavicon", () => {
    const hostname = "example.com"
    const avifUrl = "https://assets.turntrout.com/static/images/external-favicons/example_com.avif"

    const mockFetchAndFs = (
      avifStatus: number,
      localPngExists: boolean,
      googleStatus: number = 200,
    ) => {
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
            : Promise.reject({ code: "ENOENT" }),
        )
        .mockImplementationOnce(() => Promise.resolve({ size: 1000 } as fs.Stats))
    }

    it.each<[string, number, boolean, string | null, number?]>([
      ["AVIF exists", 200, false, avifUrl],
    ])("%s", async (_, avifStatus, localPngExists, expected, googleStatus = 200) => {
      mockFetchAndFs(avifStatus, localPngExists, googleStatus)
      expect(await MaybeSaveFavicon(hostname)).toBe(expected)
    })

    it("All attempts fail", async () => {
      mockFetchAndFs(404, false, 404)
      await expect(MaybeSaveFavicon(hostname)).rejects.toThrow(DownloadError)
    })

    it.each<[string, number, boolean]>([
      ["Local PNG exists", 404, true],
      ["Download PNG from Google", 404, false],
    ])("%s", async (_, avifStatus, localPngExists) => {
      const expected = GetQuartzPath(hostname)
      mockFetchAndFs(avifStatus, localPngExists)
      expect(await MaybeSaveFavicon(hostname)).toBe(expected)
    })
  })

  describe("GetQuartzPath", () => {
    it.each([
      ["www.example.com", "/static/images/external-favicons/example_com.png"],
      ["localhost", TURNTROUT_FAVICON_PATH],
      ["turntrout.com", TURNTROUT_FAVICON_PATH],
      ["https://turntrout.com", TURNTROUT_FAVICON_PATH],
      ["subdomain.example.org", "/static/images/external-favicons/subdomain_example_org.png"],
    ])("should return the correct favicon path for %s", (hostname, expectedPath) => {
      expect(GetQuartzPath(hostname)).toBe(expectedPath)
    })
  })

  describe("CreateFaviconElement", () => {
    it.each([
      ["/path/to/favicon.png", "Test Description"],
      ["/another/favicon.jpg", "Another Description"],
    ])("should create a favicon element with correct attributes", (urlString, description) => {
      const element = CreateFaviconElement(urlString, description)
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

  describe("insertFavicon", () => {
    it.each([
      [null, false],
      ["/valid/path.png", true],
    ])("should insert favicon correctly when imgPath is %s", (imgPath, shouldInsert) => {
      const node = { children: [] }
      insertFavicon(imgPath, node)
      expect(node.children.length).toBe(shouldInsert ? 1 : 0)
    })

    describe("span creation", () => {
      const imgPath = "/test/favicon.png"

      it("should create a span with the last 4 characters and favicon for long text", () => {
        const node = { children: [{ type: "text", value: "Long text content" }] }
        insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        expect(node.children[0]).toEqual({ type: "text", value: "Long text con" })
        expect(node.children[1]).toMatchObject({
          type: "element",
          tagName: "span",
          properties: { style: "white-space: nowrap;" },
          children: [{ type: "text", value: "tent" }, CreateFaviconElement(imgPath)],
        })
      })

      it("should create a span with all characters and favicon for short text", () => {
        const node = { children: [{ type: "text", value: "1234" }] }
        insertFavicon(imgPath, node)

        expect(node.children.length).toBe(1)
        expect(node.children[0]).toMatchObject({
          type: "element",
          tagName: "span",
          properties: { style: "white-space: nowrap;" },
          children: [{ type: "text", value: "1234" }, CreateFaviconElement(imgPath)],
        })
      })

      it("should create a span with up to 4 characters for medium-length text", () => {
        const node = { children: [{ type: "text", value: "Medium" }] }
        insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        expect(node.children[0]).toEqual({ type: "text", value: "Me" })
        expect(node.children[1]).toMatchObject({
          type: "element",
          tagName: "span",
          properties: { style: "white-space: nowrap;" },
          children: [{ type: "text", value: "dium" }, CreateFaviconElement(imgPath)],
        })
      })

      it("should not create a span for nodes without text content", () => {
        const node = { children: [{ type: "element", tagName: "div" }] }
        insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        expect(node.children[1]).toMatchObject(CreateFaviconElement(imgPath))
      })

      it("should handle empty text nodes correctly", () => {
        const node = { children: [{ type: "text", value: "" }] }
        insertFavicon(imgPath, node)

        expect(node.children.length).toBe(2)
        expect(node.children[1]).toMatchObject(CreateFaviconElement(imgPath))
      })

      it("Should not replace children with [span] if more than one child", () => {
        const node = {
          tag: "p",
          children: [
            "My email is ",
            {
              tag: "a",
              attributes: {
                href: "https://mailto:throwaway@turntrout.com",
                class: "external",
              },
              children: [
                {
                  tag: "code",
                  children: ["throwaway@turntrout.com"],
                },
              ],
            },
            ".",
          ],
        }

        insertFavicon(MAIL_PATH, node)

        expect(node.children.length).toBe(4)
        expect(node.children[3]).toMatchObject(CreateFaviconElement(MAIL_PATH))
      })
    })
  })

  describe("ModifyNode", () => {
    it.each([
      ["./shard-theory", TURNTROUT_FAVICON_PATH],
      ["../shard-theory", null],
      ["#test", null],
      ["mailto:test@example.com", MAIL_PATH],
      ["mailto:another@domain.org", MAIL_PATH],
    ])("should insert favicon for %s", async (href, expectedPath) => {
      const node = {
        tagName: "a",
        properties: { href },
        children: [],
      }

      await ModifyNode(node)
      if (expectedPath === null) {
        expect(node.children.length).toBe(0)
      } else {
        expect(node.children[0]).toHaveProperty("properties.src", expectedPath)
      }
    })
  })
})

describe("downloadImage", () => {
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
      await expect(downloadImage(url, imagePath)).resolves.not.toThrow()
    } else {
      await expect(downloadImage(url, imagePath)).rejects.toThrow()
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

  it("should download image successfully", async () => {
    const mockContent = "Mock image content"
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    })
    await runTest(mockResponse, true, mockContent)
  })

  it("should throw if fetch response is not ok", async () => {
    const mockResponse = new Response("Mock image content", {
      status: 404,
      headers: { "Content-Type": "image/png" },
    })
    await runTest(mockResponse, false)
  })

  it("should throw if fetch response has no body", async () => {
    const mockResponse = new Response("", { status: 200, headers: { "Content-Type": "image/png" } })
    await runTest(mockResponse, false)
  })

  it("should throw if header is wrong", async () => {
    const mockResponse = new Response("Fake", { status: 200, headers: { "Content-Type": "txt" } })
    await runTest(mockResponse, false)
  })

  it("should handle fetch errors", async () => {
    const mockError = new Error("Network error")
    await runTest(mockError, false)
  })
})

describe("writeCacheToFile", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    urlCache.clear()
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {})
  })

  it("should write the urlCache to file", () => {
    urlCache.set("example.com", "https://example.com/favicon.ico")
    urlCache.set("test.com", "https://test.com/favicon.png")

    writeCacheToFile()

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      FAVICON_URLS_FILE,
      "example.com,https://example.com/favicon.ico\ntest.com,https://test.com/favicon.png",
      { flag: "w+" },
    )
  })

  it("should write an empty string if urlCache is empty", () => {
    writeCacheToFile()

    expect(fs.writeFileSync).toHaveBeenCalledWith(FAVICON_URLS_FILE, "", { flag: "w+" })
  })
})

describe("readFaviconUrls", () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it("should read favicon URLs from file and return a Map", async () => {
    const mockFileContent =
      "example.com,https://example.com/favicon.ico\ntest.com,https://test.com/favicon.png"
    jest.spyOn(fs.promises, "readFile").mockResolvedValue(mockFileContent)

    const result = await readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(2)
    expect(result.get("example.com")).toBe("https://example.com/favicon.ico")
    expect(result.get("test.com")).toBe("https://test.com/favicon.png")
  })

  it("should return an empty Map if the file is empty", async () => {
    jest.spyOn(fs.promises, "readFile").mockResolvedValue("")

    const result = await readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it("should handle file read errors and return an empty Map", async () => {
    jest.spyOn(fs.promises, "readFile").mockRejectedValue(new Error("File read error"))

    const result = await readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  it("should ignore invalid lines in the file", async () => {
    const mockFileContent =
      "example.com,https://example.com/favicon.ico\ninvalid_line\ntest.com,https://test.com/favicon.png"
    jest.spyOn(fs.promises, "readFile").mockResolvedValue(mockFileContent)

    const result = await readFaviconUrls()

    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(2)
    expect(result.get("example.com")).toBe("https://example.com/favicon.ico")
    expect(result.get("test.com")).toBe("https://test.com/favicon.png")
  })

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
      await expect(downloadImage(url, imagePath)).resolves.not.toThrow()
    } else {
      await expect(downloadImage(url, imagePath)).rejects.toThrow()
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

  it("should download image successfully", async () => {
    const mockContent = "Mock image content"
    const mockResponse = new Response(mockContent, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    })
    await runTest(mockResponse, true, mockContent)
  })

  it("should throw if fetch response is not ok", async () => {
    const mockResponse = new Response("Mock image content", {
      status: 404,
      headers: { "Content-Type": "image/png" },
    })
    await runTest(mockResponse, false)
  })

  it("should throw if fetch response has no body", async () => {
    const mockResponse = new Response("", { status: 200, headers: { "Content-Type": "image/png" } })
    await runTest(mockResponse, false)
  })

  it("should throw if header is wrong", async () => {
    const mockResponse = new Response("Fake", { status: 200, headers: { "Content-Type": "txt" } })
    await runTest(mockResponse, false)
  })

  it("should handle fetch errors", async () => {
    const mockError = new Error("Network error")
    await runTest(mockError, false)
  })
})
