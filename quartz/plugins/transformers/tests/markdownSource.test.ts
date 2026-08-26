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
    { name: "a single backtick", input: "a `code` b" },
    { name: "a two-backtick run", input: "a\n``\nb" },
    { name: "a run of two tildes", input: "a\n~~\nb" },
    { name: "a fence indented four spaces", input: "a\n    ```\nb" },
    { name: "a line of other characters", input: "a\n---\nb" },
  ])("treats $name as prose, not a fence", ({ input }) => {
    expect(transformOutsideCode(input, shout)).toBe(input.toUpperCase())
  })

  it("hands each prose run to the transform as one chunk", () => {
    const chunks: string[] = []
    transformOutsideCode("a\nb\n```\ncode\n```\nc", (chunk) => {
      chunks.push(chunk)
      return chunk
    })
    expect(chunks).toEqual(["a\nb", "c"])
  })

  it("does not invoke the transform when there is no prose", () => {
    const chunks: string[] = []
    transformOutsideCode("```\ncode\n```", (chunk) => {
      chunks.push(chunk)
      return chunk
    })
    expect(chunks).toEqual([])
  })

  it("keeps a multi-line replacement produced by the transform", () => {
    expect(transformOutsideCode("a\n```\nx\n```", (chunk) => `${chunk}\n${chunk}`)).toBe(
      "a\na\n```\nx\n```",
    )
  })
})
