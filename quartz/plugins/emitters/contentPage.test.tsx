import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals"
import { type Root } from "hast"
import { VFile } from "vfile"

import { type QuartzConfig } from "../../cfg"
import { type BuildCtx } from "../../util/ctx"
import { type FilePath, type FullSlug } from "../../util/path"
import { type StaticResources } from "../../util/resources"
import { type ProcessedContent, type QuartzPluginData } from "../vfile"

interface TestFileData {
  path: string
  filePath?: FilePath
  slug?: FullSlug
  frontmatter?: Partial<QuartzPluginData["frontmatter"]>
}

const createTestVFile = (data: TestFileData): VFile => {
  const filePath = "filePath" in data ? data.filePath : (data.path as FilePath)
  const slug =
    "slug" in data ? data.slug : (data.path.replace("content/", "").replace(".md", "") as FullSlug)
  return new VFile({
    path: data.path,
    data: {
      filePath,
      slug,
      frontmatter: {
        title: "Default Title",
        ...data.frontmatter,
      } as QuartzPluginData["frontmatter"],
    },
  })
}

const createMockContent = (vfile: VFile): ProcessedContent => {
  const root: Root = { type: "root", children: [] }
  return [root, vfile]
}

const mockStaticResources: StaticResources = { css: [], js: [] }

jest.unstable_mockModule("./helpers", () => ({
  write: jest.fn(async (opts: { slug: FullSlug; ext: string; content: string }) => {
    return await Promise.resolve(`public/${opts.slug}${opts.ext}` as FilePath)
  }),
}))

jest.unstable_mockModule("../../components/renderPage", () => ({
  renderPage: jest.fn(() => "<html>Mock page content</html>"),
  pageResources: jest.fn(() => ({ css: [], js: [] })),
}))

jest.unstable_mockModule("../../../config/quartz/quartz.layout", () => ({
  defaultContentPageLayout: {},
  sharedPageComponents: {},
}))

jest.unstable_mockModule("../../components/Body", () => ({
  default: jest.fn(() => () => null),
}))

jest.unstable_mockModule("../../components/Header", () => ({
  default: jest.fn(() => () => null),
}))

jest.unstable_mockModule("../../components", () => ({
  Content: jest.fn(() => () => null),
}))

describe("ContentPage", () => {
  let write: jest.MockedFunction<typeof import("./helpers").write>
  let ContentPage: typeof import("./contentPage").ContentPage
  let mockCtx: BuildCtx

  beforeAll(async () => {
    const helpersModule = await import("./helpers")
    write = helpersModule.write as jest.MockedFunction<typeof import("./helpers").write>

    const contentPageModule = await import("./contentPage")
    ContentPage = contentPageModule.ContentPage
  })

  beforeEach(() => {
    jest.clearAllMocks()

    mockCtx = {
      argv: {
        directory: "content" as FilePath,
        output: "public" as FilePath,
        serve: false,
        port: 8080,
        wsPort: 3001,
        fastRebuild: true,
        verbose: false,
      },
      allSlugs: [],
      cfg: {
        configuration: {
          pageTitle: "Test Site",
          enablePopovers: true,
          analytics: null,
          baseUrl: "example.com",
          ignorePatterns: [],
          defaultDateType: "created",
          navbar: {
            pages: [],
          },
        },
        plugins: {
          transformers: [],
          filters: [],
          emitters: [],
        },
      } as QuartzConfig,
    }
  })

  describe("permalink handling", () => {
    it("should use permalink in getDependencyGraph when present", async () => {
      const vfile = createTestVFile({
        path: "content/Test-page.md",
        filePath: "content/Test-page.md" as FilePath,
        slug: "Test-page" as FullSlug,
        frontmatter: {
          permalink: "test-page",
        },
      })

      const content: ProcessedContent[] = [createMockContent(vfile)]
      const plugin = ContentPage()

      if (!plugin.getDependencyGraph) {
        throw new Error("getDependencyGraph is not implemented")
      }

      const graph = await plugin.getDependencyGraph(mockCtx, content, mockStaticResources)

      expect(graph.hasNode("public/test-page.html" as FilePath)).toBe(true)
      expect(graph.hasNode("public/Test-page.html" as FilePath)).toBe(false)
    })

    it("should use original slug in getDependencyGraph when permalink is absent", async () => {
      const vfile = createTestVFile({
        path: "content/Test-page.md",
        filePath: "content/Test-page.md" as FilePath,
        slug: "Test-page" as FullSlug,
        frontmatter: {},
      })

      const content: ProcessedContent[] = [createMockContent(vfile)]
      const plugin = ContentPage()

      if (!plugin.getDependencyGraph) {
        throw new Error("getDependencyGraph is not implemented")
      }

      const graph = await plugin.getDependencyGraph(mockCtx, content, mockStaticResources)

      expect(graph.hasNode("public/Test-page.html" as FilePath)).toBe(true)
    })

    it("should emit file at permalink location when present", async () => {
      const vfile = createTestVFile({
        path: "content/Test-page.md",
        filePath: "content/Test-page.md" as FilePath,
        slug: "Test-page" as FullSlug,
        frontmatter: {
          permalink: "test-page",
        },
      })

      const content: ProcessedContent[] = [createMockContent(vfile)]
      const plugin = ContentPage()

      const files = await plugin.emit(mockCtx, content, mockStaticResources)

      expect(files).toContain("public/test-page.html" as FilePath)
      expect(files).toHaveLength(1)

      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "test-page",
          ext: ".html",
        }),
      )
    })

    it("should emit file at original slug location when permalink is absent", async () => {
      const vfile = createTestVFile({
        path: "content/Test-page.md",
        filePath: "content/Test-page.md" as FilePath,
        slug: "Test-page" as FullSlug,
        frontmatter: {},
      })

      const content: ProcessedContent[] = [createMockContent(vfile)]
      const plugin = ContentPage()

      const files = await plugin.emit(mockCtx, content, mockStaticResources)

      expect(files).toContain("public/Test-page.html" as FilePath)

      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "Test-page",
          ext: ".html",
        }),
      )
    })

    it("should handle multiple files with different permalink configurations", async () => {
      const vfile1 = createTestVFile({
        path: "content/File1.md",
        filePath: "content/File1.md" as FilePath,
        slug: "File1" as FullSlug,
        frontmatter: {
          permalink: "custom-url-1",
        },
      })

      const vfile2 = createTestVFile({
        path: "content/File2.md",
        filePath: "content/File2.md" as FilePath,
        slug: "File2" as FullSlug,
        frontmatter: {},
      })

      const content: ProcessedContent[] = [createMockContent(vfile1), createMockContent(vfile2)]
      const plugin = ContentPage()

      const files = await plugin.emit(mockCtx, content, mockStaticResources)

      expect(files).toContain("public/custom-url-1.html" as FilePath)
      expect(files).toContain("public/File2.html" as FilePath)
      expect(files).toHaveLength(2)
    })

    it("should handle empty string permalink as falsy", async () => {
      const vfile = createTestVFile({
        path: "content/Test-page.md",
        filePath: "content/Test-page.md" as FilePath,
        slug: "Test-page" as FullSlug,
        frontmatter: {
          permalink: "",
        },
      })

      const content: ProcessedContent[] = [createMockContent(vfile)]
      const plugin = ContentPage()

      const files = await plugin.emit(mockCtx, content, mockStaticResources)

      expect(files).toContain("public/Test-page.html" as FilePath)
    })
  })

  describe("index page detection", () => {
    it.each([
      {
        name: "by slug",
        path: "content/index.md",
        slug: "index" as FullSlug,
        frontmatter: {},
      },
      {
        name: "by alias",
        path: "content/home.md",
        slug: "home" as FullSlug,
        frontmatter: { aliases: ["index"] },
      },
      {
        name: "when permalink is index",
        path: "content/home.md",
        slug: "home" as FullSlug,
        frontmatter: { permalink: "index" },
      },
    ])("should detect index page $name", async ({ path, slug, frontmatter }) => {
      const vfile = createTestVFile({
        path,
        filePath: path as FilePath,
        slug,
        frontmatter,
      })

      const content: ProcessedContent[] = [createMockContent(vfile)]
      const plugin = ContentPage()

      // Temporarily set fastRebuild to false to test warning suppression
      const originalFastRebuild = mockCtx.argv.fastRebuild
      mockCtx.argv.fastRebuild = false

      await expect(plugin.emit(mockCtx, content, mockStaticResources)).resolves.toBeDefined()

      // Restore original value
      mockCtx.argv.fastRebuild = originalFastRebuild
    })
  })

  describe("relative URL filtering", () => {
    it.each([
      { tagName: "img", property: "src", ref: "./relative-image.png" },
      { tagName: "a", property: "href", ref: "./other-page" },
      { tagName: "link", property: "href", ref: "./stylesheet.css" },
    ])("should track relative URLs in $tagName elements", async ({ tagName, property, ref }) => {
      const vfile = createTestVFile({
        path: "content/test.md",
        filePath: "content/test.md" as FilePath,
        slug: "test" as FullSlug,
        frontmatter: {},
      })

      const root: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName,
            properties: { [property]: ref },
            children: [],
          },
        ],
      }

      const content: ProcessedContent[] = [[root, vfile]]
      const plugin = ContentPage()

      if (!plugin.getDependencyGraph) {
        throw new Error("getDependencyGraph is not implemented")
      }

      const graph = await plugin.getDependencyGraph(mockCtx, content, mockStaticResources)

      expect(graph).toBeDefined()
      expect(graph.hasNode("content/test.md" as FilePath)).toBe(true)
    })

    it("should add .md extension to links without extensions", async () => {
      const vfile = createTestVFile({
        path: "content/test.md",
        filePath: "content/test.md" as FilePath,
        slug: "test" as FullSlug,
        frontmatter: {},
      })

      const root: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "a",
            properties: { href: "./other-page" },
            children: [],
          },
        ],
      }

      const content: ProcessedContent[] = [[root, vfile]]
      const plugin = ContentPage()

      if (!plugin.getDependencyGraph) {
        throw new Error("getDependencyGraph is not implemented")
      }

      const graph = await plugin.getDependencyGraph(mockCtx, content, mockStaticResources)

      expect(graph).toBeDefined()
      expect(graph.hasNode("content/test.md" as FilePath)).toBe(true)
    })

    it.each([
      { description: "null references", properties: {} },
      {
        description: "https URLs",
        properties: { src: "https://example.com/image.png" },
      },
      {
        description: "http URLs",
        properties: { src: "http://example.com/image.png" },
      },
      {
        description: "absolute paths",
        properties: { src: "/absolute/path/file.js" },
      },
    ])("should ignore $description", async ({ properties }) => {
      const vfile = createTestVFile({
        path: "content/test.md",
        filePath: "content/test.md" as FilePath,
        slug: "test" as FullSlug,
        frontmatter: {},
      })

      const root: Root = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "img",
            properties,
            children: [],
          },
        ],
      }

      const content: ProcessedContent[] = [[root, vfile]]
      const plugin = ContentPage()

      if (!plugin.getDependencyGraph) {
        throw new Error("getDependencyGraph is not implemented")
      }

      const graph = await plugin.getDependencyGraph(mockCtx, content, mockStaticResources)

      expect(graph).toBeDefined()
      expect(graph.hasNode("content/test.md" as FilePath)).toBe(true)
    })
  })
})
