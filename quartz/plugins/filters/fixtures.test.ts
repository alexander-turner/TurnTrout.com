import { describe, it, expect, beforeEach, afterEach } from "@jest/globals"

import { type BuildCtx } from "../../util/ctx"
import { type FilePath } from "../../util/path"
import { defaultProcessedContent } from "../vfile"
import { RemoveFixtures } from "./fixtures"

const filter = RemoveFixtures()

function shouldPublish(filePath: string): boolean {
  const content = defaultProcessedContent({ filePath: filePath as FilePath })
  return filter.shouldPublish({} as BuildCtx, content)
}

describe("RemoveFixtures", () => {
  const originalEnv = process.env.INCLUDE_FIXTURES

  beforeEach(() => {
    delete process.env.INCLUDE_FIXTURES
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.INCLUDE_FIXTURES
    } else {
      process.env.INCLUDE_FIXTURES = originalEnv
    }
  })

  it.each([
    ["website_content/posts/my-article.md", true],
    ["website_content/about.md", true],
    ["some/path/without/keyword.md", true],
  ])("publishes non-fixture file %s", (filePath, expected) => {
    expect(shouldPublish(filePath)).toBe(expected)
  })

  it.each([
    ["website_content/fixtures/emoji-fixture.md", false],
    ["fixtures/popover-fixture.md", false],
    ["some/nested/fixtures/page.md", false],
  ])("filters out fixture file %s", (filePath, expected) => {
    expect(shouldPublish(filePath)).toBe(expected)
  })

  it("publishes fixtures when INCLUDE_FIXTURES=true", () => {
    process.env.INCLUDE_FIXTURES = "true"
    expect(shouldPublish("website_content/fixtures/emoji-fixture.md")).toBe(true)
  })

  it("still filters fixtures when INCLUDE_FIXTURES is any other value", () => {
    process.env.INCLUDE_FIXTURES = "1"
    expect(shouldPublish("website_content/fixtures/emoji-fixture.md")).toBe(false)
  })

  it("falls back to vfile.path when data.filePath is undefined", () => {
    const content = defaultProcessedContent({})
    content[1].path = "website_content/fixtures/popover-fixture.md"
    expect(filter.shouldPublish({} as BuildCtx, content)).toBe(false)
  })

  it("falls back to empty string when both filePath and path are undefined", () => {
    const content = defaultProcessedContent({})
    expect(filter.shouldPublish({} as BuildCtx, content)).toBe(true)
  })
})
