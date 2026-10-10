import { describe, expect, it, jest } from "@jest/globals"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { EXTERNAL_CONTRIBUTIONS_SOURCE } from "../../config/quartz/externalContributions"
import { CONTRIBUTIONS_SNAPSHOT_PATH } from "../../quartz/plugins/transformers/externalContributions"
import {
  buildSnapshot,
  fetchContributions,
  PER_PAGE,
  SEARCH_RESULT_CAP,
  type SearchItem,
  searchQuery,
  statusOf,
  toContribution,
  writeSnapshot,
} from "../refresh_external_contributions"

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
      isPr: true,
      status: "merged",
    })
  })
})

describe("fetchContributions", () => {
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
    expect(await fetchContributions("author:me", deps)).toHaveLength(PER_PAGE + 1)
    expect(urls).toEqual([pageUrl(1), pageUrl(2)])
  })

  it("stops after the last full page when the total is an exact multiple", async () => {
    const { deps, urls } = fakeFetch(() => ({
      total_count: PER_PAGE,
      incomplete_results: false,
      items: fullPage,
    }))
    expect(await fetchContributions("author:me", deps)).toHaveLength(PER_PAGE)
    expect(urls).toEqual([pageUrl(1)])
  })

  it("drops an item that a shifted page repeats", async () => {
    const { deps } = fakeFetch((url) => ({
      total_count: PER_PAGE + 1,
      incomplete_results: false,
      items: url.endsWith("page=1") ? fullPage : [fullPage[PER_PAGE - 1]],
    }))
    expect(await fetchContributions("author:me", deps)).toHaveLength(PER_PAGE)
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
    await expect(fetchContributions("author:me", deps)).rejects.toThrow(message)
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
        : { stargazers_count: url.endsWith("a/y") ? 10 : 20, owner: { type: "Organization" } },
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
})

describe("writeSnapshot", () => {
  const renderable = {
    items: [
      {
        repo: "a/b",
        number: 1,
        title: "T",
        url: "https://github.com/a/b/pull/1",
        isPr: true,
        status: "merged" as const,
      },
    ],
    repos: { "a/b": { stars: 500, ownerType: "User" } },
  }

  function tempFile(): string {
    return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "contributions-")), "snapshot.json")
  }

  it("writes a changed snapshot and leaves an identical one alone", () => {
    const file = tempFile()
    expect(writeSnapshot(renderable, file)).toBe(true)
    expect(fs.readFileSync(file, "utf-8")).toBe(`${JSON.stringify(renderable, null, 2)}\n`)
    expect(writeSnapshot(renderable, file)).toBe(false)
    const starred = { ...renderable, repos: { "a/b": { stars: 501, ownerType: "User" } } }
    expect(writeSnapshot(starred, file)).toBe(true)
    fs.rmSync(path.dirname(file), { recursive: true })
  })

  it("refuses a snapshot the page cannot render and keeps the old file", () => {
    const file = tempFile()
    writeSnapshot(renderable, file)
    const before = fs.readFileSync(file, "utf-8")
    expect(() => writeSnapshot({ items: [], repos: {} }, file)).toThrow(
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
    expect(rendered).toContain('<dl class="external-contributions no-formatting">')
  })
})
