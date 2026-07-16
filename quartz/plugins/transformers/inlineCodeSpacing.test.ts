import type { Element, Parent, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import { HAIR_SPACE, SIX_PER_EM_SPACE } from "../../components/constants"
import {
  followingTextNode,
  InlineCodeSpacing,
  lastTextChar,
  NO_GAP_PREDECESSORS,
  precedingBoundary,
  textLength,
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
  describe("gives the preceding word a gap", () => {
    it("appends a hair space to the trailing word, leaving the code in place", async () => {
      const out = await processHtmlWithPlugin("<p>of <code>grep</code></p>")
      expect(out).toBe(`<p>of${HAIR_SPACE} <code class="inline-code-atomic">grep</code></p>`)
    })

    it("leaves earlier text in place, gapping only the trailing word", async () => {
      const out = await processHtmlWithPlugin("<p>help of <code>grep</code></p>")
      expect(out).toBe(`<p>help of${HAIR_SPACE} <code class="inline-code-atomic">grep</code></p>`)
    })

    it("gaps the word before a wrapping link, not the link or its code", async () => {
      const out = await processHtmlWithPlugin('<p>help of <a href="#"><code>grep</code></a></p>')
      expect(out).toBe(
        `<p>help of${HAIR_SPACE} <a href="#"><code class="inline-code-atomic">grep</code></a></p>`,
      )
    })

    it("keeps the gap when the code abuts non-hugging punctuation", async () => {
      const out = await processHtmlWithPlugin("<p>war—<code>grep</code></p>")
      expect(out).toBe(`<p>war—${HAIR_SPACE}<code class="inline-code-atomic">grep</code></p>`)
    })

    it("handles several codes sharing a parent", async () => {
      const out = await processHtmlWithPlugin("<p>a <code>one</code> b <code>two</code></p>")
      expect(out).toBe(
        `<p>a${HAIR_SPACE} <code class="inline-code-atomic">one</code>${SIX_PER_EM_SPACE}` +
          `b${HAIR_SPACE} <code class="inline-code-atomic">two</code></p>`,
      )
    })
  })

  describe("narrows the space following the code", () => {
    it("swaps the following ordinary space for a six-per-em space", async () => {
      const out = await processHtmlWithPlugin("<p>the <code>fortune</code> command,</p>")
      expect(out).toBe(
        `<p>the${HAIR_SPACE} <code class="inline-code-atomic">fortune</code>` +
          `${SIX_PER_EM_SPACE}command,</p>`,
      )
    })

    it("narrows the space between the code and an opening parenthesis", async () => {
      const out = await processHtmlWithPlugin("<p>into <code>goosesay</code> (my variant)</p>")
      expect(out).toContain(`</code>${SIX_PER_EM_SPACE}(my variant)`)
    })

    it("ascends out of a wrapping link to narrow the space after it", async () => {
      const out = await processHtmlWithPlugin('<p>see <a href="#"><code>grep</code></a> docs</p>')
      expect(out).toContain(`</a>${SIX_PER_EM_SPACE}docs`)
    })

    it("narrows the space even when the code got no leading gap", async () => {
      const out = await processHtmlWithPlugin("<p><code>grep</code> is a tool.</p>")
      expect(out).toContain(`</code>${SIX_PER_EM_SPACE}is a tool.`)
    })

    it("collapses a multi-space run so no stray space re-widens the gap", async () => {
      const out = await processHtmlWithPlugin("<p>the <code>fortune</code>   command</p>")
      expect(out).toContain(`</code>${SIX_PER_EM_SPACE}command`)
      expect(out).not.toContain(`${SIX_PER_EM_SPACE} `)
    })

    it("collapses a leading source-wrap newline after the code", async () => {
      const out = await processHtmlWithPlugin("<p>the <code>fortune</code>\ncommand</p>")
      expect(out).toContain(`</code>${SIX_PER_EM_SPACE}command`)
    })

    it.each([
      ["hugging punctuation follows", "<p>a <code>one</code>), next</p>"],
      ["a non-breaking space follows", "<p>a <code>one</code> two</p>"],
      ["the code ends its block", "<p>run <code>grep</code></p>"],
      ["an element follows directly", "<p>run <code>grep</code><em> now</em></p>"],
      ["the code is italicized", "<p><em>use <code>grep</code> here</em></p>"],
      ["block code inside <pre>", "<pre><code>grep</code> x</pre>"],
    ])("leaves the following text untouched when %s", async (_label, html) => {
      const out = await processHtmlWithPlugin(html)
      expect(out).not.toContain(SIX_PER_EM_SPACE)
    })
  })

  describe("marks short codes atomic so they don't break mid-token", () => {
    it("marks a short hyphenated code atomic", async () => {
      const out = await processHtmlWithPlugin("<p>a <code>conic-gradient</code></p>")
      expect(out).toContain('<code class="inline-code-atomic">conic-gradient</code>')
    })

    it("leaves a long code breakable (no atomic class)", async () => {
      const long = "alexander-turner/claude-automation-template"
      const out = await processHtmlWithPlugin(`<p>see <code>${long}</code></p>`)
      expect(out).not.toContain("inline-code-atomic")
      expect(out).toContain(`<code>${long}</code>`)
    })

    it("does not mark block code inside <pre>", async () => {
      const out = await processHtmlWithPlugin("<pre><code>grep</code></pre>")
      expect(out).not.toContain("inline-code-atomic")
    })
  })

  describe("does not give closing punctuation a gap", () => {
    it("leaves closing punctuation as plain text before the next code", async () => {
      const out = await processHtmlWithPlugin("<p>see <code>one</code>); <code>two</code> ok</p>")
      expect(out).toBe(
        `<p>see${HAIR_SPACE} <code class="inline-code-atomic">one</code>); ` +
          `<code class="inline-code-atomic">two</code>${SIX_PER_EM_SPACE}ok</p>`,
      )
    })

    it.each([
      ["semicolon-close", "); "],
      ["bracket-close", "] "],
      ["comma", ", "],
      ["period", ". "],
    ])("skips the gap when the preceding token is only %s", async (_label, sep) => {
      const out = await processHtmlWithPlugin(`<p>x <code>a</code>${sep}<code>b</code></p>`)
      // The separator stays untouched — no hair space is appended to it.
      expect(out).toContain(`${sep}<code`)
    })

    it("still gaps a real word that follows the closing punctuation", async () => {
      const out = await processHtmlWithPlugin("<p>a <code>one</code>); then <code>two</code></p>")
      expect(out).toContain(`then${HAIR_SPACE} <code class="inline-code-atomic">two</code>`)
    })
  })

  describe("adds no gap", () => {
    it.each([...NO_GAP_PREDECESSORS])("when code is glued behind %s", async (char) => {
      const out = await processHtmlWithPlugin(`<p>${char}<code>grep</code></p>`)
      expect(out).not.toContain(HAIR_SPACE)
    })

    it.each([
      ["code at the start of a paragraph", "<p><code>grep</code> is a tool.</p>"],
      ["code at the start of a fragment", "<code>grep</code>"],
      ["glued opener inside a wrapping link", '<p>(<a href="#"><code>grep</code></a>)</p>'],
      ["no joinable word before the code", "<p><em>x</em><code>grep</code></p>"],
      ["only whitespace before the code", "<p><img> <code>grep</code></p>"],
      ["italicized code inside <em>", "<p><em>use <code>grep</code> here</em></p>"],
      ["italicized code inside <i>", "<p><i>use <code>grep</code> here</i></p>"],
      ["code wrapped by its own <em>", "<p>use <em><code>grep</code></em> here</p>"],
    ])("for %s", async (_label, html) => {
      const out = await processHtmlWithPlugin(html)
      expect(out).not.toContain(HAIR_SPACE)
    })

    it.each([
      ["a comma separator between two codes", "<p><code>a</code>, <code>b</code></p>"],
      ["an em-dash separator between two codes", "<p><code>a</code>—<code>b</code></p>"],
    ])("for %s (no word to crowd the code)", async (_label, html) => {
      const out = await processHtmlWithPlugin(html)
      expect(out).not.toContain(HAIR_SPACE)
      expect(out).not.toContain("inline-code-nowrap")
    })

    it("ignores block code inside <pre>", async () => {
      const out = await processHtmlWithPlugin("<p>run </p><pre><code>grep</code></pre>")
      expect(out).not.toContain(HAIR_SPACE)
    })

    it("leaves non-code elements untouched", async () => {
      const out = await processHtmlWithPlugin("<p>run <em>grep</em></p>")
      expect(out).not.toContain("inline-code")
    })
  })

  describe("textLength", () => {
    it("counts the characters of a text node", () => {
      expect(textLength({ type: "text", value: "abc" })).toBe(3)
    })

    it("sums text across element children", () => {
      expect(textLength(h("code", ["con", h("span", "ic")]) as Element)).toBe(5)
    })

    it("returns 0 for a non-text, non-element node", () => {
      expect(textLength({ type: "comment", value: "x" })).toBe(0)
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

  describe("followingTextNode", () => {
    it("returns the text node directly after the code", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", [code, " next"]) as Parent
      expect(followingTextNode(code, [paragraph])).toEqual({ type: "text", value: " next" })
    })

    it("ascends out of inline wrappers to the wrapper's following text", () => {
      const code = h("code", ["grep"]) as Element
      const link = h("a", [code]) as Element
      const paragraph = h("p", [link, " next"]) as Parent
      expect(followingTextNode(code, [paragraph, link])).toEqual({ type: "text", value: " next" })
    })

    it("returns null when the following sibling is an element", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", [code, h("em", [" now"])]) as Parent
      expect(followingTextNode(code, [paragraph])).toBeNull()
    })

    it("returns null at a block end (no following sibling)", () => {
      const code = h("code", ["grep"]) as Element
      const paragraph = h("p", [code]) as Parent
      expect(followingTextNode(code, [paragraph])).toBeNull()
    })

    it("returns null when every ancestor is inline and yields no successor", () => {
      const code = h("code", ["grep"]) as Element
      const wrapper = h("em", [code]) as Parent
      expect(followingTextNode(code, [wrapper])).toBeNull()
    })
  })
})
