import { describe, expect, it } from "@jest/globals"

import { type LinkAnnotation, validateLinkAnnotations } from "./annotations"

function annotation(overrides: Partial<LinkAnnotation> = {}): LinkAnnotation {
  return {
    source: "wikipedia",
    title: "Reinforcement learning",
    abstract_html: "<p>Reinforcement learning is…</p>",
    attribution: {
      text: "Wikipedia",
      license: "CC BY-SA 4.0",
      license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
    retrieved: "2026-07-05",
    ...overrides,
  }
}

describe("validateLinkAnnotations", () => {
  const KEY = "https://en.wikipedia.org/wiki/Reinforcement_learning"

  it("returns a map of validated entries", () => {
    const result = validateLinkAnnotations({ [KEY]: annotation() }, "test.json")
    expect(result.get(KEY)).toEqual(annotation())
  })

  it("accepts an empty object", () => {
    expect(validateLinkAnnotations({}, "test.json").size).toBe(0)
  })

  it.each([
    ["a JSON array", []],
    ["a JSON scalar", "hello"],
    ["a JSON null", null],
  ])("throws when the root is %s", (_desc, parsed) => {
    expect(() => validateLinkAnnotations(parsed, "test.json")).toThrow("must contain a JSON object")
  })

  it.each([
    ["a scalar", 5],
    ["null", null],
    ["an array", []],
  ])("throws when an entry is %s", (_desc, value) => {
    expect(() => validateLinkAnnotations({ [KEY]: value }, "test.json")).toThrow(
      "must be an object",
    )
  })

  it.each(["source", "title", "abstract_html", "retrieved"] as const)(
    "throws when %s is missing or empty",
    (field) => {
      const missing = { ...annotation() } as Record<string, unknown>
      delete missing[field]
      expect(() => validateLinkAnnotations({ [KEY]: missing }, "test.json")).toThrow(
        `field "${field}" must be a non-empty string`,
      )
      expect(() =>
        validateLinkAnnotations({ [KEY]: annotation({ [field]: "" }) }, "test.json"),
      ).toThrow(`field "${field}" must be a non-empty string`)
    },
  )

  it.each([
    ["missing", undefined],
    ["null", null],
    ["a scalar", "CC BY-SA"],
  ])("throws when attribution is %s", (_desc, attribution) => {
    const entry = { ...annotation(), attribution } as Record<string, unknown>
    expect(() => validateLinkAnnotations({ [KEY]: entry }, "test.json")).toThrow(
      'field "attribution" must be an object',
    )
  })

  it.each(["text", "license", "license_url"] as const)(
    "throws when attribution.%s is missing",
    (field) => {
      const attribution = { ...annotation().attribution } as Record<string, unknown>
      delete attribution[field]
      expect(() =>
        validateLinkAnnotations({ [KEY]: { ...annotation(), attribution } }, "test.json"),
      ).toThrow(`field "${field}" must be a non-empty string`)
    },
  )

  it("includes the source path and key in error messages", () => {
    expect(() => validateLinkAnnotations({ [KEY]: null }, "my-file.json")).toThrow(
      `my-file.json entry for ${KEY}`,
    )
  })
})
