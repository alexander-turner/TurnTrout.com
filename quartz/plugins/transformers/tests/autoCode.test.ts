import { describe, expect, it } from "@jest/globals"
import { rehype } from "rehype"

import { CODE_TERM_REGEX, codeTerms, isInSkippedAncestor, rehypeAutoCode } from "../autoCode"

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
      [
        "matches at the very start of a text node",
        "<p>punctilio is great.</p>",
        "<p><code>punctilio</code> is great.</p>",
      ],
      [
        "matches consecutive terms separated by a single space",
        "<p>pnpm vale runs everything.</p>",
        "<p><code>pnpm</code> <code>vale</code> runs everything.</p>",
      ],
      [
        "leaves a trailing apostrophe outside the wrap (possessive)",
        "<p>punctilio's main feature.</p>",
        "<p><code>punctilio</code>'s main feature.</p>",
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
      expect(runAutoCode("<pre><code>install punctilio here</code></pre>")).toBe(
        "<pre><code>install punctilio here</code></pre>",
      )
    })

    it.each([
      ["bare <pre>", "<pre>install punctilio</pre>"],
      ["<kbd>", "<p>Type <kbd>punctilio</kbd> to begin.</p>"],
      [
        '<abbr class="small-caps"> (TagSmallcaps output)',
        '<p>Linter <abbr class="small-caps">eslint</abbr> ran.</p>',
      ],
      ["<style>", "<style>.punctilio { color: red; }</style>"],
      ["<script>", "<script>var punctilio = 1;</script>"],
    ])("does not transform inside %s", (_label, input) => {
      expect(runAutoCode(input)).toBe(input)
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
      expect(runAutoCode("<p><strong>punctilio</strong> and <em>subfont</em></p>")).toBe(
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

  describe("isInSkippedAncestor", () => {
    it("returns false for an empty ancestor list", () => {
      expect(isInSkippedAncestor([])).toBe(false)
    })

    it.each(["code", "pre", "abbr", "kbd", "style", "script"])(
      "returns true when an ancestor is <%s>",
      (tagName) => {
        const ancestor = {
          type: "element",
          tagName,
          properties: {},
          children: [],
        } as never
        expect(isInSkippedAncestor([ancestor])).toBe(true)
      },
    )

    it("returns false for non-element ancestors", () => {
      const rootAncestor = { type: "root", children: [] } as never
      expect(isInSkippedAncestor([rootAncestor])).toBe(false)
    })

    it("returns false for an unrelated element", () => {
      const span = {
        type: "element",
        tagName: "span",
        properties: {},
        children: [],
      } as never
      expect(isInSkippedAncestor([span])).toBe(false)
    })
  })

  describe("regex / term list invariants", () => {
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
