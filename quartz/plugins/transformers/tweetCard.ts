import type { Element } from "hast"

import { h, s } from "hastscript"

import { EXTERNAL_LINK_REL } from "../../components/constants"
import { getOrdinalSuffix } from "../../components/Date"
import { processTree } from "./twemoji"

/** A single photo or video attached to a tweet. URLs already point at the CDN. */
export interface TweetMedia {
  type: "photo" | "video"
  src: string
  poster?: string
  width?: number | null
  height?: number | null
  alt?: string
  loop?: boolean
}

/** A `t.co` link entity: the short URL as it appears in the text, plus how to display and resolve it. */
export interface TweetUrl {
  url: string
  display: string
  expanded: string
}

/** Engagement counts captured at snapshot time (cookie-free endpoint: replies + likes only). */
export interface TweetMetrics {
  replies?: number
  likes?: number
}

/** The post author, as shown in the card header. */
export interface TweetAuthor {
  name: string
  handle: string
  verified: boolean
  avatarSrc: string
}

/** The tweet a quote-tweet embeds: a nested card with no metrics row of its own. */
export interface QuotedTweet {
  id: string
  url: string
  author: TweetAuthor
  createdAt: string
  text: string
  urls: readonly TweetUrl[]
  media: readonly TweetMedia[]
}

/** Normalized snapshot of one tweet, as written by `scripts/tweet_snapshot.py`. */
export interface TweetSnapshot {
  id: string
  url: string
  author: TweetAuthor
  createdAt: string
  text: string
  urls: readonly TweetUrl[]
  media: readonly TweetMedia[]
  quoted?: QuotedTweet
  metrics?: TweetMetrics
  snapshotAt: string
}

const XCANCEL_BASE = "https://xcancel.com"

// X wordmark (the post source link) and the verified seal, inlined so the card
// needs no extra network requests.
const X_LOGO_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
const VERIFIED_PATH =
  "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.68.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.26 2.52-.81 3.91c-1.31.66-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.45 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"
const RETWEET_PATH =
  "M4.75 3.79l4.603 4.3-1.706 1.82L6 8.38v7.37c0 .97.784 1.75 1.75 1.75H13V20H7.75c-2.347 0-4.25-1.9-4.25-4.25V8.38L1.853 9.91.147 8.09l4.603-4.3zm11.5 2.71H11V4h5.25c2.347 0 4.25 1.9 4.25 4.25v7.37l1.647-1.53 1.706 1.82-4.603 4.3-4.603-4.3 1.706-1.82L18 15.62V8.25c0-.97-.784-1.75-1.75-1.75z"
// The engagement-row icons (reply + like) are single-line outlines drawn at one
// shared stroke width (see .tweet-metric-icon), so both read at the same visual
// weight and the like count never looks like a filled "liked" heart.
const REPLY_PATH =
  "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
const HEART_PATH =
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

/**
 * Format a tweet's ISO timestamp as `Month Dth, YYYY` in UTC (e.g.
 * `June 30th, 2026`). UTC keeps the output deterministic across build machines.
 * Returns "" for an unparseable timestamp so the date line is simply omitted.
 */
export function formatTweetDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const month = MONTHS[date.getUTCMonth()]
  const dayNum = date.getUTCDate()
  const day = `${dayNum}${getOrdinalSuffix(dayNum)}`
  return `${month} ${day}, ${date.getUTCFullYear()}`
}

const MENTION_OR_TAG = /[@#$]\w+/g

function externalAnchor(
  href: string,
  children: (Element | string)[],
  className: string,
  ariaLabel?: string,
): Element {
  // Every link inside a tweet embed opts out of the site favicon pass, which
  // would otherwise stamp an X icon on each one.
  const props: Record<string, string> = {
    href,
    rel: EXTERNAL_LINK_REL,
    target: "_blank",
    className: `${className} no-favicon`,
  }
  if (ariaLabel) props["aria-label"] = ariaLabel
  return h("a", props, children)
}

/** Linkify @mentions, #hashtags, and $cashtags within a plain-text run, pointing at xcancel. */
function linkifyTokens(text: string): (Element | string)[] {
  const nodes: (Element | string)[] = []
  let lastIndex = 0
  for (const match of text.matchAll(MENTION_OR_TAG)) {
    const token = match[0]
    // istanbul ignore next -- matchAll always sets index; ?? 0 is a type guard
    const index = match.index ?? 0
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index))
    const body = token.slice(1)
    const href =
      token[0] === "@"
        ? `${XCANCEL_BASE}/${body}`
        : `${XCANCEL_BASE}/search?q=${encodeURIComponent(token)}`
    nodes.push(externalAnchor(href, [token], "tweet-entity"))
    lastIndex = index + token.length
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

/** Split a string run on newlines, turning each break into a `<br>`. */
function withLineBreaks(nodes: (Element | string)[]): (Element | string)[] {
  return nodes.flatMap((node) => {
    if (typeof node !== "string" || !node.includes("\n")) return [node]
    const parts = node.split("\n")
    const out: (Element | string)[] = []
    parts.forEach((part, index) => {
      if (index > 0) out.push(h("br"))
      if (part) out.push(part)
    })
    return out
  })
}

/**
 * Turn a tweet's raw text into hast: `t.co` links become anchors to their
 * expanded targets (shown as the human-readable display URL), @mentions and
 * #hashtags link to xcancel, and newlines become `<br>`.
 */
export function linkifyTweetText(text: string, urls: readonly TweetUrl[]): (Element | string)[] {
  let nodes: (Element | string)[] = [text]
  for (const entity of urls) {
    nodes = nodes.flatMap((node) => {
      if (typeof node !== "string" || !node.includes(entity.url)) return [node]
      const segments = node.split(entity.url)
      const out: (Element | string)[] = []
      segments.forEach((segment, index) => {
        if (index > 0) {
          out.push(externalAnchor(entity.expanded, [entity.display], "tweet-entity tweet-link"))
        }
        if (segment) out.push(segment)
      })
      return out
    })
  }
  nodes = nodes.flatMap((node) => (typeof node === "string" ? linkifyTokens(node) : [node]))
  return withLineBreaks(nodes)
}

/** A 24×24 inline icon. Decorative by default; pass an `aria-label` to expose it. */
function icon(path: string, className: string, props: Record<string, string> = {}): Element {
  const a11y = "aria-label" in props ? {} : { "aria-hidden": "true" }
  return s("svg", { className, viewBox: "0 0 24 24", ...a11y, ...props }, [s("path", { d: path })])
}

function mediaNode(media: TweetMedia): Element {
  if (media.type === "video") {
    return h(
      "video",
      {
        className: "tweet-media tweet-media-video no-vsc",
        controls: true,
        playsInline: true,
        loop: media.loop ?? false,
        muted: media.loop ?? false,
        poster: media.poster,
        ...(media.width ? { width: media.width } : {}),
        ...(media.height ? { height: media.height } : {}),
      },
      [h("source", { src: media.src, type: "video/mp4" })],
    )
  }
  // The img is the link's only content, so its alt is what conveys the link's
  // purpose (WCAG H30). It must be non-empty: fall back to "View image" when the
  // tweet supplies no alt text, otherwise a screen reader announces an unlabeled
  // link.
  const img = h("img", {
    className: "tweet-media tweet-media-photo",
    src: media.src,
    alt: media.alt || "View image",
    loading: "lazy",
    ...(media.width ? { width: media.width } : {}),
    ...(media.height ? { height: media.height } : {}),
  })
  // Wrap the photo so a click opens the full-size asset in a new tab; the grid
  // cover-crops the thumbnail, so this is the only way to see the whole image.
  // `display: contents` (see tweet.scss) keeps the img as the grid item.
  return externalAnchor(media.src, [img], "tweet-media-link")
}

// Whether a grid's bottom edge cuts through clipped image content—and therefore
// fades into the card—is decided at runtime by tweet-media-fade.inline.ts, which
// measures the rendered cells against each image's intrinsic aspect ratio. The
// width/height attributes on each media element feed that measurement.
function mediaGrid(media: readonly TweetMedia[]): Element[] {
  if (media.length === 0) return []
  return [
    h(
      "div",
      { className: `tweet-media-grid tweet-media-count-${Math.min(media.length, 4)}` },
      media.map(mediaNode),
    ),
  ]
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** Compact engagement count, Twitter-style: 165, 1.2K, 34.8K, 1.2M. */
export function formatCount(n: number): string {
  return compactNumber.format(n)
}

function metric(path: string, label: string, value: number): Element {
  return h("span", { className: "tweet-metric" }, [
    icon(path, "tweet-metric-icon"),
    h(
      "span",
      { className: "tweet-metric-count", "aria-label": `${value} ${label}` },
      formatCount(value),
    ),
  ])
}

/** A row of engagement counts (replies, likes); empty array when none are known. */
function metricsRow(metrics: TweetMetrics | undefined): Element[] {
  if (!metrics) return []
  const items: Element[] = []
  if (typeof metrics.replies === "number")
    items.push(metric(REPLY_PATH, "replies", metrics.replies))
  if (typeof metrics.likes === "number") items.push(metric(HEART_PATH, "likes", metrics.likes))
  return items.length ? [h("div", { className: "tweet-metrics" }, items)] : []
}

/** The "<name> retweeted" context line shown above a card. */
function retweetContext(name: string): Element {
  return h("div", { className: "tweet-retweet-context" }, [
    icon(RETWEET_PATH, "tweet-retweet-icon"),
    h("span", `${name} retweeted`),
  ])
}

/**
 * The name line: display name, verified seal, and `@handle` all on one row.
 * The seal stays outside the name anchor so only the name is that link.
 */
function authorNameRow(author: TweetAuthor, profileUrl: string): Element {
  const children: (Element | string)[] = [
    externalAnchor(
      profileUrl,
      [h("span", { className: "tweet-name" }, author.name)],
      "tweet-name-link",
    ),
  ]
  if (author.verified) {
    children.push(
      icon(VERIFIED_PATH, "tweet-verified", { "aria-label": "Verified account", role: "img" }),
    )
  }
  children.push(externalAnchor(profileUrl, [`@${author.handle}`], "tweet-handle"))
  return h("span", { className: "tweet-name-row" }, children)
}

/**
 * Nested card for the tweet a quote-tweet embeds: header (avatar, name,
 * `@handle`), body, media, and a bottom date. The date is omitted when it
 * matches the quoting tweet's own date (`outerDate`), since repeating it reads
 * as noise.
 */
function quotedCard(quoted: QuotedTweet, outerDate: string): Element {
  const profileUrl = `${XCANCEL_BASE}/${quoted.author.handle}`
  const header = h("div", { className: "tweet-quoted-header" }, [
    h("img", {
      className: "tweet-quoted-avatar",
      src: quoted.author.avatarSrc,
      alt: "",
      loading: "lazy",
      width: 24,
      height: 24,
    }),
    authorNameRow(quoted.author, profileUrl),
  ])
  const body = h("div", { className: "tweet-body" }, linkifyTweetText(quoted.text, quoted.urls))
  const children: Element[] = [header, body, ...mediaGrid(quoted.media)]
  const formattedDate = formatTweetDate(quoted.createdAt)
  if (formattedDate && formattedDate !== outerDate) {
    children.push(h("span", { className: "tweet-quoted-date" }, formattedDate))
  }
  return h("div", { className: "tweet-quoted", "data-tweet-id": quoted.id }, children)
}

/** Build the rendered card for a single resolved tweet. */
export function buildTweetCard(snapshot: TweetSnapshot, retweetedBy?: string): Element {
  const { author } = snapshot

  // The avatar, name, and handle point at the author's profile; the X logo is
  // the permalink to the post.
  const profileUrl = `${XCANCEL_BASE}/${author.handle}`
  const header = h("div", { className: "tweet-header" }, [
    h("span", { className: "tweet-avatar-wrap" }, [
      h("img", {
        className: "tweet-avatar",
        src: author.avatarSrc,
        alt: "",
        loading: "lazy",
        width: 48,
        height: 48,
      }),
    ]),
    h("div", { className: "tweet-author" }, [authorNameRow(author, profileUrl)]),
    externalAnchor(
      snapshot.url,
      [icon(X_LOGO_PATH, "tweet-x-logo")],
      "tweet-source-link",
      "View post on X",
    ),
  ])

  const body = h("div", { className: "tweet-body" }, linkifyTweetText(snapshot.text, snapshot.urls))

  const children: Element[] = []
  if (retweetedBy) children.push(retweetContext(retweetedBy))
  children.push(header, body, ...mediaGrid(snapshot.media))

  const formatted = formatTweetDate(snapshot.createdAt)
  if (snapshot.quoted) children.push(quotedCard(snapshot.quoted, formatted))
  if (formatted) {
    children.push(h("span", { className: "tweet-date" }, formatted))
  }
  children.push(...metricsRow(snapshot.metrics))

  // TweetEmbed runs after the global Twemoji pass, so the card's text (names,
  // body, quoted text) is built too late to be picked up. Twemojify it here so
  // emoji in a tweet render as inline images like the rest of the site.
  const article = h("article", { className: "tweet-card", "data-tweet-id": snapshot.id }, children)
  return processTree(article) as Element
}

/** Fallback card for a tweet that resolved from neither a snapshot nor R2. */
export function buildUnavailableCard(xcancelUrl: string): Element {
  return h("article", { className: "tweet-card tweet-card-unavailable" }, [
    h("p", { className: "tweet-body" }, [
      "This post could not be embedded. ",
      externalAnchor(xcancelUrl, ["View it on XCancel."], "tweet-entity"),
    ]),
  ])
}

/** A slot in a tweet embed: a resolved snapshot, or just the xcancel URL to stub. */
export interface TweetSlot {
  snapshot?: TweetSnapshot
  xcancelUrl: string
  retweetedBy?: string
}

/**
 * Render one tweet as a standalone card, or several as a connected thread. The
 * `tweet-thread` wrapper drives the continuous left rail between cards in CSS.
 */
export function buildTweetEmbed(slots: readonly TweetSlot[]): Element {
  const cards = slots.map((slot) =>
    slot.snapshot
      ? buildTweetCard(slot.snapshot, slot.retweetedBy)
      : buildUnavailableCard(slot.xcancelUrl),
  )
  if (cards.length === 1) {
    return h("div", { className: "tweet-embed" }, cards)
  }
  return h("div", { className: "tweet-embed tweet-thread" }, cards)
}
