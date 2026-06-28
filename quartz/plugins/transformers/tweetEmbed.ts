import type { Element, Root, Text } from "hast"

import fs from "fs/promises"
import path from "path"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

import { cdnBaseUrl } from "../../components/constants"
import { findGitRoot } from "../../util/log"
import { buildTweetEmbed, type TweetSlot, type TweetSnapshot } from "./tweetCard"

/**
 * Directory holding optional *pinned* snapshots: a committed JSON here overrides
 * the R2 copy, making an embed fully offline/takedown-proof. Normally empty —
 * the build hydrates snapshots from R2 instead (see `fetchSnapshotFromR2`).
 */
export const snapshotDir = path.join(
  findGitRoot(),
  "quartz",
  "plugins",
  "transformers",
  ".tweet_snapshots",
)

/** Public CDN URL the build reads a snapshot from (uploaded by `scripts/tweet_snapshot.py`). */
const snapshotCdnUrl = (id: string): string => `${cdnBaseUrl}/static/tweets/${id}.json`

// Keep in sync with TWEET_ID_RE in scripts/tweet_snapshot.py.
const TWEET_ID_RE = /(?:status(?:es)?\/)?(\d{5,25})/
const TWEET_HOST_RE = /^https?:\/\/(?:www\.)?(?:x|twitter|xcancel|nitter\.[^/]+)\.com/i

/** Extract the numeric status id from a tweet URL or bare id. */
export function extractTweetId(text: string): string | null {
  const match = TWEET_ID_RE.exec(text.trim())
  return match ? match[1] : null
}

/** Rewrite an x.com/twitter.com permalink to its xcancel.com equivalent. */
export function toXcancelUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (TWEET_HOST_RE.test(trimmed)) {
    return trimmed.replace(TWEET_HOST_RE, "https://xcancel.com")
  }
  return trimmed
}

export interface TweetReference {
  id: string
  xcancelUrl: string
  retweetedBy?: string
  /** Snapshot is intentionally absent (tweet deleted before capture); stub is OK. */
  unavailable?: boolean
}

const RETWEETED_BY_RE = /^retweeted-by:\s*(\S.*)$/i
const UNAVAILABLE_RE = /^unavailable:\s*(\S.*)$/i

/**
 * Parse a tweet block's body into ordered references. Each non-empty line is a
 * tweet URL/id, except a `retweeted-by: <name>` line, which attaches a "retweeted"
 * header to the most recent tweet. Prefixing a line with `unavailable:` marks
 * that tweet as deliberately snapshot-less (deleted before it could be captured),
 * so a missing snapshot degrades to a stub instead of failing the build.
 */
export function parseTweetReferences(body: string): TweetReference[] {
  const refs: TweetReference[] = []
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    const retweet = RETWEETED_BY_RE.exec(line)
    if (retweet) {
      const last = refs[refs.length - 1]
      if (!last) {
        throw new Error("tweetEmbed: `retweeted-by:` must follow a tweet URL")
      }
      last.retweetedBy = retweet[1].trim()
      continue
    }
    const unavailable = UNAVAILABLE_RE.exec(line)
    const urlText = unavailable ? unavailable[1].trim() : line
    const id = extractTweetId(urlText)
    if (!id) {
      throw new Error(`tweetEmbed: no tweet id found in line ${JSON.stringify(line)}`)
    }
    const ref: TweetReference = { id, xcancelUrl: toXcancelUrl(urlText) }
    if (unavailable) ref.unavailable = true
    refs.push(ref)
  }
  return refs
}

/** The literal text inside a `<pre><code class="language-tweet">` block, or null. */
export function tweetBlockBody(node: Element): string | null {
  if (node.tagName !== "pre") return null
  const code = node.children.find(
    (child): child is Element => child.type === "element" && child.tagName === "code",
  )
  if (!code) return null
  const className = code.properties?.className
  const classes = Array.isArray(className) ? className.map(String) : []
  if (!classes.includes("language-tweet")) return null
  return code.children
    .filter((child): child is Text => child.type === "text")
    .map((child) => child.value)
    .join("")
}

const snapshotCache = new Map<string, TweetSnapshot | null>()

/** Read a pinned snapshot from disk; missing files resolve to null. */
async function readPinnedSnapshot(id: string, dir: string): Promise<TweetSnapshot | null> {
  try {
    const raw = await fs.readFile(path.join(dir, `${id}.json`), "utf-8")
    return JSON.parse(raw) as TweetSnapshot
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

const R2_FETCH_RETRIES = 3
const R2_FETCH_BACKOFF_MS = 1000

/**
 * Fetch a snapshot from R2's public CDN, where `scripts/tweet_snapshot.py`
 * uploads it. Returns null when the snapshot doesn't exist (404 → render a
 * stub); a transient network/5xx failure is retried, then thrown so the build
 * fails loudly rather than silently dropping a tweet that does exist.
 */
async function fetchSnapshotFromR2(id: string): Promise<TweetSnapshot | null> {
  const url = snapshotCdnUrl(id)
  for (let attempt = 0; attempt < R2_FETCH_RETRIES; attempt++) {
    try {
      const response = await fetch(url)
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`Failed to fetch tweet snapshot ${url}: ${response.status}`)
      }
      return (await response.json()) as TweetSnapshot
    } catch (error) {
      if (attempt === R2_FETCH_RETRIES - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, R2_FETCH_BACKOFF_MS * (attempt + 1)))
    }
  }
  /* istanbul ignore next -- the loop either returns or throws on the last attempt */
  throw new Error(`Failed to fetch tweet snapshot ${url}`)
}

/**
 * Load a snapshot by id. A pinned snapshot in `dir` wins (offline override);
 * otherwise it's hydrated from R2. A snapshot that exists in neither resolves to
 * null (→ stub).
 */
export async function loadSnapshot(
  id: string,
  dir: string = snapshotDir,
): Promise<TweetSnapshot | null> {
  const cacheKey = `${dir}:${id}`
  const cached = snapshotCache.get(cacheKey)
  if (cached !== undefined) return cached

  const snapshot = (await readPinnedSnapshot(id, dir)) ?? (await fetchSnapshotFromR2(id))
  snapshotCache.set(cacheKey, snapshot)
  return snapshot
}

/** Clears the in-memory snapshot cache. Tests call this between runs. */
export function clearSnapshotCache(): void {
  snapshotCache.clear()
}

function resolveSlots(refs: readonly TweetReference[], dir: string): Promise<TweetSlot[]> {
  return Promise.all(
    refs.map(async (ref) => {
      const snapshot = await loadSnapshot(ref.id, dir)
      if (!snapshot && !ref.unavailable) {
        throw new Error(
          `tweetEmbed: no snapshot for tweet ${ref.id} (${ref.xcancelUrl}) on disk or R2. ` +
            "Run `uv run python scripts/tweet_snapshot.py --write` to capture it and upload it to R2, or " +
            "prefix the line with `unavailable:` if the tweet is gone and can't be snapshotted.",
        )
      }
      return {
        snapshot: snapshot ?? undefined,
        xcancelUrl: ref.xcancelUrl,
        retweetedBy: ref.retweetedBy,
      }
    }),
  )
}

/** Replace every tweet code block in the tree with its rendered embed. */
export async function replaceTweetBlocks(tree: Root, dir: string = snapshotDir): Promise<void> {
  const jobs: Promise<void>[] = []
  visit(tree, "element", (node: Element, index, parent) => {
    // istanbul ignore next -- element nodes always have a parent and index
    if (!parent || typeof index !== "number") return
    const body = tweetBlockBody(node)
    if (body === null) return
    const refs = parseTweetReferences(body)
    jobs.push(
      resolveSlots(refs, dir).then((slots) => {
        parent.children[index] = buildTweetEmbed(slots)
      }),
    )
  })
  await Promise.all(jobs)
}

/**
 * Replaces ```tweet fenced blocks (one tweet URL per line) with self-hosted,
 * tracking-free tweet cards rendered from snapshots captured by
 * `scripts/tweet_snapshot.py`. Multiple URLs render as a connected thread;
 * tweets without a snapshot degrade to an xcancel link.
 */
export const TweetEmbed: QuartzTransformerPlugin = () => {
  return {
    name: "TweetEmbed",
    htmlPlugins: () => [() => (tree: Root) => replaceTweetBlocks(tree)],
  }
}
