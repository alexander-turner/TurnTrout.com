import type { Element } from "hast"

import { h, s } from "hastscript"

import { EXTERNAL_LINK_REL } from "../../components/constants"

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

/** Normalized snapshot of one tweet, as written by `scripts/tweet_snapshot.py`. */
export interface TweetSnapshot {
  id: string
  url: string
  author: {
    name: string
    handle: string
    verified: boolean
    avatarSrc: string
  }
  createdAt: string
  text: string
  urls: readonly TweetUrl[]
  media: readonly TweetMedia[]
  snapshotAt: string
}

const XCANCEL_BASE = "https://xcancel.com"

// X wordmark (the post source link) and the verified seal, inlined so the card
// needs no extra network requests.
const X_LOGO_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
const VERIFIED_PATH =
  "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.68.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.26 2.52-.81 3.91c-1.31.66-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.45 1.39-.2 2.9.81 3.91s2.52 1.26 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/**
 * Format a tweet's ISO timestamp as `h:mm AM/PM · Mon D, YYYY` in UTC.
 * UTC keeps the output deterministic across build machines. Returns "" for an
 * unparseable timestamp so the date line is simply omitted.
 */
export function formatTweetDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const hours24 = date.getUTCHours()
  const meridiem = hours24 < 12 ? "AM" : "PM"
  const hours12 = hours24 % 12 || 12
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  const month = MONTHS[date.getUTCMonth()]
  return `${hours12}:${minutes} ${meridiem} · ${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

const MENTION_OR_TAG = /[@#$]\w+/g

function externalAnchor(
  href: string,
  children: (Element | string)[],
  className: string,
  ariaLabel?: string,
): Element {
  const props: Record<string, string> = {
    href,
    rel: EXTERNAL_LINK_REL,
    target: "_blank",
    className,
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

function verifiedBadge(): Element {
  return s(
    "svg",
    {
      className: "tweet-verified",
      viewBox: "0 0 24 24",
      "aria-label": "Verified account",
      role: "img",
    },
    [s("path", { d: VERIFIED_PATH })],
  )
}

function xLogo(): Element {
  return s("svg", { className: "tweet-x-logo", viewBox: "0 0 24 24", "aria-hidden": "true" }, [
    s("path", { d: X_LOGO_PATH }),
  ])
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
  return h("img", {
    className: "tweet-media tweet-media-photo",
    src: media.src,
    alt: media.alt || "",
    loading: "lazy",
    ...(media.width ? { width: media.width } : {}),
    ...(media.height ? { height: media.height } : {}),
  })
}

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

/** Build the rendered card for a single resolved tweet. */
export function buildTweetCard(snapshot: TweetSnapshot): Element {
  const { author } = snapshot
  const nameChildren: (Element | string)[] = [h("span", { className: "tweet-name" }, author.name)]
  if (author.verified) nameChildren.push(verifiedBadge())

  const authorLabel = `${author.name} (@${author.handle})`
  const header = h("div", { className: "tweet-header" }, [
    externalAnchor(
      snapshot.url,
      [
        h("img", {
          className: "tweet-avatar",
          src: author.avatarSrc,
          alt: "",
          loading: "lazy",
          width: 48,
          height: 48,
        }),
      ],
      "tweet-avatar-link",
      authorLabel,
    ),
    h("div", { className: "tweet-author" }, [
      externalAnchor(snapshot.url, nameChildren, "tweet-name-link"),
      externalAnchor(snapshot.url, [`@${author.handle}`], "tweet-handle"),
    ]),
    externalAnchor(snapshot.url, [xLogo()], "tweet-source-link", "View post on X"),
  ])

  const body = h("div", { className: "tweet-body" }, linkifyTweetText(snapshot.text, snapshot.urls))

  const children: Element[] = [header, body, ...mediaGrid(snapshot.media)]

  const formatted = formatTweetDate(snapshot.createdAt)
  if (formatted) {
    children.push(externalAnchor(snapshot.url, [formatted], "tweet-date"))
  }

  return h("article", { className: "tweet-card", "data-tweet-id": snapshot.id }, children)
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
}

/**
 * Render one tweet as a standalone card, or several as a connected thread. The
 * `tweet-thread` wrapper drives the continuous left rail between cards in CSS.
 */
export function buildTweetEmbed(slots: readonly TweetSlot[]): Element {
  const cards = slots.map((slot) =>
    slot.snapshot ? buildTweetCard(slot.snapshot) : buildUnavailableCard(slot.xcancelUrl),
  )
  if (cards.length === 1) {
    return h("div", { className: "tweet-embed" }, cards)
  }
  return h("div", { className: "tweet-embed tweet-thread" }, cards)
}
