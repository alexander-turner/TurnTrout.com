import { TroutOrnamentHr, maybeInsertOrnament, ornamentNode, insertOrnamentNode } from "../trout_hr"
import { Root, Element as HastElement } from "hast"
import { BuildCtx } from "../../../util/ctx"

describe("TroutOrnamentHr", () => {
  it("should return a plugin with the correct name and htmlPlugins", () => {
    const plugin = TroutOrnamentHr()
    expect(plugin.name).toBe("TroutOrnamentHr")
    expect(plugin.htmlPlugins).toBeInstanceOf(Function)
    const mockBuildCtx: BuildCtx = {} as BuildCtx
    expect(plugin.htmlPlugins?.(mockBuildCtx)).toHaveLength(1)
    expect(plugin.htmlPlugins?.(mockBuildCtx)[0]).toBeInstanceOf(Function)
  })
})

describe("maybeInsertOrnament", () => {
  let tree: Root

  beforeEach(() => {
    tree = { type: "root", children: [] } as Root
  })

  it("should insert ornament before footnotes section", () => {
    tree.children = [
      {
        type: "element",
        tagName: "section",
        properties: { className: ["footnotes"], dataFootnotes: true },
        children: [],
      },
    ]

    const beforeNode = tree.children[0]
    maybeInsertOrnament(tree.children[0] as HastElement, 0, tree)

    // Check that we added an ornament
    expect(tree.children).toHaveLength(2)
    expect(tree.children[0]).toStrictEqual(ornamentNode)

    // Ensure that the footnotes weren't changed
    expect(tree.children[1]).toStrictEqual(beforeNode)
  })

  it("should remove hr and insert ornament before footnotes section", () => {
    tree.children = [
      { type: "element", tagName: "hr" },
      {
        type: "element",
        tagName: "section",
        properties: { className: ["footnotes"], dataFootnotes: true },
        children: [],
      },
    ] as HastElement[]

    const beforeNode = tree.children[1]
    maybeInsertOrnament(tree.children[1] as HastElement, 1, tree)

    expect(tree.children).toHaveLength(2)
    expect(tree.children[0]).toStrictEqual(ornamentNode)
    expect(tree.children[1]).toStrictEqual(beforeNode)
  })

  it("should remove hr proceeded by newline and insert ornament before footnotes section", () => {
    tree.children = [
      { type: "element", tagName: "hr" },
      { type: "text", value: "\n" },
      {
        type: "element",
        tagName: "section",
        properties: { className: ["footnotes"], dataFootnotes: true },
        children: [],
      },
    ] as HastElement[]

    const beforeNode = tree.children[1]
    maybeInsertOrnament(tree.children[2] as HastElement, 2, tree)

    expect(tree.children).toHaveLength(3)
    expect(tree.children[1]).toStrictEqual(ornamentNode)
    expect(tree.children[0]).toStrictEqual(beforeNode)
  })
})

describe("insertOrnamentNode", () => {
  it("should append ornament node when no footnotes are found without changing existing elements", () => {
    const existingElements = [
      { type: "element", tagName: "p", children: [] },
      { type: "element", tagName: "div", children: [] },
    ]

    const tree = {
      type: "root",
      children: [...existingElements],
    }

    insertOrnamentNode(tree as Root)

    expect(tree.children).toHaveLength(3)

    // Check that existing elements weren't changed
    expect(tree.children[0]).toBe(existingElements[0])
    expect(tree.children[1]).toBe(existingElements[1])

    // Check the appended ornament node
    expect(tree.children[2]).toBe(ornamentNode)
  })
})
