/**
 * @jest-environment jsdom
 *
 * NOTE: Coverage shows 0% for static browser scripts because they're loaded
 * dynamically via `new Function()` rather than through Jest's module resolution.
 * These are standalone JS files that run directly in the browser via <script> tags,
 * not ES modules that can be imported. The tests verify functionality but can't
 * be instrumented for coverage tracking.
 */

import { jest, describe, it, beforeEach, afterEach, expect } from "@jest/globals"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

declare global {
  interface Window {
    __quartz_checkbox_states?: Map<string, boolean>
  }
}

const loadScript = () => {
  const scriptPath = join(__dirname, "..", "detectInitialState.js")
  const scriptContent = readFileSync(scriptPath, "utf-8")
  // Use Function constructor to run in global context with jsdom globals
  const fn = new Function(scriptContent)
  fn()
}

describe("detectInitialState", () => {
  let matchMediaMock: ReturnType<typeof jest.fn>

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute("data-theme")
    document.documentElement.removeAttribute("data-theme-mode")
    document.documentElement.style.cssText = ""
    window.__quartz_checkbox_states = undefined

    matchMediaMock = jest.fn((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)",
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMediaMock,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("theme initialization", () => {
    it("should set theme mode to 'auto' when no saved theme exists", () => {
      loadScript()

      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
    })

    it("should use saved theme from localStorage", () => {
      localStorage.setItem("saved-theme", "dark")

      loadScript()

      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("dark")
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    })

    it("should resolve auto theme to dark when system prefers dark", () => {
      matchMediaMock.mockReturnValue({ matches: true })

      loadScript()

      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    })

    it("should resolve auto theme to light when system prefers light", () => {
      matchMediaMock.mockReturnValue({ matches: false })

      loadScript()

      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.documentElement.getAttribute("data-theme")).toBe("light")
    })

    it("should set theme label content CSS property with capitalized mode", () => {
      localStorage.setItem("saved-theme", "light")

      loadScript()

      expect(document.documentElement.style.getPropertyValue("--theme-label-content")).toBe(
        '"Light"',
      )
    })

    it("should capitalize auto mode in theme label", () => {
      loadScript()

      expect(document.documentElement.style.getPropertyValue("--theme-label-content")).toBe(
        '"Auto"',
      )
    })
  })

  describe("video autoplay state", () => {
    it("should show pause button when autoplay is enabled", () => {
      localStorage.setItem("pond-video-autoplay", "true")

      loadScript()

      expect(document.documentElement.style.getPropertyValue("--video-play-display")).toBe("none")
      expect(document.documentElement.style.getPropertyValue("--video-pause-display")).toBe("block")
    })

    it("should show play button when autoplay is disabled", () => {
      localStorage.setItem("pond-video-autoplay", "false")

      loadScript()

      expect(document.documentElement.style.getPropertyValue("--video-play-display")).toBe("block")
      expect(document.documentElement.style.getPropertyValue("--video-pause-display")).toBe("none")
    })

    it("should show play button by default when no preference is set", () => {
      loadScript()

      expect(document.documentElement.style.getPropertyValue("--video-play-display")).toBe("block")
      expect(document.documentElement.style.getPropertyValue("--video-pause-display")).toBe("none")
    })
  })

  describe("checkbox state preloading", () => {
    it("should create checkbox states map on window", () => {
      loadScript()

      expect(window.__quartz_checkbox_states).toBeInstanceOf(Map)
    })

    it("should load checkbox states from localStorage", () => {
      localStorage.setItem("page1-checkbox-1", "true")
      localStorage.setItem("page1-checkbox-2", "false")
      localStorage.setItem("other-key", "value")

      loadScript()

      const states = window.__quartz_checkbox_states
      expect(states).toBeDefined()
      expect(states?.get("page1-checkbox-1")).toBe(true)
      expect(states?.get("page1-checkbox-2")).toBe(false)
      expect(states?.has("other-key")).toBe(false)
    })

    it("should handle empty localStorage", () => {
      loadScript()

      const states = window.__quartz_checkbox_states
      expect(states).toBeDefined()
      expect(states?.size).toBe(0)
    })
  })
})
