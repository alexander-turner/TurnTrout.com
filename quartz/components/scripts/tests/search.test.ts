/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals"

import { simpleConstants } from "../../constants"
import {
  highlightTextNodes,
  descendantsWithId,
  descendantsSamePageLinks,
  tokenizeTerm,
  highlight,
  escapeRegExp,
  createHighlightSpan,
  updatePlaceholder,
  showSearch,
  hideSearch,
  PreviewManager,
  getOffsetTopRelativeToContainer,
} from "../search"

const { searchPlaceholderDesktop, searchPlaceholderMobile } = simpleConstants

jest.mock("../../../styles/variables", () => ({
  tabletBreakpoint: 800,
  mobileBreakpoint: 480,
}))

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

describe("highlight", () => {
  it("should highlight a single term", () => {
    const highlighted = highlight("world", "Hello world")
    expect(highlighted).toBe('Hello <span class="highlight">world</span>')
  })

  it("should be case-insensitive", () => {
    const highlighted = highlight("world", "Hello World")
    expect(highlighted).toBe('Hello <span class="highlight">World</span>')
  })

  it("should handle multiple occurrences", () => {
    const highlighted = highlight("test", "This is a test. Another test.")
    expect(highlighted).toBe(
      'This is a <span class="highlight">test</span>. Another <span class="highlight">test</span>.',
    )
  })

  it("should highlight the longest matching token", () => {
    const highlighted = highlight("search term", "This is a search term.")
    expect(highlighted).toBe(
      'This is a <span class="highlight">search</span> <span class="highlight">term</span>.',
    )
  })

  describe("Trimming and ellipsis", () => {
    const generateText = (numWords: number, suffix = "") =>
      Array.from({ length: numWords }, (_, i) => `word${i}${suffix}`).join(" ")

    it("should not trim short text", () => {
      const text = `${generateText(10)} match ${generateText(10)}`
      const highlighted = highlight("match", text, true)
      expect(highlighted).not.toContain("...")
      expect(highlighted).toContain('<span class="highlight">match</span>')
    })

    it("should trim long text with match in the middle and add ellipsis on both sides", () => {
      const text = `${generateText(50)} match ${generateText(50)}`
      const highlighted = highlight("match", text, true)
      expect(highlighted.startsWith("...")).toBe(true)
      expect(highlighted.endsWith("...")).toBe(true)
      expect(highlighted).toContain('<span class="highlight">match</span>')
    })

    it("should trim long text with match at the beginning and add ellipsis at the end", () => {
      const text = `match ${generateText(100)}`
      const highlighted = highlight("match", text, true)
      expect(highlighted.startsWith("...")).toBe(false)
      expect(highlighted.endsWith("...")).toBe(true)
      expect(highlighted).toContain('<span class="highlight">match</span>')
    })

    it("should trim long text with match at the end and add ellipsis at the beginning", () => {
      const text = `${generateText(100)} match`
      const highlighted = highlight("match", text, true)
      expect(highlighted.startsWith("...")).toBe(true)
      expect(highlighted.endsWith("...")).toBe(false)
      expect(highlighted).toContain('<span class="highlight">match</span>')
    })
  })
})

describe("tokenizeTerm", () => {
  it("should tokenize a single word", () => {
    expect(tokenizeTerm("hello")).toEqual(["hello"])
  })

  it("should tokenize multiple words", () => {
    expect(tokenizeTerm("hello world")).toEqual(["hello world", "hello", "world"])
  })

  it("should handle extra spaces", () => {
    expect(tokenizeTerm("  hello   world  ")).toEqual(["hello world", "hello", "world"])
  })

  it("should return an empty array for an empty string", () => {
    expect(tokenizeTerm("")).toEqual([])
  })
})

describe("escapeRegExp", () => {
  it("should escape special regex characters", () => {
    const specialChars = ".*+?^${}()|[]\\"
    const escaped = escapeRegExp(specialChars)
    expect(escaped).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\")
  })

  it("should not escape normal characters", () => {
    const normalChars = "abcdefg123"
    const escaped = escapeRegExp(normalChars)
    expect(escaped).toBe(normalChars)
  })
})

describe("createHighlightSpan", () => {
  it("should create a span with the correct class and text", () => {
    const span = createHighlightSpan("test")
    expect(span.tagName).toBe("SPAN")
    expect(span.className).toBe("highlight")
    expect(span.textContent).toBe("test")
  })
})

describe("updatePlaceholder", () => {
  const searchBar = document.createElement("input")
  searchBar.id = "search-bar"
  document.body.appendChild(searchBar)
  it("should set the placeholder to desktop version on wide screens", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })
    updatePlaceholder(searchBar)
    expect(searchBar.placeholder).toBe(searchPlaceholderDesktop)
  })

  it("should set the placeholder to mobile version on narrow screens", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    })
    updatePlaceholder(searchBar)
    expect(searchBar.placeholder).toBe(searchPlaceholderMobile)
  })

  it("should not throw an error if the search bar is not found", () => {
    expect(() => updatePlaceholder(null)).not.toThrow()
  })
})

describe("showSearch", () => {
  let container: HTMLElement
  let searchBar: HTMLInputElement
  let navbar: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="search-container">
        <input id="search-bar" type="text" />
      </div>
      <div id="navbar"></div>
    `
    container = document.getElementById("search-container") as HTMLElement
    searchBar = document.getElementById("search-bar") as HTMLInputElement
    navbar = document.getElementById("navbar") as HTMLElement
  })

  it("should make the search container active and focus the search bar", () => {
    showSearch(container, searchBar)
    expect(container.classList.contains("active")).toBe(true)
    expect(document.activeElement).toBe(searchBar)
  })

  it("should set the z-index of the navbar", () => {
    showSearch(container, searchBar)
    expect(navbar.style.zIndex).toBe("1")
  })

  it("should not throw if the container or search bar is not found", () => {
    expect(() => showSearch(null, null)).not.toThrow()
  })
})

describe("hideSearch", () => {
  let searchContainer: HTMLElement
  let searchBar: HTMLInputElement
  let searchResults: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="search-container" class="active">
        <input id="search-bar" type="text" value="test" />
        <div id="results-container">
          <div>Result 1</div>
        </div>
        <div id="preview-container" class="active"></div>
      </div>
    `
    searchContainer = document.getElementById("search-container") as HTMLElement
    searchBar = document.getElementById("search-bar") as HTMLInputElement
    searchResults = document.getElementById("results-container") as HTMLElement
  })

  it("should hide the search container and clear the search bar", () => {
    hideSearch(null)
    expect(searchContainer.classList.contains("active")).toBe(false)
    expect(searchBar.value).toBe("")
    expect(searchResults.children.length).toBe(0)
  })

  it("hideSearch should hide the search container and the preview manager", () => {
    const previewContainer = document.getElementById("preview-container") as HTMLDivElement
    expect(previewContainer.classList.contains("active")).toBe(true)

    const previewManager = new PreviewManager(previewContainer)
    hideSearch(previewManager)

    expect(previewContainer.classList.contains("active")).toBe(false)
    expect(previewContainer.style.visibility).toBe("hidden")
  })
})

describe("PreviewManager", () => {
  let container: HTMLDivElement
  let previewManager: PreviewManager

  beforeEach(() => {
    document.body.innerHTML = '<div id="preview-container"></div>'
    container = document.getElementById("preview-container") as HTMLDivElement
    previewManager = new PreviewManager(container)
  })

  it("should show the container", () => {
    previewManager.show()
    expect(container.classList.contains("active")).toBe(true)
    expect(container.style.visibility).toBe("visible")
  })

  it("should hide the container", () => {
    previewManager.hide()
    expect(container.classList.contains("active")).toBe(false)
    expect(container.style.visibility).toBe("hidden")
  })

  it("should clear the container", () => {
    previewManager.clear()
    expect(container.innerHTML).toBe("")
  })
})

describe("getOffsetTopRelativeToContainer", () => {
  it("should calculate the correct offsetTop", () => {
    document.body.innerHTML = `
      <div id="container">
        <div id="outer">
          <div id="inner"></div>
        </div>
      </div>
    `

    const container = document.getElementById("container") as HTMLElement
    const outer = document.getElementById("outer") as HTMLElement
    const inner = document.getElementById("inner") as HTMLElement

    // Mock offsetTop
    Object.defineProperty(inner, "offsetTop", { value: 30, configurable: true })
    Object.defineProperty(outer, "offsetTop", { value: 20, configurable: true })
    const trueOffsetTop = 50
    Object.defineProperty(container, "offsetTop", { value: trueOffsetTop, configurable: true })

    // Mock offsetParent
    Object.defineProperty(inner, "offsetParent", { value: outer, configurable: true })
    Object.defineProperty(outer, "offsetParent", { value: container, configurable: true })

    const offsetTop = getOffsetTopRelativeToContainer(inner, container)

    expect(offsetTop).toBe(trueOffsetTop)
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
        // skipcq: JS-0339 - expectedContent is checked for nullability above
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

  it("should skip nodes inside #toc-content-mobile", () => {
    const container = createContainer('<div id="toc-content-mobile"><p>test</p></div>')
    highlightTextNodes(container, "test")
    expect(container.querySelectorAll(".highlight").length).toBe(0)
  })

  it("should not re-highlight already highlighted elements", () => {
    const container = createContainer('<p><span class="highlight">test</span> again</p>')
    highlightTextNodes(container, "test")
    expect(container.querySelectorAll(".highlight").length).toBe(1)
  })
})
