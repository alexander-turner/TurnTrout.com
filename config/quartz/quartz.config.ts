import { QuartzConfig } from "../../quartz/cfg"
import {
  AddFavicons,
  AfterArticle,
  AliasRedirects,
  AllTagsPage,
  Assets,
  Bibtex,
  CrawlLinks,
  CreatedModifiedDate,
  FixFootnotes,
  FrontMatter,
  GitHubFlavoredMarkdown,
  HTMLFormattingImprovement,
  Latex,
  NotFoundPage,
  ObsidianFlavoredMarkdown,
  PopulateExternalMarkdown,
  RecentPostsPage,
  RemoveDrafts,
  Static,
  stripBadges,
  SyntaxHighlighting,
  TableOfContents,
  TagAcronyms,
  TagPage,
  TextFormattingImprovement,
  TroutOrnamentHr,
  Twemoji,
  WrapNakedElements,
  addAssetDimensionsFromSrc,
  ColorVariables,
  ContentIndex,
  ContentPage,
  ComponentResources,
  rehypeCustomSpoiler,
  rehypeCustomSubtitle,
  PopulateContainers,
} from "../../quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "The Pond",
    enablePopovers: true,
    analytics: null,

    baseUrl: "turntrout.com",
    ignorePatterns: ["private", "templates/**", ".obsidian"],
    defaultDateType: "published",
    navbar: {
      pages: [
        { title: "About me", slug: "/about" },
        { title: "My research", slug: "/research" },
        { title: "All posts", slug: "/posts" },
        { title: "Open source", slug: "/open-source" },
      ],
    },
  },
  plugins: {
    transformers: [
      FrontMatter(),
      PopulateExternalMarkdown({
        sources: {
          punctilio: {
            owner: "alexander-turner",
            repo: "punctilio",
            transform: (content: string) => {
              let result = stripBadges(content)
              // Ensure the bold feature list paragraph ends with a period
              result = result.replace(
                /\*\*Bri'ish localisation support\*\*/g,
                "**Bri'ish localisation support.**",
              )
              return result
            },
          },
        },
      }),
      CreatedModifiedDate(),
      TextFormattingImprovement(),
      Twemoji(),
      TroutOrnamentHr(),
      Bibtex(),
      SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      ObsidianFlavoredMarkdown({
        enableInHtmlEmbed: true,
        parseArrows: false,
        enableCheckbox: true,
      }),
      GitHubFlavoredMarkdown({ enableSmartyPants: false }),
      FixFootnotes(),
      WrapNakedElements(),
      HTMLFormattingImprovement(),
      Latex({ renderEngine: "katex" }),
      CrawlLinks({ lazyLoad: true, markdownLinkResolution: "shortest" }),
      rehypeCustomSpoiler(),
      rehypeCustomSubtitle(),
      TagAcronyms(),
      AfterArticle(),
      AddFavicons(),
      ColorVariables(),
      TableOfContents(),
      addAssetDimensionsFromSrc(),
    ],
    filters: [RemoveDrafts()],
    emitters: [
      AliasRedirects(),
      ComponentResources(),
      ContentPage(),
      PopulateContainers(),
      TagPage(),
      AllTagsPage(),
      RecentPostsPage(),
      ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Assets(),
      Static(),
      NotFoundPage(),
    ],
  },
}

export default config
