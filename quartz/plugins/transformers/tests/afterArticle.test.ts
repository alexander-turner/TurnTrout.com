import { Root, Element } from "hast"
import { h } from "hastscript"
import { insertAfterTroutOrnament } from "../afterArticle"

describe("insertAfterTroutOrnament", () => {
  it("should insert the components after the trout ornament", () => {
    // Create a mock tree
    const mockTree: Root = {
      type: "root",
      children: [
        h("div", { id: "some-other-div" }, "Some content"),
        h("div", { id: "trout-ornament" }, "Trout Ornament"),
        h("div", { id: "another-div" }, "More content"),
      ],
    }

    // Create mock components to insert
    const mockSequenceLinks: Element = h("div", { id: "sequence-links" }, "Sequence Links")
    const mockRSS: Element = h("a", { href: "/index.xml", class: "rss-link" }, "Subscribe to RSS")

    // Call the function
    insertAfterTroutOrnament(mockTree, [mockSequenceLinks, mockRSS])

    // Assert that the components were inserted in the correct position
    expect(mockTree.children).toHaveLength(4)
    expect(mockTree.children[2]).toEqual(
      expect.objectContaining({
        type: "element",
        tagName: "div",
        properties: { className: ["after-article-components"] },
        children: expect.arrayContaining([mockSequenceLinks, mockRSS]),
      }),
    )
  })

  it("should not modify the tree if trout ornament is not found", () => {
    // Create a mock tree without trout ornament
    const mockTree: Root = {
      type: "root",
      children: [
        h("div", { id: "some-other-div" }, "Some content"),
        h("div", { id: "another-div" }, "More content"),
      ],
    }

    // Create mock components to insert
    const mockSequenceLinks: Element = h("div", { id: "sequence-links" }, "Sequence Links")
    const mockRSS: Element = h("a", { href: "/index.xml", class: "rss-link" }, "Subscribe to RSS")

    // Call the function
    insertAfterTroutOrnament(mockTree, [mockSequenceLinks, mockRSS])

    // Assert that the tree was not modified
    expect(mockTree.children).toHaveLength(2)
    expect(
      mockTree.children.every(
        (child) => (child as Element).properties?.id !== "after-article-components",
      ),
    ).toBe(true)
  })
})
