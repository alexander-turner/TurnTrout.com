import { jest, describe, it, beforeEach, afterEach, expect } from "@jest/globals"

import {
  throttle,
  debounce,
  withoutTransition,
  wrapWithoutTransition,
  animate,
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
})

describe("withoutTransition", () => {
  const originalGetComputedStyle = window.getComputedStyle

  beforeEach(() => {
    window.getComputedStyle = jest.fn().mockReturnValue({ opacity: "1" }) as jest.Mock<
      typeof window.getComputedStyle
    >
    jest.spyOn(document.head, "appendChild").mockImplementation((x) => x)
    jest.spyOn(document.head, "removeChild").mockImplementation((x) => x)
  })

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle
  })

  it("should add and remove transition-disabling style", () => {
    const action = jest.fn()
    withoutTransition(action)

    expect(document.head.appendChild).toHaveBeenCalled()
    expect(action).toHaveBeenCalled()
    expect(document.head.removeChild).toHaveBeenCalled()
  })
})

describe("wrapWithoutTransition", () => {
  it("should wrap function execution with transition handling", () => {
    const func = jest.fn().mockReturnValue("result")
    const wrapped = wrapWithoutTransition(func)
    const addClassSpy = jest.spyOn(document.documentElement.classList, "add")
    const removeClassSpy = jest.spyOn(document.documentElement.classList, "remove")

    const result = wrapped()

    expect(addClassSpy).toHaveBeenCalledWith("temporary-transition")
    expect(func).toHaveBeenCalled()
    expect(result).toBe("result")

    // Class should not be removed before 1000ms
    jest.advanceTimersByTime(500)
    expect(removeClassSpy).not.toHaveBeenCalled()

    // Class should be removed after 1000ms
    jest.advanceTimersByTime(500)
    expect(removeClassSpy).toHaveBeenCalledWith("temporary-transition")

    addClassSpy.mockRestore()
    removeClassSpy.mockRestore()
  })

  it("should handle void functions", () => {
    const func = jest.fn()
    const wrapped = wrapWithoutTransition(func)
    const addClassSpy = jest.spyOn(document.documentElement.classList, "add")
    const removeClassSpy = jest.spyOn(document.documentElement.classList, "remove")

    wrapped()

    expect(addClassSpy).toHaveBeenCalledWith("temporary-transition")
    expect(func).toHaveBeenCalled()

    jest.advanceTimersByTime(1000)
    expect(removeClassSpy).toHaveBeenCalledWith("temporary-transition")

    addClassSpy.mockRestore()
    removeClassSpy.mockRestore()
  })
})

describe("animate", () => {
  beforeEach(() => {
    global.cancelAnimationFrame = jest.fn()
  })

  it("should call onFrame with progress values from 0 to 1", () => {
    const onFrame = jest.fn()
    const duration = 100
    const startTime = performance.now()

    animate(duration, onFrame)

    // Simulate first frame at start
    jest.advanceTimersByTime(frameTime)
    expect(onFrame).toHaveBeenCalledWith(0)

    // Simulate middle frame at 50ms
    jest.setSystemTime(startTime + 50)
    jest.advanceTimersByTime(frameTime)
    expect(onFrame).toHaveBeenCalledWith(0.5)

    // Simulate final frame after duration
    jest.setSystemTime(startTime + 100)
    jest.advanceTimersByTime(frameTime)
    expect(onFrame).toHaveBeenLastCalledWith(1)
  })

  it("should call onComplete when animation finishes", () => {
    const onComplete = jest.fn()
    const duration = 100
    const startTime = performance.now()

    animate(duration, () => {}, onComplete)

    // Advance to just after duration and trigger the callback
    jest.setSystemTime(startTime + 100)
    jest.advanceTimersByTime(frameTime)
    // Run any pending timers to ensure the rAF callback executes
    jest.runAllTimers()
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("should cancel animation when cleanup is called", () => {
    const onFrame = jest.fn()
    const onComplete = jest.fn()
    const duration = 100

    const cleanup = animate(duration, onFrame, onComplete)

    cleanup()

    jest.advanceTimersByTime(100)
    expect(global.cancelAnimationFrame).toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("should not call onComplete if animation is cancelled", () => {
    const onComplete = jest.fn()
    const duration = 100

    const cleanup = animate(duration, () => {}, onComplete)

    // Cancel halfway through
    jest.advanceTimersByTime(50)
    cleanup()

    // Advance past duration
    jest.advanceTimersByTime(50)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("should handle zero duration", () => {
    const onFrame = jest.fn()
    const onComplete = jest.fn()

    animate(0, onFrame, onComplete)

    // Simulate first frame and run the callback
    jest.advanceTimersByTime(frameTime)
    jest.runAllTimers()
    expect(onFrame).toHaveBeenCalledWith(1)
    expect(onComplete).toHaveBeenCalled()
  })
})
