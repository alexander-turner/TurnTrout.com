import { describe, expect, it } from "@jest/globals"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  CONTRIBUTION_FILTER,
  EXTERNAL_CONTRIBUTIONS_SOURCE,
} from "../../config/quartz/externalContributions"
import {
  CONTRIBUTIONS_SNAPSHOT_PATH,
  renderContributions,
} from "../../quartz/plugins/transformers/externalContributions"
import {
  buildSnapshot,
  fetchSearchItems,
  landedAsCopy,
  SEARCH_RESULT_CAP,
  type SearchItem,
  searchQuery,
  statusOf,
  subjectOf,
  toContribution,
  writeSnapshot,
} from "../refresh_external_contributions"
import { fakeGitHub, Reply } from "./fakeGitHub"

function searchItem(overrides: Partial<SearchItem>): SearchItem {
  return {
    repository_url: "https://api.github.com/repos/owner/repo",
    number: 1,
    title: "Title",
    html_url: "https://github.com/owner/repo/issues/1",
    state: "closed",
    ...overrides,
  }
}

/** A JSON answer whose `link` header points at the next page. */
const pageWithNext = (body: unknown, next: string) =>
  new Reply(200, body, { link: `<${next}>; rel="next"` })

describe("searchQuery", () => {
  it("excludes every own account", () => {
    expect(searchQuery("me", ["me", "Me2"])).toBe("is:public author:me -user:me -user:Me2")
  })
})

describe("statusOf", () => {
  it.each<[string, Partial<SearchItem>, string]>([
    ["open PR", { state: "open", pull_request: { merged_at: null } }, "open"],
    ["open issue", { state: "open" }, "open"],
    ["merged PR", { pull_request: { merged_at: "2026-01-01T00:00:00Z" } }, "merged"],
    ["closed unmerged PR", { pull_request: { merged_at: null } }, "closed"],
    ["issue closed as completed", { state_reason: "completed" }, "fixed"],
    ["issue closed as not planned", { state_reason: "not_planned" }, "closed"],
    ["issue closed with no reason", { state_reason: null }, "closed"],
  ])("%s", (_name, overrides, status) => {
    expect(statusOf(searchItem(overrides))).toBe(status)
  })
})

describe("toContribution", () => {
  it("keeps only the fields the page renders", () => {
    expect(
      toContribution(searchItem({ number: 7, pull_request: { merged_at: "2026-01-01" } })),
    ).toEqual({
      repo: "owner/repo",
      number: 7,
      title: "Title",
      url: "https://github.com/owner/repo/issues/1",
      status: "merged",
    })
  })
})

describe("fetchSearchItems", () => {
  const items = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) =>
      searchItem({
        number: from + i,
        html_url: `https://github.com/owner/repo/issues/${from + i}`,
      }),
    )
  const page2 = "https://api.github.com/search/issues?q=author%3Ame&page=2"
  const search = (pages: Record<string, unknown>) =>
    fakeGitHub((url) => (url.searchParams.get("page") === "2" ? pages.second : pages.first))

  it("follows each next page, sorted by creation date, and drops a repeated item", async () => {
    const { github, urls } = search({
      first: pageWithNext({ total_count: 4, incomplete_results: false, items: items(1, 3) }, page2),
      second: { total_count: 4, incomplete_results: false, items: items(3, 2) },
    })
    const found = await fetchSearchItems("author:me", github)
    expect(found.map((item) => item.number)).toEqual([1, 2, 3, 4])
    expect(urls).toEqual([
      "https://api.github.com/search/issues?q=author%3Ame&sort=created&order=asc&per_page=100",
      page2,
    ])
  })

  it.each([
    [
      "incomplete search results",
      { total_count: 1, incomplete_results: true },
      "incomplete search results",
    ],
    [
      "more results than the search cap",
      { total_count: SEARCH_RESULT_CAP + 1, incomplete_results: false },
      `matched ${SEARCH_RESULT_CAP + 1} items`,
    ],
  ])("refuses %s", async (_name, page, message) => {
    const { github } = search({ first: { ...page, items: [] } })
    await expect(fetchSearchItems("author:me", github)).rejects.toThrow(message)
  })
})

describe("subjectOf", () => {
  it.each([
    ["the first line", "Fix the bug\n\nBody text", "Fix the bug"],
    ["a squash merge's PR suffix", "Fix the bug (#123)\n\nBody", "Fix the bug"],
    ["a mid-line PR mention", "Port (#12) to main", "Port (#12) to main"],
  ])("keeps %s", (_name, message, subject) => {
    expect(subjectOf(message)).toBe(subject)
  })
})

const API = "/repos/owner/repo"

function commit(
  sha: string,
  message: string,
  { email = "me@example.com", date = "2026-01-01T00:00:00Z", parents = 1 } = {},
) {
  return { sha, commit: { message, author: { email, date } }, parents: Array(parents).fill({}) }
}

/** A commit whose message mentions PR 7, and how GitHub answers for it. */
interface Referenced {
  url: string
  status: string | Reply
  commit: ReturnType<typeof commit> | Reply
}

type Pull = { user: { login: string } | null; merged_at: string | null }

/** GitHub as seen by `landedAsCopy`: each endpoint answers from the given state. */
function fakeRepo({
  prCommits = [commit("pr1", "Fix the bug")],
  authored = [] as ReturnType<typeof commit>[],
  referenced = [] as Referenced[],
  pulls = {} as Record<string, Pull[]>,
}) {
  return fakeGitHub(({ pathname }) => {
    const sha = (url: string) => url.split("/").pop()
    if (pathname === `${API}/pulls/7/commits`) return prCommits
    if (pathname === `${API}/commits`) return authored
    if (pathname === `${API}/issues/7/timeline`) {
      return [
        { event: "commented" },
        ...referenced.map(({ url }) => ({
          event: "referenced",
          commit_id: sha(url),
          commit_url: `https://api.github.com${url}`,
        })),
      ]
    }
    const compared = referenced.find(({ url }) => pathname === `${API}/compare/main...${sha(url)}`)
    if (compared)
      return compared.status instanceof Reply ? compared.status : { status: compared.status }
    const fetched = referenced.find(({ url }) => pathname === url)
    if (fetched) return fetched.commit
    const associated = new RegExp(`^${API}/commits/(\\w+)/pulls$`).exec(pathname)
    if (associated) return pulls[associated[1]] ?? []
    throw new Error(`Unexpected request ${pathname}`)
  })
}

/** A same-repo commit that mentions PR 7. */
function mention(
  sha: string,
  message: string,
  status: Referenced["status"] = "behind",
): Referenced {
  return { url: `${API}/commits/${sha}`, status, commit: commit(sha, message) }
}

describe("landedAsCopy", () => {
  const pr = searchItem({
    number: 7,
    title: "Fix the bug in full",
    pull_request: { merged_at: null },
  })
  const twoCommits = [commit("pr1", "Fix the bug"), commit("pr2", "Update README.md")]
  const mergedBy = (login: string) => [{ user: { login }, merged_at: "2026-02-01" }]

  it.each<[string, Parameters<typeof fakeRepo>[0], boolean]>([
    [
      "a maintainer's cherry-pick of the PR commit",
      {
        authored: [commit("pick", "Fix the bug\n\n(cherry picked from commit pr1)")],
        pulls: { pick: mergedBy("maintainer") },
      },
      true,
    ],
    [
      "a squash commit that mentions the PR and carries its title",
      { referenced: [mention("squash", "Fix the bug in full (#9)\n\nCloses #7")] },
      true,
    ],
    [
      "an authored commit titled like the PR",
      { authored: [commit("squash", "Fix the bug in full (#9)")] },
      false,
    ],
    [
      "a cherry-pick of another PR's commit with the same subject",
      { authored: [commit("pick", "Fix the bug", { date: "2026-01-05T00:00:00Z" })] },
      false,
    ],
    [
      "a copy of every PR commit, ignoring the PR's merge commits",
      {
        prCommits: [...twoCommits, commit("merge", "Merge branch 'main'", { parents: 2 })],
        authored: [commit("a", "Fix the bug"), commit("b", "Update README.md")],
      },
      true,
    ],
    [
      "a copy of only the PR's generic commit",
      { prCommits: twoCommits, authored: [commit("b", "Update README.md")] },
      false,
    ],
    ["a PR with only merge commits", { prCommits: [commit("m", "Merge", { parents: 2 })] }, false],
    [
      "the author's own merged resubmission",
      {
        referenced: [mention("resub", "Fix the bug in full (#8)\n\nSupersedes #7")],
        pulls: { resub: mergedBy("me") },
      },
      false,
    ],
    [
      "a copy beside the closed PR itself and a deleted user's merged PR",
      {
        authored: [commit("copy", "Fix the bug")],
        pulls: {
          copy: [
            { user: { login: "me" }, merged_at: null },
            { user: null, merged_at: "2026-02-01" },
          ],
        },
      },
      true,
    ],
    [
      "a resubmission from another own account",
      { authored: [commit("resub", "Fix the bug")], pulls: { resub: mergedBy("ME2") } },
      false,
    ],
    [
      "an unrelated commit by the same author",
      { authored: [commit("other", "Add a feature")] },
      false,
    ],
    [
      "a mentioning commit behind the default branch",
      { referenced: [mention("push", "Fix the bug")] },
      true,
    ],
    [
      "a mentioning commit at the default branch's tip",
      { referenced: [mention("push", "Fix the bug", "identical")] },
      true,
    ],
    ...(["diverged", "ahead"] as const).map(
      (status): [string, Parameters<typeof fakeRepo>[0], boolean] => [
        `a mentioning commit ${status} of the default branch`,
        { referenced: [mention("side", "Fix the bug", status)] },
        false,
      ],
    ),
    [
      "a mentioning commit with another subject",
      { referenced: [mention("revert", "Revert the bug fix")] },
      false,
    ],
    [
      "a garbage-collected mentioning commit",
      { referenced: [{ url: `${API}/commits/gone`, status: "behind", commit: new Reply(422) }] },
      false,
    ],
    [
      "a mentioning commit the compare cannot reach",
      { referenced: [mention("orphan", "Fix the bug", new Reply(404))] },
      false,
    ],
    [
      "a mentioning commit in a fork",
      {
        referenced: [
          {
            url: "/repos/fork/repo/commits/fork",
            status: "identical",
            commit: commit("fork", "Fix the bug"),
          },
        ],
      },
      false,
    ],
  ])("%s", async (_name, state, landed) => {
    expect(await landedAsCopy(pr, "main", ["me", "Me2"], fakeRepo(state).github)).toBe(landed)
  })

  it("queries each PR commit author on the default branch since the earliest PR commit", async () => {
    const { github, urls } = fakeRepo({
      prCommits: [
        commit("a", "One", { date: "2026-03-01T00:00:00Z" }),
        commit("b", "Two", { date: "2026-02-01T00:00:00-08:00" }),
        commit("c", "Three", { email: "bot@example.com" }),
      ],
    })
    await landedAsCopy(pr, "main", ["me"], github)
    const queries = urls
      .map((url) => new URL(url))
      .filter(({ pathname }) => pathname === `${API}/commits`)
      .map(({ searchParams }) => ["sha", "author", "since"].map((key) => searchParams.get(key)))
    expect(queries).toEqual([
      ["main", "me@example.com", "2026-01-01T00:00:00.000Z"],
      ["main", "bot@example.com", "2026-01-01T00:00:00.000Z"],
    ])
  })

  it("checks a commit found by author and by mention once", async () => {
    const { github, urls } = fakeRepo({
      authored: [commit("both", "Fix the bug")],
      referenced: [mention("both", "Fix the bug")],
    })
    expect(await landedAsCopy(pr, "main", ["me"], github)).toBe(true)
    expect(urls.filter((url) => url.includes("/commits/both/pulls"))).toHaveLength(1)
  })

  it("reads every page of the PR's commits", async () => {
    const page2 = `https://api.github.com${API}/pulls/7/commits?page=2`
    const { github, urls } = fakeGitHub(({ pathname, searchParams }) => {
      if (pathname !== `${API}/pulls/7/commits`) return []
      return searchParams.get("page") === "2"
        ? [commit("b", "Two")]
        : pageWithNext([commit("a", "One")], page2)
    })
    expect(await landedAsCopy(pr, "main", ["me"], github)).toBe(false)
    expect(urls).toContain(page2)
  })

  it("propagates an error other than a 404", async () => {
    const { github } = fakeRepo({ referenced: [mention("x", "Fix the bug", new Reply(401))] })
    await expect(landedAsCopy(pr, "main", ["me"], github)).rejects.toMatchObject({ status: 401 })
  })
})

describe("buildSnapshot", () => {
  it("sorts items by repo and number and fetches each repo's metadata once", async () => {
    const { github, urls } = fakeGitHub(({ pathname }) =>
      pathname.startsWith("/search/")
        ? {
            total_count: 3,
            incomplete_results: false,
            items: [
              searchItem({
                repository_url: "https://api.github.com/repos/b/z",
                number: 2,
                html_url: "u2",
              }),
              searchItem({
                repository_url: "https://api.github.com/repos/a/y",
                number: 5,
                html_url: "u5",
              }),
              searchItem({
                repository_url: "https://api.github.com/repos/b/z",
                number: 1,
                html_url: "u1",
              }),
            ],
          }
        : {
            stargazers_count: pathname.endsWith("a/y") ? 10 : 20,
            owner: { type: "Organization" },
            default_branch: "main",
          },
    )
    const snapshot = await buildSnapshot(github)
    expect(snapshot.items.map((item) => `${item.repo}#${item.number}`)).toEqual([
      "a/y#5",
      "b/z#1",
      "b/z#2",
    ])
    expect(snapshot.repos).toEqual({
      "a/y": { stars: 10, ownerType: "Organization" },
      "b/z": { stars: 20, ownerType: "Organization" },
    })
    expect(urls.filter((url) => url.includes("/repos/"))).toEqual([
      "https://api.github.com/repos/a/y",
      "https://api.github.com/repos/b/z",
    ])
  })

  it("marks a closed PR merged when its copy landed on the repo's default branch", async () => {
    const closedPr = (number: number, title: string) =>
      searchItem({
        number,
        title,
        html_url: `https://github.com/owner/repo/pull/${number}`,
        pull_request: { merged_at: null },
      })
    const { github, urls } = fakeGitHub(({ pathname }) => {
      if (pathname.startsWith("/search/")) {
        return {
          total_count: 3,
          incomplete_results: false,
          items: [closedPr(1, "Landed"), closedPr(2, "Dropped"), searchItem({ number: 3 })],
        }
      }
      if (pathname === API) {
        return { stargazers_count: 5, owner: { type: "User" }, default_branch: "develop" }
      }
      if (pathname === `${API}/pulls/1/commits`) return [commit("pr1", "Landed")]
      if (pathname === `${API}/pulls/2/commits`) return [commit("pr2", "Dropped")]
      if (pathname === `${API}/commits`) return [commit("copy", "Landed")]
      return []
    })
    const snapshot = await buildSnapshot(github)
    expect(snapshot.items.map((item) => [item.number, item.status])).toEqual([
      [1, "merged"],
      [2, "closed"],
      [3, "closed"],
    ])
    expect(urls.some((url) => url.includes("/commits?sha=develop&"))).toBe(true)
    expect(urls.some((url) => url.includes("/issues/3/"))).toBe(false)
  })
})

describe("writeSnapshot", () => {
  const renderable = {
    items: [
      {
        repo: "a/b",
        number: 1,
        title: "T",
        url: "https://github.com/a/b/pull/1",
        status: "merged" as const,
      },
    ],
    repos: { "a/b": { stars: 500, ownerType: "User" } },
  }

  // The page's real annotations name contributions this fixture lacks.
  const render = (snapshotJson: string): string =>
    renderContributions(snapshotJson, CONTRIBUTION_FILTER, new Map())

  function tempFile(): string {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "contributions-")), "snapshot.json")
  }

  it("writes a changed snapshot and leaves an identical one alone", () => {
    const file = tempFile()
    expect(writeSnapshot(renderable, file, render)).toBe(true)
    expect(fs.readFileSync(file, "utf-8")).toBe(`${JSON.stringify(renderable, null, 2)}\n`)
    expect(writeSnapshot(renderable, file, render)).toBe(false)
    const starred = { ...renderable, repos: { "a/b": { stars: 501, ownerType: "User" } } }
    expect(writeSnapshot(starred, file, render)).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true })
  })

  it("validates against the page's annotations by default", () => {
    const file = tempFile()
    expect(() => writeSnapshot(renderable, file)).toThrow("match no listed contribution")
    expect(fs.existsSync(file)).toBe(false)
    fs.rmSync(path.dirname(file), { recursive: true })
  })

  it("refuses a snapshot the page cannot render and keeps the old file", () => {
    const file = tempFile()
    writeSnapshot(renderable, file, render)
    const before = fs.readFileSync(file, "utf-8")
    expect(() => writeSnapshot({ items: [], repos: {} }, file, render)).toThrow(
      "No external contributions pass the filter",
    )
    expect(fs.readFileSync(file, "utf-8")).toBe(before)
    fs.rmSync(path.dirname(file), { recursive: true })
  })
})

describe("committed snapshot", () => {
  it("renders through the configured page source", () => {
    const { transform } = EXTERNAL_CONTRIBUTIONS_SOURCE
    const rendered = transform?.(fs.readFileSync(CONTRIBUTIONS_SNAPSHOT_PATH, "utf-8"))
    expect(rendered).toMatch(/^This list refreshes daily from GitHub\./)
    expect(rendered).toContain('<div class="contribution-list">')
    expect(rendered).toContain("\n\n  The issue had been reported repeatedly")
  })
})
