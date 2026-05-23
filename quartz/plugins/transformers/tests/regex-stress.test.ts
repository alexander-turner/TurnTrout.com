import { describe, expect, it } from "@jest/globals"

import { editAdmonition, spaceAdmonitions } from "../formatting_improvement_text"
import {
  capitalizeAfterEnding,
  isRomanNumeral,
  REGEX_ALL_CAPS_PHRASE,
  REGEX_VERSION_NUMBER,
} from "../tagSmallcaps"
import { fractionRegex, urlRegex } from "../utils"

describe("urlRegex", () => {
  it("should parse domain and path from a multi-segment URL", () => {
    urlRegex.lastIndex = 0
    const match = urlRegex.exec("(https://sub.example.com/page)")
    expect(match?.groups?.domain).toBe("sub.example.")
    expect(match?.groups?.path).toBe("com/page")
  })

  it("should handle parentheses in path (Wikipedia-style)", () => {
    urlRegex.lastIndex = 0
    const match = urlRegex.exec("(https://en.wikipedia.org/wiki/Test_(thing))")
    expect(match?.groups?.path).toContain("Test_(thing)")
  })

  it("should handle domains with hyphens", () => {
    urlRegex.lastIndex = 0
    const match = urlRegex.exec("(https://my-site.example.com/x)")
    expect(match?.groups?.domain).toContain("my-site.")
  })
})

describe("fractionRegex", () => {
  it.each([
    ["1/2", "1", "2", undefined],
    ["1,000/2,000", "1,000", "2,000", undefined],
    ["1/4th", "1", "4", "th"],
  ])("should match %s → %s/%s (ordinal=%s)", (input, num, den, ord) => {
    fractionRegex.lastIndex = 0
    const match = fractionRegex.exec(input)
    expect(match?.groups?.numerator).toBe(num)
    expect(match?.groups?.denominator).toBe(den)
    expect(match?.groups?.ordinal).toBe(ord)
  })

  it.each(["9/11", "word/word", "x1/2", "1/2x", ".1/2", "/1/2"])("should NOT match %s", (input) => {
    fractionRegex.lastIndex = 0
    expect(fractionRegex.test(input)).toBe(false)
  })

  it("should not match when followed by minus-sign + digit", () => {
    fractionRegex.lastIndex = 0
    expect(fractionRegex.test("1/2-3")).toBe(false)
  })
})

describe("wikilinkImageEmbedRegex", () => {
  const regex = /^\|?(?:(?<width>\d+)(?:x(?<height>\d+))?|(?<alt>.+))?$/

  it.each([
    ["|640x480", "640", "480", undefined],
    ["640", "640", undefined, undefined],
  ])("should parse dimensions from '%s'", (input, w, h, alt) => {
    const match = regex.exec(input)
    expect(match?.groups?.width).toBe(w)
    expect(match?.groups?.height).toBe(h)
    expect(match?.groups?.alt).toBe(alt)
  })

  it.each([
    ["|alt text", "alt text"],
    ["2nd edition cover", "2nd edition cover"],
  ])("should parse alt from '%s'", (input, expectedAlt) => {
    const match = regex.exec(input)
    expect(match?.groups?.alt).toBe(expectedAlt)
    expect(match?.groups?.width).toBeUndefined()
  })

  it.each(["", "|"])("should handle empty input '%s'", (input) => {
    const match = regex.exec(input)
    expect(match).not.toBeNull()
    expect(match?.groups?.width).toBeUndefined()
    expect(match?.groups?.alt).toBeUndefined()
  })
})

describe("isRomanNumeral", () => {
  it.each(["IV", "IX", "XIV", "XLII", "XCIX", "MMMCMXCIX", "IC", "IM"])(
    "should match %s",
    (numeral) => {
      expect(isRomanNumeral(numeral)).toBe(true)
    },
  )

  it.each(["I", "V", "HELLO", "", "VV", "IIII", "MMMM"])("should NOT match %s", (input) => {
    expect(isRomanNumeral(input)).toBe(false)
  })

  it("should match with trailing punctuation", () => {
    expect(isRomanNumeral("IV.")).toBe(true)
  })
})

describe("REGEX_VERSION_NUMBER", () => {
  it.each(["V1", "v1.0", "v1.2.3"])("should match %s", (input) => {
    REGEX_VERSION_NUMBER.lastIndex = 0
    expect(REGEX_VERSION_NUMBER.test(input)).toBe(true)
  })

  it.each(["v", "V", "Vault", "xv1"])("should NOT match %s", (input) => {
    REGEX_VERSION_NUMBER.lastIndex = 0
    expect(REGEX_VERSION_NUMBER.test(input)).toBe(false)
  })
})

describe("REGEX_ALL_CAPS_PHRASE", () => {
  it.each(["THE BIG THING", "FIRST-ORDER LOGIC"])("should match multi-word phrase: %s", (input) => {
    REGEX_ALL_CAPS_PHRASE.lastIndex = 0
    expect(REGEX_ALL_CAPS_PHRASE.test(input)).toBe(true)
  })

  it.each(["hello world", "AB"])("should NOT match: %s", (input) => {
    REGEX_ALL_CAPS_PHRASE.lastIndex = 0
    expect(REGEX_ALL_CAPS_PHRASE.test(input)).toBe(false)
  })
})

describe("capitalizeAfterEnding", () => {
  it.each([
    [". X", "X"],
    ["? z", "z"],
    [". Ü", "Ü"],
  ])("should capture letter in '%s' → '%s'", (input, letter) => {
    capitalizeAfterEnding.lastIndex = 0
    const match = capitalizeAfterEnding.exec(input)
    expect(match?.groups?.letter).toBe(letter)
  })

  it.each(["e.g. X", "i.e. Y"])("should not match after %s", (input) => {
    capitalizeAfterEnding.lastIndex = 0
    expect(capitalizeAfterEnding.exec(input)).toBeNull()
  })
})

describe("editAdmonition (no trailing [*_]*)", () => {
  it("should preserve emphasis markers in captured text", () => {
    const result = editAdmonition("Edit 1/2/2024: Fixed *the* bug")
    expect(result).toContain("Fixed *the* bug")
  })

  it("should preserve trailing emphasis markers", () => {
    const result = editAdmonition("Edit 1/1/23: Some text**")
    expect(result).toContain("Some text**")
  })
})

describe("spaceAdmonitions (no dead lookahead)", () => {
  it("should add blank blockquote line after callout", () => {
    const result = spaceAdmonitions("> [!info] Title\n> Content")
    expect(result).toBe("> [!info] Title\n> \n> Content")
  })

  it("should handle multiple callouts", () => {
    const input = "> [!info] First\n> text\n\n> [!warning] Second\n> more"
    const result = spaceAdmonitions(input)
    expect(result).toContain("> [!info] First\n> \n> text")
    expect(result).toContain("> [!warning] Second\n> \n> more")
  })
})

describe("SVG_COLOR_PROP_RE (\\S value start)", () => {
  const SVG_COLOR_PROP_RE =
    /(?<prop>fill|stroke|stop-color|color|flood-color|lighting-color)\s*:\s*(?<value>\S[^;}"']*)/gi

  it.each([
    ["fill: red", "fill", "red"],
    ["stroke:#000", "stroke", "#000"],
  ])("should parse '%s' → prop=%s value=%s", (input, prop, value) => {
    SVG_COLOR_PROP_RE.lastIndex = 0
    const match = SVG_COLOR_PROP_RE.exec(input)
    expect(match?.groups?.prop).toBe(prop)
    expect(match?.groups?.value).toBe(value)
  })

  it("should reject whitespace-only values", () => {
    SVG_COLOR_PROP_RE.lastIndex = 0
    expect(SVG_COLOR_PROP_RE.test("fill:   ")).toBe(false)
  })

  it("should stop at semicolons", () => {
    SVG_COLOR_PROP_RE.lastIndex = 0
    const match = SVG_COLOR_PROP_RE.exec("fill: red; stroke: blue")
    expect(match?.groups?.value).toBe("red")
  })
})
