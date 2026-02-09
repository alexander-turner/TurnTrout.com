/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals"

import { OxHugoFlavouredMarkdown } from "./oxhugofm"

const getTransform = (opts?: Parameters<typeof OxHugoFlavouredMarkdown>[0]) => {
  const plugin = OxHugoFlavouredMarkdown(opts)
  return (src: string) => plugin.textTransform!({} as never, src) as string
}

describe("OxHugoFlavouredMarkdown", () => {
  it("returns plugin with correct name", () => {
    expect(OxHugoFlavouredMarkdown().name).toBe("OxHugoFlavouredMarkdown")
  })

  describe("wikilinks (relref conversion)", () => {
    const transform = getTransform()

    it.each([
      ["basic relref", '[Click here]({{< relref "other-page" >}})', "[Click here](other-page)"],
      ["relref with path", '[My Post]({{< relref "posts/my-post" >}})', "[My Post](posts/my-post)"],
      [
        "multiple relrefs",
        '[A]({{< relref "a" >}}) and [B]({{< relref "b" >}})',
        "[A](a) and [B](b)",
      ],
      [
        "non-relref links unchanged",
        "[Normal link](https://example.com)",
        "[Normal link](https://example.com)",
      ],
    ])("converts %s", (_, input, expected) => {
      expect(transform(input)).toBe(expected)
    })

    it("does nothing when disabled", () => {
      const transform = getTransform({ wikilinks: false, removeHugoShortcode: false })
      expect(transform('[Link]({{< relref "page" >}})')).toBe('[Link]({{< relref "page" >}})')
    })
  })

  describe("removePredefinedAnchor", () => {
    const transform = getTransform()

    it.each([
      ["basic heading ID", "## My Heading {#custom-id}", "## My Heading"],
      ["heading with complex ID", "# Title {#my-title-id}", "# Title"],
      ["preserves headings without IDs", "## Normal Heading", "## Normal Heading"],
    ])("handles %s", (_, input, expected) => {
      expect(transform(input)).toBe(expected)
    })

    it("does nothing when disabled", () => {
      const transform = getTransform({ removePredefinedAnchor: false })
      expect(transform("## Heading {#anchor}")).toBe("## Heading {#anchor}")
    })
  })

  describe("removeHugoShortcode", () => {
    const transform = getTransform()

    it.each([
      ["basic shortcode", "{{some-shortcode}}", "some-shortcode"],
      ["shortcode with args", '{{< youtube id="abc123" >}}', '< youtube id="abc123" >'],
    ])("removes %s", (_, input, expected) => {
      expect(transform(input)).toBe(expected)
    })

    it("does nothing when disabled", () => {
      const transform = getTransform({ removeHugoShortcode: false })
      expect(transform("{{shortcode}}")).toBe("{{shortcode}}")
    })
  })

  describe("replaceFigureWithMdImg", () => {
    const transform = getTransform()

    it.each([
      ["basic figure", '<figure src="image.png">', "![](image.png)"],
      ["figure with space", '< figure src="image.png" >', "![](image.png)"],
      ["figure with path", '<figure src="/images/photo.jpg">', "![](/images/photo.jpg)"],
    ])("replaces %s", (_, input, expected) => {
      expect(transform(input)).toBe(expected)
    })

    it("does nothing when disabled", () => {
      const transform = getTransform({ replaceFigureWithMdImg: false })
      expect(transform('<figure src="image.png">')).toBe('<figure src="image.png">')
    })
  })

  describe("replaceOrgLatex", () => {
    const transform = getTransform()

    it.each([
      ["inline \\\\(...\\\\)", "\\\\(x + y\\\\)", "$x + y$"],
      ["block \\\\[...\\\\]", "\\\\[x + y\\\\]", "$$x + y$$"],
      ["block \\begin{equation}", "\\begin{equation}E = mc^2\\end{equation}", "$$E = mc^2$$"],
      ["multiline block", "\\\\[\na + b\n= c\n\\\\]", "$$\na + b\n= c\n$$"],
      ["unescape underscores inline", "$x\\_i + y\\_j$", "$x_i + y_j$"],
      ["unescape underscores block", "$$\\sum\\_i x\\_i$$", "$$\\sum_i x_i$$"],
    ])("converts %s", (_, input, expected) => {
      expect(transform(input)).toBe(expected)
    })

    it("does nothing when disabled", () => {
      const transform = getTransform({ replaceOrgLatex: false })
      expect(transform("\\\\(x + y\\\\)")).toBe("\\\\(x + y\\\\)")
    })
  })

  it("returns source unchanged when all options disabled", () => {
    const transform = getTransform({
      wikilinks: false,
      removePredefinedAnchor: false,
      removeHugoShortcode: false,
      replaceFigureWithMdImg: false,
      replaceOrgLatex: false,
    })
    const input =
      '[Link]({{< relref "page" >}}) ## Heading {#id} {{shortcode}} <figure src="img.png"> \\\\(x\\\\)'
    expect(transform(input)).toBe(input)
  })
})
