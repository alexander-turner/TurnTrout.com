import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals"

import type { BuildCtx } from "../../util/ctx"

import {
  PopulateExternalMarkdown,
  populateExternalContent,
  buildPlaceholderRegex,
  stripBadges,
  fetchGitHubContentSync,
  fetchLocalContentSync,
  isLocalSource,
  clearContentCache,
  setFetchFunction,
  resetFetchFunction,
  setReadFileFunction,
  resetReadFileFunction,
  type FetchFunction,
  type ReadFileFunction,
} from "./populateExternalMarkdown"

/** Wraps `"key": value` output in braces so it can be parsed as JSON. */
const parseJsonEntry = (entry: string) => JSON.parse(`{${entry}}`) as unknown

describe("PopulateExternalMarkdown", () => {
  let mockFetch: jest.MockedFunction<FetchFunction>
  let mockReadFile: jest.MockedFunction<ReadFileFunction>

  beforeEach(() => {
    clearContentCache()
    mockFetch = jest.fn<FetchFunction>()
    mockReadFile = jest.fn<ReadFileFunction>()
    setFetchFunction(mockFetch)
    setReadFileFunction(mockReadFile)
  })

  afterEach(() => {
    clearContentCache()
    resetFetchFunction()
    resetReadFileFunction()
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
        `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${expectedPath}`,
      )
    })

    it("should propagate fetch errors", () => {
      mockFetch.mockImplementation(() => {
        throw new Error("Network error")
      })
      expect(() => fetchGitHubContentSync({ owner: "owner", repo: "repo" })).toThrow(
        "Network error",
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

    it("should propagate fetch errors", () => {
      mockFetch.mockImplementation(() => {
        throw new Error("Network error")
      })
      expect(() =>
        populateExternalContent('<span class="populate-markdown-project"></span>', {
          project: { owner: "user", repo: "project" },
        }),
      ).toThrow("Network error")
    })
  })

  describe("buildPlaceholderRegex", () => {
    it("should never match when no sources configured", () => {
      const regex = buildPlaceholderRegex([])
      expect('<span class="populate-markdown-test"></span>'.match(regex)).toBeNull()
    })

    it("should only match configured source names", () => {
      const regex = buildPlaceholderRegex(["project"])
      expect('<span class="populate-markdown-project"></span>'.match(regex)).not.toBeNull()
      expect('<span class="populate-markdown-other"></span>'.match(regex)).toBeNull()
      expect('<span class="populate-commit-count"></span>'.match(regex)).toBeNull()
    })

    it("should escape special regex characters in source names", () => {
      const regex = buildPlaceholderRegex(["test.name"])
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

    it("should propagate file read errors", () => {
      mockReadFile.mockImplementation(() => {
        throw new Error("ENOENT")
      })
      expect(() => fetchLocalContentSync({ filePath: "missing.txt" })).toThrow("ENOENT")
    })

    it("should throw on missing JSON path", () => {
      mockReadFile.mockReturnValue('{"existing": "value"}')
      expect(() => fetchLocalContentSync({ filePath: "test.json", jsonPath: "missing" })).toThrow(
        'JSON path "missing" not found in test.json',
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

    it("should apply transform to local content", () => {
      mockReadFile.mockReturnValue('{"key": "value"}')
      const sources = {
        config: {
          filePath: "config.json",
          jsonPath: "key",
          transform: (content: string) => `\`\`\`json\n${content}\n\`\`\``,
        },
      }
      const result = populateExternalContent(
        '<span class="populate-markdown-config"></span>',
        sources,
      )
      expect(result).toMatch(/^```json\n/)
      expect(result).toMatch(/\n```$/)
      const jsonContent = result.replace(/^```json\n/, "").replace(/\n```$/, "")
      expect(parseJsonEntry(jsonContent)).toEqual({ key: "value" })
    })

    it("should cache local content", () => {
      mockReadFile.mockReturnValue("cached content")
      const sources = { local: { filePath: "test.txt" } }
      populateExternalContent('<span class="populate-markdown-local"></span>', sources)
      populateExternalContent('<span class="populate-markdown-local"></span>', sources)
      expect(mockReadFile).toHaveBeenCalledTimes(1)
    })
  })

  describe("PopulateExternalMarkdown plugin", () => {
    it.each([
      [{ sources: {} }, "populateExternalMarkdown"],
      [undefined, "populateExternalMarkdown"],
    ])("should have correct plugin name with opts %j", (opts, expectedName) => {
      const plugin = PopulateExternalMarkdown(opts as never)
      expect(plugin.name).toBe(expectedName)
    })

    it("should skip processing when no placeholders present", () => {
      const plugin = PopulateExternalMarkdown({ sources: {} })
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

    it("should ignore unconfigured placeholders", () => {
      const plugin = PopulateExternalMarkdown({ sources: {} })
      const input = '<span class="populate-markdown-unknown"></span>'
      expect(plugin.textTransform?.({} as BuildCtx, input)).toBe(input)
    })
  })
})
