export const defaultCardUrl = "https://assets.turntrout.com/static/images/fb_preview.png"
export const defaultTitle = "The Pond"
export const defaultDescription = "Writings about doing good, thinking well, and living happily."
export const faviconUrl =
  "https://assets.turntrout.com/static/images/turntrout-favicons/favicon.ico"
export const locale = "en-US"

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
