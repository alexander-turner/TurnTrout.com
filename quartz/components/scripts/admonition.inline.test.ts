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

// Helper to generate expected collapsible ID (matches implementation)
const expectedCollapsibleId = (slug: string, titleText: string): string => {
  const normalizedTitle = (titleText || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
  return `${slug}-collapsible-${normalizedTitle}`
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
    // Clear the shared ID function to test fallback
    delete (window as unknown as { __quartz_collapsible_id?: unknown }).__quartz_collapsible_id
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
    localStorage.clear()
  })

  const createAdmonition = (collapsed: boolean = false, title: string = "Test Title") => {
    const admonition = document.createElement("blockquote")
    admonition.className = `admonition note is-collapsible${collapsed ? " is-collapsed" : ""}`
    admonition.setAttribute("data-admonition", "note")

    const titleEl = document.createElement("div")
    titleEl.className = "admonition-title"
    titleEl.textContent = title

    const content = document.createElement("div")
    content.className = "admonition-content"
    content.textContent = "Admonition content"

    admonition.appendChild(titleEl)
    admonition.appendChild(content)

    return admonition
  }

  it("should assign unique collapsible IDs based on slug and title", () => {
    const admonition1 = createAdmonition(false, "First Note")
    const admonition2 = createAdmonition(true, "Second Note")
    document.body.appendChild(admonition1)
    document.body.appendChild(admonition2)

    dispatchNavEvent()

    expect(admonition1.dataset.collapsibleId).toBe(expectedCollapsibleId("test-page", "First Note"))
    expect(admonition2.dataset.collapsibleId).toBe(
      expectedCollapsibleId("test-page", "Second Note"),
    )
  })

  it("should generate consistent IDs for same title regardless of order", () => {
    // This tests that title-based IDs are stable even if admonitions are reordered
    const admonition = createAdmonition(false, "My Admonition")
    document.body.appendChild(admonition)
    dispatchNavEvent()

    const firstId = admonition.dataset.collapsibleId

    // Remove and re-add in different context
    document.body.innerHTML = ""
    const admonition2 = createAdmonition(false, "My Admonition")
    document.body.appendChild(admonition2)
    dispatchNavEvent()

    expect(admonition2.dataset.collapsibleId).toBe(firstId)
  })

  it("should save collapsed state to localStorage when closing", () => {
    const admonition = createAdmonition(false, "Test Note") // Start expanded
    document.body.appendChild(admonition)
    dispatchNavEvent()

    const title = admonition.querySelector(".admonition-title") as HTMLElement
    title.click()

    const expectedId = expectedCollapsibleId("test-page", "Test Note")
    expect(localStorage.getItem(expectedId)).toBe("true")
    expect(admonition.classList.contains("is-collapsed")).toBe(true)
  })

  it("should save expanded state to localStorage when opening", () => {
    const admonition = createAdmonition(true, "Collapsed Note") // Start collapsed
    document.body.appendChild(admonition)
    dispatchNavEvent()

    admonition.click()

    const expectedId = expectedCollapsibleId("test-page", "Collapsed Note")
    expect(localStorage.getItem(expectedId)).toBe("false")
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
  })

  it("should restore collapsed state from pre-loaded cache on nav", () => {
    const titleText = "Cached Note"
    const id = expectedCollapsibleId("test-page", titleText)

    // Pre-load the state before creating DOM
    const states = new Map<string, boolean>()
    states.set(id, true) // Should be collapsed
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = states

    const admonition = createAdmonition(false, titleText) // Initially expanded in HTML
    document.body.appendChild(admonition)

    dispatchNavEvent()

    // Should be collapsed based on saved state
    expect(admonition.classList.contains("is-collapsed")).toBe(true)
  })

  it("should restore expanded state from pre-loaded cache on nav", () => {
    const titleText = "Expanded Note"
    const id = expectedCollapsibleId("test-page", titleText)

    // Pre-load the state before creating DOM
    const states = new Map<string, boolean>()
    states.set(id, false) // Should be expanded
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = states

    const admonition = createAdmonition(true, titleText) // Initially collapsed in HTML
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

    const expandedAdmonition = createAdmonition(false, "Expanded Default")
    const collapsedAdmonition = createAdmonition(true, "Collapsed Default")
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

    const titleText = "Toggle Note"
    const admonition = createAdmonition(false, titleText)
    document.body.appendChild(admonition)
    dispatchNavEvent()

    const title = admonition.querySelector(".admonition-title") as HTMLElement
    title.click() // Close it

    const expectedId = expectedCollapsibleId("test-page", titleText)
    expect(states.get(expectedId)).toBe(true)
  })

  it("should handle multiple admonitions with different states", () => {
    const title1 = "Note Alpha"
    const title2 = "Note Beta"
    const id1 = expectedCollapsibleId("test-page", title1)
    const id2 = expectedCollapsibleId("test-page", title2)

    const states = new Map<string, boolean>()
    states.set(id1, false) // Should be expanded
    states.set(id2, true) // Should be collapsed
    ;(
      window as unknown as { __quartz_collapsible_states: Map<string, boolean> }
    ).__quartz_collapsible_states = states

    const admonition1 = createAdmonition(true, title1) // HTML says collapsed, saved says expanded
    const admonition2 = createAdmonition(false, title2) // HTML says expanded, saved says collapsed
    document.body.appendChild(admonition1)
    document.body.appendChild(admonition2)

    dispatchNavEvent()

    expect(admonition1.classList.contains("is-collapsed")).toBe(false)
    expect(admonition2.classList.contains("is-collapsed")).toBe(true)
  })

  it("should handle missing window.__quartz_collapsible_states gracefully", () => {
    // Delete the states cache entirely
    delete (window as unknown as { __quartz_collapsible_states?: Map<string, boolean> })
      .__quartz_collapsible_states

    const admonition = createAdmonition(false, "No Cache Note")
    document.body.appendChild(admonition)

    // Should not throw
    expect(() => dispatchNavEvent()).not.toThrow()

    // Should still set up the collapsible ID
    expect(admonition.dataset.collapsibleId).toBe(
      expectedCollapsibleId("test-page", "No Cache Note"),
    )
  })

  it("should handle clicking on content without closing (only title closes)", () => {
    const admonition = createAdmonition(false, "Content Click Note") // Start expanded
    document.body.appendChild(admonition)
    dispatchNavEvent()

    const content = admonition.querySelector(".admonition-content") as HTMLElement
    content.click()

    // Content click should not close the admonition
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
  })

  it("should handle admonition without title gracefully", () => {
    const admonition = document.createElement("blockquote")
    admonition.className = "admonition note is-collapsible"
    // Don't add a title element
    document.body.appendChild(admonition)

    // Should not throw
    expect(() => dispatchNavEvent()).not.toThrow()

    // Should use "untitled" fallback
    expect(admonition.dataset.collapsibleId).toBe(expectedCollapsibleId("test-page", ""))
  })

  it("should normalize titles with special characters", () => {
    const admonition = createAdmonition(false, "Test! @#$% Title (with) [special] chars")
    document.body.appendChild(admonition)
    dispatchNavEvent()

    // Special chars should be normalized to dashes
    expect(admonition.dataset.collapsibleId).toBe(
      "test-page-collapsible-test-title-with-special-chars",
    )
  })

  it("should use shared __quartz_collapsible_id function when available", () => {
    // Set up mock shared function
    const mockIdFn = jest.fn((slug: string, title: string) => `${slug}-mock-${title}`)
    ;(window as unknown as { __quartz_collapsible_id: typeof mockIdFn }).__quartz_collapsible_id =
      mockIdFn

    const admonition = createAdmonition(false, "Shared Fn Test")
    document.body.appendChild(admonition)
    dispatchNavEvent()

    expect(mockIdFn).toHaveBeenCalledWith("test-page", "Shared Fn Test")
    expect(admonition.dataset.collapsibleId).toBe("test-page-mock-Shared Fn Test")
  })

  it("should initialize __quartz_collapsible_states if missing when saving", () => {
    delete (window as unknown as { __quartz_collapsible_states?: Map<string, boolean> })
      .__quartz_collapsible_states

    const admonition = createAdmonition(false, "Init Cache Note")
    document.body.appendChild(admonition)
    dispatchNavEvent()

    // Toggle to trigger save
    const title = admonition.querySelector(".admonition-title") as HTMLElement
    title.click()

    // Should have created the cache
    expect(
      (window as unknown as { __quartz_collapsible_states: Map<string, boolean> })
        .__quartz_collapsible_states,
    ).toBeInstanceOf(Map)
  })
})
