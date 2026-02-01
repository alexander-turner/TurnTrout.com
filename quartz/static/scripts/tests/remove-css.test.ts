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
  const scriptPath = join(__dirname, "..", "remove-css.js")
  const scriptContent = readFileSync(scriptPath, "utf-8")
  const fn = new Function(scriptContent)
  fn()
}

describe("remove-css", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })

  const createCriticalCSS = () => {
    const style = document.createElement("style")
    style.id = "critical-css"
    style.textContent = "body { color: red; }"
    document.head.appendChild(style)
    return style
  }

  const createMainCSS = (loaded = false) => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "/index.css"
    document.head.appendChild(link)

    if (loaded) {
      // Mock the sheet property to indicate stylesheet is loaded
      Object.defineProperty(link, "sheet", {
        value: {} as CSSStyleSheet,
        writable: true,
      })
    }

    return link
  }

  describe("when main CSS is already loaded", () => {
    it("should remove critical CSS immediately", () => {
      const criticalCSS = createCriticalCSS()
      createMainCSS(true)

      expect(document.getElementById("critical-css")).toBe(criticalCSS)

      loadScript()

      expect(document.getElementById("critical-css")).toBeNull()
    })
  })

  describe("when main CSS is not yet loaded", () => {
    it("should remove critical CSS when main CSS loads", () => {
      const criticalCSS = createCriticalCSS()
      const mainCSS = createMainCSS(false)

      expect(document.getElementById("critical-css")).toBe(criticalCSS)

      loadScript()

      // Critical CSS should still exist before load event
      expect(document.getElementById("critical-css")).toBe(criticalCSS)

      // Simulate load event
      mainCSS.dispatchEvent(new Event("load"))

      expect(document.getElementById("critical-css")).toBeNull()
    })
  })

  describe("when main CSS link doesn't exist", () => {
    it("should remove critical CSS on window load", () => {
      const criticalCSS = createCriticalCSS()

      expect(document.getElementById("critical-css")).toBe(criticalCSS)

      loadScript()

      // Critical CSS should still exist before window load
      expect(document.getElementById("critical-css")).toBe(criticalCSS)

      // Simulate window load event
      window.dispatchEvent(new Event("load"))

      expect(document.getElementById("critical-css")).toBeNull()
    })
  })

  describe("when critical CSS doesn't exist", () => {
    it("should not throw when main CSS is loaded", () => {
      createMainCSS(true)

      expect(() => loadScript()).not.toThrow()
    })

    it("should not throw when main CSS loads", () => {
      const mainCSS = createMainCSS(false)

      loadScript()

      expect(() => {
        mainCSS.dispatchEvent(new Event("load"))
      }).not.toThrow()
    })

    it("should not throw on window load", () => {
      loadScript()

      expect(() => {
        window.dispatchEvent(new Event("load"))
      }).not.toThrow()
    })
  })
})
