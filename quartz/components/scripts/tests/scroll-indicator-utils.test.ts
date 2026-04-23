/**
 * @jest-environment jest-fixed-jsdom
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals"

import { wrapScrollables } from "../scroll-indicator-utils"

beforeEach(() => {
  jest.clearAllMocks()
  window.ResizeObserver = class {
    constructor(public callback: ResizeObserverCallback) {}
    observe = jest.fn()
    unobserve = jest.fn()
    disconnect = jest.fn()
  } as unknown as typeof ResizeObserver
})

describe("wrapScrollables", () => {
  it.each`
    scrollWidth | clientWidth | scrollLeft | expectLeft | expectRight
    ${0}        | ${0}        | ${0}       | ${false}   | ${false}
    ${200}      | ${100}      | ${0}       | ${false}   | ${true}
    ${200}      | ${100}      | ${50}      | ${true}    | ${true}
    ${200}      | ${100}      | ${100}     | ${true}    | ${false}
  `(
    "scroll classes: left=$expectLeft right=$expectRight",
    ({ scrollWidth, clientWidth, scrollLeft, expectLeft, expectRight }) => {
      const container = document.createElement("div")
      const el = document.createElement("div")
      el.className = "table-container"
      container.appendChild(el)
      Object.defineProperty(el, "scrollWidth", { value: scrollWidth, configurable: true })
      Object.defineProperty(el, "clientWidth", { value: clientWidth, configurable: true })
      Object.defineProperty(el, "scrollLeft", { value: scrollLeft, configurable: true })

      const observers = wrapScrollables(container)

      const wrapper = el.parentElement
      expect(wrapper).not.toBeNull()
      expect(wrapper?.classList.contains("scroll-indicator")).toBe(true)
      expect(wrapper?.classList.contains("can-scroll-left")).toBe(expectLeft)
      expect(wrapper?.classList.contains("can-scroll-right")).toBe(expectRight)
      expect(observers).toHaveLength(1)
    },
  )

  it("re-attaches listeners to already-wrapped elements", () => {
    const container = document.createElement("div")
    const existing = document.createElement("div")
    existing.className = "scroll-indicator"
    const tc = document.createElement("div")
    tc.className = "table-container"
    existing.appendChild(tc)
    container.appendChild(existing)

    Object.defineProperty(tc, "scrollWidth", { value: 200, configurable: true })
    Object.defineProperty(tc, "clientWidth", { value: 100, configurable: true })
    Object.defineProperty(tc, "scrollLeft", { value: 0, configurable: true })

    const observers = wrapScrollables(container)
    expect(observers).toHaveLength(1)
    // The existing wrapper should get scroll classes
    expect(existing.classList.contains("can-scroll-right")).toBe(true)
    // Should NOT create a new wrapper (element stays in existing wrapper)
    expect(tc.parentElement).toBe(existing)
  })

  it("skips parentless elements", () => {
    const container = document.createElement("div")
    const tc = document.createElement("div")
    tc.className = "table-container"
    container.appendChild(tc)

    const detached = document.createElement("div")
    detached.className = "table-container"
    jest
      .spyOn(container, "querySelectorAll")
      .mockReturnValue([tc, detached] as unknown as NodeListOf<HTMLElement>)

    // tc gets wrapped (1 observer), detached is skipped (no parent)
    expect(wrapScrollables(container)).toHaveLength(1)
  })
})
