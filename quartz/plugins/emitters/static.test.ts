import { jest, describe, it, expect, beforeAll, beforeEach } from "@jest/globals"

import type { QuartzConfig } from "../../cfg"
import type { BuildCtx } from "../../util/ctx"

import { type FilePath } from "../../util/path"

// Mock fs and glob before importing Static
const mockExistsSync = jest.fn<typeof import("fs").existsSync>()
const mockCopyFile = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
const mockCp = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)

jest.unstable_mockModule("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    promises: {
      copyFile: mockCopyFile,
      cp: mockCp,
    },
  },
}))

const mockGlob = jest.fn<() => Promise<FilePath[]>>()
jest.unstable_mockModule("../../util/glob", () => ({
  glob: mockGlob,
}))

describe("isLocalFavicon", () => {
  let isLocalFavicon: typeof import("./static").isLocalFavicon

  beforeAll(async () => {
    const mod = await import("./static")
    isLocalFavicon = mod.isLocalFavicon
  })

  it.each([
    { file: "favicon.ico", expected: true },
    { file: "favicon.png", expected: true },
    { file: "favicon.svg", expected: true },
    { file: "favicon.webp", expected: true },
    { file: "robots.txt", expected: false },
    { file: "script.js", expected: false },
    { file: "styles/main.css", expected: false },
    { file: "my-favicon.ico", expected: false },
    { file: "favicon", expected: false },
  ])("returns $expected for $file", ({ file, expected }) => {
    expect(isLocalFavicon(file as FilePath)).toBe(expected)
  })
})

describe("shouldCopyToRoot", () => {
  let shouldCopyToRoot: typeof import("./static").shouldCopyToRoot

  beforeAll(async () => {
    const mod = await import("./static")
    shouldCopyToRoot = mod.shouldCopyToRoot
  })

  it.each([
    // ROOT_FILES
    { file: "robots.txt", expected: true },
    { file: "_headers", expected: true },
    { file: "_redirects", expected: true },
    // Favicon files
    { file: "favicon.ico", expected: true },
    { file: "favicon.png", expected: true },
    // Files that should go to /static/
    { file: "script.js", expected: false },
    { file: "styles/main.css", expected: false },
    { file: "images/logo.png", expected: false },
    { file: "fonts/font.woff2", expected: false },
  ])("returns $expected for $file", ({ file, expected }) => {
    expect(shouldCopyToRoot(file as FilePath)).toBe(expected)
  })
})

describe("Static plugin", () => {
  let Static: typeof import("./static").Static
  let plugin: ReturnType<typeof Static>

  const mockCtx: BuildCtx = {
    argv: {
      directory: "/content",
      output: "public",
      verbose: false,
      serve: false,
      fastRebuild: false,
      port: 3000,
      wsPort: 3001,
    },
    cfg: {
      configuration: { ignorePatterns: [] },
    } as unknown as QuartzConfig,
    allSlugs: [],
  }

  beforeAll(async () => {
    const mod = await import("./static")
    Static = mod.Static
    plugin = Static()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("getQuartzComponents returns empty array", () => {
    expect(plugin.getQuartzComponents(mockCtx)).toEqual([])
  })

  describe("getDependencyGraph", () => {
    it("creates edges mapping root files to output root", async () => {
      mockGlob.mockResolvedValue(["robots.txt", "favicon.ico"] as FilePath[])

      const graph = await plugin.getDependencyGraph!(mockCtx, [], { css: [], js: [] })

      expect(graph.hasEdge("static/robots.txt" as FilePath, "public/robots.txt" as FilePath)).toBe(
        true,
      )
      expect(
        graph.hasEdge("static/favicon.ico" as FilePath, "public/favicon.ico" as FilePath),
      ).toBe(true)
    })

    it("creates edges mapping regular files to output/static/", async () => {
      mockGlob.mockResolvedValue(["script.js", "images/logo.png"] as FilePath[])

      const graph = await plugin.getDependencyGraph!(mockCtx, [], { css: [], js: [] })

      expect(
        graph.hasEdge("static/script.js" as FilePath, "public/static/script.js" as FilePath),
      ).toBe(true)
      expect(
        graph.hasEdge(
          "static/images/logo.png" as FilePath,
          "public/static/images/logo.png" as FilePath,
        ),
      ).toBe(true)
    })

    it("handles mix of root and regular files", async () => {
      mockGlob.mockResolvedValue([
        "robots.txt",
        "_headers",
        "favicon.svg",
        "script.js",
        "fonts/font.woff2",
      ] as FilePath[])

      const graph = await plugin.getDependencyGraph!(mockCtx, [], { css: [], js: [] })

      // Root files -> output root
      expect(graph.hasEdge("static/robots.txt" as FilePath, "public/robots.txt" as FilePath)).toBe(
        true,
      )
      expect(graph.hasEdge("static/_headers" as FilePath, "public/_headers" as FilePath)).toBe(true)
      expect(
        graph.hasEdge("static/favicon.svg" as FilePath, "public/favicon.svg" as FilePath),
      ).toBe(true)

      // Regular files -> output/static/
      expect(
        graph.hasEdge("static/script.js" as FilePath, "public/static/script.js" as FilePath),
      ).toBe(true)
      expect(
        graph.hasEdge(
          "static/fonts/font.woff2" as FilePath,
          "public/static/fonts/font.woff2" as FilePath,
        ),
      ).toBe(true)
    })

    it("returns empty graph when no files found", async () => {
      mockGlob.mockResolvedValue([] as FilePath[])

      const graph = await plugin.getDependencyGraph!(mockCtx, [], { css: [], js: [] })

      expect(graph.nodes).toHaveLength(0)
    })
  })

  describe("emit", () => {
    it("copies existing root files to output root", async () => {
      mockGlob.mockResolvedValue([] as FilePath[])
      mockExistsSync.mockReturnValue(true)

      const files = await plugin.emit(mockCtx, [], { css: [], js: [] })

      // Should check and copy all ROOT_FILES
      expect(mockExistsSync).toHaveBeenCalledWith("quartz/static/robots.txt")
      expect(mockExistsSync).toHaveBeenCalledWith("quartz/static/_headers")
      expect(mockExistsSync).toHaveBeenCalledWith("quartz/static/_redirects")
      expect(mockCopyFile).toHaveBeenCalledWith("quartz/static/robots.txt", "public/robots.txt")
      expect(mockCopyFile).toHaveBeenCalledWith("quartz/static/_headers", "public/_headers")
      expect(mockCopyFile).toHaveBeenCalledWith("quartz/static/_redirects", "public/_redirects")
      expect(files).toContain("public/robots.txt")
      expect(files).toContain("public/_headers")
      expect(files).toContain("public/_redirects")
    })

    it("skips non-existent root files", async () => {
      mockGlob.mockResolvedValue([] as FilePath[])
      mockExistsSync.mockReturnValue(false)

      const files = await plugin.emit(mockCtx, [], { css: [], js: [] })

      expect(mockCopyFile).not.toHaveBeenCalledWith("quartz/static/robots.txt", "public/robots.txt")
      expect(files).not.toContain("public/robots.txt")
    })

    it("copies favicon files to output root", async () => {
      mockGlob.mockResolvedValue(["favicon.ico", "favicon.png"] as FilePath[])
      mockExistsSync.mockReturnValue(true)

      const files = await plugin.emit(mockCtx, [], { css: [], js: [] })

      expect(mockCopyFile).toHaveBeenCalledWith("quartz/static/favicon.ico", "public/favicon.ico")
      expect(mockCopyFile).toHaveBeenCalledWith("quartz/static/favicon.png", "public/favicon.png")
      expect(files).toContain("public/favicon.ico")
      expect(files).toContain("public/favicon.png")
    })

    it("skips non-existent favicon files", async () => {
      mockGlob.mockResolvedValue(["favicon.ico"] as FilePath[])
      mockExistsSync.mockReturnValue(false)

      const files = await plugin.emit(mockCtx, [], { css: [], js: [] })

      expect(files).not.toContain("public/favicon.ico")
    })

    it("recursively copies static directory to output/static/", async () => {
      mockGlob.mockResolvedValue(["script.js"] as FilePath[])
      mockExistsSync.mockReturnValue(false)

      await plugin.emit(mockCtx, [], { css: [], js: [] })

      expect(mockCp).toHaveBeenCalledWith("quartz/static", "public/static", {
        recursive: true,
        dereference: true,
      })
    })

    it("includes regular files in emitted list", async () => {
      mockGlob.mockResolvedValue(["script.js", "styles/main.css"] as FilePath[])
      mockExistsSync.mockReturnValue(false)

      const files = await plugin.emit(mockCtx, [], { css: [], js: [] })

      expect(files).toContain("public/static/script.js")
      expect(files).toContain("public/static/styles/main.css")
    })

    it("handles mix of root, favicon, and regular files", async () => {
      mockGlob.mockResolvedValue([
        "robots.txt",
        "favicon.ico",
        "script.js",
        "images/logo.png",
      ] as FilePath[])
      mockExistsSync.mockReturnValue(true)

      const files = await plugin.emit(mockCtx, [], { css: [], js: [] })

      // Root files copied to root
      expect(files).toContain("public/robots.txt")
      // Favicon files copied to root
      expect(files).toContain("public/favicon.ico")
      // Regular files listed under static/
      expect(files).toContain("public/static/script.js")
      expect(files).toContain("public/static/images/logo.png")
      // Root/favicon files should NOT appear in static/ list
      expect(files).not.toContain("public/static/robots.txt")
      expect(files).not.toContain("public/static/favicon.ico")
    })
  })
})
