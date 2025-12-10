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

  it("should handle click on popover", () => {
    const mockHref = "http://example.com/"
    linkElement.href = mockHref
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    })

    popoverElement.dispatchEvent(new MouseEvent("click"))
    expect(window.location.href).toBe(mockHref)
  })

  it("should handle click on link within popover", () => {
    const linkElementHref = "http://main-link.com/"
    linkElement.href = linkElementHref

    // Create a link element inside the popover
    const clickedLinkHref = "http://clicked-link.com/"
    const clickedLink = document.createElement("a")
    clickedLink.href = clickedLinkHref
    popoverElement.appendChild(clickedLink)

    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    })

    // Create a click event on the clicked link
    const clickEvent = new MouseEvent("click", { bubbles: true })
    Object.defineProperty(clickEvent, "target", { value: clickedLink })

    popoverElement.dispatchEvent(clickEvent)
    expect(window.location.href).toBe(clickedLinkHref)
  })
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
