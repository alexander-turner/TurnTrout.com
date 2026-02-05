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
const djb2Hash = (str: string) => {
  let hashValue = 5381
  for (let i = 0; i < str.length; i++)
    hashValue = ((hashValue << 5) + hashValue) ^ str.charCodeAt(i)
  return (hashValue >>> 0).toString(16).padStart(8, "0")
}
const expectedId = (title: string, body: string, index = 0) =>
  `test-page-collapsible-${djb2Hash(title + body)}-${index}`

type W = Window & {
  __quartz_collapsible_states?: Map<string, boolean>
  __quartz_collapsible_id?: (slug: string, content: string) => string
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
      const contentHash = djb2Hash(content || "empty")
      const key = `${slug}-${contentHash}`
      const index = counts.get(key) || 0
      counts.set(key, index + 1)
      return `${slug}-collapsible-${contentHash}-${index}`
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
  const clickTitle = (el: Element) => el.querySelector<HTMLElement>(".admonition-title")?.click()

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

  it("generates consistent IDs regardless of position (SPA navigation)", () => {
    const [noteA, noteB] = [create(false, "A", "1"), create(false, "B", "2")]
    document.body.append(noteA, noteB)
    dispatchNav()
    const [idA, idB] = [noteA.dataset.collapsibleId, noteB.dataset.collapsibleId]
    document.body.innerHTML = ""
    const [noteB2, noteA2] = [create(false, "B", "2"), create(false, "A", "1")]
    document.body.append(noteB2, noteA2)
    dispatchNav()
    expect([noteA2.dataset.collapsibleId, noteB2.dataset.collapsibleId]).toEqual([idA, idB])
  })

  it.each([
    ["closing (title click)", false, true, "true"],
    ["opening (body click)", true, false, "false"],
  ])("saves state when %s", (_, startCollapsed, endCollapsed, storageValue) => {
    const admonition = create(startCollapsed, "N", "B")
    document.body.appendChild(admonition)
    dispatchNav()
    if (startCollapsed) admonition.click()
    else clickTitle(admonition)
    expect(admonition.classList.contains("is-collapsed")).toBe(endCollapsed)
    expect(localStorage.getItem(expectedId("N", "B"))).toBe(storageValue)
  })

  it.each([
    [true, false, true],
    [false, true, false],
  ])("restores saved=%s overriding html=%s", (saved, html, expected) => {
    ;(window as W).__quartz_collapsible_states = new Map([[expectedId("N", "B"), saved]])
    const admonition = create(html, "N", "B")
    document.body.appendChild(admonition)
    dispatchNav()
    expect(admonition.classList.contains("is-collapsed")).toBe(expected)
  })

  it("keeps default HTML state when no saved state", () => {
    document.body.append(create(false, "A", "1"), create(true, "B", "2"))
    dispatchNav()
    const els = document.querySelectorAll(".admonition")
    expect(els[0].classList.contains("is-collapsed")).toBe(false)
    expect(els[1].classList.contains("is-collapsed")).toBe(true)
  })

  it("only closes on title click, not content click", () => {
    const admonition = create(false, "N", "B")
    document.body.appendChild(admonition)
    dispatchNav()
    admonition.querySelector<HTMLElement>(".admonition-content")?.click()
    expect(admonition.classList.contains("is-collapsed")).toBe(false)
  })

  it.each([
    [
      "missing states map",
      () => delete (window as W).__quartz_collapsible_states,
      create(false, "N", "B"),
    ],
    [
      "empty admonition",
      () => {},
      Object.assign(document.createElement("blockquote"), {
        className: "admonition note is-collapsible",
      }),
    ],
  ])("handles %s gracefully", (_, setup, admonition) => {
    setup()
    document.body.appendChild(admonition)
    expect(() => dispatchNav()).not.toThrow()
    expect(admonition.dataset.collapsibleId).toMatch(/^test-page-collapsible-[0-9a-f]{8}-0$/)
  })

  it("initializes states map on save if missing", () => {
    delete (window as W).__quartz_collapsible_states
    const admonition = create(false, "T", "B")
    document.body.appendChild(admonition)
    dispatchNav()
    clickTitle(admonition)
    expect((window as W).__quartz_collapsible_states).toBeInstanceOf(Map)
  })

  describe("stress tests", () => {
    it.each([
      [
        100,
        (i: number) => [`T${i}`, `C${i}`],
        (ids: string[]) => expect(new Set(ids).size).toBe(100),
      ],
      [
        50,
        () => ["Q", "S"],
        (ids: string[]) =>
          ids.forEach((id, i) => expect(id).toBe(`test-page-collapsible-${djb2Hash("QS")}-${i}`)),
      ],
    ])("handles %i collapsibles correctly", (count, getContent, verify) => {
      for (let i = 0; i < count; i++) {
        const [title, body] = getContent(i)
        document.body.appendChild(create(false, title, body))
      }
      dispatchNav()
      const ids = [...document.querySelectorAll<HTMLElement>("[data-collapsible-id]")].map(
        (el) => el.dataset.collapsibleId!,
      )
      expect(ids).toHaveLength(count)
      verify(ids)
    })

    it("handles rapid toggles, large unicode content, and similar-content disambiguation", () => {
      // Rapid toggles
      const admonition = create(false, "T", "X")
      document.body.appendChild(admonition)
      dispatchNav()
      for (let i = 0; i < 50; i++) {
        clickTitle(admonition)
        admonition.click()
      }
      expect(admonition.classList.contains("is-collapsed")).toBe(false)

      // Large unicode content
      document.body.innerHTML = ""
      const unicode = create(false, "日本語🎉", `${"x".repeat(10000)}العربية`)
      document.body.appendChild(unicode)
      dispatchNav()
      expect(unicode.dataset.collapsibleId).toMatch(/^test-page-collapsible-[0-9a-f]{8}-0$/)

      // Similar content produces different hashes
      document.body.innerHTML = ""
      const [ab, ba] = [create(false, "AB", "C"), create(false, "A", "BC")]
      document.body.append(ab, ba)
      dispatchNav()
      expect(ab.dataset.collapsibleId).not.toBe(ba.dataset.collapsibleId)
    })
  })
})
