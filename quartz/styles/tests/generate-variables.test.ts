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

      expect(() => generateScss()).toThrow(testError)
    })
  })
})
