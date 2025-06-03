import { describe, it, expect } from "@jest/globals"
import { type Element } from "hast"

import { transformElement, transformStyle } from "../color_variables"

const colorMapping = {
  red: "var(--red)",
  blue: "var(--blue)",
  green: "var(--green)",
}

describe("transformStyle", () => {
  it("should replace color names with CSS variables in inline styles", () => {
    const input = "color: red;"
    const result = transformStyle(input, colorMapping)
    expect(result).toBe("color: var(--red);")
  })

  it("should handle multiple color replacements in a single style", () => {
    const input = "color: blue; background-color: red; border: 1px solid green;"
    const result = transformStyle(input, colorMapping)
    expect(result).toBe(
      "color: var(--blue); background-color: var(--red); border: 1px solid var(--green);",
    )
  })

  it("should not modify colors that are not in the mapping", () => {
    const input = "color: azalea;"
    const result = transformStyle(input, colorMapping)
    expect(result).toBe("color: azalea;")
  })

  it("should not modify colors that are already CSS variables", () => {
    const input = "color: var(--red);"
    const result = transformStyle(input, colorMapping)
    expect(result).toBe("color: var(--red);")
  })

  it("should handle case-insensitive color names", () => {
    const input = "color: RED;"
    const result = transformStyle(input, colorMapping)
    expect(result).toBe("color: var(--red);")
  })

  it("should handle empty style", () => {
    const input = ""
    const result = transformStyle(input, colorMapping)
    expect(result).toBe("")
  })
})

describe("transformElement", () => {
  it("should apply transformStyle to element's style property", () => {
    const input: Element = {
      type: "element",
      tagName: "p",
      properties: { style: "color: red;" },
      children: [],
    }
    const result = transformElement(input, colorMapping)
    expect(result.properties?.style).toBe("color: var(--red);")
  })

  it("should not modify elements without style attribute", () => {
    const input: Element = {
      type: "element",
      tagName: "p",
      properties: {},
      children: [],
    }
    const result = transformElement(input, colorMapping)
    expect(result.properties?.style).toBeUndefined()
  })
})
