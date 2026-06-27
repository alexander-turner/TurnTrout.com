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

const MARKER = '<span class="inline-code-gap" aria-hidden="true"></span>'

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
  describe("inserts a leading gap marker", () => {
    it("places the marker immediately before code preceded by a word", async () => {
      const out = await processHtmlWithPlugin("<p>of <code>grep</code></p>")
      expect(out).toContain(`${MARKER}<code>grep</code>`)
    })

    it("places the marker before the wrapping link, not inside it", async () => {
      const out = await processHtmlWithPlugin('<p>help of <a href="#"><code>grep</code></a></p>')
      expect(out).toContain(`${MARKER}<a href="#"><code>grep</code></a>`)
    })

    it("marks every gapped code when several share a parent", async () => {
      const out = await processHtmlWithPlugin("<p>a <code>one</code> b <code>two</code></p>")
      expect(out).toBe(`<p>a ${MARKER}<code>one</code> b ${MARKER}<code>two</code></p>`)
    })
  })

  describe("inserts no marker", () => {
    it.each([...NO_GAP_PREDECESSORS])("when code is glued behind %s", async (char) => {
      const out = await processHtmlWithPlugin(`<p>${char}<code>grep</code></p>`)
      expect(out).not.toContain("inline-code-gap")
    })

    it.each([
      ["code at the start of a paragraph", "<p><code>grep</code> is a tool.</p>"],
      ["code at the start of a fragment", "<code>grep</code>"],
      ["glued opener inside a wrapping link", '<p>(<a href="#"><code>grep</code></a>)</p>'],
    ])("for %s", async (_label, html) => {
      const out = await processHtmlWithPlugin(html)
      expect(out).not.toContain("inline-code-gap")
    })

    it("ignores block code inside <pre>", async () => {
      const out = await processHtmlWithPlugin("<p>run </p><pre><code>grep</code></pre>")
      expect(out).not.toContain("inline-code-gap")
    })

    it("leaves non-code elements untouched", async () => {
      const out = await processHtmlWithPlugin("<p>run <em>grep</em></p>")
      expect(out).not.toContain("inline-code-gap")
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
    it("returns the preceding character and insertion point", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", ["of ", code]) as Parent
      expect(precedingBoundary(code, [paragraph])).toEqual({
        parent: paragraph,
        index: 1,
        char: " ",
      })
    })

    it("ascends out of inline wrappers, pointing before the wrapper", () => {
      const code = h("code", ["grep"]) as Element
      const link = h("a", [code]) as Element
      const paragraph = h("p", ["of ", link]) as Parent
      const boundary = precedingBoundary(code, [paragraph, link])
      expect(boundary).toEqual({ parent: paragraph, index: 1, char: " " })
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
