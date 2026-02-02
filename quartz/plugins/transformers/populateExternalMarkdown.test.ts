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
  type ExternalMarkdownSource,
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
    it("should fetch content from GitHub", () => {
      const mockContent = "# README\n\nSome content"
      mockFetch.mockReturnValue(mockContent)

      const source: ExternalMarkdownSource = {
        owner: "test-owner",
        repo: "test-repo",
      }

      const result = fetchGitHubContentSync(source)

      expect(result).toBe(mockContent)
      expect(mockFetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/test-owner/test-repo/main/README.md",
      )
    })

    it("should use custom ref and path", () => {
      mockFetch.mockReturnValue("content")

      const source: ExternalMarkdownSource = {
        owner: "owner",
        repo: "repo",
        ref: "develop",
        path: "docs/API.md",
      }

      fetchGitHubContentSync(source)

      expect(mockFetch).toHaveBeenCalledWith(
        "https://raw.githubusercontent.com/owner/repo/develop/docs/API.md",
      )
    })

    it("should throw on fetch failure", () => {
      mockFetch.mockImplementation(() => {
        throw new Error("Network error")
      })

      const source: ExternalMarkdownSource = {
        owner: "owner",
        repo: "repo",
      }

      expect(() => fetchGitHubContentSync(source)).toThrow(
        "Failed to fetch https://raw.githubusercontent.com/owner/repo/main/README.md",
      )
    })
  })

  describe("populateExternalContent", () => {
    it("should replace placeholder with fetched content", () => {
      const mockContent = "# Fetched README"
      mockFetch.mockReturnValue(mockContent)

      const sources: Record<string, ExternalMarkdownSource> = {
        "test-project": { owner: "user", repo: "project" },
      }

      const input = 'Before\n\n<span class="populate-test-project-readme"></span>\n\nAfter'
      const result = populateExternalContent(input, sources)

      expect(result).toBe("Before\n\n# Fetched README\n\nAfter")
    })

    it("should handle multiple placeholders", () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("project-a")) return "Content A"
        if (url.includes("project-b")) return "Content B"
        return "Unknown"
      })

      const sources: Record<string, ExternalMarkdownSource> = {
        "project-a": { owner: "user", repo: "project-a" },
        "project-b": { owner: "user", repo: "project-b" },
      }

      const input =
        '<span class="populate-project-a-readme"></span>\n\n---\n\n<span class="populate-project-b-readme"></span>'
      const result = populateExternalContent(input, sources)

      expect(result).toBe("Content A\n\n---\n\nContent B")
    })

    it("should apply transform function to fetched content", () => {
      mockFetch.mockReturnValue("[![Badge](url)](link)\n\n# Content")

      const sources: Record<string, ExternalMarkdownSource> = {
        project: {
          owner: "user",
          repo: "project",
          transform: stripBadges,
        },
      }

      const input = '<span class="populate-project-readme"></span>'
      const result = populateExternalContent(input, sources)

      expect(result).toBe("# Content")
    })

    it("should cache fetched content", () => {
      mockFetch.mockReturnValue("Cached content")

      const sources: Record<string, ExternalMarkdownSource> = {
        project: { owner: "user", repo: "project" },
      }

      // First call
      populateExternalContent('<span class="populate-project-readme"></span>', sources)
      // Second call with same source
      populateExternalContent('<span class="populate-project-readme"></span>', sources)

      // Should only fetch once due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("should throw on missing source", () => {
      const sources: Record<string, ExternalMarkdownSource> = {}

      expect(() =>
        populateExternalContent('<span class="populate-unknown-readme"></span>', sources),
      ).toThrow('No source configured for placeholder "unknown"')
    })

    it("should throw on fetch error", () => {
      mockFetch.mockImplementation(() => {
        throw new Error("Network error")
      })

      const sources: Record<string, ExternalMarkdownSource> = {
        project: { owner: "user", repo: "project" },
      }

      const input = '<span class="populate-project-readme"></span>'

      expect(() => populateExternalContent(input, sources)).toThrow("Network error")
    })

    it("should handle placeholder with extra whitespace", () => {
      mockFetch.mockReturnValue("Content")

      const sources: Record<string, ExternalMarkdownSource> = {
        project: { owner: "user", repo: "project" },
      }

      const input = '<span  class="populate-project-readme" ></span>'
      const result = populateExternalContent(input, sources)

      expect(result).toBe("Content")
    })
  })

  describe("PopulateExternalMarkdown plugin", () => {
    it("should have correct plugin name", () => {
      const plugin = PopulateExternalMarkdown({ sources: {} })
      expect(plugin.name).toBe("populateExternalMarkdown")
    })

    it("should skip processing when no placeholders present", () => {
      const plugin = PopulateExternalMarkdown({ sources: {} })
      const mockCtx = {} as BuildCtx

      const input = "Regular content without placeholders"
      const result = plugin.textTransform?.(mockCtx, input)

      expect(result).toBe(input)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it("should process content with placeholders", () => {
      mockFetch.mockReturnValue("# README Content")

      const plugin = PopulateExternalMarkdown({
        sources: {
          "my-project": { owner: "user", repo: "my-project" },
        },
      })
      const mockCtx = {} as BuildCtx

      const input = 'Before\n<span class="populate-my-project-readme"></span>\nAfter'
      const result = plugin.textTransform?.(mockCtx, input)

      expect(result).toBe("Before\n# README Content\nAfter")
    })

    it("should handle Buffer input", () => {
      mockFetch.mockReturnValue("Buffer content")

      const plugin = PopulateExternalMarkdown({
        sources: {
          project: { owner: "user", repo: "project" },
        },
      })
      const mockCtx = {} as BuildCtx

      const input = Buffer.from('<span class="populate-project-readme"></span>')
      const result = plugin.textTransform?.(mockCtx, input)

      expect(result).toBe("Buffer content")
    })

    it("should throw on missing source", () => {
      const plugin = PopulateExternalMarkdown({ sources: {} })
      const mockCtx = {} as BuildCtx

      const input = '<span class="populate-unknown-readme"></span>'

      expect(() => plugin.textTransform?.(mockCtx, input)).toThrow(
        'No source configured for placeholder "unknown"',
      )
    })

    it("should use default empty sources when options not provided", () => {
      const plugin = PopulateExternalMarkdown()
      expect(plugin.name).toBe("populateExternalMarkdown")
    })
  })
})
