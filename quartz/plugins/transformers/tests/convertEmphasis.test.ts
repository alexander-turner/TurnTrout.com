import { Root } from "mdast-util-find-and-replace/lib"
import { formatNode, convertEmphasisHelper } from "../convertEmphasis"
import { Text, Parent } from "mdast"

describe("formatNode", () => {
  it("should convert bold syntax correctly", () => {
    const node: Text = { type: "text", value: "This is **bold** text" }
    const parent: Parent = { type: "paragraph", children: [node] }
    const boldRegex = /\*\*(.*?)\*\*/g

    formatNode(node, 0, parent, boldRegex, "strong")

    expect(parent.children).toHaveLength(3)
    expect(parent.children[0]).toEqual({ type: "text", value: "This is " })
    expect(parent.children[1]).toEqual({
      tagName: "strong",
      type: "element",
      children: [{ type: "text", value: "bold" }],
    })
    expect(parent.children[2]).toEqual({ type: "text", value: " text" })
  })

  it("should convert italic syntax correctly", () => {
    const node: Text = { type: "text", value: "This is _italic_ text" }
    const parent: Parent = { type: "paragraph", children: [node] }
    const italicRegex = /_(.*?)_/g

    formatNode(node, 0, parent, italicRegex, "em")

    expect(parent.children).toHaveLength(3)
    expect(parent.children[0]).toEqual({ type: "text", value: "This is " })
    expect(parent.children[1]).toEqual({
      tagName: "em",
      type: "element",
      children: [{ type: "text", value: "italic" }],
    })
    expect(parent.children[2]).toEqual({ type: "text", value: " text" })
  })

  it("should handle multiple occurrences", () => {
    const node: Text = { type: "text", value: "**Bold** and **more bold**" }
    const parent: Parent = { type: "paragraph", children: [node] }
    const boldRegex = /\*\*(.*?)\*\*/g

    formatNode(node, 0, parent, boldRegex, "strong")

    expect(parent.children).toHaveLength(3)
    expect(parent.children[0]).toEqual({
      tagName: "strong",
      type: "element",
      children: [{ type: "text", value: "Bold" }],
    })
    expect(parent.children[1]).toEqual({ type: "text", value: " and " })
    expect(parent.children[2]).toEqual({
      tagName: "strong",
      type: "element",
      children: [{ type: "text", value: "more bold" }],
    })
  })

  it("should not modify text without emphasis", () => {
    const node: Text = { type: "text", value: "Plain text without emphasis" }
    const parent: Parent = { type: "paragraph", children: [node] }
    const boldRegex = /\*\*(.*?)\*\*/g

    formatNode(node, 0, parent, boldRegex, "strong")

    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]).toEqual(node)
  })

  it("should throw an error for invalid tag", () => {
    const node: Text = { type: "text", value: "Some text" }
    const parent: Parent = { type: "paragraph", children: [node] }
    const regex = /\*\*(.*?)\*\*/g

    expect(() => formatNode(node, 0, parent, regex, "invalid")).toThrow("Invalid tag")
  })

  it("should handle nested and adjacent emphasis correctly", () => {
    const node: Text = {
      type: "text",
      value:
        "_We finally hit the_ good stuff_: value-function approximators and stochastic-/semi-gradient methods._",
    }
    const parent: Parent = { type: "paragraph", children: [node] }
    const italicRegex = /_(.*?)_/g

    formatNode(node, 0, parent, italicRegex, "em")

    expect(parent.children).toHaveLength(3)
    expect(parent.children[0]).toEqual({
      tagName: "em",
      type: "element",
      children: [{ type: "text", value: "We finally hit the" }],
    })
    expect(parent.children[1]).toEqual({ type: "text", value: " good stuff" })
    expect(parent.children[2]).toEqual({
      tagName: "em",
      type: "element",
      children: [
        {
          type: "text",
          value: ": value-function approximators and stochastic-/semi-gradient methods.",
        },
      ],
    })
  })

  interface CodeNode extends Parent {
    tagName: "code"
  }
  it("should not apply emphasis within code blocks", () => {
    const codeNode: Text = { type: "text", value: "const example = formatting_improvement_html" }
    const parent: CodeNode = { type: "element", tagName: "code", children: [codeNode] }

    convertEmphasisHelper(parent as Root)

    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]).toEqual(codeNode)
    expect((parent.children[0] as Text).value).toBe("const example = formatting_improvement_html")
  })
})
