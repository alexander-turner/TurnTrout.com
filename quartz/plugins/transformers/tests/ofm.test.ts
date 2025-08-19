import { describe, expect, it, test, beforeEach, afterEach, jest } from "@jest/globals"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { VFile } from "vfile"

import type { BuildCtx } from "../../../util/ctx"

import {
  markdownPlugins,
  defaultOptions,
  processWikilink,
  ObsidianFlavoredMarkdown,
  createYouTubeEmbed,
  type OFMOptions,
} from "../ofm"

jest.mock("fs")
import fs from "fs"

describe("markdownPlugins", () => {
  const testMarkdownPlugins = (input: string, options: OFMOptions = defaultOptions) => {
    const processor = unified()
      .use(remarkParse)
      .use(markdownPlugins(options))
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
    const vfile = new VFile(input)
    const result = processor.processSync(vfile)
    return result.toString()
  }

  interface AdmonitionTestCase {
    name: string
    input: string
    expectedClass: string
    expectedContent?: string[]
    notExpectedContent?: string[]
  }

  const admonitionCases: AdmonitionTestCase[] = [
    {
      name: "basic admonition",
      input: "> [!note] This is a admonition",
      expectedClass: "admonition note",
      expectedContent: ['<div class="admonition-title">'],
      notExpectedContent: ['<div class="admonition-content">'],
    },
    {
      name: "custom type admonition",
      input: "> [!custom] This is a custom admonition",
      expectedClass: "admonition custom",
      expectedContent: [],
    },
    {
      name: "admonition with multiple paragraphs",
      input: "> [!info] Admonition title\n>\n> This is the second paragraph.",
      expectedClass: "admonition info",
      expectedContent: [
        '<div class="admonition-content">',
        "Admonition title",
        "This is the second paragraph.",
      ],
    },
    {
      name: "collapsible admonition",
      input: "> [!note]+ Expandable admonition\n>\n> Content here",
      expectedClass: "admonition note is-collapsible",
      expectedContent: ['<div class="admonition-content">'],
    },
    {
      name: "collapsed admonition",
      input: "> [!note]- Collapsed admonition\n>\n> Hidden content",
      expectedClass: "admonition note is-collapsible is-collapsed",
      expectedContent: ["data-admonition-fold"],
    },
  ]

  it.each(admonitionCases)(
    "should process $name",
    ({ input, expectedClass, expectedContent = [], notExpectedContent = [] }) => {
      const output = testMarkdownPlugins(input)
      expect(output).toContain(`class="${expectedClass}"`)

      expectedContent.forEach((content) => {
        expect(output).toContain(content)
      })

      notExpectedContent.forEach((content) => {
        expect(output).not.toContain(content)
      })
    },
  )

  interface BlockReferenceTestCase {
    name: string
    input: string
    expectedContent: string[]
  }

  const blockReferenceCases: BlockReferenceTestCase[] = [
    {
      name: "basic block reference",
      input: "![[test#^block-id]]",
      expectedContent: [
        '<span class="transclude"',
        'data-block="#^block-id"',
        'data-url="test"',
        'href="test#^block-id"',
        'class="transclude-inner"',
        "Transclude of test#^block-id",
      ],
    },
    {
      name: "block reference with alias",
      input: "![[test#^block-id|Custom Text]]",
      expectedContent: [
        '<span class="transclude"',
        'data-block="#^block-id"',
        'data-url="test"',
        'href="test#^block-id"',
        'class="transclude-inner"',
        ">Custom Text<",
      ],
    },
    {
      name: "block reference with spaces",
      input: "![[test page#^block-id|Custom Text with Spaces]]",
      expectedContent: ['data-url="test-page"', ">Custom Text with Spaces<"],
    },
  ]

  it.each(blockReferenceCases)("should process $name", ({ input, expectedContent }) => {
    const output = testMarkdownPlugins(input)
    expectedContent.forEach((content) => {
      expect(output).toContain(content)
    })
  })

  interface SimpleFeatureTestCase {
    name: string
    input: string
    expectedContent?: string[]
    notExpectedContent?: string[]
  }

  const simpleFeatureCases: SimpleFeatureTestCase[] = [
    {
      name: "highlights",
      input: "This is ==highlighted text==",
      expectedContent: ['<span class="text-highlight">highlighted text</span>'],
    },
    {
      name: "tags",
      input: "This has a #test-tag in it",
      expectedContent: ['<a href="/tags/test-tag" class="tag-link">test-tag</a>'],
    },
    {
      name: "numeric tags (ignored)",
      input: "This has #123 which should not be a tag",
      expectedContent: ["#123"],
      notExpectedContent: ['<a href="/tags/123"'],
    },
  ]

  it.each(simpleFeatureCases)(
    "should process $name",
    ({ input, expectedContent = [], notExpectedContent = [] }) => {
      const output = testMarkdownPlugins(input)

      expectedContent.forEach((content) => {
        expect(output).toContain(content)
      })

      notExpectedContent.forEach((content) => {
        expect(output).not.toContain(content)
      })
    },
  )

  test("should disable features when options are false", () => {
    const options = {
      ...defaultOptions,
      wikilinks: false,
      highlight: false,
      parseTags: false,
      admonitions: false,
    }
    const input = "[[link]] ==highlight== #tag > [!note] admonition"
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain("[[link]]")
    expect(output).toContain("==highlight==")
    expect(output).toContain("#tag")
    expect(output).not.toContain('<span class="text-highlight">')
    expect(output).not.toContain('<a href="/tags/')
  })

  test("should process HTML embeds when enabled", () => {
    const options = { ...defaultOptions, enableInHtmlEmbed: true }
    const input = "<div>[[embedded-link]] ==highlight==</div>"
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain('<a href="embedded-link"')
    expect(output).toContain('<span class="text-highlight">')
  })

  test("should handle HTML embed string replacements", () => {
    const options = {
      ...defaultOptions,
      enableInHtmlEmbed: true,
      highlight: false,
      wikilinks: false,
      parseTags: false,
    }
    const input = "<div>some content</div>"
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain("<div>some content</div>")
  })

  test("should handle array return values in HTML embeds", () => {
    const options = { ...defaultOptions, enableInHtmlEmbed: true, wikilinks: true }
    const input = "<div>[[link1]] [[link2]]</div>"
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain('<a href="link1"')
    expect(output).toContain('<a href="link2"')
  })

  test("should handle false return values in tag processing", () => {
    const options = { ...defaultOptions, parseTags: true, enableInHtmlEmbed: true }
    const input = "<div>#123 #valid-tag</div>"
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain("#123") // Should remain unchanged
    expect(output).toContain('<a href="/tags/valid-tag"')
  })

  test("should process video embeds when enabled", () => {
    const options = { ...defaultOptions, enableVideoEmbed: true }
    const input = "![](video.mp4)"
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain('<span class="video-container">')
    expect(output).toContain('<video src="video.mp4" controls>')
  })

  test("should convert image nodes with video extensions to video embeds", () => {
    const input = "![alt text](video.webm)"
    const options = {
      ...defaultOptions,
      enableVideoEmbed: true,
      wikilinks: false,
    }
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain('<span class="video-container">')
    expect(output).toContain('<video src="video.webm" controls>')
  })

  test("should handle HTML replacement with null/undefined return values", () => {
    const options = {
      ...defaultOptions,
      enableInHtmlEmbed: true,
      parseTags: false,
      wikilinks: false,
      highlight: false,
    }
    const input = "<div>Test content without special syntax</div>"
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain("<div>Test content without special syntax</div>")
  })

  test("should handle HTML embed with string replacement", () => {
    const input = "<div>Simple ==highlight== content</div>"
    const options = {
      ...defaultOptions,
      enableInHtmlEmbed: true,
      highlights: true,
      parseTags: false,
      wikilinks: false,
      admonitions: false,
    }
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain('<span class="text-highlight">highlight</span>')
  })

  test("should handle tag processing with frontmatter", () => {
    const processor = unified()
      .use(remarkParse)
      .use(markdownPlugins({ ...defaultOptions, parseTags: true }))
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })

    const vfile = new VFile("#test-tag")
    vfile.data.frontmatter = { title: "Test", tags: ["existing-tag"] }
    processor.processSync(vfile)

    expect(vfile.data.frontmatter?.tags).toContain("test-tag")
    expect(vfile.data.frontmatter?.tags).toContain("existing-tag")
  })

  test("should handle tag processing without frontmatter", () => {
    const processor = unified()
      .use(remarkParse)
      .use(markdownPlugins({ ...defaultOptions, parseTags: true }))
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })

    const vfile = new VFile("#test-tag")
    // Explicitly set frontmatter to undefined to test the condition
    vfile.data.frontmatter = undefined
    const result = processor.processSync(vfile)

    expect(result.toString()).toContain('<a href="/tags/test-tag" class="tag-link">test-tag</a>')
  })

  test("should handle blockquotes that are not admonitions", () => {
    const input = "> This is a regular blockquote\n> without admonition syntax"
    const output = testMarkdownPlugins(input)
    expect(output).toContain("<blockquote>")
    expect(output).not.toContain('class="admonition')
  })

  test("should handle blockquotes with no children", () => {
    const input = ">" // Empty blockquote
    const output = testMarkdownPlugins(input)
    expect(output).toContain("<blockquote>")
    expect(output).not.toContain('class="admonition')
  })

  test("should handle blockquotes with non-paragraph first child", () => {
    const input = "> - List item in blockquote"
    const output = testMarkdownPlugins(input)
    expect(output).toContain("<blockquote>")
    expect(output).not.toContain('class="admonition')
  })
})

describe("processWikilink", () => {
  interface WikilinkTestCase {
    name: string
    input: [string, string, string, string]
    expected: unknown
  }

  const wikilinkCases: WikilinkTestCase[] = [
    {
      name: "basic wikilink",
      input: ["[[page]]", "page", "", ""],
      expected: {
        type: "link",
        url: "page",
        children: [{ type: "text", value: "page" }],
      },
    },
    {
      name: "wikilink with alias",
      input: ["[[page|Custom Name]]", "page", "", "|Custom Name"],
      expected: {
        type: "link",
        url: "page",
        children: [{ type: "text", value: "Custom Name" }],
      },
    },
    {
      name: "image embed",
      input: ["![[image.png]]", "image.png", "", ""],
      expected: {
        type: "image",
        url: "image.png",
        data: {
          hProperties: {
            width: "auto",
            height: "auto",
            alt: "",
          },
        },
      },
    },
    {
      name: "image with dimensions",
      input: ["![[image.png|100x200]]", "image.png", "", "|100x200"],
      expected: {
        type: "image",
        url: "image.png",
        data: {
          hProperties: {
            width: "100",
            height: "200",
            alt: "",
          },
        },
      },
    },
    {
      name: "pdf embed",
      input: ["![[document.pdf]]", "document.pdf", "", ""],
      expected: {
        type: "html",
        value: '<iframe src="document.pdf"></iframe>',
      },
    },
    {
      name: "video embed",
      input: ["![[video.mp4]]", "video.mp4", "", ""],
      expected: {
        type: "html",
        value: '<span class="video-container"><video src="video.mp4" controls></video></span>',
      },
    },
    {
      name: "audio embed",
      input: ["![[audio.mp3]]", "audio.mp3", "", ""],
      expected: {
        type: "html",
        value: '<audio src="audio.mp3" controls></audio>',
      },
    },
  ]

  it.each(wikilinkCases)("should process $name", ({ input, expected }) => {
    const result = processWikilink(input[0], input[1], input[2], input[3])
    expect(result).toEqual(expected)
  })

  interface EdgeCaseTestCase {
    name: string
    input: [string, string, string, string]
    expected: unknown
  }

  const edgeCases: EdgeCaseTestCase[] = [
    {
      name: "external embed link",
      input: ["![[https://example.com]]", "https://example.com", "", ""],
      expected: {
        type: "html",
        data: { hProperties: { transclude: true } },
        value:
          '<span class="transclude" data-url="https://example.com" data-block=""><a href="https://example.com" class="transclude-inner">Transclude of https://example.com</a></span>',
      },
    },
    {
      name: "non-embed external link",
      input: ["[[https://example.com]]", "https://example.com", "", ""],
      expected: {
        type: "link",
        url: "https://example.com",
        children: [{ type: "text", value: "https://example.com" }],
      },
    },
    {
      name: "wikilink with header",
      input: ["[[page#header]]", "page", "#header", ""],
      expected: {
        type: "link",
        url: "page#header",
        children: [{ type: "text", value: "page" }],
      },
    },
  ]

  it.each(edgeCases)("should handle $name", ({ input, expected }) => {
    const result = processWikilink(input[0], input[1], input[2], input[3])
    expect(result).toEqual(expected)
  })

  it("should handle embed syntax with unknown file extension", () => {
    const result = processWikilink("![[file.unknown]]", "file.unknown", "", "")
    expect(result).toEqual({
      type: "html",
      data: { hProperties: { transclude: true } },
      value:
        '<span class="transclude" data-url="file.unknown" data-block=""><a href="file.unknown" class="transclude-inner">Transclude of file.unknown</a></span>',
    })
  })
})

describe("ObsidianFlavoredMarkdown", () => {
  const mockBuildCtx: BuildCtx = {} as BuildCtx

  it("should have correct name", () => {
    const transformer = ObsidianFlavoredMarkdown()
    expect(transformer.name).toBe("ObsidianFlavoredMarkdown")
  })

  interface TextTransformTestCase {
    name: string
    options?: Partial<OFMOptions>
    input: string | Buffer
    expected: string
  }

  const textTransformCases: TextTransformTestCase[] = [
    {
      name: "HTML comments",
      input: "Hello <!-- this is a comment --> World",
      expected: "Hello  World",
    },
    {
      name: "Obsidian comments when enabled",
      options: { comments: true },
      input: "Hello %%this is an obsidian comment%% World",
      expected: "Hello  World",
    },
    {
      name: "Buffer input",
      input: Buffer.from("Hello World"),
      expected: "Hello World",
    },
    {
      name: "admonition line regex",
      options: { admonitions: true },
      input: "> [!note] Title",
      expected: "> [!note] Title\n> ",
    },
    {
      name: "empty admonition titles",
      options: { admonitions: true },
      input: "> [!note]",
      expected: "> [!note]\n> ",
    },
  ]

  it.each(textTransformCases)(
    "should handle $name in textTransform",
    ({ options, input, expected }) => {
      const transformer = ObsidianFlavoredMarkdown(options)
      const inputStr = typeof input === "string" ? input : input.toString()
      if (!transformer.textTransform) {
        throw new Error("textTransform is undefined")
      }
      const result = transformer.textTransform(mockBuildCtx, inputStr)
      expect(result).toBe(expected)
    },
  )

  interface WikilinkStringTestCase {
    name: string
    input: string
    expected: string
  }

  interface WikilinkContainsTestCase {
    name: string
    input: string
    expectedToContain: string
  }

  const wikilinkStringCases: WikilinkStringTestCase[] = [
    {
      name: "external wikilinks",
      input: "[[https://example.com|External Link]]",
      expected: "[External Link](https://example.com)",
    },
  ]

  const wikilinkContainsCases: WikilinkContainsTestCase[] = [
    {
      name: "wikilinks in tables",
      input: "| [[link#header|alias]] | content |\n|---|---|\n| data | more |",
      expectedToContain: "[[link\\#header\\|alias]]",
    },
    {
      name: "wikilinks with block references",
      input: "[[page#^block-ref]]",
      expectedToContain: "[[page#^block-ref|^block-ref]]",
    },
    {
      name: "wikilinks with headers",
      input: "[[page#header|alias]]",
      expectedToContain: "[[page#header|alias]]",
    },
  ]

  it.each(wikilinkStringCases)("should process $name", ({ input, expected }) => {
    const transformer = ObsidianFlavoredMarkdown({ wikilinks: true })
    if (!transformer.textTransform) {
      throw new Error("textTransform is undefined")
    }
    const result = transformer.textTransform(mockBuildCtx, input)
    expect(result).toBe(expected)
  })

  it.each(wikilinkContainsCases)("should process $name", ({ input, expectedToContain }) => {
    const transformer = ObsidianFlavoredMarkdown({ wikilinks: true })
    if (!transformer.textTransform) {
      throw new Error("textTransform is undefined")
    }
    const result = transformer.textTransform(mockBuildCtx, input)
    expect(result).toContain(expectedToContain)
  })
})

describe("Edge cases and advanced features", () => {
  interface AdvancedEqualTestCase {
    name: string
    input: [string, string, string, string]
    expected: unknown
  }

  const advancedEqualCases: AdvancedEqualTestCase[] = [
    {
      name: "missing file extensions properly",
      input: ["![[document]]", "document", "", ""],
      expected: {
        type: "html",
        data: { hProperties: { transclude: true } },
        value:
          '<span class="transclude" data-url="document" data-block=""><a href="document" class="transclude-inner">Transclude of document</a></span>',
      },
    },
    {
      name: "complex wikilink scenarios",
      input: ["[[complex page name]]", "complex page name", "", ""],
      expected: {
        type: "link",
        url: "complex page name",
        children: [{ type: "text", value: "complex page name" }],
      },
    },
    {
      name: "empty wikilink scenarios",
      input: ["[[]]", "", "", ""],
      expected: {
        type: "link",
        url: "",
        children: [{ type: "text", value: "" }],
      },
    },
  ]

  it.each(advancedEqualCases)("should handle $name", ({ input, expected }) => {
    const result = processWikilink(input[0], input[1], input[2], input[3])
    expect(result).toEqual(expected)
  })

  it("should handle image with alt text and dimensions", () => {
    const result = processWikilink(
      "![[image.png|alt text|100x200]]",
      "image.png",
      "",
      "|alt text|100x200",
    )
    expect(result).toHaveProperty("type", "image")
    expect(result).toHaveProperty("url", "image.png")
  })
})

describe("ObsidianFlavoredMarkdown plugin", () => {
  const mockBuildCtx: BuildCtx = {} as BuildCtx

  function getPlugins(plugin: ReturnType<typeof ObsidianFlavoredMarkdown>) {
    if (!plugin.markdownPlugins || !plugin.htmlPlugins) {
      throw new Error("Plugin markdownPlugins or htmlPlugins is undefined")
    }
    return {
      markdownPlugins: plugin.markdownPlugins(mockBuildCtx),
      htmlPlugins: plugin.htmlPlugins(mockBuildCtx),
    }
  }

  test("should return correct plugin name", () => {
    const plugin = ObsidianFlavoredMarkdown()
    expect(plugin.name).toBe("ObsidianFlavoredMarkdown")
  })

  test("should include block reference plugin when enabled", () => {
    const plugin = ObsidianFlavoredMarkdown({ parseBlockReferences: true })
    const { htmlPlugins } = getPlugins(plugin)
    expect(htmlPlugins.length).toBeGreaterThan(1) // rehypeRaw + block references
  })

  test("should include YouTube embed plugin when enabled", () => {
    const plugin = ObsidianFlavoredMarkdown({ enableYouTubeEmbed: true })
    const { htmlPlugins } = getPlugins(plugin)
    expect(htmlPlugins.length).toBeGreaterThan(1) // rehypeRaw + YouTube
  })

  test("should include checkbox plugin when enabled", () => {
    const plugin = ObsidianFlavoredMarkdown({ enableCheckbox: true })
    const { htmlPlugins } = getPlugins(plugin)
    expect(htmlPlugins.length).toBeGreaterThan(1) // rehypeRaw + checkbox
  })

  test("should always include video unwrapping plugin", () => {
    const plugin = ObsidianFlavoredMarkdown()
    const { htmlPlugins } = getPlugins(plugin)
    expect(htmlPlugins.length).toBeGreaterThan(1) // rehypeRaw + video unwrap
  })

  test("should use default options when no options provided", () => {
    const plugin = ObsidianFlavoredMarkdown()
    const { markdownPlugins, htmlPlugins } = getPlugins(plugin)

    expect(Array.isArray(markdownPlugins)).toBe(true)
    expect(Array.isArray(htmlPlugins)).toBe(true)
    expect(htmlPlugins.length).toBeGreaterThan(0)
  })

  test("should merge user options with defaults", () => {
    const plugin = ObsidianFlavoredMarkdown({ enableCheckbox: false, admonitions: false })
    const { markdownPlugins, htmlPlugins } = getPlugins(plugin)

    expect(Array.isArray(markdownPlugins)).toBe(true)
    expect(Array.isArray(htmlPlugins)).toBe(true)
  })
})

describe("External resources", () => {
  const mockBuildCtx: BuildCtx = {} as BuildCtx

  beforeEach(() => {
    // Mock the file system to return dummy content
    jest.spyOn(fs, "readFileSync").mockReturnValue("// dummy script content")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  interface ExternalResourceTestCase {
    name: string
    options: Partial<OFMOptions>
    expectedScriptCount: number
  }

  const externalResourceCases: ExternalResourceTestCase[] = [
    {
      name: "no scripts when disabled",
      options: { enableCheckbox: false, admonitions: false },
      expectedScriptCount: 0,
    },
    {
      name: "checkbox script when enabled",
      options: { enableCheckbox: true, admonitions: false },
      expectedScriptCount: 1,
    },
    {
      name: "admonition script when enabled",
      options: { enableCheckbox: false, admonitions: true },
      expectedScriptCount: 1,
    },
    {
      name: "both scripts when both enabled",
      options: { enableCheckbox: true, admonitions: true },
      expectedScriptCount: 2,
    },
  ]

  it.each(externalResourceCases)("should include $name", ({ options, expectedScriptCount }) => {
    const transformer = ObsidianFlavoredMarkdown(options)
    const resources = transformer.externalResources?.(mockBuildCtx)
    expect(resources?.js).toHaveLength(expectedScriptCount)
  })

  it("should handle text that doesn't match any patterns", () => {
    const transformer = ObsidianFlavoredMarkdown({
      wikilinks: false,
      comments: false,
      admonitions: false,
    })
    const input = "Just plain text with no special formatting"
    if (!transformer.textTransform) {
      throw new Error("textTransform is undefined")
    }
    const result = transformer.textTransform(mockBuildCtx, input)
    expect(result).toBe("Just plain text with no special formatting")
  })
})

describe("Branch coverage tests", () => {
  const testMarkdownPlugins = (input: string, options: OFMOptions = defaultOptions) => {
    const processor = unified()
      .use(remarkParse)
      .use(markdownPlugins(options))
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
    const vfile = new VFile(input)
    const result = processor.processSync(vfile)
    return result.toString()
  }

  function getPlugins(plugin: ReturnType<typeof ObsidianFlavoredMarkdown>) {
    if (!plugin.htmlPlugins) {
      throw new Error("Plugin htmlPlugins is undefined")
    }
    return {
      htmlPlugins: plugin.htmlPlugins({} as BuildCtx),
    }
  }

  const testWithHtmlPlugins = (input: string, options: Partial<OFMOptions> = {}) => {
    const transformer = ObsidianFlavoredMarkdown(options)
    const { htmlPlugins } = getPlugins(transformer)

    const processor = unified()
      .use(remarkParse)
      .use(markdownPlugins(defaultOptions))
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(htmlPlugins)
      .use(rehypeStringify, { allowDangerousHtml: true })

    const vfile = new VFile(input)
    const result = processor.processSync(vfile)
    return { result: result.toString(), vfile }
  }

  it("should handle HTML embed with string replacements", () => {
    // Create a custom replacement function that returns a string
    const input = "<div>==test content==</div>"
    const options = {
      ...defaultOptions,
      enableInHtmlEmbed: true,
      highlight: true,
      wikilinks: false,
      parseTags: false,
    }
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain('<span class="text-highlight">test content</span>')
  })

  it("should handle video unwrapping in HTML", () => {
    const input = '<p><video src="test.mp4"></video></p>'
    const { result } = testWithHtmlPlugins(input)
    expect(result).toContain('<video src="test.mp4"></video>')
  })

  it("should handle unknown admonition types", () => {
    const input = "> [!unknowntype] This is an unknown admonition type"
    const output = testMarkdownPlugins(input)
    expect(output).toContain('class="admonition unknowntype"')
  })

  it("should handle image nodes that don't match video extensions", () => {
    const input = "![alt text](image.jpg)"
    const options = {
      ...defaultOptions,
      enableVideoEmbed: true,
    }
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain("<img")
    expect(output).not.toContain("<video")
  })

  it("should handle different video extensions", () => {
    interface VideoExtTestCase {
      name: string
      extension: string
    }

    const videoExtCases: VideoExtTestCase[] = [
      { name: "mp4", extension: "mp4" },
      { name: "webm", extension: "webm" },
      { name: "ogg", extension: "ogg" },
      { name: "mov", extension: "mov" },
      { name: "mkv", extension: "mkv" },
      { name: "avi", extension: "avi" },
      { name: "flv", extension: "flv" },
      { name: "wmv", extension: "wmv" },
      { name: "mpg", extension: "mpg" },
      { name: "mpeg", extension: "mpeg" },
      { name: "3gp", extension: "3gp" },
      { name: "m4v", extension: "m4v" },
    ]

    videoExtCases.forEach(({ extension }) => {
      const input = `![video](test.${extension})`
      const options = {
        ...defaultOptions,
        enableVideoEmbed: true,
      }
      const output = testMarkdownPlugins(input, options)
      expect(output).toContain('<span class="video-container">')
      expect(output).toContain(`<video src="test.${extension}" controls>`)
    })
  })

  it("should handle audio extensions in wikilinks", () => {
    interface AudioExtTestCase {
      name: string
      extension: string
    }

    const audioExtCases: AudioExtTestCase[] = [
      { name: "mp3", extension: "mp3" },
      { name: "wav", extension: "wav" },
      { name: "m4a", extension: "m4a" },
      { name: "ogg", extension: "ogg" },
      { name: "flac", extension: "flac" },
    ]

    audioExtCases.forEach(({ extension }) => {
      const result = processWikilink(`![[audio.${extension}]]`, `audio.${extension}`, "", "")
      expect(result).toEqual({
        type: "html",
        value: `<audio src="audio.${extension}" controls></audio>`,
      })
    })
  })

  it("should handle webm and 3gp as video in wikilinks", () => {
    const result1 = processWikilink("![[video.webm]]", "video.webm", "", "")
    expect(result1).toEqual({
      type: "html",
      value: '<span class="video-container"><video src="video.webm" controls></video></span>',
    })

    const result2 = processWikilink("![[video.3gp]]", "video.3gp", "", "")
    expect(result2).toEqual({
      type: "html",
      value: '<audio src="video.3gp" controls></audio>',
    })
  })

  it("should handle image extensions with different cases", () => {
    interface ImageExtTestCase {
      name: string
      extension: string
    }

    const imageExtCases: ImageExtTestCase[] = [
      { name: "bmp", extension: "bmp" },
      { name: "svg", extension: "svg" },
      { name: "webp", extension: "webp" },
    ]

    imageExtCases.forEach(({ extension }) => {
      const result = processWikilink(`![[image.${extension}]]`, `image.${extension}`, "", "")
      expect(result).toHaveProperty("type", "image")
      expect(result).toHaveProperty("url", `image.${extension}`)
    })
  })

  it("should handle HTML plugins block reference processing", () => {
    const input = "This is a paragraph with a block reference ^block123"
    const { vfile } = testWithHtmlPlugins(input, { parseBlockReferences: true })
    expect(vfile.data.blocks).toBeDefined()
  })

  it("should handle YouTube embed conversion", () => {
    const input = "![YouTube Video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
    const { result } = testWithHtmlPlugins(input, { enableYouTubeEmbed: true })
    expect(result).toContain("iframe")
    expect(result).toContain("youtube.com/embed/dQw4w9WgXcQ")
  })

  it("should handle YouTube playlist embed", () => {
    const input =
      "![YouTube Playlist](https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab)"
    const { result } = testWithHtmlPlugins(input, { enableYouTubeEmbed: true })
    expect(result).toContain("iframe")
    expect(result).toContain("videoseries?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab")
  })

  it("should handle YouTube playlist without video ID", () => {
    // Test the edge case where playlistId exists but videoId is null/invalid
    const input =
      "![YouTube Playlist](https://www.youtube.com/user/somechannel?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab)"
    const { result } = testWithHtmlPlugins(input, { enableYouTubeEmbed: true })
    expect(result).toContain("iframe")
    expect(result).toContain("videoseries?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab")
    expect(result).not.toContain("watch?v=") // Should not have watch URL parameters
  })

  it("should handle checkbox processing", () => {
    const input = '<input type="checkbox" checked> <input type="checkbox">'
    const { result } = testWithHtmlPlugins(input, { enableCheckbox: true })
    expect(result).toContain("checkbox-toggle")
  })

  it("should handle video tags that don't need unwrapping", () => {
    const input = '<p>Some text <video src="test.mp4"></video> and more text</p>'
    const { result } = testWithHtmlPlugins(input)
    // Video should remain wrapped in paragraph because it's not the only child
    expect(result).toContain("<p>")
    expect(result).toContain("<video")
  })

  it("should handle missing file data blocks initialization", () => {
    const input = "Text with block reference ^myblock"
    const { vfile } = testWithHtmlPlugins(input, { parseBlockReferences: true })
    expect(vfile.data.blocks).toBeDefined()
  })

  it("should handle duplicate block references", () => {
    const input = "First paragraph ^block1\n\nSecond paragraph ^block1"
    const { vfile } = testWithHtmlPlugins(input, { parseBlockReferences: true })
    // Second reference should be ignored since block ID already exists
    expect(Object.keys(vfile.data.blocks || {})).toHaveLength(1)
  })

  it("should handle unchecked checkbox properties", () => {
    const input = '<input type="checkbox">'
    const { result } = testWithHtmlPlugins(input, { enableCheckbox: true })
    expect(result).toContain("checkbox-toggle")
    // Check that it doesn't have checked="true" (unchecked case)
    expect(result).not.toContain('checked="true"')
  })

  it("should handle HTML embed with no matching patterns", () => {
    const input = "<div>No special syntax here</div>"
    const options = {
      ...defaultOptions,
      enableInHtmlEmbed: true,
      wikilinks: false,
      highlight: false,
      parseTags: false,
    }
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain("<div>No special syntax here</div>")
  })

  it("should test canonicalizeAdmonition fallback", () => {
    const input = "> [!unrecognized] This is an unrecognized admonition type"
    const output = testMarkdownPlugins(input)
    expect(output).toContain('class="admonition unrecognized"')
  })

  it("should handle video extension matching correctly", () => {
    // Test that non-video extensions don't get converted
    const input = "![image](test.txt)"
    const options = {
      ...defaultOptions,
      enableVideoEmbed: true,
    }
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain("<img")
    expect(output).not.toContain("<video")
  })

  it("should handle list items with block references", () => {
    const input = "<li>List item with block reference ^listblock</li>"
    const { vfile } = testWithHtmlPlugins(input, { parseBlockReferences: true })
    expect(vfile.data.blocks).toBeDefined()
    expect(vfile.data.blocks?.listblock).toBeDefined()
  })

  it("should handle short YouTube video IDs", () => {
    const input = "![YouTube](https://www.youtube.com/watch?v=shortID)"
    const { result } = testWithHtmlPlugins(input, { enableYouTubeEmbed: true })
    // Should not convert because ID is not 11 characters
    expect(result).not.toContain("iframe")
  })

  it("should handle YouTube URLs without video ID", () => {
    const input = "![YouTube](https://www.youtube.com/embed/validIDhere)"
    const { result } = testWithHtmlPlugins(input, { enableYouTubeEmbed: true })
    expect(result).toContain("iframe")
    expect(result).toContain("youtube.com/embed/validIDhere")
  })

  it("should handle false return from replacement function in HTML embeds", () => {
    // This targets line 520: return substring (else case) when replacement returns false
    const input = "<div>#123</div>"
    const options = {
      ...defaultOptions,
      enableInHtmlEmbed: true,
      parseTags: true,
      highlight: false,
      wikilinks: false,
    }
    const output = testMarkdownPlugins(input, options)
    // Numeric tags should return false and remain unchanged
    expect(output).toContain("#123")
  })

  it("should handle HTML embed with array return value", () => {
    // This test targets line 516: Array.isArray(replaceValue)
    const input = "<div>[[link1]] [[link2]]</div>"
    const options = {
      ...defaultOptions,
      enableInHtmlEmbed: true,
      wikilinks: true,
      highlight: false,
      parseTags: false,
    }
    const output = testMarkdownPlugins(input, options)
    expect(output).toContain('<a href="link1"')
    expect(output).toContain('<a href="link2"')
  })

  it.each([
    {
      name: "empty filePath",
      input: ["[[]]", "", "", ""],
      expected: {
        type: "link",
        url: "",
        children: [{ type: "text", value: "" }],
      },
    },
    {
      name: "alias with special characters",
      input: ["[[page|alias with spaces]]", "page", "", "|alias with spaces"],
      expected: {
        type: "link",
        url: "page",
        children: [{ type: "text", value: "alias with spaces" }],
      },
    },
    {
      name: "filePath with spaces that gets trimmed",
      input: ["[[  ]]", "  ", "", ""],
      expected: {
        type: "link",
        url: "",
        children: [{ type: "text", value: "" }],
      },
    },
    {
      name: "undefined filePath",
      input: ["[[]]", undefined as unknown as string, "", ""],
      expected: {
        type: "link",
        url: "",
        children: [{ type: "text", value: "" }],
      },
    },
  ])("should handle processWikilink edge case: $name", ({ input, expected }) => {
    const result = processWikilink(...(input as [string, string, string, string]))
    expect(result).toEqual(expected)
  })

  it.each([
    {
      name: "undefined alias for image",
      input: ["![[image.png]]", "image.png", "", undefined as unknown as string],
      expectedType: "image",
      expectedUrl: "image.png",
    },
    {
      name: "null alias for image",
      input: ["![[image.png]]", "image.png", "", null as unknown as string],
      expectedType: "image",
      expectedUrl: "image.png",
    },
  ])(
    "should handle image alias parsing edge case: $name",
    ({ input, expectedType, expectedUrl }) => {
      const result = processWikilink(...(input as [string, string, string, string]))
      expect(result).toHaveProperty("type", expectedType)
      expect(result).toHaveProperty("url", expectedUrl)
    },
  )

  it("should handle external link wikilinks", () => {
    // Test rawFp?.match(externalLinkRegex) branch
    const input = "[[https://example.com|External Link]]"
    const output = testMarkdownPlugins(input, { ...defaultOptions, wikilinks: true })
    expect(output).toContain('<a href="https://example.com">External Link</a>')
  })

  it.each([
    {
      name: "empty title uses default",
      input: "> [!note]",
      expectedContent: "Note",
    },
    {
      name: "custom title is preserved",
      input: "> [!note] Custom Title",
      expectedContent: "Custom Title",
    },
  ])("should handle admonition title edge case: $name", ({ input, expectedContent }) => {
    const output = testMarkdownPlugins(input)
    expect(output).toContain(expectedContent)
  })
})

describe("createYouTubeEmbed", () => {
  it("should create YouTube embed without playlist", () => {
    const result = createYouTubeEmbed("dQw4w9WgXcQ")

    expect(result).toEqual({
      class: "external-embed",
      allow: "fullscreen",
      frameborder: 0,
      width: "600px",
      height: "350px",
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    })
  })

  it("should create YouTube embed with playlist", () => {
    const result = createYouTubeEmbed("dQw4w9WgXcQ", "PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab")

    expect(result).toEqual({
      class: "external-embed",
      allow: "fullscreen",
      frameborder: 0,
      width: "600px",
      height: "350px",
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab",
    })
  })

  it("should create YouTube embed with undefined playlist", () => {
    const result = createYouTubeEmbed("dQw4w9WgXcQ", undefined)

    expect(result).toEqual({
      class: "external-embed",
      allow: "fullscreen",
      frameborder: 0,
      width: "600px",
      height: "350px",
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    })
  })
})
