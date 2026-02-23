/**
 * @jest-environment jsdom
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

  it("skips already-wrapped and parentless elements", () => {
    const container = document.createElement("div")
    const existing = document.createElement("div")
    existing.className = "scroll-indicator"
    const tc = document.createElement("div")
    tc.className = "table-container"
    existing.appendChild(tc)
    container.appendChild(existing)

    const detached = document.createElement("div")
    detached.className = "table-container"
    jest
      .spyOn(container, "querySelectorAll")
      .mockReturnValue([tc, detached] as unknown as NodeListOf<HTMLElement>)

    expect(wrapScrollables(container)).toHaveLength(0)
  })
})
