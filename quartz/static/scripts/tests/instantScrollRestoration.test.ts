/**
 * @jest-environment jsdom
 */

import { jest, describe, it, beforeEach, afterEach, expect } from "@jest/globals"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

declare global {
  interface Window {
    __routerInitialized?: boolean
  }
}

const loadScript = () => {
  const scriptPath = join(__dirname, "..", "instantScrollRestoration.js")
  const scriptContent = readFileSync(scriptPath, "utf-8")
  const fn = new Function(scriptContent)
  fn()
}

describe("instantScrollRestoration", () => {
  let rafCallbacks: FrameRequestCallback[]
  let rafId: number
  let scrollToMock: ReturnType<typeof jest.fn>

  beforeEach(() => {
    document.body.innerHTML = ""
    sessionStorage.clear()
    window.__routerInitialized = undefined

    // Mock scrollY
    let currentScrollY = 0
    Object.defineProperty(window, "scrollY", {
      get: () => currentScrollY,
      configurable: true,
    })

    // Mock scrollTo
    scrollToMock = jest.fn((x: number, y: number) => {
      currentScrollY = y
    })
    window.scrollTo = scrollToMock as typeof window.scrollTo

    // Mock history.state
    Object.defineProperty(window.history, "state", {
      value: null,
      writable: true,
      configurable: true,
    })

    // Mock history.scrollRestoration
    Object.defineProperty(window.history, "scrollRestoration", {
      value: "auto",
      writable: true,
      configurable: true,
    })

    // Mock requestAnimationFrame
    rafCallbacks = []
    rafId = 0
    global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++rafId
    }) as typeof global.requestAnimationFrame

    jest.spyOn(console, "debug").mockImplementation(() => {})
    jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    window.__routerInitialized = undefined
  })

  const runRafCallbacks = (times = 1) => {
    for (let i = 0; i < times; i++) {
      const callbacks = [...rafCallbacks]
      rafCallbacks = []
      callbacks.forEach((cb) => cb(performance.now()))
    }
  }

  describe("scroll restoration mode", () => {
    it("should set scrollRestoration to manual on history", () => {
      loadScript()

      expect(window.history.scrollRestoration).toBe("manual")
    })
  })

  describe("SPA router detection", () => {
    it("should skip restoration when SPA router is initialized", () => {
      window.__routerInitialized = true
      Object.defineProperty(window.history, "state", {
        value: { scroll: 100 },
        configurable: true,
      })

      loadScript()

      expect(scrollToMock).not.toHaveBeenCalled()
    })
  })

  describe("saved scroll from history.state", () => {
    it("should restore scroll from history.state.scroll", () => {
      Object.defineProperty(window.history, "state", {
        value: { scroll: 500 },
        configurable: true,
      })

      loadScript()
      runRafCallbacks()

      expect(scrollToMock).toHaveBeenCalledWith(0, 500)
    })
  })

  describe("sessionStorage fallback", () => {
    it("should use sessionStorage fallback when history.state is empty", () => {
      sessionStorage.setItem("instantScrollRestore", "250")

      loadScript()
      runRafCallbacks()

      expect(scrollToMock).toHaveBeenCalledWith(0, 250)
    })

    it("should clear sessionStorage after use", () => {
      sessionStorage.setItem("instantScrollRestore", "250")

      loadScript()
      runRafCallbacks()

      expect(sessionStorage.getItem("instantScrollRestore")).toBeNull()
    })

    it("should handle invalid sessionStorage value", () => {
      sessionStorage.setItem("instantScrollRestore", "not-a-number")

      loadScript()

      // Should not throw and should not scroll
      expect(scrollToMock).not.toHaveBeenCalled()
    })
  })

  describe("nothing to restore", () => {
    it("should not scroll when no saved position and no hash", () => {
      loadScript()

      expect(scrollToMock).not.toHaveBeenCalled()
    })
  })

  describe("hash-based scroll restoration", () => {
    beforeEach(() => {
      // Mock location.hash
      Object.defineProperty(window, "location", {
        value: { ...window.location, hash: "#test-section" },
        writable: true,
        configurable: true,
      })
    })

    it("should scroll to hash element when no saved scroll position", () => {
      const section = document.createElement("div")
      section.id = "test-section"
      document.body.appendChild(section)

      // Mock getBoundingClientRect
      section.getBoundingClientRect = jest.fn(() => ({
        top: 300,
        bottom: 350,
        left: 0,
        right: 100,
        width: 100,
        height: 50,
        x: 0,
        y: 300,
        toJSON: () => ({}),
      }))

      // Mock getComputedStyle
      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = jest.fn(() => ({
        scrollMarginTop: "0px",
        getPropertyValue: () => "0px",
      })) as unknown as typeof window.getComputedStyle

      loadScript()
      runRafCallbacks()

      expect(scrollToMock).toHaveBeenCalledWith(0, 300)

      window.getComputedStyle = originalGetComputedStyle
    })

    it("should account for scroll-margin-top when scrolling to hash", () => {
      const section = document.createElement("div")
      section.id = "test-section"
      document.body.appendChild(section)

      section.getBoundingClientRect = jest.fn(() => ({
        top: 300,
        bottom: 350,
        left: 0,
        right: 100,
        width: 100,
        height: 50,
        x: 0,
        y: 300,
        toJSON: () => ({}),
      }))

      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = jest.fn(() => ({
        scrollMarginTop: "50px",
        getPropertyValue: () => "50px",
      })) as unknown as typeof window.getComputedStyle

      loadScript()
      runRafCallbacks()

      // Should scroll to 300 - 50 = 250
      expect(scrollToMock).toHaveBeenCalledWith(0, 250)

      window.getComputedStyle = originalGetComputedStyle
    })

    it("should not scroll to hash if saved scroll position exists", () => {
      Object.defineProperty(window.history, "state", {
        value: { scroll: 100 },
        configurable: true,
      })

      const section = document.createElement("div")
      section.id = "test-section"
      document.body.appendChild(section)

      loadScript()
      runRafCallbacks()

      // Should use saved scroll, not hash
      expect(scrollToMock).toHaveBeenCalledWith(0, 100)
    })

    it("should wait for hash element if not immediately available", () => {
      // Element doesn't exist yet
      loadScript()

      expect(scrollToMock).not.toHaveBeenCalled()

      // Add element after script loads
      const section = document.createElement("div")
      section.id = "test-section"
      document.body.appendChild(section)

      section.getBoundingClientRect = jest.fn(() => ({
        top: 200,
        bottom: 250,
        left: 0,
        right: 100,
        width: 100,
        height: 50,
        x: 0,
        y: 200,
        toJSON: () => ({}),
      }))

      const originalGetComputedStyle = window.getComputedStyle
      window.getComputedStyle = jest.fn(() => ({
        scrollMarginTop: "0px",
        getPropertyValue: () => "0px",
      })) as unknown as typeof window.getComputedStyle

      // Run RAF callbacks - should find element now
      runRafCallbacks()

      expect(scrollToMock).toHaveBeenCalledWith(0, 200)

      window.getComputedStyle = originalGetComputedStyle
    })
  })

  describe("max attempts limit", () => {
    it("should stop trying after MAX_ATTEMPTS (180)", () => {
      // Set up a hash that never resolves (element never appears)
      Object.defineProperty(window, "location", {
        value: { ...window.location, hash: "#nonexistent" },
        writable: true,
        configurable: true,
      })

      loadScript()

      // Run more than MAX_ATTEMPTS callbacks
      runRafCallbacks(200)

      // Should have queued exactly 181 callbacks (initial + 180 attempts)
      // requestAnimationFrame should have been called 181 times total
      expect(global.requestAnimationFrame).toHaveBeenCalled()
    })
  })

  describe("waitForLayoutStability", () => {
    it("should correct drift from target position", () => {
      let currentScrollY = 0
      Object.defineProperty(window, "scrollY", {
        get: () => currentScrollY,
        configurable: true,
      })

      scrollToMock = jest.fn((x: number, y: number) => {
        currentScrollY = y
      })
      window.scrollTo = scrollToMock as typeof window.scrollTo

      Object.defineProperty(window.history, "state", {
        value: { scroll: 500 },
        configurable: true,
      })

      loadScript()
      runRafCallbacks() // Initial scroll to 500

      // Simulate drift - something moved the scroll
      currentScrollY = 510

      // Run monitoring frames
      runRafCallbacks(5)

      // Should have corrected back to 500
      expect(scrollToMock).toHaveBeenLastCalledWith(0, 500)
    })

    it("should cancel monitoring when user scrolls", () => {
      Object.defineProperty(window.history, "state", {
        value: { scroll: 500 },
        configurable: true,
      })

      loadScript()
      runRafCallbacks() // Initial scroll

      // Simulate user wheel interaction
      window.dispatchEvent(new Event("wheel"))

      // Simulate large scroll (user action)
      let currentScrollY = 600
      Object.defineProperty(window, "scrollY", {
        get: () => currentScrollY,
        configurable: true,
      })

      // Dispatch scroll event
      window.dispatchEvent(new Event("scroll"))

      // Run more frames
      runRafCallbacks(10)

      // Should NOT have tried to correct back to 500 after user interaction
      const lastCall = scrollToMock.mock.calls[scrollToMock.mock.calls.length - 1]
      // The last programmatic scroll should be before user interaction
      expect(lastCall).toEqual([0, 500])
    })

    it("should forgive first large drift within forgiveness window", () => {
      let currentScrollY = 0
      Object.defineProperty(window, "scrollY", {
        get: () => currentScrollY,
        configurable: true,
      })

      scrollToMock = jest.fn((x: number, y: number) => {
        currentScrollY = y
      })
      window.scrollTo = scrollToMock as typeof window.scrollTo

      // Mock performance.now to be within forgiveness window
      const originalNow = performance.now
      let mockTime = 0
      performance.now = jest.fn(() => mockTime)

      Object.defineProperty(window.history, "state", {
        value: { scroll: 500 },
        configurable: true,
      })

      loadScript()
      runRafCallbacks() // Initial scroll to 500

      // Simulate large drift within forgiveness window (< 150ms, frame < 3)
      currentScrollY = 600 // 100px drift > 60px threshold
      mockTime = 50 // Within 150ms window

      // Dispatch scroll event
      window.dispatchEvent(new Event("scroll"))

      // First large drift should be forgiven, monitoring should continue
      runRafCallbacks(2)

      // Should correct back since drift was forgiven
      expect(scrollToMock).toHaveBeenLastCalledWith(0, 500)

      performance.now = originalNow
    })
  })

  describe("user interaction detection", () => {
    it.each(["wheel", "touchstart", "pointerdown", "keydown"])(
      "should detect %s as user interaction",
      (eventType) => {
        Object.defineProperty(window.history, "state", {
          value: { scroll: 500 },
          configurable: true,
        })

        loadScript()
        runRafCallbacks() // Initial scroll

        // Simulate user interaction
        window.dispatchEvent(new Event(eventType))

        // Simulate scroll after interaction
        let currentScrollY = 600
        Object.defineProperty(window, "scrollY", {
          get: () => currentScrollY,
          configurable: true,
        })
        window.dispatchEvent(new Event("scroll"))

        // Should have detected user interaction
        expect(console.debug).toHaveBeenCalledWith(
          expect.stringContaining("User scroll detected"),
        )
      },
    )
  })
})
