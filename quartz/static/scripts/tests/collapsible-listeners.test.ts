/**
 * @jest-environment jsdom
 *
 * Regression test for memory leak fix in collapsible-listeners.js.
 * The bug: repeated nav events would add duplicate click handlers, causing
 * a single click to toggle the collapsible multiple times.
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

  const createCollapsible = (id: string) => {
    const collapsible = document.createElement("div")
    collapsible.className = "collapsible"
    collapsible.id = id

    const title = document.createElement("div")
    title.className = "collapsible-title"

    const foldIcon = document.createElement("span")
    foldIcon.className = "fold-icon"
    foldIcon.setAttribute("aria-expanded", "false")

    const content = document.createElement("div")
    content.className = "content"

    collapsible.appendChild(title)
    collapsible.appendChild(foldIcon)
    collapsible.appendChild(content)

    return collapsible
  }

  it("should not add duplicate handlers on repeated nav events", () => {
    const collapsible = createCollapsible("test-1")
    document.body.appendChild(collapsible)

    const content = collapsible.querySelector(".content") as HTMLElement
    const title = collapsible.querySelector(".collapsible-title") as HTMLElement

    // Fire nav event multiple times (simulates SPA navigation)
    dispatchNavEvent()
    dispatchNavEvent()
    dispatchNavEvent()

    // Click once - should toggle once, not 3 times
    // Before the fix, this would toggle 3 times (ending at false)
    expect(content.classList.contains("active")).toBe(false)
    title.click()
    expect(content.classList.contains("active")).toBe(true)
  })

  it("should track bound state with data attribute", () => {
    const collapsible = createCollapsible("test-2")
    document.body.appendChild(collapsible)

    expect(collapsible.dataset.collapsibleBound).toBeUndefined()

    dispatchNavEvent()

    expect(collapsible.dataset.collapsibleBound).toBe("true")
  })
})
