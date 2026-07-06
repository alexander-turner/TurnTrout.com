import type { JSX } from "preact"

// skipcq: JS-W1028
import React from "react"

import { type QuartzPluginData } from "../plugins/vfile"
import { type FullSlug, resolveRelative, type SimpleSlug, simplifySlug } from "../util/path"
import { formatTitle, renderTitleJsx } from "./component_utils"
import { BACKLINK_EXCERPT_CLASS } from "./constants"
import { type QuartzComponent, type QuartzComponentProps } from "./types"

/**
 * Renders a stored excerpt as a deep-link below a backlink title; clicking it
 * jumps to that specific citing location. The excerpt HTML is the pipeline's
 * own rendered output (twemoji, KaTeX, small-caps already baked in and
 * sanitized in `linkContexts.ts`), so it is injected verbatim rather than
 * re-rendered — the single source of truth for inline formatting.
 */
function renderExcerpt(excerptHtml: string, href: string, key: string): JSX.Element {
  return (
    <a
      key={key}
      href={href}
      className={`${BACKLINK_EXCERPT_CLASS} internal can-trigger-popover`}
      // skipcq: JS-0440 excerptHtml is our own build-time output, sanitized in linkContexts.ts
      dangerouslySetInnerHTML={{ __html: excerptHtml }}
    />
  )
}

/**
 * @param backlinkFiles - The list of files that link to the current file
 * @param currentSlug - The slug of the current file
 * @returns A list of links to the current file
 */
const BacklinksList = ({
  backlinkFiles,
  currentSlug,
}: {
  backlinkFiles: QuartzPluginData[]
  currentSlug: FullSlug
}): JSX.Element => {
  const currentTarget = simplifySlug(currentSlug)
  return (
    <ul>
      {backlinkFiles.map((f) => {
        if (!("frontmatter" in f) || !("slug" in f) || !f.frontmatter?.title) {
          return null
        }
        const titleJsx = renderTitleJsx(formatTitle(f.frontmatter.title))
        const contexts = (f.linkContexts ?? []).filter(
          (lc) => lc.target === currentTarget && lc.excerptHtml,
        )
        const baseHref = resolveRelative(currentSlug, f.slug as FullSlug)
        // The title reads the original post from the top; each excerpt below
        // deep-links to its own citing location.
        return (
          <li key={f.slug}>
            <a
              href={baseHref}
              className="internal can-trigger-popover"
              title="Read the original post"
            >
              {titleJsx}
            </a>
            {contexts.map((ctx) =>
              renderExcerpt(ctx.excerptHtml, `${baseHref}#${ctx.anchor}`, ctx.anchor),
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * @param allFiles - The list of all files in the site
 * @param currentFile - The file that we are getting backlinks for
 * @returns A list of quartz plugin data for the files that link to the current file
 */
export const getBacklinkFileData = (
  allFiles: QuartzPluginData[],
  currentFile: QuartzPluginData,
): QuartzPluginData[] => {
  const slug = simplifySlug(currentFile.slug as FullSlug)
  return allFiles.filter((otherFile) => {
    const otherFileSlug = simplifySlug(otherFile.slug as FullSlug)
    return (
      otherFile.links?.some((link: SimpleSlug) => {
        // Remove anchor from link before comparison
        const linkWithoutAnchor = link.toString().split("#")[0]
        return linkWithoutAnchor === slug && otherFileSlug !== slug
      }) ?? false
    )
  })
}

/** Collapsible "Links to this page" block listing pages whose links resolve to this slug. */
export const Backlinks: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const backlinkFiles: QuartzPluginData[] = getBacklinkFileData(allFiles, fileData)
  if (backlinkFiles.length === 0) return null

  return (
    <blockquote
      className="admonition link admonition-metadata is-collapsible is-collapsed"
      id="backlinks"
      data-admonition="link"
      data-admonition-fold=""
    >
      <div className="admonition-title">
        <span className="admonition-title-inner">
          <span className="admonition-icon" />
          Links to this page
        </span>
        <div className="fold-admonition-icon" />
      </div>
      <div className="admonition-content">
        <BacklinksList backlinkFiles={backlinkFiles} currentSlug={fileData.slug as FullSlug} />
      </div>
    </blockquote>
  )
}
