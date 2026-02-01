import { describe, it, expect } from "@jest/globals"

import { danSmithToUnicode, NAMARIE_LINES } from "./tengwar"

describe("tengwar utilities", () => {
  describe("danSmithToUnicode", () => {
    it("should convert consonants to Unicode PUA", () => {
      // tinco (1) -> U+E000
      expect(danSmithToUnicode("1")).toBe(String.fromCodePoint(0xe000))
      // parma (q) -> U+E001
      expect(danSmithToUnicode("q")).toBe(String.fromCodePoint(0xe001))
      // lambe (j) -> U+E01A
      expect(danSmithToUnicode("j")).toBe(String.fromCodePoint(0xe01a))
    })

    it("should convert tehtar (vowels) to Unicode PUA", () => {
      // a-tehta (#, E, D, C) -> U+E040
      expect(danSmithToUnicode("#")).toBe(String.fromCodePoint(0xe040))
      expect(danSmithToUnicode("E")).toBe(String.fromCodePoint(0xe040))
      // e-tehta ($, R, F, V) -> U+E041
      expect(danSmithToUnicode("$")).toBe(String.fromCodePoint(0xe041))
      expect(danSmithToUnicode("V")).toBe(String.fromCodePoint(0xe041))
      // i-tehta (%, T, G, B) -> U+E042
      expect(danSmithToUnicode("%")).toBe(String.fromCodePoint(0xe042))
      expect(danSmithToUnicode("T")).toBe(String.fromCodePoint(0xe042))
    })

    it("should convert carriers to Unicode PUA", () => {
      // short-carrier (`) -> U+E025
      expect(danSmithToUnicode("`")).toBe(String.fromCodePoint(0xe025))
      // long-carrier (~) -> U+E026
      expect(danSmithToUnicode("~")).toBe(String.fromCodePoint(0xe026))
    })

    it("should preserve spaces", () => {
      expect(danSmithToUnicode("1 q")).toBe(
        String.fromCodePoint(0xe000) + " " + String.fromCodePoint(0xe001),
      )
    })

    it("should preserve unmapped characters", () => {
      // Characters not in the Dan Smith mapping should pass through unchanged
      // Most ASCII letters ARE mapped, so use truly unmapped chars like accented letters
      expect(danSmithToUnicode("ÉÊË")).toBe("ÉÊË")
      expect(danSmithToUnicode("©®™")).toBe("©®™")
    })

    it("should handle empty string", () => {
      expect(danSmithToUnicode("")).toBe("")
    })

    it("should handle mixed content", () => {
      const input = "1E qV" // tinco+a, space, parma+e
      const result = danSmithToUnicode(input)
      expect(result.length).toBe(5) // 4 converted chars + 1 space
      expect(result[2]).toBe(" ")
    })
  })

  describe("NAMARIE_LINES", () => {
    it("should have 17 lines", () => {
      expect(NAMARIE_LINES.length).toBe(17)
    })

    it("should have [quenya, english] pairs", () => {
      for (const line of NAMARIE_LINES) {
        expect(Array.isArray(line)).toBe(true)
        expect(line.length).toBe(2)
        expect(typeof line[0]).toBe("string")
        expect(typeof line[1]).toBe("string")
      }
    })

    it("should start with 'Ai laurie lantar lassi surinen'", () => {
      expect(NAMARIE_LINES[0][0]).toBe("Ai laurie lantar lassi surinen")
      expect(NAMARIE_LINES[0][1]).toBe("Ah! like gold fall the leaves in the wind,")
    })

    it("should end with 'Nai elye hiruva Namarie'", () => {
      const lastLine = NAMARIE_LINES[NAMARIE_LINES.length - 1]
      expect(lastLine[0]).toBe("Nai elye hiruva Namarie")
      expect(lastLine[1]).toBe("Maybe even thou shalt find it. Farewell!")
    })
  })
})
