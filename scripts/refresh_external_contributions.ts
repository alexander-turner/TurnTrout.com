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
import { type GitHub, gitHubClient, ifFound } from "./github_client"

export const PER_PAGE = 100
/** GitHub's search API returns at most this many results for one query. */
export const SEARCH_RESULT_CAP = 1000

/** The fields of a search-API issue or pull request that the snapshot keeps. */
export interface SearchItem {
  repository_url: string
  number: number
  title: string
  html_url: string
  state: string
  state_reason?: string | null
  pull_request?: { merged_at?: string | null }
}

/** The fields of a REST commit object that the copy check reads. */
interface Commit {
  sha: string
  commit: { message: string; author: { email?: string; date?: string } | null }
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
export async function fetchSearchItems(query: string, github: GitHub): Promise<SearchItem[]> {
  const items = new Map<string, SearchItem>()
  const pages = github.paginate.iterator(github.rest.search.issuesAndPullRequests, {
    q: query,
    sort: "created",
    order: "asc",
    per_page: PER_PAGE,
  })
  for await (const { data } of pages) {
    const page = data as typeof data & { incomplete_results: boolean; total_count: number }
    if (page.incomplete_results) throw new Error("GitHub returned incomplete search results")
    if (page.total_count > SEARCH_RESULT_CAP) {
      throw new Error(
        `The search matched ${page.total_count} items, past GitHub's cap of ${SEARCH_RESULT_CAP}`,
      )
    }
    for (const item of page) items.set(item.html_url, item)
  }
  return [...items.values()]
}

/** A commit message's first line, without the ` (#123)` suffix a squash merge appends. */
export function subjectOf(message: string): string {
  return message
    .split("\n", 1)[0]
    .replace(/ \(#\d+\)$/, "")
    .trim()
}

/** A commit's git author, which the API types as optional but git always records. */
export function gitAuthor({ sha, commit }: Commit) {
  if (!commit.author?.email || !commit.author.date) {
    throw new Error(`GitHub reported no author for commit ${sha}`)
  }
  return { email: commit.author.email, date: Date.parse(commit.author.date) }
}

/** A commit's subject and author date, which a cherry-pick or rebase keeps. */
function authorshipKey(commit: Commit): string {
  return `${subjectOf(commit.commit.message)}\n${gitAuthor(commit).date}`
}

/**
 * Default-branch commits that may carry a closed pull request's work. A commit
 * by one of its commit authors counts when its subject and author date equal
 * a PR commit's, so another PR with the same subject never matches. A commit
 * whose message mentions the PR (a `referenced` timeline event) counts when
 * its subject is in `subjects`.
 */
async function candidateCommits(
  repo: { owner: string; repo: string },
  pr: SearchItem,
  defaultBranch: string,
  prCommits: readonly Commit[],
  subjects: ReadonlySet<string>,
  github: GitHub,
): Promise<Commit[]> {
  const candidates = new Map<string, Commit>()
  const authorships = new Set(prCommits.map(authorshipKey))
  const authors = prCommits.map(gitAuthor)
  const since = new Date(Math.min(...authors.map((author) => author.date))).toISOString()
  for (const email of new Set(authors.map((author) => author.email))) {
    const authored = await github.paginate(github.rest.repos.listCommits, {
      ...repo,
      sha: defaultBranch,
      author: email,
      since,
      per_page: PER_PAGE,
    })
    for (const commit of authored) {
      if (authorships.has(authorshipKey(commit))) candidates.set(commit.sha, commit)
    }
  }
  const timeline = await github.paginate(github.rest.issues.listEventsForTimeline, {
    ...repo,
    issue_number: pr.number,
    per_page: PER_PAGE,
  })
  const repoApi = `https://api.github.com/repos/${repo.owner}/${repo.repo}/`
  for (const event of timeline) {
    // A commit in a fork also references the pull request, but never lands here.
    if (event.event !== "referenced" || !("commit_url" in event)) continue
    if (!event.commit_id || !event.commit_url?.startsWith(repoApi)) continue
    // A commit on a deleted branch can be garbage-collected, so it may no longer exist.
    const commit = await ifFound(github.rest.repos.getCommit({ ...repo, ref: event.commit_id }))
    if (!commit || !subjects.has(subjectOf(commit.data.commit.message))) continue
    const comparison = await ifFound(
      github.rest.repos.compareCommits({ ...repo, base: defaultBranch, head: commit.data.sha }),
    )
    const status = comparison?.data.status
    if (status === "behind" || status === "identical") candidates.set(commit.data.sha, commit.data)
  }
  return [...candidates.values()]
}

/**
 * True when a maintainer landed a closed, unmerged pull request's work on the
 * default branch through their own commits, by cherry-picking it into their
 * own pull request or pushing it directly. Either a landed commit that
 * mentions the pull request carries its title, as a squash does, or every
 * subject of its non-merge commits landed; one generic subject such as
 * "Update README.md" alone never counts. A commit from a merged pull request
 * by one of `ownAccounts` is a resubmission the snapshot already lists, so it
 * does not count.
 */
export async function landedAsCopy(
  pr: SearchItem,
  defaultBranch: string,
  ownAccounts: readonly string[],
  github: GitHub,
): Promise<boolean> {
  const [owner, name] = repoOf(pr).split("/")
  const repo = { owner, repo: name }
  const prCommits = (
    await github.paginate(github.rest.pulls.listCommits, {
      ...repo,
      pull_number: pr.number,
      per_page: PER_PAGE,
    })
  ).filter((commit) => commit.parents.length === 1)
  if (prCommits.length === 0) return false
  const title = subjectOf(pr.title)
  const commitSubjects = new Set(prCommits.map((commit) => subjectOf(commit.commit.message)))
  const own = new Set(ownAccounts.map((account) => account.toLowerCase()))
  const landed = new Set<string>()
  const candidates = await candidateCommits(
    repo,
    pr,
    defaultBranch,
    prCommits,
    new Set([title, ...commitSubjects]),
    github,
  )
  for (const candidate of candidates) {
    const pulls = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
      ...repo,
      commit_sha: candidate.sha,
      per_page: PER_PAGE,
    })
    const resubmitted = pulls.some(
      (pull) => pull.merged_at && own.has(pull.user?.login.toLowerCase() ?? ""),
    )
    if (!resubmitted) landed.add(subjectOf(candidate.commit.message))
  }
  return landed.has(title) || [...commitSubjects].every((subject) => landed.has(subject))
}

/** Builds a snapshot sorted by repo and number, so an unchanged world serializes identically. */
export async function buildSnapshot(github: GitHub): Promise<ContributionsSnapshot> {
  const found = await fetchSearchItems(searchQuery(CONTRIBUTIONS_AUTHOR, OWN_ACCOUNTS), github)
  const repoNames = [...new Set(found.map(repoOf))].sort((a, b) => a.localeCompare(b))
  const items: Contribution[] = []
  const repos: Record<string, RepoMeta> = {}
  for (const repoName of repoNames) {
    const [owner, repo] = repoName.split("/")
    const { data } = await github.rest.repos.get({ owner, repo })
    repos[repoName] = { stars: data.stargazers_count, ownerType: data.owner.type }
    for (const item of found.filter((candidate) => repoOf(candidate) === repoName)) {
      const contribution = toContribution(item)
      const landed =
        contribution.status === "closed" &&
        item.pull_request !== undefined &&
        (await landedAsCopy(item, data.default_branch, OWN_ACCOUNTS, github))
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
  const snapshot = await buildSnapshot(gitHubClient())
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
