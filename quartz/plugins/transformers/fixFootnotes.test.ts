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

const parseHtml = async (html: string): Promise<Root> => {
  return unified().use(rehypeParse, { fragment: true }).parse(html) as Root
}

const stringifyHtml = async (tree: Root): Promise<string> => {
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
        h("section", [h("h2", { id: "footnote-label" }, ["Footnotes"]), footnoteList()]) as Element,
        true,
        "section with h2 heading (remark-gfm-footnotes style)",
      ],
    ])("returns %s for %s", (section, expected) => {
      expect(hasFootnoteHeading(section)).toBe(expected)
    })

    it("detects heading in parsed HTML", async () => {
      const html =
        '<section><h1 id="footnote-label">Footnotes</h1><ol><li id="user-content-fn-1">Content</li></ol></section>'
      const tree = await parseHtml(html)
      const section = tree.children[0] as Element
      expect(hasFootnoteHeading(section)).toBe(true)
    })
  })

  describe("createFootnoteHeading", () => {
    it("creates h1 with correct id, class, and text", () => {
      const heading = createFootnoteHeading()
      expect(heading.tagName).toBe("h1")
      expect(heading.properties?.id).toBe("footnote-label")
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
  })

  describe("isAlreadyWrapped", () => {
    it.each([
      [h("section", { dataFootnotes: true }, []) as Element, true, "proper footnote section"],
      [h("section", []) as Element, false, "section without dataFootnotes"],
      [h("div", { dataFootnotes: true }, []) as Element, false, "non-section element"],
    ])("returns %s for %s", (parent, expected) => {
      expect(isAlreadyWrapped(parent)).toBe(expected)
    })

    it("returns true for section with data-footnotes from parsed HTML", async () => {
      const html = '<section data-footnotes class="footnotes"></section>'
      const tree = await parseHtml(html)
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
    ])("%s", async (html, assertion) => {
      const tree = await parseHtml(html)
      cleanupIframeFootnoteText(tree)
      const result = await stringifyHtml(tree)
      assertion(result)
    })
  })

  describe("findFootnoteList", () => {
    it("finds footnote list", async () => {
      const html = '<p>Text</p><ol><li id="user-content-fn-1">Footnote</li></ol>'
      const tree = await parseHtml(html)
      const location = findFootnoteList(tree)
      expect(location).not.toBeNull()
      expect(location?.node.tagName).toBe("ol")
    })

    it("returns null when no footnote list exists", async () => {
      const html = '<p>Text</p><ol><li id="regular">Item</li></ol>'
      const tree = await parseHtml(html)
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
        expect(result).toContain('id="footnote-label"')
        expect(result).toContain("<h1")
        expect(result).toContain("Footnotes")
      },
      "wraps orphaned footnote list in proper section with heading",
    ],
    [
      fixtures.wrappedFootnotes,
      (result: string) => {
        expect(result).toContain("<section data-footnotes")
        expect(result).toContain('id="footnote-label"')
        const h1Count = (result.match(/<h1/g) || []).length
        expect(h1Count).toBe(1)
      },
      "does not modify already properly wrapped footnotes",
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
        expect(result).toContain('id="footnote-label"')
        expect(result).toContain("<h1")
      },
      "adds heading to section missing it",
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
