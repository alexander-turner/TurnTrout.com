/**
 * @jest-environment jest-fixed-jsdom
 */

import { describe, expect, it, jest } from "@jest/globals"

import {
  type AutoScrollMetrics,
  computeAutoScrollTop,
  getScrolloffAnchors,
  scrollActiveTocLinkIntoView,
} from "../toc-autoscroll-utils"

const baseMetrics: AutoScrollMetrics = {
  scrollTop: 0,
  clientHeight: 100,
  scrollHeight: 500,
  aboveAnchorTop: 0,
  activeTop: 0,
  activeBottom: 0,
  belowAnchorBottom: 0,
  padding: 8,
}

describe("computeAutoScrollTop", () => {
  const cases: ReadonlyArray<{
    label: string
    metrics: Partial<AutoScrollMetrics>
    expected: number | null
  }> = [
    { label: "no overflow → null", metrics: { scrollHeight: 100 }, expected: null },
    {
      label: "already visible → null",
      metrics: { aboveAnchorTop: 20, activeTop: 40, activeBottom: 50, belowAnchorBottom: 70 },
      expected: null,
    },
    {
      label: "scroll down",
      metrics: { aboveAnchorTop: 120, activeTop: 130, activeBottom: 140, belowAnchorBottom: 150 },
      expected: 58,
    },
    {
      label: "scroll up",
      metrics: {
        scrollTop: 200,
        aboveAnchorTop: 150,
        activeTop: 160,
        activeBottom: 170,
        belowAnchorBottom: 185,
      },
      expected: 142,
    },
    {
      label: "up-rule wins over down-rule",
      metrics: {
        scrollTop: 100,
        aboveAnchorTop: 50,
        activeTop: 60,
        activeBottom: 70,
        belowAnchorBottom: 250,
      },
      expected: 42,
    },
    {
      label: "rule 3 keeps the active link's top visible",
      metrics: {
        scrollHeight: 1000,
        aboveAnchorTop: 290,
        activeTop: 300,
        activeBottom: 500,
        belowAnchorBottom: 510,
      },
      expected: 292,
    },
    {
      label: "clamp at 0",
      metrics: {
        scrollTop: 50,
        aboveAnchorTop: 2,
        activeTop: 5,
        activeBottom: 15,
        belowAnchorBottom: 40,
      },
      expected: 0,
    },
    {
      label: "clamp at maxScroll",
      metrics: {
        scrollHeight: 200,
        aboveAnchorTop: 250,
        activeTop: 260,
        activeBottom: 270,
        belowAnchorBottom: 300,
      },
      expected: 100,
    },
    {
      label: "sub-pixel delta → null",
      metrics: {
        scrollTop: 57.5,
        aboveAnchorTop: 120,
        activeTop: 130,
        activeBottom: 140,
        belowAnchorBottom: 150,
      },
      expected: null,
    },
  ]

  it.each(cases)("$label", ({ metrics, expected }) => {
    expect(computeAutoScrollTop({ ...baseMetrics, ...metrics })).toBe(expected)
  })
})

describe("getScrolloffAnchors", () => {
  const items = ["a", "b", "c", "d", "e"] as const

  it.each`
    label                  | activeIndex | expectedAbove | expectedBelow
    ${"mid-list"}          | ${2}        | ${"a"}        | ${"e"}
    ${"clamps near start"} | ${0}        | ${"a"}        | ${"c"}
    ${"clamps near end"}   | ${4}        | ${"c"}        | ${"e"}
  `("$label", ({ activeIndex, expectedAbove, expectedBelow }) => {
    expect(getScrolloffAnchors(items, activeIndex as number, 2)).toEqual({
      above: expectedAbove,
      below: expectedBelow,
    })
  })

  it("returns the sole item for both anchors in a single-item list", () => {
    expect(getScrolloffAnchors(["only"], 0, 2)).toEqual({ above: "only", below: "only" })
  })

  it("throws on an empty list", () => {
    expect(() => getScrolloffAnchors([], 0, 2)).toThrow("items is empty")
  })
})

function mockRect(el: HTMLElement, top: number, bottom: number): void {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: 0,
      width: 0,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON: () => "",
    }) as DOMRect
}

function defineNumber(el: HTMLElement, prop: string, value: number): void {
  Object.defineProperty(el, prop, { value, configurable: true })
}

function makeSidebar(scrollTop: number, clientHeight: number, scrollHeight: number): HTMLElement {
  const sidebar = document.createElement("aside")
  defineNumber(sidebar, "scrollTop", scrollTop)
  defineNumber(sidebar, "clientHeight", clientHeight)
  defineNumber(sidebar, "scrollHeight", scrollHeight)
  mockRect(sidebar, 0, clientHeight)
  sidebar.scrollTo = jest.fn()
  return sidebar
}

function makeLinks(rects: readonly [number, number][]): HTMLAnchorElement[] {
  return rects.map(([top, bottom]) => {
    const link = document.createElement("a")
    mockRect(link, top, bottom)
    return link
  })
}

describe("scrollActiveTocLinkIntoView", () => {
  it("is a no-op when the sidebar does not overflow", () => {
    const sidebar = makeSidebar(0, 100, 100)
    scrollActiveTocLinkIntoView(sidebar, makeLinks([[0, 10]]), 0, "auto")
    expect(sidebar.scrollTo).not.toHaveBeenCalled()
  })

  it("does not scroll when the active link is already in view", () => {
    const sidebar = makeSidebar(0, 100, 500)
    const links = makeLinks([
      [10, 20],
      [20, 30],
      [30, 40],
      [40, 50],
      [50, 60],
      [60, 70],
      [70, 80],
    ])
    scrollActiveTocLinkIntoView(sidebar, links, 3, "auto")
    expect(sidebar.scrollTo).not.toHaveBeenCalled()
  })

  it("scrolls down to the computed position with the requested behavior", () => {
    const sidebar = makeSidebar(0, 100, 500)
    const links = makeLinks([
      [10, 20],
      [30, 40],
      [40, 50],
      [40, 50],
      [50, 60],
      [95, 105],
      [110, 120],
    ])
    scrollActiveTocLinkIntoView(sidebar, links, 3, "auto")
    expect(sidebar.scrollTo).toHaveBeenCalledWith({ top: 13, behavior: "auto" })
  })

  it("scrolls to the very top to reveal the title when near the first entry", () => {
    const sidebar = makeSidebar(200, 100, 500)
    const links = makeLinks([
      [-180, -170],
      [-140, -130],
      [-100, -90],
      [-60, -50],
      [-20, -10],
    ])
    scrollActiveTocLinkIntoView(sidebar, links, 0, "auto")
    expect(sidebar.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" })
  })

  it("scrolls to the very bottom to reveal the trailing meta when near the last entry", () => {
    const sidebar = makeSidebar(0, 100, 500)
    const links = makeLinks([
      [10, 20],
      [30, 40],
      [50, 60],
      [70, 80],
      [90, 100],
    ])
    scrollActiveTocLinkIntoView(sidebar, links, 4, "auto")
    expect(sidebar.scrollTo).toHaveBeenCalledWith({ top: 400, behavior: "auto" })
  })

  it("does not scroll when already pinned at the target edge", () => {
    const sidebar = makeSidebar(0, 100, 500)
    const links = makeLinks([
      [10, 20],
      [30, 40],
      [50, 60],
      [70, 80],
      [90, 100],
    ])
    scrollActiveTocLinkIntoView(sidebar, links, 0, "auto")
    expect(sidebar.scrollTo).not.toHaveBeenCalled()
  })
})
