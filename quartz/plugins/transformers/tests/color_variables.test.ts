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
  it.each([
    {
      name: "replace color names with CSS variables",
      input: "color: red;",
      expected: "color: var(--red);",
    },
    {
      name: "handle multiple color replacements",
      input: "color: blue; background-color: red; border: 1px solid green;",
      expected: "color: var(--blue); background-color: var(--red); border: 1px solid var(--green);",
    },
    {
      name: "not modify colors not in the mapping",
      input: "color: azalea;",
      expected: "color: azalea;",
    },
    {
      name: "handle case-insensitive color names",
      input: "color: RED;",
      expected: "color: var(--red);",
    },
    {
      name: "handle empty style",
      input: "",
      expected: "",
    },
  ])("should $name", ({ input, expected }) => {
    const result = transformStyle(input, colorMapping)
    expect(result).toBe(expected)
  })

  it.each([
    {
      name: "not modify colors that are already CSS variables",
      input: "color: var(--red);",
      expected: "color: var(--red);",
    },
    {
      name: "not transform color names inside var() expressions",
      input: "color: var(--dropcap-background-red);",
      expected: "color: var(--dropcap-background-red);",
    },
    {
      name: "not transform inside complex var() expressions",
      input: "--before-color: var(--dropcap-background-green);",
      expected: "--before-color: var(--dropcap-background-green);",
    },
    {
      name: "protect multiple var() expressions in one style",
      input: "color: var(--some-red); background: blue; border: var(--other-green);",
      expected: "color: var(--some-red); background: var(--blue); border: var(--other-green);",
    },
    {
      name: "transform colors outside var() but protect inside",
      input: "color: red; background: var(--background-blue); border-color: green;",
      expected:
        "color: var(--red); background: var(--background-blue); border-color: var(--green);",
    },
    {
      name: "protect var() with color-mix expressions",
      input:
        "color: var(--dropcap-background-red); background: color-mix(in srgb, 55% red, var(--midground-fainter));",
      expected:
        "color: var(--dropcap-background-red); background: color-mix(in srgb, 55% var(--red), var(--midground-fainter));",
    },
    {
      name: "handle var() expressions with spaces",
      input: "color: var( --dropcap-background-red ); border: green;",
      expected: "color: var( --dropcap-background-red ); border: var(--green);",
    },
    {
      name: "handle multiple var() with different color names",
      input:
        "color: var(--text-red); background: var(--bg-blue); border: var(--border-green); outline: red;",
      expected:
        "color: var(--text-red); background: var(--bg-blue); border: var(--border-green); outline: var(--red);",
    },
  ])("should $name", ({ input, expected }) => {
    const result = transformStyle(input, colorMapping)
    expect(result).toBe(expected)
  })

  it("should handle all colors from THE POND dropcaps example", () => {
    const fullMapping = {
      red: "var(--red)",
      orange: "var(--orange)",
      yellow: "var(--yellow)",
      green: "var(--green)",
      blue: "var(--blue)",
      purple: "var(--purple)",
      pink: "var(--pink)",
    }

    const result = transformStyle("--before-color: var(--dropcap-background-red);", fullMapping)
    expect(result).toBe("--before-color: var(--dropcap-background-red);")
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
    input.properties.style = 123
    const result = transformElement(input, colorMapping)
    expect(result.properties?.style).toBe(123)
  })

  it("should handle elements with empty properties", () => {
    const input = h("p")
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
