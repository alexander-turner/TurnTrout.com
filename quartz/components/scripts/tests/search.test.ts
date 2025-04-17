/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals"

import { highlightTextNodes, descendantsWithId, descendantsSamePageLinks } from "../search"

describe("Search Module Functions", () => {
  let rootNode: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <div id="child1">
          <a href="#section1" class="internal alias">Link to Section 1</a>
          <h2 id="section1">Section 1</h2>
          <a href="#section2" class="same-page-link">Link to Section 2</a>
          <h2 id="section2">Section 2</h2>
          <div id="nested">
            <p id="paragraph">Some text</p>
          </div>
        </div>
        <div class="no-id">
          <span>No ID here</span>
        </div>
      </div>
    `
    rootNode = document.getElementById("root") as HTMLElement
  })

  describe("descendantsWithId", () => {
    it("should return all descendant elements with an ID", () => {
      const elementsWithId = descendantsWithId(rootNode)
      const ids = elementsWithId.map((el) => el.id)
      expect(ids).toContain("child1")
      expect(ids).toContain("section1")
      expect(ids).toContain("section2")
      expect(ids).toContain("nested")
      expect(ids).toContain("paragraph")
      expect(ids).not.toContain("root") // rootNode is not a descendant
      expect(ids).not.toContain("") // No empty IDs
    })

    it("should return an empty array when no descendants have IDs", () => {
      const emptyDiv = document.createElement("div")
      const elementsWithId = descendantsWithId(emptyDiv)
      expect(elementsWithId).toEqual([])
    })
  })

  describe("descendantsSamePageLinks", () => {
    it("should return all same-page link descendants", () => {
      const links = descendantsSamePageLinks(rootNode)
      const hrefs = links.map((link) => link.getAttribute("href"))
      expect(hrefs).toContain("#section1")
      expect(hrefs).toContain("#section2")
      expect(links).toHaveLength(2)
    })

    it("should return an empty array when no same-page links are present", () => {
      const emptyDiv = document.createElement("div")
      const links = descendantsSamePageLinks(emptyDiv)
      expect(links).toEqual([])
    })
  })
})

describe("highlightTextNodes", () => {
  // Helper functions
  const createContainer = (html: string): HTMLElement => {
    const container = document.createElement("div")
    container.innerHTML = html
    return container
  }

  const getHighlights = (element: HTMLElement): HTMLSpanElement[] =>
    Array.from(element.getElementsByClassName("highlight")) as HTMLSpanElement[]

  // Test cases structure
  interface TestCase {
    name: string
    html: string
    searchTerm: string
    expectedCount: number
    expectedHTML?: string
    expectedContent?: string[]
  }

  // Parameterized test cases
  const testCases: TestCase[] = [
    {
      name: "simple text match",
      html: "<p>Hello world</p>",
      searchTerm: "world",
      expectedCount: 1,
      expectedHTML: '<p>Hello <span class="highlight">world</span></p>',
    },
    {
      name: "multiple occurrences",
      html: "<p>test test test</p>",
      searchTerm: "test",
      expectedCount: 3,
      expectedContent: ["test", "test", "test"],
    },
    {
      name: "case insensitive matches",
      html: "<p>Test TEST test</p>",
      searchTerm: "test",
      expectedCount: 3,
    },
    {
      name: "nested elements",
      html: "<div><p>First test</p><div><span>Nested test</span></div></div>",
      searchTerm: "test",
      expectedCount: 2,
    },
    {
      name: "existing highlights",
      html: '<p><span class="highlight">test</span> test</p>',
      searchTerm: "test",
      expectedCount: 2,
    },
    {
      name: "special regex characters",
      html: "<p>test.com</p>",
      searchTerm: "test.",
      expectedCount: 1,
      expectedContent: ["test."],
    },
    {
      name: "no matches",
      html: "<p>Hello world</p>",
      searchTerm: "xyz",
      expectedCount: 0,
      expectedHTML: "<p>Hello world</p>",
    },
    {
      name: "empty nodes",
      html: "<p></p>",
      searchTerm: "test",
      expectedCount: 0,
      expectedHTML: "<p></p>",
    },
  ]

  // Parameterized test runner
  it.each(testCases)(
    "should handle $name",
    ({ html, searchTerm, expectedCount, expectedHTML, expectedContent }) => {
      const container = createContainer(html)
      highlightTextNodes(container, searchTerm)

      const highlights = getHighlights(container)
      expect(highlights).toHaveLength(expectedCount)

      if (expectedHTML) {
        expect(container.innerHTML).toBe(expectedHTML)
      }

      if (expectedContent) {
        highlights.forEach((span, i) => {
          expect(span.textContent).toBe(expectedContent[i])
        })
      }
    },
  )

  // Edge cases that need special handling
  it("should handle null node values", () => {
    const container = createContainer("<p>test</p>")
    const textNode = container.firstChild?.firstChild
    if (textNode) {
      textNode.nodeValue = null
    }

    expect(() => highlightTextNodes(container, "test")).not.toThrow()
  })
})
