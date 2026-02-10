/**
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals"

import { updateScrollIndicator, wrapScrollables } from "../scroll-indicator-utils"

// Mock ResizeObserver
const mockObserve = jest.fn()
const mockDisconnect = jest.fn()

class MockResizeObserver {
  constructor(public callback: ResizeObserverCallback) {}
  observe = mockObserve
  unobserve = jest.fn()
  disconnect = mockDisconnect
}

beforeEach(() => {
  jest.clearAllMocks()
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

describe("updateScrollIndicator", () => {
  let wrapper: HTMLElement
  let scrollable: HTMLElement

  beforeEach(() => {
    wrapper = document.createElement("div")
    scrollable = document.createElement("div")
  })

  it("should remove both classes when content fits (no scroll needed)", () => {
    wrapper.classList.add("can-scroll-left", "can-scroll-right")
    Object.defineProperty(scrollable, "scrollWidth", { value: 100, configurable: true })
    Object.defineProperty(scrollable, "clientWidth", { value: 100, configurable: true })
    Object.defineProperty(scrollable, "scrollLeft", { value: 0, configurable: true })

    updateScrollIndicator(wrapper, scrollable)

    expect(wrapper.classList.contains("can-scroll-left")).toBe(false)
    expect(wrapper.classList.contains("can-scroll-right")).toBe(false)
  })

  it("should add can-scroll-right only when scrolled to start", () => {
    Object.defineProperty(scrollable, "scrollWidth", { value: 200, configurable: true })
    Object.defineProperty(scrollable, "clientWidth", { value: 100, configurable: true })
    Object.defineProperty(scrollable, "scrollLeft", { value: 0, configurable: true })

    updateScrollIndicator(wrapper, scrollable)

    expect(wrapper.classList.contains("can-scroll-left")).toBe(false)
    expect(wrapper.classList.contains("can-scroll-right")).toBe(true)
  })

  it("should add both classes when scrolled to middle", () => {
    Object.defineProperty(scrollable, "scrollWidth", { value: 200, configurable: true })
    Object.defineProperty(scrollable, "clientWidth", { value: 100, configurable: true })
    Object.defineProperty(scrollable, "scrollLeft", { value: 50, configurable: true })

    updateScrollIndicator(wrapper, scrollable)

    expect(wrapper.classList.contains("can-scroll-left")).toBe(true)
    expect(wrapper.classList.contains("can-scroll-right")).toBe(true)
  })

  it("should add can-scroll-left only when scrolled to end", () => {
    Object.defineProperty(scrollable, "scrollWidth", { value: 200, configurable: true })
    Object.defineProperty(scrollable, "clientWidth", { value: 100, configurable: true })
    Object.defineProperty(scrollable, "scrollLeft", { value: 100, configurable: true })

    updateScrollIndicator(wrapper, scrollable)

    expect(wrapper.classList.contains("can-scroll-left")).toBe(true)
    expect(wrapper.classList.contains("can-scroll-right")).toBe(false)
  })
})

describe("wrapScrollables", () => {
  it("should wrap .table-container elements with .scroll-indicator", () => {
    const container = document.createElement("div")
    const tableContainer = document.createElement("div")
    tableContainer.className = "table-container"
    container.appendChild(tableContainer)

    wrapScrollables(container)

    expect(tableContainer.parentElement?.classList.contains("scroll-indicator")).toBe(true)
    expect(mockObserve).toHaveBeenCalledWith(tableContainer)
  })

  it("should wrap .katex-display elements with .scroll-indicator", () => {
    const container = document.createElement("div")
    const katexDisplay = document.createElement("div")
    katexDisplay.className = "katex-display"
    container.appendChild(katexDisplay)

    wrapScrollables(container)

    expect(katexDisplay.parentElement?.classList.contains("scroll-indicator")).toBe(true)
  })

  it("should skip elements already wrapped in .scroll-indicator", () => {
    const container = document.createElement("div")
    const wrapper = document.createElement("div")
    wrapper.className = "scroll-indicator"
    const tableContainer = document.createElement("div")
    tableContainer.className = "table-container"
    wrapper.appendChild(tableContainer)
    container.appendChild(wrapper)

    wrapScrollables(container)

    // Should still have only one scroll-indicator wrapper
    expect(container.querySelectorAll(".scroll-indicator").length).toBe(1)
    expect(mockObserve).not.toHaveBeenCalled()
  })

  it("should return cleanup that disconnects all observers", () => {
    const container = document.createElement("div")
    const tc1 = document.createElement("div")
    tc1.className = "table-container"
    const tc2 = document.createElement("div")
    tc2.className = "table-container"
    container.appendChild(tc1)
    container.appendChild(tc2)

    const cleanup = wrapScrollables(container)
    expect(mockObserve).toHaveBeenCalledTimes(2)

    cleanup.disconnect()
    expect(mockDisconnect).toHaveBeenCalledTimes(2)
  })

  it("should pass AbortSignal to scroll event listeners", () => {
    const container = document.createElement("div")
    const tableContainer = document.createElement("div")
    tableContainer.className = "table-container"
    container.appendChild(tableContainer)

    const controller = new AbortController()
    const addEventSpy = jest.spyOn(tableContainer, "addEventListener")

    wrapScrollables(container, controller.signal)

    expect(addEventSpy).toHaveBeenCalledWith("scroll", expect.any(Function), {
      passive: true,
      signal: controller.signal,
    })
  })

  it("should handle container with no scrollable elements", () => {
    const container = document.createElement("div")
    container.innerHTML = "<p>No tables here</p>"

    const cleanup = wrapScrollables(container)

    expect(mockObserve).not.toHaveBeenCalled()
    // cleanup.disconnect should be safe to call
    cleanup.disconnect()
  })

  it("should work without an AbortSignal", () => {
    const container = document.createElement("div")
    const tableContainer = document.createElement("div")
    tableContainer.className = "table-container"
    container.appendChild(tableContainer)

    const addEventSpy = jest.spyOn(tableContainer, "addEventListener")

    wrapScrollables(container)

    expect(addEventSpy).toHaveBeenCalledWith("scroll", expect.any(Function), {
      passive: true,
      signal: undefined,
    })
  })
})
