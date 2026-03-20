import type { Root, Element, ElementContent } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"
import rehypeParse from "rehype-parse"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import {
  FixFootnotes,
  isFootnoteListItem,
  findFootnoteList,
  hasFootnoteHeading,
  createFootnoteHeading,
  addHeadingToSection,
  isAlreadyWrapped,
  createFootnoteSection,
  cleanupIframeFootnoteText,
} from "./fixFootnotes"

const parseHtml = (html: string): Root => {
  return unified().use(rehypeParse, { fragment: true }).parse(html) as Root
}

const stringifyHtml = (tree: Root): string => {
  return String(unified().use(rehypeStringify).stringify(tree))
}

const processHtmlWithPlugin = async (html: string): Promise<string> => {
  const plugin = FixFootnotes()
  const mockCtx = {} as never
  const htmlPlugins = plugin.htmlPlugins?.(mockCtx)
  if (!htmlPlugins || htmlPlugins.length === 0) {
    throw new Error("No HTML plugin returned")
  }

  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(htmlPlugins)
    .use(rehypeStringify)

  return String(await processor.process(html))
}

const footnoteListItem = (id = "user-content-fn-1") =>
  h("li", { id }, ["Content"]) as ElementContent

const footnoteList = () => h("ol", [footnoteListItem()]) as Element

const footnoteSection = (hasHeading = true) =>
  h("section", { dataFootnotes: true, className: ["footnotes"] }, [
    ...(hasHeading ? [h("h1", { id: "footnote-label" }, ["Footnotes"])] : []),
    footnoteList(),
  ]) as Element

describe("FixFootnotes helpers", () => {
  describe("isFootnoteListItem", () => {
    it.each([
      [footnoteListItem(), true, "footnote list item"],
      [
        h("li", { id: "regular-item" }, ["Content"]) as ElementContent,
        false,
        "list item without footnote ID",
      ],
      [h("p", ["Content"]) as ElementContent, false, "non-list-item element"],
    ])("returns %s for %s", (element, expected) => {
      expect(isFootnoteListItem(element)).toBe(expected)
    })
  })

  describe("hasFootnoteHeading", () => {
    it.each([
      [footnoteSection(true), true, "section with h1 heading"],
      [footnoteSection(false), false, "section without heading"],
      [
        h("section", [h("h1", { id: "wrong-id" }, ["Footnotes"]), footnoteList()]) as Element,
        false,
        "section with wrong heading id",
      ],
      [
        h("section", [h("h1", { id: undefined }, ["Footnotes"]), footnoteList()]) as Element,
        false,
        "section with undefined heading id",
      ],
      [
        h("section", [h("h2", { id: "footnote-label" }, ["Footnotes"]), footnoteList()]) as Element,
        true,
        "section with h2 heading using upstream footnote-label id",
      ],
      [
        h("section", [h("h2", { id: "footnotes" }, ["Footnotes"]), footnoteList()]) as Element,
        true,
        "section with h2 heading using normalized footnotes id",
      ],
    ])("returns %s for %s", (section, expected) => {
      expect(hasFootnoteHeading(section)).toBe(expected)
    })

    it("detects heading in parsed HTML", () => {
      const html =
        '<section><h1 id="footnote-label">Footnotes</h1><ol><li id="user-content-fn-1">Content</li></ol></section>'
      const tree = parseHtml(html)
      const section = tree.children[0] as Element
      expect(hasFootnoteHeading(section)).toBe(true)
    })
  })

  describe("createFootnoteHeading", () => {
    it("creates h1 with correct id, class, and text", () => {
      const heading = createFootnoteHeading()
      expect(heading.tagName).toBe("h1")
      expect(heading.properties?.id).toBe("footnotes") // normalized ID
      expect(heading.properties?.className).toContain("sr-only")
      expect(heading.children[0]).toEqual({ type: "text", value: "Footnotes" })
    })
  })

  describe("addHeadingToSection", () => {
    it("adds heading when missing", () => {
      const section = footnoteSection(false)
      addHeadingToSection(section)
      expect(hasFootnoteHeading(section)).toBe(true)
      expect(section.children.length).toBe(2)
    })

    it("does not add duplicate heading", () => {
      const section = footnoteSection(true)
      const initialLength = section.children.length
      addHeadingToSection(section)
      expect(hasFootnoteHeading(section)).toBe(true)
      expect(section.children.length).toBe(initialLength)
    })

    it("upgrades h2 to h1 and normalizes id", () => {
      const section = h("section", { dataFootnotes: true, className: ["footnotes"] }, [
        h("h2", { id: "footnote-label" }, ["Footnotes"]),
        footnoteList(),
      ]) as Element
      addHeadingToSection(section)
      const heading = section.children[0] as Element
      expect(heading.tagName).toBe("h1")
      expect(heading.properties?.id).toBe("footnotes")
      expect(heading.properties?.className).toContain("sr-only")
      expect(section.children.length).toBe(2)
    })
  })

  describe("isAlreadyWrapped", () => {
    it.each([
      [h("section", { dataFootnotes: true }, []) as Element, true, "proper footnote section"],
      [h("section", []) as Element, false, "section without dataFootnotes"],
      [h("div", { dataFootnotes: true }, []) as Element, false, "non-section element"],
    ])("returns %s for %s", (parent, expected) => {
      expect(isAlreadyWrapped(parent)).toBe(expected)
    })

    it("returns true for section with data-footnotes from parsed HTML", () => {
      const html = '<section data-footnotes class="footnotes"></section>'
      const tree = parseHtml(html)
      const section = tree.children[0] as Element
      expect(isAlreadyWrapped(section)).toBe(true)
    })
  })

  describe("createFootnoteSection", () => {
    it("creates section with heading and list", () => {
      const section = createFootnoteSection(footnoteList())
      expect(section.tagName).toBe("section")
      expect(section.properties?.dataFootnotes).toBe(true)
      expect(section.children.length).toBe(2)
      expect(hasFootnoteHeading(section)).toBe(true)
    })
  })

  describe("cleanupIframeFootnoteText", () => {
    it.each([
      [
        "<iframe>Footnotes</iframe>",
        (result: string) => expect(result).not.toContain("Footnotes"),
        "removes 'Footnotes' text",
      ],
      [
        "<iframe>   </iframe>",
        (result: string) => expect(result).toContain("<iframe></iframe>"),
        "removes empty text nodes",
      ],
      [
        "<iframe>Keep this</iframe>",
        (result: string) => expect(result).toContain("Keep this"),
        "preserves other text",
      ],
      [
        "<iframe>Some other content here</iframe>",
        (result: string) => {
          expect(result).toContain("Some other content here")
          expect(result).not.toContain("Footnotes")
        },
        "preserves non-Footnotes text",
      ],
      [
        "<iframe>Keep this   </iframe>",
        (result: string) => expect(result).toContain("Keep this"),
        "handles mixed text and whitespace",
      ],
    ])("%s", (html, assertion) => {
      const tree = parseHtml(html)
      cleanupIframeFootnoteText(tree)
      const result = stringifyHtml(tree)
      assertion(result)
    })
  })

  describe("findFootnoteList", () => {
    it("finds footnote list", () => {
      const html = '<p>Text</p><ol><li id="user-content-fn-1">Footnote</li></ol>'
      const tree = parseHtml(html)
      const location = findFootnoteList(tree)
      expect(location).not.toBeNull()
      expect(location?.node.tagName).toBe("ol")
    })

    it("returns null when no footnote list exists", () => {
      const html = '<p>Text</p><ol><li id="regular">Item</li></ol>'
      const tree = parseHtml(html)
      const location = findFootnoteList(tree)
      expect(location).toBeNull()
    })
  })
})

describe("FixFootnotes plugin", () => {
  const fixtures = {
    orphanedFootnotes: `
      <p>Text with footnote<sup><a href="#user-content-fn-1" id="user-content-fnref-1">1</a></sup></p>
      <iframe src="https://example.com" title="Form"></iframe>
      <ol>
        <li id="user-content-fn-1">
          <p>Footnote content <a href="#user-content-fnref-1">↩</a></p>
        </li>
      </ol>
    `,
    wrappedFootnotes: `
      <section data-footnotes class="footnotes">
        <h1 id="footnote-label" class="sr-only">Footnotes</h1>
        <ol>
          <li id="user-content-fn-1">
            <p>Footnote content <a href="#user-content-fnref-1">↩</a></p>
          </li>
        </ol>
      </section>
    `,
    wrappedWithH2: `
      <section data-footnotes class="footnotes">
        <h2 id="footnote-label">Footnotes</h2>
        <ol>
          <li id="user-content-fn-1">
            <p>Footnote content <a href="#user-content-fnref-1">↩</a></p>
          </li>
        </ol>
      </section>
    `,
    iframeWithFootnotes: `
      <iframe src="https://example.com">Footnotes</iframe>
      <ol>
        <li id="user-content-fn-1">
          <p>Footnote content</p>
        </li>
      </ol>
    `,
    sectionWithoutHeading: `
      <section data-footnotes>
        <ol>
          <li id="user-content-fn-1">
            <p>Footnote content</p>
          </li>
        </ol>
      </section>
    `,
    withAriaDescribedBy: `
      <p>Text<sup><a href="#user-content-fn-1" id="user-content-fnref-1" data-footnote-ref aria-describedby="footnote-label other-desc">1</a></sup></p>
      <section data-footnotes class="footnotes">
        <h2 id="footnote-label">Footnotes</h2>
        <ol>
          <li id="user-content-fn-1"><p>Content</p></li>
        </ol>
      </section>
    `,
    noFootnotes: `
      <p>Just regular content</p>
      <iframe src="https://example.com"></iframe>
    `,
  }

  it.each([
    [
      fixtures.orphanedFootnotes,
      (result: string) => {
        expect(result).toContain("<section data-footnotes")
        expect(result).toContain('id="footnotes"')
        expect(result).toContain("<h1")
        expect(result).toContain("Footnotes")
      },
      "wraps orphaned footnote list in proper section with heading",
    ],
    [
      fixtures.wrappedFootnotes,
      (result: string) => {
        expect(result).toContain("<section data-footnotes")
        expect(result).toContain('id="footnotes"')
        const h1Count = (result.match(/<h1/g) || []).length
        expect(h1Count).toBe(1)
      },
      "preserves already wrapped footnotes, renaming heading id",
    ],
    [
      fixtures.wrappedWithH2,
      (result: string) => {
        expect(result).toContain("<h1")
        expect(result).not.toContain("<h2")
        expect(result).toContain('id="footnotes"')
        expect(result).toContain("sr-only")
      },
      "upgrades h2 heading to h1 and normalizes id",
    ],
    [
      fixtures.iframeWithFootnotes,
      (result: string) => {
        expect(result).not.toMatch(/<iframe[^>]*>Footnotes<\/iframe>/)
        expect(result).toContain("<section data-footnotes")
      },
      "cleans up 'Footnotes' text from iframe children",
    ],
    [
      fixtures.sectionWithoutHeading,
      (result: string) => {
        expect(result).toContain('id="footnotes"')
        expect(result).toContain("<h1")
      },
      "adds heading to section missing it",
    ],
    [
      fixtures.withAriaDescribedBy,
      (result: string) => {
        expect(result).toContain('aria-describedby="footnotes other-desc"')
        expect(result).not.toContain('aria-describedby="footnote-label')
        expect(result).toContain('id="footnotes"')
      },
      "renames aria-describedby, preserving other values",
    ],
    [
      fixtures.noFootnotes,
      (result: string) => {
        expect(result).not.toContain("footnote")
        expect(result).toContain("iframe")
      },
      "handles documents without footnotes",
    ],
  ])("%s", async (input, assertion) => {
    const result = await processHtmlWithPlugin(input)
    assertion(result)
  })
})
