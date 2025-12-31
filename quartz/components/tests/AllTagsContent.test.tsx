/**
 * @jest-environment jsdom
 */
import type { Root, Element as HastElement } from "hast"

import { describe, it, expect } from "@jest/globals"
import { h } from "hastscript"
import { h as preactH } from "preact"
import { render } from "preact-render-to-string"

import type { QuartzComponentProps } from "../types"

import { type GlobalConfiguration } from "../../cfg"
import { type QuartzPluginData } from "../../plugins/vfile"
import { BuildCtx } from "../../util/ctx"
import { type FilePath, type FullSlug } from "../../util/path"
import AllTagsContent, { generateAllTagsHast, allTagsListing } from "../pages/AllTagsContent"

// Create test file data
const createFileData = (overrides: Partial<QuartzPluginData> = {}): QuartzPluginData =>
  ({
    slug: "test" as FullSlug,
    filePath: "test.md" as FilePath,
    frontmatter: {
      title: "Test Page",
      tags: ["test"],
    },
    ...overrides,
  }) as QuartzPluginData

// Create test props
const createProps = (
  fileData: QuartzPluginData,
  allFiles: QuartzPluginData[],
): QuartzComponentProps => {
  const cfg = {
    baseUrl: "http://example.com",
    analytics: { provider: "google", tagId: "dummy" },
    configuration: {},
    plugins: [],
    defaultDateType: "created",
  } as unknown as GlobalConfiguration

  return {
    fileData,
    allFiles,
    cfg,
    ctx: {} as BuildCtx,
    externalResources: { css: [], js: [] },
    children: [],
    tree: h("root") as unknown as Root,
    displayClass: undefined,
  }
}

describe("generateAllTagsHast", () => {
  it("should generate HAST element with correct structure", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: ["ai", "research"] },
    })
    const props = createProps(fileData, [fileData])
    const hast = generateAllTagsHast(props)

    expect(hast.type).toBe("element")
    expect(hast.tagName).toBe("span")
    expect(hast.properties?.id).toBe(allTagsListing)
    expect(hast.properties?.dataUrl).toBe(allTagsListing)
    expect(hast.properties?.dataBlock).toBe(allTagsListing)
  })

  it("should sort tags alphabetically by locale", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: ["zebra", "alpha", "beta"] },
    })
    const props = createProps(fileData, [fileData])
    const hast = generateAllTagsHast(props)

    const allTagsDiv = hast.children[0] as HastElement
    const tagContainers = allTagsDiv.children as HastElement[]

    // Extract tag names from the generated links
    const tagNames = tagContainers.map((container) => {
      const link = container.children[0] as HastElement
      const textNode = link.children[0] as { type: "text"; value: string }
      return textNode.value
    })

    expect(tagNames).toEqual(["alpha", "beta", "zebra"])
  })

  it("should count tag occurrences correctly", () => {
    const files = [
      createFileData({
        slug: "file1" as FullSlug,
        frontmatter: { title: "File 1", tags: ["common", "unique1"] },
      }),
      createFileData({
        slug: "file2" as FullSlug,
        frontmatter: { title: "File 2", tags: ["common", "unique2"] },
      }),
      createFileData({
        slug: "file3" as FullSlug,
        frontmatter: { title: "File 3", tags: ["common"] },
      }),
    ]
    const props = createProps(files[0], files)
    const hast = generateAllTagsHast(props)

    const allTagsDiv = hast.children[0] as HastElement
    const tagContainers = allTagsDiv.children as HastElement[]

    // Find the "common" tag container
    const commonTagContainer = tagContainers.find((container) => {
      const link = container.children[0] as HastElement
      const textNode = link.children[0] as { type: "text"; value: string }
      return textNode.value === "common"
    })

    if (!commonTagContainer) {
      throw new Error("commonTagContainer is undefined")
    }
    const countSpan = commonTagContainer.children[1] as HastElement
    const countText = countSpan.children[0] as { type: "text"; value: string }
    expect(countText.value).toBe("(3)")
  })

  it("should handle tags with slashes as single tags", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: ["ai/machine-learning/deep-learning"] },
    })
    const props = createProps(fileData, [fileData])
    const hast = generateAllTagsHast(props)

    const allTagsDiv = hast.children[0] as HastElement
    const tagContainers = allTagsDiv.children as HastElement[]

    // Should have 1 tag: "ai/machine-learning/deep-learning"
    expect(tagContainers).toHaveLength(1)

    const tagNames = tagContainers.map((container) => {
      const link = container.children[0] as HastElement
      const textNode = link.children[0] as { type: "text"; value: string }
      return textNode.value
    })

    expect(tagNames).toContain("ai/machine learning/deep learning")
  })

  it("should handle files with no tags", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test" },
    })
    const props = createProps(fileData, [fileData])
    const hast = generateAllTagsHast(props)

    const allTagsDiv = hast.children[0] as HastElement
    expect(allTagsDiv.children).toHaveLength(0)
  })

  it("should handle files with empty tags array", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: [] },
    })
    const props = createProps(fileData, [fileData])
    const hast = generateAllTagsHast(props)

    const allTagsDiv = hast.children[0] as HastElement
    expect(allTagsDiv.children).toHaveLength(0)
  })

  it("should handle files with missing frontmatter", () => {
    const fileData = createFileData({
      frontmatter: undefined,
    })
    const props = createProps(fileData, [fileData])
    const hast = generateAllTagsHast(props)

    const allTagsDiv = hast.children[0] as HastElement
    expect(allTagsDiv.children).toHaveLength(0)
  })

  it("should generate correct tag links with proper href", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: ["test-tag"] },
    })
    const props = createProps(fileData, [fileData])
    const hast = generateAllTagsHast(props)

    const allTagsDiv = hast.children[0] as HastElement
    const tagContainer = allTagsDiv.children[0] as HastElement
    const link = tagContainer.children[0] as HastElement

    expect(link.tagName).toBe("a")
    expect(link.properties?.className).toEqual(["internal", "tag-link", "can-trigger-popover"])
    expect(link.properties?.href).toBe("../tags/test-tag")
  })

  it("should create tag containers with correct structure", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: ["sample"] },
    })
    const props = createProps(fileData, [fileData])
    const hast = generateAllTagsHast(props)

    const allTagsDiv = hast.children[0] as HastElement
    const tagContainer = allTagsDiv.children[0] as HastElement

    expect(tagContainer.tagName).toBe("div")
    expect(tagContainer.properties?.className).toEqual(["tag-container"])
    expect(tagContainer.children).toHaveLength(2)

    const link = tagContainer.children[0] as HastElement
    const count = tagContainer.children[1] as HastElement

    expect(link.tagName).toBe("a")
    expect(count.tagName).toBe("span")
    expect(count.properties?.className).toEqual(["tag-count"])
  })

  it("should handle empty allFiles array", () => {
    const fileData = createFileData()
    const props = createProps(fileData, [])
    const hast = generateAllTagsHast(props)

    expect(hast.type).toBe("element")
    expect(hast.tagName).toBe("span")
    const allTagsDiv = hast.children[0] as HastElement
    expect(allTagsDiv.children).toHaveLength(0)
  })
})

describe("AllTagsContent component", () => {
  it("should render without crashing", () => {
    const props = createProps(createFileData(), [])
    const element = preactH(AllTagsContent, props)
    expect(element).toBeTruthy()
  })

  it("should render with default CSS classes", () => {
    const fileData = createFileData()
    const props = createProps(fileData, [fileData])
    const html = render(preactH(AllTagsContent, props))

    expect(html).toContain('class="previewable"')
    expect(html).toContain("<article>")
  })

  it("should include additional CSS classes from frontmatter", () => {
    const fileData = createFileData({
      frontmatter: {
        title: "Test",
        cssclasses: ["custom-class", "another-class"],
      },
    })
    const props = createProps(fileData, [fileData])
    const html = render(preactH(AllTagsContent, props))

    expect(html).toContain('class="previewable custom-class another-class"')
  })

  it("should render tags listing inside article", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: ["test-tag"] },
    })
    const props = createProps(fileData, [fileData])
    const html = render(preactH(AllTagsContent, props))

    expect(html).toContain(allTagsListing)
    expect(html).toContain("all-tags")
    expect(html).toContain("tag-container")
    expect(html).toContain("test tag")
  })

  it("should handle files with missing filePath", () => {
    const fileData = createFileData({
      filePath: undefined,
      frontmatter: { title: "Test", tags: ["test"] },
    })
    const props = createProps(fileData, [fileData])
    const html = render(preactH(AllTagsContent, props))

    expect(html).toContain("<article>")
    expect(html).toContain(allTagsListing)
  })

  it("should render empty tags list when no tags present", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: [] },
    })
    const props = createProps(fileData, [fileData])
    const html = render(preactH(AllTagsContent, props))

    expect(html).toContain("<article>")
    expect(html).toContain(allTagsListing)
    // Should still render the container but with no tag elements
    expect(html).toContain("all-tags")
    expect(html).not.toContain("tag-container")
  })

  it("should render multiple tags with correct counts", () => {
    const files = [
      createFileData({
        slug: "file1" as FullSlug,
        frontmatter: { title: "File 1", tags: ["alpha", "beta"] },
      }),
      createFileData({
        slug: "file2" as FullSlug,
        frontmatter: { title: "File 2", tags: ["alpha", "gamma"] },
      }),
    ]
    const props = createProps(files[0], files)
    const html = render(preactH(AllTagsContent, props))

    expect(html).toContain("alpha")
    expect(html).toContain("beta")
    expect(html).toContain("gamma")
    expect(html).toContain("(2)") // alpha appears twice
    expect(html).toContain("(1)") // beta and gamma appear once each
  })
})

describe("AllTagsContent CSS", () => {
  it("should have CSS styles attached", () => {
    expect(AllTagsContent.css).toBeDefined()
  })
})

describe("generateAllTagsBlock (tested through component)", () => {
  it("should convert HAST to JSX correctly", () => {
    const fileData = createFileData({
      frontmatter: { title: "Test", tags: ["jsx-test"] },
    })
    const props = createProps(fileData, [fileData])
    const html = render(preactH(AllTagsContent, props))

    // This tests the generateAllTagsBlock function indirectly
    expect(html).toContain("jsx test") // Tests formatTag conversion
    expect(html).toContain("tag-link") // Tests HAST to JSX conversion
    expect(html).toContain(allTagsListing) // Tests data attributes
  })

  it("should handle files with missing filePath gracefully", () => {
    const fileData = createFileData({
      filePath: "" as FilePath, // Empty string fallback
      frontmatter: { title: "Test", tags: ["test"] },
    })
    const props = createProps(fileData, [fileData])
    const html = render(preactH(AllTagsContent, props))

    expect(html).toContain("<article>")
    expect(html).toContain("test")
  })
})
