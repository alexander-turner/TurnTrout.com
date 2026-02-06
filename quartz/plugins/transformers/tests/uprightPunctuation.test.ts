import { describe, it, expect } from "@jest/globals"
import { rehype } from "rehype"

import { UprightPunctuation, uprightPunctuationTransform } from "../uprightPunctuation"

function process(inputHTML: string): string {
  const processor = rehype().data("settings", { fragment: true })
  processor.use(() => uprightPunctuationTransform)
  return processor.processSync(inputHTML).toString()
}

const wrap = (char: string) => `<span class="upright-punctuation">${char}</span>`

describe("UprightPunctuation", () => {
  describe("basic wrapping inside <em>", () => {
    it.each([
      ["<p><em>(text)</em></p>", `<p><em>${wrap("(")}text${wrap(")")}</em></p>`],
      ["<p><em>[text]</em></p>", `<p><em>${wrap("[")}text${wrap("]")}</em></p>`],
      ["<p><em>{text}</em></p>", `<p><em>${wrap("{")}text${wrap("}")}</em></p>`],
    ])("wraps brackets in %s", (input, expected) => {
      expect(process(input)).toBe(expected)
    })
  })

  describe("basic wrapping inside <i>", () => {
    it("wraps parentheses inside <i>", () => {
      expect(process("<p><i>(text)</i></p>")).toBe(`<p><i>${wrap("(")}text${wrap(")")}</i></p>`)
    })
  })

  describe("nested elements", () => {
    it("handles <em><b>text (with parens)</b></em>", () => {
      expect(process("<p><em><b>text (with parens)</b></em></p>")).toBe(
        `<p><em><b>text ${wrap("(")}with parens${wrap(")")}</b></em></p>`,
      )
    })

    it("handles <em><strong>text [brackets]</strong></em>", () => {
      expect(process("<p><em><strong>text [brackets]</strong></em></p>")).toBe(
        `<p><em><strong>text ${wrap("[")}brackets${wrap("]")}</strong></em></p>`,
      )
    })

    it("handles deeply nested <em><b><span>text (deep)</span></b></em>", () => {
      expect(process("<p><em><b><span>text (deep)</span></b></em></p>")).toBe(
        `<p><em><b><span>text ${wrap("(")}deep${wrap(")")}</span></b></em></p>`,
      )
    })

    it("handles <i><b>text {braces}</b></i>", () => {
      expect(process("<p><i><b>text {braces}</b></i></p>")).toBe(
        `<p><i><b>text ${wrap("{")}braces${wrap("}")}</b></i></p>`,
      )
    })
  })

  describe("does NOT wrap outside italic context", () => {
    it.each([
      ["<p>(text)</p>"],
      ["<p><b>(text)</b></p>"],
      ["<p><strong>(text)</strong></p>"],
      ["<p><span>[text]</span></p>"],
    ])("leaves %s unchanged", (input) => {
      expect(process(input)).toBe(input)
    })
  })

  describe("skips code/pre/script/style", () => {
    it.each([
      ["<p><em><code>(text)</code></em></p>"],
      ["<pre><em>(text)</em></pre>"],
      ['<p><em><span class="no-formatting">(text)</span></em></p>'],
    ])("leaves %s unchanged", (input) => {
      expect(process(input)).toBe(input)
    })
  })

  describe("mixed content", () => {
    it("only wraps punctuation inside the italic portion", () => {
      const input = "<p>(outside) <em>(inside)</em> (outside)</p>"
      const expected = `<p>(outside) <em>${wrap("(")}inside${wrap(")")}</em> (outside)</p>`
      expect(process(input)).toBe(expected)
    })

    it("handles italic text with no punctuation", () => {
      expect(process("<p><em>no punctuation here</em></p>")).toBe(
        "<p><em>no punctuation here</em></p>",
      )
    })

    it("handles multiple punctuation groups", () => {
      const input = "<p><em>a (b) and [c]</em></p>"
      const expected = `<p><em>a ${wrap("(")}b${wrap(")")} and ${wrap("[")}c${wrap("]")}</em></p>`
      expect(process(input)).toBe(expected)
    })
  })

  describe("does not double-wrap", () => {
    it("skips already-wrapped punctuation", () => {
      const input = `<p><em><span class="upright-punctuation">(</span>text<span class="upright-punctuation">)</span></em></p>`
      expect(process(input)).toBe(input)
    })
  })

  describe("handles links inside italic", () => {
    it("wraps punctuation in text nodes around links", () => {
      const input = '<p><em>(<a href="#">link</a>)</em></p>'
      const expected = `<p><em>${wrap("(")}<a href="#">link</a>${wrap(")")}</em></p>`
      expect(process(input)).toBe(expected)
    })
  })

  describe("edge cases", () => {
    it("handles empty em", () => {
      expect(process("<p><em></em></p>")).toBe("<p><em></em></p>")
    })

    it("handles em with only punctuation", () => {
      expect(process("<p><em>()</em></p>")).toBe(`<p><em>${wrap("(")}${wrap(")")}</em></p>`)
    })

    it("handles adjacent punctuation", () => {
      expect(process("<p><em>([text])</em></p>")).toBe(
        `<p><em>${wrap("(")}${wrap("[")}text${wrap("]")}${wrap(")")}</em></p>`,
      )
    })

    it("handles elvish class skip", () => {
      expect(process('<p><em><span class="elvish">(text)</span></em></p>')).toBe(
        '<p><em><span class="elvish">(text)</span></em></p>',
      )
    })

    it("handles bad-handwriting class skip", () => {
      expect(process('<p><em><span class="bad-handwriting">(text)</span></em></p>')).toBe(
        '<p><em><span class="bad-handwriting">(text)</span></em></p>',
      )
    })

    it("handles trailing text after punctuation", () => {
      expect(process("<p><em>(trailing text</em></p>")).toBe(
        `<p><em>${wrap("(")}trailing text</em></p>`,
      )
    })
  })

  describe("plugin interface", () => {
    it("exports a valid QuartzTransformerPlugin", () => {
      const plugin = UprightPunctuation()
      expect(plugin.name).toBe("uprightPunctuation")
      // ctx is unused by this plugin, so undefined is safe
      const plugins = plugin.htmlPlugins!(undefined as never)
      expect(plugins).toHaveLength(1)
      // Exercise the inner factory function to cover the arrow
      const [factory] = plugins
      expect(typeof factory).toBe("function")
      expect((factory as () => unknown)()).toBe(uprightPunctuationTransform)
    })
  })
})
