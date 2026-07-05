import { describe, expect, it } from "@jest/globals"

import { validateLinkAnnotations } from "./annotations"
import {
  testAnnotation as annotation,
  TEST_ANNOTATION_KEY as KEY,
} from "./tests/annotationFixtures"

describe("validateLinkAnnotations", () => {
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

  it.each([
    ["plain paragraph", "<p>Escaped &lt;text&gt; only</p>"],
    ["allowed formatting tags", "<p>Uses <em>em</em>, <strong>strong</strong>, <sub>s</sub></p>"],
    ["uppercase allowed tags", "<P>Shouting</P>"],
    ["no tags at all", "Just text"],
  ])("accepts abstract_html with %s", (_desc, abstractHtml) => {
    const entry = annotation({ abstract_html: abstractHtml })
    expect(validateLinkAnnotations({ [KEY]: entry }, "test.json").get(KEY)).toEqual(entry)
  })

  it.each([
    ["a script tag", "<p><script>alert(1)</script></p>"],
    ["an img tag", '<p><img src="x"></p>'],
    ["an attribute on an allowed tag", '<p onclick="x">text</p>'],
    ["a stray angle bracket", "<p>a < b</p>"],
  ])("rejects abstract_html containing %s", (_desc, abstractHtml) => {
    expect(() =>
      validateLinkAnnotations({ [KEY]: annotation({ abstract_html: abstractHtml }) }, "test.json"),
    ).toThrow("abstract_html may only contain attribute-free")
  })

  it.each([
    ["a javascript: URL", "javascript:alert(1)", "must use https"],
    ["an http URL", "http://example.com/license", "must use https"],
    ["an unparseable URL", "not a url", "must be a valid URL"],
  ])("rejects attribution.license_url that is %s", (_desc, licenseUrl, message) => {
    const attribution = { ...annotation().attribution, license_url: licenseUrl }
    expect(() =>
      validateLinkAnnotations({ [KEY]: { ...annotation(), attribution } }, "test.json"),
    ).toThrow(message)
  })

  it("rejects an unparseable retrieved date", () => {
    expect(() =>
      validateLinkAnnotations({ [KEY]: annotation({ retrieved: "not-a-date" }) }, "test.json"),
    ).toThrow('field "retrieved" must be a parseable date')
  })
})
