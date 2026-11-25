/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals"
import fs from "fs"
import path from "path"

const QUARTZ_DIR = path.join(process.cwd(), "quartz")

// `geometricPrecision` and `optimizeLegibility` both turn off the rasterizer's
// vertical grid-fitting, so each glyph keeps the baseline overshoot its outline
// was drawn with instead of snapping to the shared pixel row its neighbors
// occupy. EB Garamond sinks "G" 49/2048 em below the baseline — a device pixel
// or two on a high-DPR phone, next to flat-bottomed letters that land crisply on
// the grid. Only the keywords that leave grid-fitting to the engine are allowed.
const HINTED_VALUES: ReadonlySet<string> = new Set([
  "auto",
  "inherit",
  "initial",
  "revert",
  "unset",
])

const TEXT_RENDERING = /text-rendering:\s*([a-z-]+)/gi

const scssFiles = fs
  .readdirSync(QUARTZ_DIR, { recursive: true, encoding: "utf-8" })
  .filter((name) => name.endsWith(".scss"))

interface Declaration {
  location: string
  value: string
}

function collectDeclarations(): Declaration[] {
  const declarations: Declaration[] = []
  for (const file of scssFiles) {
    const lines = fs.readFileSync(path.join(QUARTZ_DIR, file), "utf-8").split("\n")
    lines.forEach((line, index) => {
      for (const match of line.matchAll(TEXT_RENDERING)) {
        declarations.push({ location: `${file}:${index + 1}`, value: match[1].toLowerCase() })
      }
    })
  }
  return declarations
}

describe("text-rendering", () => {
  it("finds text-rendering declarations to lint (guards the regex)", () => {
    expect(collectDeclarations().length).toBeGreaterThan(0)
  })

  it.each([...HINTED_VALUES])("accepts %s", (value) => {
    expect(HINTED_VALUES.has(value)).toBe(true)
  })

  it.each(["geometricprecision", "optimizelegibility", "optimizespeed"])("rejects %s", (value) => {
    expect(HINTED_VALUES.has(value)).toBe(false)
  })

  it("every stylesheet leaves vertical grid-fitting to the engine", () => {
    const violations = collectDeclarations().filter(({ value }) => !HINTED_VALUES.has(value))
    expect(violations).toEqual([])
  })
})
