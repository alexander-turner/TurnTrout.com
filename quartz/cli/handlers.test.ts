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

import fs from "fs"
import fsExtra from "fs-extra"
import os from "os"
import path from "path"

import { variables as styleVars } from "../styles/variables"
import { reorderHead, maybeGenerateCriticalCSS, injectCriticalCSSIntoHTMLFiles } from "./handlers"

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

  it.each([
    {
      name: "all element types",
      input: `
        <script>console.log('other')</script>
        <meta charset="utf-8">
        <link rel="stylesheet" href="style.css">
        <style id="critical-css">.test{color:red}</style>
        <title>Test</title>
        <script id="detect-dark-mode">/* dark mode */</script>
      `,
      expectedOrder: ["script", "meta", "title", "style", "link", "script"], // dark mode, meta, title, critical, link, other script
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
    { selector: "script#detect-dark-mode", expected: "if (x &lt; 5 &amp;&amp; y &gt; 3) {}" },
    { selector: "style#critical-css", expected: "/* test &amp; comment */" },
    { selector: 'link[rel="stylesheet"]', attr: "href", expected: "style.css?foo=1&amp;bar=2" },
  ]

  it.each(entityAssertions)(
    "should preserve HTML entities in $selector",
    ({ selector, attr, expected }) => {
      const querier = createHtml(`
        <meta name="description" content="Test &amp; example &gt; other text">
        <title>Test &amp; Title</title>
        <script id="detect-dark-mode">if (x &lt; 5 &amp;&amp; y &gt; 3) {}</script>
        <style id="critical-css">/* test &amp; comment */</style>
        <link rel="stylesheet" href="style.css?foo=1&amp;bar=2">
      `)

      const $ = reorderHead(querier)
      const elementToTest = attr ? $(selector).attr(attr) : $(selector).html()
      expect(elementToTest).toBe(expected)
    },
  )
})

describe("maybeGenerateCriticalCSS variable replacement", () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "handlers-test-"))
  })

  afterEach(async () => {
    await fsExtra.remove(outputDir)
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
    await fsExtra.writeFile(htmlPath, "<!DOCTYPE html><html><head></head><body></body></html>")
    await fsExtra.writeFile(path.join(outputDir, "index.css"), "/* css */")
    const katexDir = path.join(outputDir, "static", "styles")
    await fsExtra.ensureDir(katexDir)
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
    await injectCriticalCSSIntoHTMLFiles([htmlPath], outputDir)

    // Assert
    const writtenHtml = writeSpy.mock.calls[0][1] as string
    expect(writtenHtml).toContain("margin: 8px")
    expect(writtenHtml).toContain("color: 720px")
    expect(writtenHtml).not.toContain("$base-margin")
    readFileSpy.mockRestore()
  })
})
