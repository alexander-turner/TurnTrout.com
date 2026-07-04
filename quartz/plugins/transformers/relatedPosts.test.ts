import type { Element, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import fs from "fs/promises"
import { h } from "hastscript"
import os from "os"
import path from "path"
import { visit } from "unist-util-visit"
import { VFile } from "vfile"

import type { QuartzTransformerPluginInstance } from "../types"

import { footnoteHeadingId } from "../../components/constants"
import { AfterArticle } from "./afterArticle"
import {
  buildRelatedPostsBlock,
  insertSimilarPostsTocEntry,
  loadRelatedPosts,
  parseRelatedPosts,
  type RelatedPost,
  RelatedPosts,
  similarPostsTocEntry,
} from "./relatedPosts"
import { insertOrnamentNode, troutContainerId } from "./trout_hr"

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

  // The "Similar posts" block is built after the Twemoji and TagSmallcaps
  // passes have already run, so it must re-apply those transforms itself.
  // These cases would have caught the bug where emoji/acronyms rendered raw.
  const emojiPosts: RelatedPost[] = [
    {
      permalink: "p",
      title: "I'm that Other Fish in the Sea 🐟",
      excerpt: "My dating doc about LLM safety. Is it you? 💘",
    },
  ]

  const fullTextOf = (node: Element): string => {
    let text = ""
    visit(node, "text", (t: { value: string }) => {
      text += t.value
    })
    return text
  }

  it("renders emoji in the title as Twemoji <img> elements", () => {
    const [, list] = buildRelatedPostsBlock(emojiPosts)
    const link = elementsByTag(list, "a")[0]
    const imgs = elementsByTag(link, "img")
    expect(imgs).toHaveLength(1)
    expect(classesOf(imgs[0])).toContain("emoji")
    expect(imgs[0].properties?.alt).toBe("🐟")
  })

  it("renders emoji in the excerpt as Twemoji <img> elements", () => {
    const [, list] = buildRelatedPostsBlock(emojiPosts)
    const excerpt = elementsWithClass(list, "related-post-excerpt")[0]
    const imgs = elementsByTag(excerpt, "img")
    expect(imgs).toHaveLength(1)
    expect(classesOf(imgs[0])).toContain("emoji")
    expect(imgs[0].properties?.alt).toBe("💘")
  })

  it("wraps acronyms in the excerpt with small-caps <abbr>", () => {
    const [, list] = buildRelatedPostsBlock(emojiPosts)
    const excerpt = elementsWithClass(list, "related-post-excerpt")[0]
    const abbrs = elementsByTag(excerpt, "abbr")
    expect(abbrs).toHaveLength(1)
    expect(classesOf(abbrs[0])).toContain("small-caps")
    expect((abbrs[0].children[0] as { value: string }).value).toBe("llm")
  })

  it("renders title acronyms as plain caps, not small-caps", () => {
    const [, list] = buildRelatedPostsBlock([
      {
        permalink: "p",
        title: "Seeking Power is Often Convergently Instrumental in MDPs",
        excerpt: "x",
      },
    ])
    const link = elementsByTag(list, "a")[0]
    expect(elementsByTag(link, "abbr")).toHaveLength(0)
  })

  it("applies smart-quote transforms to the title", () => {
    const [, list] = buildRelatedPostsBlock(emojiPosts)
    const link = elementsByTag(list, "a")[0]
    // The straight apostrophe in "I'm" becomes a curly one.
    expect(fullTextOf(link)).toContain("I’m")
    expect(fullTextOf(link)).not.toContain("I'm")
  })
})

describe("insertSimilarPostsTocEntry", () => {
  const intro = { depth: 0, text: "Introduction", slug: "introduction" }
  const appendix = { depth: 0, text: "Appendix: Notes", slug: "appendix-notes" }
  const appendixDeep = { depth: 2, text: "ApPeNdix C", slug: "appendix-c" }
  const footnotes = { depth: 1, text: "Footnotes", slug: footnoteHeadingId }

  it.each([
    ["empty toc", [], [similarPostsTocEntry]],
    ["no closing section, appends", [intro], [intro, similarPostsTocEntry]],
    ["before the first appendix", [intro, appendix], [intro, similarPostsTocEntry, appendix]],
    [
      "before an appendix at any depth, matching mixed case",
      [intro, appendixDeep],
      [intro, similarPostsTocEntry, appendixDeep],
    ],
    ["before the Footnotes entry", [intro, footnotes], [intro, similarPostsTocEntry, footnotes]],
    [
      "before whichever closing section comes first",
      [intro, appendix, footnotes],
      [intro, similarPostsTocEntry, appendix, footnotes],
    ],
  ])("places the entry %s", (_label, input, expected) => {
    expect(insertSimilarPostsTocEntry(input)).toEqual(expected)
  })

  it("leaves the input array unmutated", () => {
    const toc = [intro, appendix]
    insertSimilarPostsTocEntry(toc)
    expect(toc).toEqual([intro, appendix])
  })
})

describe("RelatedPosts transformer", () => {
  it("renders the block before the first appendix (full ornament pipeline)", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    // No pre-built ornament: TroutOrnamentHr places it before the appendix,
    // AfterArticle adds the subscription box after it, then RelatedPosts adds
    // the block after that — so the block must land before the appendix.
    const tree = h(null, [
      h("h1", { id: "intro" }, "Intro"),
      h("p", "body"),
      h("h1", { id: "appendix-a" }, "Appendix A"),
      h("p", "appendix body"),
    ]) as Root

    insertOrnamentNode(tree)
    const afterFactory = AfterArticle().htmlPlugins?.({} as never)?.[0]
    if (!afterFactory) throw new Error("no after-article plugin")
    const afterFile = new VFile({ value: "" })
    afterFile.data.frontmatter = { permalink: "post-a" } as never
    await (afterFactory as unknown as () => (t: Root, f: VFile) => Promise<void>)()(tree, afterFile)
    await runTransform(RelatedPosts({ filePath }), tree, "post-a")

    const topLevel = (tree.children as Element[]).filter((n) => n.type === "element")
    const similarIdx = topLevel.findIndex(
      (n) => n.tagName === "h1" && n.properties?.id === "similar-posts",
    )
    const appendixIdx = topLevel.findIndex(
      (n) => n.tagName === "h1" && n.properties?.id === "appendix-a",
    )
    expect(similarIdx).toBeGreaterThanOrEqual(0)
    expect(appendixIdx).toBeGreaterThan(similarIdx)
  })

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

  it("routes an existing toc through insertSimilarPostsTocEntry", async () => {
    const filePath = await writeTempMap({ "post-a": samplePosts })
    const intro = { depth: 0, text: "Introduction", slug: "introduction" }
    const appendix = { depth: 0, text: "Appendix A", slug: "appendix-a" }
    const { file } = await runTransform(RelatedPosts({ filePath }), treeWithOrnament(), "post-a", [
      intro,
      appendix,
    ])
    expect(file.data.toc).toEqual([intro, similarPostsTocEntry, appendix])
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
