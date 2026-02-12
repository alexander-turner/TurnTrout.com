import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { variables } from "./variables"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Convert camelCase to kebab-case
const toKebabCase = (str: string): string => {
  return str.replace(/(?<lower>[a-z0-9])(?<upper>[A-Z])/g, "$<lower>-$<upper>").toLowerCase()
}

const unitlessKeys = new Set([
  "bold-weight",
  "semi-bold-weight",
  "normal-weight",
  "font-scale-factor",
])

/**
 * Generates a record of SCSS variables from the variables object
 * @returns Record mapping kebab-case variable names to their string values
 */
export function generateScssRecord(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => {
      const kebabKey = toKebabCase(key)
      const valString =
        typeof value === "number" && !unitlessKeys.has(kebabKey) ? `${value}px` : String(value)
      return [kebabKey, valString]
    }),
  )
}

/**
 * Generates the SCSS file content with variable definitions
 * @returns The complete SCSS content as a string
 */
const generateScssContent = (): string => {
  let scss = "// This file is auto-generated. Do not edit directly.\n\n"

  const mapping = generateScssRecord()
  for (const [key, value] of Object.entries(mapping)) {
    scss += `$${key}: ${value};\n`
  }

  return scss
}

/**
 * Generates and writes the SCSS variables file to disk
 * @throws Error if file writing fails
 */
export function generateScss(): void {
  try {
    const outputPath = path.join(__dirname, "variables.scss")
    const scss = generateScssContent()
    fs.writeFileSync(outputPath, scss)
  } catch (error) {
    console.error("Error generating SCSS variables:", error)
    throw error
  }
}

// Run generation if this is the main module
/* istanbul ignore next */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateScss()
  console.log("SCSS variables generated successfully!")
}
