import type { Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"

import { Latex } from "./latex"

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
      const factory = plugins[1] as () => (tree: Root) => void
      return factory()
    }

    it("adds tabindex and role to .katex-display elements", () => {
      const tree = h(null, [h("span.katex-display", [h("span.katex", "x^2")])]) as unknown as Root
      getA11yTransform()(tree)
      const display = (
        tree as unknown as { children: Array<{ properties: Record<string, unknown> }> }
      ).children[0]
      expect(display.properties.tabIndex).toBe(0)
      expect(display.properties.role).toBe("group")
    })

    it("does not add tabindex to inline .katex elements", () => {
      const tree = h(null, [h("span.katex", "x^2")]) as unknown as Root
      getA11yTransform()(tree)
      const katex = (
        tree as unknown as { children: Array<{ properties: Record<string, unknown> }> }
      ).children[0]
      expect(katex.properties.tabIndex).toBeUndefined()
      expect(katex.properties.role).toBeUndefined()
    })
  })
})
