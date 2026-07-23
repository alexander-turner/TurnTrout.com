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
  HTMLFormattingImprovement,
  InlineCodeSpacing,
  InvertInDarkMode,
  Latex,
  LinkContexts,
  NonBreakingHyphens,
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
import { GITHUB_README_SOURCES } from "./externalReadmes"

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
          ...GITHUB_README_SOURCES,
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
          "gdm-signature": {
            filePath: "website_content/partials/gdm-signature.md",
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
      // After TagSmallcaps (and AutoCode) so acronyms are already wrapped in
      // <abbr>: gluing a word joiner into "GPT-4" earlier would split the
      // small-caps match. Glues short hyphenated compounds so they don't wrap.
      NonBreakingHyphens(),
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
      // After the favicon, smallcaps, spoiler, inline-code, and asset-dimension
      // passes so backlink excerpts mirror the final rendered prose: favicons
      // stripped, spoilers hidden, and preserved emoji <img> already carrying the
      // width/height addAssetDimensionsFromSrc stamps. The excerpt is serialized
      // to a string here and never re-processed, so every inline atom must be
      // final before it is captured.
      LinkContexts(),
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
