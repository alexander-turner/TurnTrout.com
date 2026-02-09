import { type GlobalConfiguration } from "../cfg"
import { formatAuthors } from "../components/Authors"
import { formatTitle } from "../components/component_utils"
import { simpleConstants, faviconUrl } from "../components/constants"
import { type QuartzPluginData } from "../plugins/vfile"
import { backgroundDark, backgroundLight } from "../styles/variables"
import { escapeHTML } from "./escape"
import { resolveRelative, type FullSlug } from "./path"

const {
  defaultCardUrl,
  defaultDescription,
  defaultTitle,
  appleTouchIconUrl,
  faviconMimeType,
  defaultCardAlt,
} = simpleConstants

interface HeadProps {
  cfg: GlobalConfiguration
  fileData: QuartzPluginData
  slug: FullSlug
  redirect?: {
    slug: FullSlug
    to: FullSlug
  }
}

// skipcq: JS-D1001
function maybeRenderAuthorTags(authors: string[] | undefined): string {
  if (!authors || authors.length === 0) {
    return ""
  }
  const authorsString = formatAuthors(authors)
  return `
    <meta name="twitter:label1" content="Written by" />
    <meta name="twitter:data1" content="${escapeHTML(authorsString)}" />
  `
}

// skipcq: JS-D1001
export function maybeProduceVideoTag(videoPreview: string | undefined): string {
  if (!videoPreview) {
    return ""
  }
  return `<meta property="og:video" content="${escapeHTML(videoPreview)}" />`
}

// skipcq: JS-D1001
function renderImageTags(cardImage: string, altText: string | undefined): string {
  return `
    <meta property="og:image" content="${escapeHTML(cardImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHTML(altText as string)}" />
  `
}

// skipcq: JS-D1001
export function renderHead({ cfg, fileData, slug, redirect }: HeadProps): string {
  const title = formatTitle(fileData.frontmatter?.title ?? defaultTitle)
  const description = fileData.frontmatter?.description?.trim() ?? defaultDescription

  const url = new URL(`https://${cfg.baseUrl ?? "turntrout.com"}`)
  const pageUrl = new URL(slug, url).href
  const redirUrl = redirect
    ? resolveRelative(redirect.slug, redirect.to)
    : (fileData.permalink as string) || (fileData.frontmatter?.permalink as string) || pageUrl

  const cardImageString = fileData.frontmatter?.card_image as string
  const cardImageUrl = cardImageString ?? defaultCardUrl
  const hasCustomCardImage = cardImageUrl !== defaultCardUrl
  let altCardText = defaultCardAlt
  if (hasCustomCardImage) {
    altCardText = (fileData.frontmatter?.card_image_alt as string | undefined) ?? description
  }
  const imageTags = renderImageTags(cardImageUrl, altCardText)

  const authors = fileData.frontmatter?.authors
  const videoPreview = fileData.frontmatter?.video_preview_link as string | undefined
  const videoTags = videoPreview ? maybeProduceVideoTag(videoPreview) : ""

  return `
    <title>${escapeHTML(title)}</title>
    <meta name="description" content="${escapeHTML(description)}">
    <link rel="canonical" href="${escapeHTML(pageUrl)}" />
    <meta name="theme-color" content="${backgroundLight}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${backgroundDark}" media="(prefers-color-scheme: dark)" />
    <meta property="og:title" content="${escapeHTML(title)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHTML(redirUrl)}" />
    <meta property="og:site_name" content="${escapeHTML(defaultTitle)}" />
    <meta property="og:description" content="${escapeHTML(description)}">
    ${videoTags}
    ${imageTags}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHTML(title)}" />
    <meta
      name="twitter:description"
      content="${escapeHTML(description)}"
    />
    <meta name="twitter:image" content="${escapeHTML(cardImageUrl)}" />
    <meta name="twitter:site" content="@Turn_Trout" />
    ${maybeRenderAuthorTags(authors)}

    <link rel="icon" href="${escapeHTML(faviconUrl)}" type="${escapeHTML(faviconMimeType)}" />
    <link rel="apple-touch-icon" href="${escapeHTML(appleTouchIconUrl)}" />
  `
}
