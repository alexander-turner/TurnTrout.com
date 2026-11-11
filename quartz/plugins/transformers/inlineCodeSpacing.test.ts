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
  shortHyphenFragmentRanges,
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
    it("wraps the trailing word's last glyph in a gap span, leaving the code in place", async () => {
      const out = await processHtmlWithPlugin("<p>of <code>grep</code></p>")
      expect(out).toBe(`<p>o<span class="code-gap-after">f</span> <code>grep</code></p>`)
    })

    it("leaves earlier text in place, gapping only the trailing word", async () => {
      const out = await processHtmlWithPlugin("<p>help of <code>grep</code></p>")
      expect(out).toBe(`<p>help o<span class="code-gap-after">f</span> <code>grep</code></p>`)
    })

    it("gaps the word before a wrapping link, not the link or its code", async () => {
      const out = await processHtmlWithPlugin('<p>help of <a href="#"><code>grep</code></a></p>')
      expect(out).toBe(
        `<p>help o<span class="code-gap-after">f</span> ` + `<a href="#"><code>grep</code></a></p>`,
      )
    })

    it("keeps the gap when the code abuts non-hugging punctuation", async () => {
      const out = await processHtmlWithPlugin("<p>war—<code>grep</code></p>")
      expect(out).toBe(`<p>war<span class="code-gap-after">—</span><code>grep</code></p>`)
    })

    it("handles several codes sharing a parent", async () => {
      const out = await processHtmlWithPlugin("<p>a <code>one</code> b <code>two</code></p>")
      expect(out).toBe(
        `<p><span class="code-gap-after">a</span> <code>one</code> ` +
          `<span class="code-gap-after">b</span> <code>two</code></p>`,
      )
    })
  })

  describe("lets a code break in place at its seams", () => {
    it.each([
      ["owner/repo", "owner/<wbr>repo"],
      ["config/lint/.markdownlint.jsonc", "config/<wbr>lint/<wbr>.markdownlint.jsonc"],
      ["https://github.com/abc", "https://github.com/<wbr>abc"],
      ["print(is_prime(3))", "print(<wbr>is_prime(<wbr>3))"],
      ["a=foo, bar", "a=foo, bar"],
      ["width=100px", "width=<wbr>100px"],
    ])("breaks %s at its seams and marks it breakable", async (code, expected) => {
      const out = await processHtmlWithPlugin(`<p>see <code>${code}</code></p>`)
      const marked = expected.includes("<wbr>") ? ' class="inline-code-breakable"' : ""
      expect(out).toBe(
        `<p>se<span class="code-gap-after">e</span> <code${marked}>${expected}</code></p>`,
      )
    })

    it.each([
      ["r/Fantasy_World_Building", "r/Fantasy_World_Building"],
      ["f(x)", "f(x)"],
      ["abc/d", "abc/d"],
      ["abc/de/fgh", "abc/<wbr>de/<wbr>fgh"],
      ["https://r/abc", "https://r/<wbr>abc"],
    ])(
      "leaves no fragment of %s shorter than three characters at a line edge",
      async (code, expected) => {
        const out = await processHtmlWithPlugin(`<p>see <code>${code}</code></p>`)
        expect(out).toContain(`${expected}</code>`)
      },
    )

    it.each(["README.md", "turntrout.com", "self.latent_size"])(
      "does not break %s before its dot",
      async (code) => {
        const out = await processHtmlWithPlugin(`<p>see <code>${code}</code></p>`)
        expect(out).toContain(`<code>${code}</code>`)
      },
    )

    const held = (text: string) => `<span class="code-segment">${text}</span>`
    it.each([
      ["--sandbox", held("--sandbox")],
      ["--disable-lcd-text", `${held("--disable-")}lcd-text`],
      ["a-b-c", held("a-b-c")],
      ["gpt-neox-20b", "gpt-neox-20b"],
      ["-1 * micromorts", `${held("-1")} * micromorts`],
    ])("holds %s so no hyphen break leaves a short fragment", async (code, expected) => {
      const out = await processHtmlWithPlugin(`<p>see <code>${code}</code></p>`)
      expect(out).toContain(`<code>${expected}</code>`)
    })

    it("holds hyphen fragments only in a code's own text", async () => {
      const out = await processHtmlWithPlugin("<p>see <code><em>a-b</em> --x</code></p>")
      expect(out).toContain(`<code><em>a-b</em> ${held("--x")}</code>`)
    })

    it("leaves a code with no seams to break at its own hyphens", async () => {
      const out = await processHtmlWithPlugin("<p>a <code>conic-gradient</code></p>")
      expect(out).toBe('<p><span class="code-gap-after">a</span> <code>conic-gradient</code></p>')
    })

    it("does not touch block code inside <pre>", async () => {
      const out = await processHtmlWithPlugin("<pre><code>a/b</code></pre>")
      expect(out).toBe("<pre><code>a/b</code></pre>")
    })

    const segment = (text: string) => `<span class="code-segment">${text}</span>`
    const longSegment = "micromark-extension-gfm-autolink-literal"
    it.each([
      ["alexander-turner/TurnTrout.com", `${segment("alexander-turner/")}<wbr>TurnTrout.com`],
      ["tests/visual-baselines/", `tests/<wbr>${segment("visual-baselines/")}`],
      [`micromark/${longSegment}`, `micromark/<wbr>${longSegment}`],
    ])("holds each short hyphenated segment of %s whole", async (code, expected) => {
      const out = await processHtmlWithPlugin(`<p>see <code>${code}</code></p>`)
      expect(out).toContain(`<code class="inline-code-breakable">${expected}</code>`)
    })

    it.each(["/shard-theory", "a / b", "and/", "&#x3C;/analysis>"])(
      "inserts no break into %s",
      async (code) => {
        const out = await processHtmlWithPlugin(`<p>see <code>${code}</code></p>`)
        expect(out).toContain(`<code>${code}</code>`)
      },
    )
  })

  describe("does not give closing punctuation a gap", () => {
    it("leaves closing punctuation as plain text before the next code", async () => {
      const out = await processHtmlWithPlugin("<p>see <code>one</code>); <code>two</code> ok</p>")
      expect(out).toBe(
        `<p>se<span class="code-gap-after">e</span> <code>one</code>); ` +
          "<code>two</code> ok</p>",
      )
    })

    it.each([
      ["semicolon-close", "); "],
      ["bracket-close", "] "],
      ["comma", ", "],
      ["period", ". "],
    ])("skips the gap when the preceding token is only %s", async (_label, sep) => {
      const out = await processHtmlWithPlugin(`<p>x <code>a</code>${sep}<code>b</code></p>`)
      // The separator stays untouched.
      expect(out).toContain(`${sep}<code`)
    })

    it("still gaps a real word that follows the closing punctuation", async () => {
      const out = await processHtmlWithPlugin("<p>a <code>one</code>); then <code>two</code></p>")
      expect(out).toContain(`the<span class="code-gap-after">n</span> <code>two</code>`)
    })
  })

  describe("adds no gap", () => {
    it.each([...NO_GAP_PREDECESSORS])("when code is glued behind %s", async (char) => {
      const out = await processHtmlWithPlugin(`<p>${char}<code>grep</code></p>`)
      expect(out).not.toContain("code-gap-after")
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
      expect(out).not.toContain("code-gap-after")
    })

    it.each([
      ["a comma separator between two codes", "<p><code>a</code>, <code>b</code></p>"],
      ["an em-dash separator between two codes", "<p><code>a</code>—<code>b</code></p>"],
    ])("for %s (no word to crowd the code)", async (_label, html) => {
      const out = await processHtmlWithPlugin(html)
      expect(out).not.toContain("code-gap-after")
      expect(out).not.toContain("inline-code-nowrap")
    })

    it("ignores block code inside <pre>", async () => {
      const out = await processHtmlWithPlugin("<p>run </p><pre><code>grep</code></pre>")
      expect(out).not.toContain("code-gap-after")
    })

    it("leaves non-code elements untouched", async () => {
      const out = await processHtmlWithPlugin("<p>run <em>grep</em></p>")
      expect(out).not.toContain("inline-code")
    })
  })

  describe("shortHyphenFragmentRanges", () => {
    it.each([
      ["no hyphen", "abc def", []],
      ["long fragments", "red-gems", []],
      ["a leading hyphen run", "--sandbox", [[0, 9]]],
      ["fragments sharing a hold", "a-b-c", [[0, 5]]],
      [
        "holds that only touch",
        "a-bcd-efg-h",
        [
          [0, 6],
          [6, 11],
        ],
      ],
      ["a short fragment after a space", "go a-bcd", [[3, 8]]],
    ])("finds ranges for %s", (_label, value, expected) => {
      expect(shortHyphenFragmentRanges(value)).toEqual(expected)
    })

    it("leaves a hold longer than a held segment breakable", () => {
      expect(shortHyphenFragmentRanges(`a-${"b".repeat(40)}`)).toEqual([])
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
