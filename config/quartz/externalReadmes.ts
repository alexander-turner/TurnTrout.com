import {
  type GitHubMarkdownSource,
  githubReadmeSource,
} from "../../quartz/plugins/transformers/populateExternalMarkdown"

/**
 * GitHub READMEs embedded into pages via `populate-markdown-*` placeholders.
 * The build reads these from committed snapshots in
 * `quartz/plugins/transformers/.readme-snapshots/`;
 * `scripts/refresh_readme_snapshots.ts` re-fetches and updates the snapshots.
 */
export const GITHUB_README_SOURCES: Readonly<Record<string, GitHubMarkdownSource>> = {
  punctilio: githubReadmeSource("alexander-turner", "punctilio", {
    maxSections: 0,
  }),
  "claude-guard": githubReadmeSource("alexander-turner", "claude-guard", {
    maxSections: 0,
  }),
  "ci-truth-serum": githubReadmeSource("alexander-turner", "ci-truth-serum", {
    maxSections: 1,
  }),
  "agent-input-sanitizer": githubReadmeSource("alexander-turner", "agent-input-sanitizer", {
    maxSections: 1,
  }),
}
