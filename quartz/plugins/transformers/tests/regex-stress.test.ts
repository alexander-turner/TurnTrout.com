import { beforeEach, describe, expect, it } from "@jest/globals"

import {
  editAdmonition,
  spaceAdmonitions,
} from "../formatting_improvement_text"
import { buildPlaceholderRegex } from "../populateExternalMarkdown"
import {
  capitalizeAfterEnding,
  isRomanNumeral,
  REGEX_ALL_CAPS_PHRASE,
  REGEX_VERSION_NUMBER,
} from "../tagSmallcaps"
import { fractionRegex, urlRegex } from "../utils"

describe("urlRegex stress", () => {
  beforeEach(() => {
    urlRegex.lastIndex = 0
  })

  it.each([
    ["(https://example.com/path)", "example.", "com/path"],
    ["(https://sub.example.com/page)", "sub.example.", "com/page"],
    ["(https://a.b.c.d.com/x)", "a.b.c.d.", "com/x"],
    ["(https://example.com/path/to/page)", "example.", "com/path/to/page"],
    ["(https://example.com/path?q=1)", "example.", "com/path?q=1"],
  ])("should match %s → domain=%s path=%s", (input, domain, path) => {
    urlRegex.lastIndex = 0
    const match = urlRegex.exec(input)
    expect(match?.groups?.domain).toBe(domain)
    expect(match?.groups?.path).toBe(path)
  })

  it("should match URLs with parentheses in path", () => {
    const match = urlRegex.exec("(https://en.wikipedia.org/wiki/Test_(thing))")
    expect(match).not.toBeNull()
    expect(match?.groups?.path).toContain("Test_(thing)")
  })

  it.each([
    "(ftp://example.com/path)",
    "(not a url)",
    "(https://)",
  ])("should NOT match %s", (input) => {
    urlRegex.lastIndex = 0
    expect(urlRegex.exec(input)).toBeNull()
  })

  it("should handle domains with hyphens", () => {
    urlRegex.lastIndex = 0
    const match = urlRegex.exec("(https://my-site.example.com/x)")
    expect(match).not.toBeNull()
    expect(match?.groups?.domain).toContain("my-site.")
  })

  it("should handle long but valid domains", () => {
    const longDomain = "a-b.".repeat(100)
    urlRegex.lastIndex = 0
    const match = urlRegex.exec(`(https://${longDomain}com/x)`)
    expect(match).not.toBeNull()
  })
})

describe("fractionRegex stress", () => {
  beforeEach(() => {
    fractionRegex.lastIndex = 0
  })

  it.each([
    ["1/2", "1", "2", undefined],
    ["3/4", "3", "4", undefined],
    ["1,000/2,000", "1,000", "2,000", undefined],
    ["23/100", "23", "100", undefined],
    ["1/4th", "1", "4", "th"],
    ["1/2nd", "1", "2", "nd"],
    ["1/1st", "1", "1", "st"],
    ["3/4rd", "3", "4", "rd"],
  ])("should match %s → %s/%s (ordinal=%s)", (input, num, den, ord) => {
    fractionRegex.lastIndex = 0
    const match = fractionRegex.exec(input)
    expect(match?.groups?.numerator).toBe(num)
    expect(match?.groups?.denominator).toBe(den)
    expect(match?.groups?.ordinal).toBe(ord)
  })

  it.each([
    "9/11",
    "word/word",
    "a/b",
    "/",
    "//",
  ])("should NOT match %s", (input) => {
    fractionRegex.lastIndex = 0
    expect(fractionRegex.test(input)).toBe(false)
  })

  it("should not match when preceded by word char", () => {
    fractionRegex.lastIndex = 0
    expect(fractionRegex.test("x1/2")).toBe(false)
  })

  it("should not match when followed by word char", () => {
    fractionRegex.lastIndex = 0
    expect(fractionRegex.test("1/2x")).toBe(false)
  })

  it("should not match when preceded by dot", () => {
    fractionRegex.lastIndex = 0
    expect(fractionRegex.test(".1/2")).toBe(false)
  })

  it("should not match when preceded by slash", () => {
    fractionRegex.lastIndex = 0
    expect(fractionRegex.test("/1/2")).toBe(false)
  })

  it("should match fractions in running text", () => {
    fractionRegex.lastIndex = 0
    const match = fractionRegex.exec("about 3/4 of the way")
    expect(match?.groups?.numerator).toBe("3")
    expect(match?.groups?.denominator).toBe("4")
  })

  it("should not match when followed by minus-sign + digit", () => {
    fractionRegex.lastIndex = 0
    expect(fractionRegex.test("1/2-3")).toBe(false)
  })
})

describe("wikilinkImageEmbedRegex stress", () => {
  const regex = /^\|?(?:(?<width>\d+)(?:x(?<height>\d+))?|(?<alt>.+))?$/

  it.each([
    ["|640x480", "640", "480", undefined],
    ["|640", "640", undefined, undefined],
    ["640x480", "640", "480", undefined],
    ["640", "640", undefined, undefined],
    ["100x200", "100", "200", undefined],
  ])("should parse dimensions from '%s'", (input, w, h, alt) => {
    const match = regex.exec(input)
    expect(match?.groups?.width).toBe(w)
    expect(match?.groups?.height).toBe(h)
    expect(match?.groups?.alt).toBe(alt)
  })

  it.each([
    ["|alt text", "alt text"],
    ["alt text", "alt text"],
    ["|my image", "my image"],
    ["2nd edition cover", "2nd edition cover"],
    ["figure (a)", "figure (a)"],
  ])("should parse alt from '%s'", (input, expectedAlt) => {
    const match = regex.exec(input)
    expect(match?.groups?.alt).toBe(expectedAlt)
    expect(match?.groups?.width).toBeUndefined()
  })

  it.each(["", "|"])("should handle '%s' (empty/pipe-only)", (input) => {
    const match = regex.exec(input)
    expect(match).not.toBeNull()
    expect(match?.groups?.width).toBeUndefined()
    expect(match?.groups?.alt).toBeUndefined()
  })

  it("should handle long alt text", () => {
    const longAlt = "word ".repeat(1000).trim()
    const match = regex.exec(`|${longAlt}`)
    expect(match?.groups?.alt).toBe(longAlt)
  })

  it("should handle large dimension numbers", () => {
    const match = regex.exec("99999x99999")
    expect(match?.groups?.width).toBe("99999")
    expect(match?.groups?.height).toBe("99999")
  })
})

describe("isRomanNumeral stress", () => {
  it.each([
    "II", "III", "IV", "VI", "VII", "VIII", "IX",
    "XI", "XII", "XIV", "XIX", "XX", "XL", "XC",
    "CD", "CM", "MMXXIV", "XLII", "XCIX",
    "IC", "ID", "IM",
    "CXLVIII", "MMMCMXCIX",
  ])("should match %s", (numeral) => {
    expect(isRomanNumeral(numeral)).toBe(true)
  })

  it.each([
    "I", "V", "X", "L", "C", "D", "M",
    "A", "HELLO", "abc", "123", "", "  ",
    "VV", "IIII",
  ])("should NOT match %s", (input) => {
    expect(isRomanNumeral(input)).toBe(false)
  })

  it("should handle roman numerals with punctuation in isRomanNumeral", () => {
    expect(isRomanNumeral("IV.")).toBe(true)
    expect(isRomanNumeral("XIV,")).toBe(true)
  })

  it("should handle long repeated M's", () => {
    expect(isRomanNumeral("MMM")).toBe(true)
    expect(isRomanNumeral("MMMM")).toBe(false)
  })
})

describe("REGEX_VERSION_NUMBER stress", () => {
  it.each(["V1", "v2", "V100", "v1.0", "v1.2.3", "V10.20.30"])(
    "should match %s",
    (input) => {
      REGEX_VERSION_NUMBER.lastIndex = 0
      expect(REGEX_VERSION_NUMBER.test(input)).toBe(true)
    },
  )

  it.each(["version", "Vault", "v", "V", "1.0", "abc", "vv1", "VV2"])(
    "should NOT match %s",
    (input) => {
      REGEX_VERSION_NUMBER.lastIndex = 0
      expect(REGEX_VERSION_NUMBER.test(input)).toBe(false)
    },
  )

  it("should match in context", () => {
    REGEX_VERSION_NUMBER.lastIndex = 0
    expect(REGEX_VERSION_NUMBER.test("using v2.1 for this")).toBe(true)
  })

  it("should not match inside a word", () => {
    REGEX_VERSION_NUMBER.lastIndex = 0
    expect(REGEX_VERSION_NUMBER.test("xv1")).toBe(false)
  })

  it("should handle deeply nested version", () => {
    REGEX_VERSION_NUMBER.lastIndex = 0
    expect(REGEX_VERSION_NUMBER.test("v1.2.3.4.5.6.7.8.9.10")).toBe(true)
  })
})

describe("REGEX_ALL_CAPS_PHRASE stress", () => {
  it.each([
    "THE BIG THING",
    "NATO FORCES",
    "AI AND ML",
  ])("should match multi-word phrase: %s", (input) => {
    REGEX_ALL_CAPS_PHRASE.lastIndex = 0
    expect(REGEX_ALL_CAPS_PHRASE.test(input)).toBe(true)
  })

  it.each([
    "hello world",
    "Hello",
    "AB",
  ])("should NOT match: %s", (input) => {
    REGEX_ALL_CAPS_PHRASE.lastIndex = 0
    expect(REGEX_ALL_CAPS_PHRASE.test(input)).toBe(false)
  })

  it("should handle phrases with hyphens", () => {
    REGEX_ALL_CAPS_PHRASE.lastIndex = 0
    expect(REGEX_ALL_CAPS_PHRASE.test("FIRST-ORDER LOGIC")).toBe(true)
  })

  it("should handle long all-caps input", () => {
    const longInput = ("ABC DEF " .repeat(500)).trim()
    REGEX_ALL_CAPS_PHRASE.lastIndex = 0
    const result = REGEX_ALL_CAPS_PHRASE.test(longInput)
    expect(typeof result).toBe("boolean")
  })
})

describe("capitalizeAfterEnding stress", () => {
  it.each([
    ["X", "X"],
    [". X", "X"],
    ["! Y", "Y"],
    ["? z", "z"],
    ["\nX", "X"],
    [". Ü", "Ü"],
  ])("should capture letter in '%s' → '%s'", (input, letter) => {
    capitalizeAfterEnding.lastIndex = 0
    const match = capitalizeAfterEnding.exec(input)
    expect(match?.groups?.letter).toBe(letter)
  })

  it.each(["e.g. X", "i.e. Y"])(
    "should not match after %s abbreviation",
    (input) => {
      capitalizeAfterEnding.lastIndex = 0
      expect(capitalizeAfterEnding.exec(input)).toBeNull()
    },
  )

  it("should match lowercase with i flag", () => {
    capitalizeAfterEnding.lastIndex = 0
    const match = capitalizeAfterEnding.exec(". x")
    expect(match?.groups?.letter).toBe("x")
  })
})

describe("editAdmonition stress (no trailing [*_]*)", () => {
  it("should capture full text without stripping emphasis", () => {
    const result = editAdmonition("Edit 1/2/2024: Fixed *the* bug")
    expect(result).toContain("Fixed *the* bug")
  })

  it("should handle text ending with emphasis markers", () => {
    const result = editAdmonition("Edit 1/1/23: Some text**")
    expect(result).toContain("Some text**")
  })

  it("should handle empty text", () => {
    const result = editAdmonition("Edit 1/1/23: ")
    expect(result).toContain("Edited on 1/1/23")
  })
})

describe("spaceAdmonitions stress (no dead lookahead)", () => {
  it("should add blank blockquote line after callout", () => {
    const result = spaceAdmonitions("> [!info] Title\n> Content")
    expect(result).toBe("> [!info] Title\n> \n> Content")
  })

  it("should handle nested blockquotes", () => {
    const input = "> > [!warning] Nested\n> > Text"
    const result = spaceAdmonitions(input)
    expect(result).toContain("> > [!warning] Nested\n> > \n> > Text")
  })

  it("should handle multiple callouts", () => {
    const input = "> [!info] First\n> text\n\n> [!warning] Second\n> more"
    const result = spaceAdmonitions(input)
    expect(result).toContain("> [!info] First\n> \n> text")
    expect(result).toContain("> [!warning] Second\n> \n> more")
  })
})

describe("buildPlaceholderRegex stress", () => {
  it("should return null for empty array", () => {
    expect(buildPlaceholderRegex([])).toBeNull()
  })

  it("should match placeholder spans", () => {
    const regex = buildPlaceholderRegex(["test"]) as RegExp
    expect(regex.test('<span class="populate-markdown-test"></span>')).toBe(true)
  })

  it("should not match other class names", () => {
    const regex = buildPlaceholderRegex(["test"]) as RegExp
    expect(regex.test('<span class="populate-markdown-other"></span>')).toBe(false)
  })

  it("should escape special regex chars in names", () => {
    const regex = buildPlaceholderRegex(["test.name"]) as RegExp
    expect(regex.test('<span class="populate-markdown-test.name"></span>')).toBe(true)
    expect(regex.test('<span class="populate-markdown-testXname"></span>')).toBe(false)
  })

  it.each(["alpha", "beta", "gamma"])(
    "should match placeholder for %s in multi-source regex",
    (name) => {
      const regex = buildPlaceholderRegex(["alpha", "beta", "gamma"]) as RegExp
      expect(regex.test(`<span class="populate-markdown-${name}"></span>`)).toBe(true)
    },
  )

  it("should NOT match unlisted source name in multi-source regex", () => {
    const regex = buildPlaceholderRegex(["alpha", "beta", "gamma"]) as RegExp
    expect(regex.test('<span class="populate-markdown-delta"></span>')).toBe(false)
  })
})

describe("SVG_COLOR_PROP_RE stress", () => {
  const SVG_COLOR_ATTRS = [
    "fill", "stroke", "stop-color", "color", "flood-color", "lighting-color",
  ] as const
  const SVG_COLOR_PROP_RE = new RegExp(
    `(?<prop>${SVG_COLOR_ATTRS.join("|")})\\s*:\\s*(?<value>\\S[^;}"']*)`,
    "gi",
  )

  it.each([
    ["fill: red", "fill", "red"],
    ["stroke:#000", "stroke", "#000"],
    ["color : rgb(0,0,0)", "color", "rgb(0,0,0)"],
    ["fill:  blue;", "fill", "blue"],
    ["stop-color: #ff0000", "stop-color", "#ff0000"],
  ])("should parse '%s' → prop=%s value=%s", (input, prop, value) => {
    SVG_COLOR_PROP_RE.lastIndex = 0
    const match = SVG_COLOR_PROP_RE.exec(input)
    expect(match?.groups?.prop).toBe(prop)
    expect(match?.groups?.value).toBe(value)
  })

  it("should not match values starting with whitespace-only", () => {
    SVG_COLOR_PROP_RE.lastIndex = 0
    expect(SVG_COLOR_PROP_RE.test("fill:   ")).toBe(false)
  })

  it("should stop at semicolons", () => {
    SVG_COLOR_PROP_RE.lastIndex = 0
    const match = SVG_COLOR_PROP_RE.exec("fill: red; stroke: blue")
    expect(match?.groups?.value).toBe("red")
  })

  it("should handle CSS custom properties", () => {
    SVG_COLOR_PROP_RE.lastIndex = 0
    const match = SVG_COLOR_PROP_RE.exec("fill: var(--my-color)")
    expect(match?.groups?.value).toBe("var(--my-color)")
  })
})
