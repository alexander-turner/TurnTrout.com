import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { VFile } from "vfile"

import { markdownPlugins, defaultOptions, processWikilink } from "../ofm"

describe("markdownPlugins", () => {
  const testMarkdownPlugins = (input: string) => {
    const processor = unified()
      .use(remarkParse)
      .use(markdownPlugins(defaultOptions))
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeStringify, { allowDangerousHtml: true })
    const vfile = new VFile(input)
    const result = processor.processSync(vfile)
    return result.toString()
  }

  test("should process callouts", () => {
    const input = "> [!note] This is a callout"
    const output = testMarkdownPlugins(input)
    expect(output).toContain('<blockquote class="callout note"')
    expect(output).toContain('<div class="callout-title">')
    expect(output).not.toContain('<div class="callout-content">')
  })

  test("should process callouts with custom type", () => {
    const input = "> [!custom] This is a custom callout"
    const output = testMarkdownPlugins(input)
    expect(output).toContain('<blockquote class="callout custom"')
  })

  test("should process callouts with multiple paragraphs", () => {
    const input = "> [!info] Callout title\n>\n> This is the second paragraph."
    const output = testMarkdownPlugins(input)
    expect(output).toContain('<blockquote class="callout info"')
    expect(output).toContain('<div class="callout-content">')
    expect(output).toContain("Callout title")
    expect(output).toContain("This is the second paragraph.")
  })

  test("should process block references", () => {
    const input = "![[test#^block-id]]"
    const output = testMarkdownPlugins(input)
    expect(output).toContain('<span class="transclude"')
    expect(output).toContain('data-block="#^block-id"')
    expect(output).toContain('data-url="test"')
    expect(output).toContain('href="test#^block-id"')
    expect(output).toContain('class="transclude-inner"')
    expect(output).toContain("Transclude of test#^block-id")
  })

  test("should process block references with aliases", () => {
    const input = "![[test#^block-id|Custom Text]]"
    const output = testMarkdownPlugins(input)
    expect(output).toContain('<span class="transclude"')
    expect(output).toContain('data-block="#^block-id"')
    expect(output).toContain('data-url="test"')
    expect(output).toContain('href="test#^block-id"')
    expect(output).toContain('class="transclude-inner"')
    expect(output).toContain(">Custom Text<")
  })

  test("should handle block references with spaces", () => {
    const input = "![[test page#^block-id|Custom Text with Spaces]]"
    const output = testMarkdownPlugins(input)
    expect(output).toContain('data-url="test-page"')
    expect(output).toContain(">Custom Text with Spaces<")
  })
})

describe("processWikilink", () => {
  it.each([
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
        value: '<video src="video.mp4" controls></video>',
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
  ])("should process $name", ({ input, expected }) => {
    const result = processWikilink(input[0], ...input.slice(1))
    expect(result).toEqual(expected)
  })
})
