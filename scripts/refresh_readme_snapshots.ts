/**
 * Re-fetches the GitHub READMEs embedded into pages and updates their
 * committed snapshots in `quartz/plugins/transformers/.readme-snapshots/`.
 * The site build reads only those snapshots, so this script is the single
 * place that talks to GitHub — with backoff, and off the build's critical
 * path. A failed refresh leaves the last-known-good snapshots in place.
 *
 * Usage: npx tsx scripts/refresh_readme_snapshots.ts
 * Set GITHUB_TOKEN to raise the API rate limit (5000/hr vs 60/hr).
 */
import fs from "node:fs"
import { setTimeout as sleep } from "node:timers/promises"

import { GITHUB_README_SOURCES } from "../config/quartz/externalReadmes"
import {
  type GitHubMarkdownSource,
  githubSnapshotPath,
  README_SNAPSHOT_DIR,
} from "../quartz/plugins/transformers/populateExternalMarkdown"

export const MAX_ATTEMPTS = 5
export const BASE_DELAY_MS = 2000

/** GitHub contents-API URL returning the raw file for a source. */
export function apiUrl(source: GitHubMarkdownSource): string {
  const ref = source.ref ?? "main"
  const filePath = source.path ?? "README.md"
  return `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${filePath}?ref=${ref}`
}

export interface FetchDeps {
  fetchFn?: typeof fetch
  sleepFn?: (ms: number) => Promise<unknown>
  token?: string
}

/**
 * Fetches a source's raw content, retrying transient failures (network
 * errors, 5xx, 403/429 rate limits) with exponential backoff. A 404 is
 * permanent — the repo, ref, or path is wrong — so it fails immediately.
 */
export async function fetchReadme(
  source: GitHubMarkdownSource,
  { fetchFn = fetch, sleepFn = sleep, token = process.env.GITHUB_TOKEN }: FetchDeps = {},
): Promise<string> {
  const url = apiUrl(source)
  const headers: Record<string, string> = {
    accept: "application/vnd.github.raw+json",
    "user-agent": "turntrout.com readme-snapshot refresh",
    "x-github-api-version": "2022-11-28",
  }
  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  let lastError: Error | undefined
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleepFn(BASE_DELAY_MS * 2 ** (attempt - 1))
    }
    let response: Response
    try {
      response = await fetchFn(url, { headers })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      continue
    }
    if (response.status === 404) {
      throw new Error(`${url} returned 404 — check the owner/repo/ref/path configuration`)
    }
    if (!response.ok) {
      lastError = new Error(`${url} returned HTTP ${response.status}`)
      continue
    }
    return await response.text()
  }
  throw new Error(`Failed to fetch ${url} after ${MAX_ATTEMPTS} attempts`, { cause: lastError })
}

export interface RefreshResult {
  written: string[]
  unchanged: string[]
  failed: string[]
}

/**
 * Fetches every GitHub source and rewrites snapshots whose upstream content
 * changed. Sources that fail after retries keep their existing snapshot and
 * are reported in `failed`.
 */
export async function refreshSnapshots(
  sources: Readonly<Record<string, GitHubMarkdownSource>> = GITHUB_README_SOURCES,
  deps: FetchDeps = {},
): Promise<RefreshResult> {
  fs.mkdirSync(README_SNAPSHOT_DIR, { recursive: true })
  const result: RefreshResult = { written: [], unchanged: [], failed: [] }

  for (const [name, source] of Object.entries(sources)) {
    let content: string
    try {
      content = await fetchReadme(source, deps)
    } catch (error) {
      // fetchReadme only throws Error instances
      console.error(`✗ ${name}: ${(error as Error).message}`)
      result.failed.push(name)
      continue
    }

    const snapshotPath = githubSnapshotPath(source)
    if (fs.existsSync(snapshotPath) && fs.readFileSync(snapshotPath, "utf-8") === content) {
      console.log(`= ${name}: unchanged`)
      result.unchanged.push(name)
      continue
    }
    fs.writeFileSync(snapshotPath, content, "utf-8")
    console.log(`✓ ${name}: wrote ${snapshotPath}`)
    result.written.push(name)
  }

  return result
}

// istanbul ignore next - CLI entrypoint
async function main(): Promise<void> {
  const { failed } = await refreshSnapshots()
  if (failed.length > 0) {
    throw new Error(
      `Failed to refresh snapshots for: ${failed.join(", ")}. Existing snapshots were kept.`,
    )
  }
}

// istanbul ignore next - CLI entrypoint
if (process.argv[1]?.endsWith("refresh_readme_snapshots.ts")) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
