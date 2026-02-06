import type { Element, Text } from "hast"

import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"

import { normalizeHastElement } from "./normalize-hast"
import { type FullSlug } from "./path"

describe("normalizeHastElement", () => {
  const baseSlug = "test/page" as FullSlug
  const newSlug = "other/page" as FullSlug

  it("should apply formatting improvements to text content", () => {
    const input = h("p", 'This is a test with quotes "like this" and dashes--here')
    const result = normalizeHastElement(input, baseSlug, newSlug)

    expect(result.children[0]).toMatchObject({
      type: "text",
      value: "This is a test with quotes “like this” and dashes—here",
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
      value: "A link with “quotes”",
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

  it("should rebase anchor-only links to point to original page", () => {
    const input = h("p", [h("a", { href: "#section" }, "Link to section")])

    const result = normalizeHastElement(input, baseSlug, newSlug)

    const child = result.children[0] as Element
    expect(child.properties?.href).toBe("../other/page#section")
  })

  it("should rebase multiple anchor links correctly", () => {
    const input = h("div", [
      h("a", { href: "#intro" }, "Intro"),
      h("a", { href: "#conclusion" }, "Conclusion"),
    ])

    const result = normalizeHastElement(input, baseSlug, newSlug)

    const firstLink = result.children[0] as Element
    const secondLink = result.children[1] as Element
    expect(firstLink.properties?.href).toBe("../other/page#intro")
    expect(secondLink.properties?.href).toBe("../other/page#conclusion")
  })

  it("should rebase anchor links in nested elements", () => {
    const input = h("div", [h("p", [h("a", { href: "#nested" }, "Nested anchor")])])

    const result = normalizeHastElement(input, baseSlug, newSlug)

    const paragraph = result.children[0] as Element
    const link = paragraph.children[0] as Element
    expect(link.properties?.href).toBe("../other/page#nested")
  })

  it("should not modify absolute URLs", () => {
    const input = h("p", [h("a", { href: "https://example.com" }, "Absolute link")])

    const result = normalizeHastElement(input, baseSlug, newSlug)

    const link = result.children[0] as Element
    expect(link.properties?.href).toBe("https://example.com")
  })
})
