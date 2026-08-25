import {
  type GitHubMarkdownSource,
  githubReadmeSource,
  type MarkdownSource,
  type ReadmeSection,
} from "../../quartz/plugins/transformers/populateExternalMarkdown"

/**
 * GitHub READMEs embedded into pages via `populate-markdown-*` placeholders.
 * The build reads these from committed snapshots in
 * `quartz/plugins/transformers/.readme-snapshots/`;
 * `scripts/refresh_readme_snapshots.ts` re-fetches and updates the snapshots.
 */

/**
 * The agent-tooling repos rendered on /open-source, one H1 section per entry,
 * in this order. To list a new repo: add its entry here, run
 * `npx tsx scripts/refresh_readme_snapshots.ts`, and commit the new snapshot.
 */
const AGENT_TOOLING_SECTIONS: readonly (ReadmeSection & { source: GitHubMarkdownSource })[] = [
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
]

/** Every GitHub source with a committed snapshot; the refresh script iterates this map. */
export const GITHUB_README_SOURCES: Readonly<Record<string, GitHubMarkdownSource>> = {
  punctilio: githubReadmeSource("AlexanderMattTurner", "punctilio", { maxSections: 0 }),
  ...Object.fromEntries(AGENT_TOOLING_SECTIONS.map(({ source }) => [source.repo, source])),
}

/** Placeholder map for `PopulateExternalMarkdown`: each snapshot source plus the section list. */
export const EXTERNAL_README_SOURCES: Readonly<Record<string, MarkdownSource>> = {
  ...GITHUB_README_SOURCES,
  "agent-tooling": { sections: AGENT_TOOLING_SECTIONS },
}
