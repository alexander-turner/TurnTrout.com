import { h } from "hastscript"
import { jest } from "@jest/globals"
import { Element } from "hast"
import { Node } from "unist"
import {
  TWEMOJI_BASE_URL,
  TwemojiOptions,
  createTwemojiCallback,
  parseAttributes,
  createNodes,
  processTree,
} from "../twemoji"
import { Node as UnistNode } from "unist"

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
    src: `${TWEMOJI_BASE_URL}${path}`,
  })
}

jest.mock("../modules/twemoji.min", () => ({
  twemoji: {
    parse: jest.fn((content: string) =>
      content.replace("😀", `<img src="${TWEMOJI_BASE_URL}1f600.svg">")`),
    ),
  },
}))

type TwemojiCallback = (icon: string, options: TwemojiOptions) => string

describe("Twemoji functions", () => {
  describe("createTwemojiCallback", () => {
    it("should return the correct URL", () => {
      const mockCallback: TwemojiCallback = jest.fn((icon) => `mock-${icon}`)
      const options: TwemojiOptions = { folder: "svg", ext: ".svg", callback: mockCallback }
      const result = createTwemojiCallback("1f600", options)
      expect(result).toBe(`${TWEMOJI_BASE_URL}1f600.svg`)
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
        src: `${TWEMOJI_BASE_URL}${path}`,
      },
    }
  }

  describe("createNodes", () => {
    it("should handle a string with no emojis", () => {
      const input = "Hello, world!"
      const result = createNodes(input)
      expect(result).toEqual([{ type: "text", value: "Hello, world!" }])
    })

    it("should handle a string with a single emoji", () => {
      const input = `Hello! <img class="emoji" draggable="false" alt="👋" src="${TWEMOJI_BASE_URL}1f44b.svg">`
      const result = createNodes(input)
      expect(result).toEqual([{ type: "text", value: "Hello! " }, createEmoji("1f44b.svg", "👋")])
    })

    it("should handle a string with multiple emojis", () => {
      const input = `Hello! <img class="emoji" draggable="false" alt="👋" src="${TWEMOJI_BASE_URL}1f44b.svg"> How are you? <img class="emoji" draggable="false" alt="😊" src="${TWEMOJI_BASE_URL}1f60a.svg">`
      const result = createNodes(input)
      expect(result).toEqual([
        { type: "text", value: "Hello! " },
        createEmoji("1f44b.svg", "👋"),
        { type: "text", value: " How are you? " },
        createEmoji("1f60a.svg", "😊"),
      ])
    })

    it("should handle a string starting with an emoji", () => {
      const input = `<img class="emoji" draggable="false" alt="👋" src="${TWEMOJI_BASE_URL}1f44b.svg"> Hello!`
      const result = createNodes(input)
      expect(result).toEqual([createEmoji("1f44b.svg", "👋"), { type: "text", value: " Hello!" }])
    })

    it("should handle a string ending with an emoji", () => {
      const input = `Goodbye! <img class="emoji" draggable="false" alt="👋" src="${TWEMOJI_BASE_URL}1f44b.svg">`
      const result = createNodes(input)
      expect(result).toEqual([{ type: "text", value: "Goodbye! " }, createEmoji("1f44b.svg", "👋")])
    })

    it("should handle a string with only emojis", () => {
      const input = `<img class="emoji" draggable="false" alt="👋" src="${TWEMOJI_BASE_URL}1f44b.svg"><img class="emoji" draggable="false" alt="😊" src="${TWEMOJI_BASE_URL}1f60a.svg">`
      const result = createNodes(input)
      expect(result).toEqual([createEmoji("1f44b.svg", "👋"), createEmoji("1f60a.svg", "😊")])
    })

    it("should handle an empty string", () => {
      const input = ""
      const result = createNodes(input)
      expect(result).toEqual([])
    })

    it("should create nodes correctly", () => {
      const parsed = 'Hello <img src="test.png" alt="test"> World'
      const result = createNodes(parsed)
      expect(result).toHaveLength(3)
      expect(result[1]).toEqual(h("img", { src: "test.png", alt: "test" }))
    })
  })
})

describe("processTree", () => {
  it("should replace placeholders and emojis correctly", () => {
    const mockTree: CustomNode = {
      type: "root",
      children: [{ type: "text", value: "Hello ↩ 😀" }],
    }

    const result = processTree(mockTree as Node) as CustomNode

    expect(result).toEqual({
      type: "root",
      children: [{ type: "text", value: "Hello ⤴ " }, createEmoji("1f600.svg", "😀")],
    })
  })

  it("should handle multiple text nodes and emojis", () => {
    const mockTree: CustomNode = {
      type: "root",
      children: [
        { type: "text", value: "Hello ↩" },
        { type: "text", value: "😀 World ↩" },
        { type: "text", value: "👋" },
      ],
    }

    const result = processTree(mockTree as Node) as CustomNode

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
  it("should not modify nodes without emojis or placeholders", () => {
    const mockTree: CustomNode = {
      type: "root",
      children: [{ type: "text", value: "Hello World" }],
    }

    const result = processTree(mockTree as Node) as CustomNode

    expect(result).toEqual(mockTree)
  })
})
