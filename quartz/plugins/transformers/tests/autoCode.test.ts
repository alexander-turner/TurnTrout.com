import { describe, expect, it } from "@jest/globals"
import { rehype } from "rehype"

import {
  CODE_TERM_REGEX,
  codeTerms,
  isInsideCode,
  rehypeAutoCode,
} from "../autoCode"

function runAutoCode(inputHTML: string): string {
  return rehype()
    .data("settings", { fragment: true })
    .use(rehypeAutoCode)
    .processSync(inputHTML)
    .toString()
}

describe("rehypeAutoCode", () => {
  describe("basic matching", () => {
    it.each([
      [
        "wraps a single term in <code>",
        "<p>Use punctilio for typography.</p>",
        "<p>Use <code>punctilio</code> for typography.</p>",
      ],
      [
        "wraps multiple terms in one paragraph",
        "<p>Use punctilio and subfont together.</p>",
        "<p>Use <code>punctilio</code> and <code>subfont</code> together.</p>",
      ],
      [
        "wraps the same term twice",
        "<p>punctilio is great. punctilio is fast.</p>",
        "<p><code>punctilio</code> is great. <code>punctilio</code> is fast.</p>",
      ],
      [
        "preserves surrounding whitespace and punctuation",
        "<p>(punctilio), really.</p>",
        "<p>(<code>punctilio</code>), really.</p>",
      ],
    ])("%s", (_label, input, expected) => {
      expect(runAutoCode(input)).toBe(expected)
    })
  })

  describe("longest-first matching", () => {
    it("matches retext-smartypants as a single unit, not retext + -smartypants", () => {
      expect(runAutoCode("<p>I use retext-smartypants.</p>")).toBe(
        "<p>I use <code>retext-smartypants</code>.</p>",
      )
    })

    it("still matches bare retext on its own", () => {
      expect(runAutoCode("<p>retext is the parent project.</p>")).toBe(
        "<p><code>retext</code> is the parent project.</p>",
      )
    })

    it("matches lint-staged as a hyphenated unit", () => {
      expect(runAutoCode("<p>The lint-staged hook runs.</p>")).toBe(
        "<p>The <code>lint-staged</code> hook runs.</p>",
      )
    })
  })

  describe("word boundary respect", () => {
    it.each([
      [
        "no match inside a longer alphanum word",
        "<p>The punctilios library is fake.</p>",
        "<p>The punctilios library is fake.</p>",
      ],
      [
        "no match when prefixed by alphanum",
        "<p>Some xpunctilio thing.</p>",
        "<p>Some xpunctilio thing.</p>",
      ],
      [
        "no match when surrounded by hyphens (compound token)",
        "<p>foo-punctilio-bar</p>",
        "<p>foo-punctilio-bar</p>",
      ],
      [
        "matches when surrounded by sentence punctuation",
        "<p>foo, punctilio. Bar.</p>",
        "<p>foo, <code>punctilio</code>. Bar.</p>",
      ],
    ])("%s", (_label, input, expected) => {
      expect(runAutoCode(input)).toBe(expected)
    })
  })

  describe("case sensitivity", () => {
    it.each([
      ["Punctilio (sentence-start)", "<p>Punctilio is great.</p>"],
      ["PUNCTILIO (uppercase)", "<p>PUNCTILIO is great.</p>"],
      ["Subfont (Title Case)", "<p>Subfont saves bytes.</p>"],
    ])("does not match %s", (_label, input) => {
      expect(runAutoCode(input)).toBe(input)
    })
  })

  describe("skip rules", () => {
    it("does not transform inside an existing <code>", () => {
      expect(runAutoCode("<p>Already coded: <code>punctilio</code>.</p>")).toBe(
        "<p>Already coded: <code>punctilio</code>.</p>",
      )
    })

    it("does not transform inside <pre><code>", () => {
      expect(
        runAutoCode("<pre><code>install punctilio here</code></pre>"),
      ).toBe("<pre><code>install punctilio here</code></pre>")
    })

    it("does transform inside <a> link text", () => {
      expect(runAutoCode('<p><a href="/x">punctilio</a> link</p>')).toBe(
        '<p><a href="/x"><code>punctilio</code></a> link</p>',
      )
    })

    it("does transform inside headings", () => {
      expect(runAutoCode("<h2>Use punctilio for typography</h2>")).toBe(
        "<h2>Use <code>punctilio</code> for typography</h2>",
      )
    })

    it("does transform inside <em> and <strong>", () => {
      expect(
        runAutoCode("<p><strong>punctilio</strong> and <em>subfont</em></p>"),
      ).toBe(
        "<p><strong><code>punctilio</code></strong> and <em><code>subfont</code></em></p>",
      )
    })
  })

  describe("HTML comments are not text nodes", () => {
    it("ignores vale on/off comments around prose", () => {
      // The comment is a comment node, not a text node — the visitor never
      // sees it. The bare "vale" inside the comment is not transformed.
      const input = "<p>Some prose. <!-- vale off --> more prose.</p>"
      const output = runAutoCode(input)
      expect(output).toBe(input)
    })
  })

  describe("isInsideCode", () => {
    it("returns false for an empty ancestor list", () => {
      expect(isInsideCode([])).toBe(false)
    })

    it("returns true when any ancestor is a <code> element", () => {
      const codeAncestor = {
        type: "element",
        tagName: "code",
        properties: {},
        children: [],
      } as never
      expect(isInsideCode([codeAncestor])).toBe(true)
    })

    it("returns false for non-element ancestors", () => {
      const rootAncestor = { type: "root", children: [] } as never
      expect(isInsideCode([rootAncestor])).toBe(false)
    })
  })

  describe("regex / term list invariants", () => {
    it("includes all curated terms", () => {
      // Sanity guard: if someone reorders or accidentally drops a term, this
      // catches it before the live transformer silently stops wrapping.
      expect(codeTerms).toContain("punctilio")
      expect(codeTerms).toContain("retext-smartypants")
      expect(codeTerms).toContain("vale")
      expect(codeTerms.length).toBeGreaterThanOrEqual(21)
    })

    it("matches every curated term in plain prose", () => {
      for (const term of codeTerms) {
        CODE_TERM_REGEX.lastIndex = 0
        expect(CODE_TERM_REGEX.test(`use ${term} here`)).toBe(true)
      }
    })

    it("does not match a curated term as a substring of a longer word", () => {
      for (const term of codeTerms) {
        CODE_TERM_REGEX.lastIndex = 0
        expect(CODE_TERM_REGEX.test(`x${term}x`)).toBe(false)
      }
    })
  })
})
