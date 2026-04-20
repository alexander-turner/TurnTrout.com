import { describe, it, expect } from "@jest/globals"

import {
  MAX_CHAR_DIFF_LENGTH,
  escapeForOutput,
  renderCharDiff,
  renderChangedLinePair,
  renderDiffHtml,
  renderPrefixSuffixDiff,
} from "./punctilio-demo-diff"

describe("escapeForOutput", () => {
  it.each([
    ["plain text", "plain text"],
    ["<b>bold</b>", "&lt;b&gt;bold&lt;/b&gt;"],
    ['"quoted"', "&quot;quoted&quot;"],
    ["a & b", "a &amp; b"],
    ["line1\nline2", "line1<br>line2"],
    ["a\nb\nc", "a<br>b<br>c"],
    ["", ""],
  ])("escapes %j to %j", (input, expected) => {
    expect(escapeForOutput(input)).toBe(expected)
  })
})

describe("renderCharDiff", () => {
  const change = (value: string, flags: { added?: boolean; removed?: boolean } = {}) => ({
    value,
    added: flags.added ?? false,
    removed: flags.removed ?? false,
    count: value.length,
  })

  it("renders unchanged text as plain", () => {
    expect(renderCharDiff([change("abc")])).toBe("abc")
  })

  it("wraps added text in diff-insert span", () => {
    expect(renderCharDiff([change("xyz", { added: true })])).toBe(
      '<span class="diff-insert">xyz</span>',
    )
  })

  it("drops removed text entirely", () => {
    expect(renderCharDiff([change("gone", { removed: true })])).toBe("")
  })

  it("escapes HTML in all branches and replaces newlines with <br>", () => {
    expect(
      renderCharDiff([
        change("a\n<"),
        change('b"', { added: true }),
        change("c&", { removed: true }),
      ]),
    ).toBe('a<br>&lt;<span class="diff-insert">b&quot;</span>')
  })

  it("returns empty string for no changes", () => {
    expect(renderCharDiff([])).toBe("")
  })
})

describe("renderPrefixSuffixDiff", () => {
  it.each([
    // Full replacement (no shared chars)
    ["abc", "xyz", '<span class="diff-insert">xyz</span>'],
    // Identical -> no highlight
    ["same", "same", "same"],
    // Change in the middle
    ["abXcd", "abYZcd", 'ab<span class="diff-insert">YZ</span>cd'],
    // Pure append (new longer)
    ["abc", "abcXYZ", 'abc<span class="diff-insert">XYZ</span>'],
    // Pure truncation (old longer, new is prefix)
    ["abcXYZ", "abc", "abc"],
    // Pure prepend
    ["cd", "abcd", '<span class="diff-insert">ab</span>cd'],
    // Empty old
    ["", "new", '<span class="diff-insert">new</span>'],
    // Empty new
    ["old", "", ""],
    // Both empty
    ["", "", ""],
    // Single-char difference
    ["hello", "hallo", 'h<span class="diff-insert">a</span>llo'],
  ])("diffs %j -> %j as %j", (oldText, newText, expected) => {
    expect(renderPrefixSuffixDiff(oldText, newText)).toBe(expected)
  })

  it("escapes HTML in prefix, middle, and suffix", () => {
    expect(renderPrefixSuffixDiff('<a>"x"</a>', '<a>"y"</a>')).toBe(
      '&lt;a&gt;&quot;<span class="diff-insert">y</span>&quot;&lt;/a&gt;',
    )
  })

  it("merges multiple disjoint changes into one span (documented trade-off)", () => {
    // Two separate edits: "X" -> "Y" and "P" -> "Q". Prefix/suffix collapses
    // everything between the first and last divergence into a single span.
    expect(renderPrefixSuffixDiff("aXbbbPc", "aYbbbQc")).toBe(
      'a<span class="diff-insert">YbbbQ</span>c',
    )
  })
})

describe("renderChangedLinePair", () => {
  it("uses precise char-diff below the threshold", () => {
    const html = renderChangedLinePair("hello", "hallo")
    // Myers char-diff splits the single-char substitution into a char-granular span
    expect(html).toContain('<span class="diff-insert">a</span>')
    expect(html).not.toContain('<span class="diff-insert">allo</span>')
  })

  it("falls back to prefix/suffix above the threshold", () => {
    // Build inputs whose combined length exceeds MAX_CHAR_DIFF_LENGTH, with
    // edits scattered enough that char-diff would produce multiple spans.
    const size = MAX_CHAR_DIFF_LENGTH
    const oldText = "X" + "a".repeat(size) + "Y" + "b".repeat(size) + "Z"
    const newText = "P" + "a".repeat(size) + "Q" + "b".repeat(size) + "R"
    const html = renderChangedLinePair(oldText, newText)
    // Prefix/suffix merges the three separate edits into exactly one span
    expect(html.match(/class="diff-insert"/g)?.length).toBe(1)
    // And that span contains the entire divergent middle of the new text
    expect(html).toContain(`P${"a".repeat(size)}Q${"b".repeat(size)}R`)
  })
})

describe("renderDiffHtml", () => {
  it("returns unchanged text as-is when source equals result", () => {
    expect(renderDiffHtml("hello world", "hello world")).toBe("hello world")
  })

  it("returns empty string for two empty inputs", () => {
    expect(renderDiffHtml("", "")).toBe("")
  })

  it("highlights char-level edits on a single line", () => {
    const html = renderDiffHtml('"hi"', "\u201chi\u201d")
    expect(html).toContain('<span class="diff-insert">\u201c</span>')
    expect(html).toContain('<span class="diff-insert">\u201d</span>')
    // The unchanged "hi" in the middle must not be wrapped in a diff-insert
    expect(html).toMatch(/<\/span>hi<span/)
  })

  it("escapes HTML in both unchanged and added text", () => {
    expect(renderDiffHtml("<a>", '<a>"')).toBe('&lt;a&gt;<span class="diff-insert">&quot;</span>')
  })

  it("renders newlines in unchanged lines as <br>", () => {
    expect(renderDiffHtml("a\nb\n", "a\nb\n")).toBe("a<br>b<br>")
  })

  it("handles multi-line input: unchanged lines are plain, changed lines are refined", () => {
    const source = "line one\nline two\nline three\n"
    const result = 'line one\nline "two"\nline three\n'
    const html = renderDiffHtml(source, result)
    expect(html).toContain("line one<br>")
    expect(html).toContain("line three<br>")
    // Only the middle line carries diff-insert markers
    expect(html).toContain('<span class="diff-insert">&quot;</span>')
  })

  it("wraps a pure line insertion (no paired removal) in a single diff-insert span", () => {
    // Inserting a brand-new line between two unchanged lines
    const html = renderDiffHtml("a\nc\n", "a\nb\nc\n")
    expect(html).toBe('a<br><span class="diff-insert">b<br></span>c<br>')
  })

  it("emits nothing for a pure line removal", () => {
    // Removing a line should leave no trace in the rendered result
    const html = renderDiffHtml("a\nb\nc\n", "a\nc\n")
    // Only the surviving lines appear, with no diff-insert span
    expect(html).toBe("a<br>c<br>")
    expect(html).not.toContain("diff-insert")
  })

  it("uses the linear fallback on long single-line input without corrupting output", () => {
    // Single-line input well above the char-diff threshold with one edit in
    // the middle. Linear prefix/suffix must produce the same visible result.
    const filler = "a".repeat(MAX_CHAR_DIFF_LENGTH)
    const source = `${filler}X${filler}`
    const result = `${filler}Y${filler}`
    expect(renderDiffHtml(source, result)).toBe(
      `${filler}<span class="diff-insert">Y</span>${filler}`,
    )
  })
})
