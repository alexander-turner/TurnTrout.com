/**
 * Renders my pull requests and issues on other people's repositories from a
 * committed snapshot (see `scripts/refresh_external_contributions.ts`). The
 * build reads only the snapshot, never the network.
 */

import type { Element, ElementContent } from "hast"

import { toHtml } from "hast-util-to-html"
import { h } from "hastscript"
import path from "path"

import { findGitRoot } from "../../util/log"

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
  isPr: boolean
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

/** Splits a title on backtick spans, rendering each span as inline code. */
export function titleNodes(title: string): ElementContent[] {
  // With one capture group, `split` puts the code spans at the odd indices.
  return title.split(/`([^`]+)`/).flatMap((part, index): ElementContent[] => {
    if (index % 2 === 1) return [h("code", part)]
    return part === "" ? [] : [{ type: "text", value: part }]
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

/** Renders one description list: a `<dt>` per repo, then a `<dd>` list whose bullets are statuses. */
export function renderList(
  items: readonly Contribution[],
  snapshot: ContributionsSnapshot,
): Element {
  const entries = groupByRepo(items, snapshot).flatMap(([repo, group]) => [
    h("dt", [
      h("a.no-favicon", { href: `https://github.com/${repo}` }, h("code", repo)),
      h("span.contribution-stars", `★ ${repoMeta(snapshot, repo).stars.toLocaleString("en-US")}`),
    ]),
    h(
      "dd",
      h(
        "ul.contribution-list",
        group.map((item) =>
          h("li", [
            h(`span.contribution-status.contribution-${item.status}`, STATUS_LABEL[item.status]),
            h("a.no-favicon", { href: item.url }, titleNodes(item.title)),
          ]),
        ),
      ),
    ),
  ])
  return h("dl.external-contributions.no-formatting", entries)
}

function plural(count: number, noun: string): string {
  return `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`
}

/**
 * Renders the snapshot as markdown: a summary sentence, the list of shipped
 * work (merged PRs and fixed issues), and a collapsed goose admonition holding
 * open items. Each list is one line of HTML, so it can sit inside the
 * admonition's blockquote.
 */
export function renderContributions(snapshotJson: string, filter: ContributionFilter): string {
  const snapshot = JSON.parse(snapshotJson) as ContributionsSnapshot
  const shown = snapshot.items.filter((item) =>
    isShown(item, repoMeta(snapshot, item.repo), filter),
  )
  const shipped = shown.filter((item) => item.status !== "open")
  const open = shown.filter((item) => item.status === "open")
  if (shipped.length === 0) {
    throw new Error("No external contributions pass the filter; the section would render empty")
  }

  const merged = shipped.filter((item) => item.status === "merged").length
  const projects = new Set(shipped.map((item) => item.repo)).size
  const summary =
    `This list refreshes daily from GitHub. So far, ${plural(merged, "pull request")} of mine ` +
    `merged and ${plural(shipped.length - merged, "issue")} I reported got fixed, ` +
    `across ${plural(projects, "project")}.`

  const parts = [summary, toHtml(renderList(shipped, snapshot))]
  if (open.length > 0) {
    parts.push(
      `> [!goose]- In progress: ${plural(open.length, "open item")}\n` +
        `> ${toHtml(renderList(open, snapshot))}`,
    )
  }
  return parts.join("\n\n")
}
