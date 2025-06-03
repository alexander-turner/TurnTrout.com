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
          <a href="#section1" class="internal">Link to Section 1</a>
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
  const createContainer = (html: string): HTMLElement => {
    const container = document.createElement("div")
    container.innerHTML = html
    return container
  }

  const getHighlights = (element: HTMLElement): HTMLSpanElement[] =>
    Array.from(element.getElementsByClassName("highlight")) as HTMLSpanElement[]

  interface TestCase {
    name: string
    html: string
    searchTerm: string
    expectedCount: number
    expectedHTML: string
    expectedContent: string[]
  }

  // Parameterized test cases
  const testCases: TestCase[] = [
    {
      name: "simple text match",
      html: "<p>Hello world</p>",
      searchTerm: "world",
      expectedCount: 1,
      expectedHTML: '<p>Hello <span class="highlight">world</span></p>',
      expectedContent: ["world"],
    },
    {
      name: "multiple occurrences",
      html: "<p>test test test</p>",
      searchTerm: "test",
      expectedCount: 3,
      expectedHTML:
        '<p><span class="highlight">test</span> <span class="highlight">test</span> <span class="highlight">test</span></p>',
      expectedContent: ["test", "test", "test"],
    },
    {
      name: "case insensitive matches",
      html: "<p>Test TEST test</p>",
      searchTerm: "test",
      expectedCount: 3,
      expectedHTML:
        '<p><span class="highlight">Test</span> <span class="highlight">TEST</span> <span class="highlight">test</span></p>',
      expectedContent: ["Test", "TEST", "test"],
    },
    {
      name: "nested elements",
      html: "<div><p>First test</p><div><span>Nested test</span></div></div>",
      searchTerm: "test",
      expectedCount: 2,
      expectedHTML:
        '<div><p>First <span class="highlight">test</span></p><div><span>Nested <span class="highlight">test</span></span></div></div>',
      expectedContent: ["test", "test"],
    },
    {
      name: "special regex characters",
      html: "<p>test.com</p>",
      searchTerm: "test.",
      expectedCount: 1,
      expectedHTML: '<p><span class="highlight">test.</span>com</p>',
      expectedContent: ["test."],
    },
    {
      name: "no matches",
      html: "<p>Hello world</p>",
      searchTerm: "xyz",
      expectedCount: 0,
      expectedHTML: "<p>Hello world</p>",
      expectedContent: [],
    },
    {
      name: "empty nodes",
      html: "<p></p>",
      searchTerm: "test",
      expectedCount: 0,
      expectedHTML: "<p></p>",
      expectedContent: [],
    },
  ]

  it.each(testCases)(
    "should handle $name",
    ({ html, searchTerm, expectedCount, expectedHTML, expectedContent }) => {
      const container = createContainer(html)
      highlightTextNodes(container, searchTerm)
      expect(container.innerHTML).toBe(expectedHTML)

      const highlights = getHighlights(container)
      expect(highlights).toHaveLength(expectedCount)
      highlights.forEach((span, i) => {
        expect(expectedContent).toBeDefined()
        expect(span.textContent).toBe(expectedContent![i])
      })
    },
  )

  it("should handle null node values", () => {
    const container = createContainer("<p>test</p>")
    const textNode = container.firstChild?.firstChild
    if (textNode) {
      textNode.nodeValue = null
    }

    expect(() => highlightTextNodes(container, "test")).not.toThrow()
  })
})
