/**
 * @jest-environment jsdom
 *
 * Tests for collapsible admonition state persistence in admonition.inline.js.
 */

import { jest, describe, it, beforeAll, beforeEach, afterEach, expect } from "@jest/globals"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

import type { FullSlug } from "../../util/path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dispatchNavEvent = () => {
  document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))
}

describe("admonition.inline collapsible state persistence", () => {
  beforeAll(() => {
    const scriptPath = join(__dirname, "admonition.inline.js")
    const scriptContent = readFileSync(scriptPath, "utf-8")
    const fn = new Function(scriptContent)
    fn()
  })

  beforeEach(() => {
    document.body.innerHTML = ""
    document.body.dataset.slug = "test-page"
    localStorage.clear()
    // Reset the collapsible states cache
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = new Map()
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
    localStorage.clear()
  })

  const createAdmonition = (collapsed: boolean = false) => {
    const admonition = document.createElement("blockquote")
    admonition.className = `admonition note is-collapsible${collapsed ? " is-collapsed" : ""}`
    admonition.setAttribute("data-admonition", "note")

    const title = document.createElement("div")
    title.className = "admonition-title"

    const content = document.createElement("div")
    content.className = "admonition-content"
    content.textContent = "Admonition content"

    admonition.appendChild(title)
    admonition.appendChild(content)

    return admonition
  }

  it("should assign unique collapsible IDs based on slug and index", () => {
    const admonition1 = createAdmonition()
    const admonition2 = createAdmonition(true)
    document.body.appendChild(admonition1)
    document.body.appendChild(admonition2)

    dispatchNavEvent()

    expect(admonition1.dataset.collapsibleId).toBe("test-page-collapsible-0")
    expect(admonition2.dataset.collapsibleId).toBe("test-page-collapsible-1")
  })

  it("should save collapsed state to localStorage when closing", () => {
    const admonition = createAdmonition(false) // Start expanded
    document.body.appendChild(admonition)
    dispatchNavEvent()

    const title = admonition.querySelector(".admonition-title") as HTMLElement
    title.click()

    expect(localStorage.getItem("test-page-collapsible-0")).toBe("true")
    expect(admonition.classList.contains("is-collapsed")).toBe(true)
  })

  it("should save expanded state to localStorage when opening", () => {
    const admonition = createAdmonition(true) // Start collapsed
    document.body.appendChild(admonition)
    dispatchNavEvent()

    admonition.click()

    expect(localStorage.getItem("test-page-collapsible-0")).toBe("false")
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
  })

  it("should restore collapsed state from pre-loaded cache on nav", () => {
    // Pre-load the state before creating DOM
    const states = new Map<string, boolean>()
    states.set("test-page-collapsible-0", true) // Should be collapsed
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = states

    const admonition = createAdmonition(false) // Initially expanded in HTML
    document.body.appendChild(admonition)

    dispatchNavEvent()

    // Should be collapsed based on saved state
    expect(admonition.classList.contains("is-collapsed")).toBe(true)
  })

  it("should restore expanded state from pre-loaded cache on nav", () => {
    // Pre-load the state before creating DOM
    const states = new Map<string, boolean>()
    states.set("test-page-collapsible-0", false) // Should be expanded
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = states

    const admonition = createAdmonition(true) // Initially collapsed in HTML
    document.body.appendChild(admonition)

    dispatchNavEvent()

    // Should be expanded based on saved state
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
  })

  it("should use default HTML state when no saved state exists", () => {
    // Empty states cache
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = new Map()

    const expandedAdmonition = createAdmonition(false)
    const collapsedAdmonition = createAdmonition(true)
    document.body.appendChild(expandedAdmonition)
    document.body.appendChild(collapsedAdmonition)

    dispatchNavEvent()

    // Should keep their default HTML states
    expect(expandedAdmonition.classList.contains("is-collapsed")).toBe(false)
    expect(collapsedAdmonition.classList.contains("is-collapsed")).toBe(true)
  })

  it("should update state cache when toggling", () => {
    const states = new Map<string, boolean>()
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = states

    const admonition = createAdmonition(false)
    document.body.appendChild(admonition)
    dispatchNavEvent()

    const title = admonition.querySelector(".admonition-title") as HTMLElement
    title.click() // Close it

    expect(states.get("test-page-collapsible-0")).toBe(true)
  })

  it("should handle multiple admonitions with different states", () => {
    const states = new Map<string, boolean>()
    states.set("test-page-collapsible-0", false) // Should be expanded
    states.set("test-page-collapsible-1", true) // Should be collapsed
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = states

    const admonition1 = createAdmonition(true) // HTML says collapsed, saved says expanded
    const admonition2 = createAdmonition(false) // HTML says expanded, saved says collapsed
    document.body.appendChild(admonition1)
    document.body.appendChild(admonition2)

    dispatchNavEvent()

    expect(admonition1.classList.contains("is-collapsed")).toBe(false)
    expect(admonition2.classList.contains("is-collapsed")).toBe(true)
  })

  it("should not save state when collapsibleId is not set", () => {
    const admonition = createAdmonition(false)
    document.body.appendChild(admonition)
    // Don't dispatch nav event, so collapsibleId won't be set

    // This simulates checking before nav event has run
    // The admonition won't have a collapsibleId yet
    expect(admonition.dataset.collapsibleId).toBeUndefined()
  })

  it("should handle missing window.__quartz_collapsible_states gracefully", () => {
    // Delete the states cache entirely
    delete (window as unknown as { __quartz_collapsible_states?: Map<string, boolean> })
      .__quartz_collapsible_states

    const admonition = createAdmonition(false)
    document.body.appendChild(admonition)

    // Should not throw
    expect(() => dispatchNavEvent()).not.toThrow()

    // Should still set up the collapsible ID
    expect(admonition.dataset.collapsibleId).toBe("test-page-collapsible-0")
  })

  it("should handle clicking on content without closing (only title closes)", () => {
    const admonition = createAdmonition(false) // Start expanded
    document.body.appendChild(admonition)
    dispatchNavEvent()

    const content = admonition.querySelector(".admonition-content") as HTMLElement
    content.click()

    // Content click should not close the admonition
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
    expect(localStorage.getItem("test-page-collapsible-0")).toBeNull()
  })

  it("should handle admonition without title gracefully", () => {
    const admonition = document.createElement("blockquote")
    admonition.className = "admonition note is-collapsible"
    // Don't add a title element
    document.body.appendChild(admonition)

    // Should not throw
    expect(() => dispatchNavEvent()).not.toThrow()
  })
})
