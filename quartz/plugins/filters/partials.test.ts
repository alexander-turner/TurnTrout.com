import { describe, expect, it } from "@jest/globals"

import { type BuildCtx } from "../../util/ctx"
import { type FilePath } from "../../util/path"
import { defaultProcessedContent } from "../vfile"
import { RemovePartials } from "./partials"

const filter = RemovePartials()

function shouldPublish(filePath: string): boolean {
  const content = defaultProcessedContent({ filePath: filePath as FilePath })
  return filter.shouldPublish({} as BuildCtx, content)
}

describe("RemovePartials", () => {
  it.each([
    ["website_content/posts/my-article.md", true],
    ["website_content/about.md", true],
    ["some/path/without/keyword.md", true],
  ])("publishes non-partial file %s", (filePath, expected) => {
    expect(shouldPublish(filePath)).toBe(expected)
  })

  it.each([
    ["website_content/partials/font_stats.md", false],
    ["partials/inversion-demo.md", false],
    ["some/nested/partials/fragment.md", false],
  ])("filters out partial file %s", (filePath, expected) => {
    expect(shouldPublish(filePath)).toBe(expected)
  })

  it("falls back to vfile.path when data.filePath is undefined", () => {
    const content = defaultProcessedContent({})
    content[1].path = "website_content/partials/font_stats.md"
    expect(filter.shouldPublish({} as BuildCtx, content)).toBe(false)
  })

  it("falls back to empty string when both filePath and path are undefined", () => {
    const content = defaultProcessedContent({})
    expect(filter.shouldPublish({} as BuildCtx, content)).toBe(true)
  })
})
