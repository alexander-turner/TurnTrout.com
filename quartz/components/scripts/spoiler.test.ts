/**
 * @jest-environment jest-fixed-jsdom
 */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals"

import { handleSpoilerClick, handleSpoilerKeydown, toggleSpoiler } from "./spoiler"

function createSpoiler(): HTMLElement {
  const container = document.createElement("div")
  container.className = "spoiler-container"

  const overlay = document.createElement("span")
  overlay.className = "spoiler-overlay"
  overlay.setAttribute("role", "button")
  overlay.setAttribute("tabindex", "0")
  overlay.setAttribute("aria-expanded", "false")
  overlay.setAttribute("aria-hidden", "false")

  const content = document.createElement("span")
  content.className = "spoiler-content"
  content.setAttribute("aria-hidden", "true")
  content.textContent = "secret"

  container.append(overlay, content)
  document.body.appendChild(container)
  return container
}

function expectRevealed(container: HTMLElement, revealed: boolean): void {
  const overlay = container.querySelector(".spoiler-overlay")
  const content = container.querySelector(".spoiler-content")
  expect(container.classList.contains("revealed")).toBe(revealed)
  expect(overlay?.getAttribute("aria-expanded")).toBe(String(revealed))
  expect(overlay?.getAttribute("aria-hidden")).toBe(String(revealed))
  expect(content?.getAttribute("aria-hidden")).toBe(String(!revealed))
}

describe("spoiler", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    document.addEventListener("click", handleSpoilerClick)
    document.addEventListener("keydown", handleSpoilerKeydown)
  })

  afterEach(() => {
    document.removeEventListener("click", handleSpoilerClick)
    document.removeEventListener("keydown", handleSpoilerKeydown)
    document.body.innerHTML = ""
  })

  describe("toggleSpoiler", () => {
    it("toggles revealed state and syncs aria attributes", () => {
      const container = createSpoiler()

      toggleSpoiler(container)
      expectRevealed(container, true)

      toggleSpoiler(container)
      expectRevealed(container, false)
    })

    it("does not throw when overlay and content are missing", () => {
      const container = document.createElement("div")
      container.className = "spoiler-container"
      document.body.appendChild(container)

      expect(() => toggleSpoiler(container)).not.toThrow()
      expect(container.classList.contains("revealed")).toBe(true)
    })
  })

  describe("handleSpoilerClick", () => {
    it("reveals when clicking inside the container", () => {
      const container = createSpoiler()
      const overlay = container.querySelector(".spoiler-overlay") as HTMLElement

      overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      expectRevealed(container, true)
    })

    it("ignores clicks outside any spoiler container", () => {
      createSpoiler()
      const outside = document.createElement("div")
      document.body.appendChild(outside)

      const handled = handleSpoilerClickReturns(outside)
      expect(handled).toBe(false)
    })
  })

  describe("handleSpoilerKeydown", () => {
    it.each(["Enter", " "])("toggles on %s when overlay focused", (key) => {
      const container = createSpoiler()
      const overlay = container.querySelector(".spoiler-overlay") as HTMLElement

      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      overlay.dispatchEvent(event)

      expectRevealed(container, true)
      expect(event.defaultPrevented).toBe(true)
    })

    it("ignores non-toggle keys", () => {
      const container = createSpoiler()
      const overlay = container.querySelector(".spoiler-overlay") as HTMLElement

      overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }))
      expectRevealed(container, false)
    })

    it("ignores toggle keys fired outside an overlay", () => {
      const container = createSpoiler()
      const content = container.querySelector(".spoiler-content") as HTMLElement

      content.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
      expectRevealed(container, false)
    })

    it("does nothing when overlay has no container ancestor", () => {
      const overlay = document.createElement("span")
      overlay.className = "spoiler-overlay"
      document.body.appendChild(overlay)

      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      expect(() => handleSpoilerKeydown(event)).not.toThrow()
      expect(event.defaultPrevented).toBe(false)
    })
  })
})

/**
 * Invokes `handleSpoilerClick` for a target and reports whether any spoiler was
 * revealed, exercising the no-container branch directly.
 */
function handleSpoilerClickReturns(target: HTMLElement): boolean {
  const before = document.querySelectorAll(".spoiler-container.revealed").length
  const event = new MouseEvent("click", { bubbles: true })
  Object.defineProperty(event, "target", { value: target })
  handleSpoilerClick(event)
  const after = document.querySelectorAll(".spoiler-container.revealed").length
  return after !== before
}
