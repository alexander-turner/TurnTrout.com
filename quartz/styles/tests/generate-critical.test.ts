/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals"
jest.mock("fs")
import fs from "fs"
import path from "path"

import { generateCritical } from "../generate-critical"

describe("Critical SCSS Generation", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  describe("generateCritical()", () => {
    it("should write critical.scss with correct structure and SCSS variables", () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      generateCritical()

      expect(writeSpy).toHaveBeenCalledTimes(1)

      const [filePath, fileContent] = writeSpy.mock.calls[0]
      expect(path.basename(filePath as string)).toBe("critical.scss")

      const content = fileContent as string

      // Check for SCSS variable usage
      expect(content).toContain("$midground-faint-light")
      expect(content).toContain("$midground-light")
      expect(content).toContain("$midground-faint-dark")
      expect(content).toContain("$midground-dark")
      expect(content).toContain("$top-spacing")
      expect(content).toContain("$min-desktop-width")
      expect(content).toContain("$max-sidebar-gap")
      expect(content).toContain("$left-sidebar-width")
      expect(content).toContain("$right-sidebar-width")
      expect(content).toContain("$page-width")
      expect(content).toContain("$wider-gap-breakpoint")

      // Check for dropcap variable usage
      expect(content).toContain("$dropcap-vertical-offset")
      expect(content).toContain("$dropcap-font-size")
      expect(content).toContain("$dropcap-min-height")

      // Check for key CSS selectors
      expect(content).toContain(":root {")
      expect(content).toContain(':root[data-theme="light"]')
      expect(content).toContain(':root[data-theme="dark"]')
      expect(content).toContain("article[data-use-dropcap")
      expect(content).toContain(".sidebar {")
      expect(content).toContain("#quartz-body {")

      // Verify no hardcoded dropcap values
      expect(content).not.toContain("0.15rem")
      expect(content).not.toContain("3.95rem")
      expect(content).not.toContain("4.2rem")

      // Verify data-theme is used (not saved-theme)
      expect(content).toContain('data-theme="light"')
      expect(content).toContain('data-theme="dark"')
      expect(content).not.toContain("saved-theme")
    })

    it("should include responsive layout styles", () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      generateCritical()

      const content = writeSpy.mock.calls[0][1] as string

      // Check for media queries
      expect(content).toContain("@media all and (min-width: $min-desktop-width)")
      expect(content).toContain("@media all and (min-width: $wider-gap-breakpoint)")

      // Check for sidebar layout styles
      expect(content).toContain("#left-sidebar")
      expect(content).toContain("#right-sidebar")
      expect(content).toContain("#center-content")
    })

    it("should include dropcap styles", () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      generateCritical()

      const content = writeSpy.mock.calls[0][1] as string

      // Check for dropcap-related CSS
      expect(content).toContain("--font-dropcap-foreground")
      expect(content).toContain("--font-dropcap-background")
      expect(content).toContain("::first-letter")
      expect(content).toContain("::first-line")
      expect(content).toContain("EBGaramondInitialsF2")
      expect(content).toContain("EBGaramondInitialsF1")
    })

    it("should include font family declarations", () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      generateCritical()

      const content = writeSpy.mock.calls[0][1] as string

      expect(content).toContain("FiraCode__subset")
      expect(content).toContain("EBGaramond__subset")
      expect(content).toContain("EBGaramondItalic__subset")
    })

    it("should throw an error if file writing fails", () => {
      const testError = new Error("Permission denied")
      jest.spyOn(fs, "writeFileSync").mockImplementation(() => {
        throw testError
      })

      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {
        /* quiet the output */
      })

      expect(() => generateCritical()).toThrow(testError)
      errorSpy.mockRestore()
    })
  })

  describe("Content structure", () => {
    it("should have proper SCSS interpolation syntax", () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      generateCritical()

      const content = writeSpy.mock.calls[0][1] as string

      // Check for proper SCSS interpolation with #{...}
      expect(content).toContain("#{$")

      // Check that variables in media queries don't use interpolation
      expect(content).toMatch(/@media all and \(min-width: \$min-desktop-width\)/)
    })

    it("should include midground color variables for both themes", () => {
      const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined)

      generateCritical()

      const content = writeSpy.mock.calls[0][1] as string

      // Both themes should define --midground-faint and --midground
      const lightThemeBlock = content.match(/:root\[data-theme="light"\]\s*\{[^}]+\}/s)
      const darkThemeBlock = content.match(/:root\[data-theme="dark"\]\s*\{[^}]+\}/s)

      expect(lightThemeBlock).toBeTruthy()
      expect(darkThemeBlock).toBeTruthy()

      expect(lightThemeBlock?.[0]).toContain("--midground-faint")
      expect(lightThemeBlock?.[0]).toContain("--midground")
      expect(darkThemeBlock?.[0]).toContain("--midground-faint")
      expect(darkThemeBlock?.[0]).toContain("--midground")
    })
  })
})
