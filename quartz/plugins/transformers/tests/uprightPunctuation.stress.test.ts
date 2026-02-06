import { describe, it, expect } from "@jest/globals"
import { rehype } from "rehype"

import { improveFormatting } from "../formatting_improvement_html"
import { rehypeTagSmallcaps } from "../tagSmallcaps"
import { uprightPunctuationTransform } from "../uprightPunctuation"

function process(inputHTML: string): string {
  const processor = rehype().data("settings", { fragment: true })
  processor.use(() => uprightPunctuationTransform)
  return processor.processSync(inputHTML).toString()
}

/** Run HTMLFormattingImprovement then UprightPunctuation — production order */
function processWithFormatting(inputHTML: string): string {
  const processor = rehype().data("settings", { fragment: true })
  processor.use(improveFormatting, { skipFirstLetter: true })
  processor.use(() => uprightPunctuationTransform)
  return processor.processSync(inputHTML).toString()
}

/** Run UprightPunctuation then TagAcronyms — production order */
function processWithSmallcaps(inputHTML: string): string {
  const processor = rehype().data("settings", { fragment: true })
  processor.use(() => uprightPunctuationTransform)
  processor.use(rehypeTagSmallcaps)
  return processor.processSync(inputHTML).toString()
}

const wrap = (char: string) => `<span class="upright-punctuation">${char}</span>`

describe("UprightPunctuation stress tests", () => {
  describe("interaction with HTMLFormattingImprovement", () => {
    it("smart quotes inside italic with brackets remain intact", () => {
      // Smart quotes transform "..." to \u201c...\u201d BEFORE our plugin runs
      const input = '<p><em>"text (quoted)"</em></p>'
      const result = processWithFormatting(input)
      // The parens should be wrapped; quotes should be smart
      expect(result).toContain("upright-punctuation")
      expect(result).toContain("\u201C") // left double quote
      expect(result).toContain("\u201D") // right double quote
    })

    it("em-dash conversion inside italic with brackets", () => {
      const input = "<p><em>text -- (aside) -- more</em></p>"
      const result = processWithFormatting(input)
      expect(result).toContain("upright-punctuation")
      expect(result).toContain("\u2014") // em-dash
    })

    it("fractions inside italic with brackets are not broken", () => {
      const input = "<p><em>about 1/2 (roughly)</em></p>"
      const result = processWithFormatting(input)
      expect(result).toContain("upright-punctuation")
      expect(result).toContain("fraction")
    })
  })

  describe("interaction with TagAcronyms (smallcaps)", () => {
    it("acronym before bracket in italic text is wrapped in smallcaps", () => {
      const input = "<p><em>NASA (the agency)</em></p>"
      const result = processWithSmallcaps(input)
      // NASA should become smallcaps, parens should be upright
      expect(result).toContain("small-caps")
      expect(result).toContain("upright-punctuation")
    })

    it("acronym inside brackets in italic text", () => {
      const input = "<p><em>see (NASA) for details</em></p>"
      const result = processWithSmallcaps(input)
      expect(result).toContain("small-caps")
      expect(result).toContain("upright-punctuation")
    })
  })

  describe("idempotency", () => {
    it("running the transform twice produces the same result as once", () => {
      const input = "<p><em>text (with parens) and [brackets]</em></p>"
      const once = process(input)
      const twice = process(once)
      expect(twice).toBe(once)
    })

    it("idempotent on complex nested structure", () => {
      const input = '<p><em><b>bold (parens)</b> and <a href="#">link [bracket]</a></em></p>'
      const once = process(input)
      const twice = process(once)
      expect(twice).toBe(once)
    })
  })

  describe("complex nesting", () => {
    it("handles italic inside non-italic inside italic", () => {
      // <em>outer (<span style="font-style:normal">roman <em>inner (nested)</em></span>)</em>
      const input =
        '<p><em>outer (<span style="font-style:normal">roman <em>inner (nested)</em></span>)</em></p>'
      const result = process(input)
      // "outer (" — outer em, parens should be wrapped
      // "inner (nested)" — inner em, parens should be wrapped
      expect(result).toContain("upright-punctuation")
    })

    it("handles multiple separate italic blocks in one paragraph", () => {
      const input = "<p><em>(first)</em> normal <em>(second)</em> normal <i>(third)</i></p>"
      const result = process(input)
      // Count wraps — should have 6 (2 per italic block × 3 blocks)
      const wrapCount = (result.match(/upright-punctuation/g) ?? []).length
      expect(wrapCount).toBe(6)
    })

    it("handles italic with many sibling element children", () => {
      const input =
        '<p><em>(<a href="#">link1</a>) and (<a href="#">link2</a>) and (<a href="#">link3</a>)</em></p>'
      const result = process(input)
      // 6 parens total
      const wrapCount = (result.match(/upright-punctuation/g) ?? []).length
      expect(wrapCount).toBe(6)
    })
  })

  describe("footnote refs inside italic", () => {
    it("skips footnote ref elements (toSkip catches dataFootnoteRef)", () => {
      const input = '<p><em>text <a data-footnote-ref="true" href="#fn1">[1]</a></em></p>'
      const result = process(input)
      // The [1] inside the footnote ref should NOT be wrapped
      // But "text" should not be affected (no brackets)
      expect(result).not.toContain("upright-punctuation")
    })
  })

  describe("whitespace and boundary conditions", () => {
    it("handles text node that is only whitespace with no brackets", () => {
      const input = "<p><em> </em></p>"
      expect(process(input)).toBe("<p><em> </em></p>")
    })

    it("handles text node that is a single bracket", () => {
      const input = "<p><em>(</em></p>"
      expect(process(input)).toBe(`<p><em>${wrap("(")}</em></p>`)
    })

    it("handles bracket surrounded by whitespace", () => {
      const input = "<p><em> ( ) </em></p>"
      const result = process(input)
      expect(result).toBe(`<p><em> ${wrap("(")} ${wrap(")")} </em></p>`)
    })

    it("handles newlines around brackets", () => {
      const input = "<p><em>\n(\n)\n</em></p>"
      const result = process(input)
      expect(result).toBe(`<p><em>\n${wrap("(")}\n${wrap(")")}\n</em></p>`)
    })
  })

  describe("large content", () => {
    it("handles many brackets in a single text node", () => {
      const brackets = "()[]{}".repeat(100)
      const input = `<p><em>${brackets}</em></p>`
      const result = process(input)
      const wrapCount = (result.match(/upright-punctuation/g) ?? []).length
      expect(wrapCount).toBe(600) // 6 brackets × 100
    })

    it("handles many separate italic elements", () => {
      const items = Array.from({ length: 50 }, (_, i) => `<em>(item ${i})</em>`).join(" ")
      const input = `<p>${items}</p>`
      const result = process(input)
      const wrapCount = (result.match(/upright-punctuation/g) ?? []).length
      expect(wrapCount).toBe(100) // 2 parens × 50 items
    })
  })

  describe("real-world content patterns", () => {
    it("handles citation-style italic", () => {
      // Common pattern: *Book Title (Publisher, 2024)*
      const input = "<p><em>The Elements of Typographic Style (Hartley &amp; Marks, 2004)</em></p>"
      const result = process(input)
      expect(result).toContain("upright-punctuation")
      // Parens should be wrapped but text should be intact
      expect(result).toContain("The Elements of Typographic Style")
      expect(result).toContain("Hartley")
      expect(result).toContain("Marks, 2004")
    })

    it("handles italic with inline code (code should be skipped)", () => {
      const input = "<p><em>the function <code>f(x)</code> returns a value</em></p>"
      const result = process(input)
      // f(x) inside code should NOT be wrapped
      expect(result).toBe("<p><em>the function <code>f(x)</code> returns a value</em></p>")
    })

    it("handles italic text with nested bold and links", () => {
      const input =
        '<p><em>See <b>Figure 1</b> (<a href="#fig1">link</a>) for the [important] result</em></p>'
      const result = process(input)
      // All 4 brackets should be wrapped
      const wrapCount = (result.match(/upright-punctuation/g) ?? []).length
      expect(wrapCount).toBe(4) // ( ) [ ]
    })

    it("handles italic list items", () => {
      const input = "<ul><li><em>first item (with note)</em></li></ul>"
      const result = process(input)
      expect(result).toContain("upright-punctuation")
    })

    it("handles italic text inside table cells", () => {
      const input = "<table><tr><td><em>cell (value)</em></td></tr></table>"
      const result = process(input)
      expect(result).toContain("upright-punctuation")
    })

    it("handles italic text inside blockquotes", () => {
      const input = "<blockquote><p><em>quoted (text)</em></p></blockquote>"
      const result = process(input)
      expect(result).toContain("upright-punctuation")
    })
  })

  describe("characters that should NOT be wrapped", () => {
    it.each([
      ["<p><em>comma, period.</em></p>"],
      ["<p><em>semicolon; colon:</em></p>"],
      ["<p><em>question? exclaim!</em></p>"],
      ["<p><em>quotes \"double\" and 'single'</em></p>"],
      ["<p><em>angle brackets</em></p>"],
    ])("leaves %s unchanged (no wrapping)", (input) => {
      expect(process(input)).toBe(input)
    })
  })

  describe("production pipeline order", () => {
    it("full pipeline: formatting then upright punctuation on realistic content", () => {
      const input = '<p><em>"Hello," she said (quietly). He replied -- "no."</em></p>'
      const result = processWithFormatting(input)
      // Parens should be upright
      expect(result).toContain("upright-punctuation")
      // Smart quotes should exist
      expect(result).toContain("\u201C")
      // Em-dash should exist
      expect(result).toContain("\u2014")
      // Verify no data corruption — the core text should be present
      expect(result).toContain("Hello,")
      expect(result).toContain("she said")
      expect(result).toContain("quietly")
    })
  })
})
