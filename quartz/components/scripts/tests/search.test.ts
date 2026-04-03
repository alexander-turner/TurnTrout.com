/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals"

import { simpleConstants } from "../../constants"
import {
  matchTextNodes,
  descendantsWithId,
  descendantsSamePageLinks,
  tokenizeTerm,
  match,
  escapeRegExp,
  createMatchSpan,
  updatePlaceholder,
  showSearch,
  hideSearch,
  PreviewManager,
  getOffsetTopRelativeToContainer,
  getSearchMatchScrollPosition,
  syncSearchLayoutState,
  setSearchLayoutForTesting,
  navigateWithSearchTerm,
  matchHTML,
} from "../search"

const { searchPlaceholderDesktop, searchPlaceholderMobile } = simpleConstants

jest.mock("../../../styles/variables", () => ({
  tabletBreakpoint: 800,
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

describe("match", () => {
  it("should match a single term", () => {
    const matched = match("world", "Hello world")
    expect(matched).toBe('Hello <span class="search-match">world</span>')
  })

  it("should be case-insensitive", () => {
    const matched = match("world", "Hello World")
    expect(matched).toBe('Hello <span class="search-match">World</span>')
  })

  it("should handle multiple occurrences", () => {
    const matched = match("test", "This is a test. Another test.")
    expect(matched).toBe(
      'This is a <span class="search-match">test</span>. Another <span class="search-match">test</span>.',
    )
  })

  it("should match the longest matching token", () => {
    const matched = match("search term", "This is a search term.")
    expect(matched).toBe(
      'This is a <span class="search-match">search</span> <span class="search-match">term</span>.',
    )
  })

  describe("Trimming and ellipsis", () => {
    const generateText = (numWords: number, suffix = "") =>
      Array.from({ length: numWords }, (_, i) => `word${i}${suffix}`).join(" ")

    it("should not trim short text", () => {
      const text = `${generateText(10)} match ${generateText(10)}`
      const matched = match("match", text, true)
      expect(matched).not.toContain("...")
      expect(matched).toContain('<span class="search-match">match</span>')
    })

    it("should trim long text with match in the middle and add ellipsis on both sides", () => {
      const text = `${generateText(50)} match ${generateText(50)}`
      const matched = match("match", text, true)
      expect(matched.startsWith("...")).toBe(true)
      expect(matched.endsWith("...")).toBe(true)
      expect(matched).toContain('<span class="search-match">match</span>')
    })

    it("should trim long text with match at the beginning and add ellipsis at the end", () => {
      const text = `match ${generateText(100)}`
      const matched = match("match", text, true)
      expect(matched.startsWith("...")).toBe(false)
      expect(matched.endsWith("...")).toBe(true)
      expect(matched).toContain('<span class="search-match">match</span>')
    })

    it("should trim long text with match at the end and add ellipsis at the beginning", () => {
      const text = `${generateText(100)} match`
      const matched = match("match", text, true)
      expect(matched.startsWith("...")).toBe(true)
      expect(matched.endsWith("...")).toBe(false)
      expect(matched).toContain('<span class="search-match">match</span>')
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

describe("createMatchSpan", () => {
  it("should create a span with the correct class and text", () => {
    const span = createMatchSpan("test")
    expect(span.tagName).toBe("SPAN")
    expect(span.className).toBe("search-match")
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
        <input id="search-bar" type="text" value="test" role="combobox" aria-expanded="true" aria-activedescendant="some-result" />
        <div id="results-container" role="listbox">
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
    expect(searchBar.getAttribute("aria-expanded")).toBe("false")
    expect(searchBar.hasAttribute("aria-activedescendant")).toBe(false)
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
    // PreviewManager keeps its root <article> and only clears its contents.
    const article = container.querySelector("article.search-preview")
    expect(article).not.toBeNull()
    expect(article?.innerHTML).toBe("")
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

describe("matchTextNodes", () => {
  const createContainer = (html: string): HTMLElement => {
    const container = document.createElement("div")
    container.innerHTML = html
    return container
  }

  const getMatches = (element: HTMLElement): HTMLSpanElement[] =>
    Array.from(element.getElementsByClassName("search-match")) as HTMLSpanElement[]

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
      expectedHTML: '<p>Hello <span class="search-match">world</span></p>',
      expectedContent: ["world"],
    },
    {
      name: "multiple occurrences",
      html: "<p>test test test</p>",
      searchTerm: "test",
      expectedCount: 3,
      expectedHTML:
        '<p><span class="search-match">test</span> <span class="search-match">test</span> <span class="search-match">test</span></p>',
      expectedContent: ["test", "test", "test"],
    },
    {
      name: "case insensitive matches",
      html: "<p>Test TEST test</p>",
      searchTerm: "test",
      expectedCount: 3,
      expectedHTML:
        '<p><span class="search-match">Test</span> <span class="search-match">TEST</span> <span class="search-match">test</span></p>',
      expectedContent: ["Test", "TEST", "test"],
    },
    {
      name: "nested elements",
      html: "<div><p>First test</p><div><span>Nested test</span></div></div>",
      searchTerm: "test",
      expectedCount: 2,
      expectedHTML:
        '<div><p>First <span class="search-match">test</span></p><div><span>Nested <span class="search-match">test</span></span></div></div>',
      expectedContent: ["test", "test"],
    },
    {
      name: "special regex characters",
      html: "<p>test.com</p>",
      searchTerm: "test.",
      expectedCount: 1,
      expectedHTML: '<p><span class="search-match">test.</span>com</p>',
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
    {
      name: "NBSP normalized to regular space for multi-word matching",
      html: "<p>AI\u00A0presidents discuss alignment</p>",
      searchTerm: "AI presidents",
      expectedCount: 1,
      expectedHTML: '<p><span class="search-match">AI presidents</span> discuss alignment</p>',
      expectedContent: ["AI presidents"],
    },
  ]

  it.each(testCases)(
    "should handle $name",
    ({ html, searchTerm, expectedCount, expectedHTML, expectedContent }) => {
      const container = createContainer(html)
      matchTextNodes(container, searchTerm)
      expect(container.innerHTML).toBe(expectedHTML)

      const matches = getMatches(container)
      expect(matches).toHaveLength(expectedCount)
      matches.forEach((span, i) => {
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

    expect(() => matchTextNodes(container, "test")).not.toThrow()
  })

  it("should skip nodes inside #toc-content-mobile", () => {
    const container = createContainer('<div id="toc-content-mobile"><p>test</p></div>')
    matchTextNodes(container, "test")
    expect(container.querySelectorAll(".search-match").length).toBe(0)
  })

  it("should not re-match already matched elements", () => {
    const container = createContainer('<p><span class="search-match">test</span> again</p>')
    matchTextNodes(container, "test")
    expect(container.querySelectorAll(".search-match").length).toBe(1)
  })
})

describe("matchHTML", () => {
  it("should preserve checkbox checked state when matching", () => {
    // Create an element with a checkbox
    const element = document.createElement("div")
    element.innerHTML = `
      <div class="previewable">
        <p>This is a test paragraph with checkboxes</p>
        <ul>
          <li><input type="checkbox" class="checkbox-toggle"> Unchecked item</li>
          <li><input type="checkbox" class="checkbox-toggle"> Checked item</li>
          <li><input type="checkbox" class="checkbox-toggle"> Another checked item</li>
        </ul>
      </div>
    `

    // Set checkbox states (simulating what processPreviewables does)
    const checkboxes = element.querySelectorAll("input.checkbox-toggle")
    ;(checkboxes[0] as HTMLInputElement).checked = false
    ;(checkboxes[1] as HTMLInputElement).checked = true
    ;(checkboxes[2] as HTMLInputElement).checked = true

    const matched = matchHTML("test", element)

    // Verify the text was matched
    const matchSpans = matched.querySelectorAll(".search-match")
    expect(matchSpans.length).toBeGreaterThan(0)
    expect(matchSpans[0].textContent).toBe("test")

    // Verify checkbox states were preserved
    const matchedCheckboxes = matched.querySelectorAll("input.checkbox-toggle")
    expect(matchedCheckboxes.length).toBe(3)
    expect((matchedCheckboxes[0] as HTMLInputElement).checked).toBe(false)
    expect((matchedCheckboxes[1] as HTMLInputElement).checked).toBe(true)
    expect((matchedCheckboxes[2] as HTMLInputElement).checked).toBe(true)
  })

  it("should preserve other DOM properties when matching", () => {
    const element = document.createElement("div")
    element.innerHTML = `
      <div>
        <input type="text" class="test-input" value="initial">
        <p>Search for test</p>
      </div>
    `

    // Set a DOM property (not an attribute)
    const input = element.querySelector("input.test-input") as HTMLInputElement
    input.value = "modified value"

    const matched = matchHTML("test", element)

    // Verify the input value was preserved
    const matchedInput = matched.querySelector("input.test-input") as HTMLInputElement
    expect(matchedInput.value).toBe("modified value")

    // Verify matching still works
    const matchSpans = matched.querySelectorAll(".search-match")
    expect(matchSpans.length).toBeGreaterThan(0)
  })

  it("should return a cloned element, not modify the original", () => {
    const element = document.createElement("div")
    element.innerHTML = "<p>test content</p>"

    const matched = matchHTML("test", element)

    // Original should be unchanged
    expect(element.querySelectorAll(".search-match").length).toBe(0)

    // matched should have matches
    expect(matched.querySelectorAll(".search-match").length).toBeGreaterThan(0)
  })
})

describe("getSearchMatchScrollPosition", () => {
  it("should calculate scroll position based on element offset and scroll fraction", () => {
    const container = document.createElement("div")
    Object.defineProperty(container, "clientHeight", {
      value: 1000,
      writable: true,
    })

    const element = document.createElement("div")
    container.appendChild(element)
    document.body.appendChild(container)

    const scrollFraction = 0.3
    const result = getSearchMatchScrollPosition(element, container, scrollFraction)

    // The result should be offsetTop - (clientHeight * scrollFraction)
    // Since element is at top of container, offsetTop should be 0
    // Expected: 0 - (1000 * 0.3) = -300
    expect(result).toBe(-300)

    document.body.removeChild(container)
  })

  it("should handle different scroll fractions", () => {
    const container = document.createElement("div")
    Object.defineProperty(container, "clientHeight", {
      value: 800,
      writable: true,
    })

    const element = document.createElement("div")
    container.appendChild(element)
    document.body.appendChild(container)

    // Test with 0.5 scroll fraction
    const result = getSearchMatchScrollPosition(element, container, 0.5)

    // Expected: 0 - (800 * 0.5) = -400
    expect(result).toBe(-400)

    document.body.removeChild(container)
  })
})

describe("syncSearchLayoutState", () => {
  let container: HTMLElement
  let searchBar: HTMLInputElement
  let searchLayout: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="search-container" class="active">
        <input id="search-bar" type="text" value="" />
      </div>
      <div id="search-layout"></div>
    `
    container = document.getElementById("search-container") as HTMLElement
    searchBar = document.getElementById("search-bar") as HTMLInputElement
    searchLayout = document.getElementById("search-layout") as HTMLElement
    setSearchLayoutForTesting(searchLayout)
  })

  afterEach(() => {
    setSearchLayoutForTesting(null)
  })

  it("should add display-results class when search bar has text", () => {
    searchBar.value = "test query"
    syncSearchLayoutState()
    expect(searchLayout.classList.contains("display-results")).toBe(true)
  })

  it("should remove display-results class when search bar is empty", () => {
    searchLayout.classList.add("display-results")
    searchBar.value = ""
    syncSearchLayoutState()
    expect(searchLayout.classList.contains("display-results")).toBe(false)
  })

  it("should handle whitespace-only input", () => {
    searchBar.value = "   "
    syncSearchLayoutState()
    expect(searchLayout.classList.contains("display-results")).toBe(false)
  })

  it("should not throw when document is hidden", () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    })
    expect(() => syncSearchLayoutState()).not.toThrow()
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    })
  })

  it("should not throw when container is not active", () => {
    container.classList.remove("active")
    expect(() => syncSearchLayoutState()).not.toThrow()
  })
})

describe("navigateWithSearchTerm", () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>
  let originalSpaNavigate: typeof window.spaNavigate

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="search-container" class="active">
        <input id="search-bar" type="text" value="test" />
      </div>
    `
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {
      // Mock implementation - suppress console errors in tests
    })
    originalSpaNavigate = window.spaNavigate
    window.spaNavigate = jest.fn() as typeof window.spaNavigate
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    window.spaNavigate = originalSpaNavigate
  })

  it("should navigate with text fragment when search term is provided", () => {
    const href = "https://example.com/page"
    const searchTerm = "test query"

    navigateWithSearchTerm(href, searchTerm)

    expect(window.spaNavigate).toHaveBeenCalledTimes(1)
    const mockFn = window.spaNavigate as jest.Mock
    const calledUrl = mockFn.mock.calls[0][0] as URL
    expect(calledUrl.href).toContain("example.com/page")
    expect(calledUrl.hash).toBe("#:~:text=test%20query")
  })

  it("should log error when search term is empty", () => {
    const href = "https://example.com/page"
    const searchTerm = ""

    navigateWithSearchTerm(href, searchTerm)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[navigateWithSearchTerm] No search term available for result card navigation - this should not happen",
    )
  })

  it("should encode special characters in search term", () => {
    const href = "https://example.com/page"
    const searchTerm = "test & query"

    navigateWithSearchTerm(href, searchTerm)

    const mockFn = window.spaNavigate as jest.Mock
    const calledUrl = mockFn.mock.calls[0][0] as URL
    expect(calledUrl.hash).toBe("#:~:text=test%20%26%20query")
  })
})
