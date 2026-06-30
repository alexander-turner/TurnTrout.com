import {
  addAssetDimensionsFromSrc,
  AddFavicons,
  AfterArticle,
  AliasRedirects,
  AllTagsPage,
  ArchiveLinks,
  Assets,
  AutoCode,
  Bibtex,
  BindLinkTitles,
  ColorVariables,
  ComponentResources,
  ContentIndex,
  ContentPage,
  CrawlLinks,
  CreatedModifiedDate,
  FixFootnotes,
  FrontMatter,
  GitHubFlavoredMarkdown,
  githubReadmeSource,
  HTMLFormattingImprovement,
  InlineCodeSpacing,
  InvertInDarkMode,
  Latex,
  NotFoundPage,
  ObsidianFlavoredMarkdown,
  PopulateContainers,
  PopulateExternalMarkdown,
  PrefixExternalReadmeIds,
  RecentPostsPage,
  rehypeCustomSpoiler,
  rehypeCustomSubtitle,
  RelatedPosts,
  RemoveDrafts,
  RemoveFixtures,
  RemovePartials,
  Static,
  StripInlineBoundaryWhitespace,
  SyntaxHighlighting,
  TableDivider,
  TableOfContents,
  TagPage,
  TagSmallcaps,
  TextFormattingImprovement,
  TroutOrnamentHr,
  TweetEmbed,
  Twemoji,
  WrapNakedElements,
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
          punctilio: githubReadmeSource("alexander-turner", "punctilio", {
            maxSections: 0,
          }),
          "claude-guard": githubReadmeSource("alexander-turner", "claude-guard", {
            maxSections: 0,
          }),
          "ci-truth-serum": githubReadmeSource("alexander-turner", "ci-truth-serum", {
            maxSections: 1,
          }),
          "agent-input-sanitizer": githubReadmeSource("alexander-turner", "agent-input-sanitizer", {
            maxSections: 1,
          }),
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
            filePath: "website_content/partials/font_stats.md",
          },
          "goose-terminal": {
            filePath: "website_content/partials/goose-terminal.md",
          },
          "emoji-comparison": {
            filePath: "website_content/partials/emoji-comparison.md",
          },
          "inversion-demo": {
            filePath: "website_content/partials/inversion-demo.md",
          },
          "cheese-network-architecture": {
            filePath: "website_content/partials/cheese-network-architecture.md",
          },
        },
      }),
      CreatedModifiedDate(),
      TextFormattingImprovement(),
      Twemoji(),
      TroutOrnamentHr(),
      Bibtex(),
      // Before SyntaxHighlighting so ```tweet blocks become cards rather than
      // being handed to the highlighter as an unknown "tweet" language.
      TweetEmbed(),
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
      // After GitHubFlavoredMarkdown assigns heading ids/autolinks: namespace the
      // ids of embedded external READMEs so they stay unique on the host page.
      PrefixExternalReadmeIds(),
      TableDivider(),
      FixFootnotes(),
      WrapNakedElements(),
      // Before HTMLFormattingImprovement so the "subtitle" class is set when
      // nbsp transforms run, letting them skip subtitles like they skip headings.
      rehypeCustomSubtitle(),
      HTMLFormattingImprovement(),
      Latex(),
      CrawlLinks({ lazyLoad: true, markdownLinkResolution: "shortest" }),
      // After CrawlLinks so `data-slug`/`href` are resolved, and before
      // AddFavicons so the favicon is woven into the resolved title rather than
      // the `@title` sentinel.
      BindLinkTitles(),
      // After CrawlLinks so it sees normalized https:// hrefs + the "external"
      // class; swaps confirmed-dead outbound links for their archived copy.
      ArchiveLinks(),
      rehypeCustomSpoiler(),
      TagSmallcaps(),
      AutoCode(),
      AfterArticle(),
      RelatedPosts(),
      AddFavicons(),
      // After AddFavicons because favicon insertion can rewrite link
      // content and reintroduce leading whitespace inside an <a>.
      StripInlineBoundaryWhitespace(),
      // After whitespace stripping so the preceding-character check sees the
      // final inline structure (a glued "(" isn't separated by stray text).
      InlineCodeSpacing(),
      ColorVariables(),
      TableOfContents({ minEntries: 3 }),
      addAssetDimensionsFromSrc(),
      InvertInDarkMode(),
    ],
    filters: [RemoveDrafts(), RemoveFixtures(), RemovePartials()],
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
