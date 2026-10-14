/**
 * Renders my pull requests and issues on other people's repositories from a
 * committed snapshot (see `scripts/refresh_external_contributions.ts`). The
 * build reads only the snapshot, never the network.
 */

import type { ElementContent } from "hast"

import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import path from "path"

import { findGitRoot } from "../../util/log"
import { asAdmonition } from "./populateExternalMarkdown"

/** Committed snapshot of my external contributions, anchored to the git root. */
export const CONTRIBUTIONS_SNAPSHOT_PATH = path.join(
  findGitRoot(),
  "quartz",
  "plugins",
  "transformers",
  ".external-contributions.json",
)

export type ContributionStatus = "merged" | "fixed" | "open" | "closed"

export interface Contribution {
  repo: string
  number: number
  title: string
  url: string
  status: ContributionStatus
}

export interface RepoMeta {
  stars: number
  ownerType: string
}

export interface ContributionsSnapshot {
  items: readonly Contribution[]
  repos: Readonly<Record<string, RepoMeta>>
}

/** Which contributions the page lists. */
export interface ContributionFilter {
  /** A repo owned by a person needs at least this many stars. */
  minStars: number
  /** Repos never listed, whatever their size. */
  deniedRepos: ReadonlySet<string>
}

const STATUS_ORDER: Readonly<Record<ContributionStatus, number>> = {
  merged: 0,
  fixed: 1,
  open: 2,
  closed: 3,
}

const STATUS_LABEL: Readonly<Record<ContributionStatus, string>> = {
  merged: "Merged",
  fixed: "Fixed",
  open: "Open",
  closed: "Closed",
}

/** Title GitHub shows for an issue its author deleted. */
const DELETED_TITLE = "(deleted)"

function repoMeta(snapshot: ContributionsSnapshot, repo: string): RepoMeta {
  const meta = snapshot.repos[repo]
  if (!meta) {
    throw new Error(`External-contributions snapshot has no repo metadata for ${repo}`)
  }
  return meta
}

/** True when a contribution belongs on the page: a merged, fixed or open item on a notable repo. */
export function isShown(item: Contribution, meta: RepoMeta, filter: ContributionFilter): boolean {
  const notable = meta.ownerType === "Organization" || meta.stars >= filter.minStars
  return (
    item.status !== "closed" &&
    item.title !== DELETED_TITLE &&
    !filter.deniedRepos.has(item.repo) &&
    notable
  )
}

const TRAILING_PUNCTUATION = new Set([".", ",", ":", ";", "!", "?", ")"])

/**
 * Renders each word holding `_` or `*` (an identifier a title left unquoted)
 * as code. A leading `(` and trailing punctuation stay outside the code, so in
 * `(enable_guest_swap),` only the identifier itself is marked.
 */
function textWithIdentifiers(text: string): ElementContent[] {
  return text.split(/(\s+)/).flatMap((word): ElementContent[] => {
    let start = 0
    while (word[start] === "(") start++
    let end = word.length
    while (end > start && TRAILING_PUNCTUATION.has(word[end - 1])) end--
    const core = word.slice(start, end)
    if (!core.includes("_") && !core.includes("*")) {
      return word === "" ? [] : [{ type: "text", value: word }]
    }
    const lead = word.slice(0, start)
    const trail = word.slice(end)
    return [
      ...(lead ? [{ type: "text" as const, value: lead }] : []),
      h("code", core),
      ...(trail ? [{ type: "text" as const, value: trail }] : []),
    ]
  })
}

/** Renders a title's backtick spans and bare identifiers as inline code. */
export function titleNodes(title: string): ElementContent[] {
  return title.split(/`([^`]+)`/).flatMap((part, index): ElementContent[] => {
    if (index % 2 === 1) return [h("code", part)]
    return textWithIdentifiers(part)
  })
}

/** Groups items by repo, repos by stars (descending), items by status then number. */
function groupByRepo(
  items: readonly Contribution[],
  snapshot: ContributionsSnapshot,
): [string, Contribution[]][] {
  const groups = new Map<string, Contribution[]>()
  for (const item of items) {
    groups.set(item.repo, [...(groups.get(item.repo) ?? []), item])
  }
  return [...groups.entries()]
    .sort(
      ([a], [b]) => repoMeta(snapshot, b).stars - repoMeta(snapshot, a).stars || a.localeCompare(b),
    )
    .map(([repo, group]) => [
      repo,
      group.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.number - b.number),
    ])
}

/** Key an annotation heading uses for a contribution: `owner/repo#number`. */
function contributionKey(item: Contribution): string {
  return `${item.repo}#${item.number}`
}

/**
 * Parses the annotations file: each `## owner/repo#number` heading starts the
 * markdown annotating that contribution, running until the next heading.
 */
export function parseAnnotations(markdown: string): ReadonlyMap<string, string> {
  // Splitting on a capturing pattern yields [preamble, key, body, key, body, ...].
  const [preamble, ...sections] = markdown.split(/^## (\S+)[ \t]*$/m)
  if (sections.length === 0 || preamble.trim() !== "") {
    throw new Error("Contribution annotations must start with a `## owner/repo#number` heading")
  }
  const annotations = new Map<string, string>()
  for (let index = 0; index < sections.length; index += 2) {
    const key = sections[index]
    const body = sections[index + 1].trim()
    if (annotations.has(key)) throw new Error(`Duplicate contribution annotation for ${key}`)
    if (body === "") throw new Error(`Contribution annotation for ${key} is empty`)
    annotations.set(key, body)
  }
  return annotations
}

/** Lowercases a repo name and joins its parts with `-`, for use in an `id`. */
function repoSlug(repo: string): string {
  return repo.toLowerCase().replaceAll(/[^a-z0-9_]+/g, "-")
}

/** Indents every non-blank line of a block so it continues a list item. */
function indented(block: string): string {
  return block
    .split("\n")
    .map((line) => (line === "" ? "" : `  ${line}`))
    .join("\n")
}

/**
 * Renders the contributions as markdown: a `##` heading per repo, a subtitle
 * with its star count linked to the repo, then a list with an item per
 * contribution, its status pill as the bullet. Each item's row is a one-line
 * HTML block, so its title never parses as markdown; an annotation follows as
 * the item's own markdown. With `idPrefix`, each heading carries an explicit
 * `id` of that prefix plus the repo, so a repo listed twice on the page keeps
 * unique heading ids.
 */
export function renderList(
  items: readonly Contribution[],
  snapshot: ContributionsSnapshot,
  annotations: ReadonlyMap<string, string>,
  idPrefix?: string,
): string {
  return groupByRepo(items, snapshot)
    .map(([repo, group]) => {
      const stars = toHtml(
        h(
          "a.no-favicon",
          { href: `https://github.com/${repo}` },
          `★${repoMeta(snapshot, repo).stars.toLocaleString("en-US")}`,
        ),
      )
      const entries = group.flatMap((item) => {
        const row = toHtml(
          h("div.contribution-row.no-formatting", [
            h(`span.contribution-status.contribution-${item.status}`, STATUS_LABEL[item.status]),
            h("a.no-favicon", { href: item.url }, titleNodes(item.title)),
          ]),
        )
        const annotation = annotations.get(contributionKey(item))
        return annotation === undefined ? [`- ${row}`] : [`- ${row}`, "", indented(annotation), ""]
      })
      const heading =
        idPrefix === undefined
          ? `## \`${repo}\``
          : toHtml(h("h2", { id: `${idPrefix}${repoSlug(repo)}` }, h("code", repo)))
      return [
        heading,
        "",
        `Subtitle: ${stars}`,
        "",
        '<div class="contribution-list">',
        "",
        ...entries,
        "",
        "</div>",
      ].join("\n")
    })
    .join("\n\n")
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`
}

/**
 * Renders the snapshot as markdown: a summary sentence, the list of shipped
 * work (merged PRs and fixed issues), and a collapsed goose admonition holding
 * open items. Every annotation must belong to a listed contribution.
 */
export function renderContributions(
  snapshotJson: string,
  filter: ContributionFilter,
  annotations: ReadonlyMap<string, string>,
): string {
  const snapshot = JSON.parse(snapshotJson) as ContributionsSnapshot
  const shown = snapshot.items.filter((item) =>
    isShown(item, repoMeta(snapshot, item.repo), filter),
  )
  const shipped = shown.filter((item) => item.status !== "open")
  const open = shown.filter((item) => item.status === "open")
  if (shipped.length === 0) {
    throw new Error("No external contributions pass the filter; the section would render empty")
  }
  const shownKeys = new Set(shown.map(contributionKey))
  const orphans = [...annotations.keys()].filter((key) => !shownKeys.has(key))
  if (orphans.length > 0) {
    throw new Error(`Contribution annotations match no listed contribution: ${orphans.join(", ")}`)
  }

  const merged = shipped.filter((item) => item.status === "merged").length
  const projects = new Set(shipped.map((item) => item.repo)).size
  const summary =
    `This list refreshes daily from GitHub. So far, ${plural(merged, "pull request")} of mine ` +
    `merged and ${plural(shipped.length - merged, "issue")} I reported got fixed, ` +
    `across ${plural(projects, "project")}.`

  const parts = [summary, renderList(shipped, snapshot, annotations)]
  if (open.length > 0) {
    parts.push(
      asAdmonition(
        renderList(open, snapshot, annotations, "in-progress-"),
        `[!goose]- In progress: ${plural(open.length, "open item")}`,
      ),
    )
  }
  return parts.join("\n\n")
}
