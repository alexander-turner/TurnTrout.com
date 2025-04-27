/**
 * @jest-environment node
 */
import type { CheerioAPI } from "cheerio"
import type { Element as CheerioElement } from "domhandler"

import { describe, it, expect } from "@jest/globals"
import { load as cheerioLoad } from "cheerio"

import { reorderHead } from "./handlers"

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
