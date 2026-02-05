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

describe("smallcaps-copy", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  describe("uppercaseSmallCapsInHtml", () => {
    it("should uppercase text in small-caps elements", () => {
      const html = '<abbr class="small-caps">nasa</abbr>'
      const result = uppercaseSmallCapsInHtml(html)
      expect(result).toBe('<abbr class="small-caps">NASA</abbr>')
    })

    it("should preserve non-small-caps text", () => {
      const html = '<span>hello</span> <abbr class="small-caps">api</abbr> world'
      const result = uppercaseSmallCapsInHtml(html)
      expect(result).toBe('<span>hello</span> <abbr class="small-caps">API</abbr> world')
    })

    it("should handle multiple small-caps elements", () => {
      const html = '<abbr class="small-caps">html</abbr> and <abbr class="small-caps">css</abbr>'
      const result = uppercaseSmallCapsInHtml(html)
      expect(result).toBe(
        '<abbr class="small-caps">HTML</abbr> and <abbr class="small-caps">CSS</abbr>',
      )
    })

    it("should handle nested elements within small-caps", () => {
      const html = '<abbr class="small-caps"><em>api</em> docs</abbr>'
      const result = uppercaseSmallCapsInHtml(html)
      expect(result).toBe('<abbr class="small-caps"><em>API</em> DOCS</abbr>')
    })

    it("should return unchanged html when no small-caps present", () => {
      const html = "<span>hello world</span>"
      const result = uppercaseSmallCapsInHtml(html)
      expect(result).toBe("<span>hello world</span>")
    })
  })

  describe("uppercaseSmallCapsInSelection", () => {
    it("should return empty string for empty selection", () => {
      const selection = window.getSelection()!
      selection.removeAllRanges()
      const result = uppercaseSmallCapsInSelection(selection)
      expect(result).toBe("")
    })

    it("should uppercase small-caps text in selection", () => {
      document.body.innerHTML = '<p>Hello <abbr class="small-caps">api</abbr> world</p>'
      const range = document.createRange()
      range.selectNodeContents(document.body)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const result = uppercaseSmallCapsInSelection(selection)
      expect(result).toBe("Hello API world")
    })

    it("should preserve non-small-caps text", () => {
      document.body.innerHTML = "<p>Normal text here</p>"
      const range = document.createRange()
      range.selectNodeContents(document.body)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const result = uppercaseSmallCapsInSelection(selection)
      expect(result).toBe("Normal text here")
    })
  })

  describe("handleSmallCapsCopy", () => {
    interface MockClipboardData {
      data: Record<string, string>
      setData(type: string, value: string): void
      getData(type: string): string
    }

    interface MockClipboardEvent extends Event {
      clipboardData: MockClipboardData
    }

    function createClipboardEvent(): MockClipboardEvent {
      const clipboardData: MockClipboardData = {
        data: {},
        setData(type: string, value: string) {
          this.data[type] = value
        },
        getData(type: string) {
          return this.data[type]
        },
      }
      // jsdom doesn't have ClipboardEvent, so we create a regular Event and add clipboardData
      const event = new Event("copy", {
        bubbles: true,
        cancelable: true,
      }) as MockClipboardEvent
      Object.defineProperty(event, "clipboardData", { value: clipboardData })
      return event
    }

    it("should do nothing when selection is empty", () => {
      const selection = window.getSelection()!
      selection.removeAllRanges()

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(false)
    })

    it("should do nothing when selection has no small-caps", () => {
      document.body.innerHTML = "<p>Normal text</p>"
      const range = document.createRange()
      range.selectNodeContents(document.body.querySelector("p")!)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)
      expect(event.defaultPrevented).toBe(false)
    })

    it("should intercept copy and fix small-caps text", () => {
      document.body.innerHTML = '<p>Hello <abbr class="small-caps">api</abbr> world</p>'
      const range = document.createRange()
      range.selectNodeContents(document.body.querySelector("p")!)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)

      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe("Hello API world")
      expect(event.clipboardData.data["text/html"]).toContain("API")
    })

    it("should work when selection starts inside small-caps", () => {
      document.body.innerHTML = '<p><abbr class="small-caps">nasa</abbr> rocks</p>'
      const range = document.createRange()
      range.selectNodeContents(document.body.querySelector("p")!)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)

      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe("NASA rocks")
    })

    it("should handle selection within small-caps element (closest check)", () => {
      document.body.innerHTML = '<p><abbr class="small-caps">nasa program</abbr></p>'
      const abbr = document.body.querySelector("abbr")!
      const textNode = abbr.firstChild!
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 4) // Select "nasa"
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)

      // Selection is within .small-caps but cloned fragment won't have .small-caps class
      // So it should not prevent default (no small-caps in the cloned content)
      expect(event.defaultPrevented).toBe(false)
    })
  })

  describe("initSmallCapsCopy", () => {
    it("should register copy event listener", () => {
      const addEventListenerSpy = jest.spyOn(document, "addEventListener")
      initSmallCapsCopy()
      expect(addEventListenerSpy).toHaveBeenCalledWith("copy", handleSmallCapsCopy)
      addEventListenerSpy.mockRestore()
    })
  })
})
