import type { Root, Element } from "hast"

import { describe, expect, it } from "@jest/globals"

import { type QuartzPluginData } from "../../vfile"
import {
  renderSequenceTitle,
  renderPreviousPost,
  renderNextPost,
  createSequenceLinksDiv,
  insertAfterTroutOrnament,
} from "../sequenceLinks"
import { ornamentNode } from "../trout_hr"

describe("renderSequenceTitle", () => {
  it("should return null when no sequence information is available", () => {
    const fileData = {} as QuartzPluginData
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
  })
})

describe("renderPreviousPost", () => {
  it("should return null when no previous post exists", () => {
    const fileData = {} as QuartzPluginData
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
  })
})

describe("renderNextPost", () => {
  it("should return null when no next post exists", () => {
    const fileData = {} as QuartzPluginData
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
    expect((result?.children[2] as Element).properties?.href).toBe("./next-post")
  })
})

describe("createSequenceLinksDiv", () => {
  it("should create a div with sequence links", () => {
    const sequenceTitle = { type: "element", tagName: "div" } as Element
    const prevPost = { type: "element", tagName: "p" } as Element
    const nextPost = { type: "element", tagName: "p" } as Element

    const result = createSequenceLinksDiv(sequenceTitle, prevPost, nextPost)
    expect(result.tagName).toBe("div")
    expect(result.properties?.className).toStrictEqual(["sequence-links"])
  })
})

describe("insertAfterOrnamentNode", () => {
  it("should insert sequence links after trout ornament", () => {
    const tree: Root = {
      type: "root",
      children: [ornamentNode, { type: "element", tagName: "p", properties: {}, children: [] }],
    }
    const sequenceLinksDiv = { type: "element", tagName: "div" } as Element

    insertAfterTroutOrnament(tree, sequenceLinksDiv)
    expect(tree.children).toHaveLength(3)
    expect(tree.children[1]).toBe(sequenceLinksDiv)
  })
})
