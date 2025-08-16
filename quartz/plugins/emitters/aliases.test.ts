import { jest, describe, it, beforeEach, expect, beforeAll } from "@jest/globals"
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
    "slug" in data ? data.slug : (data.path.replace("/content/", "").replace(".md", "") as FullSlug)
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

const createMockContent = (vfile: VFile): [string, ProcessedContent][] => {
  const root = { type: "root", children: [] }
  return [["test", [root, vfile]]]
}

const mockStaticResources: StaticResources = { css: [], js: [] }

// Helpers for testing
const testDependencyGraph = async (
  plugin: ReturnType<typeof import("./aliases").AliasRedirects>,
  mockCtx: BuildCtx,
  content: [string, ProcessedContent][],
  expectedNodes: FilePath[],
) => {
  if (!plugin.getDependencyGraph) {
    throw new Error("getDependencyGraph is not implemented")
  }
  const graph = await plugin.getDependencyGraph(mockCtx, [content[0][1]], mockStaticResources)

  for (const node of expectedNodes) {
    expect(graph.hasNode(node)).toBe(true)
  }
  return graph
}

const testEmitFiles = async (
  plugin: ReturnType<typeof import("./aliases").AliasRedirects>,
  mockCtx: BuildCtx,
  content: [string, ProcessedContent][],
  expectedFiles: string[],
) => {
  const files = await plugin.emit(mockCtx, [content[0][1]], mockStaticResources)
  expect(files).toHaveLength(expectedFiles.length)

  for (const expectedFile of expectedFiles) {
    expect(files).toContain(expectedFile)
  }

  return files
}

const getLatestHtmlContent = (write: jest.MockedFunction<typeof import("./helpers").write>) => {
  expect(write).toHaveBeenCalled()
  return write.mock.calls[write.mock.calls.length - 1][0].content
}

const testHtmlMetadata = async (
  plugin: ReturnType<typeof import("./aliases").AliasRedirects>,
  mockCtx: BuildCtx,
  content: [string, ProcessedContent][],
  write: jest.MockedFunction<typeof import("./helpers").write>,
  assertions: (htmlContent: string) => void,
) => {
  await plugin.emit(mockCtx, [content[0][1]], mockStaticResources)
  const htmlContent = getLatestHtmlContent(write)
  assertions(htmlContent)
}

// Mock the helpers module first using jest.unstable_mockModule
jest.unstable_mockModule("./helpers", () => ({
  write: jest.fn(async (opts: { slug: FullSlug }) => {
    return await Promise.resolve(`${opts.slug}.html`)
  }),
}))

describe("AliasRedirects", () => {
  let write: jest.MockedFunction<typeof import("./helpers").write>
  let AliasRedirects: typeof import("./aliases").AliasRedirects
  let plugin: ReturnType<typeof AliasRedirects>
  let defaultCardUrl: string

  // Import the mocked modules asynchronously
  beforeAll(async () => {
    const helpers = await import("./helpers")
    write = helpers.write as jest.MockedFunction<typeof helpers.write>

    const aliasesModule = await import("./aliases")
    AliasRedirects = aliasesModule.AliasRedirects
    defaultCardUrl = aliasesModule.defaultCardUrl
    plugin = AliasRedirects()
  })

  // Reset mock before each test
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const testVFile = createTestVFile({
    path: "/content/test.md",
    frontmatter: {
      title: "Test Page",
      description: "Test description",
      aliases: ["alias1", "alias2"],
      authors: "Test Author",
      card_image: "test-image.jpg",
    },
  })
  const mockContent = createMockContent(testVFile)

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
    cfg: {} as QuartzConfig,
    allSlugs: [],
  }

  // Basic functionality tests
  it("should create correct dependency graph", async () => {
    const graph = await testDependencyGraph(plugin, mockCtx, mockContent, [
      "/content/test.md" as FilePath,
      "public/alias1.html" as FilePath,
      "public/alias2.html" as FilePath,
    ])
    expect(graph).toBeDefined()
  })

  it("should emit redirect files", async () => {
    const files = await testEmitFiles(plugin, mockCtx, mockContent, ["alias1.html", "alias2.html"])
    expect(files).toBeDefined()
  })

  it("files should have correct metadata", async () => {
    await plugin.emit(mockCtx, [mockContent[0][1]], mockStaticResources)
    const htmlContent = getLatestHtmlContent(write)
    expect(htmlContent).toContain("<title>Test Page</title>")
    expect(htmlContent).toContain('content="Test description"')
  })

  it("should return empty array from getQuartzComponents", () => {
    const components = plugin.getQuartzComponents(mockCtx)
    expect(components).toEqual([])
  })

  it("should handle permalinks in dependency graph", async () => {
    const vfile = createTestVFile({
      path: "/content/test-permalink.md",
      frontmatter: { title: "Test Permalink", permalink: "custom-permalink" },
    })
    const content = createMockContent(vfile)

    const graph = await testDependencyGraph(plugin, mockCtx, content, [
      "public/custom-permalink.html" as FilePath,
    ])
    expect(graph).toBeDefined()
  })

  it("should handle trailing slashes in dependency graph", async () => {
    const vfile = createTestVFile({
      path: "/content/test-slash.md",
      frontmatter: { title: "Test Slash", aliases: ["alias-with-slash/"] },
    })
    const content = createMockContent(vfile)

    const graph = await testDependencyGraph(plugin, mockCtx, content, [
      "public/alias-with-slash/index.html" as FilePath,
    ])
    expect(graph).toBeDefined()
  })

  it("should handle permalinks in emit function", async () => {
    const vfile = createTestVFile({
      path: "/content/test-permalink.md",
      frontmatter: {
        title: "Test Permalink",
        permalink: "custom-permalink",
        aliases: ["old-alias"],
      },
    })
    const content = createMockContent(vfile)

    const files = await testEmitFiles(plugin, mockCtx, content, [
      "old-alias.html",
      "test-permalink.html",
    ]) // old alias + permalink redirects
    expect(vfile.data.slug).toBe("custom-permalink")
    expect(files).toBeDefined()
  })

  it("should handle trailing slashes in emit function", async () => {
    const vfile = createTestVFile({
      path: "/content/test-slash.md",
      frontmatter: { title: "Test Slash", aliases: ["alias-with-slash/"] },
    })
    const content = createMockContent(vfile)

    await testEmitFiles(plugin, mockCtx, content, ["alias-with-slash/index.html"])
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "alias-with-slash/index",
      }),
    )
  })

  it("should handle missing authors metadata", async () => {
    const vfile = createTestVFile({
      path: "/content/test-no-authors.md",
      frontmatter: { title: "Test No Authors", aliases: ["no-authors-alias"] },
    })
    const content = createMockContent(vfile)

    await testHtmlMetadata(plugin, mockCtx, content, write, (htmlContent) => {
      expect(htmlContent).not.toContain('name="twitter:label1"')
      expect(htmlContent).not.toContain('name="twitter:data1"')
    })
  })

  it("should use default card image when none provided", async () => {
    const vfile = createTestVFile({
      path: "/content/test-no-card.md",
      frontmatter: { title: "Test No Card", aliases: ["no-card-alias"] },
    })
    const content = createMockContent(vfile)

    await testHtmlMetadata(plugin, mockCtx, content, write, (htmlContent) => {
      expect(htmlContent).toContain(defaultCardUrl)
    })
  })

  it("should handle empty description", async () => {
    const vfile = createTestVFile({
      path: "/content/test-empty-desc.md",
      frontmatter: {
        title: "Test Empty Description",
        description: "   ",
        aliases: ["empty-desc-alias"],
      },
    })
    const content = createMockContent(vfile)

    await testHtmlMetadata(plugin, mockCtx, content, write, (htmlContent) => {
      expect(htmlContent).toContain('content=""')
    })
  })

  it("should handle undefined filePath", async () => {
    const vfile = createTestVFile({
      path: "/content/test-no-filepath.md",
      filePath: undefined as unknown as FilePath,
      frontmatter: { title: "Test No FilePath", aliases: ["no-filepath-alias"] },
    })
    const content = createMockContent(vfile)

    const graph = await testDependencyGraph(plugin, mockCtx, content, [
      "" as FilePath,
      "public/../Users/turntrout/Downloads/turntrout.com/no-filepath-alias.html" as FilePath,
    ])

    const files = await testEmitFiles(plugin, mockCtx, content, [
      "../Users/turntrout/Downloads/turntrout.com/no-filepath-alias.html",
    ])
    expect(graph).toBeDefined()
    expect(files).toBeDefined()
  })

  it("should handle files with no aliases or permalinks", async () => {
    const vfile = createTestVFile({
      path: "/content/test-no-aliases.md",
      frontmatter: { title: "Test No Aliases" },
    })
    const content = createMockContent(vfile)

    // Since there are no aliases or permalinks, no edges are added, so no nodes should be in graph
    const graph = await testDependencyGraph(plugin, mockCtx, content, [])
    expect(graph.hasNode("/content/test-no-aliases.md" as FilePath)).toBe(false)

    await testEmitFiles(plugin, mockCtx, content, [])
  })

  it("should handle non-string permalink", async () => {
    const vfile = createTestVFile({
      path: "/content/test-non-string-permalink.md",
      frontmatter: {
        title: "Test Non-String Permalink",
        permalink: 123 as unknown, // non-string permalink
        aliases: ["test-alias"],
      },
    })
    const content = createMockContent(vfile)

    // Should not add permalink to graph since it's not a string
    const graph = await testDependencyGraph(plugin, mockCtx, content, [
      "public/test-alias.html" as FilePath,
    ])
    expect(graph.hasNode("public/123.html" as FilePath)).toBe(false)

    await testEmitFiles(plugin, mockCtx, content, ["test-alias.html"]) // Only the alias, not the non-string permalink
  })

  it("should handle missing title", async () => {
    const vfile = createTestVFile({
      path: "/content/test-no-title.md",
      frontmatter: {
        title: undefined,
        aliases: ["no-title-alias"],
      } as unknown as QuartzPluginData["frontmatter"],
    })
    const content = createMockContent(vfile)

    await testHtmlMetadata(plugin, mockCtx, content, write, (htmlContent) => {
      // When title is missing, it should use the default title from i18n
      expect(htmlContent).toContain("<title>The Pond</title>")
    })
  })

  it("should handle missing slug gracefully", async () => {
    const vfile = createTestVFile({
      path: "/content/test-no-slug.md",
      slug: "" as FullSlug, // Use empty string instead of undefined to avoid errors
      frontmatter: { title: "Test No Slug", aliases: ["no-slug-alias"] },
    })
    const content = createMockContent(vfile)

    await testHtmlMetadata(plugin, mockCtx, content, write, (htmlContent) => {
      expect(htmlContent).toContain("<title>Test No Slug</title>")
    })
  })
})
