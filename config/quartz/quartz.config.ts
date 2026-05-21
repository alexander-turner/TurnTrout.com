import {
  AddFavicons,
  AfterArticle,
  AliasRedirects,
  AllTagsPage,
  Assets,
  AutoCode,
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
  RemoveFixtures,
  Static,
  stripBadges,
  StripInlineBoundaryWhitespace,
  SyntaxHighlighting,
  TableDivider,
  TableOfContents,
  TagPage,
  TagSmallcaps,
  TextFormattingImprovement,
  TroutOrnamentHr,
  Twemoji,
  WrapNakedElements,
  addAssetDimensionsFromSrc,
  InvertInDarkMode,
  ColorVariables,
  ContentIndex,
  ContentPage,
  ComponentResources,
  rehypeCustomSpoiler,
  rehypeCustomSubtitle,
  PopulateContainers,
} from "../../quartz/plugins"
import { QuartzConfig } from "../../quartz/util/ctx"

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
            transform: stripBadges,
          },
          "lint-staged": {
            filePath: "package.json",
            jsonPath: "lint-staged",
            transform: (content: string) => `\`\`\`json\n${content}\n\`\`\``,
          },
          "large-file-limit": {
            filePath: ".pre-commit-config.yaml",
            transform: (content: string) => {
              const match = content.match(/--maxkb=(?<kb>\d+)/)
              if (!match?.groups) {
                throw new Error(
                  "Could not find --maxkb= in .pre-commit-config.yaml " +
                    "(populate-markdown-large-file-limit)",
                )
              }
              const kb = Number(match.groups.kb)
              return kb >= 1024 && kb % 1024 === 0 ? `${kb / 1024} MB` : `${kb} KB`
            },
          },
          "font-stats": {
            filePath: "config/font_stats.md",
          },
          "goose-terminal": {
            filePath: "config/partials/goose-terminal.md",
          },
          "emoji-comparison": {
            filePath: "config/partials/emoji-comparison.md",
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
      TableDivider(),
      FixFootnotes(),
      WrapNakedElements(),
      // Before HTMLFormattingImprovement so the "subtitle" class is set when
      // nbsp transforms run, letting them skip subtitles like they skip headings.
      rehypeCustomSubtitle(),
      HTMLFormattingImprovement(),
      Latex(),
      CrawlLinks({ lazyLoad: true, markdownLinkResolution: "shortest" }),
      rehypeCustomSpoiler(),
      TagSmallcaps(),
      AutoCode(),
      AfterArticle(),
      AddFavicons(),
      // After AddFavicons because favicon insertion can rewrite link
      // content and reintroduce leading whitespace inside an <a>.
      StripInlineBoundaryWhitespace(),
      ColorVariables(),
      TableOfContents({ minEntries: 3 }),
      addAssetDimensionsFromSrc(),
      InvertInDarkMode(),
    ],
    filters: [RemoveDrafts(), RemoveFixtures()],
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
