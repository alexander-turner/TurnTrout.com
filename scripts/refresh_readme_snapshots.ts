/**
 * Re-fetches the GitHub READMEs embedded into pages and updates their
 * committed snapshots in `quartz/plugins/transformers/.readme-snapshots/`.
 * The site build reads only those snapshots, so this script talks to
 * GitHub off the build's critical path. A failed refresh leaves the
 * last-known-good snapshots in place.
 *
 * Usage: npx tsx scripts/refresh_readme_snapshots.ts
 * Set GITHUB_TOKEN to raise the API rate limit (5000/hr vs 60/hr).
 */
import fs from "node:fs"
import path from "node:path"

import { SNAPSHOT_SOURCES } from "../config/quartz/externalReadmes"
import {
  type GitHubMarkdownSource,
  githubSnapshotPath,
  README_SNAPSHOT_DIR,
  resolveGitHubSource,
} from "../quartz/plugins/transformers/populateExternalMarkdown"
import { type GitHub, gitHubClient } from "./github_client"

/** Fetches a source's raw README content. */
export async function fetchReadme(source: GitHubMarkdownSource, github: GitHub): Promise<string> {
  const { ref, filePath } = resolveGitHubSource(source)
  const { data } = await github.rest.repos.getContent({
    owner: source.owner,
    repo: source.repo,
    path: filePath,
    ref,
    mediaType: { format: "raw" },
  })
  return data as unknown as string
}

export interface RefreshResult {
  written: string[]
  unchanged: string[]
  failed: string[]
  pruned: string[]
}

/**
 * Fetches every GitHub source and rewrites snapshots whose upstream content
 * changed. Sources that fail after retries keep their existing snapshot and
 * are reported in `failed`. Snapshots no longer matching any configured
 * source are deleted and reported in `pruned`.
 */
export async function refreshSnapshots(
  sources: readonly GitHubMarkdownSource[] = SNAPSHOT_SOURCES,
  github: GitHub = gitHubClient(),
): Promise<RefreshResult> {
  fs.mkdirSync(README_SNAPSHOT_DIR, { recursive: true })
  const result: RefreshResult = { written: [], unchanged: [], failed: [], pruned: [] }

  for (const source of sources) {
    // The snapshot filename identifies a source uniquely, ref and path included.
    const name = path.basename(githubSnapshotPath(source))
    let content: string
    try {
      content = await fetchReadme(source, github)
    } catch (error) {
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

  const expectedPaths = new Set(sources.map(githubSnapshotPath))
  for (const fileName of fs.readdirSync(README_SNAPSHOT_DIR)) {
    const filePath = path.join(README_SNAPSHOT_DIR, fileName)
    if (!expectedPaths.has(filePath)) {
      fs.rmSync(filePath)
      console.log(`- ${fileName}: pruned (no longer configured)`)
      result.pruned.push(fileName)
    }
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
