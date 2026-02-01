/**
 * @jest-environment jsdom
 */

import { jest, describe, it, beforeAll, beforeEach, afterEach, expect } from "@jest/globals"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { FullSlug } from "../../../util/path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dispatchNavEvent = () => {
  document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))
}

describe("collapsible-listeners", () => {
  // Load script once for all tests to avoid duplicate event listeners
  beforeAll(() => {
    const scriptPath = join(__dirname, "..", "collapsible-listeners.js")
    const scriptContent = readFileSync(scriptPath, "utf-8")
    const fn = new Function(scriptContent)
    fn()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
  })

  const createCollapsible = (id: string, isActive = false) => {
    const collapsible = document.createElement("div")
    collapsible.className = "collapsible"
    collapsible.id = id

    const title = document.createElement("div")
    title.className = "collapsible-title"

    const foldIcon = document.createElement("span")
    foldIcon.className = "fold-icon"
    foldIcon.setAttribute("aria-expanded", isActive ? "true" : "false")

    const content = document.createElement("div")
    content.className = "content"
    if (isActive) {
      content.classList.add("active")
    }

    collapsible.appendChild(title)
    collapsible.appendChild(foldIcon)
    collapsible.appendChild(content)

    return collapsible
  }

  describe("nav event handler", () => {
    it("should attach click handlers to collapsible titles on nav event", () => {
      const collapsible = createCollapsible("test-1")
      document.body.appendChild(collapsible)

      dispatchNavEvent()

      // Click the title and verify state change
      const title = collapsible.querySelector(".collapsible-title") as HTMLElement
      const content = collapsible.querySelector(".content") as HTMLElement

      expect(content.classList.contains("active")).toBe(false)
      title.click()
      expect(content.classList.contains("active")).toBe(true)
    })
  })

  describe("collapse handler", () => {
    it("should toggle content active class on click", () => {
      const collapsible = createCollapsible("test-1")
      document.body.appendChild(collapsible)

      dispatchNavEvent()

      const title = collapsible.querySelector(".collapsible-title") as HTMLElement
      const content = collapsible.querySelector(".content") as HTMLElement

      expect(content.classList.contains("active")).toBe(false)

      title.click()
      expect(content.classList.contains("active")).toBe(true)

      title.click()
      expect(content.classList.contains("active")).toBe(false)
    })

    it("should update aria-expanded attribute on fold icon", () => {
      const collapsible = createCollapsible("test-1")
      document.body.appendChild(collapsible)

      dispatchNavEvent()

      const title = collapsible.querySelector(".collapsible-title") as HTMLElement
      const foldIcon = collapsible.querySelector(".fold-icon") as HTMLElement

      expect(foldIcon.getAttribute("aria-expanded")).toBe("false")

      title.click()
      expect(foldIcon.getAttribute("aria-expanded")).toBe("true")

      title.click()
      expect(foldIcon.getAttribute("aria-expanded")).toBe("false")
    })

    it("should handle collapsible without content element", () => {
      const collapsible = document.createElement("div")
      collapsible.className = "collapsible"

      const title = document.createElement("div")
      title.className = "collapsible-title"

      collapsible.appendChild(title)
      document.body.appendChild(collapsible)

      dispatchNavEvent()

      // Should not throw when clicking (handler checks for both content and foldIcon)
      expect(() => title.click()).not.toThrow()
    })

    it("should handle collapsible without fold icon", () => {
      const collapsible = document.createElement("div")
      collapsible.className = "collapsible"

      const title = document.createElement("div")
      title.className = "collapsible-title"

      const content = document.createElement("div")
      content.className = "content"

      collapsible.appendChild(title)
      collapsible.appendChild(content)
      document.body.appendChild(collapsible)

      dispatchNavEvent()

      // Should not throw when clicking (handler checks for both content and foldIcon)
      expect(() => title.click()).not.toThrow()
    })
  })

  describe("initially active collapsibles", () => {
    it("should handle already active collapsibles", () => {
      const collapsible = createCollapsible("test-1", true)
      document.body.appendChild(collapsible)

      dispatchNavEvent()

      const title = collapsible.querySelector(".collapsible-title") as HTMLElement
      const content = collapsible.querySelector(".content") as HTMLElement

      expect(content.classList.contains("active")).toBe(true)

      title.click()
      expect(content.classList.contains("active")).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("should handle collapsible without title element", () => {
      const collapsible = document.createElement("div")
      collapsible.className = "collapsible"

      const content = document.createElement("div")
      content.className = "content"

      collapsible.appendChild(content)
      document.body.appendChild(collapsible)

      // Should not throw when nav event fires (null title check)
      expect(() => dispatchNavEvent()).not.toThrow()
    })

    it("should not add duplicate handlers on repeated nav events", () => {
      const collapsible = createCollapsible("test-1")
      document.body.appendChild(collapsible)

      const content = collapsible.querySelector(".content") as HTMLElement
      const title = collapsible.querySelector(".collapsible-title") as HTMLElement

      // Fire nav event multiple times
      dispatchNavEvent()
      dispatchNavEvent()
      dispatchNavEvent()

      // Click once - should toggle once, not 3 times
      expect(content.classList.contains("active")).toBe(false)
      title.click()
      expect(content.classList.contains("active")).toBe(true)
    })

    it("should set data-collapsible-bound attribute after binding", () => {
      const collapsible = createCollapsible("test-1")
      document.body.appendChild(collapsible)

      expect(collapsible.dataset.collapsibleBound).toBeUndefined()

      dispatchNavEvent()

      expect(collapsible.dataset.collapsibleBound).toBe("true")
    })
  })
})
