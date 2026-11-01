/**
 * @jest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import { NOWRAP_SPAN_CLASS, WIDE_INLINE_CLASS } from "../constants"
import { markWideInlines, markWideInlinesOnResize } from "./wide-inline"

const rectAt = (middle: number) => ({ top: middle - 5, bottom: middle + 5 }) as DOMRect

/** Inline math whose bases sit at the given vertical midpoints, in a 20px font. */
function buildMath(middles: readonly number[], parent: HTMLElement = document.body): HTMLElement {
  const katex = document.createElement("span")
  katex.className = "katex"
  const html = document.createElement("span")
  html.className = "katex-html"
  html.style.fontSize = "20px"
  for (const middle of middles) {
    const base = document.createElement("span")
    base.className = "base"
    jest.spyOn(base, "getBoundingClientRect").mockReturnValue(rectAt(middle))
    html.appendChild(base)
  }
  katex.appendChild(html)
  parent.appendChild(katex)
  return html
}

/** An inline code path whose text lays out in fragments at the given midpoints. */
function buildPath(middles: readonly number[], parent: HTMLElement = document.body): HTMLElement {
  const code = document.createElement("code")
  code.className = "inline-code-path"
  code.style.fontSize = "20px"
  code.textContent = "owner/repo"
  parent.appendChild(code)
  // jsdom lays nothing out, so the range reports the fragments directly.
  const range = {
    selectNodeContents: jest.fn(),
    getClientRects: () => middles.map(rectAt),
  } as unknown as Range
  jest.spyOn(document, "createRange").mockReturnValue(range)
  return code
}

afterEach(() => {
  document.body.innerHTML = ""
  jest.restoreAllMocks()
})

describe("markWideInlines", () => {
  it.each([
    ["bases on one row", [10, 10, 10], false],
    ["bases offset by less than half the font size", [10, 19], false],
    ["a last base on a later row", [10, 10, 40], true],
    ["a single base", [10], false],
  ])("with %s, marks math wide: %s", (_label, middles, wide) => {
    const html = buildMath(middles)
    markWideInlines(document.body)
    expect(html.classList.contains(WIDE_INLINE_CLASS)).toBe(wide)
  })

  it.each([
    ["text on one row", [10], false],
    ["text on two rows", [10, 40], true],
  ])("with %s, marks a code path wide: %s", (_label, middles, wide) => {
    const code = buildPath(middles)
    markWideInlines(document.body)
    expect(code.classList.contains(WIDE_INLINE_CLASS)).toBe(wide)
  })

  /**
   * A one-row code path glued to a period, in a paragraph whose content ends
   * 10px inside its 100px border box, with the glued span laid out in `rows`.
   */
  function buildGluedPath(rows: readonly Partial<DOMRect>[]): HTMLElement {
    const paragraph = document.createElement("p")
    paragraph.style.paddingRight = "6px"
    paragraph.style.borderRight = "4px solid"
    jest.spyOn(paragraph, "getBoundingClientRect").mockReturnValue({ right: 100 } as DOMRect)
    const glued = document.createElement("span")
    glued.className = NOWRAP_SPAN_CLASS
    // jsdom applies no user-agent display, so the span declares its own.
    glued.style.display = "inline"
    jest.spyOn(glued, "getClientRects").mockReturnValue(rows as unknown as DOMRectList)
    const link = document.createElement("a")
    glued.append(link, ".")
    paragraph.appendChild(glued)
    document.body.appendChild(paragraph)
    return buildPath([10], link)
  }

  it.each([
    ["inside the column", [{ right: 90, width: 50 }], false],
    ["past the column's content edge", [{ right: 91, width: 50 }], true],
    [
      "broken across two rows",
      [
        { right: 80, width: 50 },
        { right: 20, width: 10 },
      ],
      true,
    ],
    [
      "after an empty fragment",
      [
        { right: 60, width: 0 },
        { right: 50, width: 50 },
      ],
      false,
    ],
  ])("with its glued period %s, marks a code path wide: %s", (_label, rows, wide) => {
    const code = buildGluedPath(rows)
    markWideInlines(document.body)
    expect(code.classList.contains(WIDE_INLINE_CLASS)).toBe(wide)
  })

  it("unmarks a box that fits once remeasured", () => {
    const html = buildMath([10, 10])
    html.classList.add(WIDE_INLINE_CLASS)
    markWideInlines(document.body)
    expect(html.classList.contains(WIDE_INLINE_CLASS)).toBe(false)
  })

  it("leaves display math alone", () => {
    const display = document.createElement("span")
    display.className = "katex-display"
    document.body.appendChild(display)
    const html = buildMath([10, 40], display)
    markWideInlines(document.body)
    expect(html.classList.contains(WIDE_INLINE_CLASS)).toBe(false)
  })
})

describe("markWideInlinesOnResize", () => {
  const resizeTo = (width: number) => {
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true })
    window.dispatchEvent(new Event("resize"))
  }

  beforeEach(() => resizeTo(1024))

  it("marks the boxes, then re-marks them only when the viewport's width changes", () => {
    const html = buildMath([10, 40])
    const stop = markWideInlinesOnResize(document.body)
    expect(html.classList.contains(WIDE_INLINE_CLASS)).toBe(true)

    html.classList.remove(WIDE_INLINE_CLASS)
    resizeTo(1024)
    expect(html.classList.contains(WIDE_INLINE_CLASS)).toBe(false)

    resizeTo(500)
    expect(html.classList.contains(WIDE_INLINE_CLASS)).toBe(true)

    stop()
    html.classList.remove(WIDE_INLINE_CLASS)
    resizeTo(400)
    expect(html.classList.contains(WIDE_INLINE_CLASS)).toBe(false)
  })
})
