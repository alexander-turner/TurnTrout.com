/**
 * @jest-environment jsdom
 */

import { jest, describe, it, beforeEach, afterEach, expect } from "@jest/globals"

import { type FullSlug } from "../../util/path"
import { rotateTheme, setupDarkMode } from "./darkmode"

// Mock MediaQueryListEvent if not available in test environment
class MockMediaQueryListEvent extends Event {
  matches: boolean
  media: string

  constructor(type: string, init: { matches: boolean; media: string }) {
    super(type)
    this.matches = init.matches
    this.media = init.media
  }
}

global.MediaQueryListEvent = global.MediaQueryListEvent || MockMediaQueryListEvent

type MediaQueryCallback = (e: MediaQueryListEvent) => void

const createMockMediaQueryList = (
  matches: boolean,
): MediaQueryList & { addEventListener: jest.Mock } => ({
  matches,
  media: "(prefers-color-scheme: dark)",
  onchange: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: () => false,
  addListener: jest.fn(),
  removeListener: jest.fn(),
})

describe("darkmode", () => {
  let localStorageSpy: ReturnType<typeof jest.spyOn>
  let matchMediaSpy: jest.Mock<(query: string) => MediaQueryList>

  const triggerToggle = () => {
    const toggle = document.querySelector("#theme-toggle") as HTMLButtonElement
    toggle.click()
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="darkmode-span">
        <button id="theme-toggle" type="button" aria-label="Toggle theme">
          <svg id="day-icon"></svg>
          <svg id="night-icon"></svg>
        </button>
        <p id="theme-label">Auto</p>
      </div>
    `

    localStorageSpy = jest.spyOn(Storage.prototype, "setItem")

    // Mock window.matchMedia
    matchMediaSpy = jest.fn((query: string) =>
      createMockMediaQueryList(query === "(prefers-color-scheme: dark)"),
    )
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMediaSpy,
    })

    localStorage.clear()

    // Mock component_script_utils.wrapWithoutTransition to not require return values
    jest.mock("./component_script_utils", () => ({
      wrapWithoutTransition:
        <Args extends unknown[], R>(fn: (...args: Args) => R) =>
        (...args: Args): R => {
          return fn(...args)
        },
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
    // Clean up window.matchMedia mock
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: undefined,
    })
  })

  describe("theme initialization", () => {
    for (const systemPrefers of ["dark", "light"]) {
      it(`should set theme to ${systemPrefers} when system prefers ${systemPrefers}`, () => {
        matchMediaSpy.mockReturnValue(createMockMediaQueryList(systemPrefers === "dark"))
        setupDarkMode()
        document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

        expect(document.documentElement.getAttribute("data-theme")).toBe(systemPrefers)
        expect(document.querySelector("#theme-label")?.textContent).toBe("Auto")
      })
    }

    it("should respect stored theme preference over system preference", () => {
      matchMediaSpy.mockReturnValue(createMockMediaQueryList(false)) // system prefers light
      localStorage.setItem("saved-theme", "dark")

      setupDarkMode()
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Dark")
    })
  })

  describe("theme toggle", () => {
    it("should emit theme change event when toggle is clicked", () => {
      setupDarkMode()
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

      triggerToggle()
      expect(document.querySelector("#theme-label")?.textContent).toBe("Light")
    })

    it("should update localStorage when theme is changed", () => {
      setupDarkMode()
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

      triggerToggle()

      expect(localStorageSpy).toHaveBeenCalledWith("saved-theme", "light")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Light")
    })
  })

  describe("system preference change", () => {
    it("should update theme when system preference changes", () => {
      const mediaQueryList = createMockMediaQueryList(false)
      matchMediaSpy.mockReturnValue(mediaQueryList)

      setupDarkMode()
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

      // Initially in auto mode
      expect(document.documentElement.getAttribute("data-theme")).toBe("light")
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Auto")

      // Get the callback that was registered
      const callback = mediaQueryList.addEventListener.mock.calls[0][1] as MediaQueryCallback
      const event = new MediaQueryListEvent("change", {
        matches: true,
        media: "(prefers-color-scheme: dark)",
      })
      callback(event)

      // Theme should change to dark but mode should stay auto
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Auto")

      // But localStorage should preserve auto mode
      expect(localStorageSpy).toHaveBeenCalledWith("saved-theme", "auto")
    })
  })

  describe("auto mode", () => {
    it("should follow system preference when in auto mode", () => {
      localStorage.setItem("saved-theme", "auto")
      const mediaQueryList = createMockMediaQueryList(true)
      matchMediaSpy.mockReturnValue(mediaQueryList)

      setupDarkMode()
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

      // Initially dark theme but auto mode
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Auto")

      // Change system preference to light
      const lightMediaQueryList = createMockMediaQueryList(false)
      matchMediaSpy.mockReturnValue(lightMediaQueryList)

      const callback = mediaQueryList.addEventListener.mock.calls[0][1] as MediaQueryCallback
      const event = new MediaQueryListEvent("change", {
        matches: false,
        media: "(prefers-color-scheme: dark)",
      })
      callback(event)

      // Theme should change but mode should stay auto
      expect(document.documentElement.getAttribute("data-theme")).toBe("light")
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Auto")
    })
  })

  describe("theme cycling", () => {
    it("should cycle through themes in order: auto -> light -> dark -> auto", () => {
      localStorage.setItem("saved-theme", "auto")
      // Mock a system preference of dark
      matchMediaSpy.mockReturnValue(createMockMediaQueryList(true))

      setupDarkMode()
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Auto")

      // auto -> light
      rotateTheme()
      expect(localStorage.getItem("saved-theme")).toBe("light")
      expect(document.documentElement.getAttribute("data-theme")).toBe("light")
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Light")

      // light -> dark
      rotateTheme()
      expect(localStorage.getItem("saved-theme")).toBe("dark")
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("dark")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Dark")

      // dark -> auto
      rotateTheme()
      expect(localStorage.getItem("saved-theme")).toBe("auto")
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Auto")
    })

    it("should default to auto for invalid stored theme", () => {
      // Set an invalid theme in localStorage
      localStorage.setItem("saved-theme", "invalid-theme")
      matchMediaSpy.mockReturnValue(createMockMediaQueryList(false))

      setupDarkMode()
      document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

      // Clicking the toggle should go from invalid -> auto (default) -> light
      rotateTheme()
      expect(localStorage.getItem("saved-theme")).toBe("auto")
      expect(document.documentElement.getAttribute("data-theme-mode")).toBe("auto")
      expect(document.querySelector("#theme-label")?.textContent).toBe("Auto")
    })
  })
})
