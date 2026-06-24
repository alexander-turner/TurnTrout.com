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
  similarPostsTocEntry,
} from "./relatedPosts"
import { troutContainerId } from "./trout_hr"

const samplePosts: RelatedPost[] = [
  { permalink: "first-post", title: "First Post", excerpt: "About the first thing." },
  { permalink: "alias/second", title: "Second Post", excerpt: "The model's second thing." },
]

const treeWithOrnament = (): Root =>
  h(null, [
    h("p", "body"),
    h("div", { id: troutContainerId }),
    h("div", { class: "after-article-components" }, [h("div", { id: "subscription-and-contact" })]),
  ]) as Root

const runTransform = async (
  plugin: QuartzTransformerPluginInstance,
  tree: Root,
  permalink?: string,
  toc?: VFile["data"]["toc"],
): Promise<{ tree: Root; file: VFile }> => {
  const htmlPlugins = plugin.htmlPlugins?.({} as never)
  if (!htmlPlugins) throw new Error("no html plugins")
  const file = new VFile({ value: "" })
  file.data.frontmatter = { permalink } as never
  if (toc !== undefined) file.data.toc = toc
  for (const factory of htmlPlugins) {
    const makeTransform = factory as unknown as () => (t: Root, f: VFile) => Promise<void>
    await makeTransform()(tree, file)
  }
  return { tree, file }
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
  it("renders a top-level heading followed by a list of internal popover links with excerpts", () => {
    const [title, list] = buildRelatedPostsBlock(samplePosts)

    // The heading is its own top-level element, not nested in the list block.
    expect(title.tagName).toBe("h1")
    expect(classesOf(title)).toContain("related-posts-title")
    expect(title.properties?.id).toBe("similar-posts")
    expect(title.children[0]).toMatchObject({ value: "Similar posts" })
    expect(classesOf(list)).toContain("related-posts")

    const links = elementsByTag(list, "a")
    expect(links.map((l) => l.properties?.href)).toEqual(["/first-post", "/alias/second"])
    expect(links.every((l) => classesOf(l).includes("can-trigger-popover"))).toBe(true)
    expect(links.every((l) => classesOf(l).includes("internal"))).toBe(true)

    const excerpts = elementsWithClass(list, "related-post-excerpt")
    expect(excerpts).toHaveLength(2)
    // Excerpts run through the site's text transforms (straight → smart quotes).
    expect(excerpts[1].children[0]).toMatchObject({ value: "The model’s second thing." })
  })
})

describe("RelatedPosts transformer", () => {
  it("inserts the block after the subscription box, reusing one read across pages", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const plugin = RelatedPosts({ filePath })

    const { tree } = await runTransform(plugin, treeWithOrnament(), "post-a")
    expect(elementsWithClass(tree, "related-post")).toHaveLength(2)

    // The heading then the list must follow after-article-components, both as
    // top-level root children (so the heading is a real `article > h1`).
    const rootChildren = (tree.children as Element[]).filter((n) => n.type === "element")
    const afterIdx = rootChildren.findIndex((n) =>
      (n.properties?.className as string[] | undefined)?.includes("after-article-components"),
    )
    const headingIdx = rootChildren.findIndex(
      (n) => n.tagName === "h1" && n.properties?.id === "similar-posts",
    )
    const relatedIdx = rootChildren.findIndex((n) =>
      (n.properties?.className as string[] | undefined)?.includes("related-posts"),
    )
    expect(afterIdx).toBeGreaterThanOrEqual(0)
    expect(headingIdx).toBe(afterIdx + 1)
    expect(relatedIdx).toBe(afterIdx + 2)

    // A second page through the same instance hits the memoized map (no re-read).
    const { tree: tree2 } = await runTransform(plugin, treeWithOrnament(), "post-a")
    expect(elementsWithClass(tree2, "related-post")).toHaveLength(2)
  })

  it("appends the ToC entry when the file already has a toc", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const existingEntry = { depth: 0, text: "Introduction", slug: "introduction" }
    const { file } = await runTransform(RelatedPosts({ filePath }), treeWithOrnament(), "post-a", [
      existingEntry,
    ])
    expect(file.data.toc).toEqual([existingEntry, similarPostsTocEntry])
  })

  it("does not create a toc when the file has none", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const { file } = await runTransform(RelatedPosts({ filePath }), treeWithOrnament(), "post-a")
    expect(file.data.toc).toBeUndefined()
  })

  it("falls back to after-ornament insertion when no after-article-components exists", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const ornamentOnlyTree = h(null, [h("p", "body"), h("div", { id: troutContainerId })]) as Root
    const { tree } = await runTransform(RelatedPosts({ filePath }), ornamentOnlyTree, "post-a")
    expect(elementsWithClass(tree, "related-post")).toHaveLength(2)
  })

  it("strips leading/trailing slashes from the permalink before lookup", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const { tree } = await runTransform(RelatedPosts({ filePath }), treeWithOrnament(), "/post-a/")
    expect(elementsWithClass(tree, "related-post")).toHaveLength(2)
  })

  it("leaves the tree unchanged for an unknown permalink", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const { tree } = await runTransform(RelatedPosts({ filePath }), treeWithOrnament(), "other")
    expect(elementsWithClass(tree, "related-posts")).toHaveLength(0)
  })

  it("does nothing when the file has no permalink", async () => {
    const { tree } = await runTransform(RelatedPosts(), treeWithOrnament())
    expect(elementsWithClass(tree, "related-posts")).toHaveLength(0)
  })
})
