import { describe, expect, it } from "@jest/globals"

import {
  clipPiece,
  mapValueToSource,
  sourceRange,
  textNodeEdits,
  tokenizeSource,
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
    ["angle autolinks", "<https://x.com/a...b>", "<https://x.com/a...b>"],
    ["autolinks with references", "<https://a.com/?x&amp;y...>", "<https://a.com/?x&amp;y...>"],
    ["shortcut references", "[foo--bar]\n\n[foo--bar]: /u", "[foo--bar]\n\n[foo--bar]: /u"],
    ["collapsed references", "[foo--bar][]\n\n[foo--bar]: /u", "[foo--bar][]\n\n[foo--bar]: /u"],
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
    [
      "literal autolink beside prose",
      'see https://x.com/2020-2021 "q"',
      "see https://x.com/2020-2021 “q”",
    ],
    ["full reference label", "[a--b][r]\n\n[r]: /u", "[a—b][r]\n\n[r]: /u"],
    ["inline link text", "[x--y](http://u--v)", "[x—y](http://u--v)"],
    ["escaped > after blockquote marker", "> a\n> \\>= b", "> a\n> ≥ b"],
    ["nested containers", '> - "a\n>   b"', "> - “a\n>   b”"],
    ["CRLF line endings", '"a"\r\n"b"', "“a”\r\n“b”"],
    ["astral characters", '"😀 x"', "“😀 x”"],
    [
      "URL found by the autolink transform",
      'He said "see https://x.com/a...b"',
      "He said “see https://x.com/a...b”",
    ],
    [
      "transform URL between siblings",
      '*a* "|https://x.com/a--b" *c*',
      "*a* “|https://x.com/a--b” *c*",
    ],
    ["transform email after an escape", '"hi" a\\_b@example.com...', "“hi” a\\_b@example.com…"],
    ["paragraph that is wholly a transform run", 'a\\_b@example.com "q"', "a\\_b@example.com “q”"],
    ["task list items", '- [ ] "a"\n- [x] b...', "- [ ] “a”\n- [x] b…"],
  ])("transforms %s", (_label, input, expected) => {
    expect(transformMarkdownSource(input, config)).toBe(expected)
  })
})

describe("tokenizeSource", () => {
  it("splits text into literal, escape, reference, and line-ending pieces", () => {
    expect(tokenizeSource("> a\n> \\>= &amp;")).toEqual({
      pieces: [
        { start: 2, end: 3, text: "a", literal: true },
        { start: 3, end: 4, text: "\n", literal: true },
        { start: 6, end: 8, text: ">", literal: false },
        { start: 8, end: 10, text: "= ", literal: true },
        { start: 10, end: 15, text: "&", literal: false },
      ],
      autolinks: [],
    })
  })

  it("records autolink ranges", () => {
    expect(tokenizeSource("<https://a.b> www.c.d").autolinks).toEqual([
      { start: 0, end: 13 },
      { start: 14, end: 21 },
    ])
  })
})

describe("sourceRange", () => {
  const point = (offset?: number) => ({ line: 1, column: 1, offset })
  it.each([
    ["no position", {}, undefined],
    ["a missing end offset", { position: { start: point(0), end: point() } }, undefined],
    ["both offsets", { position: { start: point(1), end: point(3) } }, { start: 1, end: 3 }],
  ])("returns the range for %s", (_label, fields, expected) => {
    expect(sourceRange({ type: "text", ...fields })).toEqual(expected)
  })
})

describe("clipPiece", () => {
  const range = { start: 2, end: 4 }
  it.each([
    [
      "trims a literal piece",
      { start: 0, end: 6, text: "abcdef", literal: true },
      { start: 2, end: 4, text: "cd", literal: true },
    ],
    [
      "keeps a contained literal piece",
      { start: 2, end: 4, text: "cd", literal: true },
      { start: 2, end: 4, text: "cd", literal: true },
    ],
    [
      "keeps an escape whole",
      { start: 2, end: 4, text: "[", literal: false },
      { start: 2, end: 4, text: "[", literal: false },
    ],
  ])("%s", (_label, piece, expected) => {
    expect(clipPiece(piece, range)).toEqual(expected)
  })
})

describe("mapValueToSource", () => {
  it("maps literal units one-to-one and escaped units to their whole token", () => {
    const pieces = [
      { start: 0, end: 2, text: "ab", literal: true },
      { start: 2, end: 8, text: "&", literal: false },
    ]
    expect(mapValueToSource("ab&", pieces)).toEqual({ starts: [0, 1, 2], ends: [1, 2, 8] })
  })

  it("throws when the pieces do not spell the value", () => {
    expect(() => mapValueToSource("x", [{ start: 0, end: 1, text: "y", literal: true }])).toThrow(
      /do not match/,
    )
  })
})

describe("textNodeEdits", () => {
  const identity = (length: number) => ({
    starts: Array.from({ length }, (_, i) => 10 + i),
    ends: Array.from({ length }, (_, i) => 11 + i),
  })

  it.each([
    ["replacement", "a...", "a…", [{ start: 11, end: 14, text: "…" }]],
    ["deletion", "a  b", "a b", [{ start: 12, end: 13, text: "" }]],
    ["insertion mid-value", "ab", "aXb", [{ start: 11, end: 11, text: "X" }]],
    ["insertion at end", "ab", "abX", [{ start: 12, end: 12, text: "X" }]],
  ])("produces a %s edit", (_label, original, transformed, expected) => {
    expect(textNodeEdits(identity(original.length), original, transformed)).toEqual(expected)
  })

  it("removes the next line's container prefix along with a line break", () => {
    const map = { starts: [0, 1, 4], ends: [1, 2, 5] }
    expect(textNodeEdits(map, "a\nb", "ab")).toEqual([{ start: 1, end: 4, text: "" }])
  })
})
