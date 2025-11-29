/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from "@jest/globals"
import { h } from "preact"
import { render } from "preact-render-to-string"

import { type QuartzPluginData } from "../../plugins/vfile"
import { formatTag, getTags, TagList } from "../TagList"
import { type QuartzComponentProps } from "../types"

describe("TagList", () => {
  it.each([
    ["ai", "AI"],
    ["some-tag", "some tag"],
    ["power seeking", "power-seeking"],
    ["ANOTHER-TAG", "another tag"],
    [null as unknown as string, ""],
    [undefined as unknown as string, ""],
    ["power seeking test", "power-seeking test"],
  ])('should format tag "%s" as "%s"', (inputTag: string, expected: string) => {
    expect(formatTag(inputTag)).toBe(expected)
  })

  it("should get and sort tags from fileData", () => {
    const fileData: QuartzPluginData = {
      frontmatter: {
        title: "Test Page",
        tags: ["short", "a-very-long-tag", "medium-tag"],
      },
    } as QuartzPluginData
    const tags = getTags(fileData)
    expect(tags).toEqual(["a very long tag", "medium tag", "short"])
  })

  it("should return an empty array if no tags are present", () => {
    const fileData: QuartzPluginData = {
      frontmatter: {
        title: "Test Page",
      },
    } as QuartzPluginData
    const tags = getTags(fileData)
    expect(tags).toEqual([])
  })

  it("should return an empty array if frontmatter is missing", () => {
    const fileData: QuartzPluginData = {} as QuartzPluginData
    const tags = getTags(fileData)
    expect(tags).toEqual([])
  })

  it("should render a list of tags", () => {
    const fileData: QuartzPluginData = {
      frontmatter: {
        title: "Test Page",
        tags: ["tag1", "tag2"],
      },
    } as QuartzPluginData
    const Component = TagList(undefined)
    const html = render(h(Component, { fileData } as QuartzComponentProps))
    expect(html).toContain('<a href="/tags/tag1" class="can-trigger-popover tag-link">tag1</a>')
    expect(html).toContain('<a href="/tags/tag2" class="can-trigger-popover tag-link">tag2</a>')
  })

  it("should return null if there are no tags to render", () => {
    const fileData: QuartzPluginData = {
      frontmatter: {
        title: "Test Page",
      },
    } as QuartzPluginData
    const Component = TagList(undefined)
    const html = render(h(Component, { fileData } as QuartzComponentProps))
    expect(html).toBe("")
  })
})
