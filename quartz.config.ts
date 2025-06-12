import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4.0 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "The Pond",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "turntrout.com",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "published", // What to display on listings
    navbar: {
      pages: [
        { title: "About me", slug: "/about" },
        { title: "My research", slug: "/research" },
        { title: "Posts", slug: "/posts" },
      ],
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "filesystem"],
      }),
      Plugin.TextFormattingImprovement(),
      Plugin.Twemoji(),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: true, parseArrows: false }),
      Plugin.GitHubFlavoredMarkdown({ enableSmartyPants: false }),
      // HTML formatting would mess up mermaid if it came first
      Plugin.HTMLFormattingImprovement(),
      Plugin.Latex({ renderEngine: "katex" }),
      Plugin.CrawlLinks({ lazyLoad: true, markdownLinkResolution: "shortest" }),
      Plugin.TagAcronyms(),
      Plugin.TroutOrnamentHr(),
      Plugin.AddFavicons(),
      Plugin.AfterArticle(),
      Plugin.ColorVariables(),
      Plugin.rehypeCustomSpoiler(),
      Plugin.rehypeCustomSubtitle(),
      Plugin.TableOfContents(),
      Plugin.WrapNakedElements(),
      Plugin.addAssetDimensionsFromSrc(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.TagPage(),
      Plugin.AllTagsPage(),
      Plugin.RecentPostsPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
