import { i18n } from "../i18n"
import { JSResourceToScriptElement } from "../util/resources"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { formatTitle } from "./component_utils"

export default (() => {
  const Head: QuartzComponent = ({ cfg, fileData, externalResources }: QuartzComponentProps) => {
    let title = fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title
    title = formatTitle(title)
    const description =
      fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description
    const { css, js } = externalResources

    // Reconstruct the URL for this page (its permalink)
    const url = new URL(`https://${cfg.baseUrl ?? "turntrout.com"}/${fileData.slug}`)

    const iconPath = "static/images/favicon.ico"
    const permalink = fileData.permalink || url.href
    const siteImage = "https://assets.turntrout.com/static/images/fb_preview.avif"

    // Have both square and FB previews TODO check that this works
    let mediaElement = (
      <>
        <meta property="og:image" content="https://assets.turntrout.com/static/pond.webm" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="1200" />

        <meta property="og:image" content={siteImage} />
        <meta
          property="og:image:alt"
          content="A trout and a goose playing in a pond with a castle in the background."
        />
      </>
    )

    if (fileData?.frontmatter?.video_preview_link) {
      mediaElement = <meta property="og:video" content={fileData.video_preview_link as string} />
    }

    return (
      <head>
        <title>{title}</title>
        <meta name="description" content={description} />

        <meta charSet="utf-8" />
        <script src="/static/scripts/detect-dark-mode.js"></script>
        <script src="/static/scripts/tag-first-letter.js"></script>
        <script src="/static/scripts/collapsible-listeners.js"></script>
        <script src="/static/scripts/DOMContentLoaded.js"></script>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {fileData.frontmatter?.avoidIndexing && (
          <meta name="robots" content="noindex, noimageindex,nofollow" />
        )}

        <meta property="og:title" content={title} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={permalink as string} />
        <meta property="og:site_name" content="The Pond" />
        <meta property="og:description" content={description} />
        {mediaElement}

        {/* Twitter Card metadata */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={siteImage} />
        <meta name="twitter:site" content="@Turn_Trout" />

        <link rel="icon" href={iconPath} />
        {css.map((href) => (
          <link key={href} href={href} rel="stylesheet" type="text/css" spa-preserve />
        ))}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res, true))}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
