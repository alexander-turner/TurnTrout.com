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
      const result = uppercaseSmallCapsInSelection(selection, false)
      expect(result).toBe("")
    })

    it("should uppercase small-caps text in selection", () => {
      document.body.innerHTML = '<p>Hello <abbr class="small-caps">api</abbr> world</p>'
      const range = document.createRange()
      range.selectNodeContents(document.body)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const result = uppercaseSmallCapsInSelection(selection, false)
      expect(result).toBe("Hello API world")
    })

    it("should preserve non-small-caps text", () => {
      document.body.innerHTML = "<p>Normal text here</p>"
      const range = document.createRange()
      range.selectNodeContents(document.body)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const result = uppercaseSmallCapsInSelection(selection, false)
      expect(result).toBe("Normal text here")
    })

    it("should uppercase everything when isEntirelyInSmallCaps is true", () => {
      document.body.innerHTML = "<p>some text</p>"
      const range = document.createRange()
      range.selectNodeContents(document.body)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const result = uppercaseSmallCapsInSelection(selection, true)
      expect(result).toBe("SOME TEXT")
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

    it("should handle partial selection within small-caps element", () => {
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

      // Selection is within .small-caps, so text should be uppercased
      expect(event.defaultPrevented).toBe(true)
      expect(event.clipboardData.data["text/plain"]).toBe("NASA")
    })

    it("should do nothing when ancestor has small-caps but selection doesn't include them", () => {
      // Parent has small-caps child, but selection is on different text
      document.body.innerHTML = '<p>Normal text <abbr class="small-caps">api</abbr> more text</p>'
      const p = document.body.querySelector("p")!
      const textNode = p.firstChild! // "Normal text "
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 6) // Select "Normal"
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      const event = createClipboardEvent()
      handleSmallCapsCopy(event as unknown as ClipboardEvent)

      // Selection doesn't contain small-caps and isn't within one
      expect(event.defaultPrevented).toBe(false)
    })

    it("should handle cut events the same as copy", () => {
      document.body.innerHTML = '<p>Hello <abbr class="small-caps">api</abbr> world</p>'
      const range = document.createRange()
      range.selectNodeContents(document.body.querySelector("p")!)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)

      // Create a cut event instead of copy
      const clipboardData = {
        data: {} as Record<string, string>,
        setData(type: string, value: string) {
          this.data[type] = value
        },
        getData(type: string) {
          return this.data[type]
        },
      }
      const event = new Event("cut", { bubbles: true, cancelable: true })
      Object.defineProperty(event, "clipboardData", { value: clipboardData })

      handleSmallCapsCopy(event as unknown as ClipboardEvent)

      expect(event.defaultPrevented).toBe(true)
      expect(clipboardData.data["text/plain"]).toBe("Hello API world")
    })
  })

  describe("initSmallCapsCopy", () => {
    it("should register copy and cut event listeners", () => {
      const addEventListenerSpy = jest.spyOn(document, "addEventListener")
      initSmallCapsCopy()
      expect(addEventListenerSpy).toHaveBeenCalledWith("copy", handleSmallCapsCopy)
      expect(addEventListenerSpy).toHaveBeenCalledWith("cut", handleSmallCapsCopy)
      addEventListenerSpy.mockRestore()
    })
  })
})
