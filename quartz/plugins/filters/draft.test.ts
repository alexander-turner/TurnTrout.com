import { describe, it, expect } from "@jest/globals"

import { type BuildCtx } from "../../util/ctx"
import { type FilePath } from "../../util/path"
import { defaultProcessedContent } from "../vfile"
import { RemoveDrafts } from "./draft"

const filter = RemoveDrafts()

function shouldPublish(filePath: string): boolean {
  const content = defaultProcessedContent({ filePath: filePath as FilePath })
  return filter.shouldPublish({} as BuildCtx, content)
}

describe("RemoveDrafts", () => {
  it("has the correct name", () => {
    expect(filter.name).toBe("RemoveDrafts")
  })

  it.each([
    ["website_content/posts/my-article.md", true],
    ["website_content/about.md", true],
    ["some/path/without/drafts.md", true],
  ])("publishes non-draft file %s", (filePath, expected) => {
    expect(shouldPublish(filePath)).toBe(expected)
  })

  it.each([
    ["website_content/drafts/wip.md", false],
    ["drafts/something.md", false],
    ["some/nested/drafts/file.md", false],
  ])("filters out draft file %s", (filePath, expected) => {
    expect(shouldPublish(filePath)).toBe(expected)
  })

  it.each([
    ["website_content/drafts/templates/my-template.md", true],
    ["drafts/templates/base.md", true],
  ])("publishes template even inside drafts/ %s", (filePath, expected) => {
    expect(shouldPublish(filePath)).toBe(expected)
  })

  it("falls back to vfile.path when data.filePath is undefined", () => {
    const content = defaultProcessedContent({})
    content[1].path = "website_content/posts/article.md"
    expect(filter.shouldPublish({} as BuildCtx, content)).toBe(true)
  })

  it("falls back to empty string when both filePath and path are undefined", () => {
    const content = defaultProcessedContent({})
    // With empty string, includes("drafts/") is false → publishes
    expect(filter.shouldPublish({} as BuildCtx, content)).toBe(true)
  })
})
