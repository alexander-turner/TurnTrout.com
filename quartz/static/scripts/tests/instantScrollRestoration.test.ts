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
})
