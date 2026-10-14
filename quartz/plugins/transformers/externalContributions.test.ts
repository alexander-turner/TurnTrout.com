import { describe, expect, it } from "@jest/globals"
import { toHtml } from "hast-util-to-html"
import rehypeRaw from "rehype-raw"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

import type { BuildCtx } from "../../util/ctx"

import {
  type Contribution,
  type ContributionFilter,
  type ContributionsSnapshot,
  isShown,
  parseAnnotations,
  renderContributions,
  renderList,
  titleNodes,
} from "./externalContributions"
import { GitHubFlavoredMarkdown } from "./gfm"

const FILTER: ContributionFilter = { minStars: 100, deniedRepos: new Set(["denied/repo"]) }

function item(overrides: Partial<Contribution>): Contribution {
  return {
    repo: "big/repo",
    number: 1,
    title: "A title",
    url: "https://github.com/big/repo/pull/1",
    status: "merged",
    ...overrides,
  }
}

const REPOS: ContributionsSnapshot["repos"] = {
  "big/repo": { stars: 5000, ownerType: "User" },
  "huge/repo": { stars: 90571, ownerType: "Organization" },
  "small/org": { stars: 3, ownerType: "Organization" },
  "small/user": { stars: 99, ownerType: "User" },
  "denied/repo": { stars: 9999, ownerType: "User" },
}

function snapshotJson(items: Contribution[]): string {
  return JSON.stringify({ items, repos: REPOS })
}

describe("isShown", () => {
  it.each([
    ["merged PR on a starred repo", item({}), true],
    ["fixed issue", item({ status: "fixed" }), true],
    ["open item", item({ status: "open" }), true],
    ["closed without merge or fix", item({ status: "closed" }), false],
    ["deleted issue", item({ title: "(deleted)", status: "fixed" }), false],
    ["denied repo", item({ repo: "denied/repo" }), false],
    ["small org repo", item({ repo: "small/org" }), true],
    ["small personal repo", item({ repo: "small/user" }), false],
  ])("%s → %s", (_name, contribution, expected) => {
    expect(isShown(contribution, REPOS[contribution.repo], FILTER)).toBe(expected)
  })

  it("admits a personal repo exactly at the star threshold", () => {
    expect(isShown(item({}), { stars: 100, ownerType: "User" }, FILTER)).toBe(true)
  })
})

describe("titleNodes", () => {
  it.each([
    ["plain", "Plain title", "Plain title"],
    ["inner code", "Fix `foo()` crash", "Fix <code>foo()</code> crash"],
    ["leading code", "`cosign verify` is slow", "<code>cosign verify</code> is slow"],
    ["only code", "`x`", "<code>x</code>"],
    ["escapes html", "a <b> & c", "a &#x3C;b> &#x26; c"],
    ["unpaired backtick", "a ` b", "a ` b"],
    [
      "bare identifier with trailing colon",
      "gdm_stealth: chat_with_manager is missing",
      "<code>gdm_stealth</code>: <code>chat_with_manager</code> is missing",
    ],
    [
      "leading underscore",
      "avoid error in _tide_item_python",
      "avoid error in <code>_tide_item_python</code>",
    ],
    [
      "identifier in parentheses",
      "swap disk (enable_guest_swap)",
      "swap disk (<code>enable_guest_swap</code>)",
    ],
    ["glob with asterisk", "match *.md files", "match <code>*.md</code> files"],
    ["identifier beside backticks", "`a` and b_c", "<code>a</code> and <code>b_c</code>"],
  ])("%s", (_name, title, html) => {
    expect(toHtml(titleNodes(title))).toBe(html)
  })
})

const NO_ANNOTATIONS: ReadonlyMap<string, string> = new Map()

describe("parseAnnotations", () => {
  it("maps each heading's key to its trimmed markdown body", () => {
    const annotations = parseAnnotations(
      "## big/repo#1\n\nFirst paragraph.\n\nSecond paragraph.\n\n## huge/repo#2  \nOne line.\n",
    )
    expect([...annotations]).toEqual([
      ["big/repo#1", "First paragraph.\n\nSecond paragraph."],
      ["huge/repo#2", "One line."],
    ])
  })

  it.each([
    ["no headings", "Just prose.", "must start with a `## owner/repo#number` heading"],
    ["an empty file", "", "must start with a `## owner/repo#number` heading"],
    ["prose before the first heading", "Stray.\n## big/repo#1\nBody", "must start with"],
    [
      "a duplicate key",
      "## big/repo#1\nA\n## big/repo#1\nB",
      "Duplicate contribution annotation for big/repo#1",
    ],
    ["an empty body", "## big/repo#1\n\n## big/repo#2\nB", "annotation for big/repo#1 is empty"],
  ])("throws on %s", (_name, markdown, message) => {
    expect(() => parseAnnotations(markdown)).toThrow(message)
  })
})

describe("renderList", () => {
  const items = [
    item({ repo: "big/repo", number: 9, status: "fixed", title: "Issue" }),
    item({ repo: "big/repo", number: 7, status: "merged", title: "Later PR" }),
    item({ repo: "big/repo", number: 3, status: "merged", title: "Earlier PR" }),
    item({ repo: "huge/repo", number: 1, title: "Huge PR" }),
  ]
  const html = renderList(items, { items, repos: REPOS }, NO_ANNOTATIONS)

  it("orders repos by stars, descending", () => {
    expect(html.indexOf("huge/repo")).toBeLessThan(html.indexOf("big/repo"))
  })

  it("orders items by status, then number, within each repo", () => {
    const titles = [...html.matchAll(/<\/span><a [^>]*>([^<]*)<\/a><\/div>/g)].map(
      (match) => match[1],
    )
    expect(titles).toEqual(["Huge PR", "Earlier PR", "Later PR", "Issue"])
  })

  it("renders a monospace repo heading with its unlinked stars as a subtitle", () => {
    expect(html).toContain("## `huge/repo`\n\nSubtitle: ★ 90,571\n\n")
  })

  it("renders each contribution as a list item: its status pill, then its linked title", () => {
    expect(html).toContain(
      '- <div class="contribution-row no-formatting">' +
        '<span class="contribution-status contribution-fixed">Fixed</span>' +
        '<a href="https://github.com/big/repo/pull/1">Issue</a></div>',
    )
  })

  it("wraps each repo's list so its pills can serve as bullets", () => {
    expect(html.match(/<div class="contribution-list">\n\n- /g)).toHaveLength(2)
    expect(html.match(/^## /gm)).toHaveLength(2)
    expect(html.endsWith("\n\n</div>")).toBe(true)
  })

  it("indents an annotation's markdown under its list item", () => {
    const annotated = renderList(
      items,
      { items, repos: REPOS },
      new Map([["big/repo#7", "Some *prose*.\n\n1. A step"]]),
    )
    expect(annotated).toContain("Later PR</a></div>\n\n  Some *prose*.\n\n  1. A step\n\n- <div")
  })

  it("gives each heading an explicit id under an id prefix", () => {
    const prefixed = [item({ repo: "Big.Org/Re_po" })]
    const repos = { "Big.Org/Re_po": { stars: 10, ownerType: "Organization" } }
    expect(renderList(prefixed, { items: prefixed, repos }, NO_ANNOTATIONS, "open-")).toMatch(
      /^<h2 id="open-big-org-re_po"><code>Big\.Org\/Re_po<\/code><\/h2>\n\nSubtitle: /,
    )
  })

  it("orders same-star repos by name", () => {
    const tied = [item({ repo: "b/repo" }), item({ repo: "a/repo" })]
    const repos = {
      "a/repo": { stars: 10, ownerType: "Organization" },
      "b/repo": { stars: 10, ownerType: "Organization" },
    }
    const tiedHtml = renderList(tied, { items: tied, repos }, NO_ANNOTATIONS)
    expect(tiedHtml.indexOf("a/repo")).toBeLessThan(tiedHtml.indexOf("b/repo"))
  })
})

describe("renderContributions", () => {
  it("renders the summary, the shipped list, and open items in a collapsed goose admonition", () => {
    const merged = item({ number: 1 })
    const fixed = item({ number: 2, status: "fixed" })
    const open = item({ number: 3, status: "open", title: "Pending" })
    const items = [merged, fixed, open, item({ number: 4, repo: "small/user" })]
    const snapshot = { items, repos: REPOS }
    const annotations = new Map([["big/repo#3", "Why it matters."]])
    const markdown = renderContributions(JSON.stringify(snapshot), FILTER, annotations)
    const shipped = renderList([merged, fixed], snapshot, annotations)
    expect(markdown).toBe(
      "This list refreshes daily from GitHub. So far, 1 pull request of mine merged " +
        "and 1 issue I reported got fixed, across 1 project.\n\n" +
        `${shipped}\n\n` +
        "> [!goose]- In progress: 1 open item\n" +
        '> <h2 id="in-progress-big-repo"><code>big/repo</code></h2>\n>\n' +
        "> Subtitle: ★ 5,000\n>\n" +
        '> <div class="contribution-list">\n>\n' +
        '> - <div class="contribution-row no-formatting">' +
        '<span class="contribution-status contribution-open">Open</span>' +
        '<a href="https://github.com/big/repo/pull/1">Pending</a></div>\n>\n' +
        ">   Why it matters.\n>\n>\n> </div>",
    )
  })

  it("parses into linkable headings and lists whose titles stay literal, in and out of the blockquote", () => {
    const items = [
      item({ number: 1, title: "Fix *a* in [b](c)" }),
      item({ number: 2 }),
      item({ number: 3, status: "open" }),
      item({ number: 4, status: "open" }),
    ]
    const annotations = new Map([
      ["big/repo#1", "Shipped *prose*:\n\n1. A step"],
      ["big/repo#3", "Pending *prose*:\n\n- A point"],
    ])
    const html = String(
      unified()
        .use(remarkParse)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(GitHubFlavoredMarkdown().htmlPlugins?.({} as BuildCtx) ?? [])
        .use(rehypeStringify)
        .processSync(renderContributions(snapshotJson(items), FILTER, annotations)),
    )
    expect([...html.matchAll(/<h2 id="([^"]*)"/g)].map((match) => match[1])).toEqual([
      "big-repo",
      "in-progress-big-repo",
    ])
    const [shipped, blockquote] = html.split("<blockquote>")
    expect(shipped).toContain(
      ">Fix <code>*a*</code> in [b](c)</a></div>\n<p>Shipped <em>prose</em>:</p>\n<ol>\n<li>A step</li>\n</ol>\n</li>",
    )
    expect(blockquote).toContain(
      "</a></div>\n<p>Pending <em>prose</em>:</p>\n<ul>\n<li>A point</li>\n</ul>\n</li>",
    )
    for (const section of [shipped, blockquote]) {
      const heading = section.match(/<h2[^>]*>(.*?)<\/h2>/s)?.[1] ?? ""
      expect(heading.match(/<a /g)).toHaveLength(1)
      expect(heading).toContain("<code>big/repo</code>")
      expect(section).toContain("<p>Subtitle: ★ 5,000</p>")
      expect(section.match(/<li>\n<div class="contribution-row no-formatting">/g)).toHaveLength(2)
    }
  })

  it("pluralizes counts and omits the admonition when nothing is open", () => {
    const markdown = renderContributions(
      snapshotJson([
        item({ number: 1 }),
        item({ number: 2 }),
        item({ number: 3, repo: "huge/repo", status: "fixed" }),
        item({ number: 4, repo: "huge/repo", status: "fixed" }),
      ]),
      FILTER,
      NO_ANNOTATIONS,
    )
    expect(markdown).toContain(
      "So far, 2 pull requests of mine merged and 2 issues I reported got fixed, across 2 projects.",
    )
    expect(markdown).not.toContain("[!goose]")
  })

  it("pluralizes the open count in the admonition title", () => {
    const markdown = renderContributions(
      snapshotJson([item({}), item({ status: "open" }), item({ number: 2, status: "open" })]),
      FILTER,
      NO_ANNOTATIONS,
    )
    expect(markdown).toContain("> [!goose]- In progress: 2 open items\n")
  })

  it("throws rather than render an empty section", () => {
    expect(() =>
      renderContributions(snapshotJson([item({ status: "open" })]), FILTER, NO_ANNOTATIONS),
    ).toThrow("No external contributions pass the filter")
  })

  it("throws when an item's repo has no metadata", () => {
    expect(() =>
      renderContributions(snapshotJson([item({ repo: "missing/repo" })]), FILTER, NO_ANNOTATIONS),
    ).toThrow("no repo metadata for missing/repo")
  })

  it("throws when an annotation matches no listed contribution", () => {
    const annotations = new Map([
      ["big/repo#1", "Listed."],
      ["small/user#4", "Filtered out."],
      ["big/repo#99", "Absent."],
    ])
    expect(() =>
      renderContributions(
        snapshotJson([item({}), item({ number: 4, repo: "small/user" })]),
        FILTER,
        annotations,
      ),
    ).toThrow("match no listed contribution: small/user#4, big/repo#99")
  })
})
