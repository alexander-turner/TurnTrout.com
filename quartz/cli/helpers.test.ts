import { describe, it, expect } from "@jest/globals"

// @ts-expect-error -- helpers.js is a JavaScript file without types
import { escapePath } from "./helpers.js"

describe("escapePath", () => {
  it("should unescape backslash-escaped spaces", () => {
    expect(escapePath("path/to\\ file")).toBe("path/to file")
  })

  it("should remove surrounding double quotes", () => {
    expect(escapePath('"path/to/file"')).toBe("path/to/file")
  })

  it("should remove surrounding single quotes", () => {
    expect(escapePath("'path/to/file'")).toBe("path/to/file")
  })

  it("should handle double quotes with spaces inside", () => {
    expect(escapePath('"path/to/my file"')).toBe("path/to/my file")
  })

  it("should handle single quotes with spaces inside", () => {
    expect(escapePath("'path/to/my file'")).toBe("path/to/my file")
  })

  it("should trim whitespace", () => {
    expect(escapePath("  path/to/file  ")).toBe("path/to/file")
  })

  it("should handle combination of escaped spaces and quotes", () => {
    expect(escapePath('"path/to\\ file"')).toBe("path/to file")
  })

  it("should not remove unmatched quotes", () => {
    expect(escapePath('"path/to/file')).toBe('"path/to/file')
    expect(escapePath("path/to/file'")).toBe("path/to/file'")
  })

  it("should handle paths without special characters", () => {
    expect(escapePath("path/to/file")).toBe("path/to/file")
  })

  it("should handle empty strings", () => {
    expect(escapePath("")).toBe("")
  })

  it("should handle multiple escaped spaces", () => {
    expect(escapePath("path/to\\ my\\ file")).toBe("path/to my file")
  })
})
