import gitRoot from "find-git-root"
import path from "path"
import { fileURLToPath } from "url"

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
  specialDomainMappings: specialDomainMappingsConfig,
} = simpleConstants

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

// Computed file paths
const __filepath = fileURLToPath(import.meta.url)
const __dirname = path.dirname(gitRoot(__filepath))
export const faviconUrlsFile = path.join(
  __dirname,
  quartzFolder,
  "plugins",
  "transformers",
  ".faviconUrls.txt",
)
export const faviconCountsFile = path.join(
  __dirname,
  quartzFolder,
  "plugins",
  "transformers",
  ".faviconCounts.txt",
)

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
