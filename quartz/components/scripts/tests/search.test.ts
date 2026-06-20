/**
 * @jest-environment jest-fixed-jsdom
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import { type ContentDetails } from "../../../plugins/vfile"
import { NBSP, simpleConstants } from "../../constants"
import {
  compareMatchScore,
  createMatchSpan,
  descendantsSamePageLinks,
  descendantsWithId,
  findBestMatchToScrollTo,
  getSearchStateForTesting,
  hideSearch,
  initializeSearch,
  match,
  matchHTML,
  matchTextNodes,
  navigateWithSearchTerm,
  PreviewManager,
  resetSearchStateForTesting,
  scoreDocByMatchDegree,
  scrollContainerToMatch,
  setSearchInitializedForTesting,
  setSearchLayoutForTesting,
  shouldRescrollCardPreviews,
  showSearch,
  syncSearchLayoutState,
  tokenizeTerm,
  updatePlaceholder,
} from "../search"

const { searchPlaceholderDesktop, searchPlaceholderMobile } = simpleConstants

jest.mock("../../../styles/variables", () => ({
  tabletBreakpoint: 800,
}))

/** Set the global getContentIndex stub used by initializeSearch.
 *  The cast is needed because tests return null to simulate fetch failures,
 *  which the production declaration doesn't allow. */
function stubGetContentIndex(fn: () => Promise<Record<string, unknown> | null>): void {
  globalThis.getContentIndex = fn as typeof getContentIndex
}

/** Remove the global getContentIndex stub. */
function removeGetContentIndex(): void {
  // The global declaration marks getContentIndex as a required function,
  // but in tests we need to remove it to avoid leaking between tests.
  // Reflect.deleteProperty works on the global object without a type cast.
  Reflect.deleteProperty(globalThis, "getContentIndex")
}

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

  it.each([
    {
      name: "angle brackets",
      term: "script",
      text: "Try <script>alert(1)</script> here",
      shouldContain: ["&lt;", "&gt;", '<span class="search-match">script</span>'],
      shouldNotContain: ["<script>"],
    },
    {
      name: "ampersands",
      term: "R",
      text: "R&D department",
      shouldContain: ["&amp;D", '<span class="search-match">R</span>'],
      shouldNotContain: [],
    },
    {
      name: "quotes",
      term: "hello",
      text: 'She said "hello" today',
      shouldContain: ["&quot;", '<span class="search-match">hello</span>'],
      shouldNotContain: [],
    },
  ])(
    "should HTML-escape $name in content tokens",
    ({ term, text, shouldContain, shouldNotContain }) => {
      const matched = match(term, text)
      for (const s of shouldContain) expect(matched).toContain(s)
      for (const s of shouldNotContain) expect(matched).not.toContain(s)
    },
  )

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

describe("createMatchSpan", () => {
  it("should create a span with the correct class and text", () => {
    const span = createMatchSpan("test")
    expect(span.tagName).toBe("SPAN")
    expect(span.className).toBe("search-match")
    expect(span.textContent).toBe("test")
  })
})

describe("findBestMatchToScrollTo", () => {
  it("returns null when the container has no matches", () => {
    const container = document.createElement("div")
    expect(findBestMatchToScrollTo(container)).toBeNull()
  })

  it("prefers a longer-text match over an earlier shorter one", () => {
    const container = document.createElement("div")
    container.appendChild(createMatchSpan("fixture"))
    container.appendChild(document.createTextNode(" — "))
    const phrase = createMatchSpan("Checkboxes fixture")
    container.appendChild(phrase)
    expect(findBestMatchToScrollTo(container)).toBe(phrase)
  })

  it("falls back to DOM order for matches of equal length", () => {
    const container = document.createElement("div")
    const first = createMatchSpan("foo")
    const second = createMatchSpan("bar")
    container.appendChild(first)
    container.appendChild(second)
    expect(findBestMatchToScrollTo(container)).toBe(first)
  })

  it("returns the only match when there is just one", () => {
    const container = document.createElement("div")
    const only = createMatchSpan("foo")
    container.appendChild(only)
    expect(findBestMatchToScrollTo(container)).toBe(only)
  })

  // Helper: builds a container alternating text fragments with match spans.
  // `parts` is a flat list where every other entry is a match span text.
  // The returned `expected` is the span at `expectedIdx`.
  const buildContainer = (
    parts: readonly (string | { match: string })[],
  ): { container: HTMLElement; spans: HTMLSpanElement[] } => {
    const container = document.createElement("div")
    const spans: HTMLSpanElement[] = []
    for (const part of parts) {
      if (typeof part === "string") {
        container.appendChild(document.createTextNode(part))
      } else {
        const span = createMatchSpan(part.match)
        container.appendChild(span)
        spans.push(span)
      }
    }
    return { container, spans }
  }

  it("prefers a whole-word match over an earlier substring-only match", () => {
    // "comfor[table]. A [table] here." — second span is the standalone word.
    const { container, spans } = buildContainer([
      "comfor",
      { match: "table" },
      ". A ",
      { match: "table" },
      " here.",
    ])
    expect(findBestMatchToScrollTo(container)).toBe(spans[1])
  })

  it("falls back to longest match within the substring-only tier", () => {
    const { container, spans } = buildContainer([
      "comfor",
      { match: "table" },
      "foo ",
      { match: "checkboxes fixture" },
      "bar",
    ])
    expect(findBestMatchToScrollTo(container)).toBe(spans[1])
  })

  it("treats Unicode letters as word characters when deciding boundaries", () => {
    // 'é' makes the first match substring-only; the standalone "table" wins.
    const { container, spans } = buildContainer([
      "ré",
      { match: "table" },
      " et ",
      { match: "table" },
    ])
    expect(findBestMatchToScrollTo(container)).toBe(spans[1])
  })

  it("treats empty sibling text nodes as word boundaries", () => {
    // matchTextNodes leaves empty text nodes in some split cases.
    const { container, spans } = buildContainer(["", { match: "table" }, ""])
    expect(findBestMatchToScrollTo(container)).toBe(spans[0])
  })

  it("treats sibling text nodes with null nodeValue as word boundaries", () => {
    const { container, spans } = buildContainer(["a", { match: "table" }, "a"])
    for (const sib of [container.firstChild, container.lastChild]) {
      Object.defineProperty(sib, "nodeValue", { configurable: true, get: () => null })
    }
    expect(findBestMatchToScrollTo(container)).toBe(spans[0])
  })
})

describe("scoreDocByMatchDegree", () => {
  const makeDetails = (partial: Partial<ContentDetails>): ContentDetails => ({
    title: partial.title ?? "",
    content: partial.content ?? "",
    links: [],
    tags: [],
    authors: partial.authors ?? [],
  })

  it("returns all zeros when no token matches title, content, or authors", () => {
    const details = makeDetails({ title: "Hello", content: "world", authors: ["nemo"] })
    expect(scoreDocByMatchDegree(details, ["zzz"])).toEqual([0, 0, 0, 0, 0, 0])
  })

  it("scores each field separately, preferring the longest match in each", () => {
    const details = makeDetails({
      title: "Popover content fixture",
      content: "Section: Checkboxes fixture and friends",
      authors: ["Trout"],
    })
    const tokens = ["checkboxes fixture", "checkboxes", "fixture", "trout"]
    expect(scoreDocByMatchDegree(details, tokens)).toEqual([
      "fixture".length,
      "trout".length,
      "checkboxes fixture".length,
      "fixture".length,
      "trout".length,
      "checkboxes fixture".length,
    ])
  })

  it("is case-insensitive on the haystack (tokens come pre-lowercased)", () => {
    expect(scoreDocByMatchDegree(makeDetails({ title: "Hello WORLD" }), ["world"])).toEqual([
      5, 0, 0, 5, 0, 0,
    ])
  })

  it("matches against the authors field", () => {
    expect(scoreDocByMatchDegree(makeDetails({ authors: ["Alex Turner"] }), ["turner"])).toEqual([
      0, 6, 0, 0, 6, 0,
    ])
  })

  it.each([
    {
      name: "substring-only hit when token appears only inside a larger word",
      details: { title: "Comfortable Predictable Stable" },
      expected: [0, 0, 0, 5, 0, 0],
    },
    {
      name: "whole-word hit when token is bounded by non-word chars",
      details: { content: "Insert a table here." },
      expected: [0, 0, 5, 0, 0, 5],
    },
    {
      // 'é' is a Unicode letter, so "table" inside "rétable" is not a whole word
      // even though ASCII-only \b would say it is.
      name: "Unicode letters count as word characters",
      details: { content: "Un rétable médiéval" },
      expected: [0, 0, 0, 0, 0, 5],
    },
    {
      name: "whole-word hit recorded even when substring-only hits also present",
      details: { content: "The comfortable table is here." },
      expected: [0, 0, 5, 0, 0, 5],
    },
  ])("$name", ({ details, expected }) => {
    expect(scoreDocByMatchDegree(makeDetails(details), ["table"])).toEqual(expected)
  })

  it("ranks a content whole-word hit above a title substring-only hit", () => {
    const titleSubstring = scoreDocByMatchDegree(makeDetails({ title: "Comfortable" }), ["table"])
    const contentWholeWord = scoreDocByMatchDegree(makeDetails({ content: "A table." }), ["table"])
    expect(compareMatchScore(contentWholeWord, titleSubstring)).toBeLessThan(0)
  })

  it("keeps first substring length when multiple tokens match the same field", () => {
    // "table" and "ab" both appear in "uncomfortable" as substrings (no whole-word match).
    // substringLen is set by "table" (first match); the "ab" token hits the else-branch
    // of `if (substringLen === 0)` and does not overwrite it.
    expect(
      scoreDocByMatchDegree(makeDetails({ title: "Uncomfortable" }), ["table", "ab"]),
    ).toEqual([0, 0, 0, 5, 0, 0])
  })
})

describe("compareMatchScore", () => {
  type Score = [number, number, number, number, number, number]
  it.each([
    {
      name: "whole-word title hit outranks whole-word authors hit, regardless of length",
      a: [3, 0, 0, 0, 0, 0],
      b: [0, 100, 0, 0, 0, 0],
      expected: "a-first",
    },
    {
      name: "whole-word authors hit outranks whole-word content hit",
      a: [0, 3, 0, 0, 0, 0],
      b: [0, 0, 100, 0, 0, 0],
      expected: "a-first",
    },
    {
      name: "any whole-word hit outranks any substring-only hit",
      a: [0, 0, 3, 0, 0, 0],
      b: [0, 0, 0, 100, 100, 100],
      expected: "a-first",
    },
    {
      name: "within whole-word title tier, longer token wins",
      a: [18, 0, 0, 0, 0, 0],
      b: [7, 99, 99, 0, 0, 0],
      expected: "a-first",
    },
    {
      name: "substring title hit outranks substring authors hit",
      a: [0, 0, 0, 3, 0, 0],
      b: [0, 0, 0, 0, 100, 0],
      expected: "a-first",
    },
    {
      name: "equal tuples compare equal (stable sort preserves input order)",
      a: [5, 5, 5, 5, 5, 5],
      b: [5, 5, 5, 5, 5, 5],
      expected: "tie",
    },
  ])("$name", ({ a, b, expected }) => {
    const cmp = compareMatchScore(a as Score, b as Score)
    const sign = cmp === 0 ? 0 : Math.sign(cmp)
    const expectedSign = expected === "a-first" ? -1 : expected === "b-first" ? 1 : 0
    expect(sign).toBe(expectedSign)
  })
})

describe("updatePlaceholder", () => {
  const searchBar = document.createElement("input")
  searchBar.id = "search-bar"
  document.body.appendChild(searchBar)
  it("should set the placeholder to desktop version on wide screens", () => {
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
    document.body.style.overflow = ""
    container = document.getElementById("search-container") as HTMLElement
    searchBar = document.getElementById("search-bar") as HTMLInputElement
    navbar = document.getElementById("navbar") as HTMLElement
    // Simulate already-initialized search so showSearch exercises the
    // "already initialized" path (lines 458-473) instead of delegating
    // to maybeInitializeSearch.
    setSearchInitializedForTesting(true)
  })

  afterEach(() => {
    resetSearchStateForTesting()
  })

  it("should make the search container active and focus the search bar", () => {
    // skipcq: JS-0098 — fire-and-forget; void marks the intentionally floating promise
    void showSearch(container, searchBar)
    expect(container.classList.contains("active")).toBe(true)
    expect(document.activeElement).toBe(searchBar)
  })

  it("should set the z-index of the navbar", () => {
    // skipcq: JS-0098 — fire-and-forget; void marks the intentionally floating promise
    void showSearch(container, searchBar)
    expect(navbar.style.zIndex).toBe("1")
  })

  it("should lock body scroll by setting overflow hidden", () => {
    expect(document.body.style.overflow).toBe("")
    // skipcq: JS-0098 — fire-and-forget; void marks the intentionally floating promise
    void showSearch(container, searchBar)
    expect(document.body.style.overflow).toBe("hidden")
  })

  it("should not throw if the container or search bar is not found", () => {
    expect(() => showSearch(null, null)).not.toThrow()
  })

  it("should show UI and trigger initialization when search is not yet initialized", async () => {
    // skipcq: JS-0321 -- intentional no-op: suppress console.error noise in tests
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    resetSearchStateForTesting()
    stubGetContentIndex(() => Promise.resolve(null))

    await showSearch(container, searchBar)

    expect(container.classList.contains("active")).toBe(true)
    expect(document.body.style.overflow).toBe("hidden")
    removeGetContentIndex()
    spy.mockRestore()
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

  it("should restore body scroll by clearing overflow", () => {
    document.body.style.overflow = "hidden"
    hideSearch(null)
    expect(document.body.style.overflow).toBe("")
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
      html: `<p>AI${NBSP}presidents discuss alignment</p>`,
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

describe("scrollContainerToMatch", () => {
  it.each([
    {
      scrollFraction: 0.5,
      matchTop: 500,
      containerTop: 100,
      scrollTop: 50,
      clientHeight: 400,
      expected: 250,
    },
    {
      scrollFraction: 1 / 3,
      matchTop: 300,
      containerTop: 0,
      scrollTop: 0,
      clientHeight: 600,
      expected: 100,
    },
    {
      scrollFraction: 0.5,
      matchTop: 50,
      containerTop: 100,
      scrollTop: 0,
      clientHeight: 800,
      expected: 0,
    },
  ])(
    "scrolls to fraction=$scrollFraction with matchTop=$matchTop",
    ({ scrollFraction, matchTop, containerTop, scrollTop, clientHeight, expected }) => {
      const container = document.createElement("div")
      const match = document.createElement("span")
      container.appendChild(match)
      document.body.appendChild(container)

      Object.defineProperty(container, "scrollTop", { value: scrollTop, writable: true })
      Object.defineProperty(container, "clientHeight", { value: clientHeight })
      match.getBoundingClientRect = () => ({ top: matchTop }) as DOMRect
      container.getBoundingClientRect = () => ({ top: containerTop }) as DOMRect

      scrollContainerToMatch(container, match, scrollFraction)

      expect(container.scrollTop).toBe(expected)
      document.body.removeChild(container)
    },
  )
})

describe("shouldRescrollCardPreviews", () => {
  // tabletBreakpoint is mocked to 800 at the top of this file.
  it.each<[string, number, number, boolean]>([
    ["above breakpoint — cards hidden, skip", 1200, 500, false],
    ["at breakpoint — boundary still 'mobile', allow", 800, 700, true],
    ["below breakpoint, width unchanged — no horizontal reflow, skip", 600, 600, false],
    ["below breakpoint, width changed — content reflowed, rescroll", 600, 700, true],
    ["above breakpoint with width change — still skip", 1200, 1100, false],
  ])("%s", (_label, current, prev, expected) => {
    expect(shouldRescrollCardPreviews(current, prev)).toBe(expected)
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

  it("should pass the search term via opts and leave the URL hash empty", () => {
    const href = "https://example.com/page"
    const searchTerm = "test query"

    navigateWithSearchTerm(href, searchTerm)

    expect(window.spaNavigate).toHaveBeenCalledTimes(1)
    const mockFn = window.spaNavigate as jest.Mock
    const calledUrl = mockFn.mock.calls[0][0] as URL
    const calledOpts = mockFn.mock.calls[0][1] as { searchTerm?: string }
    expect(calledUrl.href).toContain("example.com/page")
    expect(calledUrl.hash).toBe("")
    expect(calledOpts).toEqual({ searchTerm: "test query" })
  })

  it("should throw when search term is empty", () => {
    const href = "https://example.com/page"
    const searchTerm = ""

    expect(() => navigateWithSearchTerm(href, searchTerm)).toThrow(
      "[navigateWithSearchTerm] No search term available for result card navigation",
    )
  })

  it("forwards special characters in the search term unchanged", () => {
    const href = "https://example.com/page"
    const searchTerm = "test & query"

    navigateWithSearchTerm(href, searchTerm)

    const mockFn = window.spaNavigate as jest.Mock
    const calledUrl = mockFn.mock.calls[0][0] as URL
    const calledOpts = mockFn.mock.calls[0][1] as { searchTerm?: string }
    expect(calledUrl.hash).toBe("")
    expect(calledOpts.searchTerm).toBe("test & query")
  })
})

describe("initializeSearch retry after failed fetch", () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    // skipcq: JS-0321 -- intentional no-op: suppress console.error noise in tests
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    resetSearchStateForTesting()
    document.body.innerHTML = `
      <div id="search-container">
        <input id="search-bar" type="text" placeholder="Search" />
        <div id="search-layout" data-preview="false"></div>
      </div>
    `
    setSearchLayoutForTesting(document.getElementById("search-layout"))
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    resetSearchStateForTesting()
    removeGetContentIndex()
  })

  it("should not mark search as initialized when data fetch returns null", async () => {
    // Simulate getContentIndex returning null (fetch failure)
    stubGetContentIndex(() => Promise.resolve(null))

    await initializeSearch()

    const state = getSearchStateForTesting()
    expect(state.searchInitialized).toBe(false)
    expect(state.hasData).toBe(false)
    expect(state.hasIndex).toBe(false)
  })

  it("should allow retry after a failed initialization", async () => {
    // First attempt: getContentIndex returns null
    stubGetContentIndex(() => Promise.resolve(null))

    await initializeSearch()
    expect(getSearchStateForTesting().searchInitialized).toBe(false)

    // Second attempt: getContentIndex returns valid data
    stubGetContentIndex(() =>
      Promise.resolve({
        "test-slug": {
          title: "Test Page",
          content: "Test content for searching",
          slug: "test-slug",
          authors: ["Author"],
        },
      }),
    )

    await initializeSearch()

    const state = getSearchStateForTesting()
    expect(state.searchInitialized).toBe(true)
    expect(state.hasData).toBe(true)
    expect(state.hasIndex).toBe(true)
  })
})
