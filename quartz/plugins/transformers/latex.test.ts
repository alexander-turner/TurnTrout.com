import type { Element, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { fromHtml } from "hast-util-from-html"
import { toString } from "hast-util-to-string"
import { h } from "hastscript"
import katex from "katex"
import { VFile } from "vfile"

import { glueRelations, Latex } from "./latex"

describe("Latex plugin", () => {
  const plugin = Latex()
  const mockCtx = {} as never

  it.each([
    [
      "htmlPlugins includes rehype-katex and a11y transform",
      () => expect(plugin.htmlPlugins?.(mockCtx) ?? []).toHaveLength(2),
    ],
    [
      "markdownPlugins has one entry",
      () => expect(plugin.markdownPlugins?.(mockCtx) ?? []).toHaveLength(1),
    ],
    [
      "externalResources includes katex CSS",
      () =>
        expect(plugin.externalResources?.(mockCtx)?.css).toContain("/static/styles/katex.min.css"),
    ],
  ])("%s", (_name, assertFn) => {
    assertFn()
  })

  describe("katex-display a11y transform", () => {
    function getA11yTransform() {
      const plugins = plugin.htmlPlugins?.(mockCtx) ?? []
      // The second plugin is the a11y transform factory
      const factory = plugins[1] as () => (tree: Root, file: VFile) => void
      return factory()
    }

    function runTransform(tree: Root): VFile {
      const file = new VFile("")
      getA11yTransform()(tree, file)
      return file
    }

    it("adds tabindex and role to .katex-display elements", () => {
      const tree = h(null, [h("span.katex-display", [h("span.katex", "x^2")])]) as unknown as Root
      runTransform(tree)
      const display = (
        tree as unknown as { children: Array<{ properties: Record<string, unknown> }> }
      ).children[0]
      expect(display.properties.tabIndex).toBe(0)
      expect(display.properties.role).toBe("group")
    })

    it("does not add tabindex to inline .katex elements", () => {
      const tree = h(null, [h("span.katex", "x^2")]) as unknown as Root
      runTransform(tree)
      const katex = (
        tree as unknown as { children: Array<{ properties: Record<string, unknown> }> }
      ).children[0]
      expect(katex.properties.tabIndex).toBeUndefined()
      expect(katex.properties.role).toBeUndefined()
    })

    it.each([
      ["block math", h(null, [h("span.katex-display", [h("span.katex", "x^2")])])],
      ["inline math", h(null, [h("span.katex", "x^2")])],
    ])("sets file.data.usesKatex for %s", (_name, tree) => {
      const file = runTransform(tree as unknown as Root)
      expect(file.data.usesKatex).toBe(true)
    })

    it.each([
      ["text-only content", h(null, [h("p", "plain text")])],
      ["classed non-math elements", h(null, [h("p.prose", [h("span.highlight", "x")])])],
    ])("does not set file.data.usesKatex for %s", (_name, tree) => {
      const file = runTransform(tree as unknown as Root)
      expect(file.data.usesKatex).toBeUndefined()
    })
  })

  describe("glueRelations", () => {
    function baseTexts(tex: string): string[] {
      const tree = fromHtml(katex.renderToString(tex, { output: "html" }), { fragment: true })
      const katexSpan = tree.children[0] as Element
      const katexHtml = katexSpan.children[0] as Element
      glueRelations(katexHtml)
      return katexHtml.children.map((child) => toString(child))
    }

    it.each([
      ["a relation to its right operand", String.raw`\alpha \in \{0.2, 0.4\}`, ["α∈{0.2,0.4}"]],
      ["a chain of relations", "a = b \\leq c", ["a=b≤c"]],
      ["nothing after a binary operator", "a + b", ["a+", "b"]],
      ["only the relation side of a mixed formula", "a + b = c + d", ["a+", "b=c+", "d"]],
      ["nothing in a formula without operators", "x", ["x"]],
    ])("glues %s", (_name, tex, expected) => {
      expect(baseTexts(tex)).toEqual(expected)
    })

    it("leaves a trailing relation alone", () => {
      expect(baseTexts("a =")).toEqual(["a="])
    })

    it("runs inside the plugin's KaTeX pass", () => {
      const tree = fromHtml(katex.renderToString("a = b", { output: "html" }), { fragment: true })
      const factory = (plugin.htmlPlugins?.(mockCtx) ?? [])[1] as () => (
        tree: Root,
        file: VFile,
      ) => void
      factory()(tree, new VFile(""))
      const katexHtml = (tree.children[0] as Element).children[0] as Element
      expect(katexHtml.children).toHaveLength(1)
    })

    it("skips non-base siblings such as equation tags", () => {
      const katexHtml = h("span.katex-html", [
        h("span.base", [h("span.mrel", "=")]),
        h("span.tag", "(1)"),
      ])
      glueRelations(katexHtml)
      expect(katexHtml.children).toHaveLength(2)
    })
  })
})
