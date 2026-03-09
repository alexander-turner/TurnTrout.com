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
  it("includes makeKatexDisplayAccessible in htmlPlugins", () => {
    const plugin = Latex()
    const mockCtx = {} as never
    const htmlPlugins = plugin.htmlPlugins?.(mockCtx) ?? []
    expect(htmlPlugins).toContain(makeKatexDisplayAccessible)
  })

  it("includes remarkMath in markdownPlugins", () => {
    const plugin = Latex()
    const mockCtx = {} as never
    const mdPlugins = plugin.markdownPlugins?.(mockCtx) ?? []
    expect(mdPlugins).toHaveLength(1)
  })

  it("provides katex CSS as external resource", () => {
    const plugin = Latex()
    const mockCtx = {} as never
    const resources = plugin.externalResources?.(mockCtx)
    expect(resources?.css).toContain("/static/styles/katex.min.css")
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
