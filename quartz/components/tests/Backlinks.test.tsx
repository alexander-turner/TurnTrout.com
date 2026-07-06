import type { Root } from "hast"

/**
 * @jest-environment jest-fixed-jsdom
 */
import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"
import { h as preactH } from "preact"
import { render } from "preact-render-to-string"

import type { QuartzComponentProps } from "../types"

import { FrontmatterData, type QuartzPluginData } from "../../plugins/vfile"
import { type GlobalConfiguration } from "../../util/config"
import { type QuartzConfig } from "../../util/ctx"
import { type BuildCtx } from "../../util/ctx"
import { type FullSlug, type SimpleSlug } from "../../util/path"
import { Backlinks, getBacklinkFileData } from "../Backlinks"
import { normalizeNbsp } from "../constants"

// Helper function to create test file data
const createFileData = (overrides: Partial<QuartzPluginData> = {}): QuartzPluginData =>
  ({
    slug: "test" as FullSlug,
    frontmatter: {
      title: "Test Page",
    },
    ...overrides,
  }) as QuartzPluginData

// Helper function to create test props
const createProps = (
  fileData: QuartzPluginData,
  allFiles: QuartzPluginData[],
): QuartzComponentProps => {
  const cfg = {
    baseUrl: "http://example.com",
    analytics: { provider: "google", tagId: "dummy" },
    configuration: {},
    plugins: [],
  } as unknown as GlobalConfiguration

  return {
    fileData,
    allFiles,
    cfg,
    ctx: {
      cfg: {} as unknown as QuartzConfig,
      allSlugs: [] as FullSlug[],
      argv: {} as unknown,
    } as BuildCtx,
    externalResources: { css: [], js: [] },
    children: [],
    tree: h("root") as unknown as Root,
    displayClass: undefined,
  }
}

describe("getBacklinkFiles", () => {
  it("returns empty array when no backlinks exist", () => {
    const currentFile = createFileData({ slug: "page" as FullSlug })
    const allFiles = [currentFile]
    expect(getBacklinkFileData(allFiles, currentFile)).toHaveLength(0)
  })

  it("finds files that link to current page", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })
    const linkingFile = createFileData({
      slug: "source" as FullSlug,
      links: ["target" as SimpleSlug],
    })
    const allFiles = [currentFile, linkingFile]
    expect(getBacklinkFileData(allFiles, currentFile)).toEqual([linkingFile])
  })

  it("excludes self-referential links", () => {
    const currentFile = createFileData({
      slug: "page" as FullSlug,
      links: ["page" as SimpleSlug],
    })
    const allFiles = [currentFile]
    expect(getBacklinkFileData(allFiles, currentFile)).toHaveLength(0)
  })

  it("excludes self-referential links with anchors", () => {
    const currentFile = createFileData({
      slug: "page" as FullSlug,
      links: ["page#section" as SimpleSlug, "page#another-section" as SimpleSlug],
    })
    const allFiles = [currentFile]
    expect(getBacklinkFileData(allFiles, currentFile)).toHaveLength(0)
  })

  it("includes links with anchors from other pages", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })
    const linkingFile = createFileData({
      slug: "source" as FullSlug,
      links: ["target#section" as SimpleSlug],
    })
    const allFiles = [currentFile, linkingFile]
    expect(getBacklinkFileData(allFiles, currentFile)).toEqual([linkingFile])
  })
})

describe("Backlinks", () => {
  // Basic rendering test
  it("renders without crashing", () => {
    const props = createProps(createFileData(), [])
    expect(() => render(preactH(Backlinks, props))).not.toThrow()
  })

  // Test no backlinks case
  it("returns null when no backlinks exist", () => {
    const props = createProps(createFileData(), [])
    const html = render(preactH(Backlinks, props))
    expect(html).toBe("")
  })

  // Test with backlinks
  it("renders backlinks when they exist", () => {
    const currentFile = createFileData({ slug: "target-page" as FullSlug })
    const linkingFile = createFileData({
      slug: "linking-page" as FullSlug,
      frontmatter: { title: "Linking Page" },
      links: ["target-page" as SimpleSlug],
    })

    const props = createProps(currentFile, [linkingFile])
    const element = preactH(Backlinks, props)
    expect(element).toBeTruthy()

    const html = render(element)
    expect(html).toContain(
      'class="admonition link admonition-metadata is-collapsible is-collapsed"',
    )
    expect(html).toContain("Links to this page")
    expect(normalizeNbsp(html)).toContain("Linking Page")
  })

  // Test self-referential links are excluded
  it("excludes self-referential links", () => {
    const currentFile = createFileData({
      slug: "self-ref" as FullSlug,
      links: ["self-ref" as SimpleSlug],
    })

    const props = createProps(currentFile, [currentFile])
    const html = render(preactH(Backlinks, props))
    expect(html).toBe("")
  })

  // Test self-referential links with anchors are excluded
  it("excludes self-referential links with anchors", () => {
    const currentFile = createFileData({
      slug: "page" as FullSlug,
      links: ["page#section" as SimpleSlug, "page#another-section" as SimpleSlug],
    })

    const props = createProps(currentFile, [currentFile])
    const backlinkFiles = getBacklinkFileData([currentFile], currentFile)
    expect(backlinkFiles).toHaveLength(0)

    const element = preactH(Backlinks, props)
    const html = render(element)
    expect(html).toBe("")
  })

  // Test multiple backlinks
  it("renders multiple backlinks correctly", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })
    const linkingFiles = [
      createFileData({
        slug: "link1" as FullSlug,
        frontmatter: { title: "Link 1" },
        links: ["target" as SimpleSlug],
      }),
      createFileData({
        slug: "link2" as FullSlug,
        frontmatter: { title: "Link 2" },
        links: ["target" as SimpleSlug],
      }),
    ]

    const props = createProps(currentFile, linkingFiles)
    const element = preactH(Backlinks, props)
    expect(element).toBeTruthy()

    const html = render(element)
    expect(normalizeNbsp(html)).toContain("Link 1")
    expect(normalizeNbsp(html)).toContain("Link 2")
    expect(html.match(/<li/gu)?.length).toBe(2)
  })

  // Test handling of invalid file data
  it("handles files without required properties", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })
    // Links to the target but is missing a frontmatter title.
    const invalidFile = {
      slug: "invalid" as FullSlug,
      links: ["target" as SimpleSlug],
    } as QuartzPluginData
    const validFile = createFileData({
      slug: "valid" as FullSlug,
      frontmatter: { title: "Valid" },
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [invalidFile, validFile])
    let html = ""
    expect(() => {
      html = render(preactH(Backlinks, props))
    }).not.toThrow()
    // The valid backlink is rendered; the file missing a title is skipped.
    expect(normalizeNbsp(html)).toContain("Valid")
    expect(html.match(/<li/gu)?.length).toBe(1)
  })

  // Test empty or undefined slugs
  it("handles empty or undefined slugs gracefully", () => {
    const currentFile = createFileData({ slug: "" as FullSlug })
    const linkingFile = createFileData({
      slug: "linking-page" as FullSlug,
      frontmatter: { title: "Linking Page" },
      links: ["" as SimpleSlug],
    })

    const props = createProps(currentFile, [linkingFile])
    expect(() => render(preactH(Backlinks, props))).not.toThrow()
  })

  // Test abbreviations in titles are processed correctly
  it("renders abbreviations in titles correctly", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })

    const linkingFile = createFileData({
      slug: "abbr-source" as FullSlug,
      frontmatter: {
        // Include an abbreviation element in the title
        title: '<abbr class="initialism">AI</abbr>',
      },
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [linkingFile])
    const element = preactH(Backlinks, props)
    const html = render(element)

    // Ensure the <abbr> element was rendered with the expected class and transformed text
    expect(html).toMatch(/<abbr[^>]*class="initialism"[^>]*>AI<\/abbr>/u)
  })

  it("renders emoji in backlink titles as Twemoji <img> elements", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })

    const linkingFile = createFileData({
      slug: "emoji-source" as FullSlug,
      frontmatter: { title: "Other fish in the sea 🐟" },
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [linkingFile])
    const html = render(preactH(Backlinks, props))

    // The emoji becomes a Twemoji <img class="emoji"> rather than a bare glyph.
    expect(html).toMatch(/<img[^>]*class="emoji"[^>]*>/)
    expect(html).toMatch(/<img[^>]*alt="🐟"[^>]*>/u)
    // The only occurrence of the raw glyph is inside the img's alt text.
    expect(html.match(/🐟/gu)).toHaveLength(1)
  })

  it("renders abbreviations without className using empty string fallback", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })

    const linkingFile = createFileData({
      slug: "abbr-no-class-source" as FullSlug,
      frontmatter: {
        // Include an abbreviation element without a class
        title: "<abbr>HTML</abbr>",
      },
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [linkingFile])
    const element = preactH(Backlinks, props)
    const html = render(element)

    // Ensure the <abbr> element was rendered with empty class (fallback branch)
    expect(html).toMatch(/<abbr[^>]*class[^>]*>HTML<\/abbr>/u)
  })

  // Whitelisted semantic inline tags (em/strong/code/del/sub/sup) are preserved.
  it("preserves whitelisted semantic inline elements in titles", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })
    const innerText = "cool"

    const linkingFile = createFileData({
      slug: "em-source" as FullSlug,
      frontmatter: { title: `<em>${innerText}</em>` },
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [linkingFile])
    const html = render(preactH(Backlinks, props))

    expect(html).toMatch(new RegExp(`<em[^>]*>${innerText}</em>`))
  })

  // Non-whitelisted inline elements still fall back to a <span>.
  it("wraps non-whitelisted inline elements in a span", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })
    const innerText = "emphasis"

    const linkingFile = createFileData({
      slug: "i-source" as FullSlug,
      frontmatter: { title: `<i>${innerText}</i>` },
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [linkingFile])
    const html = render(preactH(Backlinks, props))

    expect(html).not.toContain("<i>")
    expect(html).toMatch(new RegExp(`<span[^>]*>${innerText}</span>`))
  })

  // Test files without a title are ignored during rendering
  it("skips files missing a frontmatter title", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })

    // This file links to the target but lacks a title
    const noTitleFile = createFileData({
      slug: "no-title" as FullSlug,
      frontmatter: {} as FrontmatterData,
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [noTitleFile])
    const element = preactH(Backlinks, props)
    const html = render(element)

    // A blockquote should still be rendered (backlinkFiles length > 0), but there should be no <li> entries
    expect(html).toContain("<blockquote")
    expect(html.match(/<li/gu)).toBeNull()
  })

  const linkingWithExcerpt = (linkContexts?: QuartzPluginData["linkContexts"]): QuartzPluginData =>
    createFileData({
      slug: "linking-page" as FullSlug,
      frontmatter: { title: "Linking Page" },
      links: ["target-page" as SimpleSlug],
      linkContexts,
    })

  it("renders the excerpt as a deep-link and the title as a read-the-original-post link", () => {
    const currentFile = createFileData({ slug: "target-page" as FullSlug })
    const linkingFile = linkingWithExcerpt([
      {
        target: "target-page" as SimpleSlug,
        excerptHtml: 'See <span class="backlink-highlight">this idea</span> in context',
        anchor: "backlink-cite-0",
      },
    ])

    const html = render(preactH(Backlinks, createProps(currentFile, [linkingFile])))

    expect(html).toContain('<span class="backlink-highlight">this idea</span>')
    expect(html).toContain("in context")
    // The excerpt itself is the deep-link to its citing location.
    expect(html).toMatch(/href="[^"]*#backlink-cite-0"[^>]*class="backlink-excerpt/)
    // The title reads the original post from the top (no citing anchor).
    expect(html).toContain('title="Read the original post"')
  })

  it("renders multiple references from one article, each deep-linking to its own spot", () => {
    const currentFile = createFileData({ slug: "target-page" as FullSlug })
    const linkingFile = linkingWithExcerpt([
      {
        target: "target-page" as SimpleSlug,
        excerptHtml: 'first <span class="backlink-highlight">ref</span>',
        anchor: "backlink-cite-linking-page-0",
      },
      {
        target: "target-page" as SimpleSlug,
        excerptHtml: 'second <span class="backlink-highlight">ref</span>',
        anchor: "backlink-cite-linking-page-1",
      },
    ])

    const html = render(preactH(Backlinks, createProps(currentFile, [linkingFile])))

    expect((html.match(/class="backlink-excerpt/g) ?? []).length).toBe(2)
    expect(html).toMatch(/href="[^"]*#backlink-cite-linking-page-0"/)
    expect(html).toMatch(/href="[^"]*#backlink-cite-linking-page-1"/)
    expect(html).toContain("first")
    expect(html).toContain("second")
  })

  it("skips a matching context that has no excerpt (renders title-only)", () => {
    const currentFile = createFileData({ slug: "target-page" as FullSlug })
    const linkingFile = linkingWithExcerpt([
      { target: "target-page" as SimpleSlug, excerptHtml: "", anchor: "backlink-cite-0" },
    ])

    const html = render(preactH(Backlinks, createProps(currentFile, [linkingFile])))

    expect(html).not.toContain("backlink-excerpt")
    expect(html).not.toContain("#backlink-cite-0")
    expect(normalizeNbsp(html)).toContain("Linking Page")
  })

  it("renders a title-only row when no linkContext matches the current page", () => {
    const currentFile = createFileData({ slug: "target-page" as FullSlug })
    const linkingFile = linkingWithExcerpt([
      {
        target: "some-other-page" as SimpleSlug,
        excerptHtml: 'nope <span class="backlink-highlight">x</span>',
        anchor: "backlink-cite-3",
      },
    ])

    const html = render(preactH(Backlinks, createProps(currentFile, [linkingFile])))

    expect(html).not.toContain("backlink-excerpt")
    expect(html).not.toContain("#backlink-cite-3")
    expect(normalizeNbsp(html)).toContain("Linking Page")
  })

  it("renders a title-only row when the file records no linkContexts", () => {
    const currentFile = createFileData({ slug: "target-page" as FullSlug })
    const linkingFile = linkingWithExcerpt()

    const html = render(preactH(Backlinks, createProps(currentFile, [linkingFile])))

    expect(html).not.toContain("backlink-excerpt")
    expect(normalizeNbsp(html)).toContain("Linking Page")
  })

  it("preserves whitelisted tags and falls back to spans for others in titles", () => {
    const currentFile = createFileData({ slug: "target-page" as FullSlug })
    const linkingFile = createFileData({
      slug: "rich-title-source" as FullSlug,
      frontmatter: {
        title:
          "<em>e</em><strong>s</strong><code>c</code><del>d</del><sub>b</sub><sup>p</sup><i>i</i>",
      },
      links: ["target-page" as SimpleSlug],
    })

    const html = render(preactH(Backlinks, createProps(currentFile, [linkingFile])))

    expect(html).toMatch(/<em[^>]*>e<\/em>/)
    expect(html).toMatch(/<strong[^>]*>s<\/strong>/)
    expect(html).toMatch(/<code[^>]*>c<\/code>/)
    expect(html).toMatch(/<del[^>]*>d<\/del>/)
    expect(html).toMatch(/<sub[^>]*>b<\/sub>/)
    expect(html).toMatch(/<sup[^>]*>p<\/sup>/)
    // Non-whitelisted <i> collapses to a span.
    expect(html).not.toContain("<i>")
    expect(html).toMatch(/<span[^>]*>i<\/span>/)
  })

  it("injects excerpt HTML verbatim, preserving twemoji and KaTeX", () => {
    const currentFile = createFileData({ slug: "target-page" as FullSlug })
    const excerptHtml =
      'see <img class="emoji" alt="🐟"> and ' +
      '<span class="katex"><span class="katex-html">x²</span></span> ' +
      '<span class="backlink-highlight">here</span>'
    const linkingFile = linkingWithExcerpt([
      { target: "target-page" as SimpleSlug, excerptHtml, anchor: "backlink-cite-1" },
    ])

    const html = render(preactH(Backlinks, createProps(currentFile, [linkingFile])))

    expect(html).toMatch(/<img[^>]*class="emoji"[^>]*alt="🐟"[^>]*>/u)
    expect(html).toContain('<span class="katex">')
    expect(html).toContain('<span class="backlink-highlight">here</span>')
  })
})

// Ensure Jest collects coverage for this file
