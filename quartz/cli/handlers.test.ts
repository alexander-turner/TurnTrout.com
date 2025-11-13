/**
 * @jest-environment node
 */
import type { CheerioAPI } from "cheerio"
import type { Element as CheerioElement } from "domhandler"

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals"
import { load as cheerioLoad } from "cheerio"

// Mock critical CSS generator before importing handlers
jest.mock("critical", () => {
  const generate = jest.fn(() => Promise.resolve({ css: "/* critical */" })) as unknown as jest.Mock
  return { generate }
})

// Mock puppeteer to prevent it from launching
jest.mock("puppeteer", () => ({
  launch: jest.fn(),
  default: {
    launch: jest.fn(),
  },
}))

import fs from "fs"
// skipcq: JS-W1028
import fsExtra, { ensureDir, remove } from "fs-extra"
import http from "http"
import os from "os"
import path from "path"

import { variables as styleVars } from "../styles/variables"
import {
  reorderHead,
  maybeGenerateCriticalCSS,
  injectCriticalCSSIntoHTMLFiles,
  resetCriticalCSSCache,
  checkPortAvailability,
} from "./handlers"

const loadOptions = {
  xml: false,
  decodeEntities: false,
  _useHtmlParser2: true,
}

describe("reorderHead", () => {
  // Helper functions
  const createHtml = (headContent: string): CheerioAPI =>
    cheerioLoad(`<!DOCTYPE html><html><head>${headContent}</head><body></html>`, loadOptions)

  const getTagNames = (querier: CheerioAPI): string[] =>
    querier("head")
      .children()
      .toArray()
      .map((el) => (el as CheerioElement).tagName)

  it("should place the scroll restoration script at the very top", () => {
    const querier = createHtml(`
      <script id="detect-initial-state">/* dark mode */</script>
      <meta charset="utf-8">
      <title>Test</title>
      <script>console.log('other')</script>
    `)
    const result = reorderHead(querier)
    const children = result("head").children()
    expect(children.first().attr("id")).toBe("detect-initial-state")
    expect(children.length).toBe(4)
  })

  it.each([
    {
      name: "all element types",
      input: `
        <script>console.log('other')</script>
        <meta charset="utf-8">
        <link rel="stylesheet" href="style.css">
        <style id="critical-css">.test{color:red}</style>
        <title>Test</title>
        <script id="detect-initial-state">/* initial state */</script>
      `,
      expectedOrder: ["script", "meta", "title", "style", "link", "script"], // initial state, meta, title, critical, link, other script
    },
    {
      name: "minimal elements",
      input: "<meta charset='utf-8'><title>Test</title>",
      expectedOrder: ["meta", "title"],
    },
    {
      name: "duplicate elements",
      input: `
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width">
        <link href="style1.css">
        <link href="style2.css">
      `,
      expectedOrder: ["meta", "meta", "link", "link"],
    },
  ])("should maintain element order: $name", ({ input, expectedOrder }) => {
    const querier = createHtml(input)
    const result = reorderHead(querier)
    expect(getTagNames(result)).toEqual(expectedOrder)
  })

  type EntityAssertion = { selector: string; attr?: string; expected: string }
  const entityAssertions: EntityAssertion[] = [
    {
      selector: 'meta[name="description"]',
      attr: "content",
      expected: "Test &amp; example &gt; other text",
    },
    { selector: "title", expected: "Test &amp; Title" },
    { selector: "script#detect-initial-state", expected: "if (x &lt; 5 &amp;&amp; y &gt; 3) {}" },
    { selector: "style#critical-css", expected: "/* test &amp; comment */" },
    { selector: 'link[rel="stylesheet"]', attr: "href", expected: "style.css?foo=1&amp;bar=2" },
  ]

  it.each(entityAssertions)(
    "should preserve HTML entities in $selector",
    ({ selector, attr, expected }) => {
      const initialQuerier = createHtml(`
        <meta name="description" content="Test &amp; example &gt; other text">
        <title>Test &amp; Title</title>
        <script id="detect-initial-state">if (x &lt; 5 &amp;&amp; y &gt; 3) {}</script>
        <style id="critical-css">/* test &amp; comment */</style>
        <link rel="stylesheet" href="style.css?foo=1&amp;bar=2">
      `)

      const querier = reorderHead(initialQuerier)
      const elementToTest = attr ? querier(selector).attr(attr) : querier(selector).html()
      expect(elementToTest).toBe(expected)
    },
  )

  it("should throw an error if an element is added to the head", () => {
    const querier = createHtml("<title>Test</title>")
    const isSubsetOfSpy = jest.spyOn(Set.prototype, "isSubsetOf").mockReturnValue(false)
    expect(() => reorderHead(querier)).toThrow("New elements were added to the head")
    isSubsetOfSpy.mockRestore()
  })

  it("should throw an error if an element is lost from the head", () => {
    const querier = createHtml("<title>Test</title><meta name='description'>")
    const isSupersetOfSpy = jest.spyOn(Set.prototype, "isSupersetOf").mockReturnValue(false)
    const differenceSpy = jest
      .spyOn(Set.prototype, "difference")
      .mockReturnValue(new Set([cheerioLoad("<meta name='lost-meta'>")("meta").get(0)]))
    expect(() => reorderHead(querier)).toThrow(
      /Head reordering changed number of elements: \d+ -> \d+. Specifically, the elements meta were lost./,
    )
    isSupersetOfSpy.mockRestore()
    differenceSpy.mockRestore()
  })
})

describe("maybeGenerateCriticalCSS variable replacement", () => {
  let outputDir: string

  beforeEach(async () => {
    // skipcq: JS-P1003
    outputDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "handlers-test-"))
    resetCriticalCSSCache()
  })

  afterEach(async () => {
    await remove(outputDir)
  })

  it("should replace SCSS variable placeholders with actual values in cached CSS", async () => {
    // Arrange mock variables
    Object.assign(styleVars, {
      baseMargin: "8px",
      pageWidth: 720,
    })

    const manualCriticalCss = "body{margin: $base-margin; color: $page-width;}"
    const criticalScssPath = path.resolve("quartz/styles/critical.scss")
    const htmlPath = path.join(outputDir, "index.html")
    // skipcq: JS-P1003
    await fsExtra.writeFile(htmlPath, "<!DOCTYPE html><html><head></head><body></body></html>")
    // skipcq: JS-P1003
    await fsExtra.writeFile(path.join(outputDir, "index.css"), "/* css */")
    const katexDir = path.join(outputDir, "static", "styles")
    await ensureDir(katexDir)
    // skipcq: JS-P1003
    await fsExtra.writeFile(path.join(katexDir, "katex.min.css"), "/* katex */")

    const realReadFile = fs.promises.readFile
    const readFileSpy = jest
      .spyOn(fs.promises, "readFile")
      .mockImplementation(async (fp, ...args) => {
        if (fp === criticalScssPath) {
          return manualCriticalCss
        }
        return realReadFile(fp, ...args)
      })

    const writeSpy = jest.spyOn(fs.promises, "writeFile").mockResolvedValue()

    // Act
    await maybeGenerateCriticalCSS(outputDir)
    try {
      await injectCriticalCSSIntoHTMLFiles([htmlPath], outputDir)
    } catch {
      // Catch inner error
    }

    // Assert
    const writtenHtml = writeSpy.mock.calls[0][1] as string
    expect(writtenHtml).toContain("margin: 8px")
    expect(writtenHtml).toContain("color: 720px")
    expect(writtenHtml).not.toContain("$base-margin")
    readFileSpy.mockRestore()
  }, 10000)
})

describe("checkPortAvailability", () => {
  let processExitSpy: jest.SpiedFunction<typeof process.exit>
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>
  let blockingServer: http.Server | null = null

  beforeEach(() => {
    processExitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never)
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(async () => {
    if (blockingServer) {
      await new Promise<void>((resolve) => {
        blockingServer!.close(() => resolve())
      })
      blockingServer = null
    }
    processExitSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    consoleLogSpy.mockRestore()
  })

  it("should proceed when port is available", async () => {
    const testPort = 9876

    await checkPortAvailability(testPort)

    expect(processExitSpy).not.toHaveBeenCalled()
  })

  it("should exit with error message when port is in use", async () => {
    const testPort = 9876

    blockingServer = http.createServer()
    await new Promise<void>((resolve) => {
      blockingServer!.listen(testPort, resolve)
    })

    await checkPortAvailability(testPort)

    expect(processExitSpy).toHaveBeenCalledWith(1)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Port ${testPort} is already in use`),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`lsof -ti:${testPort} | xargs kill`),
    )
  })
})
