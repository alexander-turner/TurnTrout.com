import { describe, expect, it } from "@jest/globals"

import { transformOutsideCode } from "../markdownSource"

describe("transformOutsideCode", () => {
  const shout = (chunk: string): string => chunk.toUpperCase()

  it.each([
    { name: "plain prose", input: "hello there", expected: "HELLO THERE" },
    {
      name: "a backtick fence",
      input: "before\n```js\nlet x\n```\nafter",
      expected: "BEFORE\n```js\nlet x\n```\nAFTER",
    },
    {
      name: "a tilde fence",
      input: "before\n~~~py\nx = 1\n~~~\nafter",
      expected: "BEFORE\n~~~py\nx = 1\n~~~\nAFTER",
    },
    {
      name: "a fence indented up to three spaces",
      input: "before\n   ```\nlet x\n   ```\nafter",
      expected: "BEFORE\n   ```\nlet x\n   ```\nAFTER",
    },
    {
      // CommonMark closes a fence on any line of the same marker that is at
      // least as long, so the 5-backtick line ends the 3-backtick block.
      name: "a block closed by a longer fence, resuming prose after it",
      input: "a\n```\ninner\n`````\nstill prose\n```\nb",
      expected: "A\n```\ninner\n`````\nSTILL PROSE\n```\nb",
    },
    {
      name: "backticks nested inside a tilde fence",
      input: "a\n~~~\n```\ncode\n```\n~~~\nb",
      expected: "A\n~~~\n```\ncode\n```\n~~~\nB",
    },
    {
      name: "a fence closed only by end of input",
      input: "a\n```js\nunterminated",
      expected: "A\n```js\nunterminated",
    },
    {
      name: "a fence opening the input",
      input: "```\ncode\n```\ntail",
      expected: "```\ncode\n```\nTAIL",
    },
    {
      name: "an info string on the closing line, which opens a new fence",
      input: "a\n```\ncode\n``` js\nb",
      expected: "A\n```\ncode\n``` js\nb",
    },
    {
      name: "consecutive fences",
      input: "a\n```\none\n```\nmid\n```\ntwo\n```\nz",
      expected: "A\n```\none\n```\nMID\n```\ntwo\n```\nZ",
    },
  ])("leaves $name intact", ({ input, expected }) => {
    expect(transformOutsideCode(input, shout)).toBe(expected)
  })

  it.each([
    {
      name: "an indented code block",
      input: "intro\n\n    let x = 1\n\nouttro",
      expected: "INTRO\n\n    let x = 1\n\nOUTTRO",
    },
    {
      name: "a fenced block inside a list item",
      input: "- item\n\n  ```js\n  let x\n  ```\n\ntail",
      expected: "- ITEM\n\n  ```js\n  let x\n  ```\n\nTAIL",
    },
  ])("leaves $name intact", ({ input, expected }) => {
    expect(transformOutsideCode(input, shout)).toBe(expected)
  })

  it.each([
    { name: "an inline code span", input: "say `n := 5` loudly" },
    { name: "a double-backtick span", input: "a ``x ` y`` b" },
  ])(
    // Inline code sits mid-line, and cutting there would let the `^`/`$`
    // anchors these transforms use read a chunk edge as a line boundary. The
    // mdast passes protect it instead, where it is a node rather than a range.
    "hands $name to the transform, leaving it to the mdast passes",
    ({ input }) => {
      expect(transformOutsideCode(input, shout)).toBe(input.toUpperCase())
    },
  )

  it.each([
    { name: "an unmatched backtick", input: "a ` b" },
    { name: "a two-backtick run on its own line", input: "a\n``\nb" },
    { name: "a run of two tildes", input: "a\n~~\nb" },
    { name: "four spaces continuing a list item", input: "- one\n\n    still the item\n" },
    { name: "a line of other characters", input: "a\n---\nb" },
  ])("treats $name as prose, not code", ({ input }) => {
    expect(transformOutsideCode(input, shout)).toBe(input.toUpperCase())
  })

  it("passes prose to the transform as exact source slices", () => {
    const chunks: string[] = []
    transformOutsideCode("a\nb\n```\ncode\n```\nc", (chunk) => {
      chunks.push(chunk)
      return chunk
    })
    expect(chunks).toEqual(["a\nb\n", "\nc"])
  })

  it("reproduces the source exactly when the transform is the identity", () => {
    const source = "intro `x` mid\n\n```js\nlet y\n```\n\n    indented\n\ntail"
    expect(transformOutsideCode(source, (chunk) => chunk)).toBe(source)
  })

  it("keeps a multi-line replacement produced by the transform", () => {
    expect(transformOutsideCode("a\n```\nx\n```", (chunk) => `${chunk}|${chunk}`)).toBe(
      "a\n|a\n```\nx\n```",
    )
  })
})
