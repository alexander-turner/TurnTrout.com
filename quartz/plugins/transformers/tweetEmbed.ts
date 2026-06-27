import type { Element, Root, Text } from "hast"

import fs from "fs/promises"
import path from "path"
import { visit } from "unist-util-visit"

import type { QuartzTransformerPlugin } from "../types"

import { createWinstonLogger, findGitRoot } from "../../util/log"
import { buildTweetEmbed, type TweetSlot, type TweetSnapshot } from "./tweetCard"

const logger = createWinstonLogger("tweetEmbed")

/** Directory the snapshot script populates and this transformer reads. */
export const snapshotDir = path.join(
  findGitRoot(),
  "quartz",
  "plugins",
  "transformers",
  ".tweet_snapshots",
)

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

/** Parse a tweet block's body (one URL or bare id per line) into ordered slots. */
export function parseTweetReferences(body: string): { id: string; xcancelUrl: string }[] {
  const refs: { id: string; xcancelUrl: string }[] = []
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    const id = extractTweetId(line)
    if (!id) {
      throw new Error(`tweetEmbed: no tweet id found in line ${JSON.stringify(line)}`)
    }
    refs.push({ id, xcancelUrl: toXcancelUrl(line) })
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

/** Load a snapshot JSON by id; missing files resolve to null (→ stub). */
export async function loadSnapshot(
  id: string,
  dir: string = snapshotDir,
): Promise<TweetSnapshot | null> {
  const cacheKey = `${dir}:${id}`
  const cached = snapshotCache.get(cacheKey)
  if (cached !== undefined) return cached

  let snapshot: TweetSnapshot | null
  try {
    const raw = await fs.readFile(path.join(dir, `${id}.json`), "utf-8")
    snapshot = JSON.parse(raw) as TweetSnapshot
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      snapshot = null
    } else {
      throw error
    }
  }
  snapshotCache.set(cacheKey, snapshot)
  return snapshot
}

/** Clears the in-memory snapshot cache. Tests call this between runs. */
export function clearSnapshotCache(): void {
  snapshotCache.clear()
}

function resolveSlots(
  refs: readonly { id: string; xcancelUrl: string }[],
  dir: string,
): Promise<TweetSlot[]> {
  return Promise.all(
    refs.map(async (ref) => {
      const snapshot = await loadSnapshot(ref.id, dir)
      if (!snapshot) {
        logger.warn(
          `No snapshot for tweet ${ref.id}; rendering an xcancel stub. ` +
            "Run `uv run python scripts/tweet_snapshot.py` to capture it.",
        )
      }
      return { snapshot: snapshot ?? undefined, xcancelUrl: ref.xcancelUrl }
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
