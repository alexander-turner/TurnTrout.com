/**
 * @jest-environment jest-fixed-jsdom
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  applyWrapState,
  createWrapButton,
  getWrapPreference,
  initializeWrapButtons,
  setWrapPreference,
  STORAGE_KEY,
  svgWrap,
  toggleWrap,
  WRAP_CLASS,
} from "./code-wrap"

function makePreWithCode(code: string): HTMLPreElement {
  const pre = document.createElement("pre")
  const codeEl = document.createElement("code")
  codeEl.textContent = code
  pre.appendChild(codeEl)
  return pre
}

describe("code-wrap", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.localStorage.clear()
  })

  afterEach(() => {
    document.body.innerHTML = ""
    window.localStorage.clear()
    jest.restoreAllMocks()
  })

  describe("getWrapPreference", () => {
    it("returns false by default", () => {
      expect(getWrapPreference()).toBe(false)
    })

    it("returns true when storage holds 'true'", () => {
      window.localStorage.setItem(STORAGE_KEY, "true")
      expect(getWrapPreference()).toBe(true)
    })

    it("returns false when storage throws", () => {
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("storage disabled")
      })
      expect(getWrapPreference()).toBe(false)
    })
  })

  describe("setWrapPreference", () => {
    it("persists 'true' / 'false' strings", () => {
      setWrapPreference(true)
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true")
      setWrapPreference(false)
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("false")
    })

    it("silently ignores storage failures", () => {
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage disabled")
      })
      expect(() => setWrapPreference(true)).not.toThrow()
    })
  })

  describe("applyWrapState", () => {
    it("toggles the soft-wrap class on every <pre>", () => {
      const pre1 = makePreWithCode("a")
      const pre2 = makePreWithCode("b")
      document.body.append(pre1, pre2)

      applyWrapState(true)
      expect(pre1.classList.contains(WRAP_CLASS)).toBe(true)
      expect(pre2.classList.contains(WRAP_CLASS)).toBe(true)

      applyWrapState(false)
      expect(pre1.classList.contains(WRAP_CLASS)).toBe(false)
      expect(pre2.classList.contains(WRAP_CLASS)).toBe(false)
    })

    it("syncs aria attributes on every wrap button", () => {
      const button = document.createElement("button")
      button.className = "code-wrap-button"
      document.body.appendChild(button)

      applyWrapState(true)
      expect(button.getAttribute("aria-pressed")).toBe("true")
      expect(button.getAttribute("aria-label")).toBe("Disable soft-wrap")

      applyWrapState(false)
      expect(button.getAttribute("aria-pressed")).toBe("false")
      expect(button.getAttribute("aria-label")).toBe("Enable soft-wrap")
    })
  })

  describe("toggleWrap", () => {
    it("flips the persisted preference and updates the DOM", () => {
      const pre = makePreWithCode("hello")
      document.body.appendChild(pre)
      initializeWrapButtons()

      toggleWrap()
      expect(getWrapPreference()).toBe(true)
      expect(pre.classList.contains(WRAP_CLASS)).toBe(true)

      toggleWrap()
      expect(getWrapPreference()).toBe(false)
      expect(pre.classList.contains(WRAP_CLASS)).toBe(false)
    })
  })

  describe("createWrapButton", () => {
    it("creates a button reflecting the current preference", () => {
      const button = createWrapButton()
      expect(button.tagName).toBe("BUTTON")
      expect(button.type).toBe("button")
      expect(button.className).toBe("code-wrap-button")
      expect(button.getAttribute("aria-pressed")).toBe("false")
      expect(button.getAttribute("aria-label")).toBe("Enable soft-wrap")
      expect(button.innerHTML).toBe(svgWrap)
    })

    it("starts in the pressed state when wrap is already enabled", () => {
      window.localStorage.setItem(STORAGE_KEY, "true")
      const button = createWrapButton()
      expect(button.getAttribute("aria-pressed")).toBe("true")
      expect(button.getAttribute("aria-label")).toBe("Disable soft-wrap")
    })

    it("toggles the global preference on click", () => {
      const pre = makePreWithCode("hello")
      document.body.appendChild(pre)
      const button = createWrapButton()
      document.body.appendChild(button)

      button.click()
      expect(getWrapPreference()).toBe(true)
      expect(pre.classList.contains(WRAP_CLASS)).toBe(true)
      expect(button.getAttribute("aria-pressed")).toBe("true")
    })
  })

  describe("initializeWrapButtons", () => {
    it("prepends a wrap button to each <pre> with a <code> child", () => {
      const pre1 = makePreWithCode("a")
      const pre2 = makePreWithCode("b")
      document.body.append(pre1, pre2)

      initializeWrapButtons()

      expect(pre1.firstElementChild?.className).toBe("code-wrap-button")
      expect(pre2.firstElementChild?.className).toBe("code-wrap-button")
    })

    it("skips <pre> elements without a <code> child", () => {
      const pre = document.createElement("pre")
      document.body.appendChild(pre)

      initializeWrapButtons()

      expect(pre.querySelector(".code-wrap-button")).toBeNull()
      expect(pre.dataset.wrapInitialized).toBeUndefined()
    })

    it("does not double-initialize on repeated calls", () => {
      const pre = makePreWithCode("hello")
      document.body.appendChild(pre)

      initializeWrapButtons()
      initializeWrapButtons()
      initializeWrapButtons()

      expect(pre.querySelectorAll(".code-wrap-button").length).toBe(1)
    })

    it("applies the stored preference to fresh <pre> blocks", () => {
      window.localStorage.setItem(STORAGE_KEY, "true")
      const pre = makePreWithCode("hello")
      document.body.appendChild(pre)

      initializeWrapButtons()

      expect(pre.classList.contains(WRAP_CLASS)).toBe(true)
      const button = pre.querySelector(".code-wrap-button") as HTMLButtonElement
      expect(button.getAttribute("aria-pressed")).toBe("true")
    })

    it("clicking the injected button toggles wrap globally", () => {
      const pre = makePreWithCode("hello")
      document.body.appendChild(pre)

      initializeWrapButtons()
      const button = pre.querySelector(".code-wrap-button") as HTMLButtonElement
      button.click()

      expect(pre.classList.contains(WRAP_CLASS)).toBe(true)
      expect(getWrapPreference()).toBe(true)
    })
  })
})
