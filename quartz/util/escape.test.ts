import { describe, it, expect } from "@jest/globals"

import { escapeHTML, escapeRegExp } from "./escape"

describe("escapeHTML", () => {
  it("should escape all HTML special characters", () => {
    const input = '<script>alert("XSS");</script> & \'test\''
    const expected = "&lt;script&gt;alert(&quot;XSS&quot;);&lt;/script&gt; &amp; &#039;test&#039;"
    expect(escapeHTML(input)).toBe(expected)
  })

  it("should escape ampersands", () => {
    expect(escapeHTML("foo & bar")).toBe("foo &amp; bar")
  })

  it("should escape less-than signs", () => {
    expect(escapeHTML("a < b")).toBe("a &lt; b")
  })

  it("should escape greater-than signs", () => {
    expect(escapeHTML("a > b")).toBe("a &gt; b")
  })

  it("should escape double quotes", () => {
    expect(escapeHTML('say "hello"')).toBe("say &quot;hello&quot;")
  })

  it("should escape single quotes", () => {
    expect(escapeHTML("it's")).toBe("it&#039;s")
  })

  it("should not modify strings without special characters", () => {
    const input = "Hello World 123"
    expect(escapeHTML(input)).toBe(input)
  })

  it("should handle empty strings", () => {
    expect(escapeHTML("")).toBe("")
  })

  it("should handle strings with multiple ampersands", () => {
    expect(escapeHTML("a & b & c")).toBe("a &amp; b &amp; c")
  })
})

describe("escapeRegExp", () => {
  it("should escape special regex characters", () => {
    const specialChars = ".*+?^${}()|[]\\"
    const escaped = escapeRegExp(specialChars)
    expect(escaped).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\")
  })

  it("should not escape normal characters", () => {
    const normalChars = "abcdefg123"
    const escaped = escapeRegExp(normalChars)
    expect(escaped).toBe(normalChars)
  })

  it("should handle empty strings", () => {
    expect(escapeRegExp("")).toBe("")
  })

  it("should escape dots (wildcard)", () => {
    expect(escapeRegExp("test.com")).toBe("test\\.com")
  })

  it("should escape brackets", () => {
    // escape-string-regexp escapes hyphens inside character classes as \x2d
    expect(escapeRegExp("[a-z]")).toBe("\\[a\\x2dz\\]")
  })

  it("should escape parentheses", () => {
    expect(escapeRegExp("(group)")).toBe("\\(group\\)")
  })

  it("should produce valid regex patterns", () => {
    const unsafePattern = "test.com/path?query=1"
    const escapedPattern = escapeRegExp(unsafePattern)
    const regex = new RegExp(escapedPattern)
    expect(regex.test(unsafePattern)).toBe(true)
    expect(regex.test("testXcom/pathXquery=1")).toBe(false)
  })
})
