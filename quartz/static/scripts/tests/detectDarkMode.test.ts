/**
 * @jest-environment jsdom
 */

import { jest, describe, it, beforeEach, afterEach, expect } from "@jest/globals"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const loadScript = () => {
  const scriptPath = join(__dirname, "..", "detectDarkMode.js")
  const scriptContent = readFileSync(scriptPath, "utf-8")
  const fn = new Function(scriptContent)
  fn()
}

describe("detectDarkMode", () => {
  let matchMediaMock: ReturnType<typeof jest.fn>

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute("data-theme")
    document.documentElement.removeAttribute("data-theme-mode")
    document.body.innerHTML = ""

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
    document.body.innerHTML = ""
  })

  describe("theme mode attribute", () => {
    it("should set data-theme-mode to 'auto' when no saved theme", () => {
      loadScript()

      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
    })

    it("should set data-theme-mode to saved theme", () => {
      localStorage.setItem("saved-theme", "dark")

      loadScript()

      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("dark")
    })

    it("should set data-theme-mode to light when saved", () => {
      localStorage.setItem("saved-theme", "light")

      loadScript()

      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light")
    })
  })

  describe("auto theme resolution", () => {
    it("should resolve to dark when system prefers dark", () => {
      matchMediaMock.mockReturnValue({ matches: true })

      loadScript()

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    })

    it("should resolve to light when system prefers light", () => {
      matchMediaMock.mockReturnValue({ matches: false })

      loadScript()

      expect(document.documentElement.getAttribute("data-theme")).toBe("light")
    })
  })

  describe("explicit theme", () => {
    it("should use dark theme directly when saved as dark", () => {
      localStorage.setItem("saved-theme", "dark")

      loadScript()

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    })

    it("should use light theme directly when saved as light", () => {
      localStorage.setItem("saved-theme", "light")

      loadScript()

      expect(document.documentElement.getAttribute("data-theme")).toBe("light")
    })
  })

  describe("theme label update", () => {
    const createThemeLabel = () => {
      const label = document.createElement("p")
      label.id = "theme-label"
      document.body.appendChild(label)
      return label
    }

    it("should update theme label with capitalized theme when label exists", () => {
      const label = createThemeLabel()
      localStorage.setItem("saved-theme", "dark")

      loadScript()

      expect(label.textContent).toBe("Dark")
    })

    it("should update theme label to Light", () => {
      const label = createThemeLabel()
      localStorage.setItem("saved-theme", "light")

      loadScript()

      expect(label.textContent).toBe("Light")
    })

    it("should update theme label for auto mode (showing resolved theme)", () => {
      const label = createThemeLabel()
      matchMediaMock.mockReturnValue({ matches: true })

      loadScript()

      // In auto mode, the label shows the resolved theme (dark/light)
      expect(label.textContent).toBe("Dark")
    })

    it("should not throw when theme label doesn't exist", () => {
      localStorage.setItem("saved-theme", "dark")

      expect(() => loadScript()).not.toThrow()
    })
  })
})
