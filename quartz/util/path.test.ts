import type { Element, Text } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"

import { specialFaviconPaths } from "../components/constants"
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

  // newSlug = "other/page" → prefix = "other-page"
  it.each(["h1", "h2", "h3", "h4", "h5", "h6"])(
    "prefixes id on transcluded %s with source-page slug to avoid host collisions",
    (tag) => {
      const input = h(tag, { id: "pre-commit" }, "pre-commit")
      const result = normalizeHastElement(input, baseSlug, newSlug)
      expect(result.properties?.id).toBe("other-page-pre-commit")
    },
  )

  it("prefixes ids from headings nested inside transcluded content", () => {
    const input = h("section", [h("h3", { id: "pre-commit" }, "pre-commit")])
    const result = normalizeHastElement(input, baseSlug, newSlug)
    const heading = result.children[0] as Element
    expect(heading.properties?.id).toBe("other-page-pre-commit")
  })

  it("preserves ids on non-heading transcluded elements", () => {
    const input = h("p", { id: "footnote-1" }, "body")
    const result = normalizeHastElement(input, baseSlug, newSlug)
    expect(result.properties?.id).toBe("footnote-1")
  })

  it.each(["h1", "h2", "h3", "h4", "h5", "h6"])(
    "updates the rehype-autolink-headings wrapper href to the prefixed id in transcluded %s",
    (tag) => {
      const input = h(tag, { id: "my-section" }, [h("a", { href: "#my-section" }, "My Section")])
      const result = normalizeHastElement(input, baseSlug, newSlug)
      const anchor = result.children[0] as Element
      expect(anchor.properties?.href).toBe("#other-page-my-section")
    },
  )

  it("still rebases non-autolink anchor-only hrefs inside headings to the source page", () => {
    // A user-authored link like [note](#footnote) inside a heading should still
    // rebase to the source page, since #footnote is defined there not on the host.
    const input = h("h2", { id: "my-section" }, [h("a", { href: "#footnote" }, "note")])
    const result = normalizeHastElement(input, baseSlug, newSlug)
    const anchor = result.children[0] as Element
    expect(anchor.properties?.href).toBe("../other/page#footnote")
  })

  describe("demotes within-page links rebased to the source page", () => {
    // Favicons are hand-constructed in createFaviconElement with a literal
    // "data-domain" key (not via hastscript), so mirror that shape exactly.
    const faviconNode = (domain: string, maskUrl: string): Element => ({
      type: "element",
      tagName: "svg",
      children: [],
      properties: {
        class: "favicon",
        "data-domain": domain,
        style: `--mask-url: url(${maskUrl});`,
      },
    })
    const anchorFavicon = () => faviconNode("anchor", specialFaviconPaths.anchor)

    it("drops same-page-link and swaps the anchor favicon for the turntrout favicon", () => {
      const link = h(
        "a",
        { href: "#section", className: ["internal", "same-page-link", "can-trigger-popover"] },
        [h("span", { className: ["favicon-span"] }, ["Link", anchorFavicon()])],
      )
      const result = normalizeHastElement(h("p", [link]), baseSlug, newSlug)
      const anchor = result.children[0] as Element

      expect(anchor.properties?.href).toBe("../other/page#section")
      expect(anchor.properties?.className).toEqual(["internal", "can-trigger-popover"])

      const favicon = (anchor.children[0] as Element).children[1] as Element
      expect(favicon.properties?.["data-domain"]).toBe("turntrout_com")
      expect(favicon.properties?.style).toBe(`--mask-url: url(${specialFaviconPaths.turntrout});`)
    })

    it("drops same-page-link even when the link carries no favicon", () => {
      const link = h("a", { href: "#section", className: ["internal", "same-page-link"] }, "Link")
      const result = normalizeHastElement(h("p", [link]), baseSlug, newSlug)
      const anchor = result.children[0] as Element
      expect(anchor.properties?.className).toEqual(["internal"])
    })

    it("leaves favicons for other domains untouched", () => {
      const otherFavicon = faviconNode("wikipedia_org", "x")
      const link = h("a", { href: "#section", className: ["same-page-link"] }, [
        h("span", { className: ["favicon-span"] }, ["Link", otherFavicon]),
      ])
      const result = normalizeHastElement(h("p", [link]), baseSlug, newSlug)
      const favicon = ((result.children[0] as Element).children[0] as Element)
        .children[1] as Element
      expect(favicon.properties?.["data-domain"]).toBe("wikipedia_org")
    })

    it("does not demote non-anchor elements that carry an anchor-only href", () => {
      const div = h("div", { href: "#section", className: ["same-page-link"] }, "x")
      const result = normalizeHastElement(h("section", [div]), baseSlug, newSlug)
      const child = result.children[0] as Element
      expect(child.properties?.href).toBe("../other/page#section")
      expect(child.properties?.className).toEqual(["same-page-link"])
    })
  })
})
