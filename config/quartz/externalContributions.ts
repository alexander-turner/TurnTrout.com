import type { LocalMarkdownSource } from "../../quartz/plugins/transformers/populateExternalMarkdown"

import {
  type ContributionFilter,
  CONTRIBUTIONS_SNAPSHOT_PATH,
  renderContributions,
} from "../../quartz/plugins/transformers/externalContributions"

/** GitHub account whose pull requests and issues the snapshot collects. */
export const CONTRIBUTIONS_AUTHOR = "alexander-turner"

/** Accounts whose repos are my own work rather than contributions elsewhere. */
export const OWN_ACCOUNTS: readonly string[] = ["alexander-turner", "AlexanderMattTurner"]

/**
 * Which snapshot items the page lists. Applied at build time, so a retune
 * needs no refetch. The denied repos only hold old support questions.
 */
export const CONTRIBUTION_FILTER: ContributionFilter = {
  minStars: 100,
  deniedRepos: new Set([
    "EFForg/https-everywhere",
    "TranslucentTB/TranslucentTB",
    "mkusner/grammarVAE",
    "nikitabobko/AeroSpace",
    "openai/gym",
  ]),
}

/** Placeholder source rendering the `populate-markdown-external-contributions` span. */
export const EXTERNAL_CONTRIBUTIONS_SOURCE: LocalMarkdownSource = {
  filePath: CONTRIBUTIONS_SNAPSHOT_PATH,
  transform: (content) => renderContributions(content, CONTRIBUTION_FILTER),
}
