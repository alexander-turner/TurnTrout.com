import type { Element } from "hast"
import type { Root } from "mdast"

import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

const colorMapping: Readonly<Record<string, string>> = {
  pink: "var(--pink)",
  red: "var(--red)",
  yellow: "var(--yellow)",
  green: "var(--green)",
  teal: "var(--teal)",
  sky: "var(--sky)",
  blue: "var(--blue)",
  lavender: "var(--lavender)",
  purple: "var(--purple)",
  orange: "var(--orange)",
  // Shiki code block colors
  "#D73A49": "var(--red)",
  "#F97583": "var(--orange)",
  "#6F42C1": "var(--purple)",
  "#B392F0": "var(--lavender)",
  "#005CC5": "var(--blue)",
  "#79B8FF": "var(--sky)",
  "#24292E": "var(--dark)",
  "#E1E4E8": "var(--light)",
  "#6A737D": "var(--dark-gray)",
  "#032F62": "color-mix(in srgb, var(--blue), var(--dark) 70%)",
  "#9ECBFF": "var(--sky)",
  "#DBEDFF": "color-mix(in srgb, var(--sky), var(--light) 70%)",
  "#85E89D": "var(--green)",
  "#22863A": "color-mix(in srgb, var(--green), var(--dark) 50%)",
  "#FFAB70": "var(--orange)",
  "#E36209": "var(--orange)",
}

const placeholderRestoreRegex = /___VAR_PLACEHOLDER_(?<index>\d+)___/g

function compileColorPatterns(
  mapping: Readonly<Record<string, string>>,
): readonly { regex: RegExp; variable: string }[] {
  return Object.entries(mapping).map(([color, variable]) => {
    const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // `\b` only delimits where the key edge is a word char; hex keys like
    // "#D73A49" start with `#` (non-word), so a leading `\b#…` could never
    // match. All keys end in an alphanumeric, so a trailing `\b` is always
    // valid; only the start boundary needs to vary.
    const startBoundary = /^\w/.test(color) ? "\\b" : "(?<![\\w#])"
    return {
      regex: new RegExp(`${startBoundary}${escaped}\\b`, "gi"),
      variable,
    }
  })
}

const defaultCompiledPatterns = compileColorPatterns(colorMapping)

/**
 * Transforms a CSS style string by replacing color values with corresponding CSS variables.
 *
 * @param style - The CSS style string to transform.
 * @param mapping - An object mapping color values to CSS variable names.
 * @returns The transformed CSS style string with color values replaced by CSS variables.
 */
export const transformStyle = (
  style: string,
  mapping: Readonly<Record<string, string>>,
): string => {
  const patterns =
    mapping === colorMapping ? defaultCompiledPatterns : compileColorPatterns(mapping)

  // Extract all var() expressions to protect them from transformation
  const varExpressions: string[] = []
  const placeholder = "___VAR_PLACEHOLDER_"

  let newStyle = style.replace(/var\([^)]+\)/gi, (match) => {
    varExpressions.push(match)
    return `${placeholder}${varExpressions.length - 1}___`
  })

  // Transform colors in the remaining style string
  for (const { regex, variable } of patterns) {
    newStyle = newStyle.replace(regex, variable)
  }

  // Restore var() expressions
  newStyle = newStyle.replace(placeholderRestoreRegex, (...args) => {
    const groups = args[args.length - 1] as { index: string }
    return varExpressions[parseInt(groups.index, 10)]
  })

  return newStyle
}

/**
 * Transforms color names in inline styles and KaTeX elements to CSS variables for a single node
 * @param node - The HAST Element node to transform
 * @param colorMapping - The mapping of color names to CSS variables
 * @returns The transformed node
 */
export const transformElement = (
  element: Element,
  colorMapping: Readonly<Record<string, string>>,
): Element => {
  if (typeof element?.properties?.style === "string") {
    element.properties.style = transformStyle(element.properties.style, colorMapping)
  }
  return element
}

/**
 * Transforms the AST by visiting each element and applying color mappings.
 */
function transformAst(): (ast: Root) => void {
  return (ast: Root) => {
    visit(ast, "element", (node: Element) => {
      transformElement(node, colorMapping)
    })
  }
}

/**
 * Transforms color names in inline styles and KaTeX elements to CSS variables
 * @param opts - Options for the transformer
 * @returns A QuartzTransformerPlugin that replaces color names with CSS variables
 */
export const ColorVariables: QuartzTransformerPlugin = () => {
  return {
    name: "ColorVariables",
    htmlPlugins() {
      return [transformAst]
    },
  }
}

export default ColorVariables
