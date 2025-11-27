import constantsJson from "../../config/constants.json"

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
  turntrout: `/static/images/${localTroutFaviconBasename}`,
  mail: "/static/svg/mail.svg",
  anchor: "/static/svg/anchor.svg",
  rss: "/static/svg/rss.svg",
  lesswrong: "/static/images/external-favicons/lesswrong_com.png",
} as const

// UI strings for various components
export const uiStrings = {
  propertyDefaults: {
    title: "Untitled",
  },
  components: {
    recentNotes: {
      title: "Recent Notes",
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
