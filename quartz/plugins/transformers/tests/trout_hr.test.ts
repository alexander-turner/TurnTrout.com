import type { Root, Element as HastElement } from "hast"

import { describe, expect, beforeEach, it } from "@jest/globals"
import { h } from "hastscript"

import { BuildCtx } from "../../../util/ctx"
import { TroutOrnamentHr, maybeInsertOrnament, ornamentNode, insertOrnamentNode } from "../trout_hr"

describe("TroutOrnamentHr", () => {
  it("should return a plugin with the correct name and htmlPlugins", () => {
    const plugin = TroutOrnamentHr()
    expect(plugin.name).toBe("TroutOrnamentHr")
    expect(plugin.htmlPlugins).toBeInstanceOf(Function)
    const mockBuildCtx: BuildCtx = {} as BuildCtx
    expect(plugin.htmlPlugins?.(mockBuildCtx)).toHaveLength(1)
    expect(plugin.htmlPlugins?.(mockBuildCtx)[0]).toBeInstanceOf(Function)
  })

  it("should create a transformer function that modifies the tree", () => {
    const plugin = TroutOrnamentHr()
    const mockBuildCtx: BuildCtx = {} as BuildCtx
    const htmlPlugins = plugin.htmlPlugins?.(mockBuildCtx)

    expect(htmlPlugins).toHaveLength(1)
    expect(typeof htmlPlugins?.[0]).toBe("function")

    // Call the plugin function to get the actual transformer
    const transformerFactory = htmlPlugins?.[0] as () => (tree: Root) => void
    const transformer = transformerFactory()
    expect(typeof transformer).toBe("function")

    // Test the transformer function (covering lines 158-159)
    const tree: Root = {
      type: "root",
      children: [h("p", "Test content")],
    } as Root

    transformer(tree)

    // Verify that the ornament was added
    expect(tree.children).toHaveLength(2)
    expect(tree.children[1]).toStrictEqual(ornamentNode)
  })
})

describe("maybeInsertOrnament", () => {
  let tree: Root

  beforeEach(() => {
    tree = { type: "root", children: [] } as Root
  })

  it.each([
    ["parent is undefined", 0, undefined],
    ["index is undefined", undefined, "tree"],
  ])("should return false when %s", (_, index, parent) => {
    const node = h("h1", "Appendix") as HastElement
    const actualParent = parent === "tree" ? tree : parent
    const result = maybeInsertOrnament(
      node,
      index as number | undefined,
      actualParent as typeof tree | undefined,
    )
    expect(result).toBe(false)
  })

  it.each([
    ["non-heading, non-footnotes elements", "p", "Regular paragraph"],
    ["heading without text children", "h1", ""],
  ])("should return false for %s", (_, tagName, content) => {
    const node = h(tagName, content || undefined) as HastElement
    tree.children = [node] as HastElement[]
    const result = maybeInsertOrnament(node, 0, tree)
    expect(result).toBe(false)
  })

  it("should return false for heading with anchor but no text children", () => {
    const node = h("h1", h("a")) as HastElement
    tree.children = [node] as HastElement[]
    const result = maybeInsertOrnament(node, 0, tree)
    expect(result).toBe(false)
  })

  it("should return false for heading with anchor containing non-text children", () => {
    const node = h("h1", h("a", h("span"))) as HastElement
    tree.children = [node] as HastElement[]
    const result = maybeInsertOrnament(node, 0, tree)
    expect(result).toBe(false)
  })

  it.each([
    ["without dataFootnotes property", { className: ["footnotes"] }],
    ["without footnotes className", { dataFootnotes: true }],
  ])("should return false for footnotes section %s", (_, properties) => {
    const node = h("section", properties) as HastElement
    tree.children = [node] as HastElement[]
    const result = maybeInsertOrnament(node, 0, tree)
    expect(result).toBe(false)
  })

  it("should handle footnotes section at index 0 without previous elements", () => {
    const beforeNode = h("section", {
      className: ["footnotes"],
      dataFootnotes: true,
    }) as HastElement
    tree.children = [beforeNode] as HastElement[]
    const result = maybeInsertOrnament(beforeNode, 0, tree)

    expect(result).toBe(true)
    expect(tree.children).toHaveLength(2)
    expect(tree.children[0]).toStrictEqual(ornamentNode)

    // Ensure that the footnotes weren't changed
    expect(tree.children[1]).toStrictEqual(beforeNode)
  })

  it("should remove hr and insert ornament before footnotes section", () => {
    const hrNode = h("hr") as HastElement
    const footnoteNode = h("section", {
      className: ["footnotes"],
      dataFootnotes: true,
    }) as HastElement
    tree.children = [hrNode, footnoteNode] as HastElement[]

    const beforeNode = tree.children[1]
    maybeInsertOrnament(tree.children[1] as HastElement, 1, tree)

    expect(tree.children).toHaveLength(2)
    expect(tree.children[0]).toStrictEqual(ornamentNode)
    expect(tree.children[1]).toStrictEqual(beforeNode)
  })

  it("should remove hr proceeded by newline and insert ornament before footnotes section", () => {
    const hrNode = h("hr") as HastElement
    const footnoteNode = h("section", {
      className: ["footnotes"],
      dataFootnotes: true,
    }) as HastElement
    tree.children = [hrNode, { type: "text", value: "\n" }, footnoteNode] as HastElement[]

    const beforeNode = tree.children[1]
    maybeInsertOrnament(tree.children[2] as HastElement, 2, tree)

    expect(tree.children).toHaveLength(3)
    expect(tree.children[0]).toStrictEqual(beforeNode)
    expect(tree.children[1]).toStrictEqual(ornamentNode)
    expect(tree.children[2]).toStrictEqual(footnoteNode)
  })
})

describe("insertOrnamentNode", () => {
  let tree: Root

  beforeEach(() => {
    tree = { type: "root", children: [] } as Root
  })

  it("should replace ending hr with ornament even without footnotes", () => {
    const contentNode = h("p", "Some content") as HastElement
    const hrNode = h("hr") as HastElement
    tree.children = [contentNode, hrNode] as HastElement[]

    insertOrnamentNode(tree)

    expect(tree.children).toHaveLength(2)
    expect(tree.children[0]).toStrictEqual(contentNode)
    expect(tree.children[1]).toStrictEqual(ornamentNode)
  })

  it("should append ornament node when no footnotes are found without changing existing elements", () => {
    const existingElements = [h("p"), h("div")] as HastElement[]

    const tree = {
      type: "root",
      children: [...existingElements],
    }

    insertOrnamentNode(tree as Root)

    expect(tree.children).toHaveLength(3)

    // Check that existing elements weren't changed
    expect(tree.children[0]).toStrictEqual(existingElements[0])
    expect(tree.children[1]).toStrictEqual(existingElements[1])

    // Check the appended ornament node
    expect(tree.children[2]).toStrictEqual(ornamentNode)
  })

  it("should append ornament node to empty tree", () => {
    const tree: Root = { type: "root", children: [] }

    insertOrnamentNode(tree)

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]).toStrictEqual(ornamentNode)
  })

  it("should handle tree where last child is not an element", () => {
    const tree: Root = {
      type: "root",
      children: [h("p"), { type: "text", value: "Some text" }],
    }

    insertOrnamentNode(tree)

    expect(tree.children).toHaveLength(3)
    expect(tree.children[2]).toStrictEqual(ornamentNode)
  })
})

describe("Appendix functionality", () => {
  let tree: Root

  beforeEach(() => {
    tree = { type: "root", children: [] } as Root
  })

  it.each([
    ["h1", "Appendix: Additional Information"],
    ["h2", "Appendix: Further Reading"],
  ])(
    'should insert ornament before %s element with direct text child starting with "Appendix"',
    (tagName, content) => {
      const appendixHeading = h(tagName, content) as HastElement
      tree.children = [h("p"), appendixHeading] as HastElement[]

      maybeInsertOrnament(appendixHeading, 1, tree)

      expect(tree.children).toHaveLength(3)
      expect(tree.children[1]).toStrictEqual(ornamentNode)
      expect(tree.children[2]).toStrictEqual(appendixHeading)
    },
  )

  it('should insert ornament before heading with anchor element starting with "Appendix"', () => {
    const appendixHeading = h("h2", h("a", "Appendix: Open questions I have")) as HastElement
    tree.children = [h("p"), appendixHeading] as HastElement[]

    maybeInsertOrnament(appendixHeading, 1, tree)

    expect(tree.children).toHaveLength(3)
    expect(tree.children[1]).toStrictEqual(ornamentNode)
    expect(tree.children[2]).toStrictEqual(appendixHeading)
  })

  it('should not insert ornament before heading not starting with "Appendix"', () => {
    const normalHeading = h("h1", "Normal Heading") as HastElement
    tree.children = [h("p"), normalHeading] as HastElement[]

    maybeInsertOrnament(normalHeading, 1, tree)

    expect(tree.children).toHaveLength(2)
    expect(tree.children[1]).toStrictEqual(normalHeading)
  })

  it('should insert ornament before "Appendix" heading when both heading and footnotes are present', () => {
    const appendixHeading = h("h1", "Appendix: Additional Information") as HastElement
    const footnoteSection = h("section", {
      className: ["footnotes"],
      dataFootnotes: true,
    }) as HastElement
    tree.children = [h("p"), appendixHeading, footnoteSection] as HastElement[]

    insertOrnamentNode(tree)

    expect(tree.children).toHaveLength(4)
    expect(tree.children[1]).toStrictEqual(ornamentNode)
    expect(tree.children[2]).toStrictEqual(appendixHeading)
  })
})
