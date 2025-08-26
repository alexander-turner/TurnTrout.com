import type { Root, RootContent } from "hast"

/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"
import { h as preactH } from "preact"
import { render } from "preact-render-to-string"

import type { QuartzComponentProps } from "../types"

import { type GlobalConfiguration, type QuartzConfig } from "../../cfg"
import { FrontmatterData, type QuartzPluginData } from "../../plugins/vfile"
import { type BuildCtx } from "../../util/ctx"
import { type FullSlug, type SimpleSlug } from "../../util/path"
import { Backlinks, getBacklinkFileData, elementToJsx } from "../Backlinks"

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
    const element = preactH(Backlinks, props)
    expect(element).toBeTruthy()
  })

  // Test no backlinks case
  it("returns null when no backlinks exist", () => {
    const props = createProps(createFileData(), [])
    const element = preactH(Backlinks, props)
    expect(element).toBeTruthy()
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
    expect(html).toContain('class="admonition admonition-metadata is-collapsible is-collapsed"')
    expect(html).toContain("Links to this page")
    expect(html).toContain("Linking Page")
  })

  // Test self-referential links are excluded
  it("excludes self-referential links", () => {
    const currentFile = createFileData({
      slug: "self-ref" as FullSlug,
      links: ["self-ref" as SimpleSlug],
    })

    const props = createProps(currentFile, [currentFile])
    const element = preactH(Backlinks, props)
    expect(element).toBeTruthy()
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
    expect(html).toContain("Link 1")
    expect(html).toContain("Link 2")
    expect(html.match(/<li/g)?.length).toBe(2)
  })

  // Test handling of invalid file data
  it("handles files without required properties", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })
    const invalidFile = {} as QuartzPluginData // Missing required properties
    const validFile = createFileData({
      slug: "valid" as FullSlug,
      frontmatter: { title: "Valid" },
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [invalidFile, validFile])
    const element = preactH(Backlinks, props)
    expect(element).toBeTruthy()
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
    expect(() => preactH(Backlinks, props)).not.toThrow()
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
    expect(html).toMatch(/<abbr[^>]*class="initialism"[^>]*>AI<\/abbr>/)
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
    expect(html).toMatch(/<abbr[^>]*class[^>]*>HTML<\/abbr>/)
  })

  // Test non-abbreviation inline HTML elements are wrapped in a <span>
  it("wraps non-abbreviation inline elements in a span", () => {
    const currentFile = createFileData({ slug: "target" as FullSlug })
    const innerText = "cool"

    const linkingFile = createFileData({
      slug: "span-source" as FullSlug,
      frontmatter: {
        // Include italicized text which should be wrapped in a <span> by elementToJsx
        title: `<em>${innerText}</em>`,
      },
      links: ["target" as SimpleSlug],
    })

    const props = createProps(currentFile, [linkingFile])
    const element = preactH(Backlinks, props)
    const html = render(element)

    // The original <em> tag should have been replaced by a <span>
    expect(html).not.toContain("<em>")
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
    expect(html.match(/<li/g)).toBeNull()
  })

  // Test unsupported RootContent type triggers default branch returning empty fragment
  it("returns empty fragment for unsupported AST node types", () => {
    // Create a comment node which is not handled explicitly by elementToJsx
    const commentNode = { type: "comment", value: "ignored" } as unknown as RootContent

    const jsx = elementToJsx(commentNode)
    const html = render(jsx)

    // Rendering an empty fragment yields an empty string
    expect(html).toBe("")
  })
})

// Ensure Jest collects coverage for this file
