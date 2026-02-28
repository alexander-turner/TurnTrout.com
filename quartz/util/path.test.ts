import type { Element, Text } from "hast"

import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"

import { type FullSlug, normalizeHastElement } from "./path"

describe("normalizeHastElement", () => {
  const baseSlug = "test/page" as FullSlug
  const newSlug = "other/page" as FullSlug

  it("should not re-apply formatting to already-formatted content", () => {
    const input = h("p", 'Text with "quotes" and dashes--here')
    const result = normalizeHastElement(input, baseSlug, newSlug)

    // Content should be preserved as-is since htmlAst is already formatted
    expect(result.children[0]).toMatchObject({
      type: "text",
      value: 'Text with "quotes" and dashes--here',
    })
  })

  it("should rebase links without modifying text content", () => {
    const input = h("p", [h("a", { href: "../some/link" }, 'A link with "quotes"')])

    const result = normalizeHastElement(input, baseSlug, newSlug)

    // Check that link is rebased
    const child = result.children[0] as Element
    expect(child.properties?.href).toBe("../other/page/../../some/link")

    // Check that text content is preserved as-is
    expect(child.children[0]).toMatchObject({
      type: "text",
      value: 'A link with "quotes"',
    })
  })

  it("should handle nested elements without reformatting", () => {
    const input = h("div", [h("p", "Nested text with -- dashes")])

    const result = normalizeHastElement(input, baseSlug, newSlug)

    const child = result.children[0] as Element
    expect(child.children[0]).toMatchObject({
      type: "text",
      value: "Nested text with -- dashes",
    })
  })

  it("should not modify the original element", () => {
    const input = h("p", 'Original "quotes"')
    const textChild = input.children[0] as Text
    const originalValue = textChild.value

    normalizeHastElement(input, baseSlug, newSlug)
    expect(textChild.value).toBe(originalValue)
  })

  it("should preserve text inside <code> descendants (ancestor context bug)", () => {
    // Regression: the old code recursively called normalizeHastElement on each
    // child, which ran improveFormatting() on children stripped from their parent
    // tree. A <span> inside <code> would lose the <code> ancestor context and
    // get smart-quoted even though <code> should suppress formatting.
    const input = h("code", [h("span", 'x = "hello" -- world')])
    const result = normalizeHastElement(input, baseSlug, newSlug)

    const span = result.children[0] as Element
    expect(span.children[0]).toMatchObject({
      type: "text",
      value: 'x = "hello" -- world',
    })
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
