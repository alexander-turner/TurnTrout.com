import { describe, expect, it } from "@jest/globals"

import { uiStrings } from "../components/constants"
import { parseFrontmatter, resolveTitle } from "./frontmatter"

describe("parseFrontmatter", () => {
  it("parses YAML frontmatter with the default options", () => {
    const data = parseFrontmatter("---\ntitle: Hello\ntags:\n  - a\n---\n\nbody")
    expect(data.title).toBe("Hello")
    expect(data.tags).toEqual(["a"])
  })

  it("parses TOML frontmatter", () => {
    const data = parseFrontmatter('+++\ntitle = "Toml Title"\n+++\n\nbody', {
      delimiters: "+++",
      language: "toml",
    })
    expect(data.title).toBe("Toml Title")
  })

  it("returns an empty object when there is no frontmatter", () => {
    expect(parseFrontmatter("just body text")).toEqual({})
  })
})

describe("resolveTitle", () => {
  it.each([
    [{ title: "Real Title" }, "stem", "Real Title"],
    [{ title: 1984 }, "stem", "1984"],
    [{ title: "" }, "stem", "stem"],
    [{}, "stem", "stem"],
    [{}, undefined, uiStrings.propertyDefaults.title],
  ])("resolveTitle(%j, %j) -> %j", (data, stem, expected) => {
    expect(resolveTitle(data, stem)).toBe(expected)
  })
})
