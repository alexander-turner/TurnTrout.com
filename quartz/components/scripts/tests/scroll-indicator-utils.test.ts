/**
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals"

import { updateScrollIndicator, wrapScrollables } from "../scroll-indicator-utils"

const mockObserve = jest.fn()
const mockDisconnect = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  window.ResizeObserver = class {
    constructor(public callback: ResizeObserverCallback) {}
    observe = mockObserve
    unobserve = jest.fn()
    disconnect = mockDisconnect
  } as unknown as typeof ResizeObserver
})

describe("updateScrollIndicator", () => {
  it.each`
    scrollWidth | clientWidth | scrollLeft | left     | right    | desc
    ${100}      | ${100}      | ${0}       | ${false} | ${false} | ${"no overflow"}
    ${200}      | ${100}      | ${0}       | ${false} | ${true}  | ${"at start"}
    ${200}      | ${100}      | ${50}      | ${true}  | ${true}  | ${"in middle"}
    ${200}      | ${100}      | ${100}     | ${true}  | ${false} | ${"at end"}
  `("$desc: left=$left, right=$right", ({ scrollWidth, clientWidth, scrollLeft, left, right }) => {
    const wrapper = document.createElement("div")
    wrapper.classList.add("can-scroll-left", "can-scroll-right")
    const scrollable = document.createElement("div")
    Object.defineProperty(scrollable, "scrollWidth", { value: scrollWidth, configurable: true })
    Object.defineProperty(scrollable, "clientWidth", { value: clientWidth, configurable: true })
    Object.defineProperty(scrollable, "scrollLeft", { value: scrollLeft, configurable: true })

    updateScrollIndicator(wrapper, scrollable)

    expect(wrapper.classList.contains("can-scroll-left")).toBe(left)
    expect(wrapper.classList.contains("can-scroll-right")).toBe(right)
  })
})

describe("wrapScrollables", () => {
  it.each(["table-container", "katex-display"])("wraps .%s with .scroll-indicator", (cls) => {
    const container = document.createElement("div")
    const el = document.createElement("div")
    el.className = cls
    container.appendChild(el)

    wrapScrollables(container)

    expect(el.parentElement?.classList.contains("scroll-indicator")).toBe(true)
    expect(mockObserve).toHaveBeenCalledWith(el)
  })

  it("skips already-wrapped elements", () => {
    const container = document.createElement("div")
    const existing = document.createElement("div")
    existing.className = "scroll-indicator"
    const tc = document.createElement("div")
    tc.className = "table-container"
    existing.appendChild(tc)
    container.appendChild(existing)

    wrapScrollables(container)

    expect(mockObserve).not.toHaveBeenCalled()
  })

  it("skips elements without a parent", () => {
    const container = document.createElement("div")
    const detached = document.createElement("div")
    detached.className = "table-container"
    jest
      .spyOn(container, "querySelectorAll")
      .mockReturnValue([detached] as unknown as NodeListOf<HTMLElement>)

    wrapScrollables(container)

    expect(mockObserve).not.toHaveBeenCalled()
  })

  it("disconnects all observers on cleanup", () => {
    const container = document.createElement("div")
    for (let i = 0; i < 2; i++) {
      const el = document.createElement("div")
      el.className = "table-container"
      container.appendChild(el)
    }

    const cleanup = wrapScrollables(container, new AbortController().signal)

    expect(mockObserve).toHaveBeenCalledTimes(2)
    cleanup.disconnect()
    expect(mockDisconnect).toHaveBeenCalledTimes(2)
  })
})
