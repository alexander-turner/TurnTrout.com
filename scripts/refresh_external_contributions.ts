/**
 * Re-fetches my pull requests and issues on other people's repositories, plus
 * each repo's star count and owner type, and rewrites the committed snapshot
 * the build renders on /open-source. A closed pull request counts as merged
 * when a maintainer landed its work through their own commits. A failed fetch
 * leaves the last-known-good snapshot in place.
 *
 * Usage: npx tsx scripts/refresh_external_contributions.ts
 * Set GITHUB_TOKEN to raise the API rate limit.
 */
import fs from "node:fs"

import {
  CONTRIBUTIONS_AUTHOR,
  OWN_ACCOUNTS,
  renderContributionsSection,
} from "../config/quartz/externalContributions"
import {
  type Contribution,
  CONTRIBUTIONS_SNAPSHOT_PATH,
  type ContributionsSnapshot,
  type ContributionStatus,
  type RepoMeta,
} from "../quartz/plugins/transformers/externalContributions"
import { type FetchDeps, fetchGitHub, NotFoundError } from "./refresh_readme_snapshots"

const JSON_ACCEPT = "application/vnd.github+json"
export const PER_PAGE = 100
/** GitHub's search API returns at most this many results for one query. */
export const SEARCH_RESULT_CAP = 1000

/** The fields of a search-API issue or pull request that the snapshot keeps. */
export interface SearchItem {
  repository_url: string
  number: number
  title: string
  html_url: string
  created_at: string
  state: "open" | "closed"
  state_reason?: string | null
  pull_request?: { merged_at: string | null }
}

interface SearchPage {
  total_count: number
  incomplete_results: boolean
  items: SearchItem[]
}

/** Search query for items the author opened on public repos they do not own. */
export function searchQuery(author: string, ownAccounts: readonly string[]): string {
  return [
    "is:public",
    `author:${author}`,
    ...ownAccounts.map((account) => `-user:${account}`),
  ].join(" ")
}

/** Classifies a search item: merged PR, fixed issue, open, or closed without either. */
export function statusOf(item: SearchItem): ContributionStatus {
  if (item.state === "open") return "open"
  if (item.pull_request) return item.pull_request.merged_at ? "merged" : "closed"
  return item.state_reason === "completed" ? "fixed" : "closed"
}

/** The `owner/repo` a search item belongs to. */
export function repoOf(item: SearchItem): string {
  return item.repository_url.replace("https://api.github.com/repos/", "")
}

export function toContribution(item: SearchItem): Contribution {
  return {
    repo: repoOf(item),
    number: item.number,
    title: item.title,
    url: item.html_url,
    status: statusOf(item),
  }
}

/**
 * Fetches every search page, sorted by creation date so pages stay stable
 * between requests, and drops any item a shifted page repeated. An incomplete
 * page means GitHub timed out, and a result set past the search cap cannot be
 * fetched whole, so both fail.
 */
export async function fetchSearchItems(query: string, deps: FetchDeps): Promise<SearchItem[]> {
  const items = new Map<string, SearchItem>()
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=asc&per_page=${PER_PAGE}&page=${page}`
    const body = JSON.parse(await fetchGitHub(url, JSON_ACCEPT, deps)) as SearchPage
    if (body.incomplete_results) {
      throw new Error(`GitHub returned incomplete search results for page ${page}`)
    }
    if (body.total_count > SEARCH_RESULT_CAP) {
      throw new Error(
        `The search matched ${body.total_count} items, past GitHub's cap of ${SEARCH_RESULT_CAP}`,
      )
    }
    for (const item of body.items) items.set(item.html_url, item)
    if (body.items.length < PER_PAGE || page * PER_PAGE >= body.total_count) {
      return [...items.values()]
    }
  }
}

interface RepoInfo {
  meta: RepoMeta
  defaultBranch: string
}

export async function fetchRepo(repo: string, deps: FetchDeps): Promise<RepoInfo> {
  const body = JSON.parse(
    await fetchGitHub(`https://api.github.com/repos/${repo}`, JSON_ACCEPT, deps),
  ) as { stargazers_count: number; owner: { type: string }; default_branch: string }
  return {
    meta: { stars: body.stargazers_count, ownerType: body.owner.type },
    defaultBranch: body.default_branch,
  }
}

/** The fields of a REST commit object that the copy check reads. */
export interface CommitItem {
  sha: string
  commit: { message: string; author: { email: string; date: string } }
  parents: readonly unknown[]
}

/** A pull request GitHub associates with a commit. */
interface AssociatedPull {
  user: { login: string } | null
  merged_at: string | null
}

/** Fetches every page of a REST list endpoint. */
async function fetchAllPages<T>(url: string, deps: FetchDeps): Promise<T[]> {
  const separator = url.includes("?") ? "&" : "?"
  const items: T[] = []
  for (let page = 1; ; page++) {
    const pageUrl = `${url}${separator}per_page=${PER_PAGE}&page=${page}`
    const body = JSON.parse(await fetchGitHub(pageUrl, JSON_ACCEPT, deps)) as T[]
    items.push(...body)
    if (body.length < PER_PAGE) return items
  }
}

/** Parses a GitHub API URL's JSON body, or returns undefined when it answers 404. */
async function fetchJsonIfFound<T>(url: string, deps: FetchDeps): Promise<T | undefined> {
  try {
    return JSON.parse(await fetchGitHub(url, JSON_ACCEPT, deps)) as T
  } catch (error) {
    if (error instanceof NotFoundError) return undefined
    throw error
  }
}

/** A commit message's first line, without the ` (#123)` suffix a squash merge appends. */
export function subjectOf(message: string): string {
  return message
    .split("\n", 1)[0]
    .replace(/ \(#\d+\)$/, "")
    .trim()
}

/** A commit's subject and author date, which a cherry-pick or rebase keeps. */
function authorshipKey(commit: CommitItem): string {
  return `${subjectOf(commit.commit.message)}\n${Date.parse(commit.commit.author.date)}`
}

/**
 * Default-branch commits that may carry a closed pull request's work. A commit
 * by one of its commit authors counts when its subject and author date equal
 * a PR commit's, so another PR with the same subject never matches. A commit
 * whose message mentions the PR (a `referenced` timeline event) counts when
 * its subject is in `subjects`.
 */
async function candidateCommits(
  pr: SearchItem,
  api: string,
  defaultBranch: string,
  prCommits: readonly CommitItem[],
  subjects: ReadonlySet<string>,
  deps: FetchDeps,
): Promise<CommitItem[]> {
  const candidates = new Map<string, CommitItem>()
  const authorships = new Set(prCommits.map(authorshipKey))
  const since = new Date(
    Math.min(...prCommits.map((commit) => Date.parse(commit.commit.author.date))),
  ).toISOString()
  for (const email of new Set(prCommits.map((commit) => commit.commit.author.email))) {
    const query = `sha=${encodeURIComponent(defaultBranch)}&author=${encodeURIComponent(email)}&since=${since}`
    for (const commit of await fetchAllPages<CommitItem>(`${api}/commits?${query}`, deps)) {
      if (authorships.has(authorshipKey(commit))) candidates.set(commit.sha, commit)
    }
  }
  const timeline = await fetchAllPages<{ event: string; commit_url?: string | null }>(
    `${api}/issues/${pr.number}/timeline`,
    deps,
  )
  for (const event of timeline) {
    // A commit in a fork also references the pull request, but never lands here.
    if (event.event !== "referenced" || !event.commit_url?.startsWith(`${api}/commits/`)) continue
    // A commit on a deleted branch can be garbage-collected, so it answers 404.
    const commit = await fetchJsonIfFound<CommitItem>(event.commit_url, deps)
    if (!commit || !subjects.has(subjectOf(commit.commit.message))) continue
    const comparison = await fetchJsonIfFound<{ status: string }>(
      `${api}/compare/${defaultBranch}...${commit.sha}`,
      deps,
    )
    if (comparison?.status === "behind" || comparison?.status === "identical") {
      candidates.set(commit.sha, commit)
    }
  }
  return [...candidates.values()]
}

/**
 * True when a maintainer landed a closed, unmerged pull request's work on the
 * default branch through their own commits, by cherry-picking it into their
 * own pull request or pushing it directly. Either a landed commit that
 * mentions the pull request carries its title, as a squash does, or every
 * subject of its non-merge commits landed; one generic subject such as
 * "Update README.md" alone never counts. A commit from a merged pull request by one of `ownAccounts` is a
 * resubmission the snapshot already lists, so it does not count.
 */
export async function landedAsCopy(
  pr: SearchItem,
  defaultBranch: string,
  ownAccounts: readonly string[],
  deps: FetchDeps,
): Promise<boolean> {
  const api = `https://api.github.com/repos/${repoOf(pr)}`
  const prCommits = (
    await fetchAllPages<CommitItem>(`${api}/pulls/${pr.number}/commits`, deps)
  ).filter((commit) => commit.parents.length === 1)
  if (prCommits.length === 0) return false
  const title = subjectOf(pr.title)
  const commitSubjects = new Set(prCommits.map((commit) => subjectOf(commit.commit.message)))
  const own = new Set(ownAccounts.map((account) => account.toLowerCase()))
  const landed = new Set<string>()
  const candidates = await candidateCommits(
    pr,
    api,
    defaultBranch,
    prCommits,
    new Set([title, ...commitSubjects]),
    deps,
  )
  for (const candidate of candidates) {
    const pulls = await fetchAllPages<AssociatedPull>(`${api}/commits/${candidate.sha}/pulls`, deps)
    const resubmitted = pulls.some(
      (pull) => pull.merged_at !== null && own.has(pull.user?.login.toLowerCase() ?? ""),
    )
    if (!resubmitted) landed.add(subjectOf(candidate.commit.message))
  }
  return landed.has(title) || [...commitSubjects].every((subject) => landed.has(subject))
}

/** Builds a snapshot sorted by repo and number, so an unchanged world serializes identically. */
export async function buildSnapshot(deps: FetchDeps): Promise<ContributionsSnapshot> {
  const found = await fetchSearchItems(searchQuery(CONTRIBUTIONS_AUTHOR, OWN_ACCOUNTS), deps)
  const repoNames = [...new Set(found.map(repoOf))].sort((a, b) => a.localeCompare(b))
  const items: Contribution[] = []
  const repos: Record<string, RepoMeta> = {}
  for (const repo of repoNames) {
    const { meta, defaultBranch } = await fetchRepo(repo, deps)
    repos[repo] = meta
    for (const item of found.filter((candidate) => repoOf(candidate) === repo)) {
      const contribution = toContribution(item)
      const landed =
        contribution.status === "closed" &&
        item.pull_request !== undefined &&
        (await landedAsCopy(item, defaultBranch, OWN_ACCOUNTS, deps))
      items.push(landed ? { ...contribution, status: "merged" } : contribution)
    }
  }
  items.sort((a, b) => a.repo.localeCompare(b.repo) || a.number - b.number)
  return { items, repos }
}

/**
 * Writes the snapshot when its content changed, and returns whether it wrote.
 * It first renders the snapshot as the page will, so a snapshot that would
 * fail the build is refused and the last-known-good file stays in place.
 */
export function writeSnapshot(
  snapshot: ContributionsSnapshot,
  snapshotPath: string,
  render: (snapshotJson: string) => string = renderContributionsSection,
): boolean {
  const content = `${JSON.stringify(snapshot, null, 2)}\n`
  render(content)
  if (fs.existsSync(snapshotPath) && fs.readFileSync(snapshotPath, "utf-8") === content) {
    return false
  }
  fs.writeFileSync(snapshotPath, content, "utf-8")
  return true
}

// istanbul ignore next - CLI entrypoint
async function main(): Promise<void> {
  const snapshot = await buildSnapshot({})
  const wrote = writeSnapshot(snapshot, CONTRIBUTIONS_SNAPSHOT_PATH)
  console.log(
    `${wrote ? "✓ wrote" : "= unchanged"} ${CONTRIBUTIONS_SNAPSHOT_PATH} (${snapshot.items.length} items)`,
  )
}

// istanbul ignore next - CLI entrypoint
if (process.argv[1]?.endsWith("refresh_external_contributions.ts")) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
