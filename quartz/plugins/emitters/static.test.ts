import { describe, it, expect } from "@jest/globals"

import { type FilePath } from "../../util/path"
import { buildStaticScriptDefines, isLocalFavicon, shouldCopyToRoot } from "./static"

describe("isLocalFavicon", () => {
  it.each([
    { file: "favicon.ico", expected: true },
    { file: "favicon.png", expected: true },
    { file: "favicon.svg", expected: true },
    { file: "favicon.webp", expected: true },
    { file: "robots.txt", expected: false },
    { file: "script.js", expected: false },
    { file: "styles/main.css", expected: false },
    { file: "my-favicon.ico", expected: false },
    { file: "favicon", expected: false },
  ])("returns $expected for $file", ({ file, expected }) => {
    expect(isLocalFavicon(file as FilePath)).toBe(expected)
  })
})

describe("shouldCopyToRoot", () => {
  it.each([
    // ROOT_FILES
    { file: "robots.txt", expected: true },
    { file: "_headers", expected: true },
    { file: "_redirects", expected: true },
    // Favicon files
    { file: "favicon.ico", expected: true },
    { file: "favicon.png", expected: true },
    // Files that should go to /static/
    { file: "script.js", expected: false },
    { file: "styles/main.css", expected: false },
    { file: "images/logo.png", expected: false },
    { file: "fonts/font.woff2", expected: false },
  ])("returns $expected for $file", ({ file, expected }) => {
    expect(shouldCopyToRoot(file as FilePath)).toBe(expected)
  })
})

describe("buildStaticScriptDefines", () => {
  it("produces valid JSON string values for esbuild define", () => {
    const defines = buildStaticScriptDefines()

    // Each value should be a valid JSON-encoded string (double-quoted for esbuild)
    for (const value of Object.values(defines)) {
      expect(() => JSON.parse(value)).not.toThrow()
    }
  })
})
