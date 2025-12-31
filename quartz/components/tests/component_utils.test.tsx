/**
 * @jest-environment jsdom
 */

import type { Parent } from "hast"

import { describe, it, expect, beforeEach, jest } from "@jest/globals"

import {
  processInlineCode,
  processKatex,
  processSmallCaps,
  processTextWithArrows,
} from "../component_utils"
import { debounce } from "../scripts/component_script_utils"

const createParent = (): Parent => ({ type: "element", tagName: "div", children: [] }) as Parent

let parent: Parent
beforeEach(() => {
  parent = createParent()
})

describe("processKatex", () => {
  it("should output katex node", () => {
    processKatex("E = mc^2", parent)

    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]).toHaveProperty("tagName", "span")
    expect(parent.children[0]).toHaveProperty("properties.className", ["katex-toc"])
  })
})

describe("processSmallCaps", () => {
  beforeEach(() => {
    parent = { type: "element", tagName: "div", children: [], properties: {} } as Parent
  })

  it("processes small caps correctly", () => {
    processSmallCaps("Test SMALLCAPS", parent)
    expect(parent.children).toMatchObject([
      { type: "text", value: "Test " },
      {
        type: "element",
        tagName: "abbr",
        properties: { className: ["small-caps"] },
        children: [{ type: "text", value: "smallcaps" }],
      },
    ])
  })

  it("handles text without small caps", () => {
    processSmallCaps("No small caps here", parent)
    expect(parent.children).toMatchObject([{ type: "text", value: "No small caps here" }])
  })

  it("handles multiple small caps", () => {
    processSmallCaps("^SMALLCAPS-A normal SMALLCAPS-B", parent)
    expect(parent.children).toMatchObject([
      { type: "text", value: "^" },
      {
        type: "element",
        tagName: "abbr",
        properties: { className: ["small-caps"] },
        children: [{ type: "text", value: "smallcaps-a" }],
      },
      { type: "text", value: " normal " },
      {
        type: "element",
        tagName: "abbr",
        properties: { className: ["small-caps"] },
        children: [{ type: "text", value: "smallcaps-b" }],
      },
    ])
  })

  it("handles parent with existing children", () => {
    parent.children = [
      {
        type: "element",
        tagName: "span",
        properties: { className: ["number-prefix"] },
        children: [{ type: "text", value: "8: " }],
      },
    ]

    processSmallCaps("Estimating the CDF and Statistical Functionals", parent)

    expect(parent.children).toMatchObject([
      {
        type: "element",
        tagName: "span",
        properties: { className: ["number-prefix"] },
        children: [{ type: "text", value: "8: " }],
      },
      { type: "text", value: "Estimating the " },
      {
        type: "element",
        tagName: "abbr",
        properties: { className: ["small-caps"] },
        children: [{ type: "text", value: "cdf" }],
      },
      { type: "text", value: " and Statistical Functionals" },
    ])
  })
})

describe("processTextWithArrows", () => {
  it("should handle text with arrows", () => {
    processTextWithArrows("→", parent)
    expect(parent.children).toMatchObject([
      {
        type: "element",
        tagName: "span",
        properties: { className: ["monospace-arrow"] },
        children: [{ type: "text", value: "→" }],
      },
    ])
  })
})

describe("Code Processing", () => {
  let parent: Parent

  beforeEach(() => {
    parent = createParent()
  })

  describe("processInlineCode", () => {
    it("should wrap code in code element", () => {
      processInlineCode("const x = 1", parent)

      expect(parent.children).toHaveLength(1)
      expect(parent.children[0]).toMatchObject({
        type: "element",
        tagName: "code",
        children: [{ type: "text", value: "const x = 1" }],
      })
    })

    it("should handle code with special characters", () => {
      processInlineCode("x => x * 2", parent)

      expect(parent.children[0]).toMatchObject({
        type: "element",
        tagName: "code",
        children: [{ type: "text", value: "x => x * 2" }],
      })
    })
  })

  describe("Mixed Content Processing", () => {
    it("should handle mixed text and code", () => {
      processInlineCode("code", parent)
      processKatex("x^2", parent)

      expect(parent.children).toHaveLength(2)
      expect(parent.children[0]).toMatchObject({
        type: "element",
        tagName: "code",
        children: [{ type: "text", value: "code" }],
      })
      expect(parent.children[1]).toMatchObject({
        type: "element",
        tagName: "span",
        properties: { className: ["katex-toc"] },
      })
    })
  })
})

function waitWithRAF(ms: number) {
  jest.advanceTimersByTime(ms)
  jest.runOnlyPendingTimers()
}

describe("debounce", () => {
  const debounceMs = 100
  jest.useFakeTimers({ legacyFakeTimers: false })

  let func: jest.Mock<(...args: unknown[]) => unknown>
  let debouncedFunc: ((...args: unknown[]) => void) & { cancel: () => void }

  beforeEach(() => {
    func = jest.fn()
    debouncedFunc = debounce(func, debounceMs)
  })

  it("should call the function after the wait time", () => {
    debouncedFunc() // Schedules RAF1
    expect(func).not.toHaveBeenCalled()

    waitWithRAF(debounceMs)
    expect(func).toHaveBeenCalledTimes(1)

    waitWithRAF(0)
    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should not call the function if cancelled", () => {
    debouncedFunc() // Schedules RAF1
    debouncedFunc.cancel() // Cancels RAF1

    waitWithRAF(debounceMs)
    // No callback should run because it was cancelled

    expect(func).not.toHaveBeenCalled()
  })

  it("should allow subsequent calls after cancellation", () => {
    debouncedFunc() // Schedules RAF1
    debouncedFunc.cancel() // Cancels RAF1

    waitWithRAF(debounceMs)
    expect(func).not.toHaveBeenCalled()

    debouncedFunc() // Schedules RAF2
    waitWithRAF(debounceMs) // RAF2 runs, executes func
    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should cancel the correct pending execution when called multiple times", () => {
    debouncedFunc() // First call, schedules RAF1
    waitWithRAF(debounceMs / 2)

    debouncedFunc() // Second call, cancels RAF1, schedules RAF2
    expect(func).not.toHaveBeenCalled()

    debouncedFunc.cancel() // Cancel RAF2

    // Advance past original + new timeout
    waitWithRAF(debounceMs * 2)
    expect(func).not.toHaveBeenCalled() // Should not have been called

    // Ensure it can be called again
    debouncedFunc() // Schedules RAF3
    waitWithRAF(debounceMs) // RAF3 runs, executes func
    expect(func).toHaveBeenCalledTimes(1)
  })

  it("should call immediately if immediate is true", () => {
    // Need to create a specific debounced function for this test
    const immediateDebouncedFunc = debounce(func, debounceMs, true)

    immediateDebouncedFunc()
    expect(func).toHaveBeenCalledTimes(1) // Called immediately

    // Further calls within wait period are ignored
    immediateDebouncedFunc()
    // Advance time slightly, still within wait period
    waitWithRAF(debounceMs / 2)
    expect(func).toHaveBeenCalledTimes(1)

    // Call after wait period is allowed again
    // Advance time past the wait period *since the first immediate call*
    waitWithRAF(debounceMs)

    immediateDebouncedFunc()
    expect(func).toHaveBeenCalledTimes(2)

    // Advance time again and check it wasn't called spuriously
    waitWithRAF(debounceMs)
    expect(func).toHaveBeenCalledTimes(2)
  })
})
