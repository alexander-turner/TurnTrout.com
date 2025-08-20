import { VFile } from "vfile"

import { type GlobalConfiguration } from "../cfg"
import { formatTitle } from "../components/component_utils"
import {
  defaultCardUrl,
  defaultDescription,
  defaultTitle,
  appleTouchIconUrl,
  faviconUrl,
} from "../components/constants"
import { type ProcessedContent } from "../plugins/vfile"
import { escapeHTML } from "./escape"
import { resolveRelative, type FullSlug } from "./path"

interface HeadProps {
  cfg: GlobalConfiguration
  fileData: ProcessedContent | VFile
  slug: FullSlug
  redirect?: {
    slug: FullSlug
    to: FullSlug
  }
}

// skipcq: JS-D1001
function maybeRenderAuthorTags(authors: string | undefined): string {
  if (!authors) {
    return ""
  }
  return `
    <meta name="twitter:label1" content="Written by" />
    <meta name="twitter:data1" content="${escapeHTML(authors)}" />
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
  const data = Array.isArray(fileData) ? fileData[1].data : fileData.data
  const title = formatTitle(data.frontmatter?.title ?? defaultTitle)
  const description = data.frontmatter?.description?.trim() ?? defaultDescription

  const url = new URL(`https://${cfg.baseUrl ?? "turntrout.com"}`)
  const pageUrl = new URL(slug, url).href
  const redirUrl = redirect
    ? resolveRelative(redirect.slug, redirect.to)
    : (data.permalink as string) || pageUrl

  const cardImage = (data.frontmatter?.card_image as string) ?? defaultCardUrl
  const altText =
    cardImage === defaultCardUrl
      ? "A pond containing a trout and a goose peacefully swimming near a castle."
      : description
  const imageTags = renderImageTags(cardImage, altText)

  const authors = data.frontmatter?.authors as string | undefined
  const videoPreview = data.frontmatter?.video_preview_link as string | undefined
  const videoTags = videoPreview ? maybeProduceVideoTag(videoPreview) : ""

  return `
    <title>${escapeHTML(title)}</title>
    <meta name="description" content="${escapeHTML(description)}">
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
    <meta name="twitter:image" content="${escapeHTML(cardImage)}" />
    <meta name="twitter:site" content="@Turn_Trout" />
    ${maybeRenderAuthorTags(authors)}

    <link rel="icon" href="${escapeHTML(faviconUrl)}" type="image/x-icon" />
    <link rel="apple-touch-icon" href="${escapeHTML(appleTouchIconUrl)}" />
  `
}
