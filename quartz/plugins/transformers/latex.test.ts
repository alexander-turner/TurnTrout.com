import type { Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"

import { Latex, makeKatexDisplayAccessible } from "./latex"

function applyPlugin(tree: Root): Root {
  const transform = makeKatexDisplayAccessible()
  transform(tree)
  return tree
}

describe("Latex plugin", () => {
  const plugin = Latex()
  const mockCtx = {} as never

  it.each([
    [
      "htmlPlugins includes makeKatexDisplayAccessible",
      () => expect(plugin.htmlPlugins?.(mockCtx) ?? []).toContain(makeKatexDisplayAccessible),
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
})

describe("makeKatexDisplayAccessible", () => {
  it("adds tabindex and role to .katex spans", () => {
    const tree: Root = {
      type: "root",
      children: [h("span", { className: ["katex"] }, "math content")],
    }

    applyPlugin(tree)

    const span = tree.children[0] as import("hast").Element
    expect(span.properties.tabIndex).toBe(0)
    expect(span.properties.role).toBe("math")
  })

  it.each([["other-class"], ["katex-display"], ["katex-mathml"]])(
    "does not modify spans with only .%s class",
    (className) => {
      const tree: Root = {
        type: "root",
        children: [h("span", { className: [className] }, "text")],
      }

      applyPlugin(tree)

      const span = tree.children[0] as import("hast").Element
      expect(span.properties.tabIndex).toBeUndefined()
      expect(span.properties.role).toBeUndefined()
    },
  )

  it("does not modify non-span elements with katex class", () => {
    const tree: Root = {
      type: "root",
      children: [h("div", { className: ["katex"] }, "math content")],
    }

    applyPlugin(tree)

    const div = tree.children[0] as import("hast").Element
    expect(div.properties.tabIndex).toBeUndefined()
    expect(div.properties.role).toBeUndefined()
  })

  it("handles nested katex structures (display wrapping inline)", () => {
    const tree: Root = {
      type: "root",
      children: [
        h("span", { className: ["katex-display"] }, [
          h("span", { className: ["katex"] }, [
            h("span", { className: ["katex-mathml"] }),
            h("span", { className: ["katex-html"] }),
          ]),
        ]),
      ],
    }

    applyPlugin(tree)

    const display = tree.children[0] as import("hast").Element
    const katex = display.children[0] as import("hast").Element
    expect(katex.properties.tabIndex).toBe(0)
    expect(katex.properties.role).toBe("math")
  })
})
