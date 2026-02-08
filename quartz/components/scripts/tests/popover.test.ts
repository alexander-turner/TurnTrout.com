/**
 * @jest-environment jsdom
 */

import "whatwg-fetch" // This will provide the Response global
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals"

import {
  createPopover,
  setPopoverPosition,
  type PopoverOptions,
  attachPopoverEventListeners,
  escapeLeadingIdNumber,
  computeLeft,
  computeTop,
  fetchWithMetaRedirect,
  footnoteForwardRefRegex,
} from "../popover_helpers"

jest.useFakeTimers()

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
  ;(window.fetch as jest.MockedFunction<typeof fetch>) = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString()

    if (url.includes("example.com")) {
      return Promise.resolve({
        ok: true,
        status: 200, // Add the status property
        headers: {
          get: (header: string) => {
            if (header === "Content-Type") return "text/html"
            return null
          },
        },
        text: () =>
          Promise.resolve(
            '<div class="previewable" id="not-a-header"><h1 id="test">Test HTML Content</h1></div>',
          ),
      } as unknown as Response)
    }

    return Promise.reject(new Error("Network error"))
  })

  // Mock window dimensions
  Object.defineProperty(window, "innerWidth", { value: 1700, configurable: true })
  Object.defineProperty(window, "innerHeight", { value: 768, configurable: true })
})

describe("createPopover", () => {
  let options: PopoverOptions

  beforeEach(() => {
    options = {
      parentElement: document.createElement("div"),
      targetUrl: new URL("http://example.com"),
      linkElement: document.createElement("a") as unknown as HTMLLinkElement,
    }
  })

  it("should create a popover element", async () => {
    const popover = await createPopover(options)
    expect(popover).toBeInstanceOf(HTMLElement)
    expect(popover?.classList.contains("popover")).toBe(true)
    expect(popover?.classList.contains("footnote-popover")).toBe(false)
    expect(popover?.querySelector(".popover-close")).toBeNull()
  })

  it("should handle HTML content", async () => {
    const popover = await createPopover(options)
    expect(popover?.querySelector(".popover-inner")).not.toBeNull()
    expect(popover?.querySelector("h1#test-popover")).not.toBeNull()
  })

  it("should handle error cases", async () => {
    options.targetUrl = new URL("http://nonexistent.com")
    await expect(createPopover(options)).rejects.toThrow("Network error")
  })

  it("should handle HTTP error responses", async () => {
    ;(window.fetch as jest.MockedFunction<typeof fetch>) = jest.fn(() => {
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers({ "Content-Type": "text/html" }),
      } as unknown as Response)
    })

    await expect(createPopover(options)).rejects.toThrow("HTTP error! status: 404")
  })

  it('should append "-popover" to only header IDs in the popover content', async () => {
    const popover = await createPopover(options)
    expect(popover?.querySelector("h1#test-popover")).not.toBeNull()
    expect(popover?.querySelector("div#not-a-header-popover")).toBeNull()
  })

  it("should throw an error for footnote back arrow links", async () => {
    options.linkElement.setAttribute("href", "#user-content-fnref-1")
    await expect(createPopover(options)).rejects.toThrow(
      "Footnote back arrow links are not supported for popovers",
    )
  })

  it("should show only footnote content for footnote forward links", async () => {
    const footnoteHtml = `
      <div class="previewable" id="article-title"><h1>Full Article Title</h1></div>
      <section class="footnotes">
        <ol>
          <li id="user-content-fn-1">This is the footnote content.<a href="#user-content-fnref-1" data-footnote-backref>⤴</a></li>
          <li id="user-content-fn-2">This is another footnote.</li>
        </ol>
      </section>
    `
    ;(window.fetch as jest.MockedFunction<typeof fetch>) = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: (header: string) => (header === "Content-Type" ? "text/html" : null),
        },
        text: () => Promise.resolve(footnoteHtml),
      } as unknown as Response),
    )

    options.linkElement.setAttribute("href", "#user-content-fn-1")
    const popover = await createPopover(options)
    const popoverInner = popover.querySelector(".popover-inner")

    expect(popover.classList.contains("footnote-popover")).toBe(true)
    // Should contain a close button
    const closeBtn = popoverInner?.querySelector(".popover-close")
    expect(closeBtn).not.toBeNull()
    expect(closeBtn?.getAttribute("aria-label")).toBe("Close footnote")
    // Should NOT contain the li wrapper (content is unwrapped)
    expect(popoverInner?.querySelector("li#user-content-fn-1-popover")).toBeNull()
    // Should NOT contain the back arrow link
    expect(popoverInner?.querySelector("[data-footnote-backref]")).toBeNull()
    // Should contain the footnote text content
    expect(popoverInner?.textContent).toContain("This is the footnote content.")
    // Should NOT contain the full article title
    expect(popoverInner?.querySelector("#article-title")).toBeNull()
    expect(popoverInner?.querySelector("#article-title-popover")).toBeNull()
  })

  it("should handle named (non-numeric) footnote IDs", async () => {
    const footnoteHtml = `
      <div class="previewable"><h1>Article</h1></div>
      <section class="footnotes">
        <ol>
          <li id="user-content-fn-my-named-note">Named footnote content here.</li>
        </ol>
      </section>
    `
    ;(window.fetch as jest.MockedFunction<typeof fetch>) = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: (header: string) => (header === "Content-Type" ? "text/html" : null),
        },
        text: () => Promise.resolve(footnoteHtml),
      } as unknown as Response),
    )

    options.linkElement.setAttribute("href", "#user-content-fn-my-named-note")
    const popover = await createPopover(options)
    const popoverInner = popover.querySelector(".popover-inner")

    // Should NOT contain the li wrapper (content is unwrapped)
    expect(popoverInner?.querySelector("li#user-content-fn-my-named-note-popover")).toBeNull()
    // Should contain the footnote text content
    expect(popoverInner?.textContent).toContain("Named footnote content here.")
  })

  it("should throw error when footnote element is not found", async () => {
    const footnoteHtml = `
      <div class="previewable"><h1>Article</h1></div>
      <section class="footnotes">
        <ol>
          <li id="user-content-fn-1">Footnote 1</li>
        </ol>
      </section>
    `
    ;(window.fetch as jest.MockedFunction<typeof fetch>) = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: (header: string) => (header === "Content-Type" ? "text/html" : null),
        },
        text: () => Promise.resolve(footnoteHtml),
      } as unknown as Response),
    )

    options.linkElement.setAttribute("href", "#user-content-fn-nonexistent")
    await expect(createPopover(options)).rejects.toThrow(
      "Footnote element not found: user-content-fn-nonexistent",
    )
  })

  it("should render footnote popover with less content than full article popover", async () => {
    const footnoteText = "Short footnote."
    const htmlWithLongArticleAndShortFootnote = `
      <div class="previewable">
        <h1>Full Article Title</h1>
        <p>This is a very long article with lots of content.</p>
        <p>Paragraph 2 with more content to make it taller.</p>
        <p>Paragraph 3 with even more content.</p>
        <p>Paragraph 4 continues the article.</p>
        <p>Paragraph 5 adds more height.</p>
        <p>Paragraph 6 keeps going.</p>
        <p>Paragraph 7 is still here.</p>
        <p>Paragraph 8 almost done.</p>
        <p>Paragraph 9 nearly there.</p>
        <p>Paragraph 10 final paragraph.</p>
      </div>
      <section class="footnotes">
        <ol>
          <li id="user-content-fn-1">${footnoteText}</li>
        </ol>
      </section>
    `
    ;(window.fetch as jest.MockedFunction<typeof fetch>) = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: (header: string) => (header === "Content-Type" ? "text/html" : null),
        },
        text: () => Promise.resolve(htmlWithLongArticleAndShortFootnote),
      } as unknown as Response),
    )

    options.linkElement.setAttribute("href", "#user-content-fn-1")
    const footnotePopover = await createPopover(options)
    const footnoteInner = footnotePopover.querySelector(".popover-inner")
    const footnoteContentLength = footnoteInner?.innerHTML.length ?? 0

    // Create full article popover (regular link, no footnote hash)
    const fullArticleOptions = {
      ...options,
      linkElement: document.createElement("a") as unknown as HTMLLinkElement,
    }
    fullArticleOptions.linkElement.setAttribute("href", "http://example.com")
    const fullArticlePopover = await createPopover(fullArticleOptions)
    const fullArticleInner = fullArticlePopover.querySelector(".popover-inner")
    const fullArticleContentLength = fullArticleInner?.innerHTML.length ?? 0

    // Footnote popover should have significantly less content than full article
    // The full article has ~500+ chars, the footnote has ~50 chars
    expect(fullArticleContentLength - footnoteContentLength).toBeGreaterThanOrEqual(10)
    // Also verify footnote popover does not contain article paragraphs or li wrapper
    expect(footnoteInner?.querySelectorAll("p").length).toBe(0)
    expect(footnoteInner?.querySelectorAll("li").length).toBe(0)
    // Should contain the footnote text content
    expect(footnoteInner?.textContent).toContain(footnoteText)
  })
})

describe("footnoteForwardRefRegex", () => {
  it("should match numeric footnote IDs", () => {
    expect("#user-content-fn-1".match(footnoteForwardRefRegex)?.[1]).toBe("1")
    expect("#user-content-fn-123".match(footnoteForwardRefRegex)?.[1]).toBe("123")
  })

  it("should match alphanumeric footnote IDs", () => {
    expect("#user-content-fn-abc".match(footnoteForwardRefRegex)?.[1]).toBe("abc")
    expect("#user-content-fn-note1".match(footnoteForwardRefRegex)?.[1]).toBe("note1")
  })

  it("should match IDs with hyphens", () => {
    expect("#user-content-fn-my-note".match(footnoteForwardRefRegex)?.[1]).toBe("my-note")
    expect("#user-content-fn-a-b-c".match(footnoteForwardRefRegex)?.[1]).toBe("a-b-c")
  })

  it("should not match footnote back arrows (fnref)", () => {
    expect("#user-content-fnref-1".match(footnoteForwardRefRegex)).toBeNull()
  })

  it("should not match non-footnote hashes", () => {
    expect("#some-other-id".match(footnoteForwardRefRegex)).toBeNull()
    expect("#user-content-something-else".match(footnoteForwardRefRegex)).toBeNull()
  })
})

// initialLeft = linkLeft - popoverWidth - popoverPadding
// maxLeft = window.innerWidth - popoverWidth - popoverPadding
// minLeft = popoverPadding
describe("computeLeft", () => {
  it.each`
    linkLeft | popoverWidth | expected
    ${0}     | ${150}       | ${5}
    ${500}   | ${100}       | ${395}
    ${0}     | ${50}        | ${5}
  `(
    "should compute left position correctly for linkLeft=$linkLeft, popoverWidth=$popoverWidth",
    ({ linkLeft, popoverWidth, expected }) => {
      const linkRect = { left: linkLeft } as DOMRect
      expect(computeLeft(linkRect, popoverWidth)).toBe(expected)
    },
  )
})

describe("computeTop", () => {
  const originalScrollY = window.scrollY

  beforeEach(() => {
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(window, "scrollY", { value: originalScrollY, configurable: true })
  })

  // initialTop = 0.5 * (linkTop + linkBottom) - 0.5 * popoverHeight + scrollY
  // minTop = scrollY + popoverPadding
  // maxTop = scrollY + window.innerHeight - popoverHeight - popoverPadding
  // top = max(minTop, Math.min(initialTop, maxTop))
  it.each`
    linkTop  | linkBottom | popoverHeight | scrollY | expected
    ${50}    | ${100}     | ${80}         | ${0}    | ${35}
    ${10}    | ${60}      | ${200}        | ${0}    | ${5}
    ${500}   | ${550}     | ${100}        | ${100}  | ${575}
    ${0}     | ${50}      | ${60}         | ${200}  | ${205}
    ${10000} | ${10050}   | ${100}        | ${0}    | ${663}
  `(
    "should compute top position correctly for linkTop=$linkTop, linkBottom=$linkBottom, popoverHeight=$popoverHeight, scrollY=$scrollY",
    ({ linkTop, linkBottom, popoverHeight, scrollY, expected }) => {
      Object.defineProperty(window, "scrollY", { value: scrollY, configurable: true })

      const linkRect = { top: linkTop, bottom: linkBottom } as DOMRect
      expect(computeTop(linkRect, popoverHeight)).toBe(expected)
    },
  )
})

describe("setPopoverPosition", () => {
  let popoverElement: HTMLElement
  let linkElement: HTMLLinkElement
  let centerColumn: HTMLElement
  let rightColumn: HTMLElement

  beforeEach(() => {
    popoverElement = document.createElement("div")
    linkElement = document.createElement("a") as unknown as HTMLLinkElement
    centerColumn = document.createElement("div")
    rightColumn = document.createElement("div")

    centerColumn.className = "center"
    rightColumn.className = "right"

    document.body.appendChild(centerColumn)
    document.body.appendChild(rightColumn)

    // Mock scroll position
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true })
  })

  afterEach(() => {
    document.body.removeChild(centerColumn)
    document.body.removeChild(rightColumn)
  })

  // initialTop = 0.5 * (linkTop + linkBottom) - 0.5 * popoverHeight + scrollY
  // minTop = scrollY + popoverPadding
  // maxTop = scrollY + window.innerHeight - popoverHeight - popoverPadding
  // top = max(minTop, Math.min(initialTop, maxTop))

  // initialLeft = linkLeft - popoverWidth - popoverPadding
  // maxLeft = window.innerWidth - popoverWidth - popoverPadding
  // minLeft = popoverPadding
  // left = max(minLeft, Math.min(initialLeft, maxLeft))
  it.each`
    linkLeft | linkTop | linkBottom | popoverWidth | popoverHeight | expectedLeft | expectedTop
    ${100}   | ${50}   | ${100}     | ${150}       | ${80}         | ${5}         | ${35}
    ${10}    | ${10}   | ${60}      | ${150}       | ${200}        | ${5}         | ${5}
    ${500}   | ${500}  | ${550}     | ${100}       | ${100}        | ${395}       | ${475}
  `(
    "should set position correctly for link at ($linkLeft, $linkTop) with popover size ($popoverWidth, $popoverHeight)",
    ({ linkLeft, linkTop, linkBottom, popoverWidth, popoverHeight, expectedLeft, expectedTop }) => {
      jest.spyOn(linkElement, "getBoundingClientRect").mockReturnValue({
        left: linkLeft,
        top: linkTop,
        bottom: linkBottom,
      } as DOMRect)
      Object.defineProperty(popoverElement, "offsetWidth", { value: popoverWidth })
      Object.defineProperty(popoverElement, "offsetHeight", { value: popoverHeight })

      setPopoverPosition(popoverElement, linkElement)

      expect(popoverElement.style.left).toBe(`${expectedLeft}px`)
      expect(popoverElement.style.top).toBe(`${expectedTop}px`)
    },
  )

  it("should position popover correctly when close to left edge", () => {
    jest.spyOn(linkElement, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      left: 50,
      right: 150,
      top: 80,
      width: 100,
      height: 20,
    } as DOMRect)

    jest.spyOn(centerColumn, "getBoundingClientRect").mockReturnValue({
      left: 0,
    } as DOMRect)

    Object.defineProperty(popoverElement, "offsetWidth", { value: 200 })
    Object.defineProperty(popoverElement, "offsetHeight", { value: 100 })

    setPopoverPosition(popoverElement, linkElement)

    const left = parseInt(popoverElement.style.left)
    const top = parseInt(popoverElement.style.top)

    const targetLeft = computeLeft(linkElement.getBoundingClientRect(), popoverElement.offsetWidth)
    expect(left).toBe(targetLeft)

    const targetTop = computeTop(linkElement.getBoundingClientRect(), popoverElement.offsetHeight)
    expect(top).toBe(targetTop)
  })

  it("should set popover position within bounds when link is near the bottom edge", () => {
    jest.spyOn(linkElement, "getBoundingClientRect").mockReturnValue({
      bottom: 750,
      left: 500,
      right: 600,
      top: 730,
      width: 100,
      height: 20,
    } as DOMRect)

    Object.defineProperty(popoverElement, "offsetWidth", { value: 200 })
    Object.defineProperty(popoverElement, "offsetHeight", { value: 100 })

    setPopoverPosition(popoverElement, linkElement)

    const left = parseInt(popoverElement.style.left)
    const top = parseInt(popoverElement.style.top)

    const targetLeft = computeLeft(linkElement.getBoundingClientRect(), popoverElement.offsetWidth)
    expect(left).toBe(targetLeft)

    const targetTop = computeTop(linkElement.getBoundingClientRect(), popoverElement.offsetHeight)
    expect(top).toBe(targetTop)
  })
})

it("should set popover position within bounds when page is scrolled", () => {
  Object.defineProperty(window, "scrollY", { value: 500 })

  const linkElement = document.createElement("a") as unknown as HTMLLinkElement

  jest.spyOn(linkElement, "getBoundingClientRect").mockReturnValue({
    bottom: 600,
    left: 500,
    right: 600,
    top: 580,
    width: 100,
    height: 20,
  } as DOMRect)

  const popoverElement = document.createElement("div")
  Object.defineProperty(popoverElement, "offsetWidth", { value: 200 })
  Object.defineProperty(popoverElement, "offsetHeight", { value: 100 })

  setPopoverPosition(popoverElement, linkElement)

  const left = parseInt(popoverElement.style.left)
  const top = parseInt(popoverElement.style.top)

  const targetLeft = computeLeft(linkElement.getBoundingClientRect(), popoverElement.offsetWidth)
  expect(left).toBe(targetLeft)

  const targetTop = computeTop(linkElement.getBoundingClientRect(), popoverElement.offsetHeight)
  expect(top).toBe(targetTop)
})

describe("attachPopoverEventListeners", () => {
  let popoverElement: HTMLElement
  let linkElement: HTMLLinkElement
  let cleanup: () => void

  beforeEach(() => {
    popoverElement = document.createElement("div")
    linkElement = document.createElement("a") as unknown as HTMLLinkElement
    cleanup = attachPopoverEventListeners(popoverElement, linkElement, () => {
      // No-op for this test
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("should show popover on link mouseenter", () => {
    linkElement.dispatchEvent(new MouseEvent("mouseenter"))
    expect(popoverElement.classList.contains("popover-visible")).toBe(true)
  })

  it("should remove popover on link mouseleave", () => {
    linkElement.dispatchEvent(new MouseEvent("mouseleave"))
    jest.advanceTimersByTime(300)
    expect(popoverElement.classList.contains("visible")).toBe(false)
  })

  it("should handle popover mouseenter and mouseleave", () => {
    popoverElement.dispatchEvent(new MouseEvent("mouseenter"))
    popoverElement.dispatchEvent(new MouseEvent("mouseleave"))
    jest.advanceTimersByTime(300)
    expect(popoverElement.classList.contains("visible")).toBe(false)
  })

  it.each`
    isFootnote | clickInnerLink | expectedHref
    ${false}   | ${false}       | ${"http://example.com/"}
    ${false}   | ${true}        | ${"http://clicked-link.com/"}
    ${true}    | ${false}       | ${""}
    ${true}    | ${true}        | ${"http://clicked-link.com/"}
  `(
    "click navigates to $expectedHref (isFootnote=$isFootnote, clickInnerLink=$clickInnerLink)",
    ({ isFootnote, clickInnerLink, expectedHref }) => {
      linkElement.href = "http://example.com/"
      if (isFootnote) popoverElement.classList.add("footnote-popover")

      Object.defineProperty(window, "location", { value: { href: "" }, writable: true })

      let clickEvent: MouseEvent
      if (clickInnerLink) {
        const innerLink = document.createElement("a")
        innerLink.href = "http://clicked-link.com/"
        popoverElement.appendChild(innerLink)
        clickEvent = new MouseEvent("click", { bubbles: true })
        Object.defineProperty(clickEvent, "target", { value: innerLink })
      } else {
        clickEvent = new MouseEvent("click")
      }

      popoverElement.dispatchEvent(clickEvent)
      expect(window.location.href).toBe(expectedHref)
    },
  )
})

describe("escapeLeadingIdNumber", () => {
  it("should escape leading ID numbers", () => {
    expect(escapeLeadingIdNumber("#1 Test")).toBe("#_1 Test")
    expect(escapeLeadingIdNumber("No number")).toBe("No number")
    expect(escapeLeadingIdNumber("#123 Multiple digits")).toBe("#_123 Multiple digits")
  })
})

describe("fetchWithMetaRedirect", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should handle a simple request with no redirects", async () => {
    ;(window.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/plain" }),
      text: () => Promise.resolve("content"),
    }))

    const response = await fetchWithMetaRedirect(new URL("http://example.com"), window.fetch)

    expect(window.fetch).toHaveBeenCalledTimes(1)
    expect(response.ok).toBe(true)
  })

  it("should follow meta refresh redirects", async () => {
    ;(window.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      text: () =>
        Promise.resolve('<meta http-equiv="refresh" content="0;url=http://example.com/page2">'),
    }))

    await fetchWithMetaRedirect(new URL("http://example.com"), window.fetch)

    expect(window.fetch).toHaveBeenCalledTimes(2)
    expect(window.fetch).toHaveBeenNthCalledWith(1, "http://example.com/")
    expect(window.fetch).toHaveBeenNthCalledWith(2, "http://example.com/page2")
  })

  it("should follow relative meta refresh redirects", async () => {
    ;(window.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      text: () => Promise.resolve('<meta http-equiv="refresh" content="0;url=page2">'),
    }))

    await fetchWithMetaRedirect(new URL("http://example.com/page1"), window.fetch)

    expect(window.fetch).toHaveBeenCalledTimes(2)
    expect(window.fetch).toHaveBeenNthCalledWith(1, "http://example.com/page1")
    expect(window.fetch).toHaveBeenNthCalledWith(2, "http://example.com/page2")
  })

  it("should handle non-HTML responses", async () => {
    ;(window.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "image/jpeg" }),
      blob: () => Promise.resolve(new Blob()),
    }))

    const response = await fetchWithMetaRedirect(
      new URL("http://example.com/image.jpg"),
      window.fetch,
    )

    expect(window.fetch).toHaveBeenCalledTimes(1)
    expect(response.headers.get("Content-Type")).toBe("image/jpeg")
  })

  it("should handle failed responses", async () => {
    ;(window.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers({ "Content-Type": "text/html" }),
    }))

    const response = await fetchWithMetaRedirect(new URL("http://example.com"), window.fetch)

    expect(window.fetch).toHaveBeenCalledTimes(1)
    expect(response.ok).toBe(false)
    expect(response.status).toBe(404)
  })

  it("should handle malformed meta refresh tags", async () => {
    ;(window.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      text: () => Promise.resolve('<meta http-equiv="refresh" content="0">'),
    }))

    const response = await fetchWithMetaRedirect(new URL("http://example.com"), window.fetch)

    expect(window.fetch).toHaveBeenCalledTimes(1)
    expect(response.ok).toBe(true)
  })

  it("should preserve response properties after redirect", async () => {
    ;(window.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      text: () =>
        Promise.resolve('<meta http-equiv="refresh" content="0;url=http://example.com/final">'),
    }))

    await fetchWithMetaRedirect(new URL("http://example.com"), window.fetch)

    expect(window.fetch).toHaveBeenCalledTimes(2)
    expect(window.fetch).toHaveBeenNthCalledWith(1, "http://example.com/")
    expect(window.fetch).toHaveBeenNthCalledWith(2, "http://example.com/final")
  })

  it("should throw error when maximum redirects exceeded", async () => {
    ;(window.fetch as jest.Mock).mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
      text: () =>
        Promise.resolve('<meta http-equiv="refresh" content="0;url=http://example.com/redirect">'),
    }))

    await expect(
      fetchWithMetaRedirect(new URL("http://example.com"), window.fetch, 2),
    ).rejects.toThrow("Maximum number of redirects (2) exceeded")

    expect(window.fetch).toHaveBeenCalledTimes(2)
  })

  it("should use default fetch when no customFetch is provided", async () => {
    ;(window.fetch as jest.Mock).mockImplementationOnce(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/plain" }),
      text: () => Promise.resolve("content"),
    }))

    const response = await fetchWithMetaRedirect(new URL("http://example.com"))

    expect(window.fetch).toHaveBeenCalledTimes(1)
    expect(response.ok).toBe(true)
  })
})
