/**
 * @jest-environment jsdom
 */
import { jest, describe, it, beforeAll, beforeEach, afterEach, expect } from "@jest/globals"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

import type { FullSlug } from "../../util/path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const dispatchNav = () =>
  document.dispatchEvent(new CustomEvent("nav", { detail: { url: "" as FullSlug } }))

// Hash function matching implementation
function hashContent(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

type WindowWithStates = Window & {
  __quartz_collapsible_states?: Map<string, boolean>
  __quartz_collapsible_id?: unknown
  __quartz_reset_collapsible_counts?: () => void
}

describe("admonition.inline collapsible state persistence", () => {
  beforeAll(() => new Function(readFileSync(join(__dirname, "admonition.inline.js"), "utf-8"))())

  beforeEach(() => {
    document.body.innerHTML = ""
    document.body.dataset.slug = "test-page"
    localStorage.clear()
    ;(window as WindowWithStates).__quartz_collapsible_states = new Map()

    // Set up fresh __quartz_collapsible_id with its own hash counts for each test
    const hashCounts = new Map<string, number>()
    ;(window as WindowWithStates).__quartz_collapsible_id = (slug: string, content: string) => {
      const hash = hashContent(content || "empty")
      const key = `${slug}-${hash}`
      const index = hashCounts.get(key) || 0
      hashCounts.set(key, index + 1)
      return `${slug}-collapsible-${hash}-${index}`
    }
    // Expose reset function for SPA navigation simulation
    ;(window as WindowWithStates).__quartz_reset_collapsible_counts = () => hashCounts.clear()
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
    localStorage.clear()
  })

  const createAdmonition = (collapsed = false, title = "Test Title", content = "Content") => {
    const admonition = document.createElement("blockquote")
    admonition.className = `admonition note is-collapsible${collapsed ? " is-collapsed" : ""}`
    admonition.innerHTML = `<div class="admonition-title">${title}</div><div class="admonition-content">${content}</div>`
    return admonition
  }

  it("assigns unique IDs based on content hash", () => {
    const admonition1 = createAdmonition(false, "First", "Content A")
    const admonition2 = createAdmonition(true, "Second", "Content B")
    document.body.append(admonition1, admonition2)
    dispatchNav()

    const hash1 = hashContent("FirstContent A")
    const hash2 = hashContent("SecondContent B")
    expect(admonition1.dataset.collapsibleId).toBe(`test-page-collapsible-${hash1}-0`)
    expect(admonition2.dataset.collapsibleId).toBe(`test-page-collapsible-${hash2}-0`)
  })

  it("assigns different indices to identical collapsibles", () => {
    const admonition1 = createAdmonition(false, "Quote", "Same content")
    const admonition2 = createAdmonition(false, "Quote", "Same content")
    document.body.append(admonition1, admonition2)
    dispatchNav()

    const hash = hashContent("QuoteSame content")
    expect(admonition1.dataset.collapsibleId).toBe(`test-page-collapsible-${hash}-0`)
    expect(admonition2.dataset.collapsibleId).toBe(`test-page-collapsible-${hash}-1`)
  })

  it("generates consistent IDs for same content regardless of position", () => {
    // Create two different admonitions
    const admonitionA = createAdmonition(false, "Note A", "Content A")
    const admonitionB = createAdmonition(false, "Note B", "Content B")
    document.body.append(admonitionA, admonitionB)
    dispatchNav()
    const idA = admonitionA.dataset.collapsibleId
    const idB = admonitionB.dataset.collapsibleId

    // Swap order and recreate
    document.body.innerHTML = ""
    const admonitionB2 = createAdmonition(false, "Note B", "Content B")
    const admonitionA2 = createAdmonition(false, "Note A", "Content A")
    document.body.append(admonitionB2, admonitionA2)
    dispatchNav()

    // IDs should match based on content, not position
    expect(admonitionA2.dataset.collapsibleId).toBe(idA)
    expect(admonitionB2.dataset.collapsibleId).toBe(idB)
  })

  it.each([
    ["closing", false, "true", true],
    ["opening", true, "false", false],
  ])("saves state to localStorage when %s", (_, startCollapsed, expectedStorage, expectedClass) => {
    const admonition = createAdmonition(startCollapsed, "Note", "Body")
    document.body.appendChild(admonition)
    dispatchNav()
    if (startCollapsed) admonition.click()
    else admonition.querySelector<HTMLElement>(".admonition-title")!.click()

    const hash = hashContent("NoteBody")
    expect(localStorage.getItem(`test-page-collapsible-${hash}-0`)).toBe(expectedStorage)
    expect(admonition.classList.contains("is-collapsed")).toBe(expectedClass)
  })

  it.each([
    ["collapsed", true, false, true],
    ["expanded", false, true, false],
  ])("restores %s state from cache", (_, savedState, htmlCollapsed, expectedCollapsed) => {
    const hash = hashContent("NoteBody")
    const states = new Map([[`test-page-collapsible-${hash}-0`, savedState]])
    ;(window as WindowWithStates).__quartz_collapsible_states = states
    const admonition = createAdmonition(htmlCollapsed, "Note", "Body")
    document.body.appendChild(admonition)
    dispatchNav()
    expect(admonition.classList.contains("is-collapsed")).toBe(expectedCollapsed)
  })

  it("keeps default HTML state when no saved state", () => {
    const expandedAdmonition = createAdmonition(false, "A", "Content A")
    const collapsedAdmonition = createAdmonition(true, "B", "Content B")
    document.body.append(expandedAdmonition, collapsedAdmonition)
    dispatchNav()
    expect(expandedAdmonition.classList.contains("is-collapsed")).toBe(false)
    expect(collapsedAdmonition.classList.contains("is-collapsed")).toBe(true)
  })

  it("updates cache when toggling", () => {
    const states = new Map<string, boolean>()
    ;(window as WindowWithStates).__quartz_collapsible_states = states
    const admonition = createAdmonition(false, "Note", "Body")
    document.body.appendChild(admonition)
    dispatchNav()
    admonition.querySelector<HTMLElement>(".admonition-title")!.click()

    const hash = hashContent("NoteBody")
    expect(states.get(`test-page-collapsible-${hash}-0`)).toBe(true)
  })

  it("handles multiple admonitions with different states", () => {
    const hashAlpha = hashContent("AlphaContent Alpha")
    const hashBeta = hashContent("BetaContent Beta")
    const states = new Map([
      [`test-page-collapsible-${hashAlpha}-0`, false],
      [`test-page-collapsible-${hashBeta}-0`, true],
    ])
    ;(window as WindowWithStates).__quartz_collapsible_states = states
    const admonition1 = createAdmonition(true, "Alpha", "Content Alpha")
    const admonition2 = createAdmonition(false, "Beta", "Content Beta")
    document.body.append(admonition1, admonition2)
    dispatchNav()
    expect(admonition1.classList.contains("is-collapsed")).toBe(false)
    expect(admonition2.classList.contains("is-collapsed")).toBe(true)
  })

  it("handles missing __quartz_collapsible_states", () => {
    delete (window as WindowWithStates).__quartz_collapsible_states
    const admonition = createAdmonition(false, "Note", "Body")
    document.body.appendChild(admonition)
    expect(() => dispatchNav()).not.toThrow()

    const hash = hashContent("NoteBody")
    expect(admonition.dataset.collapsibleId).toBe(`test-page-collapsible-${hash}-0`)
  })

  it("only closes on title click, not content", () => {
    const admonition = createAdmonition(false, "Note", "Body")
    document.body.appendChild(admonition)
    dispatchNav()
    admonition.querySelector<HTMLElement>(".admonition-content")!.click()
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
  })

  it("handles admonition without title or content", () => {
    const admonition = document.createElement("blockquote")
    admonition.className = "admonition note is-collapsible"
    document.body.appendChild(admonition)
    expect(() => dispatchNav()).not.toThrow()

    const hash = hashContent("empty")
    expect(admonition.dataset.collapsibleId).toBe(`test-page-collapsible-${hash}-0`)
  })

  it("uses shared __quartz_collapsible_id when available", () => {
    const mockFn = jest.fn((slug: string, content: string) => `${slug}-mock-${content}`)
    ;(window as WindowWithStates).__quartz_collapsible_id = mockFn
    const admonition = createAdmonition(false, "Test", "Body")
    document.body.appendChild(admonition)
    dispatchNav()
    expect(mockFn).toHaveBeenCalledWith("test-page", "TestBody")
    expect(admonition.dataset.collapsibleId).toBe("test-page-mock-TestBody")
  })

  it("initializes __quartz_collapsible_states when saving if missing", () => {
    delete (window as WindowWithStates).__quartz_collapsible_states
    const admonition = createAdmonition(false, "Note", "Body")
    document.body.appendChild(admonition)
    dispatchNav()
    admonition.querySelector<HTMLElement>(".admonition-title")!.click()
    expect((window as WindowWithStates).__quartz_collapsible_states).toBeInstanceOf(Map)
  })
})
