/**
 * @jest-environment jest-fixed-jsdom
 */

import { describe, it, beforeEach, afterEach, expect, jest } from "@jest/globals"

import {
  restoreSmallCapsInHtml,
  restoreSmallCapsInSelection,
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

  describe("restoreSmallCapsInHtml", () => {
    it.each([
      [
        "uses data-original-text when available",
        '<abbr class="small-caps" data-original-text="NASA">nasa</abbr>',
        '<abbr class="small-caps" data-original-text="NASA">NASA</abbr>',
      ],
      [
        "uses data-original-text for mixed case",
        '<abbr class="small-caps" data-original-text="50mV">50mv</abbr>',
        '<abbr class="small-caps" data-original-text="50mV">50mV</abbr>',
      ],
      [
        "falls back to uppercasing without data-original-text",
        '<abbr class="small-caps">nasa</abbr>',
        '<abbr class="small-caps">NASA</abbr>',
      ],
      [
        "preserves non-small-caps",
        '<span>hello</span> <abbr class="small-caps" data-original-text="API">api</abbr> world',
        '<span>hello</span> <abbr class="small-caps" data-original-text="API">API</abbr> world',
      ],
      [
        "handles multiple elements with data-original-text",
        '<abbr class="small-caps" data-original-text="HTML">html</abbr> and <abbr class="small-caps" data-original-text="CSS">css</abbr>',
        '<abbr class="small-caps" data-original-text="HTML">HTML</abbr> and <abbr class="small-caps" data-original-text="CSS">CSS</abbr>',
      ],
      ["no small-caps", "<span>hello world</span>", "<span>hello world</span>"],
    ])("%s", (_, input, expected) => {
      expect(restoreSmallCapsInHtml(input)).toBe(expected)
    })
  })

  describe("restoreSmallCapsInSelection", () => {
    it("returns empty string for empty selection", () => {
      getSelection().removeAllRanges()
      expect(restoreSmallCapsInSelection(getSelection())).toBe("")
    })

    it.each([
      [
        "restores original text from data-original-text",
        '<p>Hello <abbr class="small-caps" data-original-text="API">api</abbr> world</p>',
        "Hello API world",
      ],
      [
        "restores mixed-case from data-original-text",
        '<p>Signal: <abbr class="small-caps" data-original-text="50mV">50mv</abbr> measured</p>',
        "Signal: 50mV measured",
      ],
      [
        "falls back to uppercase without data-original-text",
        '<p>Hello <abbr class="small-caps">api</abbr> world</p>',
        "Hello API world",
      ],
      ["preserves non-small-caps text", "<p>Normal text here</p>", "Normal text here"],
    ])("%s", (_, html, expected) => {
      document.body.innerHTML = html
      selectContents("body")
      expect(restoreSmallCapsInSelection(getSelection())).toBe(expected)
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
        "restores original text with data-original-text",
        '<p>Hello <abbr class="small-caps" data-original-text="API">api</abbr> world</p>',
        "Hello API world",
      ],
      [
        "restores mixed-case with data-original-text",
        '<p>Hello <abbr class="small-caps" data-original-text="50mV">50mv</abbr> world</p>',
        "Hello 50mV world",
      ],
      [
        "falls back to uppercase without data-original-text",
        '<p>Hello <abbr class="small-caps">api</abbr> world</p>',
        "Hello API world",
      ],
      [
        "selection starts inside small-caps",
        '<p><abbr class="small-caps" data-original-text="NASA">nasa</abbr> rocks</p>',
        "NASA rocks",
      ],
    ])("%s", (_, html, expectedText) => {
      document.body.innerHTML = html
      selectContents("p")
      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe(expectedText)
    })

    it("uses data-original-text when entirely in small-caps", () => {
      document.body.innerHTML =
        '<p><abbr class="small-caps" data-original-text="NASA">nasa</abbr></p>'
      selectContents("abbr")
      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe("NASA")
    })

    it("uses data-original-text for mixed-case when entirely in small-caps", () => {
      document.body.innerHTML =
        '<p><abbr class="small-caps" data-original-text="50mV">50mv</abbr></p>'
      selectContents("abbr")
      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe("50mV")
    })

    it("handles partial selection without data-original-text (falls back to uppercasing)", () => {
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

    it("restores partial selection using data-original-text", () => {
      document.body.innerHTML =
        '<p><abbr class="small-caps" data-original-text="50mV">50mv</abbr></p>'
      const abbr = querySelector("abbr")
      const textNode = abbr.firstChild
      if (!textNode) throw new Error("No text node")
      const range = document.createRange()
      range.setStart(textNode, 2) // Select "mv" (chars 2-3)
      range.setEnd(textNode, 4)
      getSelection().removeAllRanges()
      getSelection().addRange(range)

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(true)
      // Should restore "mV" from original, not blind-uppercase to "MV"
      expect(event.clipboardData.data["text/plain"]).toBe("mV")
    })

    it("does nothing when ancestor has small-caps but selection doesn't include them", () => {
      document.body.innerHTML =
        '<p>Normal text <abbr class="small-caps" data-original-text="API">api</abbr> more text</p>'
      const paragraph = querySelector("p")
      const textNode = paragraph.firstChild
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
      document.body.innerHTML =
        '<p>Hello <abbr class="small-caps" data-original-text="API">api</abbr> world</p>'
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
