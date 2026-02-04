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
const expectedId = (slug: string, title: string) =>
  `${slug}-collapsible-${(title || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)}`

type WindowWithStates = Window & {
  __quartz_collapsible_states?: Map<string, boolean>
  __quartz_collapsible_id?: unknown
}

describe("admonition.inline collapsible state persistence", () => {
  beforeAll(() => new Function(readFileSync(join(__dirname, "admonition.inline.js"), "utf-8"))())

  beforeEach(() => {
    document.body.innerHTML = ""
    document.body.dataset.slug = "test-page"
    localStorage.clear()
    ;(window as WindowWithStates).__quartz_collapsible_states = new Map()
    delete (window as WindowWithStates).__quartz_collapsible_id
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
    localStorage.clear()
  })

  const createAdmonition = (collapsed = false, title = "Test Title") => {
    const admonition = document.createElement("blockquote")
    admonition.className = `admonition note is-collapsible${collapsed ? " is-collapsed" : ""}`
    admonition.innerHTML = `<div class="admonition-title">${title}</div><div class="admonition-content">Content</div>`
    return admonition
  }

  it("assigns unique IDs based on slug and title", () => {
    const admonition1 = createAdmonition(false, "First")
    const admonition2 = createAdmonition(true, "Second")
    document.body.append(admonition1, admonition2)
    dispatchNav()
    expect(admonition1.dataset.collapsibleId).toBe(expectedId("test-page", "First"))
    expect(admonition2.dataset.collapsibleId).toBe(expectedId("test-page", "Second"))
  })

  it("generates consistent IDs regardless of order", () => {
    const admonition1 = createAdmonition(false, "My Admonition")
    document.body.appendChild(admonition1)
    dispatchNav()
    const id = admonition1.dataset.collapsibleId
    document.body.innerHTML = ""
    const admonition2 = createAdmonition(false, "My Admonition")
    document.body.appendChild(admonition2)
    dispatchNav()
    expect(admonition2.dataset.collapsibleId).toBe(id)
  })

  it.each([
    ["closing", false, "true", true],
    ["opening", true, "false", false],
  ])("saves state to localStorage when %s", (_, startCollapsed, expectedStorage, expectedClass) => {
    const admonition = createAdmonition(startCollapsed, "Note")
    document.body.appendChild(admonition)
    dispatchNav()
    if (startCollapsed) admonition.click()
    else admonition.querySelector<HTMLElement>(".admonition-title")!.click()
    expect(localStorage.getItem(expectedId("test-page", "Note"))).toBe(expectedStorage)
    expect(admonition.classList.contains("is-collapsed")).toBe(expectedClass)
  })

  it.each([
    ["collapsed", true, false, true],
    ["expanded", false, true, false],
  ])("restores %s state from cache", (_, savedState, htmlCollapsed, expectedCollapsed) => {
    const states = new Map([["test-page-collapsible-note", savedState]])
    ;(window as WindowWithStates).__quartz_collapsible_states = states
    const admonition = createAdmonition(htmlCollapsed, "Note")
    document.body.appendChild(admonition)
    dispatchNav()
    expect(admonition.classList.contains("is-collapsed")).toBe(expectedCollapsed)
  })

  it("keeps default HTML state when no saved state", () => {
    const expandedAdmonition = createAdmonition(false, "A")
    const collapsedAdmonition = createAdmonition(true, "B")
    document.body.append(expandedAdmonition, collapsedAdmonition)
    dispatchNav()
    expect(expandedAdmonition.classList.contains("is-collapsed")).toBe(false)
    expect(collapsedAdmonition.classList.contains("is-collapsed")).toBe(true)
  })

  it("updates cache when toggling", () => {
    const states = new Map<string, boolean>()
    ;(window as WindowWithStates).__quartz_collapsible_states = states
    const admonition = createAdmonition(false, "Note")
    document.body.appendChild(admonition)
    dispatchNav()
    admonition.querySelector<HTMLElement>(".admonition-title")!.click()
    expect(states.get(expectedId("test-page", "Note"))).toBe(true)
  })

  it("handles multiple admonitions with different states", () => {
    const states = new Map([
      ["test-page-collapsible-alpha", false],
      ["test-page-collapsible-beta", true],
    ])
    ;(window as WindowWithStates).__quartz_collapsible_states = states
    const admonition1 = createAdmonition(true, "Alpha")
    const admonition2 = createAdmonition(false, "Beta")
    document.body.append(admonition1, admonition2)
    dispatchNav()
    expect(admonition1.classList.contains("is-collapsed")).toBe(false)
    expect(admonition2.classList.contains("is-collapsed")).toBe(true)
  })

  it("handles missing __quartz_collapsible_states", () => {
    delete (window as WindowWithStates).__quartz_collapsible_states
    const admonition = createAdmonition(false, "Note")
    document.body.appendChild(admonition)
    expect(() => dispatchNav()).not.toThrow()
    expect(admonition.dataset.collapsibleId).toBe(expectedId("test-page", "Note"))
  })

  it("only closes on title click, not content", () => {
    const admonition = createAdmonition(false, "Note")
    document.body.appendChild(admonition)
    dispatchNav()
    admonition.querySelector<HTMLElement>(".admonition-content")!.click()
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
  })

  it("handles admonition without title", () => {
    const admonition = document.createElement("blockquote")
    admonition.className = "admonition note is-collapsible"
    document.body.appendChild(admonition)
    expect(() => dispatchNav()).not.toThrow()
    expect(admonition.dataset.collapsibleId).toBe(expectedId("test-page", ""))
  })

  it("normalizes special characters in titles", () => {
    const admonition = createAdmonition(false, "Test! @#$% Title (with) [special] chars")
    document.body.appendChild(admonition)
    dispatchNav()
    expect(admonition.dataset.collapsibleId).toBe(
      "test-page-collapsible-test-title-with-special-chars",
    )
  })

  it("uses shared __quartz_collapsible_id when available", () => {
    const mockFn = jest.fn((slug: string, title: string) => `${slug}-mock-${title}`)
    ;(window as WindowWithStates).__quartz_collapsible_id = mockFn
    const admonition = createAdmonition(false, "Test")
    document.body.appendChild(admonition)
    dispatchNav()
    expect(mockFn).toHaveBeenCalledWith("test-page", "Test")
    expect(admonition.dataset.collapsibleId).toBe("test-page-mock-Test")
  })

  it("initializes __quartz_collapsible_states when saving if missing", () => {
    delete (window as WindowWithStates).__quartz_collapsible_states
    const admonition = createAdmonition(false, "Note")
    document.body.appendChild(admonition)
    dispatchNav()
    admonition.querySelector<HTMLElement>(".admonition-title")!.click()
    expect((window as WindowWithStates).__quartz_collapsible_states).toBeInstanceOf(Map)
  })
})
