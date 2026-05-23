import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import childProcess from "child_process"
import fs from "fs"

import type { BuildCtx } from "../../util/ctx"

import {
  buildPlaceholderRegex,
  clearContentCache,
  fetchGitHubContentSync,
  fetchLocalContentSync,
  isLocalSource,
  populateExternalContent,
  PopulateExternalMarkdown,
  stripBadges,
} from "./populateExternalMarkdown"

/** Wraps `"key": value` output in braces so it can be parsed as JSON. */
const parseJsonEntry = (entry: string) => JSON.parse(`{${entry}}`) as unknown

describe("PopulateExternalMarkdown", () => {
  let mockFetch: jest.SpiedFunction<typeof childProcess.execFileSync>
  let mockReadFile: jest.SpiedFunction<typeof fs.readFileSync>

  beforeEach(() => {
    clearContentCache()
    mockFetch = jest.spyOn(childProcess, "execFileSync").mockReturnValue("") as jest.SpiedFunction<
      typeof childProcess.execFileSync
    >
    mockReadFile = jest.spyOn(fs, "readFileSync").mockReturnValue("") as jest.SpiedFunction<
      typeof fs.readFileSync
    >
  })

  afterEach(() => {
    clearContentCache()
    jest.restoreAllMocks()
  })

  describe("stripBadges", () => {
    it.each([
      [
        "[![Test](https://example.com/badge.svg)](https://example.com)\n\nContent here",
        "Content here",
      ],
      ["[![Badge1](img1)](link1)[![Badge2](img2)](link2)\n\nContent", "Content"],
      ["Content without badges", "Content without badges"],
      [
        "[![Test](https://github.com/action/badge.svg)](link)\n[![Lint](lint.svg)](link2)\n\nMain content",
        "Main content",
      ],
      ["No badges here", "No badges here"],
    ])("should strip badges from markdown", (input, expected) => {
      expect(stripBadges(input)).toBe(expected)
    })
  })

  describe("fetchGitHubContentSync", () => {
    it.each([
      [{ owner: "test-owner", repo: "test-repo" }, "main/README.md"],
      [
        { owner: "owner", repo: "repo", ref: "develop", path: "docs/API.md" },
        "develop/docs/API.md",
      ],
    ])("should construct correct URL for source %j", (source, expectedPath) => {
      mockFetch.mockReturnValue("content")
      fetchGitHubContentSync(source)
      expect(mockFetch).toHaveBeenCalledWith(
        "curl",
        ["-sf", `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${expectedPath}`],
        expect.objectContaining({ encoding: "utf-8" }),
      )
    })
  })

  describe("populateExternalContent", () => {
    it.each([
      [
        '<span class="populate-markdown-project"></span>',
        "# Content",
        { project: { owner: "user", repo: "project" } },
        "# Content",
      ],
      [
        'Before\n\n<span class="populate-markdown-project"></span>\n\nAfter',
        "# README",
        { project: { owner: "user", repo: "project" } },
        "Before\n\n# README\n\nAfter",
      ],
      [
        '<span  class="populate-markdown-project" ></span>',
        "Content",
        { project: { owner: "user", repo: "project" } },
        "Content",
      ],
    ])("should replace placeholder %j with content", (input, fetchedContent, sources, expected) => {
      mockFetch.mockReturnValue(fetchedContent)
      expect(populateExternalContent(input, sources)).toBe(expected)
    })

    it("should apply transform function", () => {
      mockFetch.mockReturnValue("[![Badge](url)](link)\n\n# Content")
      const sources = { project: { owner: "user", repo: "project", transform: stripBadges } }
      expect(
        populateExternalContent('<span class="populate-markdown-project"></span>', sources),
      ).toBe("# Content")
    })

    it("should cache fetched content", () => {
      mockFetch.mockReturnValue("Cached")
      const sources = { project: { owner: "user", repo: "project" } }
      populateExternalContent('<span class="populate-markdown-project"></span>', sources)
      populateExternalContent('<span class="populate-markdown-project"></span>', sources)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("should ignore unconfigured placeholders", () => {
      const input = '<span class="populate-markdown-unknown"></span>'
      expect(populateExternalContent(input, {})).toBe(input)
    })

    it("should ignore other populate- spans when sources are configured", () => {
      mockFetch.mockReturnValue("Replaced")
      const input =
        '<span class="populate-markdown-project"></span> and <span class="populate-commit-count"></span>'
      const sources = { project: { owner: "user", repo: "project" } }
      expect(populateExternalContent(input, sources)).toBe(
        'Replaced and <span class="populate-commit-count"></span>',
      )
    })

    it("should propagate fetch errors with context", () => {
      const cause = new Error("Network error")
      mockFetch.mockImplementation(() => {
        throw cause
      })
      let thrown: Error | undefined
      try {
        populateExternalContent('<span class="populate-markdown-project"></span>', {
          project: { owner: "user", repo: "project" },
        })
      } catch (e) {
        thrown = e as Error
      }
      expect(thrown?.message).toBe(
        'Failed to fetch content for placeholder "project" from user/project',
      )
      expect(thrown?.cause).toBe(cause)
    })
  })

  describe("buildPlaceholderRegex", () => {
    it("should return null when no sources configured", () => {
      expect(buildPlaceholderRegex([])).toBeNull()
    })

    it("should only match configured source names", () => {
      const regex = buildPlaceholderRegex(["project"]) as RegExp
      expect('<span class="populate-markdown-project"></span>'.match(regex)).not.toBeNull()
      expect('<span class="populate-markdown-other"></span>'.match(regex)).toBeNull()
      expect('<span class="populate-commit-count"></span>'.match(regex)).toBeNull()
    })

    it("should escape special regex characters in source names", () => {
      const regex = buildPlaceholderRegex(["test.name"]) as RegExp
      expect('<span class="populate-markdown-test.name"></span>'.match(regex)).not.toBeNull()
      expect('<span class="populate-markdown-testXname"></span>'.match(regex)).toBeNull()
    })
  })

  describe("isLocalSource", () => {
    it.each([
      [{ filePath: "package.json" }, true],
      [{ filePath: "test.json", jsonPath: "key" }, true],
      [{ owner: "user", repo: "project" }, false],
    ])("should identify source %j as local: %s", (source, expected) => {
      expect(isLocalSource(source)).toBe(expected)
    })
  })

  describe("fetchLocalContentSync", () => {
    it("should read file content", () => {
      mockReadFile.mockReturnValue("file content")
      expect(fetchLocalContentSync({ filePath: "test.txt" })).toBe("file content")
    })

    it("should extract JSON path without outer braces", () => {
      mockReadFile.mockReturnValue('{"key": {"nested": "value"}}')
      const result = fetchLocalContentSync({ filePath: "test.json", jsonPath: "key" })
      expect(parseJsonEntry(result)).toEqual({ key: { nested: "value" } })
    })

    it("should handle nested JSON path", () => {
      mockReadFile.mockReturnValue('{"a": {"b": "deep"}}')
      const result = fetchLocalContentSync({ filePath: "test.json", jsonPath: "a.b" })
      expect(parseJsonEntry(result)).toEqual({ "a.b": "deep" })
    })

    it("should throw on missing JSON path", () => {
      mockReadFile.mockReturnValue('{"existing": "value"}')
      expect(() => fetchLocalContentSync({ filePath: "test.json", jsonPath: "missing" })).toThrow(
        'JSON path "missing" not found in test.json',
      )
    })

    it("should throw a descriptive error on invalid JSON content", () => {
      mockReadFile.mockReturnValue("not valid json {{{")
      expect(() => fetchLocalContentSync({ filePath: "bad.json", jsonPath: "key" })).toThrow(
        "Failed to parse JSON from bad.json: content is not valid JSON",
      )
    })
  })

  describe("populateExternalContent with local sources", () => {
    it("should replace placeholder with local file content", () => {
      mockReadFile.mockReturnValue('{"lint-staged": {"*.ts": "eslint"}}')
      const sources = {
        "lint-staged": {
          filePath: "package.json",
          jsonPath: "lint-staged",
        },
      }
      const result = populateExternalContent(
        '<span class="populate-markdown-lint-staged"></span>',
        sources,
      )
      expect(parseJsonEntry(result)).toEqual({ "lint-staged": { "*.ts": "eslint" } })
    })
  })

  describe("PopulateExternalMarkdown plugin", () => {
    it.each([
      ["explicit empty sources", { sources: {} }],
      ["undefined opts (exercises `opts?.sources ?? {}` default)", undefined],
    ])("skips processing when no placeholders present (%s)", (_d, opts) => {
      const plugin = PopulateExternalMarkdown(opts as never)
      const result = plugin.textTransform?.({} as BuildCtx, "Regular content")
      expect(result).toBe("Regular content")
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it.each([
      ["string input", 'Before\n<span class="populate-markdown-project"></span>\nAfter'],
      ["Buffer input", Buffer.from('<span class="populate-markdown-project"></span>')],
    ])("should process %s with placeholders", (_, input) => {
      mockFetch.mockReturnValue("# Content")
      const plugin = PopulateExternalMarkdown({
        sources: { project: { owner: "user", repo: "project" } },
      })
      const result = plugin.textTransform?.({} as BuildCtx, input)
      expect(result).toContain("# Content")
    })
  })
})
