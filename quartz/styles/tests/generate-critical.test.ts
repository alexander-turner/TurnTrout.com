/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
jest.mock("fs")
import fs from "fs"
import path from "path"

import { generateCritical } from "../generate-critical"

describe("Critical SCSS Generation", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  describe("generateCritical()", () => {
    it("should generate critical.scss with correct content", async () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      await generateCritical()

      expect(writeSpy).toHaveBeenCalledTimes(1)

      const [filePath, fileContent] = writeSpy.mock.calls[0]
      expect(path.basename(filePath as string)).toBe("critical.scss")

      const content = fileContent as string
      expect(content).toMatchSnapshot()
    })

    it("should throw an error if file writing fails", async () => {
      const testError = new Error("Permission denied")
      jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
        throw testError
      })

      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {
        /* quiet the output */
      })

      await expect(generateCritical()).rejects.toThrow(testError)
      errorSpy.mockRestore()
    })
  })

  describe("Content structure", () => {
    it("should have proper SCSS interpolation syntax", async () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      await generateCritical()

      const content = writeSpy.mock.calls[0][1] as string

      // Check for proper SCSS interpolation with #{...}
      expect(content).toContain("#{$")

      // Check that variables in media queries don't use interpolation
      expect(content).toMatch(/@media all and \(min-width: \$min-desktop-width\)/)
    })

    it("should include midground color variables for both themes", async () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      await generateCritical()

      const content = writeSpy.mock.calls[0][1] as string

      // Both themes should define --midground-faint and --midground
      const lightThemeBlock = content.match(/:root\[data-theme="light"\]\s*\{[^}]+\}/)
      const darkThemeBlock = content.match(/:root\[data-theme="dark"\]\s*\{[^}]+\}/)

      expect(lightThemeBlock).not.toBeNull()
      expect(darkThemeBlock).not.toBeNull()

      expect(lightThemeBlock?.[0]).toContain("--midground-faint")
      expect(lightThemeBlock?.[0]).toContain("--midground")
      expect(darkThemeBlock?.[0]).toContain("--midground-faint")
      expect(darkThemeBlock?.[0]).toContain("--midground")
    })
  })
})
