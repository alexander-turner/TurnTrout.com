import { jest, describe, it, expect } from "@jest/globals"
import { type Element, type Parent, type Text } from "hast"
import { h } from "hastscript"

import {
  replaceRegex,
  type ReplaceFnResult,
  shouldCapitalizeNodeText,
  gatherTextBeforeIndex,
  hasClass,
  hasAncestor,
  type ElementMaybeWithParent,
} from "../utils"

const acceptAll = () => false
describe("replaceRegex", () => {
  const createNode = (value: string): Text => ({ type: "text", value })

  it("should replace matches with the provided function", () => {
    const node = createNode("The quick brown fox jumps over the lazy dog.")
    const parent: Parent = { type: "span", children: [node] }
    const regex = /\bfox\b/g

    const replaceFn = (): ReplaceFnResult => ({
      before: "",
      replacedMatch: "clever fox",
      after: "",
    })

    replaceRegex(node, 0, parent, regex, replaceFn, acceptAll, "abbr.small-caps")

    expect(parent.children).toEqual([
      createNode("The quick brown "),
      h("abbr.small-caps", "clever fox"),
      createNode(" jumps over the lazy dog."),
    ])
  })

  it("should handle multiple matches", () => {
    const node = createNode("apple banana apple")
    const parent: Parent = { type: "span", children: [node] }
    const regex = /apple/g

    // Reuse the ReplaceFnResult type
    const replaceFn = (): ReplaceFnResult => ({
      before: "",
      replacedMatch: "fruit",
      after: "",
    })

    replaceRegex(node, 0, parent, regex, replaceFn, acceptAll)

    expect(parent.children).toEqual([
      h("span", "fruit"),
      createNode(" banana "),
      h("span", [createNode("fruit")]),
    ])
  })

  it("should respect the ignorePredicate", () => {
    const node = createNode("Hello world!")
    const parent = { type: "span", children: [node] } as Parent
    const regex = /world/g
    const replaceFn = jest.fn().mockImplementation((match: unknown): ReplaceFnResult => {
      return {
        before: "",
        replacedMatch: (match as RegExpMatchArray)[0].toUpperCase(),
        after: "",
      }
    }) as jest.MockedFunction<(match: RegExpMatchArray) => ReplaceFnResult>

    replaceRegex(node, 0, parent, regex, replaceFn, () => true)

    expect(replaceFn).not.toHaveBeenCalled()
    expect(parent.children).toEqual([node]) // Original node should remain unchanged
  })

  it("should handle nodes without value", () => {
    const node = { type: "text" } as Text
    const parent = { children: [node], type: "span" } as Parent
    const regex = /.*/g
    const replaceFn = jest.fn() as jest.Mock<(match: RegExpMatchArray) => ReplaceFnResult>

    replaceRegex(node, 0, parent, regex, replaceFn, acceptAll)

    expect(replaceFn).not.toHaveBeenCalled()
    expect(parent.children).toEqual([node])
  })

  it("should handle empty matchIndexes", () => {
    const node = createNode("No matches here")
    const parent = { children: [node], type: "span" } as Parent
    const regex = /^$/g
    const replaceFn = jest.fn() as jest.Mock<(match: RegExpMatchArray) => ReplaceFnResult>

    replaceRegex(node, 0, parent, regex, replaceFn, acceptAll)

    expect(replaceFn).not.toHaveBeenCalled()
    expect(parent.children).toEqual([node])
  })

  it("should handle Element array replacements", () => {
    const node = createNode("2nd place")
    const parent: Parent = { type: "span", children: [node] }
    const regex = /(\d)(nd|st|rd|th)\b/g

    const replaceFn = (match: RegExpMatchArray): ReplaceFnResult => {
      const [, num, suffix] = match

      return {
        before: "",
        replacedMatch: [
          h("span", { className: ["num"] }, num),
          h("span", { className: ["suffix"] }, suffix),
        ],
        after: "",
      }
    }

    replaceRegex(node, 0, parent, regex, replaceFn, acceptAll)

    expect(parent.children).toEqual([
      h("span", { className: ["num"] }, "2"),
      h("span", { className: ["suffix"] }, "nd"),
      createNode(" place"),
    ])
  })

  it("should handle overlapping matches by taking first match", () => {
    const node = createNode("aaaa")
    const parent: Parent = { type: "span", children: [node] }
    const regex = /aa/g // Will match "aa" twice, overlapping

    const replaceFn = (): ReplaceFnResult => ({
      before: "",
      replacedMatch: "b",
      after: "",
    })

    replaceRegex(node, 0, parent, regex, replaceFn, acceptAll)

    expect(parent.children).toEqual([h("span", "b"), h("span", "b")])
  })

  it("should handle before and after text correctly", () => {
    const node = createNode("test123test")
    const parent: Parent = { type: "span", children: [node] }
    const regex = /123/g

    const replaceFn = (): ReplaceFnResult => ({
      before: "<<",
      replacedMatch: "456",
      after: ">>",
    })

    replaceRegex(node, 0, parent, regex, replaceFn, acceptAll)

    expect(parent.children).toEqual([
      createNode("test"),
      createNode("<<"),
      h("span", "456"),
      createNode(">>"),
      createNode("test"),
    ])
  })

  it("should handle single element replacement", () => {
    const node = createNode("test123")
    const parent: Parent = { type: "span", children: [node] }
    const regex = /123/g

    const replaceFn = (): ReplaceFnResult => ({
      before: "",
      replacedMatch: h("span.number", "one-two-three"),
      after: "",
    })

    replaceRegex(node, 0, parent, regex, replaceFn, acceptAll)

    expect(parent.children).toEqual([createNode("test"), h("span.number", "one-two-three")])
  })
})

describe("nodeBeginsWithCapital", () => {
  it.each<[string, Text[], boolean]>([
    ["no previous sibling", [{ type: "text", value: "test" }], true],
    [
      "ends with period",
      [
        { type: "text", value: "sentence." },
        { type: "text", value: "test" },
      ],
      true,
    ],
    [
      "ends with period + space",
      [
        { type: "text", value: "sentence. " },
        { type: "text", value: "test" },
      ],
      true,
    ],
    [
      "ends with period + spaces",
      [
        { type: "text", value: "sentence.  " },
        { type: "text", value: "test" },
      ],
      true,
    ],
    [
      "no period",
      [
        { type: "text", value: "sentence" },
        { type: "text", value: "test" },
      ],
      false,
    ],
    [
      "non-text element",
      [{ type: "element" } as unknown as Text, { type: "text", value: "test" }],
      false,
    ],
  ])("should handle %s", (_case, children, expected) => {
    const parent = { type: "root", children } as Parent
    const index = children.length - 1 // Test node is always last
    expect(shouldCapitalizeNodeText(index, parent)).toBe(expected)
  })

  describe("period detection with whitespace", () => {
    it.each([
      ["period with no whitespace", "end.", true],
      ["period with single space", "end. ", true],
      ["period with multiple spaces", "end.   ", true],
      ["period with tabs", "end.\t\t", true],
      ["period with mixed whitespace", "end. \t ", true],
      ["period not at end", "end. middle", false],
      ["empty value", "", false],
      ["undefined value", undefined, false],
      ["null value", null, false],
    ])("should handle %s", (_case, previousValue, expected) => {
      const previousNode =
        previousValue !== undefined && previousValue !== null
          ? { type: "text", value: previousValue }
          : ({ type: "text", value: previousValue } as unknown as Text)
      const children = [previousNode, { type: "text", value: "test" }]
      const parent = { type: "root", children } as Parent
      expect(shouldCapitalizeNodeText(1, parent)).toBe(expected)
    })
  })
})

describe("gatherTextBeforeIndex", () => {
  interface TestCase {
    description: string
    parent: Parent
    index: number
    expected: string
  }

  it.each<TestCase>([
    {
      description: "basic text gathering",
      parent: {
        type: "root",
        children: [
          { type: "text", value: "Hello " },
          { type: "text", value: "world" },
          { type: "text", value: "!" },
        ],
      },
      index: 2,
      expected: "Hello world",
    },
    {
      description: "empty children array",
      parent: {
        type: "root",
        children: [],
      },
      index: 0,
      expected: "",
    },
    {
      description: "convert <br> to newline",
      parent: {
        type: "root",
        children: [{ type: "text", value: "Line 1" }, h("br"), { type: "text", value: "Line 2" }],
      },
      index: 2,
      expected: "Line 1\n",
    },
    {
      description: "nested inline elements",
      parent: {
        type: "root",
        children: [
          { type: "text", value: "This " },
          h("strong", "is bold"),
          { type: "text", value: " and " },
          h("em", "emphasized"),
          { type: "text", value: "." },
        ],
      },
      index: 3,
      expected: "This is bold and ",
    },
    {
      description: "mixed content with <br> elements",
      parent: {
        type: "root",
        children: [
          { type: "text", value: "First sentence." },
          h("br"),
          { type: "text", value: "Second " },
          h("em", "sentence"),
          h("br"),
          { type: "text", value: "Third sentence." },
        ],
      },
      index: 4,
      expected: "First sentence.\nSecond sentence",
    },
    {
      description: "consecutive <br> elements",
      parent: {
        type: "root",
        children: [
          { type: "text", value: "Paragraph 1" },
          h("br"),
          h("br"),
          { type: "text", value: "Paragraph 2" },
        ],
      },
      index: 3,
      expected: "Paragraph 1\n\n",
    },
  ])("should handle $description", ({ parent, index, expected }) => {
    expect(gatherTextBeforeIndex(parent, index)).toBe(expected)
  })
})

describe("hasClass", () => {
  it.each([
    ["string className", { className: "test-class other-class" }, "test-class", true],
    ["string className", { className: "test-class other-class" }, "other-class", true],
    ["string className", { className: "test-class other-class" }, "missing-class", false],
    ["array className", { className: ["test-class", "other-class"] }, "test-class", true],
    ["array className", { className: ["test-class", "other-class"] }, "other-class", true],
    ["array className", { className: ["test-class", "other-class"] }, "missing-class", false],
    ["string class", { class: "test-class other-class" }, "test-class", true],
    ["string class", { class: "test-class other-class" }, "other-class", true],
    ["string class", { class: "test-class other-class" }, "missing-class", false],
    ["array class", { class: ["test-class", "other-class"] }, "test-class", true],
    ["array class", { class: ["test-class", "other-class"] }, "other-class", true],
    ["array class", { class: ["test-class", "other-class"] }, "missing-class", false],
  ])("handles %s", (_type, props, className, expected) => {
    const node = h("div", props)
    expect(hasClass(node, className)).toBe(expected)
  })

  it("handles both className and class when both exist (hastscript merges them)", () => {
    const node = h("div", {
      className: "className-value",
      class: "class-value",
    })

    // hastscript merges both into className array, so both should be found
    expect(hasClass(node, "className-value")).toBe(true)
    expect(hasClass(node, "class-value")).toBe(true)
  })

  it("prefers className over class when manually creating element", () => {
    const node: Element = {
      type: "element",
      tagName: "div",
      properties: {
        className: "className-value",
        class: "class-value",
      },
      children: [],
    }

    expect(hasClass(node, "className-value")).toBe(true)
    expect(hasClass(node, "class-value")).toBe(false)
  })

  it.each([
    ["missing properties", h("div"), "any-class", false],
    ["null className", h("div", { className: null }), "any-class", false],
    ["null class", h("div", { class: null }), "any-class", false],
  ])("handles %s", (_type, node, className, expected) => {
    expect(hasClass(node, className)).toBe(expected)
  })
})

describe("hasAncestor", () => {
  const createNode = (
    tagName: string,
    parent: ElementMaybeWithParent | null = null,
    properties = {},
  ): ElementMaybeWithParent => ({
    type: "element",
    tagName,
    properties,
    children: [],
    parent,
  })

  it.each([
    [
      "node itself matches predicate",
      () => createNode("div", null, { className: "target" }),
      (anc: Element) => anc.tagName === "div",
      true,
    ],
    [
      "grandparent matches predicate",
      () => {
        const grandparent = createNode("article")
        const parent = createNode("section", grandparent)
        return createNode("div", parent)
      },
      (anc: Element) => anc.tagName === "article",
      true,
    ],
    [
      "no ancestor matches predicate",
      () => {
        const grandparent = createNode("article")
        const parent = createNode("section", grandparent)
        return createNode("div", parent)
      },
      (anc: Element) => anc.tagName === "main",
      false,
    ],
    [
      "node has no parent and does not match",
      () => createNode("div"),
      (anc: Element) => anc.tagName === "article",
      false,
    ],
    [
      "immediate parent matches predicate",
      () => {
        const parent = createNode("article")
        return createNode("div", parent)
      },
      (anc: Element) => anc.tagName === "article",
      true,
    ],
    [
      "predicate matches based on class name",
      () => {
        const parent = createNode("div", null, {
          className: ["special-container"],
        })
        return createNode("span", parent)
      },
      (anc: Element) => {
        const className = anc.properties?.className
        return Array.isArray(className) && className.includes("special-container")
      },
      true,
    ],
  ])("returns %s", (_case, nodeFactory, predicate, expected) => {
    const node = nodeFactory()
    // Build ancestors array from parent chain
    const ancestors: Parent[] = []
    let current = node.parent
    while (current) {
      ancestors.push(current as Parent)
      current = current.parent
    }
    expect(hasAncestor(node, predicate, ancestors)).toBe(expected)
  })

  it("stops at first matching ancestor", () => {
    const grandparent = createNode("article")
    const parent = createNode("article", grandparent)
    const node = createNode("div", parent)

    const ancestors: Parent[] = [parent as Parent, grandparent as Parent]

    let callCount = 0
    const predicate = (anc: Element): boolean => {
      callCount++
      return anc.tagName === "article"
    }

    expect(hasAncestor(node, predicate, ancestors)).toBe(true)
    // once for the node itself, and once for the parent (stops at first match)
    expect(callCount).toBe(2)
  })
})
