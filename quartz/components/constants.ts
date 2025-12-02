import constantsJson from "../../config/constants.json" assert { type: "json" }

// Re-export simple constants from JSON
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
} = constantsJson

// Computed constants
export const faviconUrl = `${faviconBasePath}/${localTroutFaviconBasenameDefault}.${localTroutFaviconExtensionDefault}`

export const localTroutFaviconBasename = `${localTroutFaviconBasenameDefault}.${localTroutFaviconExtensionDefault}`

// Special favicon paths for different link types
export const specialFaviconPaths = {
  mail: `${faviconBasePath}/mail.svg`,
  anchor: `${faviconBasePath}/anchor.svg`,
  rss: `${faviconBasePath}/rss.svg`,
  turntrout: `${faviconBasePath}/turntrout_com.svg`,
  lesswrong: `${faviconBasePath}/lesswrong_com.svg`,
} as const

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
      tagIndex: "Tag Index",
      itemsUnderTag: (count: number) => `${count} item${count !== 1 ? "s" : ""} under this tag.`,
    },
  },
} as const
