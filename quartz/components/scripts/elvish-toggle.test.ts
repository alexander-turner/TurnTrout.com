/**
 * @jest-environment jsdom
 */

import { describe, it, beforeEach, afterEach, expect } from "@jest/globals"

import {
  toggleElvish,
  handleElvishKeydown,
  handleElvishClick,
  createHelpText,
  initializeElvishElements,
} from "./elvish-toggle"

// Test constants
const KEYS_THAT_SHOULD_NOT_TOGGLE = ["Tab", "Escape", "a", "1"]
const TOGGLE_KEYS = ["Enter", " "]

// Helper functions
function createTestElement(): HTMLSpanElement {
  const el = document.createElement("span")
  el.setAttribute("aria-pressed", "false")
  return el
}

function createKeyboardEvent(key: string): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  })
}

describe("elvish-toggle", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  describe("toggleElvish", () => {
    it("should toggle show-translation class", () => {
      const el = createTestElement()

      toggleElvish.call(el)
      expect(el.classList.contains("show-translation")).toBe(true)
      expect(el.getAttribute("aria-pressed")).toBe("true")

      toggleElvish.call(el)
      expect(el.classList.contains("show-translation")).toBe(false)
      expect(el.getAttribute("aria-pressed")).toBe("false")
    })
  })

  describe("handleElvishKeydown", () => {
    it.each(TOGGLE_KEYS)("should toggle on %s key", (key) => {
      const el = createTestElement()
      const event = createKeyboardEvent(key)
      handleElvishKeydown.call(el, event)

      expect(el.classList.contains("show-translation")).toBe(true)
      expect(event.defaultPrevented).toBe(true)
    })

    it.each(KEYS_THAT_SHOULD_NOT_TOGGLE)("should not toggle on %s key", (key) => {
      const el = createTestElement()
      const event = createKeyboardEvent(key)
      handleElvishKeydown.call(el, event)

      expect(event.defaultPrevented).toBe(false)
      expect(el.classList.contains("show-translation")).toBe(false)
    })
  })

  describe("handleElvishClick", () => {
    it("should toggle on click", () => {
      const el = createTestElement()
      const event = new MouseEvent("click", { bubbles: true })
      Object.defineProperty(event, "target", { value: el })
      handleElvishClick.call(el, event)

      expect(el.classList.contains("show-translation")).toBe(true)
    })

    it("should not toggle when clicking a link", () => {
      const el = createTestElement()
      const link = document.createElement("a")
      el.appendChild(link)

      const event = new MouseEvent("click", { bubbles: true })
      Object.defineProperty(event, "target", { value: link })
      handleElvishClick.call(el, event)

      expect(el.classList.contains("show-translation")).toBe(false)
    })

    it("should not toggle when clicking nested element inside link", () => {
      const el = createTestElement()
      const link = document.createElement("a")
      const strong = document.createElement("strong")
      link.appendChild(strong)
      el.appendChild(link)

      const event = new MouseEvent("click", { bubbles: true })
      Object.defineProperty(event, "target", { value: strong })
      handleElvishClick.call(el, event)

      expect(el.classList.contains("show-translation")).toBe(false)
    })
  })

  describe("createHelpText", () => {
    it("should create a visually-hidden span with correct content", () => {
      const helpText = createHelpText()

      expect(helpText.id).toBe("elvish-help")
      expect(helpText.className).toBe("visually-hidden")
      expect(helpText.textContent).toBe("Toggle between Elvish and English translation")
    })
  })

  describe("initializeElvishElements", () => {
    it("should add accessibility attributes to elvish elements", () => {
      document.body.innerHTML = `
        <span class="elvish">
          <span class="elvish-tengwar">Tengwar</span>
          <span class="elvish-translation">English</span>
        </span>
      `
      initializeElvishElements()

      const el = document.querySelector(".elvish") as HTMLElement
      expect(el.getAttribute("tabindex")).toBe("0")
      expect(el.getAttribute("role")).toBe("button")
      expect(el.getAttribute("aria-pressed")).toBe("false")
      expect(el.getAttribute("aria-describedby")).toBe("elvish-help")
    })

    it("should create help text when elvish elements exist", () => {
      document.body.innerHTML = '<span class="elvish"></span>'
      initializeElvishElements()

      const helpText = document.getElementById("elvish-help")
      expect(helpText).not.toBeNull()
    })

    it("should append help text to main landmark when available", () => {
      document.body.innerHTML = `
        <main id="center-content">
          <span class="elvish"></span>
        </main>
      `
      initializeElvishElements()

      const main = document.getElementById("center-content")
      const helpText = document.getElementById("elvish-help")
      expect(helpText).not.toBeNull()
      expect(main?.contains(helpText)).toBe(true)
    })

    it("should fallback to body when main landmark is not available", () => {
      document.body.innerHTML = '<span class="elvish"></span>'
      initializeElvishElements()

      const helpText = document.getElementById("elvish-help")
      expect(helpText).not.toBeNull()
      expect(document.body.contains(helpText)).toBe(true)
    })

    it("should not create help text when no elvish elements exist", () => {
      document.body.innerHTML = '<span class="other"></span>'
      initializeElvishElements()

      const helpText = document.getElementById("elvish-help")
      expect(helpText).toBeNull()
    })

    it("should not duplicate help text on multiple calls", () => {
      document.body.innerHTML = '<span class="elvish"></span>'
      initializeElvishElements()
      initializeElvishElements()
      initializeElvishElements()

      const helpTexts = document.querySelectorAll("#elvish-help")
      expect(helpTexts.length).toBe(1)
    })

    it("should not re-initialize already initialized elements", () => {
      document.body.innerHTML = '<span class="elvish"></span>'
      initializeElvishElements()

      const el = document.querySelector(".elvish") as HTMLElement
      el.classList.add("show-translation")
      el.setAttribute("aria-pressed", "true")

      initializeElvishElements() // Should not reset

      expect(el.classList.contains("show-translation")).toBe(true)
      expect(el.getAttribute("aria-pressed")).toBe("true")
    })

    it("should initialize all elvish elements independently", () => {
      document.body.innerHTML = `
        <span class="elvish" id="el1"></span>
        <span class="elvish" id="el2"></span>
        <span class="elvish" id="el3"></span>
      `
      initializeElvishElements()

      const elements = Array.from(document.querySelectorAll(".elvish"))
      expect(elements.length).toBe(3)

      elements.forEach((el) => {
        expect(el.getAttribute("role")).toBe("button")
        expect(el.getAttribute("aria-pressed")).toBe("false")
      })
    })
  })

  describe("nav event integration", () => {
    it("should initialize elements when called", () => {
      document.body.innerHTML = '<span class="elvish"></span>'
      // The inline script registers the nav event listener
      // Here we just verify the function works when called
      initializeElvishElements()

      const el = document.querySelector(".elvish") as HTMLElement
      expect(el.getAttribute("role")).toBe("button")
    })
  })
})
