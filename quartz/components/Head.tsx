/* eslint-disable react/no-unknown-property */
import type { JSX } from "react"

// (For the spa-preserve attribute)
import { fromHtml } from "hast-util-from-html"
// skipcq: JS-W1028
import React from "react"

import { GlobalConfiguration } from "../cfg"
import { QuartzPluginData } from "../plugins/vfile"
import { renderHead } from "../util/head"
import { htmlToJsx } from "../util/jsx"
import { FullSlug, type FilePath } from "../util/path"
import { JSResourceToScriptElement } from "../util/resources"
import { cdnBaseUrl } from "./constants"
import { ELVISH_NOSCRIPT_CSS } from "./scripts/elvish-toggle"
import {
  type QuartzComponent,
  type QuartzComponentConstructor,
  type QuartzComponentProps,
} from "./types"

// Preload icons to prevent race condition on admonition icons
//  These are very small assets, so we can preload them all
const CALLOUT_ICONS = [
  "note",
  "abstract",
  "info",
  "todo",
  "success",
  "question",
  "warning",
  "failure",
  "danger",
  "bug",
  "example",
  "quote",
  "fold",
  "plus",
  "lightbulb",
  "goose",
  "heart",
  "tag",
  "link",
  "math",
  "dollar",
] as const

/*
 * Render the meta JSX for the head of the page.
 */
function generateScriptElement(id: string, src: string): JSX.Element {
  return (
    <script
      data-cfasync="false" // Prevent Cloudflare Rocketloader from delaying the script
      id={id}
      src={src}
      spa-preserve
    />
  )
}

export function renderMetaJsx(cfg: GlobalConfiguration, fileData: QuartzPluginData): JSX.Element {
  const headHtml = renderHead({
    cfg,
    fileData,
    slug: fileData.slug as FullSlug,
    redirect: undefined,
  })

  // Convert HTML string to HAST tree, then to JSX
  const headHast = fromHtml(headHtml, { fragment: true })
  const slug = fileData.slug || "head"
  const headJsx = htmlToJsx(slug as unknown as FilePath, headHast)
  // istanbul ignore next -- too hard to test
  if (!headJsx) {
    throw new Error(`Head JSX conversion failed for slug: ${slug}`)
  }
  return headJsx
}

export default (() => {
  // skipcq: JS-D1001
  const Head: QuartzComponent = ({ cfg, fileData, externalResources }: QuartzComponentProps) => {
    const headJsx = renderMetaJsx(cfg, fileData)

    // Scripts
    const { js } = externalResources
    const analyticsScript = (
      <script
        defer
        src="https://cloud.umami.is/script.js"
        data-website-id="fa8c3e1c-3a3c-4f6d-a913-6f580765bfae"
        spa-preserve
      />
    )
    // Create a filtered object with only the properties you want to expose
    const exposedFrontmatter = {
      no_dropcap: fileData.frontmatter?.no_dropcap,
    }

    const frontmatterScript = (
      <script
        type="application/json"
        id="quartz-frontmatter"
        // skipcq: JS-0440
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(exposedFrontmatter),
        }}
      />
    )

    const iconPreloads = CALLOUT_ICONS.map((icon) => {
      return (
        <link
          key={icon}
          rel="prefetch"
          href={`${cdnBaseUrl}/static/icons/${icon}.svg`}
          as="image"
          type="image/svg+xml"
          crossorigin="anonymous"
          spa-preserve
        />
      )
    })

    const fontPreloadNames = [
      // Main body font — preloading it prevents a font-swap LCP delay
      // (text first renders with a fallback font, then repaints with the
      // web font, and that repaint IS the LCP event on text-heavy pages)
      "EBGaramond/EBGaramond08-Regular",
      "EBGaramond/EBGaramond-InitialsF1",
      "EBGaramond/EBGaramond-InitialsF2",
    ]
    const fontPreloads = fontPreloadNames.map((font) => {
      return (
        <link
          key={font}
          href={`/static/styles/fonts/${font}.woff2`}
          as="font"
          type="font/woff2"
          crossorigin="anonymous"
          spa-preserve
          rel="preload"
        />
      )
    })

    const staticScripts = [
      // Inline the detect-initial-state script to prevent FOUC
      {
        id: "detect-initial-state",
        src: "/static/scripts/detectInitialState.js",
      },
      {
        id: "instant-scroll-restoration",
        src: "/static/scripts/instantScrollRestoration.js",
      },
    ]

    return (
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Preload hints and preconnects BEFORE sync scripts so the browser
            starts downloading CSS and establishing connections while scripts
            block the parser. */}
        <link rel="preconnect" href={cdnBaseUrl} crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cloud.umami.is" crossOrigin="anonymous" />
        <link rel="preload" href="/index.css" as="style" spa-preserve />
        {/* Preload the first content image (likely LCP element) so the browser
            starts downloading it immediately instead of waiting to discover the
            <img> tag deep in the HTML body. */}
        {fileData.firstImageUrl && <link rel="preload" href={fileData.firstImageUrl} as="image" />}
        {staticScripts.map(({ id, src }) => generateScriptElement(id, src))}
        <link rel="stylesheet" href="/index.css" spa-preserve />
        {headJsx}
        {fileData.frontmatter?.avoidIndexing && (
          <meta name="robots" content="noindex, noimageindex,nofollow" />
        )}
        {/* Load KaTeX CSS without blocking render — math styling applies
            once the sheet loads, but FCP/LCP aren't delayed.
            Use spread to bypass Preact's onLoad type (expects function, but SSR needs string). */}
        <link
          rel="stylesheet"
          href="/static/styles/katex.min.css"
          media="print"
          {...({ onload: "this.media='all'" } as Record<string, string>)}
          spa-preserve
        />
        <noscript>
          <link rel="stylesheet" href="/static/styles/katex.min.css" />
        </noscript>
        {iconPreloads}
        {fontPreloads}
        <script defer src="/static/scripts/collapsible-listeners.js" spa-preserve />
        <script defer src="/static/scripts/safari-autoplay.js" spa-preserve />
        <script defer src="/static/scripts/remove-css.js" spa-preserve />
        <script defer src="/static/scripts/lockVideoPlaybackRate.js" spa-preserve />
        <script defer src="/static/scripts/katex-a11y-tabindex.js" spa-preserve />
        <script defer src="/static/scripts/img-comparison-slider.js" spa-preserve />
        {/* Show Elvish translations when JavaScript is disabled */}
        <noscript>
          <style
            // skipcq: JS-0440 - Safe: static CSS string, not user input
            dangerouslySetInnerHTML={{ __html: ELVISH_NOSCRIPT_CSS }}
          />
        </noscript>
        {analyticsScript}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res))}
        {frontmatterScript}
      </head>
    )
  }

  return Head
}) satisfies QuartzComponentConstructor
