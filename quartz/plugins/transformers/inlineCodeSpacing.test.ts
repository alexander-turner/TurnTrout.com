import type { Element, Parent, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import {
  InlineCodeSpacing,
  lastTextChar,
  NO_GAP_PREDECESSORS,
  precedingBoundary,
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

describe("InlineCodeSpacing", () => {
  describe("joins the code to its preceding word with a gap", () => {
    it("wraps the word + code in a nowrap span and marks the code", async () => {
      const out = await processHtmlWithPlugin("<p>of <code>grep</code></p>")
      expect(out).toBe(
        '<p><span class="inline-code-nowrap">of <code class="inline-code-gap">grep</code></span></p>',
      )
    })

    it("leaves earlier text in place, joining only the trailing word", async () => {
      const out = await processHtmlWithPlugin("<p>help of <code>grep</code></p>")
      expect(out).toBe(
        '<p>help <span class="inline-code-nowrap">of <code class="inline-code-gap">grep</code></span></p>',
      )
    })

    it("marks the wrapping link and joins it, not the inner code", async () => {
      const out = await processHtmlWithPlugin('<p>help of <a href="#"><code>grep</code></a></p>')
      expect(out).toBe(
        '<p>help <span class="inline-code-nowrap">of <a href="#" class="inline-code-gap"><code>grep</code></a></span></p>',
      )
    })

    it("keeps the gap when glued behind non-hugging punctuation", async () => {
      const out = await processHtmlWithPlugin("<p>war—<code>grep</code></p>")
      expect(out).toBe(
        '<p><span class="inline-code-nowrap">war—<code class="inline-code-gap">grep</code></span></p>',
      )
    })

    it("handles several codes sharing a parent", async () => {
      const out = await processHtmlWithPlugin("<p>a <code>one</code> b <code>two</code></p>")
      expect(out).toBe(
        '<p><span class="inline-code-nowrap">a <code class="inline-code-gap">one</code></span> ' +
          '<span class="inline-code-nowrap">b <code class="inline-code-gap">two</code></span></p>',
      )
    })
  })

  describe("adds no gap", () => {
    it.each([...NO_GAP_PREDECESSORS])("when code is glued behind %s", async (char) => {
      const out = await processHtmlWithPlugin(`<p>${char}<code>grep</code></p>`)
      expect(out).not.toContain("inline-code-gap")
    })

    it.each([
      ["code at the start of a paragraph", "<p><code>grep</code> is a tool.</p>"],
      ["code at the start of a fragment", "<code>grep</code>"],
      ["glued opener inside a wrapping link", '<p>(<a href="#"><code>grep</code></a>)</p>'],
      ["no joinable word before the code", "<p><em>x</em><code>grep</code></p>"],
      ["only whitespace before the code", "<p><img> <code>grep</code></p>"],
    ])("for %s", async (_label, html) => {
      const out = await processHtmlWithPlugin(html)
      expect(out).not.toContain("inline-code-gap")
    })

    it.each([
      ["a comma separator between two codes", "<p><code>a</code>, <code>b</code></p>"],
      ["an em-dash separator between two codes", "<p><code>a</code>—<code>b</code></p>"],
    ])("for %s (no word to crowd the code)", async (_label, html) => {
      const out = await processHtmlWithPlugin(html)
      expect(out).not.toContain("inline-code-gap")
      expect(out).not.toContain("inline-code-nowrap")
    })

    it("ignores block code inside <pre>", async () => {
      const out = await processHtmlWithPlugin("<p>run </p><pre><code>grep</code></pre>")
      expect(out).not.toContain("inline-code-gap")
    })

    it("leaves non-code elements untouched", async () => {
      const out = await processHtmlWithPlugin("<p>run <em>grep</em></p>")
      expect(out).not.toContain("inline-code")
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
      expect(lastTextChar(h("em", ["(", h("img")]) as Element)).toBe("(")
    })

    it("returns null for an element with no text", () => {
      expect(lastTextChar(h("span", [h("img")]) as Element)).toBeNull()
    })

    it("returns null for a non-text, non-element node", () => {
      expect(lastTextChar({ type: "comment", value: "x" })).toBeNull()
    })
  })

  describe("precedingBoundary", () => {
    it("returns the preceding character and the unit index", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", ["of ", code]) as Parent
      expect(precedingBoundary(code, [paragraph])).toEqual({
        parent: paragraph,
        index: 1,
        char: " ",
      })
    })

    it("ascends out of inline wrappers, pointing at the wrapper", () => {
      const code = h("code", ["grep"]) as Element
      const link = h("a", [code]) as Element
      const paragraph = h("p", ["of ", link]) as Parent
      expect(precedingBoundary(code, [paragraph, link])).toEqual({
        parent: paragraph,
        index: 1,
        char: " ",
      })
    })

    it("skips a text-less preceding sibling to reach the delimiter", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", ["(", h("img"), code]) as Parent
      expect(precedingBoundary(code, [paragraph])?.char).toBe("(")
    })

    it("returns null at a block start (no preceding sibling)", () => {
      const code = h("code", ["grep"]) as Element
      const root = { type: "root", children: [code] } as Root
      expect(precedingBoundary(code, [root])).toBeNull()
    })

    it("stops at a block boundary instead of crossing into a prior block", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", [code]) as Parent
      const root = { type: "root", children: [h("p", ["earlier."]), paragraph] } as Root
      expect(precedingBoundary(code, [root, paragraph])).toBeNull()
    })

    it("returns null when every ancestor is inline and yields no predecessor", () => {
      const code = h("code", ["grep"]) as Element
      const wrapper = h("em", [code]) as Parent
      expect(precedingBoundary(code, [wrapper])).toBeNull()
    })
  })
})
