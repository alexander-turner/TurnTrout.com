import { describe, it, expect } from "@jest/globals"

import { cleanSearchText } from "../searchTextUtils"

describe("cleanSearchText", () => {
  describe("wiki-links", () => {
    it.each([
      ["[[page]]", "page"],
      ["[[my-page]]", "my-page"],
      ["[[page#section]]", "page"],
      ["[[page#]]", "page"],
      ["[[page|display text]]", "display text"],
      ["[[page#section|display text]]", "display text"],
      ["[[page#|display]]", "display"],
    ])("should convert %s to %s", (input, expected) => {
      expect(cleanSearchText(input)).toBe(expected)
    })

    it("should handle wiki-links in surrounding text", () => {
      expect(cleanSearchText("See [[my-page|this page]] for details")).toBe(
        "See this page for details",
      )
    })

    it("should handle multiple wiki-links", () => {
      expect(cleanSearchText("Link [[a]] and [[b|B]]")).toBe("Link a and B")
    })
  })

  describe("Obsidian embeds", () => {
    it.each([["![[embedded-note]]"], ["![[image.png]]"], ["![[note#section]]"]])(
      "should remove embed %s",
      (input) => {
        expect(cleanSearchText(input).trim()).toBe("")
      },
    )

    it("should remove embeds in surrounding text", () => {
      expect(cleanSearchText("Before ![[embed]] after")).toBe("Before after")
    })
  })

  describe("callout markers", () => {
    it.each([
      ["[!summary]", ""],
      ["[!thanks]", ""],
      ["[!note]", ""],
      ["[!warning]+", ""],
      ["[!tip]-", ""],
    ])("should remove callout marker %s", (input, expected) => {
      expect(cleanSearchText(input).trim()).toBe(expected)
    })

    it("should remove callout markers in surrounding text", () => {
      expect(cleanSearchText("[!summary] This is a summary")).toBe("This is a summary")
    })
  })

  describe("LaTeX", () => {
    it.each([
      ["$x^2$", ""],
      ["$E = mc^2$", ""],
      ["$\\frac{a}{b}$", ""],
      ["$$E = mc^2$$", ""],
      ["$$\\int_0^1 f(x) dx$$", ""],
    ])("should remove LaTeX %s", (input, expected) => {
      expect(cleanSearchText(input).trim()).toBe(expected)
    })

    it("should preserve monetary amounts", () => {
      expect(cleanSearchText("costs $5")).toBe("costs $5")
      expect(cleanSearchText("between $50 and $100")).toBe("between $50 and $100")
    })

    it("should remove inline math in surrounding text", () => {
      expect(cleanSearchText("The formula $x^2$ is quadratic")).toBe("The formula is quadratic")
    })

    it("should remove display math in surrounding text", () => {
      expect(cleanSearchText("Before $$x^2 + y^2$$ after")).toBe("Before after")
    })

    it("should handle multiple math expressions", () => {
      expect(cleanSearchText("From $a$ to $b$ and back")).toBe("From to and back")
    })
  })

  describe("combined patterns", () => {
    it("should handle mixed Obsidian syntax", () => {
      const input = "[!summary] See [[my-page|this page]] for the formula $E = mc^2$ details"
      const expected = "See this page for the formula details"
      expect(cleanSearchText(input)).toBe(expected)
    })

    it("should collapse multiple spaces", () => {
      expect(cleanSearchText("a  b   c")).toBe("a b c")
    })

    it("should pass through plain text unchanged", () => {
      const plainText = "This is a normal sentence with no special syntax."
      expect(cleanSearchText(plainText)).toBe(plainText)
    })

    it("should handle empty string", () => {
      expect(cleanSearchText("")).toBe("")
    })
  })
})
