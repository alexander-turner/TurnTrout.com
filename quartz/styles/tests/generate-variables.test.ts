/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals"
jest.mock("fs")
import fs from "fs"
import path from "path"

import { generateScss, generateScssRecord } from "../generate-variables"
import { variables as styleVars } from "../variables"

describe("SCSS Variable Generation", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    Object.assign(styleVars, {
      baseMargin: 8,
      pageWidth: 720,
      someOtherVar: "blue",
      boldWeight: 700,
      fontScaleFactor: 1.2,
    })
  })

  describe("generateScssRecord()", () => {
    it("should correctly format variables with and without units", () => {
      const record = generateScssRecord()
      expect(record).toMatchObject({
        "base-margin": "8px",
        "page-width": "720px",
        "some-other-var": "blue",
        "bold-weight": "700",
        "font-scale-factor": "1.2",
      })
    })
  })

  describe("generateScss()", () => {
    it("should write correctly formatted SCSS to the default variables.scss file", () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      generateScss()

      expect(writeSpy).toHaveBeenCalledTimes(1)

      const [filePath, fileContent] = writeSpy.mock.calls[0]
      expect(path.basename(filePath as string)).toBe("variables.scss")
      expect(fileContent).toContain("$base-margin: 8px;")
      expect(fileContent).toContain("$page-width: 720px;")
      expect(fileContent).toContain("$some-other-var: blue;")
      expect(fileContent).toContain("$bold-weight: 700;")
      expect(fileContent).toContain("$font-scale-factor: 1.2;")
    })

    it("should throw an error if file writing fails", () => {
      const testError = new Error("Disk full")
      jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
        throw testError
      })

      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {
        /* quiet the output */
      })
      expect(() => generateScss()).toThrow(testError)
      errorSpy.mockRestore()
    })
  })

  describe("toKebabCase function", () => {
    it("should convert camelCase to kebab-case", () => {
      const records = generateScssRecord()

      // Test that camelCase keys are converted to kebab-case
      expect(records).toHaveProperty("base-margin")
      expect(records).toHaveProperty("page-width")
      expect(records).toHaveProperty("some-other-var")
      expect(records).toHaveProperty("bold-weight")
      expect(records).toHaveProperty("font-scale-factor")

      // Ensure camelCase keys are not present
      expect(records).not.toHaveProperty("baseMargin")
      expect(records).not.toHaveProperty("pageWidth")
      expect(records).not.toHaveProperty("someOtherVar")
      expect(records).not.toHaveProperty("boldWeight")
      expect(records).not.toHaveProperty("fontScaleFactor")
    })
  })

  describe("unitlessKeys handling", () => {
    it("should not add px units to unitless properties", () => {
      const records = generateScssRecord()

      // These should not have units added
      expect(records["bold-weight"]).toBe("700")
      expect(records["font-scale-factor"]).toBe("1.2")

      // These should have px units added
      expect(records["base-margin"]).toBe("8px")
      expect(records["page-width"]).toBe("720px")
    })
  })

  describe("Edge cases and robustness", () => {
    it("should handle variables with undefined values", () => {
      const originalVars = { ...styleVars }
      try {
        // Test with variables that have undefined values
        Object.assign(styleVars, {
          undefinedVar: undefined,
          nullVar: null,
        })

        const record = generateScssRecord()
        expect(record["undefined-var"]).toBe("undefined")
        expect(record["null-var"]).toBe("null")
      } finally {
        Object.assign(styleVars, originalVars)
      }
    })

    it("should handle special characters in variable values", () => {
      const originalVars = { ...styleVars }
      try {
        Object.assign(styleVars, {
          specialValue: "rgba(255, 0, 0, 0.5)",
          quotedValue: '"Helvetica Neue"',
          unicodeValue: "🎨",
        })

        const record = generateScssRecord()
        expect(record["special-value"]).toBe("rgba(255, 0, 0, 0.5)")
        expect(record["quoted-value"]).toBe('"Helvetica Neue"')
        expect(record["unicode-value"]).toBe("🎨")
      } finally {
        Object.assign(styleVars, originalVars)
      }
    })

    it("should handle zero values correctly", () => {
      const originalVars = { ...styleVars }
      try {
        Object.assign(styleVars, {
          zeroMargin: 0,
          normalWeight: 0, // This should be unitless based on the unitlessKeys set
        })

        const record = generateScssRecord()
        expect(record["zero-margin"]).toBe("0px")
        expect(record["normal-weight"]).toBe("0")
      } finally {
        Object.assign(styleVars, originalVars)
      }
    })
  })
})
