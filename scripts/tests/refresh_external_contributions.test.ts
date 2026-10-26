import { describe, expect, it, jest } from "@jest/globals"
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
  type CommitItem,
  fetchSearchItems,
  landedAsCopy,
  PER_PAGE,
  SEARCH_RESULT_CAP,
  type SearchItem,
  searchQuery,
  statusOf,
  subjectOf,
  toContribution,
  writeSnapshot,
} from "../refresh_external_contributions"

function searchItem(overrides: Partial<SearchItem>): SearchItem {
  return {
    repository_url: "https://api.github.com/repos/owner/repo",
    number: 1,
    title: "Title",
    html_url: "https://github.com/owner/repo/issues/1",
    created_at: "2026-01-01T00:00:00Z",
    state: "closed",
    ...overrides,
  }
}

/** A `fetch` that answers each URL from a table and records every URL it served. */
function fakeFetch(routes: (url: string) => unknown) {
  const urls: string[] = []
  const fetchFn = jest.fn((input: string | URL | Request) => {
    const url = String(input)
    urls.push(url)
    return Promise.resolve(new Response(JSON.stringify(routes(url)), { status: 200 }))
  }) as unknown as typeof fetch
  return { fetchFn, urls, deps: { fetchFn, sleepFn: () => Promise.resolve(), token: "" } }
}

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
  const pageUrl = (page: number) =>
    `https://api.github.com/search/issues?q=author%3Ame&sort=created&order=asc&per_page=${PER_PAGE}&page=${page}`
  const fullPage = Array.from({ length: PER_PAGE }, (_, i) =>
    searchItem({ number: i, html_url: `https://github.com/owner/repo/issues/${i}` }),
  )

  it("follows pages until one comes back short", async () => {
    const { deps, urls } = fakeFetch((url) => ({
      total_count: PER_PAGE + 1,
      incomplete_results: false,
      items: url.endsWith("page=1")
        ? fullPage
        : [searchItem({ number: 999, html_url: "https://github.com/owner/repo/issues/999" })],
    }))
    expect(await fetchSearchItems("author:me", deps)).toHaveLength(PER_PAGE + 1)
    expect(urls).toEqual([pageUrl(1), pageUrl(2)])
  })

  it("stops after the last full page when the total is an exact multiple", async () => {
    const { deps, urls } = fakeFetch(() => ({
      total_count: PER_PAGE,
      incomplete_results: false,
      items: fullPage,
    }))
    expect(await fetchSearchItems("author:me", deps)).toHaveLength(PER_PAGE)
    expect(urls).toEqual([pageUrl(1)])
  })

  it("drops an item that a shifted page repeats", async () => {
    const { deps } = fakeFetch((url) => ({
      total_count: PER_PAGE + 1,
      incomplete_results: false,
      items: url.endsWith("page=1") ? fullPage : [fullPage[PER_PAGE - 1]],
    }))
    expect(await fetchSearchItems("author:me", deps)).toHaveLength(PER_PAGE)
  })

  it.each([
    [
      "incomplete search results",
      { total_count: 1, incomplete_results: true },
      "incomplete search results for page 1",
    ],
    [
      "more results than the search cap",
      { total_count: SEARCH_RESULT_CAP + 1, incomplete_results: false },
      `matched ${SEARCH_RESULT_CAP + 1} items`,
    ],
  ])("refuses %s", async (_name, page, message) => {
    const { deps } = fakeFetch(() => ({ ...page, items: [] }))
    await expect(fetchSearchItems("author:me", deps)).rejects.toThrow(message)
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

const API = "https://api.github.com/repos/owner/repo"

function commit(sha: string, message: string, email = "me@example.com"): CommitItem {
  return { sha, commit: { message, author: { email } } }
}

/** GitHub as seen by `landedAsCopy`: each endpoint answers from the given state. */
function fakeRepo({
  prCommits = [commit("pr1", "Fix the bug")],
  authored = [] as CommitItem[],
  referenced = [] as { url: string; status: string; commit: CommitItem }[],
  pulls = {} as Record<
    string,
    { number: number; user: { login: string }; merged_at: string | null }[]
  >,
}) {
  return fakeFetch((url) => {
    const path = url.replace(API, "").replace(/[?&]per_page=\d+&page=\d+$/, "")
    if (path === "/pulls/7/commits") return prCommits
    if (path.startsWith("/commits?")) return authored
    if (path === "/issues/7/timeline") {
      return [
        { event: "commented" },
        ...referenced.map(({ url }) => ({ event: "referenced", commit_url: url })),
      ]
    }
    const compared = referenced.find(
      ({ url }) => path === `/compare/main...${url.split("/").pop()}`,
    )
    if (compared) return { status: compared.status }
    const fetched = referenced.find(({ url: commitUrl }) => url === commitUrl)
    if (fetched) return fetched.commit
    const associated = /^\/commits\/(\w+)\/pulls$/.exec(path)
    if (associated) return pulls[associated[1]] ?? []
    throw new Error(`Unexpected URL ${url}`)
  })
}

describe("landedAsCopy", () => {
  const pr = searchItem({
    number: 7,
    title: "Fix the bug in full",
    pull_request: { merged_at: null },
  })

  it.each<[string, Parameters<typeof fakeRepo>[0], boolean]>([
    [
      "a maintainer's cherry-pick of a PR commit",
      {
        authored: [commit("pick", "Fix the bug\n\n(cherry picked from commit pr1)")],
        pulls: { pick: [{ number: 9, user: { login: "maintainer" }, merged_at: "2026-02-01" }] },
      },
      true,
    ],
    [
      "a squash commit titled like the PR",
      { authored: [commit("squash", "Fix the bug in full (#9)")] },
      true,
    ],
    [
      "a direct push that rewrote the author but mentions the PR",
      {
        referenced: [
          {
            url: `${API}/commits/push`,
            status: "behind",
            commit: commit("push", "Fix the bug\n\nBased on PR #7", "other@example.com"),
          },
        ],
      },
      true,
    ],
    [
      "the author's own merged resubmission",
      {
        authored: [commit("resub", "Fix the bug in full (#8)")],
        pulls: { resub: [{ number: 8, user: { login: "me" }, merged_at: "2026-02-01" }] },
      },
      false,
    ],
    [
      "an unrelated commit by the same author",
      { authored: [commit("other", "Add a feature")] },
      false,
    ],
    [
      "a mentioning commit that never reached the default branch",
      {
        referenced: [
          { url: `${API}/commits/side`, status: "diverged", commit: commit("side", "Fix the bug") },
        ],
      },
      false,
    ],
    [
      "a mentioning commit in a fork",
      {
        referenced: [
          {
            url: "https://api.github.com/repos/fork/repo/commits/fork",
            status: "identical",
            commit: commit("fork", "Fix the bug"),
          },
        ],
      },
      false,
    ],
  ])("%s", async (_name, state, landed) => {
    expect(await landedAsCopy(pr, "main", "me", fakeRepo(state).deps)).toBe(landed)
  })

  it("queries the default branch for each PR commit author since the PR opened", async () => {
    const { deps, urls } = fakeRepo({
      prCommits: [commit("a", "One"), commit("b", "Two"), commit("c", "Three", "bot@example.com")],
    })
    await landedAsCopy(pr, "main", "me", deps)
    expect(urls.filter((url) => url.startsWith(`${API}/commits?`))).toEqual(
      ["me%40example.com", "bot%40example.com"].map(
        (email) =>
          `${API}/commits?sha=main&author=${email}&since=2026-01-01T00:00:00Z&per_page=${PER_PAGE}&page=1`,
      ),
    )
  })

  it("follows every page of a list endpoint", async () => {
    const fullPage = Array.from({ length: PER_PAGE }, (_, i) => commit(`c${i}`, `Commit ${i}`))
    const { deps, urls } = fakeFetch((url) => {
      if (url.includes("/pulls/7/commits")) return url.endsWith("page=1") ? fullPage : []
      return []
    })
    expect(await landedAsCopy(pr, "main", "me", deps)).toBe(false)
    expect(urls.filter((url) => url.includes("/pulls/7/commits"))).toHaveLength(2)
  })
})

describe("buildSnapshot", () => {
  it("sorts items by repo and number and fetches each repo's metadata once", async () => {
    const { deps, urls } = fakeFetch((url) =>
      url.includes("/search/")
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
            stargazers_count: url.endsWith("a/y") ? 10 : 20,
            owner: { type: "Organization" },
            default_branch: "main",
          },
    )
    const snapshot = await buildSnapshot(deps)
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
    const { deps, urls } = fakeFetch((url) => {
      if (url.includes("/search/")) {
        return {
          total_count: 3,
          incomplete_results: false,
          items: [closedPr(1, "Landed"), closedPr(2, "Dropped"), searchItem({ number: 3 })],
        }
      }
      if (url === API) {
        return { stargazers_count: 5, owner: { type: "User" }, default_branch: "develop" }
      }
      if (url.includes("/pulls/1/commits")) return [commit("pr1", "Landed")]
      if (url.includes("/pulls/2/commits")) return [commit("pr2", "Dropped")]
      if (url.includes("/commits?sha=")) return [commit("copy", "Landed")]
      return []
    })
    const snapshot = await buildSnapshot(deps)
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
