import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { variables } from "./variables"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Convert camelCase to kebab-case
const toKebabCase = (str: string): string => {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

const unitlessKeys = new Set([
  "bold-weight",
  "semi-bold-weight",
  "normal-weight",
  "font-scale-factor",
])

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

const generateScssContent = (): string => {
  let scss = "// This file is auto-generated. Do not edit directly.\n\n"

  const mapping = generateScssRecord()
  for (const [key, value] of Object.entries(mapping)) {
    scss += `$${key}: ${value};\n`
  }

  return scss
}

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
try {
  if (process.argv[1] === fileURLToPath(import.meta.url)) {
    generateScss()
    console.log("SCSS variables generated successfully!")
  }
} catch {
  // Ignore any errors in the execution check
  // This allows the module to be imported without issues
}
