import fs from "fs"
import path from "path"

import type { LocalMarkdownSource } from "../../quartz/plugins/transformers/populateExternalMarkdown"

import {
  type ContributionFilter,
  CONTRIBUTIONS_SNAPSHOT_PATH,
  parseAnnotations,
  renderContributions,
} from "../../quartz/plugins/transformers/externalContributions"
import { findGitRoot } from "../../quartz/util/log"

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

/** Prose annotating individual contributions, one `## owner/repo#number` section each. */
const ANNOTATIONS_PATH = path.join(findGitRoot(), "config", "quartz", "contributionAnnotations.md")

/** Renders the snapshot with the page's filter and annotations. */
export function renderContributionsSection(snapshotJson: string): string {
  return renderContributions(
    snapshotJson,
    CONTRIBUTION_FILTER,
    parseAnnotations(fs.readFileSync(ANNOTATIONS_PATH, "utf8")),
  )
}

/** Placeholder source rendering the `populate-markdown-external-contributions` span. */
export const EXTERNAL_CONTRIBUTIONS_SOURCE: LocalMarkdownSource = {
  filePath: CONTRIBUTIONS_SNAPSHOT_PATH,
  transform: renderContributionsSection,
}
