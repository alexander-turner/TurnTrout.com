import type { Element, Text } from "hast"

import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"

import { type FullSlug, normalizeHastElement } from "./path"

describe("normalizeHastElement", () => {
  const baseSlug = "test/page" as FullSlug
  const newSlug = "other/page" as FullSlug

  it("should apply formatting improvements to text content", () => {
    const input = h("p", 'This is a test with quotes "like this" and dashes--here')
    const result = normalizeHastElement(input, baseSlug, newSlug)

    expect(result.children[0]).toMatchObject({
      type: "text",
      value: "This is a test with quotes “like this” and dashes—here",
    })
  })

  it("should preserve and rebase links while applying formatting", () => {
    const input = h("p", [h("a", { href: "../some/link" }, 'A link with "quotes"')])

    const result = normalizeHastElement(input, baseSlug, newSlug)

    // Check that link is rebased
    const child = result.children[0] as Element
    expect(child.properties?.href).toBe("../other/page/../../some/link")

    // Check that text formatting is applied within the link
    expect(child.children[0]).toMatchObject({
      type: "text",
      value: "A link with “quotes”",
    })
  })

  it("should handle nested elements", () => {
    const input = h("div", [h("p", "Nested text with -- dashes")])

    const result = normalizeHastElement(input, baseSlug, newSlug)

    const child = result.children[0] as Element
    expect(child.children[0]).toMatchObject({
      type: "text",
      value: "Nested text with—dashes",
    })
  })

  it("should not modify the original element", () => {
    const input = h("p", 'Original "quotes"')
    const textChild = input.children[0] as Text
    const originalValue = textChild.value

    normalizeHastElement(input, baseSlug, newSlug)
    expect(textChild.value).toBe(originalValue)
  })

  it.each([
    ["simple anchor", "#section", "../other/page#section"],
    ["intro anchor", "#intro", "../other/page#intro"],
    ["conclusion anchor", "#conclusion", "../other/page#conclusion"],
    ["nested anchor", "#nested", "../other/page#nested"],
  ])("should rebase anchor-only link %s to point to original page", (_, href, expected) => {
    const input = h("p", [h("a", { href }, "Link")])
    const result = normalizeHastElement(input, baseSlug, newSlug)

    const child = result.children[0] as Element
    expect(child.properties?.href).toBe(expected)
  })
})
