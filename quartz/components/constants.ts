import constantsJson from "../../config/constants.json" with { type: "json" }

export const simpleConstants = constantsJson

// Export individual properties from simpleConstants for direct imports
export const {
  defaultCardUrl,
  defaultCardAlt,
  defaultTitle,
  defaultDescription,
  locale,
  localTroutFaviconExtensionDefault,
  localTroutFaviconBasenameDefault,
  faviconMimeType,
  appleTouchIconUrl,
  faviconBasePath,
  minFaviconCount,
  maxAtomicInlineCodeLength,
  googleSubdomainAllowlist,
  faviconCountAllowlist,
  faviconSubstringBlocklist,
  sessionStoragePondVideoKey,
  pondVideoId,
  invertInDarkModeClass,
  forceHslInvertClass,
  debounceSearchDelay,
  mouseFocusDelay,
  searchPlaceholderDesktop,
  searchPlaceholderMobile,
  defaultPath,
  quartzFolder,
  contentDirName,
  faviconFolder,
  faviconExtensions,
  debounceWaitMs,
  popoverScrollOffset,
  popoverPadding,
  nodeTypeElement,
  emojiReplacement,
  twemojiBaseUrl,
  emojisToReplace,
  charsToMoveIntoLinkFromRight,
  footnoteHeadingId,
  similarPostsHeadingId,
  tocMaxDepth,
  testPageSlug,
  designPageSlug,
  tightScrollTolerance,
  scrollTolerance,
  urlBarScrollTolerance,
  listTolerance,
  playwrightConfigs,
  savedThemeKey,
  autoplayStorageKey,
  instantScrollRestoreKey,
  scrollPositionKeyPrefix,
  scrollPositionTimestampKeyPrefix,
  scrollPositionMaxAgeMs,
  scrollPositionMinThreshold,
  cdnBaseUrl,
  imageCacheVersion,
  popoverRemovalDelayMs,
  dropcapColors: DROPCAP_COLORS,
  colorDropcapProbability,
  specialDomainMappings: specialDomainMappingsConfig,
} = simpleConstants

// Unicode typography constants
export const {
  nbsp: NBSP,
  hairSpace: HAIR_SPACE,
  leftSingleQuote: LEFT_SINGLE_QUOTE,
  rightSingleQuote: RIGHT_SINGLE_QUOTE,
  leftDoubleQuote: LEFT_DOUBLE_QUOTE,
  rightDoubleQuote: RIGHT_DOUBLE_QUOTE,
  wordJoiner: WORD_JOINER,
  rightGuillemet: RIGHT_GUILLEMET,
  ellipsis: ELLIPSIS,
} = constantsJson.unicodeTypography

/**
 * Inline tags whose first/last text-child should be trimmed of whitespace.
 * Shared with `scripts/built_site_checks.py:_STRIP_BOUNDARY_TAGS`; keep in
 * sync via `config/constants.json`.
 */
export const STRIP_BOUNDARY_TAGS: ReadonlySet<string> = new Set(
  constantsJson.stripBoundaryWhitespaceTags,
)

/** Normalize non-breaking spaces to regular spaces */
export function normalizeNbsp(s: string): string {
  return s.replace(new RegExp(NBSP, "g"), " ")
}

// Private Use Area marker characters (U+F000 range to avoid conflict with Tengwar fonts at U+E000)
export const twemojiIgnoreChars = {
  emojiReplacement: "\uF001",
  doubleArrow: "\uF002", // ⇔
  upRightArrow: "\uF003", // ↗
} as const

// Computed constants
export const faviconUrl = `/${localTroutFaviconBasenameDefault}.${localTroutFaviconExtensionDefault}`

export const localTroutFaviconBasename = `${localTroutFaviconBasenameDefault}.${localTroutFaviconExtensionDefault}`

// Special favicon paths for different link types
export const specialFaviconPaths = {
  mail: `${simpleConstants.faviconBasePath}/mail.svg`,
  anchor: `${simpleConstants.faviconBasePath}/anchor.svg`,
  rss: `${simpleConstants.faviconBasePath}/rss.svg`,
  turntrout: `${simpleConstants.faviconBasePath}/turntrout_com.svg`,
  lesswrong: `${simpleConstants.faviconBasePath}/lesswrong_com.svg`,
} as const

// Computed special domain mappings with RegExp patterns
export const specialDomainMappings: ReadonlyArray<{ pattern: RegExp; to: string }> = [
  // Preserve allowlisted Google subdomains (map to themselves)
  ...googleSubdomainAllowlist.map((subdomain) => ({
    pattern: new RegExp(`^${subdomain.replace(".", "\\.")}\\.google\\.com$`),
    to: `${subdomain}.google.com`,
  })),
  // Cross-domain mappings from config
  ...specialDomainMappingsConfig.map((mapping) => ({
    pattern: new RegExp(mapping.pattern),
    to: mapping.to,
  })),
]

// Desktop ToC active-heading detection: a heading counts as the current
// section while it sits within the top `TOC_DETECTION_BAND_FRACTION` of the
// viewport. `TOC_DETECTION_ROOT_MARGIN` derives the IntersectionObserver
// margin from the same fraction so the two never drift apart.
export const TOC_DETECTION_BAND_FRACTION = 0.3
export const TOC_DETECTION_ROOT_MARGIN = `0px 0px -${(1 - TOC_DETECTION_BAND_FRACTION) * 100}% 0px`

// Vim-scrolloff for the desktop ToC: keep this many ToC entries visible beyond
// the active link on each side when auto-scrolling the sidebar to follow along.
export const TOC_SCROLLOFF_COUNT = 2
// Breathing room (px) between the scrolloff anchor and the sidebar edge, so
// buffered entries don't sit flush under the scroll-fade gradient.
export const TOC_AUTOSCROLL_PADDING_PX = 8
// After the user scrolls the sidebar themselves (e.g. down to the read time),
// hold off auto-scrolling so the ToC doesn't fight their manual browsing.
export const TOC_MANUAL_SCROLL_GRACE_MS = 4000

// External link attributes
export const EXTERNAL_LINK_REL = "noopener noreferrer"

// HTML tag groups reused across transformers/components
export const HEADING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])
export const MEDIA_TAGS: ReadonlySet<string> = new Set(["img", "video", "audio", "iframe"])

// Shared CSS class names (used across multiple components/scripts)
export const PREVIEWABLE_CLASS = "previewable"
export const CAN_TRIGGER_POPOVER_CLASS = "can-trigger-popover"
export const SEARCH_MATCH_CLASS = "search-match"

// Inline-content class names shared by the formatting pipeline (twemoji,
// favicons, small-caps, KaTeX) and the consumers that sanitize or re-render its
// output (backlink excerpts). Single source of truth so producers and
// consumers can't drift. `EMOJI_CLASS`/`KATEX_CLASS` are emitted by the twemoji
// and KaTeX libraries respectively; the constants document the value we match.
export const EMOJI_CLASS = "emoji"
export const EMOJI_SPAN_CLASS = "emoji-span"
// Authored glyph-sized inline images (SafeLife sprites, the agent chevron, …),
// styled at `0.9rem` in `custom.scss`. Like emoji, each reads as a single inline
// atom, so backlink excerpts preserve them verbatim rather than dropping them as
// block media. The constant documents the value the sanitizer matches.
export const INLINE_IMG_CLASS = "inline-img"
// Intrinsic pixel dimensions of a Twemoji SVG (its `viewBox` is `0 0 36 36`).
// In article bodies the `assetDimensions` transformer fetches and stamps this,
// but titles render at component time without that pass, so their emoji `<img>`
// need the size stamped here to satisfy the `images_missing_dimensions` check
// and avoid layout shift. CSS still renders them at `1em`.
export const TWEMOJI_INTRINSIC_DIMENSION = 36
export const FAVICON_CLASS = "favicon"
export const FAVICON_SPAN_CLASS = "favicon-span"
export const KATEX_CLASS = "katex"
export const SMALL_CAPS_CLASS = "small-caps"
export const BACKLINK_HIGHLIGHT_CLASS = "backlink-highlight"
export const BACKLINK_EXCERPT_CLASS = "backlink-excerpt"
// Marks rendered title-like text (page titles, backlink titles, prev/next post
// titles, sequence titles, …) so every title-rendering surface gets the same
// typographic treatment (e.g. lining-figure numerals) from one CSS rule
// instead of a selector hand-maintained per component.
export const WORK_TITLE_CLASS = "work-title"

// Title-binding links: when an internal link's display text is exactly this
// sentinel, its text is replaced at build time with the up-to-date title of the
// target page (or the target section heading, for `#anchor` links). See
// `quartz/plugins/transformers/bindLinkTitles.ts`. Shared with the built-site
// checker via `config/constants.json` so the two can't disagree on the token.
export const LINK_TITLE_SENTINEL: string = constantsJson.linkTitleSentinel
// Same as LINK_TITLE_SENTINEL, but renders the target title lowercased so it
// reads naturally mid-sentence.
export const LINK_TITLE_LOWER_SENTINEL: string = constantsJson.linkTitleLowerSentinel

// UI strings for various components
export const uiStrings = {
  propertyDefaults: {
    title: "Untitled",
  },
  components: {
    recentNotes: {
      title: "Recent notes",
      seeRemainingMore: (count: number) => `See ${count} more →`,
    },
  },
  pages: {
    rss: {
      recentNotes: "Recent notes",
      lastFewNotes: (count: number) => `Last ${count} notes`,
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Tag index",
      itemsUnderTag: (count: number) => `${count} item${count !== 1 ? "s" : ""} with this tag.`,
    },
  },
} as const
