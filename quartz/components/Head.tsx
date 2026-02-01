/* eslint-disable react/no-unknown-property */
import type { JSX } from "react";

// (For the spa-preserve attribute)
import { fromHtml } from "hast-util-from-html";
// skipcq: JS-W1028
import React from "react";

import { GlobalConfiguration } from "../cfg";
import { QuartzPluginData } from "../plugins/vfile";
import { renderHead } from "../util/head";
import { htmlToJsx } from "../util/jsx";
import { FullSlug, type FilePath } from "../util/path";
import { JSResourceToScriptElement } from "../util/resources";
import {
  type QuartzComponent,
  type QuartzComponentConstructor,
  type QuartzComponentProps,
} from "./types";

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
] as const;

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
  );
}

export function renderMetaJsx(
  cfg: GlobalConfiguration,
  fileData: QuartzPluginData,
): JSX.Element {
  const headHtml = renderHead({
    cfg,
    fileData,
    slug: fileData.slug as FullSlug,
    redirect: undefined,
  });

  // Convert HTML string to HAST tree, then to JSX
  const headHast = fromHtml(headHtml, { fragment: true });
  const slug = fileData.slug || "head";
  const headJsx = htmlToJsx(slug as unknown as FilePath, headHast);
  // istanbul ignore next -- too hard to test
  if (!headJsx) {
    throw new Error(`Head JSX conversion failed for slug: ${slug}`);
  }
  return headJsx;
}

export default (() => {
  // skipcq: JS-D1001
  const Head: QuartzComponent = ({
    cfg,
    fileData,
    externalResources,
  }: QuartzComponentProps) => {
    const headJsx = renderMetaJsx(cfg, fileData);

    // Scripts
    const { js } = externalResources;
    const analyticsScript = (
      <script
        defer
        src="https://cloud.umami.is/script.js"
        data-website-id="fa8c3e1c-3a3c-4f6d-a913-6f580765bfae"
        spa-preserve
      />
    );
    // Create a filtered object with only the properties you want to expose
    const exposedFrontmatter = {
      no_dropcap: fileData.frontmatter?.no_dropcap,
    };

    const frontmatterScript = (
      <script
        type="application/json"
        id="quartz-frontmatter"
        // skipcq: JS-0440
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(exposedFrontmatter),
        }}
      />
    );

    const iconPreloads = CALLOUT_ICONS.map((icon) => {
      return (
        <link
          key={icon}
          href={`https://assets.turntrout.com/static/icons/${icon}.svg`}
          as="image"
          type="image/svg+xml"
          crossorigin="anonymous"
          spa-preserve
        />
      );
    });

    const fontPreloadNames = [
      "EBGaramond/EBGaramond-InitialsF1",
      "EBGaramond/EBGaramond-InitialsF2",
    ];
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
      );
    });

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
      {
        id: "lock-video-playback-rate",
        src: "/static/scripts/lockVideoPlaybackRate.js",
      },
    ];

    return (
      <head>
        <meta charSet="utf-8" />
        {staticScripts.map(({ id, src }) => generateScriptElement(id, src))}
        <meta name="viewport" content="width=device-width" />
        {headJsx}
        <link rel="preload" href="/index.css" as="style" spa-preserve />
        <link rel="stylesheet" href="/index.css" spa-preserve />
        <link
          rel="preconnect"
          href="https://assets.turntrout.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://cloud.umami.is"
          crossOrigin="anonymous"
        />
        {fileData.frontmatter?.avoidIndexing && (
          <meta name="robots" content="noindex, noimageindex,nofollow" />
        )}
        <link
          rel="stylesheet"
          href="/static/styles/katex.min.css"
          spa-preserve
        />
        {iconPreloads}
        {fontPreloads}
        <script
          defer
          src="/static/scripts/collapsible-listeners.js"
          spa-preserve
        />
        <script defer src="/static/scripts/safari-autoplay.js" spa-preserve />
        <script defer src="/static/scripts/remove-css.js" spa-preserve />
        {/* Show Elvish translations when JavaScript is disabled */}
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: `
            .elvish { cursor: default; text-decoration: none; }
            .elvish .elvish-tengwar::after { content: " — "; }
            .elvish .elvish-translation { display: inline !important; font-family: var(--font-main); }
          `,
            }}
          />
        </noscript>
        {analyticsScript}
        {js
          .filter((resource) => resource.loadTime === "beforeDOMReady")
          .map((res) => JSResourceToScriptElement(res))}
        {frontmatterScript}
      </head>
    );
  };

  return Head;
}) satisfies QuartzComponentConstructor;
