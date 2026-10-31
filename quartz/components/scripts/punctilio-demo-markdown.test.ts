import { describe, expect, it } from "@jest/globals"

import {
  alignValueToSource,
  sourceEditsForNode,
  textNodeEdits,
  transformMarkdownSource,
} from "./punctilio-demo-markdown"

const config = {}

describe("transformMarkdownSource", () => {
  it.each([
    ["bare brackets", "See [note] and [^1] and [[wiki]].", "See [note] and [^1] and [[wiki]]."],
    ["links", 'A [link](http://x.com "title") here.', 'A [link](http://x.com "title") here.'],
    ["underscores", "snake_case_name", "snake_case_name"],
    ["list markers", "- one\n+ two\n", "- one\n+ two\n"],
    ["tables", "| a | b |\n|---|:-:|\n| x | y |\n", "| a | b |\n|---|:-:|\n| x | y |\n"],
    ["thematic breaks", "a\n\n***\n\nb\n", "a\n\n***\n\nb\n"],
    ["inline code", 'Use `"raw"` here', 'Use `"raw"` here'],
  ])("preserves %s verbatim", (_label, input, expected) => {
    expect(transformMarkdownSource(input, config)).toBe(expected)
  })

  it.each([
    ["quotes and em dash", 'She said "hi" --- [a] *b*', "She said “hi”—[a] *b*"],
    ["escaped brackets kept", 'Say "hi" \\[x\\] "bye"', "Say “hi” \\[x\\] “bye”"],
    ["character reference replaced", "&quot;hi&quot;", "“hi”"],
    ["blockquote continuation", '> "a\n> b"', "> “a\n> b”"],
    ["list item text", '- "one" -- two\n* x', "- “one”—two\n* x"],
    ["table cell", '| "a" |\n|---|\n| b... |\n', "| “a” |\n|---|\n| b… |\n"],
    ["quote spanning emphasis", '"*hi*"', "“*hi*”"],
  ])("transforms %s", (_label, input, expected) => {
    expect(transformMarkdownSource(input, config)).toBe(expected)
  })
})

describe("sourceEditsForNode", () => {
  it("locates edits via the node's offsets", () => {
    const node = {
      type: "text" as const,
      value: "“a”",
      position: {
        start: { line: 1, column: 3, offset: 2 },
        end: { line: 1, column: 6, offset: 5 },
      },
    }
    expect(sourceEditsForNode('x "a" y', node, '"a"')).toEqual([
      { start: 2, end: 3, text: "“" },
      { start: 4, end: 5, text: "”" },
    ])
  })

  it("throws when the node lacks source offsets", () => {
    expect(() => sourceEditsForNode("a", { type: "text", value: "b" }, "a")).toThrow(
      /missing source offsets/,
    )
  })
})

describe("alignValueToSource", () => {
  it.each([
    ["abc", "abc", [0, 1, 2], [1, 2, 3]],
    ["\\[a", "[a", [0, 2], [2, 3]],
    ["&amp;b", "&b", [0, 5], [5, 6]],
    ["a\n> b", "a\nb", [0, 1, 4], [1, 2, 5]],
    ["\\a", "\\a", [0, 1], [1, 2]],
    ["&bogus;", "&bogus;", [0, 1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6, 7]],
  ])("aligns %j to %j", (source, value, starts, ends) => {
    expect(alignValueToSource(source, value)).toEqual({ starts, ends })
  })

  it("throws when the value cannot be found in the source", () => {
    expect(() => alignValueToSource("abc", "xyz")).toThrow(/Could not align/)
  })
})

describe("textNodeEdits", () => {
  it.each([
    ["replacement", "a...", "a…", [{ start: 11, end: 14, text: "…" }]],
    ["deletion", "a  b", "a b", [{ start: 12, end: 13, text: "" }]],
    ["insertion mid-value", "ab", "aXb", [{ start: 11, end: 11, text: "X" }]],
    ["insertion at end", "ab", "abX", [{ start: 12, end: 12, text: "X" }]],
  ])("produces a %s edit", (_label, original, transformed, expected) => {
    expect(textNodeEdits(original, 10, original, transformed)).toEqual(expected)
  })
})
