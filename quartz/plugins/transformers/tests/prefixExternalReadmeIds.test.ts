import { describe, expect, it } from "@jest/globals"
import { type Element, type Root } from "hast"
import { h } from "hastscript"

import type { BuildCtx } from "../../../util/ctx"

import { PrefixExternalReadmeIds, prefixExternalReadmeIds } from "../prefixExternalReadmeIds"

/** Finds the first element with the given id anywhere in the tree. */
function findById(node: Root | Element, id: string): Element | undefined {
  if (node.type === "element" && node.properties?.id === id) return node
  for (const child of node.children ?? []) {
    if (child.type === "element") {
      const found = findById(child, id)
      if (found) return found
    }
  }
  return undefined
}

describe("prefixExternalReadmeIds", () => {
  it("namespaces heading ids and rewrites same-page anchors within the wrapper", () => {
    const tree = h(null, [
      h("div.external-readme", { "data-readme-slug": "repo" }, [
        h("h2#usage", [h("a", { href: "#usage" }, "Usage")]),
        h("h3", "Heading without id"),
        h("a", { href: "#usage" }, "in-content jump"),
        h("a", { href: "#missing" }, "unmapped anchor"),
        h("a", { href: "https://example.com" }, "external link"),
        h("a", "anchor without href"),
        h("span", "plain text"),
      ]),
    ]) as Root

    prefixExternalReadmeIds(tree)

    const heading = findById(tree, "repo-usage")
    expect(heading?.tagName).toBe("h2")
    // autolink wrapper and in-content anchor both repointed
    const hrefs = (heading?.children[0] as Element).properties?.href
    expect(hrefs).toBe("#repo-usage")
    const anchors = tree.children[0] as Element
    expect((anchors.children[2] as Element).properties?.href).toBe("#repo-usage")
    // unmapped + external + missing-href anchors untouched
    expect((anchors.children[3] as Element).properties?.href).toBe("#missing")
    expect((anchors.children[4] as Element).properties?.href).toBe("https://example.com")
    expect((anchors.children[5] as Element).properties?.href).toBeUndefined()
  })

  it.each([
    ["wrapper missing slug attribute", h("div.external-readme", {}, [h("h2#x", "x")])],
    [
      "wrapper with empty slug",
      h("div.external-readme", { "data-readme-slug": "" }, [h("h2#x", "x")]),
    ],
    ["non-readme div", h("div.other", {}, [h("h2#x", "x")])],
    ["element without className", h("p", [h("h2#x", "x")])],
  ])("leaves ids untouched for %s", (_desc, node) => {
    const tree = h(null, [node]) as Root
    prefixExternalReadmeIds(tree)
    expect(findById(tree, "x")?.tagName).toBe("h2")
  })

  it("exposes a transformer whose html plugin prefixes ids", () => {
    const plugin = PrefixExternalReadmeIds()
    expect(plugin.name).toBe("PrefixExternalReadmeIds")
    const plugins = plugin.htmlPlugins?.({} as BuildCtx) ?? []
    const attach = plugins[0] as () => (tree: Root) => void
    const tree = h(null, [
      h("div.external-readme", { "data-readme-slug": "repo" }, [h("h2#usage", "Usage")]),
    ]) as Root
    attach()(tree)
    expect(findById(tree, "repo-usage")?.tagName).toBe("h2")
  })
})
