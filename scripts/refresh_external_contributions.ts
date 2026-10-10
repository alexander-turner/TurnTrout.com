/**
 * Re-fetches my pull requests and issues on other people's repositories, plus
 * each repo's star count and owner type, and rewrites the committed snapshot
 * the build renders on /open-source. A failed fetch leaves the last-known-good
 * snapshot in place.
 *
 * Usage: npx tsx scripts/refresh_external_contributions.ts
 * Set GITHUB_TOKEN to raise the API rate limit.
 */
import fs from "node:fs"

import { CONTRIBUTIONS_AUTHOR, OWN_ACCOUNTS } from "../config/quartz/externalContributions"
import {
  type Contribution,
  CONTRIBUTIONS_SNAPSHOT_PATH,
  type ContributionsSnapshot,
  type ContributionStatus,
  type RepoMeta,
} from "../quartz/plugins/transformers/externalContributions"
import { type FetchDeps, fetchGitHub } from "./refresh_readme_snapshots"

const JSON_ACCEPT = "application/vnd.github+json"
export const PER_PAGE = 100

/** The fields of a search-API issue or pull request that the snapshot keeps. */
export interface SearchItem {
  repository_url: string
  number: number
  title: string
  html_url: string
  state: "open" | "closed"
  state_reason?: string | null
  pull_request?: { merged_at: string | null }
}

interface SearchPage {
  incomplete_results: boolean
  items: SearchItem[]
}

/** Search query for items the author opened on repos they do not own. */
export function searchQuery(author: string, ownAccounts: readonly string[]): string {
  return [`author:${author}`, ...ownAccounts.map((account) => `-user:${account}`)].join(" ")
}

/** Classifies a search item: merged PR, fixed issue, open, or closed without either. */
export function statusOf(item: SearchItem): ContributionStatus {
  if (item.state === "open") return "open"
  if (item.pull_request) return item.pull_request.merged_at ? "merged" : "closed"
  return item.state_reason === "completed" ? "fixed" : "closed"
}

export function toContribution(item: SearchItem): Contribution {
  return {
    repo: item.repository_url.replace("https://api.github.com/repos/", ""),
    number: item.number,
    title: item.title,
    url: item.html_url,
    isPr: item.pull_request !== undefined,
    status: statusOf(item),
  }
}

/** Fetches every search page. An incomplete page means GitHub timed out, so it fails. */
export async function fetchContributions(query: string, deps: FetchDeps): Promise<Contribution[]> {
  const items: SearchItem[] = []
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=${PER_PAGE}&page=${page}`
    const body = JSON.parse(await fetchGitHub(url, JSON_ACCEPT, deps)) as SearchPage
    if (body.incomplete_results) {
      throw new Error(`GitHub returned incomplete search results for page ${page}`)
    }
    items.push(...body.items)
    if (body.items.length < PER_PAGE) return items.map(toContribution)
  }
}

export async function fetchRepoMeta(repo: string, deps: FetchDeps): Promise<RepoMeta> {
  const body = JSON.parse(
    await fetchGitHub(`https://api.github.com/repos/${repo}`, JSON_ACCEPT, deps),
  ) as { stargazers_count: number; owner: { type: string } }
  return { stars: body.stargazers_count, ownerType: body.owner.type }
}

/** Builds a snapshot sorted by repo and number, so an unchanged world serializes identically. */
export async function buildSnapshot(deps: FetchDeps): Promise<ContributionsSnapshot> {
  const items = await fetchContributions(searchQuery(CONTRIBUTIONS_AUTHOR, OWN_ACCOUNTS), deps)
  items.sort((a, b) => a.repo.localeCompare(b.repo) || a.number - b.number)
  const repoNames = [...new Set(items.map((item) => item.repo))]
  const repos: Record<string, RepoMeta> = {}
  for (const repo of repoNames) {
    repos[repo] = await fetchRepoMeta(repo, deps)
  }
  return { items, repos }
}

/** Writes the snapshot when its content changed. Returns whether it wrote. */
export function writeSnapshot(snapshot: ContributionsSnapshot, snapshotPath: string): boolean {
  const content = `${JSON.stringify(snapshot, null, 2)}\n`
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
