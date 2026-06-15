import type { Node as UnistNode } from "unist"

import { describe, expect, it, jest } from "@jest/globals"
import { type Element } from "hast"
import { h } from "hastscript"

import { NBSP, twemojiBaseUrl, WORD_JOINER } from "../../../components/constants"
import {
  constructTwemojiUrl,
  createNodes,
  glueEmojiToPrecedingText,
  ignoreMap,
  parseAttributes,
  processTree,
  replaceEmoji,
  replaceEmojiConvertArrows,
  Twemoji,
  TwemojiOptions,
} from "../twemoji"

interface CustomNode extends UnistNode {
  children?: CustomNode[]
  value?: string
}

function createEmoji(path: string, originalChar: string): Element {
  if (!path.endsWith(".svg")) {
    throw new Error("Only SVGs are supported")
  }
  return h("img", {
    alt: originalChar,
    className: ["emoji"],
    draggable: "false",
    src: `${twemojiBaseUrl}${path}`,
  })
}

jest.mock("../modules/twemoji.min", () => ({
  twemoji: {
    parse: jest.fn((content: string) =>
      content.replace(
        /😀/gu,
        `<img class="emoji" draggable="false" alt="😀" src="${twemojiBaseUrl}1f600.svg"/>`,
      ),
    ),
  },
}))

type TwemojiCallback = (icon: string, options: TwemojiOptions) => string

describe("Twemoji functions", () => {
  describe("constructTwemojiUrl", () => {
    it("should return the correct URL", () => {
      const mockCallback: TwemojiCallback = jest.fn((icon) => `mock-${icon}`)
      const options: TwemojiOptions = { folder: "svg", ext: ".svg", callback: mockCallback }
      const result = constructTwemojiUrl("1f600", options)
      expect(result).toBe(`${twemojiBaseUrl}1f600.svg`)
    })
  })

  describe("parseAttributes", () => {
    it("should parse attributes correctly", () => {
      const imgTag = '<img src="test.png" alt="test" width="20" height="20">'
      const result = parseAttributes(imgTag)
      expect(result).toEqual({
        src: "test.png",
        alt: "test",
        width: "20",
        height: "20",
      })
    })

    it.each([
      {
        description: "empty string",
        input: "",
        expected: {},
      },
      {
        description: "string with no attributes",
        input: "no attributes here",
        expected: {},
      },
      {
        description: "malformed attributes",
        input: '<img src="test.png" malformed width="20">',
        expected: {
          src: "test.png",
          width: "20",
        },
      },
      {
        description: "attributes without quotes (returns empty object)",
        input: "<img src=test.png alt=test>",
        expected: {},
      },
    ])("should handle $description", ({ input, expected }) => {
      const result = parseAttributes(input)
      expect(result).toEqual(expected)
    })

    it("should test reduce function with multiple quoted attributes", () => {
      // This should exercise the reduce arrow function more thoroughly
      const imgTag = '<img class="emoji" draggable="false" alt="test" src="test.png" width="20">'
      const result = parseAttributes(imgTag)
      expect(result).toEqual({
        class: "emoji",
        draggable: "false",
        alt: "test",
        src: "test.png",
        width: "20",
      })
    })
  })

  describe("replaceEmoji", () => {
    it("should replace emoji using twemoji.parse", () => {
      const content = "Hello 😀"
      const result = replaceEmoji(content)
      expect(result).toBe(
        `Hello <img class="emoji" draggable="false" alt="😀" src="${twemojiBaseUrl}1f600.svg"/>`,
      )
    })

    it("should replace emojisToReplace with replacement path", () => {
      const contentWithEmojiPath = `Hello <img src="${twemojiBaseUrl}twemoji/1fabf.svg">`
      const result = replaceEmoji(contentWithEmojiPath)
      expect(result).toBe(`Hello <img src="${twemojiBaseUrl}twemoji/replacements/1fabf.svg">`)
    })

    it("should handle content with no emoji", () => {
      const content = "Hello world"
      const result = replaceEmoji(content)
      expect(result).toBe("Hello world")
    })

    it("should replace multiple emojis in a row on the same line", () => {
      const content = "Hello 🪿🪿"
      const result = replaceEmoji(content)
      expect(result).toBe(
        `Hello <img class="emoji" draggable="false" alt="🪿" src="${twemojiBaseUrl}replacements/1fabf.svg"/><img class="emoji" draggable="false" alt="🪿" src="${twemojiBaseUrl}replacements/1fabf.svg"/>`,
      )
    })

    it("should process all emojis in emojisToReplace array", () => {
      const contentWithMultipleEmojis = `<img src="${twemojiBaseUrl}twemoji/1fabf.svg"> and other content`
      const result = replaceEmoji(contentWithMultipleEmojis)
      expect(result).toBe(
        `<img src="${twemojiBaseUrl}twemoji/replacements/1fabf.svg"> and other content`,
      )
    })
  })

  describe("replaceEmojiConvertArrows", () => {
    it("should convert ↩ to ⤴", () => {
      const content = "Hello ↩ world"
      const result = replaceEmojiConvertArrows(content)
      expect(result).toBe("Hello ⤴ world")
    })

    it("should preserve ignored characters during emoji processing", () => {
      const content = "Hello ⤴ ⇔ ↗ world"
      const result = replaceEmojiConvertArrows(content)
      expect(result).toBe("Hello ⤴ ⇔ ↗ world")
    })

    it("should handle content with emoji and arrow conversion", () => {
      const content = "Hello ↩ 😀"
      const result = replaceEmojiConvertArrows(content)
      expect(result).toBe(
        `Hello ⤴${NBSP}${WORD_JOINER}<img class="emoji" draggable="false" alt="😀" src="${twemojiBaseUrl}1f600.svg"/>`,
      )
    })
  })

  describe("glueEmojiToPrecedingText", () => {
    const img = `<img class="emoji" draggable="false" alt="😀" src="${twemojiBaseUrl}1f600.svg"/>`
    const img2 = `<img class="emoji" draggable="false" alt="👋" src="${twemojiBaseUrl}1f44b.svg"/>`

    it.each([
      {
        description: "converts a preceding space to NBSP and inserts a word joiner",
        input: `Hello ${img}`,
        expected: `Hello${NBSP}${WORD_JOINER}${img}`,
      },
      {
        description: "inserts a word joiner after a non-space character",
        input: `Hello${img}`,
        expected: `Hello${WORD_JOINER}${img}`,
      },
      {
        description: "leaves a content-leading emoji untouched",
        input: `${img} Hello`,
        expected: `${img} Hello`,
      },
      {
        description: "glues a leading emoji that follows a space",
        input: ` ${img}`,
        expected: `${NBSP}${WORD_JOINER}${img}`,
      },
      {
        description: "glues each emoji when separated by a space",
        input: `${img} ${img2}`,
        expected: `${img}${NBSP}${WORD_JOINER}${img2}`,
      },
      {
        description: "glues a second emoji adjacent to the first",
        input: `${img}${img2}`,
        expected: `${img}${WORD_JOINER}${img2}`,
      },
      {
        description: "leaves content without emoji untouched",
        input: "Hello world",
        expected: "Hello world",
      },
    ])("$description", ({ input, expected }) => {
      expect(glueEmojiToPrecedingText(input)).toBe(expected)
    })
  })

  function createEmoji(path: string, originalChar: string): Element {
    if (!path.endsWith(".svg")) {
      throw new Error("Only SVGs are supported")
    }
    return {
      type: "element",
      tagName: "img",
      children: [],
      properties: {
        alt: originalChar,
        className: ["emoji"],
        draggable: "false",
        src: `${twemojiBaseUrl}${path}`,
      },
    }
  }

  describe("createNodes", () => {
    it.each([
      {
        description: "a string with no emoji",
        input: "Hello, world!",
        expected: [{ type: "text", value: "Hello, world!" }],
      },
      {
        description: "a string with a single emoji",
        input: `Hello! <img class="emoji" draggable="false" alt="👋" src="${twemojiBaseUrl}1f44b.svg">`,
        expected: [{ type: "text", value: "Hello! " }, createEmoji("1f44b.svg", "👋")],
      },
      {
        description: "a string with multiple emoji",
        input: `Hello! <img class="emoji" draggable="false" alt="👋" src="${twemojiBaseUrl}1f44b.svg"> How are you? <img class="emoji" draggable="false" alt="😊" src="${twemojiBaseUrl}1f60a.svg">`,
        expected: [
          { type: "text", value: "Hello! " },
          createEmoji("1f44b.svg", "👋"),
          { type: "text", value: " How are you? " },
          createEmoji("1f60a.svg", "😊"),
        ],
      },
      {
        description: "a string starting with an emoji",
        input: `<img class="emoji" draggable="false" alt="👋" src="${twemojiBaseUrl}1f44b.svg"> Hello!`,
        expected: [createEmoji("1f44b.svg", "👋"), { type: "text", value: " Hello!" }],
      },
      {
        description: "a string ending with an emoji",
        input: `Goodbye! <img class="emoji" draggable="false" alt="👋" src="${twemojiBaseUrl}1f44b.svg">`,
        expected: [{ type: "text", value: "Goodbye! " }, createEmoji("1f44b.svg", "👋")],
      },
      {
        description: "a string with only emoji",
        input: `<img class="emoji" draggable="false" alt="👋" src="${twemojiBaseUrl}1f44b.svg"><img class="emoji" draggable="false" alt="😊" src="${twemojiBaseUrl}1f60a.svg">`,
        expected: [createEmoji("1f44b.svg", "👋"), createEmoji("1f60a.svg", "😊")],
      },
      {
        description: "an empty string",
        input: "",
        expected: [],
      },
    ])("should handle $description", ({ input, expected }) => {
      const result = createNodes(input)
      expect(result).toEqual(expected)
    })

    it("should create nodes correctly", () => {
      const parsed = 'Hello <img src="test.png" alt="test"> World'
      const result = createNodes(parsed)
      expect(result).toHaveLength(3)
      expect(result[1]).toEqual(h("img", { src: "test.png", alt: "test" }))
    })

    it("should handle string with only img tags (no text parts)", () => {
      const input = '<img src="test1.png" alt="test1"><img src="test2.png" alt="test2">'
      const result = createNodes(input)
      expect(result).toEqual([
        h("img", { src: "test1.png", alt: "test1" }),
        h("img", { src: "test2.png", alt: "test2" }),
      ])
    })

    it("should handle when parts array has empty string elements", () => {
      const input = '<img src="test.png" alt="test">'
      const result = createNodes(input)
      expect(result).toEqual([h("img", { src: "test.png", alt: "test" })])
    })

    it("should handle when there are more matches than parts", () => {
      // Create a case where the split results in fewer parts than matches
      const input = '<img src="test1.png"><img src="test2.png"><img src="test3.png">'
      const result = createNodes(input)
      expect(result).toEqual([
        h("img", { src: "test1.png" }),
        h("img", { src: "test2.png" }),
        h("img", { src: "test3.png" }),
      ])
    })

    it("should handle edge case where parts include empty strings", () => {
      // This creates a scenario where parts[i] might be falsy but exists in the array
      const input = 'Start<img src="test.png">End'
      const result = createNodes(input)
      expect(result).toEqual([
        { type: "text", value: "Start" },
        h("img", { src: "test.png" }),
        { type: "text", value: "End" },
      ])
    })
  })
})

describe("processTree", () => {
  it("should replace placeholders and emoji correctly", () => {
    const mockTree: CustomNode = {
      type: "root",
      children: [{ type: "text", value: "Hello ↩ 😀" }],
    }

    const result = processTree(mockTree as UnistNode) as CustomNode

    expect(result).toEqual({
      type: "root",
      children: [
        { type: "text", value: `Hello ⤴${NBSP}${WORD_JOINER}` },
        createEmoji("1f600.svg", "😀"),
      ],
    })
  })

  it("should handle multiple text nodes and emoji", () => {
    const mockTree: CustomNode = {
      type: "root",
      children: [
        { type: "text", value: "Hello ↩" },
        { type: "text", value: "😀 World ↩" },
        { type: "text", value: "👋" },
      ],
    }

    const result = processTree(mockTree as UnistNode) as CustomNode

    expect(result).toEqual({
      type: "root",
      children: [
        { type: "text", value: "Hello ⤴" },
        createEmoji("1f600.svg", "😀"),
        { type: "text", value: " World ⤴" },
        createEmoji("1f44b.svg", "👋"),
      ],
    })
  })
  it("should not modify nodes without emoji or placeholders", () => {
    const mockTree: CustomNode = {
      type: "root",
      children: [{ type: "text", value: "Hello World" }],
    }

    const result = processTree(mockTree as UnistNode) as CustomNode

    expect(result).toEqual(mockTree)
  })

  it.each(Array.from(ignoreMap.keys()))(
    "should ignore character '%s' in ignoreMap",
    (key: string) => {
      const text = `This should be ignored: ${key}`
      const mockTree: CustomNode = {
        type: "root",
        children: [{ type: "text", value: text }],
      }
      const result = processTree(mockTree as UnistNode) as CustomNode
      expect(result).toEqual(mockTree)
    },
  )
})

describe("Twemoji plugin", () => {
  // Exercises the factory wrapper around processTree (covers `() => processTree`).
  it("htmlPlugins factory returns processTree", () => {
    const factory = Twemoji().htmlPlugins()[0] as () => typeof processTree
    expect(factory()).toBe(processTree)
  })
})
