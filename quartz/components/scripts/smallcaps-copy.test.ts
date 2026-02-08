/**
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, afterEach, expect, jest } from "@jest/globals"

import {
  uppercaseSmallCapsInHtml,
  uppercaseSmallCapsInSelection,
  handleSmallCapsCopy,
  initSmallCapsCopy,
} from "./smallcaps-copy"

interface MockClipboardData {
  data: Record<string, string>
  setData(type: string, value: string): void
}

interface MockClipboardEvent extends Event {
  clipboardData: MockClipboardData
}

function createClipboardEvent(type = "copy"): MockClipboardEvent {
  const clipboardData: MockClipboardData = {
    data: {},
    setData(t: string, value: string) {
      this.data[t] = value
    },
  }
  const event = new Event(type, { bubbles: true, cancelable: true }) as MockClipboardEvent
  Object.defineProperty(event, "clipboardData", { value: clipboardData })
  return event
}

function getSelection(): Selection {
  const selection = window.getSelection()
  if (!selection) throw new Error("No selection")
  return selection
}

function querySelector<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`Element not found: ${selector}`)
  return el
}

function selectContents(selector: string): Selection {
  const range = document.createRange()
  range.selectNodeContents(querySelector(selector))
  const selection = getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  return selection
}

describe("smallcaps-copy", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  describe("uppercaseSmallCapsInHtml", () => {
    it.each([
      [
        "single element",
        '<abbr class="small-caps">nasa</abbr>',
        '<abbr class="small-caps">NASA</abbr>',
      ],
      [
        "preserves non-small-caps",
        '<span>hello</span> <abbr class="small-caps">api</abbr> world',
        '<span>hello</span> <abbr class="small-caps">API</abbr> world',
      ],
      [
        "multiple elements",
        '<abbr class="small-caps">html</abbr> and <abbr class="small-caps">css</abbr>',
        '<abbr class="small-caps">HTML</abbr> and <abbr class="small-caps">CSS</abbr>',
      ],
      [
        "nested elements",
        '<abbr class="small-caps"><em>api</em> docs</abbr>',
        '<abbr class="small-caps"><em>API</em> DOCS</abbr>',
      ],
      ["no small-caps", "<span>hello world</span>", "<span>hello world</span>"],
    ])("%s", (_, input, expected) => {
      expect(uppercaseSmallCapsInHtml(input)).toBe(expected)
    })
  })

  describe("uppercaseSmallCapsInSelection", () => {
    it("returns empty string for empty selection", () => {
      getSelection().removeAllRanges()
      expect(uppercaseSmallCapsInSelection(getSelection(), false)).toBe("")
    })

    it.each([
      [
        "uppercases small-caps in selection",
        '<p>Hello <abbr class="small-caps">api</abbr> world</p>',
        false,
        "Hello API world",
      ],
      ["preserves non-small-caps text", "<p>Normal text here</p>", false, "Normal text here"],
      ["uppercases everything when isEntirelyInSmallCaps", "<p>some text</p>", true, "SOME TEXT"],
    ])("%s", (_, html, isEntirelyInSmallCaps, expected) => {
      document.body.innerHTML = html
      selectContents("body")
      expect(uppercaseSmallCapsInSelection(getSelection(), isEntirelyInSmallCaps)).toBe(expected)
    })
  })

  describe("handleSmallCapsCopy", () => {
    it("does nothing when selection is empty", () => {
      getSelection().removeAllRanges()
      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(false)
    })

    it("does nothing when no small-caps in selection", () => {
      document.body.innerHTML = "<p>Normal text</p>"
      selectContents("p")
      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(false)
    })

    it.each([
      [
        "intercepts copy with small-caps",
        '<p>Hello <abbr class="small-caps">api</abbr> world</p>',
        "Hello API world",
      ],
      [
        "selection starts inside small-caps",
        '<p><abbr class="small-caps">nasa</abbr> rocks</p>',
        "NASA rocks",
      ],
    ])("%s", (_, html, expectedText) => {
      document.body.innerHTML = html
      selectContents("p")
      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe(expectedText)
      expect(event.clipboardData.data["text/html"]).toContain(expectedText.match(/[A-Z]{2,}/)?.[0])
    })

    it("handles partial selection within small-caps element", () => {
      document.body.innerHTML = '<p><abbr class="small-caps">nasa program</abbr></p>'
      const abbr = querySelector("abbr")
      const textNode = abbr.firstChild
      if (!textNode) throw new Error("No text node")
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 4) // Select "nasa"
      getSelection().removeAllRanges()
      getSelection().addRange(range)

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe("NASA")
    })

    it("does nothing when ancestor has small-caps but selection doesn't include them", () => {
      document.body.innerHTML = '<p>Normal text <abbr class="small-caps">api</abbr> more text</p>'
      const p = querySelector("p")
      const textNode = p.firstChild
      if (!textNode) throw new Error("No text node")
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 6) // Select "Normal"
      getSelection().removeAllRanges()
      getSelection().addRange(range)

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(false)
    })

    it("handles cut events the same as copy", () => {
      document.body.innerHTML = '<p>Hello <abbr class="small-caps">api</abbr> world</p>'
      selectContents("p")
      const event = createClipboardEvent("cut")
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe("Hello API world")
    })
  })

  describe("initSmallCapsCopy", () => {
    it("registers copy and cut event listeners", () => {
      const spy = jest.spyOn(document, "addEventListener")
      initSmallCapsCopy()
      expect(spy).toHaveBeenCalledWith("copy", handleSmallCapsCopy)
      expect(spy).toHaveBeenCalledWith("cut", handleSmallCapsCopy)
      spy.mockRestore()
    })
  })
})
