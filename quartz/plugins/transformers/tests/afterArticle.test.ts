import type { Root, Element } from "hast"

import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"

import { insertAfterOrnamentNode } from "../afterArticle"
import { ornamentNode } from "../trout_hr"

describe("insertAfterOrnamentNode", () => {
  it("should insert the components after the trout ornament", () => {
    const mockTree: Root = {
      type: "root",
      children: [ornamentNode],
    }

    const mockSequenceLinks: Element = h("div", { id: "sequence-links" }, "Sequence Links")
    const mockRSS: Element = h("a", { href: "/index.xml", class: "rss-link" }, "Subscribe to RSS")

    insertAfterOrnamentNode(mockTree, [mockSequenceLinks, mockRSS])

    // Assert that the components were inserted in the correct position
    expect(mockTree.children).toHaveLength(2)
    expect(mockTree.children[1]).toEqual(
      expect.objectContaining({
        type: "element",
        tagName: "div",
        properties: { className: ["after-article-components"] },
        children: expect.arrayContaining([mockSequenceLinks, mockRSS]),
      }),
    )
  })

  it("should not modify the tree if trout ornament is not found", () => {
    const mockTree: Root = {
      type: "root",
      children: [
        h("div", { id: "some-other-div" }, "Some content"),
        h("div", { id: "another-div" }, "More content"),
      ],
    }

    // Create mock components to insert
    const mockSequenceLinks: Element = h("div", { id: "sequence-links" }, "Sequence Links")
    const mockRSS: Element = h("a", { href: "/index.xml", class: "rss-link" }, "Subscribe to rss")

    insertAfterOrnamentNode(mockTree, [mockSequenceLinks, mockRSS])

    // Assert that the tree was not modified
    expect(mockTree.children).toHaveLength(2)
    expect(
      mockTree.children.every(
        (child) => (child as Element).properties?.id !== "after-article-components",
      ),
    ).toBe(true)
  })
})
