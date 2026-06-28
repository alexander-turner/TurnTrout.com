/**
 * @jest-environment jest-fixed-jsdom
 * @jest-environment-options {"url": "http://localhost:8080"}
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  scrollPositionKeyPrefix,
  scrollPositionMinThreshold,
  scrollPositionTimestampKeyPrefix,
} from "../constants"
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

describe("isLocalUrl", () => {
  it.each([
    ["http://localhost:8080/path", true, "exact origin match"],
    ["http://localhost:8080/another/path#hash", true, "with hash"],
    ["//localhost:8080/path", true, "protocol-relative with matching host"],
    ["https://example.com", false, "different domain"],
    ["http://otherdomain.com/path", false, "different domain with path"],
    ["ftp://server.com", false, "different protocol"],
    ["not a url", true, "relative path resolves to same origin"],
    ["http://", false, "incomplete URL"],
  ])("returns %s for %s (%s)", (url, expected) => {
    expect(isLocalUrl(url as string)).toBe(expected)
  })
})

describe("isElement", () => {
  it.each([
    ["div element", document.createElement("div"), true],
    ["text node", document.createTextNode("hi"), false],
    ["null", null, false],
    ["window (non-DOM EventTarget)", window, false],
  ])("returns %s for %s", (_label, target, expected) => {
    expect(isElement(target as EventTarget | null)).toBe(expected)
  })
})

describe("getNavigationOpts", () => {
  const makeClick = (target: EventTarget | null): Event => ({ target }) as unknown as Event

  const anchor = (attrs: Record<string, string> = {}, href?: string): HTMLAnchorElement => {
    const anchorEl = document.createElement("a")
    if (href !== undefined) anchorEl.href = href
    for (const [k, v] of Object.entries(attrs)) anchorEl.setAttribute(k, v)
    document.body.appendChild(anchorEl)
    return anchorEl
  }

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it.each<[string, () => EventTarget | null]>([
    ["null target", () => null],
    ["non-Element node", () => document.createTextNode("plain text")],
    ["no ancestor anchor", () => document.body.appendChild(document.createElement("span"))],
    [
      'direct target="_blank" anchor',
      () => anchor({ target: "_blank" }, "http://localhost:8080/foo"),
    ],
    [
      'nested click inside target="_blank" anchor',
      () => {
        const anchorEl = anchor({ target: "_blank" }, "http://localhost:8080/foo")
        return anchorEl.appendChild(document.createElement("span"))
      },
    ],
    ["external link", () => anchor({}, "https://example.com/bar")],
    [
      "data-router-ignore anchor",
      () => anchor({ "data-router-ignore": "" }, "http://localhost:8080/ignore"),
    ],
    ["anchor with empty href", () => anchor()],
  ])("returns undefined for %s", (_label, makeTarget) => {
    expect(getNavigationOpts(makeClick(makeTarget()))).toBeUndefined()
  })

  it("returns URL when anchor is a local link", () => {
    const anchorEl = anchor({}, "http://localhost:8080/page")
    expect(getNavigationOpts(makeClick(anchorEl))).toEqual({
      url: expect.objectContaining({ href: "http://localhost:8080/page" }),
      scroll: undefined,
    })
  })

  it("resolves closest-ancestor anchor when a nested element is clicked", () => {
    const anchorEl = anchor({}, "http://localhost:8080/nested")
    const inner = anchorEl.appendChild(document.createElement("span"))
    expect(getNavigationOpts(makeClick(inner))?.url.href).toBe("http://localhost:8080/nested")
  })

  it("sets scroll=false when anchor has data-router-no-scroll", () => {
    const anchorEl = anchor({ "data-router-no-scroll": "" }, "http://localhost:8080/no-scroll")
    expect(getNavigationOpts(makeClick(anchorEl))?.scroll).toBe(false)
  })
})

describe("saveScrollToLocalStorage", () => {
  const key = `${scrollPositionKeyPrefix}/page`
  const timestampKey = `${scrollPositionTimestampKeyPrefix}/page`

  beforeEach(() => {
    localStorage.clear()
  })

  it.each<[string, number, string | null]>([
    [
      "persists above threshold",
      scrollPositionMinThreshold + 100,
      `${scrollPositionMinThreshold + 100}`,
    ],
    ["no-op when below threshold and unset", 0, null],
    ["removes entry when below threshold", scrollPositionMinThreshold - 1, null],
  ])("%s", (_label, scrollY, expected) => {
    if (_label.includes("removes")) localStorage.setItem(key, "500")
    saveScrollToLocalStorage("/page", scrollY)
    expect(localStorage.getItem(key)).toBe(expected)
  })

  it("records a save timestamp when persisting above threshold", () => {
    const before = Date.now()
    saveScrollToLocalStorage("/page", scrollPositionMinThreshold + 100)
    const savedAt = Number(localStorage.getItem(timestampKey))
    expect(savedAt).toBeGreaterThanOrEqual(before)
    expect(savedAt).toBeLessThanOrEqual(Date.now())
  })

  it("clears the timestamp when scrolling back below threshold", () => {
    saveScrollToLocalStorage("/page", scrollPositionMinThreshold + 100)
    expect(localStorage.getItem(timestampKey)).not.toBeNull()

    saveScrollToLocalStorage("/page", scrollPositionMinThreshold - 1)
    expect(localStorage.getItem(timestampKey)).toBeNull()
  })
})

describe("scroll helpers", () => {
  // `window.scrollTo` is overloaded (`(options)` and `(x, y)`); the app only
  // uses the options form, so pin the spy to that signature — otherwise
  // `toHaveBeenCalledWith` resolves to the two-arg overload and rejects the
  // single-object assertions below.
  let scrollSpy: jest.SpiedFunction<(options?: ScrollToOptions) => void>

  beforeEach(() => {
    document.body.innerHTML = ""
    scrollSpy = jest
      .spyOn(window, "scrollTo")
      .mockImplementation(jest.fn()) as unknown as typeof scrollSpy
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true })
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true })
  })

  afterEach(() => {
    scrollSpy.mockRestore()
  })

  describe("scrollToMatch", () => {
    it("returns false when there is no <article> in the document", () => {
      expect(scrollToMatch("anything")).toBe(false)
      expect(scrollSpy).not.toHaveBeenCalled()
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
      const newTitle = document.getElementById("article-title") as HTMLElement
      expect(newTitle.querySelector(".search-match")?.textContent).toBe("Unique")
    })

    it("scrolls the window when a body match is found", () => {
      const article = document.createElement("article")
      article.innerHTML = "<p>Hello world hello</p>"
      document.body.appendChild(article)

      expect(scrollToMatch("world")).toBe(true)
      // getBoundingClientRect().top == 0, scrollY == 0, innerHeight*0.25 == 200
      expect(scrollSpy).toHaveBeenCalledWith({ top: -200, behavior: "instant" })
    })
  })

  describe("scrollToUrlTarget", () => {
    it("does nothing for empty string or unknown id", () => {
      scrollToUrlTarget("")
      scrollToUrlTarget("#missing")
      expect(scrollSpy).not.toHaveBeenCalled()
    })

    it.each<[string, string, string]>([
      ["plain id", "section-one", "#section-one"],
      ["URL-encoded id", "my section", "#my%20section"],
    ])("scrolls to %s", (_label, id, hash) => {
      const target = document.createElement("div")
      target.id = id
      document.body.appendChild(target)
      jest.spyOn(target, "getBoundingClientRect").mockReturnValue({ top: 420 } as DOMRect)

      scrollToUrlTarget(hash)
      expect(scrollSpy).toHaveBeenCalledWith({ top: 420, behavior: "instant" })
    })
  })

  describe("handleNavigationScroll", () => {
    it("does not scroll when opts.scroll is false", () => {
      handleNavigationScroll(new URL("http://localhost:8080/foo#bar"), { scroll: false })
      expect(scrollSpy).not.toHaveBeenCalled()
    })

    it("scrolls to the hash target when a hash is present", () => {
      const anchor = document.createElement("div")
      anchor.id = "bar"
      document.body.appendChild(anchor)
      jest.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ top: 300 } as DOMRect)

      handleNavigationScroll(new URL("http://localhost:8080/foo#bar"))
      expect(scrollSpy).toHaveBeenCalledWith({ top: 300, behavior: "instant" })
    })

    it("scrolls to the top when no hash is present", () => {
      handleNavigationScroll(new URL("http://localhost:8080/foo"))
      expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: "instant" })
    })

    it("highlights the searchTerm opt without touching the URL", () => {
      const article = document.createElement("article")
      article.innerHTML = "<p>Alpha bravo charlie</p>"
      document.body.appendChild(article)
      history.replaceState(null, "", "/foo")

      handleNavigationScroll(new URL("http://localhost:8080/foo"), { searchTerm: "bravo" })

      expect(scrollSpy).toHaveBeenCalledTimes(1)
      expect(window.location.hash).toBe("")
      expect(document.querySelector("article .search-match")?.textContent).toBe("bravo")
    })

    it("falls back to hash scrolling when searchTerm yields no match", () => {
      const article = document.createElement("article")
      article.innerHTML = "<p>Nothing relevant here.</p>"
      document.body.appendChild(article)
      const anchor = document.createElement("div")
      anchor.id = "bar"
      document.body.appendChild(anchor)
      jest.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ top: 300 } as DOMRect)

      handleNavigationScroll(new URL("http://localhost:8080/foo#bar"), { searchTerm: "missing" })

      expect(scrollSpy).toHaveBeenCalledWith({ top: 300, behavior: "instant" })
    })
  })
})

describe("extractMetaRefreshUrl", () => {
  it.each<[string, string | null, string]>([
    ['<meta http-equiv="refresh" content="0;url=/next">', "/next", "simple absolute path"],
    [
      '<meta http-equiv="refresh" content="5;url=https://other.com/page">',
      "https://other.com/page",
      "absolute URL with delay",
    ],
    [
      "<meta http-equiv=refresh content='0;url=relative/page'>",
      "relative/page",
      "unquoted http-equiv + single quotes",
    ],
    ['<META HTTP-EQUIV="REFRESH" CONTENT="0;URL=/upper">', "/upper", "uppercase attributes"],
    ["<p>no meta here</p>", null, "no meta tag"],
    ['<meta name="description" content="0;url=/no">', null, "meta without http-equiv=refresh"],
    ['<meta http-equiv="refresh" content="0">', null, "meta refresh without url="],
  ])("parses %s -> %s (%s)", (html, expected) => {
    expect(extractMetaRefreshUrl(html)).toBe(expected)
  })
})

describe("updateHeadElements", () => {
  const parseDoc = (html: string): Document => new DOMParser().parseFromString(html, "text/html")
  let originalHead: string

  beforeEach(() => {
    originalHead = document.head.innerHTML
  })

  afterEach(() => {
    document.head.innerHTML = originalHead
    document.title = ""
  })

  describe("title", () => {
    it.each<[string, string, string, string]>([
      ["updates when new doc has a title", "Old", "<title>New</title>", "New"],
      ["leaves unchanged when new doc has no title", "Keep", "", "Keep"],
    ])("%s", (_label, initialTitle, headHtml, expected) => {
      document.title = initialTitle
      updateHeadElements(parseDoc(`<html><head>${headHtml}</head><body></body></html>`))
      expect(document.title).toBe(expected)
    })
  })

  describe("creates missing meta tags", () => {
    it.each<[string, string, string]>([
      ["meta[name]", '<meta name="theme-color" content="#000">', 'meta[name="theme-color"]'],
      ["meta[property]", '<meta property="og:title" content="hi">', 'meta[property="og:title"]'],
      [
        "meta[http-equiv] (no name/property)",
        '<meta http-equiv="x-ua-compatible" content="IE=edge">',
        'meta[http-equiv="x-ua-compatible"]',
      ],
    ])("creates %s when not present", (_label, metaHtml, selector) => {
      document.head.innerHTML = ""
      updateHeadElements(parseDoc(`<html><head>${metaHtml}</head><body></body></html>`))
      const created = document.head.querySelector(selector)
      expect(created).not.toBeNull()
      const expectedContent = metaHtml.match(/content="(?<content>[^"]+)"/)?.groups?.content ?? ""
      expect(created?.getAttribute("content")).toBe(expectedContent)
    })
  })

  it("updates content of existing meta tags matched by name", () => {
    document.head.innerHTML = '<meta name="description" content="old">'
    updateHeadElements(
      parseDoc('<html><head><meta name="description" content="new"></head><body></body></html>'),
    )
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "new",
    )
  })

  it("defaults missing content attribute to empty string when updating", () => {
    document.head.innerHTML = '<meta name="keywords" content="old">'
    updateHeadElements(parseDoc('<html><head><meta name="keywords"></head><body></body></html>'))
    expect(document.head.querySelector('meta[name="keywords"]')?.getAttribute("content")).toBe("")
  })

  it("preserves meta tags flagged with spa-preserve and removes others", () => {
    document.head.innerHTML =
      '<meta name="keep" content="1" spa-preserve>' +
      '<meta property="og:title" content="t">' +
      '<meta http-equiv="content-security-policy" content="default-src *">'
    updateHeadElements(
      parseDoc('<html><head><meta name="description" content="new"></head><body></body></html>'),
    )
    expect(document.head.querySelector('meta[name="keep"]')).not.toBeNull()
    expect(document.head.querySelector('meta[name="description"]')).not.toBeNull()
    expect(document.head.querySelector('meta[property="og:title"]')).toBeNull()
    expect(document.head.querySelector('meta[http-equiv="content-security-policy"]')).toBeNull()
  })

  it("skips identifierless meta tags instead of throwing", () => {
    document.head.innerHTML = '<meta content="nada">'
    updateHeadElements(parseDoc("<html><head></head><body></body></html>"))
    // Identifierless meta is left in place (skipped by remove-loop).
    expect(document.head.querySelector("meta")?.getAttribute("content")).toBe("nada")
  })

  it("appends identifierless new-doc meta (no name/property/http-equiv) without throwing", () => {
    document.head.innerHTML = ""
    // A meta with only a content attribute triggers the else-branch of all three
    // selector conditions (name / property / http-equiv) and the if (selector) false branch.
    updateHeadElements(parseDoc('<html><head><meta content="orphan"></head><body></body></html>'))
    expect(document.head.querySelector("meta")?.getAttribute("content")).toBe("orphan")
  })

  it("prefers non-preserve matches when updating an existing meta tag", () => {
    document.head.innerHTML =
      '<meta name="description" content="preserved" spa-preserve>' +
      '<meta name="description" content="old">'
    updateHeadElements(
      parseDoc('<html><head><meta name="description" content="new"></head><body></body></html>'),
    )
    const contents = Array.from(document.head.querySelectorAll('meta[name="description"]')).map(
      (m) => m.getAttribute("content"),
    )
    expect(contents).toEqual(expect.arrayContaining(["preserved", "new"]))
    expect(contents).not.toContain("old")
  })
})
