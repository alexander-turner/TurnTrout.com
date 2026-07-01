/**
 * @jest-environment node
 */
import type { Element } from "hast"

import { describe, expect, it } from "@jest/globals"
import { toHtml } from "hast-util-to-html"

import {
  buildTweetCard,
  buildTweetEmbed,
  buildUnavailableCard,
  formatCount,
  formatTweetDate,
  linkifyTweetText,
  type TweetSnapshot,
} from "../tweetCard"

const baseSnapshot: TweetSnapshot = {
  id: "123",
  url: "https://xcancel.com/turntrout/status/123",
  author: {
    name: "Alex Turner",
    handle: "turntrout",
    verified: true,
    avatarSrc: "https://assets.turntrout.com/static/tweets/123/avatar.jpg",
  },
  createdAt: "2025-01-21T17:32:00.000Z",
  text: "Hello world",
  urls: [],
  media: [],
  snapshotAt: "2026-06-27T00:00:00+00:00",
}

const render = (node: Element): string => toHtml(node)

describe("formatTweetDate", () => {
  it("formats a valid ISO timestamp as month, day, and year in UTC", () => {
    expect(formatTweetDate("2025-01-21T17:32:00.000Z")).toBe("January 21st, 2025")
  })

  it.each([
    ["2025-06-01T12:00:00.000Z", "June 1st"],
    ["2025-06-02T12:00:00.000Z", "June 2nd"],
    ["2025-06-03T12:00:00.000Z", "June 3rd"],
    ["2025-06-04T12:00:00.000Z", "June 4th"],
    ["2025-06-11T12:00:00.000Z", "June 11th"],
    ["2025-06-12T12:00:00.000Z", "June 12th"],
    ["2025-06-13T12:00:00.000Z", "June 13th"],
    ["2025-06-21T12:00:00.000Z", "June 21st"],
    ["2025-06-22T12:00:00.000Z", "June 22nd"],
    ["2025-06-23T12:00:00.000Z", "June 23rd"],
  ])("applies an ordinal suffix to the day for %s", (iso, expected) => {
    expect(formatTweetDate(iso)).toContain(expected)
  })

  it("returns empty string for an unparseable timestamp", () => {
    expect(formatTweetDate("not a date")).toBe("")
  })
})

describe("linkifyTweetText", () => {
  it("links t.co entities to their expanded URL with display text", () => {
    const nodes = linkifyTweetText("see https://t.co/abc now", [
      { url: "https://t.co/abc", display: "example.com", expanded: "https://example.com" },
    ])
    const html = nodes.map((n) => (typeof n === "string" ? n : render(n))).join("")
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain(">example.com<")
    expect(html).not.toContain("t.co/abc")
  })

  it("links mentions, hashtags, and cashtags to xcancel", () => {
    const nodes = linkifyTweetText("@bob loves #ai and $TSLA", [])
    const html = nodes.map((n) => (typeof n === "string" ? n : render(n))).join("")
    expect(html).toContain('href="https://xcancel.com/bob"')
    expect(html).toContain("https://xcancel.com/search?q=%23ai")
    expect(html).toContain("https://xcancel.com/search?q=%24TSLA")
  })

  it("turns newlines into <br> and preserves surrounding text", () => {
    const nodes = linkifyTweetText("line one\nline two", [])
    const html = nodes.map((n) => (typeof n === "string" ? n : render(n))).join("")
    expect(html).toBe("line one<br>line two")
  })

  it("leaves entity URLs that do not appear in the text untouched", () => {
    const nodes = linkifyTweetText("plain text", [
      { url: "https://t.co/missing", display: "x", expanded: "https://x.test" },
    ])
    expect(nodes).toEqual(["plain text"])
  })

  it("handles consecutive newlines without emitting empty text nodes", () => {
    const nodes = linkifyTweetText("a\n\nb", [])
    expect(nodes.filter((n) => n === "")).toHaveLength(0)
  })

  it("drops the empty leading segment when an entity starts the text", () => {
    const nodes = linkifyTweetText("https://t.co/abc done", [
      { url: "https://t.co/abc", display: "x.test", expanded: "https://x.test" },
    ])
    expect(nodes.filter((n) => n === "")).toHaveLength(0)
    const html = nodes.map((n) => (typeof n === "string" ? n : render(n))).join("")
    expect(html).toContain('href="https://x.test"')
  })

  it("linkifies a text that is only a mention", () => {
    const nodes = linkifyTweetText("@bob", [])
    expect(nodes).toHaveLength(1)
    expect(render(nodes[0] as Element)).toContain("https://xcancel.com/bob")
  })

  it("marks body entity links no-favicon so the favicon pass skips them", () => {
    const nodes = linkifyTweetText("@bob see https://t.co/abc", [
      { url: "https://t.co/abc", display: "example.com", expanded: "https://example.com" },
    ])
    const anchors = nodes.filter((n): n is Element => typeof n !== "string")
    expect(anchors.length).toBeGreaterThan(0)
    for (const anchor of anchors) {
      expect(render(anchor)).toContain("no-favicon")
    }
  })
})

describe("buildTweetCard", () => {
  it("renders author, handle, body, and a plain-text date", () => {
    const html = render(buildTweetCard(baseSnapshot))
    expect(html).toContain("Alex Turner")
    expect(html).toContain("@turntrout")
    expect(html).toContain("Hello world")
    expect(html).toContain('<span class="tweet-date">January 21st, 2025</span>')
    expect(html).toContain('data-tweet-id="123"')
  })

  it("links the name and handle to the profile, and the source to the post", () => {
    const html = render(buildTweetCard(baseSnapshot))
    // Name and handle point at the profile (no trailing /status/...).
    expect(html).toContain('href="https://xcancel.com/turntrout"')
    expect(html).toContain('class="tweet-name-link no-favicon"')
    expect(html).toContain('class="tweet-handle no-favicon"')
    // The X-logo source link points at the post permalink.
    expect(html).toContain('href="https://xcancel.com/turntrout/status/123"')
    // The avatar is a plain image, not a link.
    expect(html).toContain('<span class="tweet-avatar-wrap"><img')
  })

  it("gives the icon-only source link an accessible name", () => {
    expect(render(buildTweetCard(baseSnapshot))).toContain('aria-label="View post on X"')
  })

  it("shows the verified badge only when verified", () => {
    expect(render(buildTweetCard(baseSnapshot))).toContain("tweet-verified")
    const unverified = { ...baseSnapshot, author: { ...baseSnapshot.author, verified: false } }
    expect(render(buildTweetCard(unverified))).not.toContain("tweet-verified")
  })

  it("keeps the verified badge outside the name anchor", () => {
    const html = render(buildTweetCard(baseSnapshot))
    // The anchor wraps only the name span and closes before the seal, which
    // then sits in the name row beside the now-closed anchor.
    expect(html).toContain(
      '<span class="tweet-name">Alex Turner</span></a><svg class="tweet-verified"',
    )
    expect(html).toContain('class="tweet-name-row"')
  })

  it("omits the date line when the timestamp is unparseable", () => {
    const undated = { ...baseSnapshot, createdAt: "" }
    expect(render(buildTweetCard(undated))).not.toContain("tweet-date")
  })

  it("twemojifies emoji in the card's text", () => {
    const withEmoji = { ...baseSnapshot, author: { ...baseSnapshot.author, name: "Alex 🟧" } }
    const html = render(buildTweetCard(withEmoji))
    // The orange-square glyph becomes an inline twemoji image, glued to its
    // preceding word so it can't wrap alone.
    expect(html).toContain('class="emoji"')
    expect(html).toContain("emoji-span")
  })

  it("renders a photo with its dimensions and alt text", () => {
    const withPhoto: TweetSnapshot = {
      ...baseSnapshot,
      media: [
        {
          type: "photo",
          src: "https://assets.turntrout.com/static/tweets/123/p.jpg",
          width: 800,
          height: 400,
          alt: "a photo",
        },
      ],
    }
    const html = render(buildTweetCard(withPhoto))
    expect(html).toContain('width="800"')
    expect(html).toContain('alt="a photo"')
    expect(html).toContain("tweet-media-count-1")
  })

  it("renders a looping video with a poster and a source element", () => {
    const withVideo: TweetSnapshot = {
      ...baseSnapshot,
      media: [
        {
          type: "video",
          src: "https://assets.turntrout.com/static/tweets/123/v.mp4",
          poster: "https://assets.turntrout.com/static/tweets/123/poster.jpg",
          loop: true,
        },
      ],
    }
    const html = render(buildTweetCard(withVideo))
    expect(html).toContain("<video")
    expect(html).toContain("loop")
    expect(html).toContain('type="video/mp4"')
    expect(html).toContain("poster=")
  })

  it("renders a video's width and height when present", () => {
    const withVideo: TweetSnapshot = {
      ...baseSnapshot,
      media: [
        {
          type: "video",
          src: "https://assets.turntrout.com/static/tweets/123/v.mp4",
          width: 640,
          height: 360,
        },
      ],
    }
    const html = render(buildTweetCard(withVideo))
    expect(html).toContain('width="640"')
    expect(html).toContain('height="360"')
  })

  it("renders a non-looping video without width/height when absent", () => {
    const withVideo: TweetSnapshot = {
      ...baseSnapshot,
      media: [{ type: "video", src: "https://assets.turntrout.com/static/tweets/123/v.mp4" }],
    }
    const html = render(buildTweetCard(withVideo))
    expect(html).toContain('no-vsc" controls playsinline>')
  })

  it("renders a photo without width/height/alt when absent", () => {
    const withPhoto: TweetSnapshot = {
      ...baseSnapshot,
      media: [{ type: "photo", src: "https://assets.turntrout.com/static/tweets/123/p.jpg" }],
    }
    const html = render(buildTweetCard(withPhoto))
    // An alt-less photo falls back to a non-empty alt so the link it sits in has
    // an accessible name (WCAG H30).
    expect(html).toContain('alt="View image" loading="lazy"></a></div>')
  })

  it("wraps a photo in a new-tab link to the full-size asset", () => {
    const src = "https://assets.turntrout.com/static/tweets/123/p.jpg"
    const withPhoto: TweetSnapshot = {
      ...baseSnapshot,
      media: [{ type: "photo", src, alt: "a photo" }],
    }
    const html = render(buildTweetCard(withPhoto))
    expect(html).toContain(
      `<a href="${src}" rel="noopener noreferrer" target="_blank" class="tweet-media-link no-favicon">`,
    )
    // A captioned photo keeps its own alt as the link's accessible name.
    expect(html).toContain('alt="a photo"')
  })

  it("gives an alt-less photo a fallback alt so its link has an accessible name", () => {
    const withPhoto: TweetSnapshot = {
      ...baseSnapshot,
      media: [{ type: "photo", src: "https://assets.turntrout.com/static/tweets/123/p.jpg" }],
    }
    expect(render(buildTweetCard(withPhoto))).toContain('alt="View image"')
  })

  it("does not wrap a video in a media link", () => {
    const withVideo: TweetSnapshot = {
      ...baseSnapshot,
      media: [{ type: "video", src: "https://assets.turntrout.com/static/tweets/123/v.mp4" }],
    }
    expect(render(buildTweetCard(withVideo))).not.toContain("tweet-media-link")
  })

  it("caps the media-count class at 4", () => {
    const photo = (n: number) => ({
      type: "photo" as const,
      src: `https://assets.turntrout.com/static/tweets/123/p${n}.jpg`,
    })
    const many: TweetSnapshot = {
      ...baseSnapshot,
      media: [photo(1), photo(2), photo(3), photo(4), photo(5)],
    }
    expect(render(buildTweetCard(many))).toContain("tweet-media-count-4")
  })
})

describe("quote tweets", () => {
  const quoted: TweetSnapshot["quoted"] = {
    id: "456",
    url: "https://xcancel.com/boazbaraktcs/status/456",
    author: {
      name: "Boaz Barak",
      handle: "boazbaraktcs",
      verified: false,
      avatarSrc: "https://assets.turntrout.com/static/tweets/123/quoted-avatar.jpg",
    },
    createdAt: "2025-01-20T10:00:00.000Z",
    text: "the original take @someone",
    urls: [],
    media: [],
  }

  it("renders the embedded quoted tweet's author, handle, date, and body", () => {
    const html = render(buildTweetCard({ ...baseSnapshot, quoted }))
    expect(html).toContain("tweet-quoted")
    expect(html).toContain('data-tweet-id="456"')
    expect(html).toContain("Boaz Barak")
    expect(html).toContain('href="https://xcancel.com/boazbaraktcs"')
    expect(html).toContain("the original take")
    // The quoted avatar is self-hosted, linkified mentions point at xcancel.
    expect(html).toContain("tweet-quoted-avatar")
    expect(html).toContain('href="https://xcancel.com/someone"')
    // The post date sits at the bottom of the quoted card (base is Jan 21, quote Jan 20).
    expect(html).toContain('<span class="tweet-quoted-date">January 20th, 2025</span>')
  })

  it("omits the quoted date line when the timestamp is unparseable", () => {
    const undated = { ...quoted, createdAt: "" }
    expect(render(buildTweetCard({ ...baseSnapshot, quoted: undated }))).not.toContain(
      "tweet-quoted-date",
    )
  })

  it("hides the quoted date when it matches the quoting tweet's date", () => {
    const sameDate = { ...quoted, createdAt: baseSnapshot.createdAt }
    const html = render(buildTweetCard({ ...baseSnapshot, quoted: sameDate }))
    // The quoted card omits its date; only the outer card shows the shared date.
    expect(html).not.toContain("tweet-quoted-date")
    expect((html.match(/January 21st, 2025/g) ?? []).length).toBe(1)
  })

  it("renders media inside the quoted card", () => {
    const withMedia = {
      ...quoted,
      media: [
        {
          type: "photo" as const,
          src: "https://assets.turntrout.com/static/tweets/123/quoted-media-0.jpg",
        },
      ],
    }
    const html = render(buildTweetCard({ ...baseSnapshot, quoted: withMedia }))
    expect(html).toMatch(/tweet-quoted[\s\S]*tweet-media-count-1/)
  })

  it("shows the verified seal on a verified quoted author", () => {
    // baseSnapshot's author is verified, so match the seal only within the
    // quoted block (after the marker) and contrast against the unverified quote.
    expect(render(buildTweetCard({ ...baseSnapshot, quoted }))).not.toMatch(
      /tweet-quoted[\s\S]*tweet-verified/,
    )
    const verifiedQuote = { ...quoted, author: { ...quoted.author, verified: true } }
    expect(render(buildTweetCard({ ...baseSnapshot, quoted: verifiedQuote }))).toMatch(
      /tweet-quoted[\s\S]*tweet-verified/,
    )
  })

  it("omits the quoted card when there is no quote", () => {
    expect(render(buildTweetCard(baseSnapshot))).not.toContain("tweet-quoted")
  })
})

describe("formatCount", () => {
  it.each([
    [165, "165"],
    [2000, "2K"],
    [1234, "1.2K"],
    [34832, "34.8K"],
    [1_000_000, "1M"],
    [1_500_000, "1.5M"],
  ])("formats %d as %s", (input, expected) => {
    expect(formatCount(input)).toBe(expected)
  })
})

describe("tweet metrics", () => {
  it("renders replies and likes when present", () => {
    const html = render(buildTweetCard({ ...baseSnapshot, metrics: { replies: 10, likes: 165 } }))
    expect(html).toContain("tweet-metrics")
    expect(html).toContain('aria-label="10 replies"')
    expect(html).toContain('aria-label="165 likes"')
  })

  it.each([
    ["replies only", { replies: 3 }, "3 replies", "likes"],
    ["likes only", { likes: 7 }, "7 likes", "replies"],
  ])("renders %s", (_label, metrics, present, absentLabel) => {
    const html = render(buildTweetCard({ ...baseSnapshot, metrics }))
    expect(html).toContain(present)
    expect(html).not.toContain(`${absentLabel}"`)
  })

  it("omits the metrics row when there are no metrics or an empty object", () => {
    expect(render(buildTweetCard(baseSnapshot))).not.toContain("tweet-metrics")
    expect(render(buildTweetCard({ ...baseSnapshot, metrics: {} }))).not.toContain("tweet-metrics")
  })
})

describe("retweet context", () => {
  it("renders a retweet header when retweetedBy is set", () => {
    const html = render(buildTweetCard(baseSnapshot, "Jeff Dean"))
    expect(html).toContain("tweet-retweet-context")
    expect(html).toContain("Jeff Dean retweeted")
  })

  it("omits the retweet header by default", () => {
    expect(render(buildTweetCard(baseSnapshot))).not.toContain("tweet-retweet-context")
  })
})

describe("buildUnavailableCard", () => {
  it("links to xcancel and is marked unavailable", () => {
    const html = render(buildUnavailableCard("https://xcancel.com/turntrout/status/999"))
    expect(html).toContain("tweet-card-unavailable")
    expect(html).toContain('href="https://xcancel.com/turntrout/status/999"')
    expect(html).toContain("View it on XCancel")
    expect(html).toContain("no-favicon")
  })
})

describe("buildTweetEmbed", () => {
  it("wraps a single resolved tweet without the thread class", () => {
    const html = render(buildTweetEmbed([{ snapshot: baseSnapshot, xcancelUrl: baseSnapshot.url }]))
    expect(html).toContain("tweet-embed")
    expect(html).not.toContain("tweet-thread")
  })

  it("renders multiple tweets as a thread", () => {
    const html = render(
      buildTweetEmbed([
        { snapshot: baseSnapshot, xcancelUrl: baseSnapshot.url },
        { snapshot: { ...baseSnapshot, id: "124" }, xcancelUrl: baseSnapshot.url },
      ]),
    )
    expect(html).toContain("tweet-thread")
    expect(html).toContain('data-tweet-id="123"')
    expect(html).toContain('data-tweet-id="124"')
  })

  it("stubs slots without a snapshot", () => {
    const html = render(
      buildTweetEmbed([{ xcancelUrl: "https://xcancel.com/turntrout/status/777" }]),
    )
    expect(html).toContain("tweet-card-unavailable")
    expect(html).toContain("status/777")
  })

  it("passes a slot's retweetedBy through to the card", () => {
    const html = render(
      buildTweetEmbed([
        { snapshot: baseSnapshot, xcancelUrl: baseSnapshot.url, retweetedBy: "Jeff Dean" },
      ]),
    )
    expect(html).toContain("Jeff Dean retweeted")
  })
})
