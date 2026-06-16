import type { Element, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import fs from "fs/promises"
import { h } from "hastscript"
import os from "os"
import path from "path"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import type { QuartzTransformerPluginInstance } from "../types"

import {
  buildRelatedPostsBlock,
  loadRelatedPosts,
  parseRelatedPosts,
  type RelatedPost,
  RelatedPosts,
} from "./relatedPosts"
import { troutContainerId } from "./trout_hr"

const samplePosts: RelatedPost[] = [
  { permalink: "first-post", title: "First Post", excerpt: "About the first thing." },
  { permalink: "alias/second", title: "Second Post", excerpt: "The model's second thing." },
]

const treeWithOrnament = (): Root =>
  h(null, [h("p", "body"), h("div", { id: troutContainerId })]) as Root

const runTransform = async (
  plugin: QuartzTransformerPluginInstance,
  tree: Root,
  slug?: string,
): Promise<Root> => {
  const htmlPlugins = plugin.htmlPlugins?.({} as never)
  if (!htmlPlugins) throw new Error("no html plugins")
  const file = new VFile({ value: "" })
  file.data.slug = slug as never
  for (const factory of htmlPlugins) {
    const makeTransform = factory as unknown as () => (t: Root, f: VFile) => Promise<void>
    await makeTransform()(tree, file)
  }
  return tree
}

const writeTempMap = async (map: Record<string, RelatedPost[]>): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "related-"))
  const file = path.join(dir, "related_posts.json")
  await fs.writeFile(file, JSON.stringify(map), "utf-8")
  return file
}

const classesOf = (node: Element): string[] => {
  const className = node.properties?.className
  return Array.isArray(className) ? className.map(String) : []
}

const elementsWithClass = (tree: Element | Root, klass: string): Element[] => {
  const matches: Element[] = []
  visit(tree, "element", (node: Element) => {
    if (classesOf(node).includes(klass)) matches.push(node)
  })
  return matches
}

const elementsByTag = (tree: Element | Root, tagName: string): Element[] => {
  const matches: Element[] = []
  visit(tree, "element", (node: Element) => {
    if (node.tagName === tagName) matches.push(node)
  })
  return matches
}

describe("parseRelatedPosts", () => {
  it("parses a valid map", () => {
    const map = parseRelatedPosts(JSON.stringify({ "a-post": samplePosts }), "src")
    expect(map.get("a-post")).toHaveLength(2)
  })

  it.each([
    ["[]", "src must contain a JSON object"],
    ["null", "src must contain a JSON object"],
    [
      JSON.stringify({ "a-post": "nope" }),
      "src entry for a-post must be an array of related posts",
    ],
    [
      JSON.stringify({ "a-post": [null] }),
      "src entry for a-post must be an array of related posts",
    ],
    [
      JSON.stringify({ "a-post": [{ permalink: 1, title: "t", excerpt: "e" }] }),
      "src entry for a-post must be an array of related posts",
    ],
    [
      JSON.stringify({ "a-post": [{ permalink: "p" }] }),
      "src entry for a-post must be an array of related posts",
    ],
  ])("rejects invalid input %s", (raw, message) => {
    expect(() => parseRelatedPosts(raw, "src")).toThrow(message)
  })
})

describe("loadRelatedPosts", () => {
  it("returns an empty map when the file is missing", async () => {
    const map = await loadRelatedPosts("/nonexistent/related_posts.json")
    expect(map.size).toBe(0)
  })

  it("propagates non-ENOENT errors", async () => {
    // A directory path triggers EISDIR rather than ENOENT.
    await expect(loadRelatedPosts(process.cwd())).rejects.toThrow()
  })

  it("defaults to (and validates) the committed related_posts.json", async () => {
    const map = await loadRelatedPosts()
    expect(map.has("test-page")).toBe(true)
  })
})

describe("buildRelatedPostsBlock", () => {
  it("renders a titled list of internal popover links with excerpts", () => {
    const block = buildRelatedPostsBlock(samplePosts)

    const [title] = elementsWithClass(block, "related-posts-title")
    expect(title.children[0]).toMatchObject({ value: "Similar links" })

    const links = elementsByTag(block, "a")
    expect(links.map((l) => l.properties?.href)).toEqual(["/first-post", "/alias/second"])
    expect(links.every((l) => classesOf(l).includes("can-trigger-popover"))).toBe(true)
    expect(links.every((l) => classesOf(l).includes("internal"))).toBe(true)

    const excerpts = elementsWithClass(block, "related-post-excerpt")
    expect(excerpts).toHaveLength(2)
    // Excerpts run through the site's text transforms (straight → smart quotes).
    expect(excerpts[1].children[0]).toMatchObject({ value: "The model’s second thing." })
  })
})

describe("RelatedPosts transformer", () => {
  it("inserts the block after the ornament, reusing one read across pages", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const plugin = RelatedPosts({ filePath })

    const tree = await runTransform(plugin, treeWithOrnament(), "post-a")
    expect(elementsWithClass(tree, "related-post")).toHaveLength(2)

    // A second page through the same instance hits the memoized map (no re-read).
    const tree2 = await runTransform(plugin, treeWithOrnament(), "post-a")
    expect(elementsWithClass(tree2, "related-post")).toHaveLength(2)
  })

  it("leaves the tree unchanged for an unknown slug", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const tree = await runTransform(RelatedPosts({ filePath }), treeWithOrnament(), "other")
    expect(elementsWithClass(tree, "related-posts")).toHaveLength(0)
  })

  it("does nothing when the file has no slug", async () => {
    const tree = await runTransform(RelatedPosts(), treeWithOrnament())
    expect(elementsWithClass(tree, "related-posts")).toHaveLength(0)
  })
})
