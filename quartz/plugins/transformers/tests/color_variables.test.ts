import { describe, expect, it } from "@jest/globals"
import { type Root } from "hast"
import { h } from "hastscript"

import { ColorVariables, transformElement, transformStyle } from "../color_variables"

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

  // Shiki emits inline hex colors (e.g. `color:#D73A49`); these must map to
  // CSS variables despite starting with a non-word `#`.
  it.each([
    { input: "color:#D73A49;", expected: "color:var(--red);" },
    { input: "color: #d73a49;", expected: "color: var(--red);" },
    { input: "border: 1px solid #D73A49", expected: "border: 1px solid var(--red)" },
    // Must not match inside a longer hex token.
    { input: "color: #D73A4900;", expected: "color: #D73A4900;" },
  ])("transforms hex color in $input", ({ input, expected }) => {
    const result = transformStyle(input, { "#D73A49": "var(--red)" })
    expect(result).toBe(expected)
  })

  // Shiki dual-theme uses --shiki-light/--shiki-dark custom properties with
  // calibrated hex values; these must never be rewritten to CSS variables.
  it("should preserve hex values in --shiki-light and --shiki-dark", () => {
    const result = transformStyle("--shiki-light:#005CC5;--shiki-dark:#79B8FF", {
      "#005CC5": "var(--blue)",
      "#79B8FF": "var(--sky)",
    })
    expect(result).toBe("--shiki-light:#005CC5;--shiki-dark:#79B8FF")
  })

  it("should transform regular property but preserve custom property hex value", () => {
    const result = transformStyle("--shiki-light:#D73A49;color:#D73A49;", {
      "#D73A49": "var(--red)",
    })
    expect(result).toBe("--shiki-light:#D73A49;color:var(--red);")
  })

  it("should preserve color name in custom property value but transform regular property", () => {
    const result = transformStyle("--my-color: red; color: red;", { red: "var(--red)" })
    expect(result).toBe("--my-color: red; color: var(--red);")
  })

  it("should not create placeholder for empty custom property value", () => {
    const result = transformStyle("--empty:;color:red;", { red: "var(--red)" })
    expect(result).toBe("--empty:;color:var(--red);")
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
