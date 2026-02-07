import { jest, describe, it, expect, beforeEach } from "@jest/globals"
import fs from "fs"

import { type FilePath, joinSegments, QUARTZ } from "../../util/path"

const mockGlob = jest.fn<(pattern: string, dir: string, ignore: string[]) => Promise<FilePath[]>>()

jest.unstable_mockModule("../../util/glob", () => ({
  glob: mockGlob,
}))

const { isLocalFavicon, shouldCopyToRoot, Static } = await import("./static")

type BuildCtx = import("../../util/ctx").BuildCtx
type StaticResources = import("../../util/resources").StaticResources

const mockCtx = {
  argv: { output: "public" },
  cfg: { configuration: { ignorePatterns: [] } },
} as unknown as BuildCtx

const mockResources: StaticResources = { css: [], js: [] }

describe("isLocalFavicon", () => {
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
  const plugin = Static()

  beforeEach(() => {
    jest.restoreAllMocks()
    mockGlob.mockReset()
  })

  it("getQuartzComponents returns empty array", () => {
    expect(plugin.getQuartzComponents(mockCtx)).toEqual([])
  })

  describe("getDependencyGraph", () => {
    it("maps root files to output root and others to output/static/", async () => {
      mockGlob.mockResolvedValue([
        "robots.txt" as FilePath,
        "favicon.ico" as FilePath,
        "script.js" as FilePath,
      ])

      const graph = await plugin.getDependencyGraph!(mockCtx, [], mockResources)

      // Root files: edge from static/X -> output/X
      expect(
        graph.hasEdge(
          joinSegments("static", "robots.txt") as FilePath,
          joinSegments("public", "robots.txt") as FilePath,
        ),
      ).toBe(true)
      expect(
        graph.hasEdge(
          joinSegments("static", "favicon.ico") as FilePath,
          joinSegments("public", "favicon.ico") as FilePath,
        ),
      ).toBe(true)

      // Non-root files: edge from static/X -> output/static/X
      expect(
        graph.hasEdge(
          joinSegments("static", "script.js") as FilePath,
          joinSegments("public", "static", "script.js") as FilePath,
        ),
      ).toBe(true)
    })
  })

  describe("emit", () => {
    it("copies root files, favicons to root, and others to static/", async () => {
      mockGlob.mockResolvedValue(["favicon.ico" as FilePath, "script.js" as FilePath])

      const staticPath = joinSegments(QUARTZ, "static")

      jest.spyOn(fs, "existsSync").mockImplementation((p) => {
        const pathStr = String(p)
        return (
          pathStr === joinSegments(staticPath, "robots.txt") ||
          pathStr === joinSegments(staticPath, "favicon.ico")
        )
      })

      const copyFileMock = jest.spyOn(fs.promises, "copyFile").mockResolvedValue(undefined)
      const cpMock = jest.spyOn(fs.promises, "cp").mockResolvedValue(undefined)

      const result = await plugin.emit(mockCtx, [], mockResources)

      expect(copyFileMock).toHaveBeenCalledWith(
        joinSegments(staticPath, "robots.txt"),
        joinSegments("public", "robots.txt"),
      )
      expect(copyFileMock).toHaveBeenCalledWith(
        joinSegments(staticPath, "favicon.ico"),
        joinSegments("public", "favicon.ico"),
      )
      expect(cpMock).toHaveBeenCalledWith(staticPath, joinSegments("public", "static"), {
        recursive: true,
        dereference: true,
      })

      expect(result).toContain(joinSegments("public", "robots.txt"))
      expect(result).toContain(joinSegments("public", "favicon.ico"))
      expect(result).toContain(joinSegments("public", "static", "script.js"))
    })

    it("skips root files and favicons that don't exist on disk", async () => {
      mockGlob.mockResolvedValue(["script.js" as FilePath])

      jest.spyOn(fs, "existsSync").mockReturnValue(false)
      jest.spyOn(fs.promises, "cp").mockResolvedValue(undefined)
      const copyFileMock = jest.spyOn(fs.promises, "copyFile").mockResolvedValue(undefined)

      const result = await plugin.emit(mockCtx, [], mockResources)

      expect(copyFileMock).not.toHaveBeenCalled()
      expect(result).toEqual([joinSegments("public", "static", "script.js")])
    })
  })
})
