import { VFile } from "vfile"

import { type GlobalConfiguration } from "../cfg"
import { formatTitle } from "../components/component_utils"
import { i18n } from "../i18n"
import { type ProcessedContent } from "../plugins/vfile"
import { resolveRelative, type FullSlug } from "./path"

export const defaultCardUrl = "https://assets.turntrout.com/static/images/fb_preview.png"
export const defaultTitle = "The Pond"
export const defaultDescription = "Writings about doing good, thinking well, and living happily."

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
    <meta name="twitter:data1" content="${authors}" />
  `
}

// skipcq: JS-D1001
function maybeProduceVideoTag(videoPreview: string | undefined): string {
  if (!videoPreview) {
    return ""
  }
  return `<meta property="og:video" content="${videoPreview}" />`
}

// skipcq: JS-D1001
function renderImageTags(cardImage: string, altText: string | undefined): string {
  return `
    <meta property="og:image" content="${cardImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${altText as string}" />
  `
}

// skipcq: JS-D1001
export function renderHead({ cfg, fileData, slug, redirect }: HeadProps): string {
  const data = Array.isArray(fileData) ? fileData[1].data : fileData.data
  const title = formatTitle(data.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title)
  const description =
    data.frontmatter?.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description

  const url = new URL(`https://${cfg.baseUrl ?? "turntrout.com"}`)
  const pageUrl = new URL(slug, url).href
  const redirUrl = redirect
    ? resolveRelative(redirect.slug, redirect.to)
    : data.permalink || pageUrl

  const cardImage = (data.frontmatter?.card_image as string) ?? defaultCardUrl
  const altText =
    cardImage === defaultCardUrl
      ? "A pond containing a trout and a goose peacefully swimming near a castle."
      : description

  const authors = data.frontmatter?.authors as string | undefined
  const videoPreview = data.frontmatter?.video_preview_link as string | undefined

  return `
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${title}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${redirUrl}" />
    <meta property="og:site_name" content="${defaultTitle}" />
    ${
      typeof description === "string" && `<meta property="og:description" content="${description}">`
    }
    ${videoPreview ? maybeProduceVideoTag(videoPreview) : renderImageTags(cardImage, altText)}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta
      name="twitter:description"
      content="${typeof description === "string" ? description : String(description)}"
    />
    <meta name="twitter:image" content="${cardImage}" />
    <meta name="twitter:site" content="@Turn_Trout" />
    ${maybeRenderAuthorTags(authors)}
  `
}
