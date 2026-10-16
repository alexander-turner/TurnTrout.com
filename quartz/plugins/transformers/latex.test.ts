import type { Element, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { fromHtml } from "hast-util-from-html"
import { toString } from "hast-util-to-string"
import { h } from "hastscript"
import katex from "katex"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import { glueRelations, Latex } from "./latex"
import { hasClass } from "./utils"

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

  function runTransform(tree: Root): VFile {
    // The second plugin is the post-KaTeX transform factory
    const factory = (plugin.htmlPlugins?.(mockCtx) ?? [])[1] as () => (
      tree: Root,
      file: VFile,
    ) => void
    const file = new VFile("")
    factory()(tree, file)
    return file
  }

  describe("katex-display a11y transform", () => {
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
    function render(tex: string, displayMode = false): Root {
      return fromHtml(katex.renderToString(tex, { output: "html", displayMode }), {
        fragment: true,
      })
    }

    function findKatexHtml(tree: Root): Element {
      const found: Element[] = []
      visit(tree, "element", (node: Element) => {
        if (hasClass(node, "katex-html")) found.push(node)
      })
      expect(found).toHaveLength(1)
      return found[0]
    }

    function baseTexts(tree: Root): string[] {
      return findKatexHtml(tree).children.map((child) => toString(child))
    }

    it.each([
      ["a relation to its right operand", String.raw`\alpha \in \{0.2, 0.4\}`, ["α∈{0.2,0.4}"]],
      ["a chain of relations", String.raw`a = b \leq c`, ["a=b≤c"]],
      ["a colored relation", String.raw`a \color{red}{=} b`, ["a=b"]],
      ["a negated relation", String.raw`a \notin b`, ["a∈/b"]],
      ["a leading relation", "= b", ["=b"]],
      ["nothing after a binary operator", "a + b", ["a+", "b"]],
      ["only the relation side of a mixed formula", "a + b = c + d", ["a+", "b=c+", "d"]],
      ["nothing at an explicit allowbreak", String.raw`a = \allowbreak b`, ["a=", "b"]],
      ["nothing across a newline", String.raw`a = b \\ c = d`, ["a=b", "", "c=d"]],
      ["nothing after a trailing relation", "a =", ["a="]],
      ["nothing in a formula without operators", "x", ["x"]],
    ])("glues %s", (_name, tex, expected) => {
      const tree = render(tex)
      glueRelations(findKatexHtml(tree))
      expect(baseTexts(tree)).toEqual(expected)
    })

    it.each([
      ["glues inline math", false, ["a=b"]],
      ["leaves display math as emitted", true, ["a=", "b"]],
    ])("plugin pass %s", (_name, displayMode, expected) => {
      const tree = render("a = b", displayMode)
      runTransform(tree)
      expect(baseTexts(tree)).toEqual(expected)
    })

    it("skips non-base siblings such as equation tags", () => {
      const base = h("span.base", [h("span.mrel", "=")])
      const tag = h("span.tag", "(1)")
      const katexHtml = h("span.katex-html", [base, tag])
      glueRelations(katexHtml)
      expect(katexHtml.children).toEqual([base, tag])
    })
  })
})
