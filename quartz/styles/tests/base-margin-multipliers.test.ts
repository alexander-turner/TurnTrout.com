/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals"
import fs from "fs"
import path from "path"

const STYLES_DIR = path.join(process.cwd(), "quartz", "styles")

// A spacing coefficient must be dyadic: an integer n, or n ± 2^-k for a
// positive integer k (0.125, 0.75, 3.5 — not 0.1, 0.21, 0.3). Powers of two
// compose exactly in binary floating point and keep derived spacings on the
// same lattice, so nested calc() chains can't accumulate drift.
function isDyadic(coefficient: number): boolean {
  const fraction = Math.abs(coefficient - Math.round(coefficient))
  if (fraction === 0) return true
  return Number.isInteger(Math.log2(fraction))
}

const scssFiles = fs
  .readdirSync(STYLES_DIR, { recursive: true, encoding: "utf-8" })
  .filter((name) => name.endsWith(".scss"))

// Matches both operand orders: `0.5 * $base-margin` (with or without the
// `#{…}` interpolation wrapper) and `$base-margin * 0.5`.
const COEFFICIENT_BEFORE = /(-?\d+(?:\.\d+)?)\s*\*\s*(?:#\{)?\$base-margin/g
const COEFFICIENT_AFTER = /\$base-margin\}?\s*\*\s*(-?\d+(?:\.\d+)?)/g

interface Violation {
  location: string
  coefficient: number
}

function collectViolations(): Violation[] {
  const violations: Violation[] = []
  for (const file of scssFiles) {
    const lines = fs.readFileSync(path.join(STYLES_DIR, file), "utf-8").split("\n")
    lines.forEach((line, index) => {
      for (const pattern of [COEFFICIENT_BEFORE, COEFFICIENT_AFTER]) {
        for (const match of line.matchAll(pattern)) {
          const coefficient = Number(match[1])
          if (!isDyadic(coefficient)) {
            violations.push({ location: `${file}:${index + 1}`, coefficient })
          }
        }
      }
    })
  }
  return violations
}

describe("base-margin multipliers", () => {
  it.each([
    [1, true],
    [-4, true],
    [0.5, true],
    [0.125, true],
    [-0.125, true],
    [0.75, true],
    [3.5, true],
    [1.25, true],
    [0.0625, true],
    [0.1, false],
    [0.21, false],
    [0.3, false],
    [0.15, false],
    [0.375, false],
  ])("classifies %p as dyadic=%p", (coefficient, expected) => {
    expect(isDyadic(coefficient)).toBe(expected)
  })

  it("finds base-margin multiplications to lint (guards the regexes)", () => {
    let matches = 0
    for (const file of scssFiles) {
      const content = fs.readFileSync(path.join(STYLES_DIR, file), "utf-8")
      matches += [...content.matchAll(COEFFICIENT_BEFORE)].length
      matches += [...content.matchAll(COEFFICIENT_AFTER)].length
    }
    expect(matches).toBeGreaterThan(50)
  })

  it("every $base-margin multiplier is dyadic", () => {
    expect(collectViolations()).toEqual([])
  })
})
