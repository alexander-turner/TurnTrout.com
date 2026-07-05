import type { Element, ElementContent, Root } from "hast"

import { describe, expect, it } from "@jest/globals"
import { h } from "hastscript"
import { VFile } from "vfile"

import type { FullSlug } from "../../util/path"

import {
  anchorId,
  BACKLINK_EXCERPT_MAX_CHARS,
  buildExcerpt,
  type LinkContext,
  LinkContexts,
  textOf,
  trimWindow,
  truncateFragment,
} from "./linkContexts"

/** Builds a resolved-internal citing link the way CrawlLinks leaves it (literal `data-slug`). */
function cite(target: string, text: string, extra: Record<string, unknown> = {}): Element {
  return {
    type: "element",
    tagName: "a",
    properties: { className: ["internal", "can-trigger-popover"], "data-slug": target, ...extra },
    children: [{ type: "text", value: text }],
  }
}

/** Runs the transformer over a tree and returns the recorded link contexts. */
function run(tree: Root, slug = "test-page"): { contexts: readonly LinkContext[]; tree: Root } {
  const file = new VFile("")
  file.data = { slug: slug as FullSlug }
  const htmlPlugins = LinkContexts().htmlPlugins?.({} as never)
  if (!htmlPlugins) throw new Error("LinkContexts returned no htmlPlugins")
  const transform = (htmlPlugins[0] as () => (t: Root, f: VFile) => void)()
  transform(tree, file)
  return { contexts: (file.data.linkContexts as readonly LinkContext[]) ?? [], tree }
}

const ANCHOR = "cite-anchor"

/** A block whose single citing link carries {@link ANCHOR}, ready for {@link buildExcerpt}. */
function blockWith(...children: ElementContent[]): Element {
  return h("p", children) as Element
}

describe("textOf", () => {
  it("returns an empty string for non-text/element nodes", () => {
    expect(textOf({ type: "comment", value: "ignored" } as unknown as ElementContent)).toBe("")
  })
})

describe("anchorId", () => {
  it.each([
    ["test-page", 0, "backlink-cite-test-page-0"],
    ["posts/my_post", 2, "backlink-cite-posts-my-post-2"],
    ["", 0, "backlink-cite-page-0"],
  ])("namespaces %j #%d as %j", (slug, index, expected) => {
    expect(anchorId(slug as string, index as number)).toBe(expected)
  })
})

describe("buildExcerpt sanitizer", () => {
  const anchored = (text: string): Element => ({
    type: "element",
    tagName: "a",
    properties: { className: ["internal"], id: ANCHOR, "data-slug": "other" },
    children: [{ type: "text", value: text }],
  })

  it("wraps the citing link in a highlight span and drops its attributes", () => {
    const html = buildExcerpt(blockWith({ type: "text", value: "See " }, anchored("here")), ANCHOR)
    expect(html).toBe('See <span class="backlink-highlight">here</span>')
  })

  it("strips favicon elements and unwraps favicon spans", () => {
    const faviconSpan = h("span.favicon-span", [
      { type: "text", value: "site" },
      h("svg", { className: ["favicon"] }),
    ]) as ElementContent
    const html = buildExcerpt(
      blockWith(faviconSpan, { type: "text", value: " " }, anchored("x")),
      ANCHOR,
    )
    expect(html).toBe('site <span class="backlink-highlight">x</span>')
  })

  it("replaces emoji images with their alt text and drops empty-alt emoji", () => {
    const withAlt = h("img.emoji", { alt: "🐟" }) as ElementContent
    const emptyAlt = h("img.emoji", { alt: "" }) as ElementContent
    const html = buildExcerpt(blockWith(withAlt, emptyAlt, anchored("x")), ANCHOR)
    expect(html).toBe('🐟<span class="backlink-highlight">x</span>')
  })

  it("unwraps emoji spans", () => {
    const emojiSpan = h("span.emoji-span", [
      { type: "text", value: "a" },
      h("img.emoji", { alt: "🐟" }),
    ]) as ElementContent
    const html = buildExcerpt(blockWith(emojiSpan, anchored("x")), ANCHOR)
    expect(html).toBe('a🐟<span class="backlink-highlight">x</span>')
  })

  it("replaces KaTeX with its TeX annotation source as code", () => {
    const katex = h("span.katex", [
      h("span.katex-mathml", [
        h("math", [
          h("semantics", [
            h("mrow", [h("mi", "x")]),
            h("annotation", { encoding: "application/x-tex" }, "x^2"),
          ]),
        ]),
      ]),
      h("span.katex-html", [{ type: "text", value: "garbled" }]),
    ]) as ElementContent
    const html = buildExcerpt(blockWith(katex, { type: "text", value: " " }, anchored("x")), ANCHOR)
    expect(html).toBe('<code>x^2</code> <span class="backlink-highlight">x</span>')
  })

  it("emits empty code when a KaTeX span has no annotation", () => {
    const katex = h("span.katex", [
      h("span.katex-html", [{ type: "text", value: "g" }]),
    ]) as ElementContent
    const html = buildExcerpt(blockWith(katex, anchored("x")), ANCHOR)
    expect(html).toBe('<code></code><span class="backlink-highlight">x</span>')
  })

  it("drops footnote-reference superscripts but keeps ordinary superscripts", () => {
    const footnote = h("sup", [h("a", { href: "#user-content-fn-1" }, "1")]) as ElementContent
    const ordinary = h("sup", [{ type: "text", value: "2" }]) as ElementContent
    const html = buildExcerpt(
      blockWith({ type: "text", value: "a" }, footnote, ordinary, anchored("x")),
      ANCHOR,
    )
    expect(html).toBe('a<sup>2</sup><span class="backlink-highlight">x</span>')
  })

  it("drops media elements and comments, unwraps non-citing links, and strips ids", () => {
    const img = h("img", { src: "/pic.png" }) as ElementContent
    const otherLink = h("a", { href: "/y" }, "link") as ElementContent
    const emphasis = h("em", { id: "keepme" }, "emph") as ElementContent
    const comment = { type: "comment", value: "x" } as unknown as ElementContent
    const html = buildExcerpt(
      blockWith(img, otherLink, { type: "text", value: " " }, emphasis, comment, anchored("x")),
      ANCHOR,
    )
    expect(html).toBe('link <em>emph</em><span class="backlink-highlight">x</span>')
    expect(html).not.toContain("keepme")
  })

  it("returns an empty string when the block sanitizes to no visible text", () => {
    const img = h("img", { src: "/pic.png" }) as ElementContent
    const anchorImageOnly: Element = {
      type: "element",
      tagName: "a",
      properties: { className: ["internal"], id: ANCHOR, "data-slug": "other" },
      children: [img],
    }
    expect(buildExcerpt(blockWith(anchorImageOnly), ANCHOR)).toBe("")
  })
})

describe("trimWindow", () => {
  it("snaps the start forward past a partial word and leading whitespace", () => {
    // "aaaa bbbb cccc" — a left edge inside "aaaa" snaps to the start of "bbbb".
    const full = "aaaa bbbb cccc"
    const { winStart } = trimWindow(full, 10, 14, 14, 8, 0)
    expect(winStart).toBe(5)
  })

  it("leaves the start untouched when it already sits at a word boundary", () => {
    const full = "aaaa bbbb"
    const { winStart } = trimWindow(full, 5, 9, 9, 0, 0)
    expect(winStart).toBe(5)
  })

  it("snaps the end back to the previous word boundary", () => {
    const full = "aaaa bbbb cccc"
    const { winEnd } = trimWindow(full, 0, 4, 14, 0, 8)
    expect(winEnd).toBe(9)
  })

  it("skips over runs of whitespace when snapping the start", () => {
    const full = "one   two   three"
    const { winStart } = trimWindow(full, 12, 17, 17, 3, 0)
    expect(winStart).toBe(12)
  })

  it("skips over runs of whitespace when snapping the end", () => {
    const full = "one   two   three"
    const { winEnd } = trimWindow(full, 0, 3, 17, 0, 7)
    expect(winEnd).toBe(9)
  })
})

/** A highlight span with the given visible text. */
function highlight(text: string): ElementContent {
  return h("span.backlink-highlight", [{ type: "text", value: text }]) as ElementContent
}

/** A run of `count` five-char words ("word ") for building over-long fragments. */
function words(count: number): ElementContent {
  return { type: "text", value: "word ".repeat(count) }
}

describe("truncateFragment", () => {
  it("throws when the highlight span is missing (sanitization dropped it)", () => {
    expect(() => truncateFragment([words(100)])).toThrow(/highlight span/)
  })

  it("returns the fragment unchanged when it is under the length cap", () => {
    const frag: ElementContent[] = [{ type: "text", value: "short " }, highlight("here")]
    expect(truncateFragment(frag)).toEqual(frag)
  })

  it("brackets both sides when the highlight is surrounded by long prose", () => {
    // Include a comment node so measurement/slicing skip non-text/element nodes.
    const frag: ElementContent[] = [
      words(100),
      { type: "comment", value: "c" },
      highlight("HERE"),
      words(100),
    ]
    const out = truncateFragment(frag)
    const text = out.map((n) => textOf(n)).join("")
    expect(text).toContain("HERE")
    // Leading marker keeps a space before the first word; trailing keeps one after.
    expect(text.startsWith("[...] ")).toBe(true)
    expect(text.endsWith(" [...]")).toBe(true)
    expect(text.length).toBeLessThanOrEqual(BACKLINK_EXCERPT_MAX_CHARS + 10)
  })

  it("only brackets the right when the highlight starts the fragment", () => {
    const out = truncateFragment([highlight("HERE"), words(100)])
    const text = out.map((n) => textOf(n)).join("")
    expect(text.startsWith("[...]")).toBe(false)
    expect(text.endsWith(" [...]")).toBe(true)
  })

  it("only brackets the left when the highlight ends the fragment", () => {
    const out = truncateFragment([words(100), highlight("HERE")])
    const text = out.map((n) => textOf(n)).join("")
    expect(text.startsWith("[...] ")).toBe(true)
    expect(text.endsWith("[...]")).toBe(false)
    expect(text.endsWith("HERE")).toBe(true)
  })

  it("redistributes budget to the long side when one side is short", () => {
    const out = truncateFragment([{ type: "text", value: "tiny " }, highlight("HERE"), words(200)])
    const text = out.map((n) => textOf(n)).join("")
    expect(text).toContain("tiny")
    expect(text.endsWith(" [...]")).toBe(true)
  })

  it("drops inline elements that fall entirely outside the kept window", () => {
    const farAway = h("em", [{ type: "text", value: "x".repeat(400) }]) as ElementContent
    const near = { type: "text", value: " near tail words here " } as ElementContent
    const out = truncateFragment([farAway, near, highlight("HERE")])
    const serialized = JSON.stringify(out)
    expect(serialized).not.toContain('"x')
    expect(out.map((n) => textOf(n)).join("")).toContain("HERE")
  })
})

describe("LinkContexts transformer", () => {
  it("records a sanitized excerpt and stamps a deep-link anchor on the citing link", () => {
    const link = cite("other-page", "cited")
    const tree = h("root", [h("p", [{ type: "text", value: "Intro " }, link])]) as unknown as Root
    const { contexts, tree: out } = run(tree)

    expect(contexts).toHaveLength(1)
    expect(contexts[0].target).toBe("other-page")
    expect(contexts[0].anchor).toBe("backlink-cite-test-page-0")
    expect(contexts[0].excerptHtml).toBe('Intro <span class="backlink-highlight">cited</span>')
    // The anchor id is stamped on the original citing link for deep-linking.
    const citingLink = (out.children[0] as Element).children[1] as Element
    expect(citingLink.properties.id).toBe("backlink-cite-test-page-0")
  })

  it("reuses an existing id on the citing link instead of generating one", () => {
    const link = cite("other-page", "cited", { id: "already-here" })
    const tree = h("root", [h("p", [link])]) as unknown as Root
    const { contexts } = run(tree)
    expect(contexts[0].anchor).toBe("already-here")
  })

  it.each([["li"], ["dd"], ["dt"], ["td"], ["th"], ["figcaption"]])(
    "extracts an excerpt when the citing link sits inside a <%s>",
    (tag) => {
      const link = cite("other-page", "cited")
      const wrapper = tag === "li" ? h("ul", [h(tag, [link])]) : h(tag, [link])
      const tree = h("root", [wrapper]) as unknown as Root
      const { contexts } = run(tree)
      expect(contexts).toHaveLength(1)
      expect(contexts[0].excerptHtml).toContain("backlink-highlight")
    },
  )

  it("keeps only the first occurrence per target (one excerpt per source page)", () => {
    const tree = h("root", [
      h("p", [{ type: "text", value: "first " }, cite("other-page", "one")]),
      h("p", [{ type: "text", value: "second " }, cite("other-page", "two")]),
    ]) as unknown as Root
    const { contexts } = run(tree)
    expect(contexts).toHaveLength(1)
    expect(contexts[0].excerptHtml).toContain("one")
  })

  it("assigns incrementing anchors across distinct targets", () => {
    const tree = h("root", [
      h("p", [cite("page-a", "a")]),
      h("p", [cite("page-b", "b")]),
    ]) as unknown as Root
    const { contexts } = run(tree)
    expect(contexts.map((c) => c.anchor)).toEqual([
      "backlink-cite-test-page-0",
      "backlink-cite-test-page-1",
    ])
  })

  it("skips self-referential links", () => {
    const tree = h("root", [h("p", [cite("test-page", "self")])]) as unknown as Root
    const { contexts } = run(tree)
    expect(contexts).toHaveLength(0)
  })

  it("skips links inside headings and spoiler containers", () => {
    const tree = h("root", [
      h("h2", [cite("heading-target", "h")]),
      h("div.spoiler-container", [h("p", [cite("spoiler-target", "s")])]),
    ]) as unknown as Root
    const { contexts } = run(tree)
    expect(contexts).toHaveLength(0)
  })

  it("skips citing links that sit outside any excerpt-able block", () => {
    const tree = h("root", [h("div", [cite("other-page", "loose")])]) as unknown as Root
    const { contexts } = run(tree)
    expect(contexts).toHaveLength(0)
  })

  it.each([
    ["external links", h("a", { className: ["external"], href: "https://x.com" }, "ext")],
    ["same-page anchors", h("a", { className: ["internal", "same-page-link"], href: "#s" }, "a")],
    ["internal links without a resolved target", h("a", { className: ["internal"] }, "raw")],
    [
      "transclude placeholder links (replaced at emit, so the stamped id would dangle)",
      h("a", { className: ["internal", "transclude-inner"], "data-slug": "other-page" }, "embed"),
    ],
    ["non-anchor elements", h("strong", "bold")],
  ])("ignores %s", (_label, node) => {
    const tree = h("root", [h("p", [node as ElementContent])]) as unknown as Root
    const { contexts } = run(tree)
    expect(contexts).toHaveLength(0)
  })
})
