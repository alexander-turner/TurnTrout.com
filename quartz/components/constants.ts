export const defaultCardUrl = "https://assets.turntrout.com/static/images/fb_preview.png"
export const defaultTitle = "The Pond"
export const defaultDescription = "Writings about doing good, thinking well, and living happily."
export const locale = "en-US"

// Site-specific icon/favicon paths
export const localTroutFaviconExtensionDefault = "svg"
export const localTroutFaviconBasenameDefault = "favicon"
export const localTroutFaviconBasename = `${localTroutFaviconBasenameDefault}.${localTroutFaviconExtensionDefault}`
export const faviconUrl = `/${localTroutFaviconBasename}`
export const appleTouchIconUrl = "https://assets.turntrout.com/static/images/apple-icon.png"

// Unified favicon paths - all special icons that should always be whitelisted
const faviconBasePath = "https://assets.turntrout.com/static/images/external-favicons"
export const specialFaviconPaths = {
  mail: `${faviconBasePath}/mail.svg`,
  anchor: `${faviconBasePath}/anchor.svg`,
  rss: `${faviconBasePath}/rss.svg`,
  turntrout: `${faviconBasePath}/turntrout_com.svg`,
  substack: `${faviconBasePath}/substack_com.svg`,
  lesswrong: `${faviconBasePath}/lesswrong_com.svg`,
} as const

// Favicon display configuration
export const minFaviconCount = 6
export const googleSubdomainWhitelist = [
  "scholar",
  "play",
  "docs",
  "drive",
  "mail",
  "colab.research",
]
export const faviconCountWhitelist = [
  "apple_com",
  "x_com",
  "open_spotify_com",
  "discord_gg",
  "huggingface_co",
  "deepmind_com",
  "anthropic_com",
  "sfchronicle_com",
  "nytimes_com",
  "whitehouse_gov",
  "msnbc_com",
  "openai_com",
  "abcnews_go_com",
  "cnn_com",
  "forum_effectivealtruism_org",
  "substack_com",
]
export const faviconSubstringBlacklist = [
  "incompleteideas_net",
  "hpmor_com",
  "jacobgw",
  "pubsonline_informs_org",
  "nickbostrom_com",
  "vox_com",
  "cs_umd",
  "acritch",
  "medium_com",
  "snopes_com",
  "wired_com",
  "selfawaresystems",
  "vkrakovna",
  "developer_mozilla_org",
  "link_springer_com",
  "unicog_org",
  "proceedings_neurips_cc",
  "papers_nips_cc",
  "playpen_icomtek_csir_co_za",
  "distill_pub",
  "mathpix",
  "sciencedirect",
  "aclanthology",
  "mlr_press",
  "openpgp",
]

// UI strings (extracted from i18n en-US locale)
export const uiStrings = {
  propertyDefaults: {
    title: "The Pond",
    description: "Writings about doing good, thinking well, and living happily.",
  },
  components: {
    admonition: {
      note: "Note",
      abstract: "Abstract",
      info: "Info",
      todo: "To-do",
      tip: "Tip",
      success: "Success",
      question: "Question",
      warning: "Warning",
      failure: "Failure",
      danger: "Danger",
      bug: "Bug",
      example: "Example",
      quote: "Quote",
    },
    backlinks: {
      title: "Backlinks",
      noBacklinksFound: "No backlinks found.",
    },
    themeToggle: {
      lightMode: "Light mode",
      darkMode: "Dark mode",
    },
    explorer: {
      title: "Articles",
    },
    footer: {
      createdWith: "Created with",
    },
    graph: {
      title: "Graph View",
    },
    recentNotes: {
      title: "Recent Notes",
      seeRemainingMore: (remaining: number) => `See ${remaining} more →`,
    },
    transcludes: {
      transcludeOf: (targetSlug: string) => `Transclude of ${targetSlug}`,
      linkToOriginal: "Link to original",
    },
    search: {
      title: "Search",
      searchBarPlaceholder: "Search for something",
    },
    tableOfContents: {
      title: "Table of Contents",
    },
    contentMeta: {
      readingTime: (minutes: number) => `${minutes} min read`,
    },
  },
  pages: {
    rss: {
      recentNotes: "Recent notes",
      lastFewNotes: (count: number) => `Last ${count} notes`,
    },
    error: {
      title: "Not found",
      notFound: "Either this page is private or doesn't exist.",
    },
    folderContent: {
      folder: "Folder",
      itemsUnderFolder: (count: number) =>
        count === 1 ? "1 item under this folder." : `${count} items under this folder.`,
    },
    tagContent: {
      tag: "Tag",
      tagIndex: "Tag index",
      itemsUnderTag: (count: number) =>
        count === 1 ? "1 item with this tag." : `${count} items with this tag.`,
      showingFirst: (count: number) => `Showing first ${count} tags.`,
      totalTags: (count: number) => `Found ${count} total tags.`,
    },
  },
} as const
