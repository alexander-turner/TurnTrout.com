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
const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(16).padStart(8, "0")
}
const expectedId = (title: string, body: string, idx = 0) =>
  `test-page-collapsible-${hash(title + body)}-${idx}`

type W = Window & {
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
    ;(window as W).__quartz_collapsible_states = new Map()
    const counts = new Map<string, number>()
    ;(window as W).__quartz_collapsible_id = (slug: string, content: string) => {
      const h = hash(content || "empty"),
        key = `${slug}-${h}`,
        idx = counts.get(key) || 0
      counts.set(key, idx + 1)
      return `${slug}-collapsible-${h}-${idx}`
    }
    ;(window as W).__quartz_reset_collapsible_counts = () => counts.clear()
  })

  afterEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = ""
    localStorage.clear()
  })

  const create = (collapsed = false, title = "Title", body = "Body") => {
    const admonition = document.createElement("blockquote")
    admonition.className = `admonition note is-collapsible${collapsed ? " is-collapsed" : ""}`
    admonition.innerHTML = `<div class="admonition-title">${title}</div><div class="admonition-content">${body}</div>`
    return admonition
  }

  it("assigns content-based IDs with index tiebreaker for duplicates", () => {
    const [first, second, duplicate] = [
      create(false, "A", "1"),
      create(false, "B", "2"),
      create(false, "A", "1"),
    ]
    document.body.append(first, second, duplicate)
    dispatchNav()
    expect(first.dataset.collapsibleId).toBe(expectedId("A", "1", 0))
    expect(second.dataset.collapsibleId).toBe(expectedId("B", "2", 0))
    expect(duplicate.dataset.collapsibleId).toBe(expectedId("A", "1", 1))
  })

  it("generates consistent IDs regardless of position", () => {
    const noteA = create(false, "A", "1")
    const noteB = create(false, "B", "2")
    document.body.append(noteA, noteB)
    dispatchNav()
    const [idA, idB] = [noteA.dataset.collapsibleId, noteB.dataset.collapsibleId]

    document.body.innerHTML = ""
    const [noteB2, noteA2] = [create(false, "B", "2"), create(false, "A", "1")]
    document.body.append(noteB2, noteA2) // Swapped order
    dispatchNav()
    expect(noteA2.dataset.collapsibleId).toBe(idA)
    expect(noteB2.dataset.collapsibleId).toBe(idB)
  })

  it.each([
    ["closing", false, true, "true"],
    ["opening", true, false, "false"],
  ])("saves/restores state when %s", (_, start, end, storage) => {
    const admonition = create(start, "N", "B")
    document.body.appendChild(admonition)
    dispatchNav()
    if (start) admonition.click()
    else admonition.querySelector<HTMLElement>(".admonition-title")!.click()
    expect(admonition.classList.contains("is-collapsed")).toBe(end)
    expect(localStorage.getItem(expectedId("N", "B"))).toBe(storage)
  })

  it.each([
    [true, false, true], // saved collapsed, html expanded → collapsed
    [false, true, false], // saved expanded, html collapsed → expanded
  ])("restores saved=%s over html=%s → %s", (saved, html, expected) => {
    ;(window as W).__quartz_collapsible_states = new Map([[expectedId("N", "B"), saved]])
    const admonition = create(html, "N", "B")
    document.body.appendChild(admonition)
    dispatchNav()
    expect(admonition.classList.contains("is-collapsed")).toBe(expected)
  })

  it("keeps default HTML state when no saved state", () => {
    const [expanded, collapsed] = [create(false, "A", "1"), create(true, "B", "2")]
    document.body.append(expanded, collapsed)
    dispatchNav()
    expect(expanded.classList.contains("is-collapsed")).toBe(false)
    expect(collapsed.classList.contains("is-collapsed")).toBe(true)
  })

  it("only closes on title click, not content click", () => {
    const admonition = create(false, "N", "B")
    document.body.appendChild(admonition)
    dispatchNav()
    admonition.querySelector<HTMLElement>(".admonition-content")!.click()
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
  })

  it.each([
    ["missing states map", () => delete (window as W).__quartz_collapsible_states],
    ["empty admonition", () => {}],
  ])("handles edge case: %s", (name, setup) => {
    setup()
    const admonition =
      name === "empty admonition"
        ? Object.assign(document.createElement("blockquote"), {
            className: "admonition note is-collapsible",
          })
        : create(false, "N", "B")
    document.body.appendChild(admonition)
    expect(() => dispatchNav()).not.toThrow()
    expect(admonition.dataset.collapsibleId).toMatch(/^test-page-collapsible-[0-9a-f]{8}-0$/)
  })

  it("uses shared __quartz_collapsible_id and initializes states map on save", () => {
    const mock = jest.fn((slug: string, content: string) => `${slug}-mock-${content}`)
    ;(window as W).__quartz_collapsible_id = mock
    delete (window as W).__quartz_collapsible_states
    const admonition = create(false, "T", "B")
    document.body.appendChild(admonition)
    dispatchNav()
    expect(mock).toHaveBeenCalledWith("test-page", "TB")
    admonition.querySelector<HTMLElement>(".admonition-title")!.click()
    expect((window as W).__quartz_collapsible_states).toBeInstanceOf(Map)
  })

  describe("stress tests", () => {
    it("handles 100 unique collapsibles with unique IDs", () => {
      for (let i = 0; i < 100; i++) document.body.appendChild(create(false, `T${i}`, `C${i}`))
      dispatchNav()
      const ids = [...document.querySelectorAll<HTMLElement>("[data-collapsible-id]")].map(
        (e) => e.dataset.collapsibleId,
      )
      expect(ids).toHaveLength(100)
      expect(new Set(ids).size).toBe(100)
    })

    it("handles 50 identical collapsibles with sequential indices", () => {
      for (let i = 0; i < 50; i++) document.body.appendChild(create(false, "Q", "S"))
      dispatchNav()
      const ids = [...document.querySelectorAll<HTMLElement>("[data-collapsible-id]")].map(
        (e) => e.dataset.collapsibleId,
      )
      expect(ids).toHaveLength(50)
      ids.forEach((id, i) => expect(id).toBe(`test-page-collapsible-${hash("QS")}-${i}`))
    })

    it.each([
      [
        "rapid toggles",
        () => {
          const admonition = create(false, "T", "X")
          document.body.appendChild(admonition)
          dispatchNav()
          const title = admonition.querySelector<HTMLElement>(".admonition-title")!
          for (let i = 0; i < 50; i++) {
            title.click()
            admonition.click()
          }
          expect(admonition.classList.contains("is-collapsed")).toBe(false)
        },
      ],
      [
        "large content (10KB) with unicode",
        () => {
          const admonition = create(false, "日本語🎉", "x".repeat(10000) + "العربية")
          document.body.appendChild(admonition)
          dispatchNav()
          expect(admonition.dataset.collapsibleId).toMatch(/^test-page-collapsible-[0-9a-f]{8}-0$/)
        },
      ],
      [
        "SPA navigation preserves ID for same content",
        () => {
          const admonition1 = create(false, "Note", "Content")
          document.body.appendChild(admonition1)
          dispatchNav()
          const id1 = admonition1.dataset.collapsibleId
          document.body.innerHTML = ""
          const admonition2 = create(false, "Note", "Content")
          document.body.appendChild(admonition2)
          dispatchNav()
          expect(admonition2.dataset.collapsibleId).toBe(id1)
        },
      ],
      [
        "similar content produces different hashes",
        () => {
          const [titleAB, titleA] = [create(false, "AB", "C"), create(false, "A", "BC")]
          document.body.append(titleAB, titleA)
          dispatchNav()
          expect(titleAB.dataset.collapsibleId).not.toBe(titleA.dataset.collapsibleId)
        },
      ],
    ])("handles %s", (_, testFn) => testFn())
  })
})
