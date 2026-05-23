import fs from "fs"
import path from "path"
import prettier from "prettier"
import { fileURLToPath } from "url"

import { darkPalette, lightPalette, variables } from "./variables"

const prettierConfigPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../config/prettier/.prettierrc",
)

/** Run the project's prettier on an SCSS string so emitted output matches the
 *  format that `pnpm check` enforces (otherwise CI flags every regen). */
async function formatScss(content: string): Promise<string> {
  const config = await prettier.resolveConfig(prettierConfigPath)
  const scssConfig = { ...config }
  delete (scssConfig as Record<string, unknown>).plugins
  return prettier.format(content, { ...scssConfig, parser: "scss" })
}

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
  "z-below",
  "z-base",
  "z-raised",
  "z-accent",
  "z-popover",
  "z-sticky",
  "z-navbar",
  "z-modal",
  "z-skip-link",
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
export async function generateScss(): Promise<void> {
  try {
    const outputPath = path.join(__dirname, "variables.scss")
    const scss = await formatScss(generateScssContent())
    fs.writeFileSync(outputPath, scss)
  } catch (error) {
    console.error("Error generating SCSS variables:", error)
    throw error
  }
}

/**
 * Formats a palette record as an SCSS map body
 */
const formatScssMap = (palette: Record<string, string>): string =>
  Object.entries(palette)
    .map(([name, value]) => `  "${name}": ${value}`)
    .join(",\n")

/**
 * Generates the _palette.scss file content from palette definitions in variables.ts
 */
const generatePaletteContent = (): string => {
  return `// This file is auto-generated from variables.ts. Do not edit directly.
$dark-colors: (
${formatScssMap(darkPalette)},
);
$light-colors: (
${formatScssMap(lightPalette)},
);

/// Emit --name: value for each entry in a palette map.
@mixin palette-vars($palette, $important: false) {
  @each $name, $value in $palette {
    @if $important {
      --#{$name}: #{$value} !important;
    } @else {
      --#{$name}: #{$value};
    }
  }
}
`
}

/**
 * Generates and writes the _palette.scss file to disk
 * @throws Error if file writing fails
 */
export async function generatePalette(): Promise<void> {
  try {
    const outputPath = path.join(__dirname, "_palette.scss")
    const scss = await formatScss(generatePaletteContent())
    fs.writeFileSync(outputPath, scss)
  } catch (error) {
    console.error("Error generating palette SCSS:", error)
    throw error
  }
}

// Run generation if this is the main module
/* istanbul ignore next */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ;(async () => {
    await generateScss()
    await generatePalette()
    console.log("SCSS variables and palette generated successfully!")
  })().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
