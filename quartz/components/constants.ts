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
  leftSingleQuote: LEFT_SINGLE_QUOTE,
  rightSingleQuote: RIGHT_SINGLE_QUOTE,
  leftDoubleQuote: LEFT_DOUBLE_QUOTE,
  rightDoubleQuote: RIGHT_DOUBLE_QUOTE,
  wordJoiner: WORD_JOINER,
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

// External link attributes
export const EXTERNAL_LINK_REL = "noopener noreferrer"

// HTML tag groups reused across transformers/components
export const HEADING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])
export const MEDIA_TAGS: ReadonlySet<string> = new Set(["img", "video", "audio", "iframe"])

// Shared CSS class names (used across multiple components/scripts)
export const PREVIEWABLE_CLASS = "previewable"
export const CAN_TRIGGER_POPOVER_CLASS = "can-trigger-popover"
export const SEARCH_MATCH_CLASS = "search-match"

// Title-binding links: when an internal link's display text is exactly this
// sentinel, its text is replaced at build time with the up-to-date title of the
// target page (or the target section heading, for `#anchor` links). See
// `quartz/plugins/transformers/bindLinkTitles.ts`. Shared with the built-site
// checker via `config/constants.json` so the two can't disagree on the token.
export const LINK_TITLE_SENTINEL: string = constantsJson.linkTitleSentinel

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
