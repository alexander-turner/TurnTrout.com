import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals"

import type { BuildCtx } from "../../util/ctx"

import {
  PopulateExternalMarkdown,
  populateExternalContent,
  stripBadges,
  fetchGitHubContentSync,
  clearContentCache,
  setFetchFunction,
  resetFetchFunction,
  type FetchFunction,
} from "./populateExternalMarkdown"

describe("PopulateExternalMarkdown", () => {
  let mockFetch: jest.MockedFunction<FetchFunction>

  beforeEach(() => {
    clearContentCache()
    mockFetch = jest.fn<FetchFunction>()
    setFetchFunction(mockFetch)
  })

  afterEach(() => {
    clearContentCache()
    resetFetchFunction()
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
        '<span class="populate-project-readme"></span>',
        "# Content",
        { project: { owner: "user", repo: "project" } },
        "# Content",
      ],
      [
        'Before\n\n<span class="populate-project-readme"></span>\n\nAfter',
        "# README",
        { project: { owner: "user", repo: "project" } },
        "Before\n\n# README\n\nAfter",
      ],
      [
        '<span  class="populate-project-readme" ></span>',
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
        populateExternalContent('<span class="populate-project-readme"></span>', sources),
      ).toBe("# Content")
    })

    it("should cache fetched content", () => {
      mockFetch.mockReturnValue("Cached")
      const sources = { project: { owner: "user", repo: "project" } }
      populateExternalContent('<span class="populate-project-readme"></span>', sources)
      populateExternalContent('<span class="populate-project-readme"></span>', sources)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("should throw on missing source", () => {
      expect(() =>
        populateExternalContent('<span class="populate-unknown-readme"></span>', {}),
      ).toThrow('No source configured for placeholder "unknown"')
    })

    it("should propagate fetch errors", () => {
      mockFetch.mockImplementation(() => {
        throw new Error("Network error")
      })
      expect(() =>
        populateExternalContent('<span class="populate-project-readme"></span>', {
          project: { owner: "user", repo: "project" },
        }),
      ).toThrow("Network error")
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
      ["string input", 'Before\n<span class="populate-project-readme"></span>\nAfter'],
      ["Buffer input", Buffer.from('<span class="populate-project-readme"></span>')],
    ])("should process %s with placeholders", (_, input) => {
      mockFetch.mockReturnValue("# Content")
      const plugin = PopulateExternalMarkdown({
        sources: { project: { owner: "user", repo: "project" } },
      })
      const result = plugin.textTransform?.({} as BuildCtx, input)
      expect(result).toContain("# Content")
    })

    it("should throw on missing source", () => {
      const plugin = PopulateExternalMarkdown({ sources: {} })
      expect(() =>
        plugin.textTransform?.({} as BuildCtx, '<span class="populate-unknown-readme"></span>'),
      ).toThrow('No source configured for placeholder "unknown"')
    })
  })
})
