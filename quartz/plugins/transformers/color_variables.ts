import type { Element } from "hast"
import type { Root } from "mdast"

import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

const colorMapping: Record<string, string> = {
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
  "#E36209": "color-mix(in srgb, var(--orange), var(--red) 70%)",
}

export const transformStyle = (style: string, colorMapping: Record<string, string>): string => {
  let newStyle = style
  Object.entries(colorMapping).forEach(([color, variable]) => {
    const regex = new RegExp(`${color}\\b`, "gi")
    newStyle = newStyle.replace(regex, variable)
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
  colorMapping: Record<string, string>,
): Element => {
  if (typeof element?.properties?.style === "string") {
    element.properties.style = transformStyle(element.properties.style, colorMapping)
  }
  return element
}

function innerFunc() {
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
      return [innerFunc]
    },
  }
}

export default ColorVariables
