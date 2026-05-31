import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

import {
  debounce,
  registerEscapeHandler,
  removeAllChildren,
  setupCopyButton,
  svgCheck,
  svgCopy,
  throttle,
} from "./component_script_utils"

const frameTime = 16
// Store a map of fake RAF IDs to real timer IDs
let rafMap: Map<number, NodeJS.Timeout>
let nextRafId: number

beforeEach(() => {
  jest.useFakeTimers()
  rafMap = new Map()
  nextRafId = 1

  global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
    const currentRafId = nextRafId++
    const timeoutId = setTimeout(() => {
      rafMap.delete(currentRafId)
      cb(performance.now())
    }, frameTime)
    rafMap.set(currentRafId, timeoutId)
    return currentRafId
  })

  global.cancelAnimationFrame = jest.fn((id: number) => {
    const timeoutId = rafMap.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      rafMap.delete(id)
    }
  })

  global.performance.now = jest.fn(() => Date.now())
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
  if (rafMap) {
    rafMap.clear()
  }
})

describe("throttle", () => {
  it("should only call function once within delay period", () => {
    const func = jest.fn()
    const throttled = throttle(func, 100)

    throttled() // Should call immediately
    throttled() // Should be ignored
    throttled() // Should be ignored

    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should call function again after delay", () => {
    const func = jest.fn()
    const throttled = throttle(func, 100)

    throttled()
    jest.advanceTimersByTime(150)
    throttled()

    expect(func).toHaveBeenCalledTimes(2)
  })

  it("should schedule execution via requestAnimationFrame when called before delay", () => {
    const func = jest.fn()
    const throttled = throttle(func, 100)

    // First call executes immediately
    throttled()
    expect(func).toHaveBeenCalledTimes(1)

    // Reset mock to track next calls
    func.mockClear()

    // Call again quickly - should schedule for next frame
    jest.advanceTimersByTime(50) // Not enough time has passed
    throttled()
    expect(func).not.toHaveBeenCalled() // Should not have called yet

    // Advance by frame time to trigger requestAnimationFrame callback
    jest.advanceTimersByTime(frameTime)
    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should ignore subsequent calls when frame is already scheduled", () => {
    const func = jest.fn()
    const throttled = throttle(func, 100)

    // First call executes immediately
    throttled()
    func.mockClear()

    // Call again quickly - should schedule for next frame
    jest.advanceTimersByTime(50)
    throttled()
    throttled() // This should be ignored because frame is already scheduled
    throttled() // This should also be ignored

    jest.advanceTimersByTime(frameTime)
    expect(func).toHaveBeenCalledTimes(1) // Only called once despite multiple attempts
  })
})

describe("debounce", () => {
  it("should delay function execution", () => {
    const func = jest.fn()
    const debounced = debounce(func, 100)
    const event = new KeyboardEvent("keydown")

    debounced(event)
    expect(func).not.toHaveBeenCalled()

    jest.advanceTimersByTime(150)
    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should execute immediately with immediate flag", () => {
    const func = jest.fn()
    const debounced = debounce(func, 100, true)
    const event = new KeyboardEvent("keydown")

    debounced(event)
    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should cancel previous calls", () => {
    const func = jest.fn()
    const debounced = debounce(func, 100)
    const event = new KeyboardEvent("keydown")

    debounced(event)
    debounced(event)
    debounced(event)

    jest.advanceTimersByTime(150)
    jest.runAllTimers()
    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should respect immediate flag and not call after wait period when immediate is true", () => {
    const func = jest.fn()
    const debounced = debounce(func, 100, true)
    const event = new KeyboardEvent("keydown")

    // First call should execute immediately
    debounced(event)
    expect(func).toHaveBeenCalledTimes(1)

    // Second call within wait period should be ignored completely
    jest.advanceTimersByTime(50)
    debounced(event)
    expect(func).toHaveBeenCalledTimes(1)

    // Even after wait period, no trailing call should happen
    jest.advanceTimersByTime(100)
    jest.runAllTimers()
    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should allow immediate call again after wait period with immediate flag", () => {
    const func = jest.fn()
    const debounced = debounce(func, 100, true)
    const event = new KeyboardEvent("keydown")

    // First call should execute immediately
    debounced(event)
    expect(func).toHaveBeenCalledTimes(1)

    // Wait for cooldown period to expire
    jest.advanceTimersByTime(150)

    // Next call should execute immediately again
    debounced(event)
    expect(func).toHaveBeenCalledTimes(2)
  })

  it("should handle cancel method", () => {
    const func = jest.fn()
    const debounced = debounce(func, 100)
    const consoleSpy = jest.spyOn(console, "debug").mockImplementation(() => {
      /* no console printing within test */
    })

    debounced()
    debounced.cancel()

    jest.advanceTimersByTime(150)
    jest.runAllTimers()
    expect(func).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith("cancelling debounce")

    consoleSpy.mockRestore()
  })

  it("should handle frame timing correctly in checkTime", () => {
    const func = jest.fn()
    const debounced = debounce(func, 100)

    debounced()

    // Advance time but not enough to trigger execution
    jest.advanceTimersByTime(frameTime) // First frame
    expect(func).not.toHaveBeenCalled()

    jest.advanceTimersByTime(frameTime) // Second frame, still not enough
    expect(func).not.toHaveBeenCalled()

    // Advance enough time to trigger execution
    jest.advanceTimersByTime(100)
    expect(func).toHaveBeenCalledTimes(1)
  })
})

describe("registerEscapeHandler", () => {
  let container: HTMLElement
  let mockCallback: jest.Mock

  beforeEach(() => {
    container = document.createElement("div")
    mockCallback = jest.fn()
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it("should return empty function when container is null", () => {
    const cleanup = registerEscapeHandler(null, mockCallback)
    cleanup()
    expect(mockCallback).not.toHaveBeenCalled()
  })

  it("should handle click events on the container", () => {
    const cleanup = registerEscapeHandler(container, mockCallback)

    // Create and dispatch click event on the container
    const clickEvent = new MouseEvent("click", { bubbles: true })
    Object.defineProperty(clickEvent, "target", { value: container })
    container.dispatchEvent(clickEvent)

    expect(mockCallback).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it("should ignore click events not on the container", () => {
    const cleanup = registerEscapeHandler(container, mockCallback)
    const otherElement = document.createElement("span")

    // Create and dispatch click event on a different element
    const clickEvent = new MouseEvent("click", { bubbles: true })
    Object.defineProperty(clickEvent, "target", { value: otherElement })
    container.dispatchEvent(clickEvent)

    expect(mockCallback).not.toHaveBeenCalled()
    cleanup()
  })

  it("should handle escape key events", () => {
    const cleanup = registerEscapeHandler(container, mockCallback)

    // Create and dispatch escape key event
    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    window.dispatchEvent(escapeEvent)

    expect(mockCallback).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it("should ignore non-escape key events", () => {
    const cleanup = registerEscapeHandler(container, mockCallback)

    // Create and dispatch non-escape key event
    const enterEvent = new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    window.dispatchEvent(enterEvent)

    expect(mockCallback).not.toHaveBeenCalled()
    cleanup()
  })

  it("should clean up event listeners", () => {
    const removeEventListenerSpy = jest.spyOn(container, "removeEventListener")
    const windowRemoveEventListenerSpy = jest.spyOn(window, "removeEventListener")

    const cleanup = registerEscapeHandler(container, mockCallback)
    cleanup()

    expect(removeEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function))
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function))

    removeEventListenerSpy.mockRestore()
    windowRemoveEventListenerSpy.mockRestore()
  })

  it("should prevent default behavior on click", () => {
    const cleanup = registerEscapeHandler(container, mockCallback)

    const clickEvent = new MouseEvent("click", { bubbles: true })
    Object.defineProperty(clickEvent, "target", { value: container })
    const preventDefaultSpy = jest.spyOn(clickEvent, "preventDefault")

    container.dispatchEvent(clickEvent)

    expect(preventDefaultSpy).toHaveBeenCalled()
    cleanup()
  })

  it("should prevent default behavior on escape key", () => {
    const cleanup = registerEscapeHandler(container, mockCallback)

    const escapeEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    const preventDefaultSpy = jest.spyOn(escapeEvent, "preventDefault")

    window.dispatchEvent(escapeEvent)

    expect(preventDefaultSpy).toHaveBeenCalled()
    cleanup()
  })
})

describe("removeAllChildren", () => {
  let parentElement: HTMLElement

  beforeEach(() => {
    parentElement = document.createElement("div")
  })

  it("should remove all child nodes", () => {
    // Add some child elements
    const child1 = document.createElement("span")
    const child2 = document.createElement("p")
    const textNode = document.createTextNode("text")

    parentElement.appendChild(child1)
    parentElement.appendChild(child2)
    parentElement.appendChild(textNode)

    expect(parentElement.childNodes.length).toBe(3)

    removeAllChildren(parentElement)

    expect(parentElement.childNodes.length).toBe(0)
  })

  it("should handle element with no children", () => {
    expect(parentElement.childNodes.length).toBe(0)

    removeAllChildren(parentElement)

    expect(parentElement.childNodes.length).toBe(0)
  })

  it("should remove nested child elements", () => {
    const child1 = document.createElement("div")
    const nestedChild = document.createElement("span")
    child1.appendChild(nestedChild)

    const child2 = document.createElement("p")

    parentElement.appendChild(child1)
    parentElement.appendChild(child2)

    expect(parentElement.childNodes.length).toBe(2)
    expect(child1.childNodes.length).toBe(1)

    removeAllChildren(parentElement)

    expect(parentElement.childNodes.length).toBe(0)
  })
})

describe("setupCopyButton", () => {
  let button: HTMLButtonElement
  let mockClipboard: { writeText: jest.Mock }

  beforeEach(() => {
    button = document.createElement("button")
    mockClipboard = { writeText: jest.fn(() => Promise.resolve()) }
    Object.defineProperty(navigator, "clipboard", { value: mockClipboard, writable: true })
  })

  it("should set initial innerHTML to svgCopy", () => {
    setupCopyButton(button, () => "text")
    expect(button.innerHTML).toBe(svgCopy)
  })

  it("should copy text and swap to check icon on click", async () => {
    setupCopyButton(button, () => "hello")
    button.click()

    await Promise.resolve() // flush microtasks for clipboard promise
    expect(mockClipboard.writeText).toHaveBeenCalledWith("hello")
    expect(button.innerHTML).toBe(svgCheck)
  })

  it("should restore copy icon after animation completes", async () => {
    setupCopyButton(button, () => "text")
    button.click()
    await Promise.resolve()

    // Advance past the 2000ms setTimeout delay
    jest.advanceTimersByTime(2000 + frameTime)
    expect(button.innerHTML).toBe(svgCopy)
  })

  it("should pass options to addEventListener", () => {
    // Use mockImplementation to avoid jsdom's internal AbortSignal type validation
    const addEventSpy = jest.spyOn(button, "addEventListener").mockImplementation(jest.fn())
    const controller = new AbortController()
    setupCopyButton(button, () => "text", { signal: controller.signal })

    expect(addEventSpy).toHaveBeenCalledWith("click", expect.any(Function), {
      signal: controller.signal,
    })
    addEventSpy.mockRestore()
  })

  it("should log error when clipboard write fails", async () => {
    const error = new Error("clipboard error")
    mockClipboard.writeText.mockReturnValue(Promise.reject(error))
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(/* suppress test output */ jest.fn())

    setupCopyButton(button, () => "text")
    button.click()

    // Flush the microtask queue for the rejected promise handlers
    await jest.advanceTimersByTimeAsync(0)

    expect(consoleSpy).toHaveBeenCalledWith(error)
    consoleSpy.mockRestore()
  })
})
