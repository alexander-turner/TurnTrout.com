import type { Root, Element, Text } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"

import { type QuartzPluginData } from "../../vfile"
import {
  renderSequenceTitle,
  renderPreviousPost,
  renderNextPost,
  createSequenceLinksDiv,
  insertAfterTroutOrnament,
  createSequenceLinksComponent,
} from "../sequenceLinks"
import { ornamentNode } from "../trout_hr"

describe("renderSequenceTitle", () => {
  it.each([
    ["no sequence information is available", {} as QuartzPluginData],
    ["frontmatter is null", { frontmatter: null } as unknown as QuartzPluginData],
    [
      "lw-sequence-title is not present",
      {
        frontmatter: {
          title: "Test Title",
          "sequence-link": "/test-sequence",
        },
      } as unknown as QuartzPluginData,
    ],
  ])("should return null when %s", (_, fileData) => {
    expect(renderSequenceTitle(fileData)).toBeNull()
  })

  it("should render sequence title when information is available", () => {
    const fileData = {
      frontmatter: {
        title: "Test Title",
        "lw-sequence-title": "Test Sequence",
        "sequence-link": "/test-sequence",
      },
    } as unknown as QuartzPluginData
    const result = renderSequenceTitle(fileData)
    expect(result).toBeTruthy()
    expect(result?.tagName).toBe("div")
    expect(result?.properties?.className).toStrictEqual(["admonition-title-inner"])

    expect(result?.children).toHaveLength(3)
    const firstChild = result?.children[0] as Element
    expect(firstChild.tagName).toBe("b")
    expect(firstChild.children).toStrictEqual([{ type: "text", value: "Sequence:" }])

    const secondChild = result?.children[1] as Text
    expect(secondChild.type).toBe("text")
    expect(secondChild.value).toBe(" ")

    const thirdChild = result?.children[2] as Element
    expect(thirdChild.tagName).toBe("a")
    expect(thirdChild.properties?.href).toBe("/test-sequence")
    expect(thirdChild.properties?.className).toStrictEqual(["internal", "can-trigger-popover"])
    expect(thirdChild.children).toStrictEqual([{ type: "text", value: "Test Sequence" }])
  })

  it("should handle missing sequence-link", () => {
    const fileData = {
      frontmatter: {
        title: "Test Title",
        "lw-sequence-title": "Test Sequence",
      },
    } as unknown as QuartzPluginData
    const result = renderSequenceTitle(fileData)
    expect(result).toBeTruthy()
    expect(result?.tagName).toBe("div")
    expect((result?.children[2] as Element).properties?.href).toBeUndefined()
  })
})

describe("renderPreviousPost", () => {
  it.each([
    ["no previous post exists", {} as QuartzPluginData],
    ["frontmatter is null", { frontmatter: null } as unknown as QuartzPluginData],
    [
      "prev-post-slug is empty string",
      {
        frontmatter: {
          "prev-post-slug": "",
          "prev-post-title": "Previous Post",
        },
      } as QuartzPluginData,
    ],
    [
      "prev-post-slug is missing",
      {
        frontmatter: {
          "prev-post-title": "Previous Post",
        },
      } as QuartzPluginData,
    ],
  ])("should return null when %s", (_, fileData) => {
    expect(renderPreviousPost(fileData)).toBeNull()
  })

  it("should render previous post link when it exists", () => {
    const fileData = {
      frontmatter: {
        title: "Test Title",
        "prev-post-slug": "prev-post",
        "prev-post-title": "Previous Post",
      },
    } as QuartzPluginData
    const result = renderPreviousPost(fileData)
    expect(result).toBeTruthy()
    expect(result?.tagName).toBe("p")
    expect(result?.children).toHaveLength(3)

    const firstChild = result?.children[0] as Element
    expect(firstChild.tagName).toBe("b")
    expect(firstChild.children).toStrictEqual([{ type: "text", value: "Previous" }])

    const secondChild = result?.children[1] as Element
    expect(secondChild.tagName).toBe("br")

    const thirdChild = result?.children[2] as Element
    expect(thirdChild.tagName).toBe("a")
    expect(thirdChild.properties?.href).toBe("./prev-post")
    expect(thirdChild.properties?.className).toStrictEqual(["internal", "can-trigger-popover"])
    expect(thirdChild.children).toStrictEqual([{ type: "text", value: "Previous Post" }])
  })

  it("should handle missing prev-post-title", () => {
    const fileData = {
      frontmatter: {
        "prev-post-slug": "prev-post",
      },
    } as QuartzPluginData
    const result = renderPreviousPost(fileData)
    expect(result).toBeTruthy()
    expect((result?.children[2] as Element).children).toStrictEqual([{ type: "text", value: "" }])
  })
})

describe("renderNextPost", () => {
  it.each([
    ["no next post exists", {} as QuartzPluginData],
    ["frontmatter is null", { frontmatter: null } as unknown as QuartzPluginData],
    [
      "next-post-slug is empty string",
      {
        frontmatter: {
          "next-post-slug": "",
          "next-post-title": "Next Post",
        },
      } as QuartzPluginData,
    ],
    [
      "next-post-slug is missing",
      {
        frontmatter: {
          "next-post-title": "Next Post",
        },
      } as QuartzPluginData,
    ],
  ])("should return null when %s", (_, fileData) => {
    expect(renderNextPost(fileData)).toBeNull()
  })

  it("should render next post link when it exists", () => {
    const fileData = {
      frontmatter: {
        title: "Test Title",
        "next-post-slug": "next-post",
        "next-post-title": "Next Post",
      },
    } as QuartzPluginData
    const result = renderNextPost(fileData)
    expect(result).toBeTruthy()
    expect(result?.tagName).toBe("p")
    expect(result?.children).toHaveLength(3)

    const firstChild = result?.children[0] as Element
    expect(firstChild.tagName).toBe("b")
    expect(firstChild.children).toStrictEqual([{ type: "text", value: "Next" }])

    const secondChild = result?.children[1] as Element
    expect(secondChild.tagName).toBe("br")

    const thirdChild = result?.children[2] as Element
    expect(thirdChild.tagName).toBe("a")
    expect(thirdChild.properties?.href).toBe("./next-post")
    expect(thirdChild.properties?.className).toStrictEqual(["internal", "can-trigger-popover"])
    expect(thirdChild.children).toStrictEqual([{ type: "text", value: "Next Post" }])
  })

  it("should handle missing next-post-title", () => {
    const fileData = {
      frontmatter: {
        "next-post-slug": "next-post",
      },
    } as QuartzPluginData
    const result = renderNextPost(fileData)
    expect(result).toBeTruthy()
    expect((result?.children[2] as Element).children).toStrictEqual([{ type: "text", value: "" }])
  })
})

describe("createSequenceLinksDiv", () => {
  it("should create a div with all sequence components", () => {
    const sequenceTitle = h("div")
    const prevPost = h("p")
    const nextPost = h("p")

    const result = createSequenceLinksDiv(sequenceTitle, prevPost, nextPost)
    expect(result.tagName).toBe("div")
    expect(result.properties?.className).toStrictEqual(["sequence-links"])
    expect(result.children).toHaveLength(2)

    // Check sequence title div
    const titleDiv = result.children[0] as Element
    expect(titleDiv.tagName).toBe("div")
    expect(titleDiv.properties?.className).toStrictEqual(["sequence-title"])
    expect(titleDiv.properties?.style).toBe("text-align: center;")
    expect(titleDiv.children).toStrictEqual([sequenceTitle])

    // Check navigation div
    const navDiv = result.children[1] as Element
    expect(navDiv.tagName).toBe("div")
    expect(navDiv.properties?.className).toStrictEqual(["sequence-nav"])
    expect(navDiv.properties?.style).toBe("display: flex; justify-content: center;")
    expect(navDiv.children).toHaveLength(3) // prevPost, divider, nextPost
  })

  it("should handle only previous post", () => {
    const prevPost = h("p")

    const result = createSequenceLinksDiv(null, prevPost, null)
    const navDiv = result.children[1] as Element
    expect(navDiv.children).toHaveLength(1)

    const prevDiv = navDiv.children[0] as Element
    expect(prevDiv.properties?.className).toStrictEqual([
      "prev-post",
      "sequence-links-post-navigation",
    ])
    expect(prevDiv.properties?.style).toBe("text-align: right;")
    expect(prevDiv.children).toStrictEqual([prevPost])
  })

  it("should handle only next post", () => {
    const nextPost = h("p")

    const result = createSequenceLinksDiv(null, null, nextPost)
    const navDiv = result.children[1] as Element
    expect(navDiv.children).toHaveLength(1)

    const nextDiv = navDiv.children[0] as Element
    expect(nextDiv.properties?.className).toStrictEqual([
      "next-post",
      "sequence-links-post-navigation",
    ])
    expect(nextDiv.properties?.style).toBe("text-align: left;")
    expect(nextDiv.children).toStrictEqual([nextPost])
  })

  it("should handle both previous and next posts with divider", () => {
    const prevPost = h("p")
    const nextPost = h("p")

    const result = createSequenceLinksDiv(null, prevPost, nextPost)
    const navDiv = result.children[1] as Element
    expect(navDiv.children).toHaveLength(3)

    // Previous post
    const prevDiv = navDiv.children[0] as Element
    expect(prevDiv.properties?.className).toStrictEqual([
      "prev-post",
      "sequence-links-post-navigation",
    ])

    // Divider
    const divider = navDiv.children[1] as Element
    expect(divider.properties?.className).toStrictEqual(["sequence-links-divider"])

    // Next post
    const nextDiv = navDiv.children[2] as Element
    expect(nextDiv.properties?.className).toStrictEqual([
      "next-post",
      "sequence-links-post-navigation",
    ])
  })

  it("should handle no posts", () => {
    const result = createSequenceLinksDiv(null, null, null)
    const navDiv = result.children[1] as Element
    expect(navDiv.children).toHaveLength(0)
  })

  it("should handle sequence title when no posts exist", () => {
    const sequenceTitle = h("div")

    const result = createSequenceLinksDiv(sequenceTitle, null, null)
    const titleDiv = result.children[0] as Element
    expect(titleDiv.children).toStrictEqual([sequenceTitle])

    const navDiv = result.children[1] as Element
    expect(navDiv.children).toHaveLength(0)
  })
})

describe("insertAfterTroutOrnament", () => {
  it("should insert sequence links after trout ornament", () => {
    const tree: Root = {
      type: "root",
      children: [ornamentNode, h("p")],
    }
    const sequenceLinksDiv = h("div")

    insertAfterTroutOrnament(tree, sequenceLinksDiv)
    expect(tree.children).toHaveLength(3)
    expect(tree.children[1]).toBe(sequenceLinksDiv)
  })

  it("should not modify tree when ornament is not found", () => {
    const tree: Root = {
      type: "root",
      children: [h("p")],
    }
    const sequenceLinksDiv = h("div")

    insertAfterTroutOrnament(tree, sequenceLinksDiv)
    expect(tree.children).toHaveLength(1)
    expect((tree.children[0] as Element).tagName).toBe("p")
  })

  it("should handle empty tree", () => {
    const tree: Root = {
      type: "root",
      children: [],
    }
    const sequenceLinksDiv = h("div")

    insertAfterTroutOrnament(tree, sequenceLinksDiv)
    expect(tree.children).toHaveLength(0)
  })

  it("should handle ornament at the end of tree", () => {
    const tree: Root = {
      type: "root",
      children: [h("p"), ornamentNode],
    }
    const sequenceLinksDiv = h("div")

    insertAfterTroutOrnament(tree, sequenceLinksDiv)
    expect(tree.children).toHaveLength(3)
    expect(tree.children[2]).toBe(sequenceLinksDiv)
  })

  it("should handle multiple elements and find correct ornament", () => {
    const fakeOrnament = h("div", { id: "different-id" })

    const tree: Root = {
      type: "root",
      children: [fakeOrnament, h("p"), ornamentNode, h("span")],
    }
    const sequenceLinksDiv = h("div")

    insertAfterTroutOrnament(tree, sequenceLinksDiv)
    expect(tree.children).toHaveLength(5)
    expect(tree.children[3]).toBe(sequenceLinksDiv)
    expect(tree.children[2]).toBe(ornamentNode)
  })
})

describe("createSequenceLinksComponent", () => {
  it.each([
    ["no sequence information exists", {} as QuartzPluginData],
    ["frontmatter is null", { frontmatter: null } as unknown as QuartzPluginData],
  ])("should return null when %s", (_, fileData) => {
    const result = createSequenceLinksComponent(fileData)
    expect(result).toBeNull()
  })

  it("should create component when only sequence title exists", () => {
    const fileData = {
      frontmatter: {
        "lw-sequence-title": "Test Sequence",
        "sequence-link": "/test-sequence",
      },
    } as unknown as QuartzPluginData
    const result = createSequenceLinksComponent(fileData)
    expect(result).toBeTruthy()
    expect(result?.tagName).toBe("div")
    expect(result?.properties?.className).toStrictEqual(["sequence-links"])
  })

  it("should create component when only previous post exists", () => {
    const fileData = {
      frontmatter: {
        "prev-post-slug": "prev-post",
        "prev-post-title": "Previous Post",
      },
    } as QuartzPluginData
    const result = createSequenceLinksComponent(fileData)
    expect(result).toBeTruthy()
    expect(result?.tagName).toBe("div")
    expect(result?.properties?.className).toStrictEqual(["sequence-links"])
  })

  it("should create component when only next post exists", () => {
    const fileData = {
      frontmatter: {
        "next-post-slug": "next-post",
        "next-post-title": "Next Post",
      },
    } as QuartzPluginData
    const result = createSequenceLinksComponent(fileData)
    expect(result).toBeTruthy()
    expect(result?.tagName).toBe("div")
    expect(result?.properties?.className).toStrictEqual(["sequence-links"])
  })

  it("should create component with all elements", () => {
    const fileData = {
      frontmatter: {
        "lw-sequence-title": "Test Sequence",
        "sequence-link": "/test-sequence",
        "prev-post-slug": "prev-post",
        "prev-post-title": "Previous Post",
        "next-post-slug": "next-post",
        "next-post-title": "Next Post",
      },
    } as unknown as QuartzPluginData
    const result = createSequenceLinksComponent(fileData)
    expect(result).toBeTruthy()
    expect(result?.tagName).toBe("div")
    expect(result?.properties?.className).toStrictEqual(["sequence-links"])

    // Should have both title and nav divs
    expect(result?.children).toHaveLength(2)
    const titleDiv = result?.children[0] as Element
    const navDiv = result?.children[1] as Element
    expect(titleDiv.properties?.className).toStrictEqual(["sequence-title"])
    expect(navDiv.properties?.className).toStrictEqual(["sequence-nav"])
    expect(navDiv.children).toHaveLength(3) // prev, divider, next
  })
})
