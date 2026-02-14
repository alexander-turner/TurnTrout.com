import { QuartzConfig } from "../../quartz/cfg"
import { NotFoundPage } from "../../quartz/plugins/emitters/404"
import { AliasRedirects } from "../../quartz/plugins/emitters/aliases"
import { AllPostsPage as RecentPostsPage } from "../../quartz/plugins/emitters/allPostsPage"
import { AllTagsPage } from "../../quartz/plugins/emitters/allTagsPage"
import { Assets } from "../../quartz/plugins/emitters/assets"
import { ComponentResources } from "../../quartz/plugins/emitters/componentResources"
import { ContentIndex } from "../../quartz/plugins/emitters/contentIndex"
import { ContentPage } from "../../quartz/plugins/emitters/contentPage"
import { PopulateContainers } from "../../quartz/plugins/emitters/populateContainers"
import { Static } from "../../quartz/plugins/emitters/static"
import { TagPage } from "../../quartz/plugins/emitters/tagPage"
import { RemoveDrafts } from "../../quartz/plugins/filters/draft"
import { AfterArticle } from "../../quartz/plugins/transformers/afterArticle"
import { addAssetDimensionsFromSrc } from "../../quartz/plugins/transformers/assetDimensions"
import { Bibtex } from "../../quartz/plugins/transformers/bibtex"
import { ColorVariables } from "../../quartz/plugins/transformers/color_variables"
import { FixFootnotes } from "../../quartz/plugins/transformers/fixFootnotes"
import { HTMLFormattingImprovement } from "../../quartz/plugins/transformers/formatting_improvement_html"
import { TextFormattingImprovement } from "../../quartz/plugins/transformers/formatting_improvement_text"
import { FrontMatter } from "../../quartz/plugins/transformers/frontmatter"
import { GitHubFlavoredMarkdown } from "../../quartz/plugins/transformers/gfm"
import { CreatedModifiedDate } from "../../quartz/plugins/transformers/lastmod"
import { Latex } from "../../quartz/plugins/transformers/latex"
import { AddFavicons } from "../../quartz/plugins/transformers/linkfavicons"
import { CrawlLinks } from "../../quartz/plugins/transformers/links"
import { ObsidianFlavoredMarkdown } from "../../quartz/plugins/transformers/ofm"
import {
  PopulateExternalMarkdown,
  stripBadges,
} from "../../quartz/plugins/transformers/populateExternalMarkdown"
import { rehypeCustomSpoiler } from "../../quartz/plugins/transformers/spoiler"
import { rehypeCustomSubtitle } from "../../quartz/plugins/transformers/subtitles"
import { SyntaxHighlighting } from "../../quartz/plugins/transformers/syntax"
import { TagSmallcaps as TagAcronyms } from "../../quartz/plugins/transformers/tagSmallcaps"
import { TableOfContents } from "../../quartz/plugins/transformers/toc"
import { TroutOrnamentHr } from "../../quartz/plugins/transformers/trout_hr"
import { Twemoji } from "../../quartz/plugins/transformers/twemoji"
import { WrapNakedElements } from "../../quartz/plugins/transformers/wrapNakedElements"

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
