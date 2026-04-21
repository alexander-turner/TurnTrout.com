/**
 * @jest-environment jest-fixed-jsdom
 * @jest-environment-options {"url": "http://localhost:8080"}
 */

import { jest, describe, it, beforeEach, afterEach, expect } from "@jest/globals"

import { scrollPositionKeyPrefix, scrollPositionMinThreshold } from "../constants"
import {
  extractMetaRefreshUrl,
  getNavigationOpts,
  handleNavigationScroll,
  isElement,
  isLocalUrl,
  saveScrollToLocalStorage,
  scrollToMatch,
  scrollToUrlTarget,
  updateHeadElements,
} from "./spa_utils"

describe("SPA Utilities", () => {
  describe("isLocalUrl", () => {
    it.each([
      { url: "http://localhost:8080/path", isLocal: true, description: "exact origin match" },
      { url: "http://localhost:8080/another/path#hash", isLocal: true, description: "with hash" },
      {
        url: "//localhost:8080/path",
        isLocal: true,
        description: "protocol-relative with matching host",
      },
      { url: "https://example.com", isLocal: false, description: "different domain" },
      {
        url: "http://otherdomain.com/path",
        isLocal: false,
        description: "different domain with path",
      },
      { url: "ftp://server.com", isLocal: false, description: "different protocol" },
      { url: "not a url", isLocal: true, description: "relative path resolves to same origin" },
      { url: "http://", isLocal: false, description: "incomplete URL" },
    ])("should return $isLocal for $description: $url", ({ url, isLocal }) => {
      expect(isLocalUrl(url)).toBe(isLocal)
    })
  })

  describe("isElement", () => {
    it("returns true for HTMLElements", () => {
      expect(isElement(document.createElement("div"))).toBe(true)
    })

    it("returns false for text nodes", () => {
      expect(isElement(document.createTextNode("hi"))).toBe(false)
    })

    it("returns false for null", () => {
      expect(isElement(null)).toBe(false)
    })

    it("returns false for non-DOM EventTargets", () => {
      expect(isElement(window)).toBe(false)
    })
  })
})

describe("getNavigationOpts", () => {
  const makeClick = (target: EventTarget | null): Event => ({ target }) as unknown as Event

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("returns undefined when target is null", () => {
    expect(getNavigationOpts(makeClick(null))).toBeUndefined()
  })

  it("returns undefined when target is a non-Element node", () => {
    const textNode = document.createTextNode("plain text")
    expect(getNavigationOpts(makeClick(textNode))).toBeUndefined()
  })

  it("returns undefined when target has no ancestor anchor", () => {
    const span = document.createElement("span")
    document.body.appendChild(span)
    expect(getNavigationOpts(makeClick(span))).toBeUndefined()
  })

  it('returns undefined when clicked anchor has target="_blank"', () => {
    const anchor = document.createElement("a")
    anchor.href = "http://localhost:8080/foo"
    anchor.setAttribute("target", "_blank")
    document.body.appendChild(anchor)
    expect(getNavigationOpts(makeClick(anchor))).toBeUndefined()
  })

  it("returns undefined for an external link", () => {
    const anchor = document.createElement("a")
    anchor.href = "https://example.com/bar"
    document.body.appendChild(anchor)
    expect(getNavigationOpts(makeClick(anchor))).toBeUndefined()
  })

  it("returns undefined when anchor has data-router-ignore", () => {
    const anchor = document.createElement("a")
    anchor.href = "http://localhost:8080/ignore"
    anchor.setAttribute("data-router-ignore", "")
    document.body.appendChild(anchor)
    expect(getNavigationOpts(makeClick(anchor))).toBeUndefined()
  })

  it("returns undefined when anchor has empty href", () => {
    const anchor = document.createElement("a")
    document.body.appendChild(anchor)
    expect(getNavigationOpts(makeClick(anchor))).toBeUndefined()
  })

  it("returns URL when anchor is a local link", () => {
    const anchor = document.createElement("a")
    anchor.href = "http://localhost:8080/page"
    document.body.appendChild(anchor)

    const result = getNavigationOpts(makeClick(anchor))
    expect(result?.url.href).toBe("http://localhost:8080/page")
    expect(result?.scroll).toBeUndefined()
  })

  it("resolves closest-ancestor anchor when a nested element is clicked", () => {
    const anchor = document.createElement("a")
    anchor.href = "http://localhost:8080/nested"
    const inner = document.createElement("span")
    anchor.appendChild(inner)
    document.body.appendChild(anchor)

    const result = getNavigationOpts(makeClick(inner))
    expect(result?.url.href).toBe("http://localhost:8080/nested")
  })

  it("sets scroll=false when anchor has data-router-no-scroll", () => {
    const anchor = document.createElement("a")
    anchor.href = "http://localhost:8080/no-scroll"
    anchor.setAttribute("data-router-no-scroll", "")
    document.body.appendChild(anchor)

    const result = getNavigationOpts(makeClick(anchor))
    expect(result?.scroll).toBe(false)
  })
})

describe("saveScrollToLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("persists scroll positions above the minimum threshold", () => {
    saveScrollToLocalStorage("/page", scrollPositionMinThreshold + 100)
    expect(localStorage.getItem(`${scrollPositionKeyPrefix}/page`)).toBe(
      `${scrollPositionMinThreshold + 100}`,
    )
  })

  it("removes existing entry when new position is below threshold", () => {
    const key = `${scrollPositionKeyPrefix}/page`
    localStorage.setItem(key, "500")
    saveScrollToLocalStorage("/page", scrollPositionMinThreshold - 1)
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("does not create entry when position is below threshold", () => {
    saveScrollToLocalStorage("/page", 0)
    expect(localStorage.getItem(`${scrollPositionKeyPrefix}/page`)).toBeNull()
  })
})

describe("scrollToMatch", () => {
  let scrollSpy: jest.SpiedFunction<typeof window.scrollTo>

  beforeEach(() => {
    document.body.innerHTML = ""
    scrollSpy = jest.spyOn(window, "scrollTo").mockImplementation(() => {})
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true })
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true })
  })

  afterEach(() => {
    scrollSpy.mockRestore()
  })

  it("returns false when there is no <article> in the document", () => {
    expect(scrollToMatch("anything")).toBe(false)
  })

  it("returns false when no matches in article or title", () => {
    const article = document.createElement("article")
    article.innerHTML = "<p>Nothing interesting here.</p>"
    document.body.appendChild(article)

    expect(scrollToMatch("xyzzy")).toBe(false)
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it("returns true and stays at top when only the title matches", () => {
    const title = document.createElement("h1")
    title.id = "article-title"
    title.textContent = "Unique Title"
    const article = document.createElement("article")
    article.innerHTML = "<p>Body without match.</p>"
    document.body.append(title, article)

    expect(scrollToMatch("Unique")).toBe(true)
    expect(scrollSpy).not.toHaveBeenCalled()
    // Highlighted title should remain in the DOM (replaced by matched version).
    const newTitle = document.getElementById("article-title") as HTMLElement
    expect(newTitle.querySelector(".search-match")?.textContent).toBe("Unique")
  })

  it("scrolls the window when a body match is found", () => {
    const article = document.createElement("article")
    article.innerHTML = "<p>Hello world hello</p>"
    document.body.appendChild(article)

    const result = scrollToMatch("world")
    expect(result).toBe(true)
    expect(scrollSpy).toHaveBeenCalledTimes(1)
    const arg = scrollSpy.mock.calls[0][0] as ScrollToOptions
    expect(arg.behavior).toBe("instant")
    // 0 (top) + 0 (scrollY) - 800*0.25 = -200 since getBoundingClientRect returns 0 in jsdom
    expect(arg.top).toBe(-200)
  })
})

describe("scrollToUrlTarget", () => {
  let scrollSpy: jest.SpiedFunction<typeof window.scrollTo>

  beforeEach(() => {
    document.body.innerHTML = ""
    scrollSpy = jest.spyOn(window, "scrollTo").mockImplementation(() => {})
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true })
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true })
  })

  afterEach(() => {
    scrollSpy.mockRestore()
  })

  it("does nothing when urlTarget is empty", () => {
    scrollToUrlTarget("")
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it("scrolls to an element with the given id", () => {
    const target = document.createElement("div")
    target.id = "section-one"
    document.body.appendChild(target)

    scrollToUrlTarget("#section-one")
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })

  it("decodes URL-encoded ids", () => {
    const target = document.createElement("div")
    target.id = "my section"
    document.body.appendChild(target)

    scrollToUrlTarget("#my%20section")
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })

  it("does not throw when the element id does not exist", () => {
    expect(() => scrollToUrlTarget("#missing")).not.toThrow()
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it("uses the text-fragment branch and scrolls to the match", () => {
    const article = document.createElement("article")
    article.innerHTML = "<p>Alpha bravo charlie</p>"
    document.body.appendChild(article)

    scrollToUrlTarget("#:~:text=bravo")
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })

  it("falls back to standard hash lookup when text-fragment yields no match", () => {
    const article = document.createElement("article")
    article.innerHTML = "<p>No needles here.</p>"
    document.body.appendChild(article)

    const anchor = document.createElement("div")
    anchor.id = ":~:text=missing"
    document.body.appendChild(anchor)

    scrollToUrlTarget("#:~:text=missing")
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })
})

describe("handleNavigationScroll", () => {
  let scrollSpy: jest.SpiedFunction<typeof window.scrollTo>

  beforeEach(() => {
    document.body.innerHTML = ""
    scrollSpy = jest.spyOn(window, "scrollTo").mockImplementation(() => {})
  })

  afterEach(() => {
    scrollSpy.mockRestore()
  })

  it("does not scroll when opts.scroll is false", () => {
    handleNavigationScroll(new URL("http://localhost:8080/foo#bar"), { scroll: false })
    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it("scrolls to the hash target when a hash is present", () => {
    const anchor = document.createElement("div")
    anchor.id = "bar"
    document.body.appendChild(anchor)

    handleNavigationScroll(new URL("http://localhost:8080/foo#bar"))
    expect(scrollSpy).toHaveBeenCalledTimes(1)
  })

  it("scrolls to the top when no hash is present", () => {
    handleNavigationScroll(new URL("http://localhost:8080/foo"))
    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: "instant" })
  })
})

describe("extractMetaRefreshUrl", () => {
  it.each([
    {
      html: '<meta http-equiv="refresh" content="0;url=/next">',
      expected: "/next",
      description: "simple absolute path",
    },
    {
      html: '<meta http-equiv="refresh" content="5;url=https://other.com/page">',
      expected: "https://other.com/page",
      description: "absolute URL with delay",
    },
    {
      html: "<meta http-equiv=refresh content='0;url=relative/page'>",
      expected: "relative/page",
      description: "unquoted http-equiv + single quotes",
    },
    {
      html: '<META HTTP-EQUIV="REFRESH" CONTENT="0;URL=/upper">',
      expected: "/upper",
      description: "uppercase attributes",
    },
  ])("returns $expected for $description", ({ html, expected }) => {
    expect(extractMetaRefreshUrl(html)).toBe(expected)
  })

  it.each([
    { html: "<p>no meta here</p>", description: "no meta tag" },
    {
      html: '<meta name="description" content="0;url=/no">',
      description: "meta without http-equiv=refresh",
    },
    {
      html: '<meta http-equiv="refresh" content="0">',
      description: "meta refresh without url=",
    },
  ])("returns null for $description", ({ html }) => {
    expect(extractMetaRefreshUrl(html)).toBeNull()
  })
})

describe("updateHeadElements", () => {
  let originalHead: string

  beforeEach(() => {
    originalHead = document.head.innerHTML
  })

  afterEach(() => {
    document.head.innerHTML = originalHead
    document.title = ""
  })

  const parseDoc = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

  it("updates the document title when the new doc has one", () => {
    document.title = "Old"
    const newDoc = parseDoc("<html><head><title>New</title></head><body></body></html>")
    updateHeadElements(newDoc)
    expect(document.title).toBe("New")
  })

  it("leaves the title unchanged when the new doc has no title", () => {
    document.title = "Keep"
    const newDoc = parseDoc("<html><head></head><body></body></html>")
    updateHeadElements(newDoc)
    expect(document.title).toBe("Keep")
  })

  it("updates content of existing meta tags matched by name", () => {
    document.head.innerHTML = '<meta name="description" content="old">'
    const newDoc = parseDoc(
      '<html><head><meta name="description" content="new"></head><body></body></html>',
    )
    updateHeadElements(newDoc)
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "new",
    )
  })

  it("creates meta tags that don't exist yet", () => {
    document.head.innerHTML = ""
    const newDoc = parseDoc(
      '<html><head><meta property="og:title" content="hi"></head><body></body></html>',
    )
    updateHeadElements(newDoc)
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      "hi",
    )
  })

  it("creates a named meta tag when it doesn't exist yet", () => {
    document.head.innerHTML = ""
    const newDoc = parseDoc(
      '<html><head><meta name="theme-color" content="#000"></head><body></body></html>',
    )
    updateHeadElements(newDoc)
    const created = document.head.querySelector('meta[name="theme-color"]')
    expect(created?.getAttribute("content")).toBe("#000")
    expect(created?.getAttribute("name")).toBe("theme-color")
  })

  it("creates meta tags with http-equiv when not present", () => {
    document.head.innerHTML = ""
    const newDoc = parseDoc(
      '<html><head><meta http-equiv="content-language" content="en"></head><body></body></html>',
    )
    updateHeadElements(newDoc)
    const meta = document.head.querySelector('meta[http-equiv="content-language"]')
    expect(meta?.getAttribute("content")).toBe("en")
  })

  it("preserves meta tags flagged with spa-preserve", () => {
    document.head.innerHTML =
      '<meta name="keep" content="1" spa-preserve>' +
      '<meta name="also-keep" content="2" spa-preserve>'
    const newDoc = parseDoc("<html><head></head><body></body></html>")
    updateHeadElements(newDoc)
    expect(document.head.querySelector('meta[name="keep"]')).not.toBeNull()
    expect(document.head.querySelector('meta[name="also-keep"]')).not.toBeNull()
  })

  it("removes meta tags that are no longer in the new head", () => {
    document.head.innerHTML =
      '<meta name="description" content="old">' +
      '<meta property="og:title" content="t">' +
      '<meta http-equiv="content-security-policy" content="default-src *">'
    const newDoc = parseDoc(
      '<html><head><meta name="description" content="new"></head><body></body></html>',
    )
    updateHeadElements(newDoc)
    expect(document.head.querySelector('meta[name="description"]')).not.toBeNull()
    expect(document.head.querySelector('meta[property="og:title"]')).toBeNull()
    expect(document.head.querySelector('meta[http-equiv="content-security-policy"]')).toBeNull()
  })

  it("skips meta tags without identifying attributes when removing", () => {
    document.head.innerHTML = '<meta content="nada">'
    const newDoc = parseDoc("<html><head></head><body></body></html>")
    expect(() => updateHeadElements(newDoc)).not.toThrow()
    // The identifierless meta tag should be left in place (skipped)
    expect(document.head.querySelector("meta")?.getAttribute("content")).toBe("nada")
  })

  it("defaults missing content attribute to empty string when updating", () => {
    document.head.innerHTML = '<meta name="keywords" content="old">'
    const newDoc = parseDoc('<html><head><meta name="keywords"></head><body></body></html>')
    updateHeadElements(newDoc)
    expect(document.head.querySelector('meta[name="keywords"]')?.getAttribute("content")).toBe("")
  })

  it("creates a new http-equiv meta tag (no name/property) when not present", () => {
    document.head.innerHTML = ""
    const newDoc = parseDoc(
      '<html><head><meta http-equiv="x-ua-compatible" content="IE=edge"></head><body></body></html>',
    )
    updateHeadElements(newDoc)
    const created = document.head.querySelector('meta[http-equiv="x-ua-compatible"]')
    expect(created?.getAttribute("content")).toBe("IE=edge")
    expect(created?.getAttribute("name")).toBeNull()
    expect(created?.getAttribute("property")).toBeNull()
  })

  it("prefers non-preserve matches when updating an existing meta tag", () => {
    document.head.innerHTML =
      '<meta name="description" content="preserved" spa-preserve>' +
      '<meta name="description" content="old">'
    const newDoc = parseDoc(
      '<html><head><meta name="description" content="new"></head><body></body></html>',
    )
    updateHeadElements(newDoc)
    const metas = document.head.querySelectorAll('meta[name="description"]')
    const contents = Array.from(metas).map((m) => m.getAttribute("content"))
    expect(contents).toContain("preserved")
    expect(contents).toContain("new")
    expect(contents).not.toContain("old")
  })
})
