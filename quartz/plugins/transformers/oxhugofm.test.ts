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
    const plugin = OxHugoFlavouredMarkdown()
    expect(plugin.name).toBe("OxHugoFlavouredMarkdown")
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
    ])("converts %s", (_, input, expected) => {
      expect(transform(input)).toBe(expected)
    })

    it("leaves non-relref links untouched", () => {
      const input = "[Normal link](https://example.com)"
      expect(transform(input)).toBe(input)
    })

    it("does nothing when wikilinks disabled", () => {
      const transform = getTransform({ wikilinks: false, removeHugoShortcode: false })
      const input = '[Link]({{< relref "page" >}})'
      expect(transform(input)).toBe(input)
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
      const input = "## Heading {#anchor}"
      expect(transform(input)).toBe(input)
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
      const input = "{{shortcode}}"
      expect(transform(input)).toBe(input)
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
      const input = '<figure src="image.png">'
      expect(transform(input)).toBe(input)
    })
  })

  describe("replaceOrgLatex", () => {
    const transform = getTransform()

    it.each([
      ["inline LaTeX \\\\(...\\\\)", "\\\\(x + y\\\\)", "$x + y$"],
      ["block LaTeX \\\\[...\\\\]", "\\\\[x + y\\\\]", "$$x + y$$"],
      [
        "block LaTeX \\begin{equation}...\\end{equation}",
        "\\begin{equation}E = mc^2\\end{equation}",
        "$$E = mc^2$$",
      ],
    ])("converts %s", (_, input, expected) => {
      expect(transform(input)).toBe(expected)
    })

    it("converts multiline block LaTeX", () => {
      const input = "\\\\[\na + b\n= c\n\\\\]"
      expect(transform(input)).toBe("$$\na + b\n= c\n$$")
    })

    it("unescapes underscores in inline LaTeX", () => {
      const result = transform("$x\\_i + y\\_j$")
      expect(result).toBe("$x_i + y_j$")
    })

    it("unescapes underscores in block LaTeX", () => {
      const result = transform("$$\\sum\\_i x\\_i$$")
      expect(result).toBe("$$\\sum_i x_i$$")
    })

    it("does nothing when disabled", () => {
      const transform = getTransform({ replaceOrgLatex: false })
      const input = "\\\\(x + y\\\\)"
      expect(transform(input)).toBe(input)
    })
  })

  describe("all options disabled", () => {
    it("returns source unchanged", () => {
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
})
