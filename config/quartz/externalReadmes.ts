/**
 * The repo sections embedded into pages via `populate-markdown-*` placeholders.
 * The build reads each repo's README from a committed snapshot in
 * `quartz/plugins/transformers/.readme-snapshots/`;
 * `scripts/refresh_readme_snapshots.ts` re-fetches and updates the snapshots.
 */
import {
  type GitHubMarkdownSource,
  githubReadmeSource,
  type MarkdownSource,
} from "../../quartz/plugins/transformers/populateExternalMarkdown"

interface RepoSection {
  heading: string
  source: GitHubMarkdownSource
}

/**
 * Repo sections on /open-source, grouped by the placeholder span that renders
 * them, each group in page order. To list a new repo: add an entry here, run
 * `npx tsx scripts/refresh_readme_snapshots.ts`, and commit the new snapshot.
 */
const PAGE_SECTIONS: Readonly<Record<string, readonly RepoSection[]>> = {
  punctilio: [
    {
      heading: "Punctilio for meticulous typography",
      source: githubReadmeSource("AlexanderMattTurner", "punctilio", { maxSections: 0 }),
    },
  ],
  tooling: [
    {
      heading: "Claude Code automation template",
      source: githubReadmeSource("AlexanderMattTurner", "claude-automation-template", {
        maxSections: 1,
      }),
    },
    {
      heading: "Sandbox your coding agent",
      source: githubReadmeSource("AlexanderMattTurner", "agent-glovebox", { maxSections: 0 }),
    },
    {
      heading: "Automatically resolve merge conflicts",
      source: githubReadmeSource("AlexanderMattTurner", "agent-resolve-merge-conflicts", {
        maxSections: 1,
      }),
    },
    {
      heading: "Make your CI confess",
      source: githubReadmeSource("AlexanderMattTurner", "ci-truth-serum", { maxSections: 1 }),
    },
    {
      heading: "Sanitize untrusted text before your agent sees it",
      source: githubReadmeSource("AlexanderMattTurner", "agent-sanitizer", { maxSections: 1 }),
    },
  ],
}

/** Every source needing a committed snapshot; `refreshSnapshots` iterates this list. */
export const SNAPSHOT_SOURCES: readonly GitHubMarkdownSource[] = Object.values(PAGE_SECTIONS)
  .flat()
  .map(({ source }) => source)

/** Placeholder map for `PopulateExternalMarkdown`: one section-list source per group. */
export const EXTERNAL_README_SOURCES: Readonly<Record<string, MarkdownSource>> = Object.fromEntries(
  Object.entries(PAGE_SECTIONS).map(([name, sections]) => [name, { sections }]),
)
