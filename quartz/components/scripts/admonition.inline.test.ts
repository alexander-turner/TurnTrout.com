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
    const el = document.createElement("blockquote")
    el.className = `admonition note is-collapsible${collapsed ? " is-collapsed" : ""}`
    el.innerHTML = `<div class="admonition-title">${title}</div><div class="admonition-content">${body}</div>`
    return el
  }

  it("assigns content-based IDs with index tiebreaker for duplicates", () => {
    const [a, b, c] = [create(false, "A", "1"), create(false, "B", "2"), create(false, "A", "1")]
    document.body.append(a, b, c)
    dispatchNav()
    expect(a.dataset.collapsibleId).toBe(expectedId("A", "1", 0))
    expect(b.dataset.collapsibleId).toBe(expectedId("B", "2", 0))
    expect(c.dataset.collapsibleId).toBe(expectedId("A", "1", 1)) // Same content, different index
  })

  it("generates consistent IDs regardless of position", () => {
    const a = create(false, "A", "1"),
      b = create(false, "B", "2")
    document.body.append(a, b)
    dispatchNav()
    const [idA, idB] = [a.dataset.collapsibleId, b.dataset.collapsibleId]
    document.body.innerHTML = ""
    const [b2, a2] = [create(false, "B", "2"), create(false, "A", "1")]
    document.body.append(b2, a2) // Swapped order
    dispatchNav()
    expect(a2.dataset.collapsibleId).toBe(idA)
    expect(b2.dataset.collapsibleId).toBe(idB)
  })

  it.each([
    ["closing", false, true, "true"],
    ["opening", true, false, "false"],
  ])("saves/restores state when %s", (_, start, end, storage) => {
    const el = create(start, "N", "B")
    document.body.appendChild(el)
    dispatchNav()
    if (start) el.click()
    else el.querySelector<HTMLElement>(".admonition-title")!.click()
    expect(el.classList.contains("is-collapsed")).toBe(end)
    expect(localStorage.getItem(expectedId("N", "B"))).toBe(storage)
  })

  it.each([
    [true, false, true], // saved collapsed, html expanded → collapsed
    [false, true, false], // saved expanded, html collapsed → expanded
  ])("restores saved=%s over html=%s → %s", (saved, html, expected) => {
    ;(window as W).__quartz_collapsible_states = new Map([[expectedId("N", "B"), saved]])
    const el = create(html, "N", "B")
    document.body.appendChild(el)
    dispatchNav()
    expect(el.classList.contains("is-collapsed")).toBe(expected)
  })

  it("keeps default HTML state when no saved state", () => {
    const [expanded, collapsed] = [create(false, "A", "1"), create(true, "B", "2")]
    document.body.append(expanded, collapsed)
    dispatchNav()
    expect(expanded.classList.contains("is-collapsed")).toBe(false)
    expect(collapsed.classList.contains("is-collapsed")).toBe(true)
  })

  it("only closes on title click, not content click", () => {
    const el = create(false, "N", "B")
    document.body.appendChild(el)
    dispatchNav()
    el.querySelector<HTMLElement>(".admonition-content")!.click()
    expect(el.classList.contains("is-collapsed")).toBe(false)
  })

  it.each([
    ["missing states map", () => delete (window as W).__quartz_collapsible_states],
    ["empty admonition", () => {}],
  ])("handles edge case: %s", (_, setup) => {
    setup()
    const el =
      _ === "empty admonition"
        ? Object.assign(document.createElement("blockquote"), {
            className: "admonition note is-collapsible",
          })
        : create(false, "N", "B")
    document.body.appendChild(el)
    expect(() => dispatchNav()).not.toThrow()
    expect(el.dataset.collapsibleId).toMatch(/^test-page-collapsible-[0-9a-f]{8}-0$/)
  })

  it("uses shared __quartz_collapsible_id and initializes states map on save", () => {
    const mock = jest.fn((slug: string, c: string) => `${slug}-mock-${c}`)
    ;(window as W).__quartz_collapsible_id = mock
    delete (window as W).__quartz_collapsible_states
    const el = create(false, "T", "B")
    document.body.appendChild(el)
    dispatchNav()
    expect(mock).toHaveBeenCalledWith("test-page", "TB")
    el.querySelector<HTMLElement>(".admonition-title")!.click()
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

    it("handles rapid toggles, large content, unicode, SPA nav, similar content", () => {
      // Rapid toggles
      let el = create(false, "T", "X")
      document.body.appendChild(el)
      dispatchNav()
      const title = el.querySelector<HTMLElement>(".admonition-title")!
      for (let i = 0; i < 50; i++) {
        title.click()
        el.click()
      }
      expect(el.classList.contains("is-collapsed")).toBe(false)

      // Large content + unicode
      document.body.innerHTML = ""
      el = create(false, "日本語🎉", "x".repeat(10000) + "العربية")
      document.body.appendChild(el)
      dispatchNav()
      expect(el.dataset.collapsibleId).toMatch(/^test-page-collapsible-[0-9a-f]{8}-0$/)

      // SPA nav preserves ID for same content
      const id1 = el.dataset.collapsibleId
      document.body.innerHTML = ""
      el = create(false, "日本語🎉", "x".repeat(10000) + "العربية")
      document.body.appendChild(el)
      dispatchNav()
      expect(el.dataset.collapsibleId).toBe(id1)

      // Similar content produces different hashes
      document.body.innerHTML = ""
      const [ab, ba] = [create(false, "AB", "C"), create(false, "A", "BC")]
      document.body.append(ab, ba)
      dispatchNav()
      expect(ab.dataset.collapsibleId).not.toBe(ba.dataset.collapsibleId)
    })
  })
})
