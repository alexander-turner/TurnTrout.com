import { describe, expect, it } from "@jest/globals"
import { toHtml } from "hast-util-to-html"

import {
  type Contribution,
  type ContributionFilter,
  type ContributionsSnapshot,
  isShown,
  renderContributions,
  renderList,
  titleNodes,
} from "./externalContributions"

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
  ])("%s", (_name, title, html) => {
    expect(toHtml(titleNodes(title))).toBe(html)
  })
})

describe("renderList", () => {
  const items = [
    item({ repo: "big/repo", number: 9, status: "fixed", title: "Issue" }),
    item({ repo: "big/repo", number: 7, status: "merged", title: "Later PR" }),
    item({ repo: "big/repo", number: 3, status: "merged", title: "Earlier PR" }),
    item({ repo: "huge/repo", number: 1, title: "Huge PR" }),
  ]
  const html = toHtml(renderList(items, { items, repos: REPOS }))

  it("orders repos by stars, descending", () => {
    expect(html.indexOf("huge/repo")).toBeLessThan(html.indexOf("big/repo"))
  })

  it("orders items by status, then number, within each repo", () => {
    const titles = [...html.matchAll(/<li>.*?<a [^>]*>([^<]*)<\/a><\/li>/g)].map(
      (match) => match[1],
    )
    expect(titles).toEqual(["Huge PR", "Earlier PR", "Later PR", "Issue"])
  })

  it("renders a repo heading with a monospace name, no favicon, and the star count", () => {
    expect(html).toContain(
      '<dt><a class="no-favicon" href="https://github.com/huge/repo"><code>huge/repo</code></a>' +
        '<span class="contribution-stars">★ 90,571</span></dt>',
    )
  })

  it("puts the status pill before each linked title", () => {
    expect(html).toContain(
      '<li><span class="contribution-status contribution-fixed">Fixed</span>' +
        '<a class="no-favicon" href="https://github.com/big/repo/pull/1">Issue</a></li>',
    )
  })

  it("marks the list so the HTML prose transforms skip its titles", () => {
    expect(html.startsWith('<dl class="external-contributions no-formatting">')).toBe(true)
  })

  it("orders same-star repos by name", () => {
    const tied = [item({ repo: "b/repo" }), item({ repo: "a/repo" })]
    const repos = {
      "a/repo": { stars: 10, ownerType: "Organization" },
      "b/repo": { stars: 10, ownerType: "Organization" },
    }
    const tiedHtml = toHtml(renderList(tied, { items: tied, repos }))
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
    const markdown = renderContributions(JSON.stringify(snapshot), FILTER)
    const [summary, shipped, admonition] = markdown.split("\n\n")
    expect(summary).toBe(
      "This list refreshes daily from GitHub. So far, 1 pull request of mine merged " +
        "and 1 issue I reported got fixed, across 1 project.",
    )
    expect(shipped).toBe(toHtml(renderList([merged, fixed], snapshot)))
    expect(admonition).toBe(
      `> [!goose]- In progress: 1 open item\n> ${toHtml(renderList([open], snapshot))}`,
    )
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
    )
    expect(markdown).toContain("> [!goose]- In progress: 2 open items\n")
  })

  it("throws rather than render an empty section", () => {
    expect(() => renderContributions(snapshotJson([item({ status: "open" })]), FILTER)).toThrow(
      "No external contributions pass the filter",
    )
  })

  it("throws when an item's repo has no metadata", () => {
    expect(() =>
      renderContributions(snapshotJson([item({ repo: "missing/repo" })]), FILTER),
    ).toThrow("no repo metadata for missing/repo")
  })
})
