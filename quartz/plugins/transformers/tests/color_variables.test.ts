import { describe, it, expect } from "@jest/globals"
import { type Root } from "hast"
import { h } from "hastscript"

import { transformElement, transformStyle, ColorVariables } from "../color_variables"

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
    const input = h("p", { style: "color: red;" })
    const result = transformElement(input, colorMapping)
    expect(result.properties?.style).toBe("color: var(--red);")
  })

  it("should not modify elements without style attribute", () => {
    const input = h("p")
    const result = transformElement(input, colorMapping)
    expect(result.properties?.style).toBeUndefined()
  })

  it("should handle elements with non-string style property", () => {
    const input = h("p")
    // Manually set non-string style to test edge case
    input.properties.style = 123
    const result = transformElement(input, colorMapping)
    expect(result.properties?.style).toBe(123)
  })

  it("should handle elements with empty properties", () => {
    const input = h("p")
    // Simulate missing properties by deleting the property after creation
    delete (input as unknown as { properties?: unknown }).properties
    const result = transformElement(input, colorMapping)
    expect(result.properties).toBeUndefined()
  })
})

describe("ColorVariables plugin", () => {
  it("should return a valid QuartzTransformerPlugin object", () => {
    const plugin = ColorVariables()
    expect(plugin).toHaveProperty("name", "ColorVariables")
    expect(plugin).toHaveProperty("htmlPlugins")
    expect(typeof plugin.htmlPlugins).toBe("function")
  })

  it("should return HTML plugins array", () => {
    const plugin = ColorVariables()
    // Create a mock BuildCtx
    const mockCtx = {
      argv: {},
      cfg: {},
      allSlugs: [],
    } as unknown as Parameters<NonNullable<ReturnType<typeof ColorVariables>["htmlPlugins"]>>[0]

    expect(plugin.htmlPlugins).toBeDefined()

    if (!plugin.htmlPlugins) {
      throw new Error("htmlPlugins should be defined")
    }
    const htmlPlugins = plugin.htmlPlugins(mockCtx)
    expect(Array.isArray(htmlPlugins)).toBe(true)
    expect(htmlPlugins).toHaveLength(1)
    expect(typeof htmlPlugins[0]).toBe("function")
  })

  it("should transform colors in AST elements through the plugin", () => {
    const plugin = ColorVariables()
    // Create a mock BuildCtx
    const mockCtx = {
      argv: {},
      cfg: {},
      allSlugs: [],
    } as unknown as Parameters<NonNullable<ReturnType<typeof ColorVariables>["htmlPlugins"]>>[0]

    expect(plugin.htmlPlugins).toBeDefined()

    if (!plugin.htmlPlugins) {
      throw new Error("htmlPlugins should be defined")
    }
    const htmlPlugins = plugin.htmlPlugins(mockCtx)
    const transformFn = htmlPlugins[0]

    // Create proper HAST elements using h()
    const mockElement1 = h("div", { style: "color: red; background: blue;" })
    const mockElement2 = h("span", { style: "border-color: green;" })

    const mockAST: Root = {
      type: "root",
      children: [mockElement1, mockElement2],
    }

    // Apply the transformation - transformFn is the innerFunc which returns a transformer
    const transformer = (transformFn as () => (ast: Root) => void)()
    const result = transformer(mockAST)

    // The function should visit and transform all elements
    expect(result).toBeUndefined() // visit function returns void

    // Check that colors were transformed
    expect(mockElement1.properties?.style).toBe("color: var(--red); background: var(--blue);")
    expect(mockElement2.properties?.style).toBe("border-color: var(--green);")
  })
})
