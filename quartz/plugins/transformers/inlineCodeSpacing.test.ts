import type { Element, Parent, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import {
  FLUSH_LEFT_PREDECESSORS,
  InlineCodeSpacing,
  lastTextChar,
  precedingChar,
} from "./inlineCodeSpacing"

const processHtmlWithPlugin = async (html: string): Promise<string> => {
  const plugin = InlineCodeSpacing()
  const htmlPlugins = plugin.htmlPlugins?.({} as never)
  if (!htmlPlugins || htmlPlugins.length === 0) {
    throw new Error("No HTML plugin returned")
  }
  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(htmlPlugins)
    .use(rehypeStringify)
  return String(await processor.process(html))
}

const isFlush = (html: string): Promise<boolean> =>
  processHtmlWithPlugin(html).then((out) => out.includes('class="flush-left"'))

describe("InlineCodeSpacing", () => {
  describe("flushes code glued to a hugging predecessor", () => {
    it.each([...FLUSH_LEFT_PREDECESSORS])("adds flush-left after %s", async (char) => {
      expect(await isFlush(`<p>${char}<code>grep</code></p>`)).toBe(true)
    })

    it("flushes code glued to an opener even inside a wrapping link", async () => {
      expect(await isFlush('<p>(<a href="#"><code>grep</code></a>)</p>')).toBe(true)
    })

    it("flushes when the predecessor delimiter is nested in an inline element", async () => {
      expect(await isFlush("<p><em>(</em><code>grep</code></p>")).toBe(true)
    })
  })

  describe("leaves the default margin in place", () => {
    it.each([
      ["word + space", "<p>of <code>grep</code></p>"],
      ["em dash", "<p>war—<code>grep</code></p>"],
      ["period", "<p>end.<code>grep</code></p>"],
      ["code inside a link after a space", '<p>help of <a href="#"><code>grep</code></a></p>'],
      ["code at the start of a paragraph", "<p><code>grep</code> is a tool.</p>"],
      ["code at the start of a fragment", "<code>grep</code>"],
    ])("no flush-left for %s", async (_label, html) => {
      expect(await isFlush(html)).toBe(false)
    })

    it("ignores block code inside <pre>", async () => {
      expect(await isFlush("<p>(</p><pre><code>grep</code></pre>")).toBe(false)
    })

    it("leaves non-code elements untouched", async () => {
      const out = await processHtmlWithPlugin("<p>(<em>grep</em>)</p>")
      expect(out).not.toContain("flush-left")
    })
  })

  describe("lastTextChar", () => {
    it("returns the final character of a text node", () => {
      expect(lastTextChar({ type: "text", value: "abc" })).toBe("c")
    })

    it("returns null for an empty text node", () => {
      expect(lastTextChar({ type: "text", value: "" })).toBeNull()
    })

    it("recurses into element children, skipping empty trailing nodes", () => {
      // Trailing <img> contributes no text, so the "(" from the earlier child wins.
      const node = h("em", ["(", h("img")]) as Element
      expect(lastTextChar(node)).toBe("(")
    })

    it("returns null for an element with no text", () => {
      expect(lastTextChar(h("span", [h("img")]) as Element)).toBeNull()
    })

    it("returns null for a non-text, non-element node", () => {
      expect(lastTextChar({ type: "comment", value: "x" })).toBeNull()
    })
  })

  describe("precedingChar", () => {
    it("returns null when the code is the only child of a block root", () => {
      const code = h("code", ["grep"]) as Element
      const root = { type: "root", children: [code] } as Root
      expect(precedingChar(code, [root])).toBeNull()
    })

    it("ascends out of inline wrappers to find the preceding character", () => {
      const code = h("code", ["grep"]) as Element
      const link = h("a", [code]) as Element
      const paragraph = h("p", ["of ", link]) as Parent
      expect(precedingChar(code, [paragraph, link])).toBe(" ")
    })

    it("stops at a block boundary instead of crossing into a prior block", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", [code]) as Parent
      const root = { type: "root", children: [h("p", ["earlier."]), paragraph] } as Root
      expect(precedingChar(code, [root, paragraph])).toBeNull()
    })

    it("skips a text-less preceding sibling to reach the delimiter", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", ["(", h("img"), code]) as Parent
      expect(precedingChar(code, [paragraph])).toBe("(")
    })

    it("returns null when every ancestor is inline and yields no predecessor", () => {
      const code = h("code", ["grep"]) as Element
      const wrapper = h("em", [code]) as Parent
      expect(precedingChar(code, [wrapper])).toBeNull()
    })
  })
})
