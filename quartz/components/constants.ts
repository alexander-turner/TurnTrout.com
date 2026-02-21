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
  googleSubdomainWhitelist,
  faviconCountWhitelist,
  faviconSubstringBlacklist,
  sessionStoragePondVideoKey,
  pondVideoId,
  debounceSearchDelay,
  mouseFocusDelay,
  searchPlaceholderDesktop,
  searchPlaceholderMobile,
  defaultPath,
  quartzFolder,
  faviconFolder,
  debounceWaitMs,
  popoverScrollOffset,
  popoverPadding,
  nodeTypeElement,
  emojiReplacement,
  twemojiBaseUrl,
  emojisToReplace,
  charsToMoveIntoLinkFromRight,
  testPageSlug,
  designPageSlug,
  tightScrollTolerance,
  scrollTolerance,
  listTolerance,
  playwrightConfigs,
  savedThemeKey,
  autoplayStorageKey,
  instantScrollRestoreKey,
  cdnBaseUrl,
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
} = constantsJson.unicodeTypography

/** Normalize non-breaking spaces to regular spaces */
export function normalizeNbsp(s: string): string {
  return s.replace(new RegExp(NBSP, "g"), " ")
}

// Private Use Area marker characters (U+F000 range to avoid conflict with Tengwar fonts at U+E000)
export const markerChar = "\uF000" // Used for text transformation markers
export const hatTipPlaceholder = "\uF010" // Used for h/t placeholder
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
export const specialDomainMappings: Array<{ pattern: RegExp; to: string }> = [
  // Preserve whitelisted Google subdomains (map to themselves)
  ...googleSubdomainWhitelist.map((subdomain) => ({
    pattern: new RegExp(`^${subdomain.replace(".", "\\.")}\\.google\\.com$`),
    to: `${subdomain}.google.com`,
  })),
  // Cross-domain mappings from config
  ...specialDomainMappingsConfig.map((mapping) => ({
    pattern: new RegExp(mapping.pattern),
    to: mapping.to,
  })),
]

// External link attributes
export const EXTERNAL_LINK_REL = "noopener noreferrer"

// Shared CSS class names (used across multiple components/scripts)
export const PREVIEWABLE_CLASS = "previewable"
export const CAN_TRIGGER_POPOVER_CLASS = "can-trigger-popover"
export const SEARCH_MATCH_CLASS = "search-match"

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
